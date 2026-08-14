"""Create a Remotion ABC preview manifest from an authored LRC and asset manifest."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


LRC_RE = re.compile(r"\[(?P<minutes>\d+):(?P<seconds>\d{2}(?:\.\d+)?)\](?P<text>.*)$")


def parse_lrc(path: Path) -> list[tuple[float, str]]:
    entries: list[tuple[float, str]] = []
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        match = LRC_RE.match(raw_line.strip())
        if not match:
            continue
        timestamp = int(match["minutes"]) * 60 + float(match["seconds"])
        entries.append((timestamp, match["text"].strip()))
    return entries


def detect_target(text: str, mapping: dict[str, str]) -> tuple[str, str] | None:
    matches = _target_matches(text, mapping)
    if not matches:
        return None
    _, letter, object_name = min(matches, key=lambda match: match[0])
    return letter, object_name


def _target_matches(text: str, mapping: dict[str, str]) -> list[tuple[int, str, str]]:
    matches: list[tuple[int, str, str]] = []
    for letter, object_name in mapping.items():
        object_pattern = re.escape(object_name)
        letter_first = re.compile(
            rf"\b{re.escape(letter)}\s*(?:is|\.{{3}}|\?|[-:])\s*{object_pattern}\b",
            re.IGNORECASE,
        )
        object_first = re.compile(
            rf"\b{object_pattern}\s*[-:,]\s*(?:that's\s+)?{re.escape(letter)}\b",
            re.IGNORECASE,
        )
        matches.extend((match.start(), letter, object_name) for match in letter_first.finditer(text))
        matches.extend((match.start(), letter, object_name) for match in object_first.finditer(text))
    return sorted(matches, key=lambda match: match[0])


def find_target_events(
    entries: list[tuple[float, str]],
    mapping: dict[str, str],
) -> list[tuple[float, str, str]]:
    """Find letter/object phrases even when an LRC timestamp splits them."""
    text_parts: list[str] = []
    offsets: list[int] = []
    cursor = 0
    for _, text in entries:
        offsets.append(cursor)
        text_parts.append(text)
        cursor += len(text) + 1
    full_text = " ".join(text_parts)
    matches = _target_matches(full_text, mapping)

    events: list[tuple[float, str, str]] = []
    seen: set[tuple[float, str]] = set()
    for position, letter, object_name in matches:
        entry_index = 0
        for index, offset in enumerate(offsets):
            if offset <= position:
                entry_index = index
            else:
                break
        timestamp = entries[entry_index][0]
        key = (timestamp, letter)
        if key in seen:
            continue
        seen.add(key)
        events.append((timestamp, letter, object_name))
    return events


def split_lyric(text: str) -> tuple[str, str]:
    rows = [row.strip() for row in text.split("|") if row.strip()]
    if len(rows) > 1:
        return rows[0], " | ".join(rows[1:])
    if not rows:
        return "", ""
    return rows[0], ""


def create_preview_data(
    *,
    manifest_path: Path,
    lrc_path: Path,
    preview_dir: Path,
    background: str,
    background_render: str | None,
    song_logo: str,
    audio: str,
    audio_duration: float,
) -> dict[str, object]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    mapping = {
        letter: entry["objectName"]
        for letter, entry in manifest["letters"].items()
    }
    timestamps = parse_lrc(lrc_path)
    lines: list[dict[str, object]] = []
    events_by_time: dict[float, list[tuple[str, str]]] = {}
    for timestamp, letter, object_name in find_target_events(timestamps, mapping):
        events_by_time.setdefault(timestamp, []).append((letter, object_name))

    for index, (start, text) in enumerate(timestamps):
        next_start = timestamps[index + 1][0] if index + 1 < len(timestamps) else audio_duration
        line1, line2 = split_lyric(text)
        target_events = events_by_time.get(start, [])
        event_count = max(1, len(target_events))
        for event_index in range(event_count):
            letter_object = target_events[event_index] if target_events else None
            event_start = start
            if event_index > 0:
                event_start = min(start + event_index * 0.12, max(start, next_start - 0.05))
            lines.append(
                {
                    "index": len(lines),
                    "start": event_start,
                    "end": max(event_start + 0.05, next_start),
                    "text": text,
                    "line1": line1,
                    "line2": line2,
                    "letter": letter_object[0] if letter_object else None,
                    "object": letter_object[1] if letter_object else "",
                }
            )

    letters: dict[str, object] = {}
    for letter, entry in manifest["letters"].items():
        letters[letter] = {
            "letter": entry["letter"],
            "object": entry["object"],
            "objectName": entry["objectName"],
        }

    return {
        "metadata": {
            "songCode": "0001",
            "title": "Ocean Letter Splash",
            "artist": "ABC Kids Music",
        },
        "assets": {
            "background": background,
            **({"backgroundRender": background_render} if background_render else {}),
            "songLogo": song_logo,
            "audio": audio,
        },
        "letters": letters,
        "lines": lines,
        "layout": {
            "canvasWidth": 1920,
            "canvasHeight": 1080,
            "assetHeight": 520,
            "assetY": 520,
            "letterX": 565,
            "objectX": 1325,
            "letterScale": 1.02,
            "objectScale": 0.92,
            "objectLabelFont": 82,
            "objectLabelGap": 14,
            "bgBlur": 0,
            "lyricBottom": 48,
            "lyricWidth": 1740,
            "lyricHeight": 220,
            "lyricFont": 58,
            "infoTop": 24,
            "infoLeft": 24,
            "logoTop": 22,
            "logoRight": 34,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("lrc", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--audio-duration", type=float, required=True)
    args = parser.parse_args()
    preview_dir = args.output.parent
    model_background = preview_dir.parent / "27_id_0001background_type_s1_4k_model.png"
    data = create_preview_data(
        manifest_path=args.manifest,
        lrc_path=args.lrc,
        preview_dir=preview_dir,
        background="../27_id_0001background_type_s1.png",
        background_render=(
            "../27_id_0001background_type_s1_4k_model.png"
            if model_background.exists()
            else None
        ),
        song_logo="../28_id_0001song_logo_type_s1.png",
        audio="../../Ocean Letter Splash.mp3",
        audio_duration=args.audio_duration,
    )
    args.output.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(args.output), "lines": len(data["lines"])}))


if __name__ == "__main__":
    main()
