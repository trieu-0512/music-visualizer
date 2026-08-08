"""Theme-first A-Z asset preparation with a pluggable segmentation adapter.

If processed ``assets/letters/{A-Z}.*`` and ``assets/objects/{A-Z}.*`` already
exist, this handler is idempotent and does no model work. Otherwise it consumes
``assets/source-images/{A-Z}.*`` and invokes an external segmentation command.
"""
from __future__ import annotations

import os
import shlex
import subprocess
import tempfile
from pathlib import Path
from typing import Callable

from src.queue import Job
from src.store import AssetStore
from src.validate_artifacts import validate_learning_map_payload

LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
MAPPING_PATH = "authoring/mapping.json"
LETTER_EXTS = (".png", ".webp", ".svg")
OBJECT_EXTS = (".png", ".webp", ".svg")
SOURCE_EXTS = (".png", ".jpg", ".jpeg", ".webp")

Segmenter = Callable[[str, str, str], tuple[bytes, bytes]]


def _first_existing(store: AssetStore, project_id: str, stem: str, exts: tuple[str, ...]) -> str | None:
    for ext in exts:
        rel = f"{stem}{ext}"
        if store.exists(project_id, rel):
            return rel
    return None


def _run_external_segmenter(source_path: str, letter: str, object_name: str) -> tuple[bytes, bytes]:
    command = os.environ.get("ABC_SEGMENTER_COMMAND", "").strip()
    if not command:
        raise RuntimeError(
            "Processed letter/object assets are missing and ABC_SEGMENTER_COMMAND is not configured. "
            "Copy transparent cuts into assets/letters + assets/objects or configure a segmentation adapter."
        )
    with tempfile.TemporaryDirectory(prefix="abc-segment-") as temp_dir:
        letter_out = str(Path(temp_dir) / "letter.png")
        object_out = str(Path(temp_dir) / "object.png")
        args = shlex.split(command, posix=os.name != "nt") + [
            "--input", source_path,
            "--letter", letter,
            "--object", object_name,
            "--letter-out", letter_out,
            "--object-out", object_out,
        ]
        subprocess.run(args, check=True)
        letter_path = Path(letter_out)
        object_path = Path(object_out)
        if not letter_path.is_file() or not object_path.is_file():
            raise RuntimeError(f"Segmentation adapter did not create both outputs for {letter}")
        return letter_path.read_bytes(), object_path.read_bytes()


def handle_prepare_assets(
    job: Job,
    store: AssetStore,
    *,
    run_segmenter: Segmenter | None = None,
) -> list[str]:
    """Ensure every mapped letter has processed letter + object assets."""
    try:
        mapping = store.read_json(job.project_id, MAPPING_PATH)
    except Exception as exc:
        raise RuntimeError("prepare-assets requires authoring/mapping.json") from exc
    if not isinstance(mapping, dict):
        raise RuntimeError("authoring/mapping.json must be a JSON object")
    validate_learning_map_payload(mapping)

    runner = run_segmenter or _run_external_segmenter
    produced: list[str] = []
    entries = mapping["letters"]
    for letter in LETTERS:
        letter_existing = _first_existing(store, job.project_id, f"assets/letters/{letter}", LETTER_EXTS)
        object_existing = _first_existing(store, job.project_id, f"assets/objects/{letter}", OBJECT_EXTS)
        if letter_existing and object_existing:
            continue

        source_rel = _first_existing(store, job.project_id, f"assets/source-images/{letter}", SOURCE_EXTS)
        if source_rel is None:
            raise RuntimeError(
                f"{letter}: missing processed asset(s) and no raw source image under assets/source-images/{letter}.*"
            )
        source_path = store.resolve_url(job.project_id, source_rel)
        object_name = str(entries[letter]["object"])
        letter_bytes, object_bytes = runner(source_path, letter, object_name)

        if not letter_existing:
            letter_rel = f"assets/letters/{letter}.png"
            store.write_bytes(job.project_id, letter_rel, letter_bytes)
            produced.append(letter_rel)
        if not object_existing:
            object_rel = f"assets/objects/{letter}.png"
            store.write_bytes(job.project_id, object_rel, object_bytes)
            produced.append(object_rel)

    return produced
