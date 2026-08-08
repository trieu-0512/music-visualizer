"""Unit tests for the Transcriber handler and pipeline chaining (task 6.7).

These tests inject a fake WhisperX runner so the chaining logic
(``whisperx.json`` -> ``lyrics.json`` -> ``lyrics.srt``) is exercised without the
heavy ML dependency. The real end-to-end run is covered by the integration test in
task 6.8.

Covers:
- the three artifacts are written and returned in pipeline order,
- ``whisperx.json`` carries segment timestamps (Req 3.3) and optional word timing
  (Req 3.4),
- chained ``lyrics.json`` uses transcriber text when no originals are present
  (Req 4.2) and original display text when they are (Req 4.1),
- chained ``lyrics.srt`` is a faithful SubRip encoding of ``lyrics.json`` (Req 5),
- the module imports without ``whisperx`` installed (lazy seam),
- failures propagate so the worker records the job as failed (Req 3.6).
"""

from __future__ import annotations

import importlib
from pathlib import Path

import pytest

import src.transcribe as transcribe
from src.queue import Job
from src.store import AssetStore


# --------------------------------------------------------------------------- #
# Fixtures and helpers                                                          #
# --------------------------------------------------------------------------- #


@pytest.fixture
def store(tmp_path: Path) -> AssetStore:
    return AssetStore(tmp_path / "storage")


def _job(project_id: str = "proj-transcribe") -> Job:
    return Job(id="j1", project_id=project_id, type="transcribe", status="running")


def _write_audio(store: AssetStore, project_id: str) -> None:
    # handle_transcribe only needs the audio asset to exist at the role path; the
    # fake runner never decodes it, so any bytes will do.
    store.write_bytes(project_id, transcribe.AUDIO_ROLE, b"fake-audio-bytes")


def _fake_whisperx_with_words() -> dict:
    """A WhisperX-shaped result: two segments, the first with word timing."""
    return {
        "language": "en",
        "segments": [
            {
                "start": 0.0,
                "end": 2.0,
                "text": "hello world",
                "words": [
                    {"word": "hello", "start": 0.0, "end": 1.0},
                    {"word": "world", "start": 1.0, "end": 2.0},
                ],
            },
            {"start": 2.5, "end": 4.0, "text": "second line"},
        ],
    }


# --------------------------------------------------------------------------- #
# Module import / seam                                                          #
# --------------------------------------------------------------------------- #


def test_module_imports_without_whisperx_installed() -> None:
    # Re-importing must not require whisperx: the dependency is imported lazily
    # inside _run_whisperx, so the module (and its chaining) load cleanly.
    module = importlib.reload(transcribe)
    assert hasattr(module, "handle_transcribe")
    assert callable(module.handle_transcribe)


# --------------------------------------------------------------------------- #
# Happy path: artifacts written + chained                                       #
# --------------------------------------------------------------------------- #


def test_writes_three_artifacts_in_pipeline_order(store: AssetStore) -> None:
    project_id = "proj-transcribe"
    _write_audio(store, project_id)

    produced = transcribe.handle_transcribe(
        _job(project_id), store, run_whisperx=lambda _p: _fake_whisperx_with_words()
    )

    assert produced == [
        "artifacts/whisperx.json",
        "artifacts/lyrics.json",
        "artifacts/lyrics.srt",
    ]
    for rel in produced:
        assert store.exists(project_id, rel), f"missing artifact {rel}"


def test_whisperx_artifact_has_segments_and_word_timing(store: AssetStore) -> None:
    # Req 3.2/3.3/3.4: whisperx.json carries segment timestamps and optional words.
    project_id = "proj-transcribe"
    _write_audio(store, project_id)

    transcribe.handle_transcribe(
        _job(project_id), store, run_whisperx=lambda _p: _fake_whisperx_with_words()
    )

    whisperx = store.read_json(project_id, "artifacts/whisperx.json")
    segments = whisperx["segments"]
    assert len(segments) == 2
    # Segment-level timestamps present and ordered by ascending start (Req 3.3).
    assert [s["start"] for s in segments] == sorted(s["start"] for s in segments)
    for seg in segments:
        assert seg["end"] >= seg["start"]
    # Word timing carried through for the first segment (Req 3.4) and absent for
    # the segment that had none.
    assert segments[0]["words"] == [
        {"word": "hello", "start": 0.0, "end": 1.0},
        {"word": "world", "start": 1.0, "end": 2.0},
    ]
    assert "words" not in segments[1]


