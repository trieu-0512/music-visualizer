"""Theme-first composite-image preparation with pluggable segmentation.

Source images are extraction-only composites. The final renderer consumes the
separate video background plus transparent letter/object foreground assets.
This stage is idempotent, supports target-level forced reruns, and writes a
provenance/QC report for every A-Z target.
"""
from __future__ import annotations

import hashlib
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
REPORT_PATH = "artifacts/asset-prep-report.json"
SEGMENTER_NAME = "adaptive-reference-background-v3"
LETTER_EXTS = (".png", ".webp", ".svg")
OBJECT_EXTS = (".png", ".webp", ".svg")
SOURCE_EXTS = (".png", ".jpg", ".jpeg", ".webp")
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"

Segmenter = Callable[[str, str, str], tuple[bytes, bytes]]


def _first_existing(store: AssetStore, project_id: str, stem: str, exts: tuple[str, ...]) -> str | None:
    for ext in exts:
        rel = f"{stem}{ext}"
        if store.exists(project_id, rel):
            return rel
    return None


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _asset_record(store: AssetStore, project_id: str, relative_path: str | None) -> dict | None:
    if relative_path is None:
        return None
    data = store.read_bytes(project_id, relative_path)
    return {
        "path": relative_path,
        "sha256": _sha256(data),
        "bytes": len(data),
    }


def _validate_generated_png(data: bytes, label: str) -> None:
    if len(data) <= len(PNG_SIGNATURE) or not data.startswith(PNG_SIGNATURE):
        raise RuntimeError(f"{label}: segmentation output is not a non-empty PNG")


def _run_external_segmenter(
    source_path: str,
    letter: str,
    object_name: str,
    background_path: str | None = None,
) -> tuple[bytes, bytes]:
    command = os.environ.get("ABC_SEGMENTER_COMMAND", "").strip()
    if not command:
        # Prefer a clean-background reference for scene composites; the
        # adapter falls back to the deterministic white-matte path when the
        # source corners are pure white.
        from src.white_matte_segmenter import segment_source_image

        return segment_source_image(
            source_path,
            letter,
            object_name,
            background=background_path,
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


def _requested_letters(job: Job) -> tuple[str, bool]:
    target = job.params.get("target") if isinstance(job.params, dict) else None
    force = bool(job.params.get("force", False)) if isinstance(job.params, dict) else False
    if target is None:
        return LETTERS, force
    key = str(target).strip().upper()
    if key not in LETTERS or len(key) != 1:
        raise RuntimeError("prepare-assets params.target must be one A-Z letter")
    return key, force


def _load_existing_report(store: AssetStore, project_id: str, mapping_revision: int) -> dict:
    try:
        report = store.read_json(project_id, REPORT_PATH)
    except FileNotFoundError:
        report = None
    if (
        isinstance(report, dict)
        and report.get("version") == 2
        and report.get("mappingRevision") == mapping_revision
        and report.get("segmenter") == SEGMENTER_NAME
        and isinstance(report.get("targets"), dict)
    ):
        return report
    return {
        "version": 2,
        "mappingRevision": mapping_revision,
        "segmenter": SEGMENTER_NAME,
        "targets": {},
    }


def handle_prepare_assets(
    job: Job,
    store: AssetStore,
    *,
    run_segmenter: Segmenter | None = None,
) -> list[str]:
    """Ensure mapped source composites become QC-tracked letter + object foregrounds."""
    try:
        mapping = store.read_json(job.project_id, MAPPING_PATH)
    except Exception as exc:
        raise RuntimeError("prepare-assets requires canonical LOCKED authoring/mapping.json") from exc
    if not isinstance(mapping, dict):
        raise RuntimeError("authoring/mapping.json must be a JSON object")
    validate_learning_map_payload(mapping)

    runner = run_segmenter or _run_external_segmenter
    selected, force = _requested_letters(job)
    produced: list[str] = []
    entries = mapping["letters"]
    mapping_revision = int(mapping["revision"])
    report = _load_existing_report(store, job.project_id, mapping_revision)
    targets = report["targets"]
    background_rel = _first_existing(store, job.project_id, "assets/background", SOURCE_EXTS)

    for letter in selected:
        letter_existing = _first_existing(store, job.project_id, f"assets/letters/{letter}", LETTER_EXTS)
        object_existing = _first_existing(store, job.project_id, f"assets/objects/{letter}", OBJECT_EXTS)
        source_rel = _first_existing(store, job.project_id, f"assets/source-images/{letter}", SOURCE_EXTS)
        object_name = str(entries[letter]["object"])

        generated = force or not (letter_existing and object_existing)
        if generated:
            if source_rel is None:
                raise RuntimeError(
                    f"{letter}: segmentation requested but no source composite exists under assets/source-images/{letter}.*"
                )
            source_path = store.resolve_url(job.project_id, source_rel)
            if run_segmenter is None:
                background_path = (
                    store.resolve_url(job.project_id, background_rel)
                    if background_rel is not None
                    else None
                )
                letter_bytes, object_bytes = _run_external_segmenter(
                    source_path,
                    letter,
                    object_name,
                    background_path,
                )
            else:
                letter_bytes, object_bytes = runner(source_path, letter, object_name)
            _validate_generated_png(letter_bytes, f"{letter} letter")
            _validate_generated_png(object_bytes, f"{letter} object")

            letter_rel = f"assets/letters/{letter}.png"
            object_rel = f"assets/objects/{letter}.png"
            store.write_bytes(job.project_id, letter_rel, letter_bytes)
            store.write_bytes(job.project_id, object_rel, object_bytes)
            produced.extend([letter_rel, object_rel])
            letter_existing = letter_rel
            object_existing = object_rel
            status = "generated"
        else:
            status = "reused"

        targets[letter] = {
            "object": object_name,
            "status": status,
            "source": _asset_record(store, job.project_id, source_rel),
            "letter": _asset_record(store, job.project_id, letter_existing),
            "objectAsset": _asset_record(store, job.project_id, object_existing),
            "qc": {
                "outputsPresent": bool(letter_existing and object_existing),
                "manualReviewRequired": False,
            },
        }

    # A full pass is render-ready only when every target has a report entry and both outputs.
    report["complete"] = all(
        isinstance(targets.get(letter), dict)
        and bool(targets[letter].get("qc", {}).get("outputsPresent"))
        for letter in LETTERS
    )
    store.write_json(job.project_id, REPORT_PATH, report)
    produced.append(REPORT_PATH)
    return produced
