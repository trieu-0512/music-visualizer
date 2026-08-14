from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from src.align import AlignmentMismatchError
from src.lrc_align import build_lyrics_from_lrc, parse_lrc, normalized_tokens


def _script(*texts: str) -> dict:
    return {
        "version": 1,
        "mappingRevision": 1,
        "lines": [
            {
                "id": f"line-{index}",
                "text": text,
                "objective": "narration" if index == 0 else "lexical-semantic",
                "targetId": "A" if index == 1 else None,
                "objectReveal": "line-start",
            }
            for index, text in enumerate(texts)
        ],
    }


def test_parse_lrc_supports_timestamps_and_preserves_cue_text() -> None:
    cues = parse_lrc("[00:00.00]Hello world\n[01:02.34]Last line\n")

    assert [(cue.start, cue.text) for cue in cues] == [
        (0.0, "Hello world"),
        (62.34, "Last line"),
    ]


def test_lrc_alignment_uses_canonical_script_text_and_distributes_word_timing() -> None:
    lrc = "[00:00.00]Hello world\n[00:02.00]A is Apple\n[00:05.00]B boat\n"
    script = _script("Hello world", "A is Apple", "B boat")
    script["lines"][1]["objectReveal"] = "target-word"
    mapping = {
        "revision": 1,
        "letters": {"A": {"object": "Apple"}, "B": {"object": "Boat"}},
    }

    result = build_lyrics_from_lrc(
        lrc,
        script,
        mapping,
        audio_duration=6.0,
    )

    assert result["source"] == "original+lrc"
    assert result["alignment"] == {
        "mode": "lrc-canonical",
        "status": "clean",
        "canonicalLineCount": 3,
        "segmentCount": 3,
        "averageTextSimilarity": 1.0,
    }
    assert [line["text"] for line in result["lines"]] == [
        "Hello world",
        "A is Apple",
        "B boat",
    ]
    assert result["lines"][1]["object"] == "Apple"
    assert result["lines"][1]["objectRevealAt"] == pytest.approx(4.0)
    for line in result["lines"]:
        assert line["start"] <= line["end"]
        assert line["words"]
        assert all(line["start"] <= word["start"] <= word["end"] <= line["end"] for word in line["words"])


def test_lrc_alignment_fails_closed_when_normalized_tokens_differ() -> None:
    with pytest.raises(AlignmentMismatchError, match="token mismatch"):
        build_lyrics_from_lrc(
            "[00:00.00]Hello wrong\n",
            _script("Hello world"),
            {"revision": 1, "letters": {}},
            audio_duration=1.0,
        )


def test_real_0001_lrc_matches_authored_script_exactly() -> None:
    root = Path(__file__).resolve().parents[2] / "abc-song" / "0001" / "authoring"
    lrc = (root / "e0c06061-718e-4554-9e2e-0ef349b5c367.formatted.lrc").read_text(encoding="utf-8-sig")
    script = json.loads((root / "song-script.json").read_text(encoding="utf-8"))
    lrc_tokens = normalized_tokens(" ".join(cue.text for cue in parse_lrc(lrc)))
    script_tokens = normalized_tokens(" ".join(line["text"] for line in script["lines"]))

    assert len(script["lines"]) == 81
    assert len(parse_lrc(lrc)) == 191
    assert lrc_tokens == script_tokens
