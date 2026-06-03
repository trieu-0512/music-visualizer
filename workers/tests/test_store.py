"""Unit tests for the Python Asset_Store view (task 6.1).

Covers the ``(projectId, relativePath)`` -> filesystem mapping, JSON/text/bytes
round-trips, ``read_to_temp``, listing, and the path-traversal guard.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from src.config import StorageConfig
from src.store import AssetStore, create_asset_store


def test_resolve_path_maps_to_projects_layout(tmp_path: Path) -> None:
    store = AssetStore(tmp_path)
    resolved = store.resolve_path("proj1", "artifacts/lyrics.json")
    expected = (tmp_path / "projects" / "proj1" / "artifacts" / "lyrics.json").resolve()
    assert resolved == expected


def test_write_json_read_json_round_trip(tmp_path: Path) -> None:
    store = AssetStore(tmp_path)
    value = {"version": 1, "lines": [{"start": 0.0, "end": 1.5, "text": "hi"}]}
    store.write_json("p", "artifacts/lyrics.json", value)
    assert store.read_json("p", "artifacts/lyrics.json") == value
    # The bytes on disk are the same address the Node backend would resolve.
    on_disk = (tmp_path / "projects" / "p" / "artifacts" / "lyrics.json").read_text(
        encoding="utf-8"
    )
    assert json.loads(on_disk) == value


def test_write_text_round_trip_and_creates_parents(tmp_path: Path) -> None:
    store = AssetStore(tmp_path)
    store.write_text("p", "artifacts/lyrics.srt", "1\n00:00:00,000 --> 00:00:01,000\n")
    assert store.read_text("p", "artifacts/lyrics.srt").startswith("1\n")


def test_write_bytes_read_bytes_round_trip(tmp_path: Path) -> None:
    store = AssetStore(tmp_path)
    payload = b"\x00\x01\x02audio-bytes"
    store.write_bytes("p", "assets/audio.mp3", payload)
    assert store.read_bytes("p", "assets/audio.mp3") == payload


def test_exists_reflects_writes(tmp_path: Path) -> None:
    store = AssetStore(tmp_path)
    assert store.exists("p", "assets/audio.mp3") is False
    store.write_bytes("p", "assets/audio.mp3", b"x")
    assert store.exists("p", "assets/audio.mp3") is True


def test_read_to_temp_copies_bytes_and_preserves_suffix(tmp_path: Path) -> None:
    store = AssetStore(tmp_path)
    store.write_bytes("p", "assets/audio.wav", b"riff-data")
    temp = store.read_to_temp("p", "assets/audio.wav")
    try:
        assert temp.endswith(".wav")
        assert Path(temp).read_bytes() == b"riff-data"
    finally:
        Path(temp).unlink()


def test_read_to_temp_resolves_extension_variant_for_role_stem(tmp_path: Path) -> None:
    store = AssetStore(tmp_path)
    store.write_bytes("p", "assets/audio.mp3", b"mp3-data")
    temp = store.read_to_temp("p", "assets/audio")
    try:
        assert temp.endswith(".mp3")
        assert Path(temp).read_bytes() == b"mp3-data"
    finally:
        Path(temp).unlink()


def test_read_to_temp_missing_asset_raises(tmp_path: Path) -> None:
    store = AssetStore(tmp_path)
    with pytest.raises(FileNotFoundError):
        store.read_to_temp("p", "assets/audio.mp3")


def test_list_returns_written_relative_paths_with_prefix(tmp_path: Path) -> None:
    store = AssetStore(tmp_path)
    store.write_bytes("p", "assets/audio.mp3", b"a")
    store.write_json("p", "artifacts/lyrics.json", {"version": 1})
    store.write_text("p", "artifacts/lyrics.srt", "1\n")
    assert store.list("p") == [
        "artifacts/lyrics.json",
        "artifacts/lyrics.srt",
        "assets/audio.mp3",
    ]
    assert store.list("p", prefix="artifacts/") == [
        "artifacts/lyrics.json",
        "artifacts/lyrics.srt",
    ]


def test_list_unknown_project_is_empty(tmp_path: Path) -> None:
    store = AssetStore(tmp_path)
    assert store.list("nope") == []


def test_delete_removes_file(tmp_path: Path) -> None:
    store = AssetStore(tmp_path)
    store.write_bytes("p", "assets/audio.mp3", b"x")
    store.delete("p", "assets/audio.mp3")
    assert store.exists("p", "assets/audio.mp3") is False


def test_projects_are_isolated(tmp_path: Path) -> None:
    store = AssetStore(tmp_path)
    store.write_json("a", "artifacts/lyrics.json", {"id": "a"})
    store.write_json("b", "artifacts/lyrics.json", {"id": "b"})
    assert store.read_json("a", "artifacts/lyrics.json") == {"id": "a"}
    assert store.read_json("b", "artifacts/lyrics.json") == {"id": "b"}


@pytest.mark.parametrize(
    "relative_path",
    ["../escape.json", "../../secrets", "a/../../b", "sub/../../../etc"],
)
def test_path_traversal_relative_is_rejected(tmp_path: Path, relative_path: str) -> None:
    store = AssetStore(tmp_path)
    with pytest.raises(ValueError):
        store.resolve_path("p", relative_path)


@pytest.mark.parametrize("project_id", ["..", "../other", ""])
def test_path_traversal_project_id_is_rejected(tmp_path: Path, project_id: str) -> None:
    store = AssetStore(tmp_path)
    with pytest.raises(ValueError):
        store.resolve_path(project_id, "artifacts/lyrics.json")


def test_create_asset_store_from_storage_config(tmp_path: Path) -> None:
    store = create_asset_store(StorageConfig(backend="local", root_dir=str(tmp_path)))
    assert isinstance(store, AssetStore)
    assert store.root_dir == tmp_path


def test_create_asset_store_rejects_unknown_backend() -> None:
    with pytest.raises(ValueError):
        create_asset_store(StorageConfig(backend="s3", root_dir="x"))