def test_lyrics_chained_from_transcriber_when_no_originals(store: AssetStore) -> None:
    # Req 4.2: with no original lyrics, lyrics.json text + timing come from STT.
    project_id = "proj-transcribe"
    _write_audio(store, project_id)

    transcribe.handle_transcribe(
        _job(project_id), store, run_whisperx=lambda _p: _fake_whisperx_with_words()
    )

    lyrics = store.read_json(project_id, "artifacts/lyrics.json")
    assert lyrics["version"] == 1
    assert lyrics["source"] == "transcriber"
    texts = [line["text"] for line in lyrics["lines"]]
    assert texts == ["hello world", "second line"]
    # Lines ordered by ascending start with start <= end (Req 4.6, 4.7).
    starts = [line["start"] for line in lyrics["lines"]]
    assert starts == sorted(starts)
    assert all(line["end"] >= line["start"] for line in lyrics["lines"])
    # Word timing flowed through to the first line (Req 4.5).
    assert lyrics["lines"][0]["words"] == [
        {"text": "hello", "start": 0.0, "end": 1.0},
        {"text": "world", "start": 1.0, "end": 2.0},
    ]


def test_lyrics_use_original_text_when_present(store: AssetStore) -> None:
    # Req 4.1: original lyrics provide display text; transcriber provides timing.
    project_id = "proj-transcribe"
    _write_audio(store, project_id)
    store.write_text(
        project_id, "assets/original-lyrics.txt", "Xin chao the gioi\nDong thu hai"
    )

    transcribe.handle_transcribe(
        _job(project_id), store, run_whisperx=lambda _p: _fake_whisperx_with_words()
    )

    lyrics = store.read_json(project_id, "artifacts/lyrics.json")
    assert lyrics["source"] == "original+transcriber"
    texts = [line["text"] for line in lyrics["lines"]]
    assert texts == ["Xin chao the gioi", "Dong thu hai"]
    # Timing still comes from the transcriber segments.
    assert lyrics["lines"][0]["start"] == 0.0
    assert lyrics["lines"][0]["end"] == 2.0


def test_srt_artifact_faithfully_encodes_lyrics(store: AssetStore) -> None:
    # Req 5: lyrics.srt is the SubRip encoding of the chained lyrics.json.
    project_id = "proj-transcribe"
    _write_audio(store, project_id)

    transcribe.handle_transcribe(
        _job(project_id), store, run_whisperx=lambda _p: _fake_whisperx_with_words()
    )

    srt = store.read_text(project_id, "artifacts/lyrics.srt")
    # Sequential entry numbers starting at 1 (Req 5.3) and SubRip timestamps (Req 5.2).
    assert srt.startswith("1\n00:00:00,000 --> 00:00:02,000\n")
    assert "\n2\n00:00:02,500 --> 00:00:04,000\n" in srt


def test_temp_audio_file_is_cleaned_up(store: AssetStore, monkeypatch) -> None:
    # read_to_temp copies the asset to a temp file; the handler must remove it.
    project_id = "proj-transcribe"
    _write_audio(store, project_id)

    captured: dict[str, str] = {}
    real_read_to_temp = store.read_to_temp

    def spy_read_to_temp(pid: str, rel: str) -> str:
        path = real_read_to_temp(pid, rel)
        captured["path"] = path
        return path

    monkeypatch.setattr(store, "read_to_temp", spy_read_to_temp)

    transcribe.handle_transcribe(
        _job(project_id), store, run_whisperx=lambda _p: _fake_whisperx_with_words()
    )

    assert "path" in captured
    assert not Path(captured["path"]).exists()


# --------------------------------------------------------------------------- #
# Failure handling (Req 3.6: errors propagate so the worker records failure)    #
# --------------------------------------------------------------------------- #


