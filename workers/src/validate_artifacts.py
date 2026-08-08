"""Production schema validation for worker-produced artifacts (PR-10 / KD-10).

Reuses the same ``jsonschema`` pin and shared schema files already exercised by
property/integration tests. Handlers call these helpers after building payloads
(and before returning an artifact list) so invalid outputs fail the job via
``mark_failed`` rather than silently completing.
"""

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
    "ArtifactSchemaError",
]


class ArtifactSchemaError(ValueError):
    """Raised when a worker-built artifact fails shared JSON Schema validation."""

    def __init__(self, artifact: str, message: str) -> None:
        super().__init__(f"{artifact} failed schema validation: {message}")
        self.artifact = artifact


def _workspace_root() -> Path:
    # workers/src/validate_artifacts.py -> workers/src -> workers -> repo root
    return Path(__file__).resolve().parents[2]


def _schema_dir() -> Path:
    return _workspace_root() / "shared" / "src" / "schema"


@lru_cache(maxsize=8)
def load_shared_schema(name: str) -> dict[str, Any]:
    """Load a schema file from ``shared/src/schema/{name}`` (test path pattern)."""
    path = _schema_dir() / name
    if not path.is_file():
        raise FileNotFoundError(f"shared schema not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


@lru_cache(maxsize=8)
def _validator(name: str) -> Draft202012Validator:
    return Draft202012Validator(load_shared_schema(name))


def _validate(artifact: str, schema_name: str, data: Mapping[str, Any] | dict[str, Any]) -> None:
    try:
        _validator(schema_name).validate(data)
    except ValidationError as exc:
        # Prefer the first path-bearing message for operator-facing job errors.
        path = "/".join(str(p) for p in exc.absolute_path) if exc.absolute_path else ""
        detail = f"{path}: {exc.message}" if path else exc.message
        raise ArtifactSchemaError(artifact, detail) from exc


def validate_lyrics_payload(data: Mapping[str, Any] | dict[str, Any]) -> None:
    """Validate a ``lyrics.json``-shaped dict against the shared schema."""
    _validate("artifacts/lyrics.json", "lyrics.schema.json", data)


def validate_audio_analysis_payload(data: Mapping[str, Any] | dict[str, Any]) -> None:
    """Validate an ``audio-analysis.json``-shaped dict against the shared schema."""
    _validate("artifacts/audio-analysis.json", "audio-analysis.schema.json", data)


def validate_learning_map_payload(data: Mapping[str, Any] | dict[str, Any]) -> None:
    """Validate the canonical ``authoring/mapping.json`` contract."""
    _validate("authoring/mapping.json", "learning-map.schema.json", data)
