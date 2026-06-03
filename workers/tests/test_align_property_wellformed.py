"""Property-based test for Property 4: ``lyrics.json`` is well-formed.

Feature: music-visualizer, Property 4: For any transcription input (in any
order, with or without word timing), the produced ``lyrics.json`` satisfies:
lines are ordered by ascending start; every line has ``start <= end``; every
line has ``line1`` and ``line2`` present (``line2`` possibly empty) whose words
concatenate back to the line text in order; and where word timing exists,
``words`` is ordered by ascending start with each word within its line's
``[start, end]``.

Validates: Requirements 4.3, 4.5, 4.6, 4.7

The output is validated two ways: against the canonical shared JSON Schema
(``shared/src/schema/lyrics.schema.json``, the single source of truth per Req
15.4 — this covers the required ``start``/``end``/``text``/``line1``/``line2``
fields and the ``minimum: 0`` timestamp bounds of Req 4.3/4.4/4.7) and against
the ordering/containment invariants the schema cannot express (ascending line
order from Req 4.6, ``start <= end`` from Req 4.7, line1/line2 reconstructing the
text, and word ordering/bounds from Req 4.5).
"""

from __future__ import annotations

import json
from pathlib import Path

import jsonschema
from hypothesis import given, settings
from hypothesis import strategies as st

from src.align import OriginalLyrics, build_lyrics

# --- Canonical shared schema (Req 15.4: one schema consumed by all components) ---
_SCHEMA_PATH = (
    Path(__file__).resolve().parents[2]
    / "shared"
    / "src"
    / "schema"
    / "lyrics.schema.json"
)
_LYRICS_SCHEMA = json.loads(_SCHEMA_PATH.read_text(encoding="utf-8"))
_VALIDATOR = jsonschema.Draft202012Validator(_LYRICS_SCHEMA)


# --- Smart generators constrained to the transcription input space ---

# Finite timestamps spanning negatives (to exercise Req 4.7 clamping) through a
# realistic song length. Transcriber timestamps are finite real numbers, so NaN
# and infinity are intentionally excluded.
_timestamps = st.floats(
    min_value=-10.0, max_value=3600.0, allow_nan=False, allow_infinity=False
)

# A "token" is a whitespace-free chunk so that ``text.split()`` recovers exactly
# the tokens that ``split_two_lines`` joins into line1/line2. Exclude surrogates
# (Cs) plus every whitespace category (Cc control incl. tab/newline, Zs/Zl/Zp
# separators) so no token contains a ``str.isspace`` character.
_token = st.text(
    alphabet=st.characters(blacklist_categories=("Cs", "Cc", "Zs", "Zl", "Zp")),
    min_size=1,
    max_size=8,
)

# Arbitrary display text: unicode and whitespace allowed (whitespace-only and
# multi-space text exercise the split logic). Surrogates excluded for clean JSON.
_arbitrary_text = st.text(
    alphabet=st.characters(blacklist_categories=("Cs",)), max_size=40
)


def _word(text: str) -> st.SearchStrategy:
    return st.fixed_dictionaries(
        {"text": st.just(text), "start": _timestamps, "end": _timestamps}
    )


@st.composite
def _segment(draw: st.DrawFn) -> dict:
    """Generate one WhisperX-style segment, adversarial in order and word timing."""
    start = draw(_timestamps)
    end = draw(_timestamps)

    if draw(st.booleans()):
        # Token-based text so word-count matching can be controlled deliberately.
        tokens = draw(st.lists(_token, min_size=0, max_size=6))
        text = " ".join(tokens)
        seg: dict = {"start": start, "end": end, "text": text}
        word_mode = draw(st.sampled_from(["none", "match", "mismatch"]))
        if word_mode == "match" and tokens:
            # Matching count -> build_lyrics attaches word timing (Req 4.5).
            seg["words"] = [draw(_word(tok)) for tok in tokens]
        elif word_mode == "mismatch":
            n = draw(st.integers(min_value=0, max_value=4))
            seg["words"] = [draw(_word(draw(_token))) for _ in range(n)]
        return seg

    # Arbitrary (possibly unicode / whitespace-only) text, no word timing.
    return {"start": start, "end": end, "text": draw(_arbitrary_text)}


_whisperx = st.one_of(
    st.builds(lambda segs: {"segments": segs}, st.lists(_segment(), max_size=8)),
    st.just({}),  # missing "segments" key -> treated as no segments
)

_original = st.one_of(
    st.none(),
    st.builds(
        OriginalLyrics,
        st.lists(st.text(alphabet=st.characters(blacklist_categories=("Cs",)), max_size=30), max_size=8),
    ),
)


@settings(max_examples=100, deadline=None)
@given(whisperx=_whisperx, original=_original)
def test_lyrics_json_is_well_formed(whisperx: dict, original) -> None:
    out = build_lyrics(whisperx, original)

    # Conforms to the canonical shared schema: required start/end/text/line1/line2
    # fields, allowed optional words/letter, and minimum-0 timestamps
    # (Req 4.3, 4.4, 4.7, 15.4). additionalProperties:false also confirms no
    # stray keys leak from the transcriber segments.
    _VALIDATOR.validate(out)

    lines = out["lines"]

    # Req 4.6: lines ordered by ascending start.
    starts = [line["start"] for line in lines]
    assert starts == sorted(starts)

    for line in lines:
        # Req 4.3 / 4.4: every line carries the required display fields.
        assert {"start", "end", "text", "line1", "line2"} <= set(line.keys())

        # Req 4.7: 0 <= start <= end.
        assert line["start"] >= 0.0
        assert line["start"] <= line["end"]

        # line1/line2 (line2 possibly empty) reconstruct the line text tokens in
        # order, so the bottom-box rows lose no words and add none.
        assert line["line1"].split() + line["line2"].split() == line["text"].split()

        # Req 4.5: when present, words are ascending by start and each word lies
        # within the (clamped) line interval.
        if "words" in line:
            word_starts = [w["start"] for w in line["words"]]
            assert word_starts == sorted(word_starts)
            for w in line["words"]:
                assert line["start"] <= w["start"] <= w["end"] <= line["end"]
