"""Audio_Analyzer: produce audio-analysis.json from a Project's Audio_Asset.

This module is the Audio_Analyzer subcomponent of the Audio_Worker
(design "Audio_Analyzer"). ``handle_analyze`` is the job handler the worker
dispatches for ``analyze`` jobs: it decodes the stored Audio_Asset (librosa /
FFmpeg-backed), computes the reactive time series, and writes an artifact shaped
like the shared ``audio-analysis.json`` schema
(``shared/src/schema/audio-analysis.schema.json``).

Requirements covered:
- 6.1 Produce ``audio-analysis.json`` under the owning Project_Id.
- 6.2 A normalized (0..1) time series of RMS volume values.
- 6.3 A list of Beat_Event timestamps, ordered ascending, within [0, duration].
- 6.4 A normalized (0..1) time series of bass energy values.
- 6.5 Per-interval frequency-band energy values (``bands`` / ``bandCount``).
- 6.6 The audio duration and the sampling interval for the time series.

The analysis is factored so the heavy I/O (``handle_analyze`` reading the asset
and decoding with librosa) is separated from the pure, deterministic
``analyze_signal`` and its helpers (``normalize``, ``normalize_bands``,
framing/spectral helpers, ``beat_timestamps``). Those pure functions operate on
plain numpy arrays so they are importable and unit/property testable on
synthetic signals (sine sweeps, impulse trains, silence) without touching disk
-- and without requiring librosa for everything except beat extraction, which
degrades gracefully when librosa is unavailable.

Documented audio-analysis.json invariants (design): ``rms``, ``bass`` and every
``bands[i]`` value lie in ``[0, 1]``; ``interval > 0``; the ``rms``/``bass``
series lengths equal ``round(duration / interval)``; every ``bands[i]`` has
``bandCount`` entries; and ``beats`` is ascending with each timestamp in
``[0, duration]``.
"""

from __future__ import annotations

import os
from typing import TYPE_CHECKING, Any, Sequence

import numpy as np

if TYPE_CHECKING:  # pragma: no cover - typing only
    from src.queue import Job
    from src.store import AssetStore

__all__ = [
    "INTERVAL",
    "BAND_COUNT",
    "BASS_LOW",
    "BASS_HIGH",
    "handle_analyze",
    "analyze_signal",
    "normalize",
    "normalize_bands",
    "frame_indices",
    "rms_series",
    "spectral_series",
    "beat_timestamps",
]

# Sampling interval (seconds) between successive time-series samples. The hop is
# derived from this and the sample rate. Matches the design example (0.04 s).
INTERVAL = 0.04

# Number of frequency bands reported per interval (design example: 4).
BAND_COUNT = 4

# Bass band edges in Hz used for the dedicated bass-energy series (Req 6.4).
BASS_LOW = 20.0
BASS_HIGH = 250.0


# -- pure helpers ----------------------------------------------------------


def normalize(series: Sequence[float] | np.ndarray) -> np.ndarray:
    """Peak-normalize a non-negative series into ``[0, 1]`` (Req 6.2, 6.4).

    Energy/RMS values are non-negative, so dividing by the peak maps the series
    into ``[0, 1]`` while preserving relative dynamics. A silent series (peak of
    zero) maps to all zeros rather than producing ``NaN``. The result is clipped
    to guard against floating-point drift above 1.0.
    """
    arr = np.asarray(series, dtype=float).ravel()
    if arr.size == 0:
        return arr
    peak = float(np.max(arr))
    if peak <= 0.0:
        return np.zeros_like(arr)
    return np.clip(arr / peak, 0.0, 1.0)


def normalize_bands(bands: Sequence[Sequence[float]] | np.ndarray) -> np.ndarray:
    """Normalize a ``(frames, bandCount)`` energy matrix into ``[0, 1]`` (Req 6.5).

    Normalization is global (by the single largest band energy across all frames
    and bands) so the relationship between bands and over time is preserved: the
    loudest band-frame maps to 1.0 and the rest scale proportionally. An all-zero
    matrix (silence) maps to zeros. Values are clipped into ``[0, 1]``.
    """
    arr = np.asarray(bands, dtype=float)
    if arr.size == 0:
        return arr
    peak = float(np.max(arr))
    if peak <= 0.0:
        return np.zeros_like(arr)
    return np.clip(arr / peak, 0.0, 1.0)


def frame_indices(num_samples: int, n_frames: int) -> list[tuple[int, int]]:
    """Partition ``num_samples`` into ``n_frames`` contiguous sample windows.

    Frames span the whole signal with near-equal lengths (boundaries placed by
    ``linspace`` and rounded). Building exactly ``n_frames`` frames -- where
    ``n_frames = round(duration / interval)`` -- is what makes the series lengths
    line up with the documented invariant. Returns an empty list when there is
    nothing to frame.
    """
    if n_frames <= 0 or num_samples <= 0:
        return []
    edges = np.round(np.linspace(0, num_samples, n_frames + 1)).astype(int)
    return [(int(s), int(e)) for s, e in zip(edges[:-1], edges[1:])]


def rms_series(y: np.ndarray, frames: list[tuple[int, int]]) -> np.ndarray:
    """Root-mean-square amplitude per frame (the raw, un-normalized RMS, Req 6.2)."""
    out = np.empty(len(frames), dtype=float)
    for i, (s, e) in enumerate(frames):
        seg = y[s:e]
        out[i] = float(np.sqrt(np.mean(seg * seg))) if seg.size else 0.0
    return out


