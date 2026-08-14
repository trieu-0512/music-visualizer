"""Merge word-level SRT cues into canonical, sentence-level subtitle lines."""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


TIME_RE = re.compile(
    r"(?P<start>\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*"
    r"(?P<end>\d{2}:\d{2}:\d{2},\d{3})"
)
WORD_RE = re.compile(r"[A-Za-z0-9]+")


@dataclass(frozen=True)
class SrtCue:
    start: float
    end: float
    text: str


@dataclass(frozen=True)
class WordTiming:
    text: str
    start: float
    end: float


@dataclass(frozen=True)
class MergedLine:
    canonical: dict[str, Any]
    start: float
    end: float
    text: str
    words: tuple[WordTiming, ...]


class AlignmentError(ValueError):
    """Raised when word timing cannot be mapped to canonical lyric lines."""


def parse_time(value: str) -> float:
    hours, minutes, rest = value.split(":")
    seconds, milliseconds = rest.split(",")
    return (
        int(hours) * 3600
        + int(minutes) * 60
        + int(seconds)
        + int(milliseconds) / 1000
    )


def format_time(value: float) -> str:
    milliseconds = max(0, int(round(value * 1000)))
    hours, milliseconds = divmod(milliseconds, 3_600_000)
    minutes, milliseconds = divmod(milliseconds, 60_000)
    seconds, milliseconds = divmod(milliseconds, 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"


def words(text: str) -> list[str]:
    """Normalize punctuation away for matching and clean subtitle output."""
    return WORD_RE.findall(text)


def normalized_words(text: str) -> list[str]:
    return [word.lower() for word in words(text)]


def clean_text(text: str) -> str:
    return " ".join(words(text))


def parse_srt(path: Path) -> list[SrtCue]:
    cues: list[SrtCue] = []
    blocks = re.split(r"\n\s*\n", path.read_text(encoding="utf-8-sig").strip())
    for block in blocks:
        lines = block.splitlines()
        if len(lines) < 3:
            continue
        match = TIME_RE.search(lines[1])
        if not match:
            continue
        cues.append(
            SrtCue(
                start=parse_time(match["start"]),
                end=parse_time(match["end"]),
                text=" ".join(lines[2:]).strip(),
            )
        )
    if not cues:
        raise AlignmentError(f"No valid SRT cues found in {path}")
    return cues


def parse_canonical_lines(path: Path) -> list[dict[str, Any]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    lines = raw.get("lines") if isinstance(raw, dict) else None
    if not isinstance(lines, list) or not lines:
        raise AlignmentError(f"No canonical lyric lines found in {path}")
    result = [line for line in lines if isinstance(line, dict) and isinstance(line.get("text"), str)]
    if len(result) != len(lines):
        raise AlignmentError(f"Canonical lyric file contains malformed lines: {path}")
    return result


def align_cues_to_lines(
    cues: list[SrtCue], canonical_lines: list[dict[str, Any]]
) -> list[MergedLine]:
    token_records: list[tuple[str, SrtCue]] = []
    for cue in cues:
        token_records.extend((token, cue) for token in normalized_words(cue.text))

    expected_count = sum(len(normalized_words(line["text"])) for line in canonical_lines)
    if len(token_records) != expected_count:
        raise AlignmentError(
            f"Word count mismatch: SRT has {len(token_records)} words, "
            f"canonical lyrics have {expected_count}"
        )

    merged: list[MergedLine] = []
    cursor = 0
    for line_index, canonical in enumerate(canonical_lines):
        source_text = str(canonical["text"])
        expected = normalized_words(source_text)
        records = token_records[cursor : cursor + len(expected)]
        actual = [token for token, _cue in records]
        if actual != expected:
            raise AlignmentError(
                f"Line {line_index + 1} does not match word timing: "
                f"expected={expected!r} actual={actual!r}"
            )
        if not records:
            raise AlignmentError(f"Line {line_index + 1} is empty")
        display_words = words(source_text)
        word_timings = tuple(
            WordTiming(display_words[index], cue.start, cue.end)
            for index, (_token, cue) in enumerate(records)
        )
        merged.append(
            MergedLine(
                canonical=canonical,
                start=records[0][1].start,
                end=records[-1][1].end,
                text=clean_text(source_text),
                words=word_timings,
            )
        )
        cursor += len(records)

    if cursor != len(token_records):
        raise AlignmentError("Unused SRT words remain after canonical alignment")
    return merged


def write_srt(path: Path, merged: list[MergedLine]) -> None:
    blocks = []
    for index, line in enumerate(merged, start=1):
        blocks.append(
            "\n".join(
                [
                    str(index),
                    f"{format_time(line.start)} --> {format_time(line.end)}",
                    line.text,
                ]
            )
        )
    path.write_text("\n\n".join(blocks) + "\n", encoding="utf-8")


def build_lyrics_json(
    merged: list[MergedLine], mapping: dict[str, str]
) -> dict[str, Any]:
    lines: list[dict[str, Any]] = []
    for line in merged:
        canonical = line.canonical
        target = canonical.get("targetId")
        output: dict[str, Any] = {
            "start": line.start,
            "end": line.end,
            "text": line.text,
            "line1": line.text,
            "line2": "",
            "words": [word.__dict__ for word in line.words],
            "alignmentConfidence": 1,
        }
        for key in ("id", "objective"):
            if isinstance(canonical.get(key), str):
                output[key] = canonical[key]
        if isinstance(target, str) and re.fullmatch(r"[A-Z]", target):
            output.update(
                {
                    "targetId": target,
                    "letter": target,
                    "object": mapping.get(target, ""),
                    "objectRevealAt": line.start,
                }
            )
        lines.append(output)
    return {
        "version": 1,
        "source": "original+transcriber",
        "lines": lines,
        "alignment": {
            "mode": "canonical-order",
            "status": "clean",
            "canonicalLineCount": len(lines),
            "segmentCount": len(lines),
            "averageTextSimilarity": 1,
        },
    }


def build_preview_data(
    existing: dict[str, Any], merged: list[MergedLine], mapping: dict[str, str]
) -> dict[str, Any]:
    data = json.loads(json.dumps(existing))
    lines: list[dict[str, Any]] = []
    for index, line in enumerate(merged):
        canonical = line.canonical
        output: dict[str, Any] = {
            "index": index,
            "start": line.start,
            "end": line.end,
            "text": line.text,
            "line1": line.text,
            "line2": "",
            "letter": None,
            "object": "",
        }
        target = canonical.get("targetId")
        if isinstance(target, str) and re.fullmatch(r"[A-Z]", target):
            output["letter"] = target
            output["object"] = mapping.get(target, "")
        lines.append(output)
    data["lines"] = lines
    return data


def load_mapping(path: Path) -> dict[str, str]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    return {
        letter: str(entry["object"])
        for letter, entry in raw.get("letters", {}).items()
        if isinstance(letter, str) and isinstance(entry, dict) and isinstance(entry.get("object"), str)
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--srt", type=Path, required=True)
    parser.add_argument("--song-script", type=Path, required=True)
    parser.add_argument("--mapping", type=Path, required=True)
    parser.add_argument("--output-srt", type=Path, required=True)
    parser.add_argument("--output-lyrics-json", type=Path, required=True)
    parser.add_argument("--preview-data", type=Path)
    parser.add_argument("--output-preview-data", type=Path)
    args = parser.parse_args()

    cues = parse_srt(args.srt)
    canonical = parse_canonical_lines(args.song_script)
    merged = align_cues_to_lines(cues, canonical)
    mapping = load_mapping(args.mapping)

    args.output_srt.parent.mkdir(parents=True, exist_ok=True)
    args.output_lyrics_json.parent.mkdir(parents=True, exist_ok=True)
    write_srt(args.output_srt, merged)
    args.output_lyrics_json.write_text(
        json.dumps(build_lyrics_json(merged, mapping), indent=2), encoding="utf-8"
    )

    if args.preview_data and args.output_preview_data:
        existing = json.loads(args.preview_data.read_text(encoding="utf-8"))
        args.output_preview_data.parent.mkdir(parents=True, exist_ok=True)
        args.output_preview_data.write_text(
            json.dumps(build_preview_data(existing, merged, mapping), indent=2),
            encoding="utf-8",
        )

    print(
        json.dumps(
            {
                "srtCues": len(cues),
                "canonicalLines": len(canonical),
                "mergedLines": len(merged),
                "firstEnd": merged[0].end,
                "lastEnd": merged[-1].end,
            }
        )
    )


if __name__ == "__main__":
    main()
