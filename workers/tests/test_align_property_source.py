"""Property-based test for Lyric_Aligner source selection (task 6.3).

Feature: music-visualizer, Property 3: Lyric text and timing come from the
correct source. For any transcription result and optional original lyrics: when
original lyrics are present, every produced ``lyrics.json`` line's display text
is one of the original lyric lines while its start/end derive from a transcriber
segment; when original lyrics are absent, every line's text and timing equal the
corresponding transcriber segment.

Validates: Requirements 4.1, 4.2
"""

from __future__ import annotations

from typing import Optional

from hypothesis import given, settings
from hypothesis import strategies as st

from src.align import OriginalLyrics, build_lyrics

# Non-negative, finite, bounded timestamps so that ``clamp_interval`` (start >= 0,
# end >= start) is a no-op for generated segments. That lets the test assert the
# produced timing equals the *source* segment timing exactly, which is what
# Property 3 is about -- not the (separate) clamping invariant of Property 4.
_TIMESTAMPS = st.floats(min_value=0.0, max_value=10_000.0, allow_nan=False, allow_infinity=False)
_DURATIONS = st.floats(min_value=0.0, max_value=1_000.0, allow_nan=False, allow_infinity=False)
_TEXTS = st.text(max_size=40)


@st.composite
def _word(draw: st.DrawFn) -> dict:
    """A WhisperX-shaped word timing entry (text/start/end)."""
    start = draw(_TIMESTAMPS)
    end = start + draw(_DURATIONS)
    return {"text": draw(_TEXTS), "start": start, "end": end}


@st.composite
def _segment(draw: st.DrawFn) -> dict:
    """A WhisperX-shaped segment: start/end/text and optional word timing."""
    start = draw(_TIMESTAMPS)
    end = start + draw(_DURATIONS)  # end >= start so clamping does not alter timing
    seg: dict = {"start": start, "end": end, "text": draw(_TEXTS)}
    if draw(st.booleans()):
        seg["words"] = draw(st.lists(_word(), max_size=5))
    return seg


_SEGMENTS = st.lists(_segment(), max_size=8)
_ORIGINAL = st.one_of(
    st.none(),
    st.builds(OriginalLyrics, st.lists(_TEXTS, max_size=8)),
)


@settings(max_examples=100, deadline=None)
@given(segments=_SEGMENTS, original=_ORIGINAL)
def test_property_3_lyric_text_and_timing_come_from_correct_source(
    segments: list[dict], original: Optional[OriginalLyrics]
) -> None:
    """Property 3: lyric text and timing come from the correct source."""
    whisperx = {"segments": segments}

    result = build_lyrics(whisperx, original)
    lines = result["lines"]

    # Compare as multisets of (text, start, end): build_lyrics sorts lines by
    # ascending start, so positional identity is lost but the *set* of produced
    # (text, timing) triples must equal the set drawn from the correct source.
    produced = sorted((ln["text"], ln["start"], ln["end"]) for ln in lines)

    if original is None:
        # Req 4.2: with no original lyrics, both text and timing come from the
        # transcriber segments -- one produced line per segment, verbatim.
        assert result["source"] == "transcriber"
        expected = sorted(
            (seg["text"], float(seg["start"]), float(seg["end"])) for seg in segments
        )
        assert produced == expected
    else:
        # Req 4.1: with original lyrics present, display text comes from the
        # original lines while start/end still come from a transcriber segment.
        # The aligner pairs originals to segments positionally (zip), so the
        # produced triples equal that pairing.
        assert result["source"] == "original+transcriber"
        expected = sorted(
            (text, float(seg["start"]), float(seg["end"]))
            for text, seg in zip(original.lines, segments)
        )
        assert produced == expected
        # Every display text must be one of the original lyric lines (the source
        # of text), and never invented from the transcriber.
        for ln in lines:
            assert ln["text"] in original.lines
