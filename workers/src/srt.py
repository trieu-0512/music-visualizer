"""SRT Exporter: turn lyrics.json into a SubRip (.srt) subtitle string.

This module implements the design "SRT Exporter" section. ``lyrics_to_srt`` is a
pure function that converts the ``lyrics.json``-shaped dict produced by the
Lyric_Aligner (``src/align.py``) into SubRip subtitle text. The Audio_Worker
transcribe pipeline (task 6.7) calls ``lyrics_to_srt`` and writes the result to
``artifacts/lyrics.srt``.

That ``artifacts/lyrics.srt`` file is then served to users through the generic
artifact download endpoint ``GET /projects/:id/artifacts/:name`` in the Node
API_Service (task 4.4); this module itself performs no I/O (Req 5.4).

Requirements covered:
- 5.1 Produce Lyrics_Srt in SubRip format from the Lyrics_Json.
- 5.2 One subtitle entry per Lyric_Line with matching start and end times,
  formatted with SubRip ``HH:MM:SS,mmm`` timestamps.
- 5.3 Entries ordered by ascending start time with sequential entry numbers
  starting at 1.
"""

from __future__ import annotations

from typing import Any

__all__ = ["lyrics_to_srt", "ts", "srt_text"]


def lyrics_to_srt(lyrics: dict) -> str:
    """Render a ``lyrics.json``-shaped dict to a SubRip subtitle string (Req 5.1).

    Each Lyric_Line becomes exactly one subtitle entry (Req 5.2). Entries are
    sorted by ascending start time and numbered sequentially from 1 (Req 5.3).
    Every entry is ``number`` / ``start --> end`` (SubRip timestamps) / the
    displayed subtitle text, and entries are separated by a blank line as the
    SubRip format requires.
    """
    lines = sorted(lyrics.get("lines", []), key=lambda line: line["start"])  # Req 5.3 ascending
    entries = []
    for i, line in enumerate(lines, start=1):  # Req 5.3 sequential numbers from 1
        # Req 5.2 one entry per line with matching start/end and SubRip timestamps.
        entries.append(f"{i}\n{ts(line['start'])} --> {ts(line['end'])}\n{srt_text(line)}\n")
    return "\n".join(entries)


def ts(seconds: float) -> str:
    """Format a time in seconds as a SubRip ``HH:MM:SS,mmm`` timestamp (Req 5.2).

    The value is rounded to whole milliseconds and decomposed into hours,
    minutes, seconds, and milliseconds with zero padding, exactly as the design
    specifies.
    """
    ms = round(seconds * 1000)
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def srt_text(line: dict) -> str:
    """Build the displayed subtitle text for a line.

    The bottom-box rows ``line1`` and ``line2`` form the displayed subtitle,
    joined by a newline (blank rows dropped). When neither row is present the
    function falls back to the line's full ``text`` value.
    """
    line1 = line.get("line1")
    line2 = line.get("line2")
    if line1 is not None or line2 is not None:
        rows = [row for row in (line1 or "", line2 or "") if row != ""]
        if rows:
            return "\n".join(rows)
    return line.get("text", "")
