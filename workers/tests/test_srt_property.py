"""Property-based test for Property 5: ``lyrics.srt`` faithfully encodes ``lyrics.json``.

Feature: music-visualizer, Property 5: For any ``lyrics.json``, the produced
``lyrics.srt`` parses to exactly one entry per lyric line with start/end times
equal to that line's, entries ordered by ascending start, and entry numbers a
sequential ``1..N``.

Validates: Requirements 5.2, 5.3

Strategy: generate arbitrary ``lyrics.json``-shaped dicts (lines in varied order,
with ``line1``/``line2`` rows or a plain ``text`` fallback), render them with
``lyrics_to_srt``, then parse the resulting SubRip text back into entries. The
parsed entries are compared against the ascending-start ordering of the input to
prove the encoding is faithful:

  * exactly one entry per line (Req 5.2),
  * entries ordered by ascending start with sequential numbering ``1..N``
    (Req 5.3),
  * each entry's parsed start/end timestamps equal the corresponding line's
    times under the SubRip ``HH:MM:SS,mmm`` format and the cue text equals the
    line's displayed subtitle text (Req 5.2).
"""

from __future__ import annotations

from typing import Any

from hypothesis import given, settings
from hypothesis import strategies as st

from src.srt import lyrics_to_srt, srt_text, ts

# --- Smart generators constrained to the lyrics.json input space ---

# Non-negative, finite timestamps within a realistic song length. The integer
# branch deliberately produces duplicate start times to exercise the *stable*
# ascending sort (Req 5.3): equal-start lines must keep their input order.
_timestamps = st.one_of(
    st.floats(min_value=0.0, max_value=3600.0, allow_nan=False, allow_infinity=False),
    st.integers(min_value=0, max_value=10).map(float),
)

# A subtitle row: non-empty and free of newline / control / line-separator
# characters, so each cue stays on its own physical line and never introduces
# the blank line that delimits SubRip entries. Spaces are allowed.
_row = st.text(
    alphabet=st.characters(blacklist_categories=("Cs", "Cc", "Zl", "Zp")),
    min_size=1,
    max_size=20,
)


@st.composite
def _line(draw: st.DrawFn) -> dict:
    """Generate one lyrics.json line with start/end and a non-empty subtitle text."""
    start = draw(_timestamps)
    end = draw(_timestamps)
    line: dict[str, Any] = {"start": start, "end": end}
    if draw(st.booleans()):
        # Bottom-box rows branch: line1 non-empty, line2 possibly empty.
        line1 = draw(_row)
        line2 = draw(st.one_of(st.just(""), _row))
        line["line1"] = line1
        line["line2"] = line2
        line["text"] = (line1 + " " + line2).strip()
    else:
        # Fallback branch: only the full line text is present.
        line["text"] = draw(_row)
    return line


_lyrics = st.builds(
    lambda lines: {"version": 1, "source": "transcriber", "lines": lines},
    st.lists(_line(), max_size=10),
)


def _parse_srt(srt: str) -> list[dict]:
    """Parse SubRip text produced by ``lyrics_to_srt`` back into structured entries.

    Entries are separated by a blank line (``"\\n\\n"``); within an entry the
    first row is the sequential number, the second is ``start --> end``, and the
    remaining rows are the cue text. The generators guarantee cues never contain
    a blank line, so the blank-line split is unambiguous.
    """
    if srt == "":
        return []
    entries = []
    for block in srt.split("\n\n"):
        rows = block.split("\n")
        # The final entry carries a trailing newline; drop the empty tail it adds.
        while rows and rows[-1] == "":
            rows.pop()
        index = int(rows[0])
        start_str, sep, end_str = rows[1].partition(" --> ")
        assert sep == " --> ", f"malformed timestamp line: {rows[1]!r}"
        cue = "\n".join(rows[2:])
        entries.append({"index": index, "start": start_str, "end": end_str, "cue": cue})
    return entries


@settings(max_examples=100, deadline=None)
@given(lyrics=_lyrics)
def test_srt_faithfully_encodes_lyrics(lyrics: dict) -> None:
    srt = lyrics_to_srt(lyrics)
    parsed = _parse_srt(srt)

    lines = lyrics["lines"]
    # Mirror the exporter's stable ascending-start sort (Req 5.3); equal starts
    # therefore keep their input order in both orderings, so indices align.
    expected = sorted(lines, key=lambda line: line["start"])

    # Req 5.2: exactly one subtitle entry per Lyric_Line.
    assert len(parsed) == len(lines)

    # Req 5.3: entry numbers are the sequential range 1..N.
    assert [entry["index"] for entry in parsed] == list(range(1, len(lines) + 1))

    # Req 5.3: entries are ordered by ascending start time.
    expected_starts = [line["start"] for line in expected]
    assert expected_starts == sorted(expected_starts)

    # Req 5.2: parsing the SRT recovers the ascending-start input - each entry's
    # start/end equal the line's times under the SubRip format and the cue text
    # equals the line's displayed subtitle text.
    for entry, line in zip(parsed, expected):
        assert entry["start"] == ts(line["start"])
        assert entry["end"] == ts(line["end"])
        assert entry["cue"] == srt_text(line)
