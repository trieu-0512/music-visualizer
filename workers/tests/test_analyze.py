"""Unit sanity tests for the Audio_Analyzer (task 7.1).

Example-based checks of the pure analysis helpers and ``analyze_signal`` on
synthetic signals (sine tones, impulse trains, silence). The property-based
well-formedness test (Property 6) lives in task 7.2 and the real-clip
integration test in task 7.3.
"""

from __future__ import annotations

import numpy as np

from src.analyze import (
    BAND_COUNT,
    INTERVAL,
    analyze_signal,
    beat_timestamps,
    frame_indices,
    handle_analyze,
    normalize,
    normalize_bands,
    rms_series,
    spectral_series,
)


def _sine(freq: float, seconds: float, sr: int = 22050) -> np.ndarray:
    t = np.linspace(0.0, seconds, int(seconds * sr), endpoint=False)
    return 0.5 * np.sin(2.0 * np.pi * freq * t)


def test_normalize_maps_into_unit_range() -> None:
    out = normalize([0.0, 1.0, 2.0, 4.0])
    assert out.min() >= 0.0 and out.max() <= 1.0
    assert out[-1] == 1.0  # peak maps to 1.0


def test_normalize_silence_is_all_zero_not_nan() -> None:
    out = normalize([0.0, 0.0, 0.0])
    assert np.all(out == 0.0)
    assert not np.any(np.isnan(out))


def test_normalize_empty_series() -> None:
    assert normalize([]).size == 0


def test_normalize_bands_global_peak_in_range() -> None:
    bands = normalize_bands([[0.0, 2.0], [4.0, 1.0]])
    assert bands.shape == (2, 2)
    assert bands.min() >= 0.0 and bands.max() <= 1.0
    assert bands.max() == 1.0


def test_normalize_bands_silence() -> None:
    bands = normalize_bands([[0.0, 0.0], [0.0, 0.0]])
    assert np.all(bands == 0.0)


def test_frame_indices_partitions_whole_signal() -> None:
    frames = frame_indices(100, 4)
    assert len(frames) == 4
    assert frames[0][0] == 0
    assert frames[-1][1] == 100
    # contiguous, non-overlapping
    for (_, end), (start, _) in zip(frames, frames[1:]):
        assert end == start


def test_frame_indices_degenerate_inputs() -> None:
    assert frame_indices(0, 4) == []
    assert frame_indices(100, 0) == []


def test_rms_series_louder_signal_has_higher_rms() -> None:
    sr = 22050
    quiet = 0.1 * _sine(220.0, 0.5, sr)
    loud = 0.9 * _sine(220.0, 0.5, sr)
    frames = frame_indices(quiet.size, 5)
    assert rms_series(loud, frames).mean() > rms_series(quiet, frames).mean()


def test_spectral_series_bass_tone_loads_low_bands() -> None:
    sr = 22050
    # A 60 Hz tone sits in the bass band and the lowest frequency band.
    y = _sine(60.0, 0.5, sr)
    frames = frame_indices(y.size, 5)
    bands, bass = spectral_series(y, sr, frames, BAND_COUNT)
    assert bands.shape == (5, BAND_COUNT)
    assert np.all(bass > 0.0)
    # lowest band should dominate for a 60 Hz tone
    assert bands[:, 0].sum() >= bands[:, 1:].sum()


def test_spectral_series_treble_tone_avoids_bass() -> None:
    sr = 22050
    # An 8 kHz tone has negligible energy in the 20-250 Hz bass band.
    y = _sine(8000.0, 0.5, sr)
    frames = frame_indices(y.size, 5)
    bands, bass = spectral_series(y, sr, frames, BAND_COUNT)
    assert bass.sum() < bands.sum()


def test_spectral_series_zero_band_count() -> None:
    sr = 22050
    y = _sine(440.0, 0.2, sr)
    frames = frame_indices(y.size, 3)
    bands, bass = spectral_series(y, sr, frames, 0)
    assert bands.shape == (3, 0)
    assert np.all(bass == 0.0)


