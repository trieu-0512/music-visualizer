from __future__ import annotations

from pathlib import Path

from src.asset_prep import REPORT_PATH, handle_prepare_assets
from src.queue import Job
from src.store import AssetStore

PNG = b"\x89PNG\r\n\x1a\n"


def _mapping() -> dict:
    return {
        "version": 1,
        "revision": 1,
        "state": "LOCKED",
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


def _job(project_id: str = "p", **params) -> Job:
    return Job(
        id="prepare-1",
        project_id=project_id,
        type="prepare-assets",
        status="running",
        params=params,
    )


def test_prepare_assets_segments_raw_images_and_writes_provenance(tmp_path: Path) -> None:
    store = AssetStore(tmp_path / "storage")
    store.write_json("p", "authoring/mapping.json", _mapping())
    for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
        store.write_bytes("p", f"assets/source-images/{letter}.png", b"raw")

    calls: list[tuple[str, str]] = []

    def fake_segmenter(source: str, letter: str, object_name: str) -> tuple[bytes, bytes]:
        assert Path(source).is_file()
        calls.append((letter, object_name))
        return PNG + f"letter-{letter}".encode(), PNG + f"object-{letter}".encode()

    produced = handle_prepare_assets(_job(), store, run_segmenter=fake_segmenter)
    assert len(produced) == 53  # 52 foreground files + report
    assert produced[-1] == REPORT_PATH
    assert len(calls) == 26
    assert store.read_bytes("p", "assets/letters/A.png").startswith(PNG)
    assert store.read_bytes("p", "assets/objects/A.png").startswith(PNG)

    report = store.read_json("p", REPORT_PATH)
    assert report["mappingRevision"] == 1
    assert report["complete"] is True
    assert report["targets"]["A"]["status"] == "generated"
    assert len(report["targets"]["A"]["letter"]["sha256"]) == 64

    def must_not_run(_source: str, _letter: str, _object_name: str) -> tuple[bytes, bytes]:
        raise AssertionError("idempotent second pass must not invoke segmentation")

    assert handle_prepare_assets(_job(), store, run_segmenter=must_not_run) == [REPORT_PATH]
    report2 = store.read_json("p", REPORT_PATH)
    assert report2["targets"]["A"]["status"] == "reused"


def test_prepare_assets_accepts_manual_processed_assets_without_source_images(tmp_path: Path) -> None:
    store = AssetStore(tmp_path / "storage")
    store.write_json("p", "authoring/mapping.json", _mapping())
    for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
        store.write_bytes("p", f"assets/letters/{letter}.png", b"letter")
        store.write_bytes("p", f"assets/objects/{letter}.png", b"object")

    assert handle_prepare_assets(_job(), store) == [REPORT_PATH]
    report = store.read_json("p", REPORT_PATH)
    assert report["complete"] is True
    assert report["targets"]["Z"]["status"] == "reused"


def test_prepare_assets_can_force_rerun_one_target(tmp_path: Path) -> None:
    store = AssetStore(tmp_path / "storage")
    store.write_json("p", "authoring/mapping.json", _mapping())
    for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
        store.write_bytes("p", f"assets/letters/{letter}.png", b"letter")
        store.write_bytes("p", f"assets/objects/{letter}.png", b"object")
    store.write_bytes("p", "assets/source-images/B.png", b"raw-b")

    calls: list[str] = []

    def fake_segmenter(_source: str, letter: str, _object_name: str) -> tuple[bytes, bytes]:
        calls.append(letter)
        return PNG + b"new-letter", PNG + b"new-object"

    produced = handle_prepare_assets(
        _job(target="B", force=True), store, run_segmenter=fake_segmenter
    )
    assert calls == ["B"]
    assert produced == ["assets/letters/B.png", "assets/objects/B.png", REPORT_PATH]


def test_prepare_assets_rejects_non_png_generated_outputs(tmp_path: Path) -> None:
    store = AssetStore(tmp_path / "storage")
    store.write_json("p", "authoring/mapping.json", _mapping())
    for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
        store.write_bytes("p", f"assets/letters/{letter}.png", b"letter")
        store.write_bytes("p", f"assets/objects/{letter}.png", b"object")
    store.write_bytes("p", "assets/source-images/A.png", b"raw")

    def invalid(_source: str, _letter: str, _object_name: str) -> tuple[bytes, bytes]:
        return b"not png", b"not png"

    try:
        handle_prepare_assets(_job(target="A", force=True), store, run_segmenter=invalid)
        raise AssertionError("expected invalid segmentation output to fail")
    except RuntimeError as exc:
        assert "not a non-empty PNG" in str(exc)
