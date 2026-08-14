"""Align a canonical song script to an LRC timing file without ASR.

The LRC is treated as a timed token stream. Display text and learning metadata
come from the authored ``song-script.json``; timestamps are distributed from
the LRC cue intervals. A normalized token mismatch fails closed so a plausible
but incorrect lyric timeline can never be emitted silently.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Any

from src.align import AlignmentMismatchError, resolve_object_reveal_at, split_two_lines

__all__ = [
    "LrcCue",
    "build_lyrics_from_lrc",
    "normalized_tokens",
    "parse_lrc",
]


_TIMESTAMP_RE = re.compile(r"\[(?P<minutes>\d+):(?P<seconds>\d{2}(?:\.\d{1,3})?)\]")
_TOKEN_RE = re.compile(r"[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?")


@dataclass(frozen=True)
class LrcCue:
    """One timed LRC cue after metadata and non-timestamp lines are removed."""

    start: float
    text: str


@dataclass(frozen=True)
class _TimedToken:
    text: str
    start: float
    end: float


def normalized_tokens(text: str) -> list[str]:
    """Return the comparison token stream used for LRC/script matching."""

    return [token.lower() for token in _TOKEN_RE.findall(text)]


def parse_lrc(raw: str) -> list[LrcCue]:
    """Parse numeric ``[mm:ss.xx]`` tags and preserve their following text."""

    cues: list[LrcCue] = []
    for raw_line in raw.splitlines():
        matches = list(_TIMESTAMP_RE.finditer(raw_line))
        if not matches:
            continue
        text = raw_line[matches[-1].end() :].strip()
        for match in matches:
            minutes = int(match.group("minutes"))
            seconds = float(match.group("seconds"))
            cues.append(LrcCue(start=minutes * 60.0 + seconds, text=text))
    cues.sort(key=lambda cue: cue.start)
    if not cues:
        raise AlignmentMismatchError("LRC contains no numeric timestamp cues")
    return cues


def build_lyrics_from_lrc(
    raw_lrc: str,
    song_script: dict[str, Any],
    learning_map: dict[str, Any] | None,
    *,
    audio_duration: float | None = None,
) -> dict[str, Any]:
    """Build a schema-shaped lyrics artifact from LRC timing + canonical text."""

    script_lines = list(song_script.get("lines") or [])
    if not script_lines:
        raise AlignmentMismatchError("song-script.json has no canonical lines")
    if learning_map is not None and song_script.get("mappingRevision") != learning_map.get("revision"):
        raise AlignmentMismatchError(
            "song-script mappingRevision does not match locked mapping revision"
        )

    cues = parse_lrc(raw_lrc)
    lrc_tokens, timed_tokens = _timed_lrc_tokens(cues, audio_duration)
    canonical_tokens = normalized_tokens(" ".join(str(line.get("text", "")) for line in script_lines))
    if lrc_tokens != canonical_tokens:
        mismatch = _first_token_mismatch(lrc_tokens, canonical_tokens)
        raise AlignmentMismatchError(
            "LRC/script token mismatch at index "
            f"{mismatch}: lrc={_token_at(lrc_tokens, mismatch)!r}, "
            f"script={_token_at(canonical_tokens, mismatch)!r}"
        )

    lines: list[dict[str, Any]] = []
    cursor = 0
    for script_line in script_lines:
        text = str(script_line.get("text", "")).strip()
        line_tokens = normalized_tokens(text)
        if not line_tokens:
            raise AlignmentMismatchError("canonical lyric line has no comparable tokens")
        token_slice = timed_tokens[cursor : cursor + len(line_tokens)]
        if len(token_slice) != len(line_tokens):
            raise AlignmentMismatchError("LRC timing ended before the canonical script ended")
        cursor += len(line_tokens)
        line_start = token_slice[0].start
        line_end = token_slice[-1].end
        words = _display_word_timings(text, token_slice, line_start, line_end)
        line: dict[str, Any] = {
            "start": line_start,
            "end": max(line_start, line_end),
            "text": text,
            "line1": split_two_lines(text)[0],
            "line2": split_two_lines(text)[1],
            "words": words,
            "alignmentConfidence": 1.0,
        }
        if isinstance(script_line.get("id"), str):
            line["id"] = script_line["id"]
        if isinstance(script_line.get("objective"), str):
            line["objective"] = script_line["objective"]
        if isinstance(script_line.get("targetId"), str):
            line["targetId"] = script_line["targetId"]
        letter = line.get("targetId")
        if isinstance(letter, str) and learning_map is not None:
            entry = (learning_map.get("letters") or {}).get(letter)
            if isinstance(entry, dict) and isinstance(entry.get("object"), str):
                object_name = entry["object"].strip()
                if object_name:
                    line["letter"] = letter
                    line["object"] = object_name
                    policy = script_line.get("objectReveal")
                    if not isinstance(policy, str):
                        policy = "target-word" if line.get("objective") == "retrieval-action" else "line-start"
                    line["objectRevealAt"] = resolve_object_reveal_at(
                        line,
                        {"words": words},
                        object_name,
                        policy,
                    )
        lines.append(line)

    if cursor != len(timed_tokens):
        raise AlignmentMismatchError("LRC contains tokens after the canonical script ended")

    return {
        "version": 1,
        "source": "original+lrc",
        "lines": lines,
        "alignment": {
            "mode": "lrc-canonical",
            "status": "clean",
            "canonicalLineCount": len(script_lines),
            "segmentCount": len(cues),
            "averageTextSimilarity": 1.0,
        },
    }


def _timed_lrc_tokens(
    cues: list[LrcCue],
    audio_duration: float | None,
) -> tuple[list[str], list[_TimedToken]]:
    last_start = cues[-1].start
    tail = audio_duration if audio_duration is not None else last_start + 1.0
    if not math.isfinite(tail) or tail <= last_start:
        tail = last_start + 1.0

    tokens: list[str] = []
    timed: list[_TimedToken] = []
    for index, cue in enumerate(cues):
        next_start = cues[index + 1].start if index + 1 < len(cues) else tail
        if next_start < cue.start:
            raise AlignmentMismatchError("LRC cues are not ordered by timestamp")
        cue_tokens = normalized_tokens(cue.text)
        if not cue_tokens:
            continue
        span = max(0.0, next_start - cue.start)
        for token_index, token in enumerate(cue_tokens):
            start = cue.start + span * token_index / len(cue_tokens)
            end = cue.start + span * (token_index + 1) / len(cue_tokens)
            timed.append(_TimedToken(text=token, start=start, end=max(start, end)))
            tokens.append(token)
    return tokens, timed


def _display_word_timings(
    text: str,
    token_slice: list[_TimedToken],
    line_start: float,
    line_end: float,
) -> list[dict[str, Any]]:
    """Map canonical whitespace words to normalized timings, including punctuation."""

    words: list[dict[str, Any]] = []
    cursor = 0
    for display_word in text.split():
        parts = normalized_tokens(display_word)
        if parts:
            start = token_slice[cursor].start
            end = token_slice[cursor + len(parts) - 1].end
            cursor += len(parts)
        else:
            previous_end = words[-1]["end"] if words else line_start
            next_start = token_slice[cursor].start if cursor < len(token_slice) else line_end
            start = min(max(previous_end, line_start), line_end)
            end = min(max(next_start, start), line_end)
        words.append({"text": display_word, "start": start, "end": end})
    if cursor != len(token_slice):
        raise AlignmentMismatchError("canonical display words could not consume LRC timing")
    return words


def _first_token_mismatch(left: list[str], right: list[str]) -> int:
    limit = min(len(left), len(right))
    for index in range(limit):
        if left[index] != right[index]:
            return index
    return limit


def _token_at(tokens: list[str], index: int) -> str | None:
    return tokens[index] if index < len(tokens) else None
