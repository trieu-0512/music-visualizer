"""Lyric_Aligner: turn transcription + optional original lyrics into lyrics.json.

This module is the algorithmic heart of the Audio_Worker (design "Lyric_Aligner").
``build_lyrics`` is a pure function that merges WhisperX transcription timing with
optional ``Original_Lyrics`` display text and emits a dict shaped like the shared
``lyrics.json`` schema (``shared/src/schema/lyrics.schema.json``).

Requirements covered:
- 4.1 When original lyrics are present, timing comes from the transcriber and
  display text comes from the original lyrics.
- 4.2 When original lyrics are absent, timing and text come from the transcriber.
- 4.3 Each line has start, end, and text.
- 4.4 Each line has line1 and line2 (bottom lyric box rows; line2 may be "").
- 4.5 When word-level timing is available, words are included per line.
- 4.6 Lines are ordered by ascending start time.
- 4.7 Every line has start <= end.

Documented lyrics.json invariants (design): lines ordered by ascending start;
each line start <= end; words (when present) ordered by ascending start and within
[line.start, line.end]; line1/line2 always present (line2 may be "").
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any, Optional

__all__ = [
    "OriginalLyrics",
    "AlignmentMismatchError",
    "build_lyrics",
    "align_text_to_timing",
    "seg_to_line",
    "pair_by_order",
    "clamp_interval",
    "clamp_words",
    "split_two_lines",
    "pick_letter",
    "parse_original_lyrics",
    "load_original_lyrics",
    "load_learning_map",
    "load_song_script",
]


@dataclass(frozen=True)
class OriginalLyrics:
    """User-supplied canonical lyric text, one display line per entry (Req 4.1)."""

    lines: list[str]


class AlignmentMismatchError(ValueError):
    """Raised when canonical lyrics cannot be paired safely with ASR segments."""


def build_lyrics(
    whisperx: dict,
    original: Optional[OriginalLyrics],
    learning_map: Optional[dict] = None,
    song_script: Optional[dict] = None,
) -> dict:
    """Produce a lyrics.json-shaped dict from transcription + optional originals.

    When ``original`` is ``None`` the display text and timing both come from the
    transcriber (Req 4.2, source ``"transcriber"``). When ``original`` is present
    the timing comes from the transcriber segments while the display text comes
    from the original lyric lines (Req 4.1, source ``"original+transcriber"``).
    """
    segments = whisperx.get("segments") or []

    script_lines: list[dict] | None = None
    if song_script is not None:
        script_lines = list(song_script.get("lines") or [])
        if learning_map is None:
            raise AlignmentMismatchError("authoring/song-script.json requires authoring/mapping.json")
        if song_script.get("mappingRevision") != learning_map.get("revision"):
            raise AlignmentMismatchError(
                "song-script mappingRevision does not match locked mapping revision; regenerate dependent authoring files"
            )
        canonical = [str(item.get("text", "")).strip() for item in script_lines]
        lines = align_text_to_timing(canonical, segments)
        source = "original+transcriber"
    elif original is None:
        lines = [seg_to_line(s) for s in segments]
        source = "transcriber"
    else:
        lines = align_text_to_timing(original.lines, segments)
        source = "original+transcriber"

    lines.sort(key=lambda line: line["start"])  # Req 4.6 ascending start
    for index, line in enumerate(lines):
        line["start"], line["end"] = clamp_interval(line["start"], line["end"])  # Req 4.7
        line["line1"], line["line2"] = split_two_lines(line["text"])  # Req 4.4
        script_line = script_lines[index] if script_lines is not None else None
        if script_line is not None:
            line["id"] = str(script_line["id"])
            line["objective"] = str(script_line["objective"])
            target_id = script_line.get("targetId")
            letter = str(target_id) if isinstance(target_id, str) else None
            if letter is not None:
                line["targetId"] = letter
        else:
            letter = pick_letter(line["text"])

        if letter is not None:
            line["letter"] = letter
            if learning_map is not None:
                entry = (learning_map.get("letters") or {}).get(letter)
                if isinstance(entry, dict) and isinstance(entry.get("object"), str):
                    object_name = entry["object"].strip()
                    if object_name:
                        line["object"] = object_name
                        if script_line is not None:
                            reveal_policy = script_line.get("objectReveal")
                            if not isinstance(reveal_policy, str):
                                reveal_policy = (
                                    "target-word"
                                    if script_line.get("objective") == "retrieval-action"
                                    else "line-start"
                                )
                            line["objectRevealAt"] = resolve_object_reveal_at(
                                line, segments[index], object_name, reveal_policy
                            )
        if "words" in line:  # Req 4.5 keep word timing within the (clamped) line bounds
            line["words"] = clamp_words(line["words"], line["start"], line["end"])

    result = {"version": 1, "source": source, "lines": lines}
    if source == "transcriber":
        result["alignment"] = {
            "mode": "asr-only",
            "status": "clean",
            "canonicalLineCount": len(lines),
            "segmentCount": len(segments),
        }
    else:
        similarities = [float(line.get("alignmentConfidence", 0.0)) for line in lines]
        average = sum(similarities) / len(similarities) if similarities else 0.0
        status = "clean" if average >= 0.5 and all(score >= 0.2 for score in similarities) else "review-required"
        result["alignment"] = {
            "mode": "canonical-order",
            "status": status,
            "canonicalLineCount": len(script_lines) if script_lines is not None else len(original.lines if original else []),
            "segmentCount": len(segments),
            "averageTextSimilarity": round(average, 4),
        }
    return result


def align_text_to_timing(original_lines: list[str], segments: list[dict]) -> list[dict]:
    """Map each original display line onto transcriber timing in order (Req 4.1).

    Word timing is attached only when the segment exposes words and their count
    matches the number of whitespace-separated tokens in the display text, so the
    per-word coloring lines up with the displayed words (Req 4.5).
    """
    paired = pair_by_order(original_lines, segments)
    out: list[dict] = []
    for text, seg in paired:
        line: dict[str, Any] = {
            "start": seg["start"],
            "end": seg["end"],
            "text": text,
            "alignmentConfidence": text_similarity(text, str(seg.get("text", ""))),
        }
        tokens = text.split()
        words = seg.get("words")
        if words and len(words) == len(tokens):
            line["words"] = [
                {"text": tok, "start": w["start"], "end": w["end"]}  # Req 4.5
                for tok, w in zip(tokens, words)
            ]
        out.append(line)
    return out


def seg_to_line(seg: dict) -> dict:
    """Build a line from a transcriber segment: timing and text both from STT (Req 4.2)."""
    text = seg.get("text", "")
    line: dict[str, Any] = {
        "start": seg["start"],
        "end": seg["end"],
        "text": text,
    }
    tokens = text.split()
    words = seg.get("words")
    if words and len(words) == len(tokens):
        line["words"] = [
            {"text": tok, "start": w["start"], "end": w["end"]}  # Req 4.5
            for tok, w in zip(tokens, words)
        ]
    return line


def pair_by_order(original_lines: list[str], segments: list[dict]) -> list[tuple[str, dict]]:
    """Pair canonical lines with ASR segments only when counts agree.

    The former zip-to-shortest behavior silently deleted canonical lines or ASR
    segments. V2 fails closed instead: a count mismatch requires a stronger
    forced/semantic alignment strategy or human review, never a plausible-looking
    but incomplete timeline.
    """
    if len(original_lines) != len(segments):
        raise AlignmentMismatchError(
            f"canonical lyric line count ({len(original_lines)}) != ASR segment count ({len(segments)}); "
            "refusing positional truncation"
        )
    return list(zip(original_lines, segments))


def _normalized_text(text: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", text.lower()))


def text_similarity(expected: str, observed: str) -> float:
    """Return a deterministic 0..1 text agreement proxy for alignment QC."""
    left = _normalized_text(expected)
    right = _normalized_text(observed)
    if not left and not right:
        return 1.0
    if not left or not right:
        return 0.0
    return round(SequenceMatcher(None, left, right).ratio(), 4)


def resolve_object_reveal_at(line: dict, segment: dict, object_name: str, policy: str) -> float:
    """Resolve when the separated object foreground may appear in the final scene."""
    start = float(line["start"])
    end = float(line["end"])
    if policy == "line-start":
        return start
    if policy == "line-end":
        return end
    if policy == "none":
        return end + 0.001

    # target-word: use aligned ASR word onset when the object token is found.
    object_tokens = _normalized_text(object_name).split()
    target = object_tokens[0] if object_tokens else ""
    for word in segment.get("words") or []:
        observed = _normalized_text(str(word.get("text", word.get("word", ""))))
        if target and observed == target and isinstance(word.get("start"), (int, float)):
            return min(end, max(start, float(word["start"])))

    # Word alignment can be absent on sung material. Use a conservative fallback
    # that preserves an audible/visible retrieval gap rather than spoiling at cue onset.
    return min(end, start + max(0.45, (end - start) * 0.3))


def clamp_interval(start: float, end: float) -> tuple[float, float]:
    """Clamp a line interval so 0 <= start <= end (Req 4.7).

    Negative timestamps are floored at 0 to satisfy the shared schema, and the end
    is pulled up to the start when it would otherwise precede it. Flooring at 0 is
    monotonic, so it preserves the ascending-start ordering established earlier.
    """
    s = max(0.0, float(start))
    e = max(s, float(end))
    return s, e


def clamp_words(words: list[dict], line_start: float, line_end: float) -> list[dict]:
    """Normalize word timing into ascending order within the line bounds.

    Each word's ``start``/``end`` is clamped into ``[line_start, line_end]`` and
    each ``start`` is held at or above the previous word's ``start`` so the word
    timing is ordered by ascending start and contained in the line (design
    lyrics.json invariants, Req 4.5). For already well-formed transcriber output
    this is a no-op and leaves the real timing untouched.
    """
    out: list[dict] = []
    lower = line_start
    for w in words:
        ws = min(max(float(w["start"]), lower), line_end)
        we = min(max(float(w["end"]), ws), line_end)
        out.append({"text": w["text"], "start": ws, "end": we})
        lower = ws
    return out


def split_two_lines(text: str) -> tuple[str, str]:
    """Split a line's text into the two bottom-box display rows (Req 4.4).

    Tokens are split roughly in half with the extra token going to ``line1``;
    ``line2`` is ``""`` for zero- or single-token lines. The two rows together
    reproduce the line's tokens in order.
    """
    tokens = text.split()
    if len(tokens) <= 1:
        return (" ".join(tokens), "")
    mid = (len(tokens) + 1) // 2  # ceil: line1 takes the extra token on odd counts
    return (" ".join(tokens[:mid]), " ".join(tokens[mid:]))


def pick_letter(text: str) -> Optional[str]:
    """Resolve an explicit A-Z learning-letter token at the start of a line.

    ABC learning lines are authored to begin with a standalone target letter,
    for example ``A is for apple`` or ``A ... A ... apple``. Requiring that
    isolated leading token prevents ordinary chorus/narration lines such as
    ``Say it! Show it! A-B-C!`` from incorrectly selecting ``S`` as the centered
    learning asset.

    Returns ``None`` when the first non-space token is not exactly one ASCII
    letter A-Z. Punctuation immediately after the letter is allowed.
    """
    stripped = text.lstrip()
    if not stripped:
        return None
    first = stripped[0]
    if not ("a" <= first <= "z" or "A" <= first <= "Z"):
        return None
    if len(stripped) > 1 and not (
        stripped[1].isspace() or stripped[1] in ".,!?;:…"
    ):
        return None
    return first.upper()


def parse_original_lyrics(raw: str, *, is_json: bool = False) -> OriginalLyrics:
    """Parse raw Original_Lyrics content (TXT or JSON) into ``OriginalLyrics``.

    JSON content may be a list of strings, an object with a ``lines`` array, or a
    single string with embedded newlines. TXT content is split on newlines. Blank
    lines are dropped and surrounding whitespace trimmed so display text is clean.
    """
    lines: list[str]
    if is_json:
        data = json.loads(raw)
        if isinstance(data, dict):
            data = data.get("lines", [])
        if isinstance(data, str):
            lines = data.splitlines()
        elif isinstance(data, list):
            lines = [str(item) for item in data]
        else:
            lines = []
    else:
        lines = raw.splitlines()

    cleaned = [
        line.strip()
        for line in lines
        if line and line.strip() and not is_non_lyric_marker(line.strip())
    ]
    return OriginalLyrics(lines=cleaned)


_SECTION_TAG_RE = re.compile(
    r"^\[(?:final\s+)?(?:intro\b|verse\b|pre[- ]?chorus\b|chorus\b|post[- ]?chorus\b|"
    r"refrain\b|bridge\b|outro\b|hook\b|interlude\b|instrumental\b|"
    r"break\b|end\b)[^\]]*\]$",
    re.IGNORECASE,
)


def is_non_lyric_marker(line: str) -> bool:
    """Return True for common Markdown/Suno structure lines, not sung content."""
    stripped = line.strip()
    if not stripped:
        return True
    if stripped.startswith("#") or stripped.startswith("```"):
        return True
    return _SECTION_TAG_RE.fullmatch(stripped) is not None


def load_learning_map(store: Any, project_id: str) -> Optional[dict]:
    """Load and validate canonical LOCKED ``authoring/mapping.json`` when present."""
    try:
        raw = store.read_json(project_id, "authoring/mapping.json")
    except FileNotFoundError:
        return None
    if not isinstance(raw, dict):
        raise ValueError("authoring/mapping.json must be a JSON object")
    from src.validate_artifacts import validate_learning_map_payload

    validate_learning_map_payload(raw)
    return raw


def load_song_script(store: Any, project_id: str) -> Optional[dict]:
    """Load and validate ``authoring/song-script.json`` when present."""
    try:
        raw = store.read_json(project_id, "authoring/song-script.json")
    except FileNotFoundError:
        return None
    if not isinstance(raw, dict):
        raise ValueError("authoring/song-script.json must be a JSON object")
    from src.validate_artifacts import validate_song_script_payload

    validate_song_script_payload(raw)
    return raw


def load_original_lyrics(store: Any, project_id: str) -> Optional[OriginalLyrics]:
    """Seam: load Original_Lyrics for a project, or ``None`` when absent (Req 4.2).

    This is intentionally tolerant: the Audio_Worker pipeline (task 6.7) calls it
    before ``build_lyrics`` and a missing/unreadable original lyrics asset simply
    means the transcriber becomes the sole source. It duck-types the Python
    Asset_Store view so it works regardless of the exact read method exposed, and
    returns ``None`` on any error rather than failing the whole transcription.
    """
    rel_txt = "assets/original-lyrics.txt"
    rel_json = "assets/original-lyrics.json"
    rel_md = "assets/original-lyrics.md"

    reader = getattr(store, "read_text", None) or getattr(store, "read", None)
    if reader is None:
        return None

    for rel, is_json in ((rel_json, True), (rel_txt, False), (rel_md, False)):
        try:
            raw = reader(project_id, rel)
        except Exception:
            continue
        if raw is None:
            continue
        if isinstance(raw, (bytes, bytearray)):
            raw = raw.decode("utf-8")
        return parse_original_lyrics(raw, is_json=is_json)

    return None