def test_transcriber_failure_propagates(store: AssetStore) -> None:
    project_id = "proj-transcribe"
    _write_audio(store, project_id)

    def boom(_path: str) -> dict:
        raise RuntimeError("whisperx failed to decode audio")

    with pytest.raises(RuntimeError, match="whisperx failed to decode audio"):
        transcribe.handle_transcribe(_job(project_id), store, run_whisperx=boom)

    # The downstream artifacts were never written because transcription failed.
    assert not store.exists(project_id, "artifacts/whisperx.json")
    assert not store.exists(project_id, "artifacts/lyrics.json")


def test_failure_still_cleans_up_temp_audio(store: AssetStore, monkeypatch) -> None:
    # Even when the runner raises, the temp audio copy must be removed.
    project_id = "proj-transcribe"
    _write_audio(store, project_id)

    captured: dict[str, str] = {}
    real_read_to_temp = store.read_to_temp

    def spy_read_to_temp(pid: str, rel: str) -> str:
        path = real_read_to_temp(pid, rel)
        captured["path"] = path
        return path

    monkeypatch.setattr(store, "read_to_temp", spy_read_to_temp)

    def boom(_path: str) -> dict:
        raise RuntimeError("alignment crashed")

    with pytest.raises(RuntimeError):
        transcribe.handle_transcribe(_job(project_id), store, run_whisperx=boom)

    assert "path" in captured
    assert not Path(captured["path"]).exists()


def test_missing_audio_raises(store: AssetStore) -> None:
    # No audio asset stored: read_to_temp raises, which propagates to the worker
    # (the API normally rejects this earlier per Req 3.5).
    with pytest.raises(FileNotFoundError):
        transcribe.handle_transcribe(
            _job("no-audio"), store, run_whisperx=lambda _p: _fake_whisperx_with_words()
        )


# --------------------------------------------------------------------------- #
# Normalization helpers                                                         #
# --------------------------------------------------------------------------- #


def test_normalize_result_sorts_segments_and_clamps(store: AssetStore) -> None:
    raw = [
        {"start": 3.0, "end": 2.0, "text": "  later "},  # end < start, padded text
        {"start": 0.0, "end": 1.0, "text": "first"},
    ]
    result = transcribe._normalize_result(raw, language="en")
    assert result["language"] == "en"
    starts = [s["start"] for s in result["segments"]]
    assert starts == sorted(starts)
    assert result["segments"][0]["text"] == "first"
    # end clamped up to start for the out-of-order segment.
    later = result["segments"][1]
    assert later["end"] >= later["start"]


def test_normalize_words_all_or_nothing() -> None:
    # Fully-timed words pass through.
    good = transcribe._normalize_words(
        [{"word": "a", "start": 0.0, "end": 0.5}, {"word": "b", "start": 0.5, "end": 1.0}]
    )
    assert good == [
        {"word": "a", "start": 0.0, "end": 0.5},
        {"word": "b", "start": 0.5, "end": 1.0},
    ]
    # A single untimed word collapses the whole list to None (Req 3.4 optional).
    assert transcribe._normalize_words([{"word": "a"}, {"word": "b", "start": 0.0, "end": 1.0}]) is None
    assert transcribe._normalize_words([]) is None
    assert transcribe._normalize_words(None) is None


def test_transcribe_copies_mapping_object_into_timed_lyrics(store: AssetStore) -> None:
    project_id = "proj-mapped"
    _write_audio(store, project_id)
    mapping = {
        "version": 1,
        "theme": {
            "name": "General ABC",
            "scope": "open",
            "mappingAuthority": "project-locked",
            "ageBand": "mixed-2-6",
            "mode": "LETTER_NAME",
        },
        "letters": {
            letter: {"object": ("Apple" if letter == "A" else f"Object {letter}")}
            for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        },
    }
    store.write_json(project_id, "authoring/mapping.json", mapping)
    store.write_text(project_id, "assets/original-lyrics.txt", "A is for apple")
    fake = {"language": "en", "segments": [{"start": 0.0, "end": 2.0, "text": "A is for apple"}]}

    transcribe.handle_transcribe(_job(project_id), store, run_whisperx=lambda _p: fake)
    line = store.read_json(project_id, "artifacts/lyrics.json")["lines"][0]
    assert line["letter"] == "A"
    assert line["object"] == "Apple"
