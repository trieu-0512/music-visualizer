from __future__ import annotations

from pathlib import Path

from src.asset_prep import handle_prepare_assets
from src.queue import Job
from src.store import AssetStore


def _mapping() -> dict:
    return {
        "version": 1,
        "theme": {
            "name": "Test Theme",
            "scope": "guided",
            "mappingAuthority": "project-locked",
            "ageBand": "mixed-2-6",
            "mode": "LETTER_NAME",
        },
        "letters": {
            letter: {"object": f"Object {letter}"}
            for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        },
    }


def _job(project_id: str = "p") -> Job:
    return Job(id="prepare-1", project_id=project_id, type="prepare-assets", status="running")


def test_prepare_assets_segments_raw_images_and_is_idempotent(tmp_path: Path) -> None:
    store = AssetStore(tmp_path / "storage")
    store.write_json("p", "authoring/mapping.json", _mapping())
    for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
        store.write_bytes("p", f"assets/source-images/{letter}.png", b"raw")

    calls: list[tuple[str, str]] = []

    def fake_segmenter(source: str, letter: str, object_name: str) -> tuple[bytes, bytes]:
        assert Path(source).is_file()
        calls.append((letter, object_name))
        return f"letter-{letter}".encode(), f"object-{letter}".encode()

    produced = handle_prepare_assets(_job(), store, run_segmenter=fake_segmenter)
    assert len(produced) == 52
    assert len(calls) == 26
    assert store.read_bytes("p", "assets/letters/A.png") == b"letter-A"
    assert store.read_bytes("p", "assets/objects/A.png") == b"object-A"

    def must_not_run(_source: str, _letter: str, _object_name: str) -> tuple[bytes, bytes]:
        raise AssertionError("idempotent second pass must not invoke segmentation")

    assert handle_prepare_assets(_job(), store, run_segmenter=must_not_run) == []


def test_prepare_assets_accepts_manual_processed_assets_without_source_images(tmp_path: Path) -> None:
    store = AssetStore(tmp_path / "storage")
    store.write_json("p", "authoring/mapping.json", _mapping())
    for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
        store.write_bytes("p", f"assets/letters/{letter}.png", b"letter")
        store.write_bytes("p", f"assets/objects/{letter}.png", b"object")

    assert handle_prepare_assets(_job(), store) == []
