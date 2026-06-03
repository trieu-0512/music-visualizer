"""Unit sanity tests for the SRT Exporter (task 6.5).

Example-based checks of lyrics_to_srt/ts/srt_text. The SRT property-based test
(one entry per line, ascending order, sequential numbering) lives in task 6.6.
"""

from __future__ import annotations

from src.srt import lyrics_to_srt, srt_text, ts


def test_ts_formats_subrip_timestamp() -> None:
    # Req 5.2: HH:MM:SS,mmm SubRip timestamps.
    assert ts(0.0) == "00:00:00,000"
    assert ts(1.5) == "00:00:01,500"
    assert ts(61.25) == "00:01:01,250"
    assert ts(3661.001) == "01:01:01,001"


def test_ts_rounds_to_whole_milliseconds() -> None:
    assert ts(1.23456) == "00:00:01,235"
    assert ts(0.0004) == "00:00:00,000"


def test_lyrics_to_srt_one_entry_per_line_with_matching_times() -> None:
    # Req 5.2: one entry per Lyric_Line with matching start/end.
    lyrics = {
        "version": 1,
        "source": "transcriber",
        "lines": [
            {"start": 0.0, "end": 2.0, "text": "Hello world", "line1": "Hello", "line2": "world"},
            {"start": 2.0, "end": 4.0, "text": "Goodbye now", "line1": "Goodbye", "line2": "now"},
        ],
    }
    srt = lyrics_to_srt(lyrics)
    expected = (
        "1\n00:00:00,000 --> 00:00:02,000\nHello\nworld\n"
        "\n"
        "2\n00:00:02,000 --> 00:00:04,000\nGoodbye\nnow\n"
    )
    assert srt == expected


def test_lyrics_to_srt_sorts_and_numbers_sequentially() -> None:
    # Req 5.3: entries ordered by ascending start, numbered sequentially from 1.
    lyrics = {
        "lines": [
            {"start": 5.0, "end": 6.0, "text": "third", "line1": "third", "line2": ""},
            {"start": 1.0, "end": 2.0, "text": "first", "line1": "first", "line2": ""},
            {"start": 3.0, "end": 4.0, "text": "second", "line1": "second", "line2": ""},
        ]
    }
    srt = lyrics_to_srt(lyrics)
    lines = srt.splitlines()
    # Entry numbers appear in order 1, 2, 3 ...
    assert lines[0] == "1"
    assert "00:00:01,000 --> 00:00:02,000" in lines[1]
    assert lines[2] == "first"
    # ... and the texts follow ascending start time.
    assert srt.index("first") < srt.index("second") < srt.index("third")


def test_srt_text_joins_line1_line2() -> None:
    line = {"text": "full text", "line1": "row one", "line2": "row two"}
    assert srt_text(line) == "row one\nrow two"


def test_srt_text_single_row_when_line2_empty() -> None:
    line = {"text": "full text", "line1": "only row", "line2": ""}
    assert srt_text(line) == "only row"


def test_srt_text_falls_back_to_text_when_no_rows() -> None:
    # No line1/line2 at all -> use the full line text.
    assert srt_text({"text": "fallback text"}) == "fallback text"
    # Both rows empty -> still fall back to text.
    assert srt_text({"text": "fallback", "line1": "", "line2": ""}) == "fallback"


def test_lyrics_to_srt_empty_lines_returns_empty_string() -> None:
    assert lyrics_to_srt({"version": 1, "source": "transcriber", "lines": []}) == ""
    assert lyrics_to_srt({}) == ""