def test_beat_timestamps_impulse_train_is_ascending_and_in_range() -> None:
    sr = 22050
    duration = 4.0
    y = np.zeros(int(sr * duration), dtype=float)
    # An impulse train at 2 Hz (120 BPM) gives a clear, trackable beat.
    for i in range(0, y.size, sr // 2):
        y[i] = 1.0
    beats = beat_timestamps(y, sr, duration)
    assert beats == sorted(beats)
    assert all(0.0 <= b <= duration for b in beats)


def test_beat_timestamps_silence_and_empty() -> None:
    assert beat_timestamps(np.zeros(0), 22050) == []
    # Silence yields no usable beats (best-effort returns ascending/in-range list).
    sr = 22050
    beats = beat_timestamps(np.zeros(sr), sr, 1.0)
    assert beats == sorted(beats)


def test_analyze_signal_shape_and_invariants() -> None:
    sr = 22050
    duration = 2.0
    # Sine sweep so different bands light up over time.
    t = np.linspace(0.0, duration, int(sr * duration), endpoint=False)
    y = 0.5 * np.sin(2.0 * np.pi * (200.0 + 1500.0 * t) * t)

    analysis = analyze_signal(y, sr)

    assert analysis["version"] == 1
    assert analysis["interval"] == INTERVAL
    assert analysis["interval"] > 0
    assert analysis["sampleRate"] == sr
    assert analysis["bandCount"] == BAND_COUNT
    assert abs(analysis["duration"] - duration) < 1e-6

    expected_len = int(round(duration / INTERVAL))
    assert len(analysis["rms"]) == expected_len
    assert len(analysis["bass"]) == expected_len
    assert len(analysis["bands"]) == expected_len

    # Normalized series in [0, 1]; bands each have bandCount entries.
    assert all(0.0 <= v <= 1.0 for v in analysis["rms"])
    assert all(0.0 <= v <= 1.0 for v in analysis["bass"])
    for row in analysis["bands"]:
        assert len(row) == BAND_COUNT
        assert all(0.0 <= v <= 1.0 for v in row)

    # Beats ascending and within [0, duration].
    beats = analysis["beats"]
    assert beats == sorted(beats)
    assert all(0.0 <= b <= analysis["duration"] for b in beats)


def test_analyze_signal_silence_is_well_formed() -> None:
    sr = 22050
    duration = 1.0
    analysis = analyze_signal(np.zeros(int(sr * duration)), sr)
    assert all(v == 0.0 for v in analysis["rms"])
    assert all(v == 0.0 for v in analysis["bass"])
    assert all(all(v == 0.0 for v in row) for row in analysis["bands"])
    assert analysis["beats"] == sorted(analysis["beats"])


def test_handle_analyze_writes_artifact(tmp_path) -> None:
    # Exercise the full handler against a real decoded file via the AssetStore.
    import soundfile as sf

    from src.queue import Job
    from src.store import AssetStore

    store = AssetStore(tmp_path / "storage")
    sr = 22050
    y = _sine(220.0, 1.0, sr).astype(np.float32)
    project_id = "proj-analyze"
    # The handler reads the role path "assets/audio" (no extension), matching the
    # design and the transcribe handler. Write a WAV there with an explicit format
    # since the path carries no extension for libsndfile to infer from.
    audio_path = store.resolve_path(project_id, "assets/audio")
    audio_path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(audio_path), y, sr, format="WAV")

    job = Job(id="j1", project_id=project_id, type="analyze", status="running")
    produced = handle_analyze(job, store)

    assert produced == ["artifacts/audio-analysis.json"]
    assert store.exists(project_id, "artifacts/audio-analysis.json")
    analysis = store.read_json(project_id, "artifacts/audio-analysis.json")
    assert analysis["version"] == 1
    assert analysis["sampleRate"] == sr
    assert len(analysis["rms"]) == int(round(analysis["duration"] / analysis["interval"]))
