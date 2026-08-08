"""Production schema validation for worker-produced/consumed artifacts."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError

__all__ = [
    "load_shared_schema",
    "validate_lyrics_payload",
    "validate_audio_analysis_payload",
    "validate_learning_map_payload",
    "validate_song_script_payload",
    "ArtifactSchemaError",
]


class ArtifactSchemaError(ValueError):
    """Raised when an artifact fails shared JSON Schema validation."""

    def __init__(self, artifact: str, message: str) -> None:
        super().__init__(f"{artifact} failed schema validation: {message}")
        self.artifact = artifact


def _workspace_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _schema_dir() -> Path:
    return _workspace_root() / "shared" / "src" / "schema"


@lru_cache(maxsize=12)
def load_shared_schema(name: str) -> dict[str, Any]:
    path = _schema_dir() / name
    if not path.is_file():
        raise FileNotFoundError(f"shared schema not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


@lru_cache(maxsize=12)
def _validator(name: str) -> Draft202012Validator:
    return Draft202012Validator(load_shared_schema(name))


def _validate(artifact: str, schema_name: str, data: Mapping[str, Any] | dict[str, Any]) -> None:
    try:
        _validator(schema_name).validate(data)
    except ValidationError as exc:
        path = "/".join(str(p) for p in exc.absolute_path) if exc.absolute_path else ""
        detail = f"{path}: {exc.message}" if path else exc.message
        raise ArtifactSchemaError(artifact, detail) from exc


def validate_lyrics_payload(data: Mapping[str, Any] | dict[str, Any]) -> None:
    _validate("artifacts/lyrics.json", "lyrics.schema.json", data)


def validate_audio_analysis_payload(data: Mapping[str, Any] | dict[str, Any]) -> None:
    _validate("artifacts/audio-analysis.json", "audio-analysis.schema.json", data)


def validate_learning_map_payload(data: Mapping[str, Any] | dict[str, Any]) -> None:
    """Validate canonical production mapping; schema requires state=LOCKED."""
    _validate("authoring/mapping.json", "learning-map.schema.json", data)


def validate_song_script_payload(data: Mapping[str, Any] | dict[str, Any]) -> None:
    _validate("authoring/song-script.json", "song-script.schema.json", data)