def spectral_series(
    y: np.ndarray,
    sr: int,
    frames: list[tuple[int, int]],
    band_count: int,
) -> tuple[np.ndarray, np.ndarray]:
    """Per-frame frequency-band energies and bass energy (raw, Req 6.4, 6.5).

    For each frame the power spectrum is computed with a real FFT. The positive
    frequency bins are split into ``band_count`` contiguous groups whose summed
    power gives the band energies; the bass energy is the summed power of the
    bins whose frequency falls in ``[BASS_LOW, BASS_HIGH]``. Returns
    ``(bands, bass)`` with ``bands`` shaped ``(len(frames), band_count)``.
    """
    bands = np.zeros((len(frames), max(band_count, 0)), dtype=float)
    bass = np.zeros(len(frames), dtype=float)
    if band_count <= 0:
        return bands, bass
    for i, (s, e) in enumerate(frames):
        seg = y[s:e]
        if seg.size == 0:
            continue
        power = np.abs(np.fft.rfft(seg)) ** 2
        freqs = np.fft.rfftfreq(seg.size, d=1.0 / sr) if sr > 0 else np.zeros(power.size)
        for j, group in enumerate(np.array_split(power, band_count)):
            bands[i, j] = float(group.sum())
        mask = (freqs >= BASS_LOW) & (freqs <= BASS_HIGH)
        bass[i] = float(power[mask].sum())
    return bands, bass


def beat_timestamps(y: np.ndarray, sr: int, duration: float | None = None) -> list[float]:
    """Detect Beat_Event timestamps, ascending and within bounds (Req 6.3).

    Uses librosa's beat tracker (FFmpeg/numpy-backed) and returns the beat times
    in seconds, sorted ascending and clamped to ``[0, duration]`` when a duration
    is given. Beat tracking is best-effort: an unavailable librosa, too-short a
    signal, or a tracker error yields an empty list -- which still satisfies the
    ascending/in-range invariant -- rather than failing the whole analysis.
    """
    if y.size == 0 or sr <= 0:
        return []
    try:
        import librosa  # lazy: keep the pure helpers usable without librosa

        _tempo, times = librosa.beat.beat_track(y=y, sr=sr, units="time")
        beats = np.asarray(times, dtype=float).ravel()
    except Exception:
        return []
    if duration is not None:
        beats = beats[(beats >= 0.0) & (beats <= duration)]
    else:
        beats = beats[beats >= 0.0]
    return sorted(float(b) for b in beats)


def analyze_signal(y: np.ndarray | Sequence[float], sr: int) -> dict:
    """Compute the full ``audio-analysis.json`` payload for a decoded signal.

    Pure and deterministic (apart from the best-effort beat tracker): it frames
    the mono signal into ``round(duration / INTERVAL)`` windows and derives the
    normalized RMS (Req 6.2), bass (Req 6.4) and band (Req 6.5) series, the beat
    timestamps (Req 6.3), and the duration/interval metadata (Req 6.6). Returns a
    dict matching the shared schema shape.
    """
    y = np.asarray(y, dtype=float)
    if y.ndim > 1:
        y = y.mean(axis=tuple(range(y.ndim - 1)))  # collapse to mono if needed
    y = y.ravel()

    duration = float(y.size) / float(sr) if sr > 0 else 0.0
    n_frames = int(round(duration / INTERVAL))
    frames = frame_indices(y.size, n_frames)

    rms = normalize(rms_series(y, frames))
    bands_raw, bass_raw = spectral_series(y, sr, frames, BAND_COUNT)
    bands = normalize_bands(bands_raw)
    bass = normalize(bass_raw)
    beats = beat_timestamps(y, sr, duration)

    return {
        "version": 1,
        "duration": duration,
        "interval": INTERVAL,
        "sampleRate": int(sr),
        "rms": [float(v) for v in rms],
        "bass": [float(v) for v in bass],
        "bands": _bands_to_list(bands),
        "bandCount": BAND_COUNT,
        "beats": beats,
    }


def _bands_to_list(bands: np.ndarray) -> list[list[float]]:
    """Convert a normalized bands matrix to nested Python floats (JSON-ready)."""
    arr = np.asarray(bands, dtype=float)
    if arr.size == 0 or arr.ndim < 2:
        return []
    return [[float(v) for v in row] for row in arr]


# -- job handler -----------------------------------------------------------


def handle_analyze(job: "Job", store: "AssetStore") -> list[str]:
    """Analyze a Project's Audio_Asset and write ``audio-analysis.json`` (Req 6.1).

    Reads the stored Audio_Asset to a temp file (the API enforces that one exists,
    Req 6.7), decodes it with librosa (FFmpeg-backed) at its native sample rate as
    mono, computes the analysis via :func:`analyze_signal`, and writes the artifact
    under the owning Project_Id. The temp decode file is always cleaned up.

    Returns the list of produced artifact relative paths for the Job_Queue to
    record on completion (Req 12.3).
    """
    import librosa  # lazy: avoid importing the heavy decoder until a job runs

    audio_path = store.read_to_temp(job.project_id, "assets/audio")
    try:
        y, sr = librosa.load(audio_path, sr=None, mono=True)  # FFmpeg-backed decode
    finally:
        try:
            os.remove(audio_path)
        except OSError:
            pass

    analysis = analyze_signal(y, int(sr))
    store.write_json(job.project_id, "artifacts/audio-analysis.json", analysis)  # Req 6.1
    return ["artifacts/audio-analysis.json"]
