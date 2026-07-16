"""Integration test for the Audio_Analyzer on a short real clip (task 7.3).

Unlike the unit/property tests (tasks 7.1, 7.2) that exercise the pure
``analyze_signal`` helpers on in-memory arrays, this test drives the *full*
analyze path the way the system does in practice:

    1. synthesize a short, composed audio clip and encode it to a real WAV file,
    2. store it via the :class:`~src.store.AssetStore` at the project's
       ``assets/audio`` address,
    3. run the ``analyze`` job through the Audio_Worker dispatch
       (:func:`src.worker.process_job` over a real :class:`~src.queue.JobQueue`),
       which decodes the file with librosa (FFmpeg-backed) and writes the
       artifact, then
    4. assert ``artifacts/audio-analysis.json`` is present and has the right
       shape -- including validation against the shared JSON Schema
       (``shared/src/schema/audio-analysis.schema.json``) so the artifact the
       worker writes is exactly what every other component consumes.

Storage and queue live under pytest's ``tmp_path`` and are cleaned up
automatically, so the test is hermetic and needs no committed fixture file.

Requirements covered:
- 6.1 Analyze a stored Audio_Asset and produce ``audio-analysis.json`` under the
  owning Project_Id.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

import src.worker as worker
from src.queue import Job, JobQueue
from src.store import AssetStore

# Native sample rate of the synthesized clip.
SAMPLE_RATE = 22050
# Clip length in seconds. 1.6 / INTERVAL(0.04) = 40 frames exactly, so the
# series lengths line up cleanly with round(duration / interval).
CLIP_SECONDS = 1.6


def _composed_clip(sr: int = SAMPLE_RATE, seconds: float = CLIP_SECONDS) -> np.ndarray:
    """A short, music-like mono clip: a bass kick train + mid tone + a treble line.

    This is a real, broadband signal (not a single pure tone) so the analyzer's
    RMS, bass, frequency-band, and beat extraction all have something to work on,
    while staying tiny enough to decode and analyze in well under a second.
    """
    n = int(sr * seconds)
    t = np.linspace(0.0, seconds, n, endpoint=False)

    # A steady 120 BPM (2 Hz) kick: short decaying low-frequency bursts.
    kick = np.zeros(n, dtype=float)
    step = sr // 2  # one kick every 0.5 s
    env_len = sr // 10  # 0.1 s decay
    env = np.exp(-np.linspace(0.0, 6.0, env_len))
    kick_tone = np.sin(2.0 * np.pi * 55.0 * np.arange(env_len) / sr)
    for start in range(0, n - env_len, step):
        kick[start : start + env_len] += 0.8 * env * kick_tone

    mid = 0.3 * np.sin(2.0 * np.pi * 440.0 * t)        # sustained mid tone
    treble = 0.15 * np.sin(2.0 * np.pi * 4000.0 * t)   # quiet treble line

    y = kick + mid + treble
    peak = float(np.max(np.abs(y)))
    if peak > 0:
        y = 0.9 * y / peak  # keep within [-1, 1] for clean WAV encoding
    return y.astype(np.float32)


@pytest.fixture
def shared_schema() -> dict:
    """Load the shared audio-analysis JSON Schema consumed by every component."""
    # tests/ -> workers/ -> music-visualizer/ (workspace root for the monorepo).
    workspace_root = Path(__file__).resolve().parents[2]
    schema_path = (
        workspace_root / "shared" / "src" / "schema" / "audio-analysis.schema.json"
    )
    assert schema_path.is_file(), f"shared schema not found at {schema_path}"
    return json.loads(schema_path.read_text(encoding="utf-8"))


def test_analyze_on_sample_clip_produces_wellshaped_artifact(
    tmp_path: Path, shared_schema: dict
) -> None:
    """End-to-end analyze on a real clip writes a well-shaped artifact (Req 6.1)."""
    import soundfile as sf

    store = AssetStore(tmp_path / "storage")
    queue = JobQueue(tmp_path / "jobs")
    project_id = "proj-clip"

    # 1) Encode the composed clip to a real WAV at the Audio_Asset address. The
    #    role path "assets/audio" carries no extension, so name the format
    #    explicitly for libsndfile (matching the transcribe/analyze handlers).
    y = _composed_clip()
    audio_path = store.resolve_path(project_id, "assets/audio")
    audio_path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(audio_path), y, SAMPLE_RATE, format="WAV")
    assert store.exists(project_id, "assets/audio")

    # 2) Run the analyze job through the real worker dispatch + queue, so the
    #    decode (librosa/FFmpeg), analysis, and artifact write all run as in prod.
    #    Hybrid claim must set ownership before process_job (PR-04 fencing).
    worker_id = "test-analyze-int"
    job = queue.enqueue(project_id, "analyze")
    claimed = queue.claim_next(["analyze"], worker_id)
    assert claimed is not None and claimed.id == job.id
    worker.register_handler("analyze", _analyze_handler())
    try:
        worker.process_job(claimed, queue, store, worker_id=worker_id)
    finally:
        worker.DISPATCH.pop("analyze", None)

    # The queue records completion and the produced artifact reference (Req 12.3).
    done = queue.get(job.id)
    assert done is not None
    assert done.status == "completed", f"job failed: {done.error!r}"
    assert done.artifacts == ["artifacts/audio-analysis.json"]

    # 3) Artifact is present under the owning Project_Id (Req 6.1).
    assert store.exists(project_id, "artifacts/audio-analysis.json")
    analysis = store.read_json(project_id, "artifacts/audio-analysis.json")

    # 4a) Shape: validate against the shared JSON Schema the whole system uses.
    jsonschema = pytest.importorskip("jsonschema")
    jsonschema.validate(instance=analysis, schema=shared_schema)

    # 4b) Spot-check the concrete values for this clip beyond pure schema shape.
    assert analysis["version"] == 1
    assert analysis["sampleRate"] == SAMPLE_RATE
    assert analysis["interval"] > 0
    # Duration reflects the real clip length (decoded at its native sample rate).
    assert analysis["duration"] == pytest.approx(CLIP_SECONDS, abs=0.05)

    # Time-series lengths are consistent with round(duration / interval).
    expected_len = int(round(analysis["duration"] / analysis["interval"]))
    assert len(analysis["rms"]) == expected_len
    assert len(analysis["bass"]) == expected_len
    assert len(analysis["bands"]) == expected_len

    # Normalized series stay in [0, 1]; every band row has bandCount entries.
    band_count = analysis["bandCount"]
    assert band_count >= 1
    assert all(0.0 <= v <= 1.0 for v in analysis["rms"])
    assert all(0.0 <= v <= 1.0 for v in analysis["bass"])
    for row in analysis["bands"]:
        assert len(row) == band_count
        assert all(0.0 <= v <= 1.0 for v in row)

    # A real broadband clip has audible energy, so RMS is not flat-zero.
    assert max(analysis["rms"]) > 0.0

    # Beats are ascending and within [0, duration] (beat tracking is best-effort,
    # so an empty list is acceptable; ordering/bounds must always hold).
    beats = analysis["beats"]
    assert beats == sorted(beats)
    assert all(0.0 <= b <= analysis["duration"] for b in beats)


def _analyze_handler():
    """Resolve the real analyze handler, skipping if librosa is unavailable."""
    pytest.importorskip("librosa")
    from src.analyze import handle_analyze

    return handle_analyze
