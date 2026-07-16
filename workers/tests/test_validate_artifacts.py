"""Unit tests for production artifact schema validation (PR-10)."""

from __future__ import annotations

import pytest

from src.validate_artifacts import (
    ArtifactSchemaError,
    load_shared_schema,
    validate_audio_analysis_payload,
    validate_lyrics_payload,
)


def test_load_shared_schemas() -> None:
    lyrics = load_shared_schema("lyrics.schema.json")
    analysis = load_shared_schema("audio-analysis.schema.json")
    assert lyrics.get("$schema") or lyrics.get("type") or "properties" in lyrics
    assert analysis.get("$schema") or analysis.get("type") or "properties" in analysis


def test_validate_lyrics_payload_accepts_minimal_valid() -> None:
    validate_lyrics_payload(
        {
            "version": 1,
            "source": "original+transcriber",
            "lines": [
                {
                    "start": 0.0,
                    "end": 1.0,
                    "text": "hello",
                    "line1": "hello",
                    "line2": "",
                }
            ],
        }
    )


def test_validate_lyrics_payload_rejects_invalid() -> None:
    with pytest.raises(ArtifactSchemaError) as exc:
        validate_lyrics_payload({"version": 1, "lines": "not-a-list"})
    assert "lyrics.json" in str(exc.value)


def test_validate_audio_analysis_payload_accepts_minimal_valid() -> None:
    validate_audio_analysis_payload(
        {
            "version": 1,
            "duration": 1.0,
            "interval": 0.5,
            "sampleRate": 44100,
            "rms": [0.2, 0.3],
            "bass": [0.1, 0.2],
            "bands": [[0.2], [0.3]],
            "bandCount": 1,
            "beats": [0.5],
        }
    )


def test_validate_audio_analysis_payload_rejects_invalid() -> None:
    with pytest.raises(ArtifactSchemaError) as exc:
        validate_audio_analysis_payload({"version": 1, "duration": "nope"})
    assert "audio-analysis.json" in str(exc.value)
