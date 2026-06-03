"""Unit sanity tests for the Lyric_Aligner (task 6.2).

These are example-based checks of build_lyrics/align_text_to_timing and the
helper functions. The property-based tests for source selection (Property 3)
and lyrics.json well-formedness (Property 4) live in tasks 6.3 and 6.4.
"""

from __future__ import annotations

from src.align import (
    OriginalLyrics,
    align_text_to_timing,
    build_lyrics,
    clamp_interval,
    clamp_words,
    pair_by_order,
    parse_original_lyrics,
    pick_letter,
    seg_to_line,
    split_two_lines,
)


def test_build_lyrics_transcriber_only_uses_segment_text_and_timing() -> None:
    # Req 4.2: with no original lyrics, text and timing come from the transcriber.
    whisperx = {
        "segments": [
            {"start": 0.0, "end": 2.0, "text": "Hello world"},
            {"start": 2.0, "end": 4.0, "text": "Goodbye now"},
        ]
    }
    out = build_lyrics(whisperx, None)

    assert out["version"] == 1
    assert out["source"] == "transcriber"
    assert [line["text"] for line in out["lines"]] == ["Hello world", "Goodbye now"]
    assert out["lines"][0]["start"] == 0.0
    assert out["lines"][0]["end"] == 2.0


def test_build_lyrics_original_present_uses_original_text_transcriber_timing() -> None:
    # Req 4.1: text from original lyrics, timing from transcriber segments.
    whisperx = {
        "segments": [
            {"start": 1.0, "end": 3.0, "text": "hilo wurld"},
            {"start": 3.0, "end": 5.0, "text": "gudbye now"},
        ]
    }
    original = OriginalLyrics(lines=["Hello world", "Goodbye now"])
    out = build_lyrics(whisperx, original)

    assert out["source"] == "original+transcriber"
    assert [line["text"] for line in out["lines"]] == ["Hello world", "Goodbye now"]
    # Timing still derives from the transcriber segments.
    assert (out["lines"][0]["start"], out["lines"][0]["end"]) == (1.0, 3.0)
    assert (out["lines"][1]["start"], out["lines"][1]["end"]) == (3.0, 5.0)


def test_build_lyrics_orders_lines_by_ascending_start() -> None:
    # Req 4.6: lines ordered by ascending start regardless of input order.
    whisperx = {
        "segments": [
            {"start": 5.0, "end": 6.0, "text": "third"},
            {"start": 1.0, "end": 2.0, "text": "first"},
            {"start": 3.0, "end": 4.0, "text": "second"},
        ]
    }
    out = build_lyrics(whisperx, None)
    starts = [line["start"] for line in out["lines"]]
    assert starts == sorted(starts)
    assert [line["text"] for line in out["lines"]] == ["first", "second", "third"]


def test_build_lyrics_clamps_inverted_and_negative_intervals() -> None:
    # Req 4.7: start <= end, and the schema requires non-negative timestamps.
    whisperx = {
        "segments": [
            {"start": 5.0, "end": 2.0, "text": "inverted"},
            {"start": -1.0, "end": -0.5, "text": "negative"},
        ]
    }
    out = build_lyrics(whisperx, None)
    for line in out["lines"]:
        assert line["start"] >= 0.0
        assert line["start"] <= line["end"]


def test_build_lyrics_includes_line1_line2_and_letter() -> None:
    # Req 4.4 + letter: every line has line1/line2; letter is the first A-Z upper.
    whisperx = {"segments": [{"start": 0.0, "end": 2.0, "text": "twinkle little star"}]}
    line = build_lyrics(whisperx, None)["lines"][0]
    assert "line1" in line and "line2" in line
    assert line["line1"] == "twinkle little"
    assert line["line2"] == "star"
    assert line["letter"] == "T"


