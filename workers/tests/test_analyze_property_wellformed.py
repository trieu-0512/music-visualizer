"""Property-based test for Property 6: ``audio-analysis.json`` is well-formed.

Feature: music-visualizer, Property 6: For any decoded audio buffer, the
produced ``audio-analysis.json`` satisfies: ``rms``, ``bass``, and every
``bands[i]`` value lies in ``[0,1]``; ``interval > 0``; the ``rms`` and ``bass``
series lengths are consistent with ``round(duration / interval)``; every
``bands[i].length`` equals ``bandCount``; and ``beats`` is ordered ascending
with every timestamp in ``[0, duration]``.

Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6

The output is validated two ways: against the canonical shared JSON Schema
(``shared/src/schema/audio-analysis.schema.json`` — the single source of truth
per Req 15.4, which pins the value bounds of ``rms``/``bass``/``bands`` and the
``exclusiveMinimum: 0`` on ``interval``) and against the ordering/length
invariants the schema cannot express (the series lengths matching
``round(duration / interval)`` from Req 6.6, every band row having ``bandCount``
entries from Req 6.5, and the ascending/in-range ``beats`` of Req 6.3).

The generator produces synthetic mono signals as numpy arrays — silence, single
sine tones, sine sweeps, impulse trains, random noise, and chords — across a set
of realistic sample rates and durations (including the empty/very-short edge),
then calls the pure ``analyze_signal`` orchestrator directly (no disk/decode).
"""

from __future__ import annotations

import json
from pathlib import Path

import jsonschema
import numpy as np
from hypothesis import given, settings
from hypothesis import strategies as st

from src.analyze import analyze_signal

# --- Canonical shared schema (Req 15.4: one schema consumed by all components) ---
_SCHEMA_PATH = (
    Path(__file__).resolve().parents[2]
    / "shared"
    / "src"
    / "schema"
    / "audio-analysis.schema.json"
)
_ANALYSIS_SCHEMA = json.loads(_SCHEMA_PATH.read_text(encoding="utf-8"))
_VALIDATOR = jsonschema.Draft202012Validator(_ANALYSIS_SCHEMA)


# --- Smart generators constrained to the decoded-audio input space ---

# Realistic decode sample rates (Hz). librosa.load would yield one of these.
_SAMPLE_RATES = st.sampled_from([8000, 16000, 22050, 44100, 48000])

# Durations span the empty/very-short edge through a few seconds. Kept finite and
# modest so 100 iterations (incl. best-effort beat tracking) stay fast.
_DURATIONS = st.floats(min_value=0.0, max_value=2.0, allow_nan=False, allow_infinity=False)

# Amplitudes in [0, 1]; normalization should map any non-negative energy into
# range regardless, but realistic amplitudes keep the signals meaningful.
_AMPLITUDES = st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False)

# A frequency expressed as a fraction of the sample rate, kept below Nyquist.
_FREQ_FRACTION = st.floats(min_value=0.001, max_value=0.49, allow_nan=False, allow_infinity=False)


@st.composite
def _synthetic_signal(draw: st.DrawFn) -> tuple[np.ndarray, int]:
    """Generate a synthetic mono signal and its sample rate.

    Covers the signal shapes called out by the task — silence, sine sweeps and
    impulse trains — plus single tones, random noise, and chords, over varied
    durations and sample rates including the empty edge.
    """
    sr = draw(_SAMPLE_RATES)
    duration = draw(_DURATIONS)
    n = int(round(duration * sr))
    amp = draw(_AMPLITUDES)
    t = np.arange(n, dtype=float) / sr  # empty array when n == 0

    if n == 0:
        return np.zeros(0, dtype=float), sr

    kind = draw(st.sampled_from(["silence", "sine", "sweep", "impulse", "noise", "chord"]))

    if kind == "silence":
        y = np.zeros(n, dtype=float)
    elif kind == "sine":
        f = draw(_FREQ_FRACTION) * sr
        y = amp * np.sin(2.0 * np.pi * f * t)
    elif kind == "sweep":
        f0 = draw(_FREQ_FRACTION) * sr
        f1 = draw(_FREQ_FRACTION) * sr
        span = duration if duration > 0.0 else 1.0
        inst = f0 + (f1 - f0) * (t / span)  # linearly swept frequency
        y = amp * np.sin(2.0 * np.pi * inst * t)
    elif kind == "impulse":
        period = draw(st.integers(min_value=1, max_value=n))
        y = np.zeros(n, dtype=float)
        y[::period] = amp if amp > 0.0 else 1.0
    elif kind == "noise":
        seed = draw(st.integers(min_value=0, max_value=2**32 - 1))
        rng = np.random.default_rng(seed)
        y = amp * rng.uniform(-1.0, 1.0, n)
    else:  # "chord": sum of a few sine partials
        partials = draw(st.integers(min_value=2, max_value=4))
        y = np.zeros(n, dtype=float)
        for _ in range(partials):
            f = draw(_FREQ_FRACTION) * sr
            y = y + np.sin(2.0 * np.pi * f * t)
        y = amp * y

    return np.asarray(y, dtype=float), sr


@settings(max_examples=100, deadline=None)
@given(signal=_synthetic_signal())
def test_audio_analysis_json_is_well_formed(signal: tuple[np.ndarray, int]) -> None:
    y, sr = signal
    analysis = analyze_signal(y, sr)

    # Conforms to the canonical shared schema: rms/bass/bands values bounded to
    # [0, 1], interval strictly positive, beats >= 0, and no stray keys
    # (additionalProperties:false) — Req 6.2, 6.4, 6.5, 6.6, 15.4.
    _VALIDATOR.validate(analysis)

    interval = analysis["interval"]
    duration = analysis["duration"]

    # Req 6.6: a positive sampling interval and a recorded (non-negative) duration.
    assert interval > 0.0
    assert duration >= 0.0

    # Req 6.6: rms/bass/bands series lengths consistent with round(duration/interval).
    expected_len = int(round(duration / interval))
    assert len(analysis["rms"]) == expected_len
    assert len(analysis["bass"]) == expected_len
    assert len(analysis["bands"]) == expected_len

    # Req 6.2 / 6.4: normalized RMS and bass series lie within [0, 1].
    assert all(0.0 <= v <= 1.0 for v in analysis["rms"])
    assert all(0.0 <= v <= 1.0 for v in analysis["bass"])

    # Req 6.5: every band row has exactly bandCount entries, each within [0, 1].
    band_count = analysis["bandCount"]
    for row in analysis["bands"]:
        assert len(row) == band_count
        assert all(0.0 <= v <= 1.0 for v in row)

    # Req 6.3: beats ordered ascending with every timestamp within [0, duration].
    beats = analysis["beats"]
    assert beats == sorted(beats)
    assert all(0.0 <= b <= duration for b in beats)
