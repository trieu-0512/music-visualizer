"""Integration test for the full transcribe pipeline (task 6.8).

Where the unit tests in ``test_transcribe.py`` (task 6.7) call
:func:`src.transcribe.handle_transcribe` directly with an injected fake, this
test drives the *whole* transcribe pipeline the way the system runs it in
practice -- through the Audio_Worker dispatch over a real Job_Queue and
Asset_Store:

    1. store a real audio asset at the project's ``assets/audio`` address via
       the :class:`~src.store.AssetStore`,
    2. enqueue a ``transcribe`` job on a real file-based
       :class:`~src.queue.JobQueue`,
    3. register the real :func:`~src.transcribe.handle_transcribe` handler with a
       *mocked* WhisperX runner injected at its seam (WhisperX is a heavy ML
       dependency that cannot run here), and run the job through
       :func:`src.worker.process_job`, then
    4. assert the artifacts written to disk: ``whisperx.json`` carries
       segment-level timestamps and optional word timing (Req 3.2, 3.3, 3.4), and
       the chained ``lyrics.json`` / ``lyrics.srt`` are produced, consistent with
       each other, and ``lyrics.json`` validates against the shared JSON Schema
       (``shared/src/schema/lyrics.schema.json``) so the artifact the worker
       writes is exactly what every other component consumes (Req 15.4).

Storage and queue live under pytest's ``tmp_path`` and are cleaned up
automatically, so the test is hermetic and needs no committed fixture file.

Requirements covered:
- 3.1 Run the Transcriber against a stored Audio_Asset.
- 3.2 Store the raw transcription result as ``whisperx.json`` under the Project_Id.
- 3.3 ``whisperx.json`` contains segment-level timestamps.
- 3.4 Where word-level timing is produced, ``whisperx.json`` includes it.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

import src.transcribe as transcribe
import src.worker as worker
from src.queue import JobQueue
from src.store import AssetStore

# A 16-byte little-endian RIFF/WAVE header stub is unnecessary here: the WhisperX
# runner is mocked, so the handler only needs the asset to exist at the role path
# (read_to_temp copies it to a temp file that the fake runner never decodes).
FAKE_AUDIO_BYTES = b"RIFF....WAVEfmt fake-audio-payload"


# --------------------------------------------------------------------------- #
# Mocked WhisperX result (the seam handle_transcribe runs in place of the model) #
# --------------------------------------------------------------------------- #


def _mocked_whisperx_result(audio_path: str) -> dict:
    """Stand in for ``src.transcribe._run_whisperx`` (the WhisperX seam, Req 3.1).

    The real seam returns a normalized ``{"segments": [...], "language"?: str}``
    dict with segments ordered by ascending start, ``end >= start``, and per-word
    timing where forced alignment succeeded. This fake mirrors that contract for a
    short three-line clip: the first two segments carry word-level timing while the
    third has segment-level timing only, exercising the "word timing is optional"
    path (Req 3.4). ``audio_path`` is asserted to be a real, readable file so the
    Asset_Store -> temp-file -> runner wiring is genuinely exercised end to end.
    """
    assert Path(audio_path).is_file(), "handler must hand the runner a real temp file"
    assert Path(audio_path).read_bytes() == FAKE_AUDIO_BYTES, "temp copy must match asset"
    return {
        "language": "en",
        "segments": [
            {
                "start": 0.0,
                "end": 2.4,
                "text": "Across the open sky",
                "words": [
                    {"word": "Across", "start": 0.0, "end": 0.6},
                    {"word": "the", "start": 0.6, "end": 0.9},
                    {"word": "open", "start": 0.9, "end": 1.6},
                    {"word": "sky", "start": 1.6, "end": 2.4},
                ],
            },
            {
                "start": 2.8,
                "end": 5.1,
                "text": "we chase the light",
                "words": [
                    {"word": "we", "start": 2.8, "end": 3.2},
                    {"word": "chase", "start": 3.2, "end": 3.9},
                    {"word": "the", "start": 3.9, "end": 4.3},
                    {"word": "light", "start": 4.3, "end": 5.1},
                ],
            },
            # Segment-level timing only (no words): Req 3.4 word timing is optional.
            {"start": 5.6, "end": 8.0, "text": "forever and a day"},
        ],
    }


# --------------------------------------------------------------------------- #
# Fixtures                                                                      #
# --------------------------------------------------------------------------- #


@pytest.fixture
def env(tmp_path: Path) -> tuple[JobQueue, AssetStore]:
    """A real file-based queue and local asset store under tmp_path."""
    return JobQueue(tmp_path / "jobs"), AssetStore(tmp_path / "storage")


@pytest.fixture(autouse=True)
def restore_dispatch():
    """Save/restore the worker DISPATCH so this test never leaks the handler."""
    saved = dict(worker.DISPATCH)
    yield
    worker.DISPATCH.clear()
    worker.DISPATCH.update(saved)


@pytest.fixture
def lyrics_schema() -> dict:
    """Load the shared lyrics JSON Schema consumed by every component (Req 15.4)."""
    # tests/ -> workers/ -> music-visualizer/ (monorepo workspace root).
    workspace_root = Path(__file__).resolve().parents[2]
    schema_path = workspace_root / "shared" / "src" / "schema" / "lyrics.schema.json"
    assert schema_path.is_file(), f"shared lyrics schema not found at {schema_path}"
    return json.loads(schema_path.read_text(encoding="utf-8"))


# --------------------------------------------------------------------------- #
# Helpers                                                                       #
# --------------------------------------------------------------------------- #


def _register_transcribe_with(runner) -> None:
    """Register the real handler, binding the mocked WhisperX runner at its seam."""
    worker.register_handler(
        "transcribe",
        lambda job, store: transcribe.handle_transcribe(job, store, run_whisperx=runner),
    )


_SRT_TS = r"(\d{2}):(\d{2}):(\d{2}),(\d{3})"
_SRT_BLOCK = re.compile(
    rf"(?P<num>\d+)\n{_SRT_TS} --> {_SRT_TS}\n(?P<text>.*?)(?=\n\n|\Z)",
    re.DOTALL,
)


def _parse_srt(srt: str) -> list[dict]:
    """Parse SubRip text into ``{num, start, end, text}`` entries (seconds floats)."""
    entries: list[dict] = []
    for m in _SRT_BLOCK.finditer(srt.strip()):
        sh, sm, ss, sms, eh, em, es, ems = (int(g) for g in m.groups()[1:9])
        entries.append(
            {
                "num": int(m.group("num")),
                "start": sh * 3600 + sm * 60 + ss + sms / 1000.0,
                "end": eh * 3600 + em * 60 + es + ems / 1000.0,
                "text": m.group("text"),
            }
        )
    return entries


# --------------------------------------------------------------------------- #
# Integration tests                                                             #
# --------------------------------------------------------------------------- #


def test_transcribe_pipeline_through_worker_writes_all_artifacts(
    env, lyrics_schema: dict
) -> None:
    """Full pipeline via worker dispatch produces whisperx/lyrics/srt (Req 3.1-3.4)."""
    queue, store = env
    project_id = "proj-transcribe-int"

    # 1) Store a real Audio_Asset at the role address (Req 3.1).
    store.write_bytes(project_id, transcribe.AUDIO_ROLE, FAKE_AUDIO_BYTES)
    assert store.exists(project_id, transcribe.AUDIO_ROLE)

    # 2+3) Enqueue and run the transcribe job through the real worker dispatch,
    #      with the mocked WhisperX runner injected at the handler's seam.
    job = queue.enqueue(project_id, "transcribe")
    _register_transcribe_with(_mocked_whisperx_result)
    worker.process_job(job, queue, store)

    # The queue records completion and the produced artifact references (Req 12.3).
    done = queue.get(job.id)
    assert done is not None
    assert done.status == "completed", f"job failed: {done.error!r}"
    assert done.artifacts == [
        "artifacts/whisperx.json",
        "artifacts/lyrics.json",
        "artifacts/lyrics.srt",
    ]
    for rel in done.artifacts:
        assert store.exists(project_id, rel), f"missing artifact {rel}"

    # 4a) whisperx.json: segment-level timestamps (Req 3.2, 3.3) + optional words (Req 3.4).
    whisperx = store.read_json(project_id, "artifacts/whisperx.json")
    segments = whisperx["segments"]
    assert len(segments) == 3
    starts = [s["start"] for s in segments]
    assert starts == sorted(starts), "segments ordered by ascending start (Req 3.3)"
    for seg in segments:
        assert isinstance(seg["start"], (int, float))
        assert isinstance(seg["end"], (int, float))
        assert seg["end"] >= seg["start"], "segment end >= start (Req 3.3)"
    # Word timing carried through where produced, absent where not (Req 3.4).
    assert [w["word"] for w in segments[0]["words"]] == ["Across", "the", "open", "sky"]
    assert "words" in segments[1]
    assert "words" not in segments[2]

    # 4b) Chained lyrics.json: transcriber is the sole source (no originals, Req 4.2).
    lyrics = store.read_json(project_id, "artifacts/lyrics.json")
    assert lyrics["version"] == 1
    assert lyrics["source"] == "transcriber"
    assert [line["text"] for line in lyrics["lines"]] == [
        "Across the open sky",
        "we chase the light",
        "forever and a day",
    ]
    # Lines ordered by ascending start, each start <= end (Req 4.6, 4.7).
    line_starts = [line["start"] for line in lyrics["lines"]]
    assert line_starts == sorted(line_starts)
    assert all(line["end"] >= line["start"] for line in lyrics["lines"])
    # Word timing flowed through from the whisperx segments that had it (Req 4.5).
    assert lyrics["lines"][0]["words"][0] == {"text": "Across", "start": 0.0, "end": 0.6}
    assert "words" not in lyrics["lines"][2]

    # 4c) Validate lyrics.json against the shared schema for cross-component consistency.
    jsonschema = pytest.importorskip("jsonschema")
    jsonschema.validate(instance=lyrics, schema=lyrics_schema)

    # 4d) Chained lyrics.srt faithfully encodes lyrics.json (Req 5.2, 5.3).
    srt = store.read_text(project_id, "artifacts/lyrics.srt")
    entries = _parse_srt(srt)
    assert len(entries) == len(lyrics["lines"]), "one SRT entry per Lyric_Line"
    # Sequential numbering from 1 in ascending start order (Req 5.3).
    assert [e["num"] for e in entries] == list(range(1, len(entries) + 1))
    assert [e["start"] for e in entries] == sorted(e["start"] for e in entries)
    # Each entry's timestamps match its Lyric_Line start/end (Req 5.2).
    for entry, line in zip(entries, lyrics["lines"]):
        assert entry["start"] == pytest.approx(line["start"], abs=0.001)
        assert entry["end"] == pytest.approx(line["end"], abs=0.001)
        # The SRT text is the line's bottom-box rows (line1/line2) joined.
        expected_rows = [r for r in (line["line1"], line["line2"]) if r != ""]
        assert entry["text"] == "\n".join(expected_rows)


def test_transcribe_pipeline_uses_original_lyrics_text_when_present(
    env, lyrics_schema: dict
) -> None:
    """With Original_Lyrics stored, display text comes from them; timing from STT (Req 4.1)."""
    queue, store = env
    project_id = "proj-transcribe-orig"

    store.write_bytes(project_id, transcribe.AUDIO_ROLE, FAKE_AUDIO_BYTES)
    # Original lyrics supply the canonical display text (one line per row).
    store.write_text(
        project_id,
        "assets/original-lyrics.txt",
        "Bay qua bau troi rong\nta duoi theo anh sang\nmai mai khong phai roi",
    )

    job = queue.enqueue(project_id, "transcribe")
    _register_transcribe_with(_mocked_whisperx_result)
    worker.process_job(job, queue, store)

    done = queue.get(job.id)
    assert done is not None and done.status == "completed", f"job failed: {done.error!r}"

    lyrics = store.read_json(project_id, "artifacts/lyrics.json")
    # Display text is the originals; timing is still the transcriber's (Req 4.1).
    assert lyrics["source"] == "original+transcriber"
    assert [line["text"] for line in lyrics["lines"]] == [
        "Bay qua bau troi rong",
        "ta duoi theo anh sang",
        "mai mai khong phai roi",
    ]
    assert lyrics["lines"][0]["start"] == 0.0
    assert lyrics["lines"][0]["end"] == 2.4
    assert lyrics["lines"][1]["start"] == 2.8

    # Still schema-valid and still encoded faithfully to SRT.
    jsonschema = pytest.importorskip("jsonschema")
    jsonschema.validate(instance=lyrics, schema=lyrics_schema)
    entries = _parse_srt(store.read_text(project_id, "artifacts/lyrics.srt"))
    assert len(entries) == len(lyrics["lines"])
    assert [e["num"] for e in entries] == [1, 2, 3]


def test_transcribe_pipeline_records_failure_through_worker(env) -> None:
    """A WhisperX failure is recorded on the job and writes no artifacts (Req 3.6)."""
    queue, store = env
    project_id = "proj-transcribe-fail"
    store.write_bytes(project_id, transcribe.AUDIO_ROLE, FAKE_AUDIO_BYTES)

    def boom(_audio_path: str) -> dict:
        raise RuntimeError("whisperx failed to decode audio")

    job = queue.enqueue(project_id, "transcribe")
    _register_transcribe_with(boom)
    worker.process_job(job, queue, store)

    failed = queue.get(job.id)
    assert failed is not None
    assert failed.status == "failed"
    assert failed.error == "whisperx failed to decode audio"
    # No artifacts were written because transcription failed before chaining.
    assert not store.exists(project_id, "artifacts/whisperx.json")
    assert not store.exists(project_id, "artifacts/lyrics.json")
    assert not store.exists(project_id, "artifacts/lyrics.srt")