def test_build_lyrics_word_timing_when_counts_match() -> None:
    # Req 4.5: word timing included when segment words match the token count.
    whisperx = {
        "segments": [
            {
                "start": 0.0,
                "end": 3.0,
                "text": "alpha beta",
                "words": [
                    {"text": "alpha", "start": 0.0, "end": 1.0},
                    {"text": "beta", "start": 1.0, "end": 3.0},
                ],
            }
        ]
    }
    line = build_lyrics(whisperx, None)["lines"][0]
    assert [w["text"] for w in line["words"]] == ["alpha", "beta"]
    starts = [w["start"] for w in line["words"]]
    assert starts == sorted(starts)
    for w in line["words"]:
        assert line["start"] <= w["start"] <= w["end"] <= line["end"]


def test_build_lyrics_omits_words_when_count_mismatch() -> None:
    # Req 4.5: no word timing attached when the counts do not line up.
    whisperx = {
        "segments": [
            {
                "start": 0.0,
                "end": 3.0,
                "text": "alpha beta gamma",
                "words": [
                    {"text": "alpha", "start": 0.0, "end": 1.0},
                    {"text": "beta", "start": 1.0, "end": 3.0},
                ],
            }
        ]
    }
    line = build_lyrics(whisperx, None)["lines"][0]
    assert "words" not in line


def test_align_text_to_timing_handles_count_mismatch() -> None:
    # pair_by_order is robust: pairs as many as both sides provide.
    segments = [
        {"start": 0.0, "end": 1.0, "text": "a"},
        {"start": 1.0, "end": 2.0, "text": "b"},
    ]
    out = align_text_to_timing(["only one"], segments)
    assert len(out) == 1
    assert out[0]["text"] == "only one"


def test_build_lyrics_empty_segments() -> None:
    assert build_lyrics({"segments": []}, None) == {
        "version": 1,
        "source": "transcriber",
        "lines": [],
    }
    assert build_lyrics({}, None)["lines"] == []


def test_split_two_lines_examples() -> None:
    assert split_two_lines("") == ("", "")
    assert split_two_lines("solo") == ("solo", "")
    assert split_two_lines("one two") == ("one", "two")
    assert split_two_lines("a b c") == ("a b", "c")
    assert split_two_lines("a b c d") == ("a b", "c d")


def test_pick_letter_examples() -> None:
    assert pick_letter("hello") == "H"
    assert pick_letter("123 abc") == "A"
    assert pick_letter("!!!") is None
    assert pick_letter("") is None


def test_clamp_interval_examples() -> None:
    assert clamp_interval(1.0, 2.0) == (1.0, 2.0)
    assert clamp_interval(5.0, 2.0) == (5.0, 5.0)
    assert clamp_interval(-1.0, -0.5) == (0.0, 0.0)


def test_clamp_words_orders_and_bounds() -> None:
    words = [
        {"text": "a", "start": 1.0, "end": 0.5},  # inverted
        {"text": "b", "start": 0.0, "end": 1.0},  # earlier than previous start
    ]
    out = clamp_words(words, line_start=0.0, line_end=2.0)
    starts = [w["start"] for w in out]
    assert starts == sorted(starts)
    for w in out:
        assert 0.0 <= w["start"] <= w["end"] <= 2.0


def test_pair_by_order_zips_to_shortest() -> None:
    assert pair_by_order(["x", "y", "z"], [{"start": 0, "end": 1, "text": "t"}]) == [
        ("x", {"start": 0, "end": 1, "text": "t"})
    ]


def test_seg_to_line_keeps_segment_text() -> None:
    line = seg_to_line({"start": 0.0, "end": 1.0, "text": "from stt"})
    assert line["text"] == "from stt"
    assert (line["start"], line["end"]) == (0.0, 1.0)


def test_parse_original_lyrics_txt_and_json() -> None:
    txt = parse_original_lyrics("Hello\n\n World \n", is_json=False)
    assert txt.lines == ["Hello", "World"]

    arr = parse_original_lyrics('["a", "b"]', is_json=True)
    assert arr.lines == ["a", "b"]

    obj = parse_original_lyrics('{"lines": ["x", "y"]}', is_json=True)
    assert obj.lines == ["x", "y"]
