"""Transcriber (WhisperX) handler and transcribe-pipeline chaining (task 6.7).

This module implements the design "Transcriber (WhisperX)" section. The Audio_Worker
claims a ``transcribe`` job and dispatches to :func:`handle_transcribe`, which:

1. reads the project's ``Audio_Asset`` to a temp file (Req 3.1),
2. runs WhisperX transcribe + forced alignment to obtain segments with optional
   word-level timing,
3. writes the raw transcription result to ``artifacts/whisperx.json`` with
   segment-level timestamps and, where produced, word timing (Req 3.2, 3.3, 3.4),
4. *chains* the Lyric_Aligner and SRT Exporter so the standardized lyric artifacts
   are ready as soon as transcription finishes: ``build_lyrics`` -> ``artifacts/lyrics.json``
   (Req 4) and ``lyrics_to_srt`` -> ``artifacts/lyrics.srt`` (Req 5).

WhisperX is a heavy ML dependency (torch, faster-whisper, pyannote-audio) that is
not required to import or test this module. The actual model call is isolated behind
a thin, injectable seam :func:`_run_whisperx`, which imports ``whisperx`` *lazily* so
this module imports cleanly without it installed. The chaining logic
(``whisperx.json`` -> ``lyrics.json`` -> ``lyrics.srt``) is therefore fully unit
testable by injecting a fake transcriber (see ``tests/test_transcribe.py``); the real
end-to-end run with WhisperX is covered by the integration test in task 6.8.

Failure handling (Req 3.6): :func:`handle_transcribe` does not swallow errors. Any
failure in decoding, transcription, alignment, or chaining propagates to the worker
loop (``src/worker.py``), which records the job as ``failed`` with the error message
via ``mark_failed`` (Req 3.6, 12.4). The temp audio file is always cleaned up.
"""

from __future__ import annotations

import hashlib
import os
from pathlib import Path
from typing import Any, Callable, Optional

from src.align import build_lyrics, load_learning_map, load_original_lyrics, load_song_script
from src.queue import Job
from src.srt import lyrics_to_srt
from src.store import AssetStore
from src.validate_artifacts import validate_lyrics_payload

__all__ = [
    "handle_transcribe",
    "WhisperxRunner",
]

# A WhisperX runner: given an audio file path, return a ``whisperx.json``-shaped
# dict ``{"segments": [...], "language"?: str}``. The default implementation is
# :func:`_run_whisperx`; tests inject a fake to exercise the chaining logic.
WhisperxRunner = Callable[[str], dict]

# Standardized artifact addresses (design: Storage layout). No caller builds paths.
AUDIO_ROLE = "assets/audio"
WHISPERX_ARTIFACT = "artifacts/whisperx.json"
LYRICS_ARTIFACT = "artifacts/lyrics.json"
SRT_ARTIFACT = "artifacts/lyrics.srt"


def handle_transcribe(
    job: Job,
    store: AssetStore,
    *,
    run_whisperx: Optional[WhisperxRunner] = None,
) -> list[str]:
    """Transcribe a project's audio and chain alignment + SRT export.

    Reads ``assets/audio`` (Req 3.1; the API enforces that an Audio_Asset exists,
    Req 3.5), runs the WhisperX seam to get segments + optional word timing, writes
    ``artifacts/whisperx.json`` (Req 3.2, 3.3, 3.4), then chains the Lyric_Aligner and
    SRT Exporter to write ``artifacts/lyrics.json`` (Req 4) and ``artifacts/lyrics.srt``
    (Req 5). Returns the produced artifact paths in pipeline order.

    ``run_whisperx`` defaults to :func:`_run_whisperx` (the real, lazily-imported
    WhisperX call) and is injectable so the chaining is testable without the model.
    Errors are not caught here so the worker can record the job as failed (Req 3.6).
    """
    runner = run_whisperx or _run_whisperx

    audio_path = store.read_to_temp(job.project_id, AUDIO_ROLE)  # Req 3.1
    audio_sha256 = hashlib.sha256(Path(audio_path).read_bytes()).hexdigest()
    try:
        # WhisperX transcribe + align -> segments with optional word timing.
        whisperx_result = runner(audio_path)
        # Req 3.2/3.3/3.4: persist the raw transcription (segments + word timing).
        store.write_json(job.project_id, WHISPERX_ARTIFACT, whisperx_result)

        # Chain alignment + SRT so lyrics.json/srt are ready after transcription.
        original = load_original_lyrics(store, job.project_id)
        learning_map = load_learning_map(store, job.project_id)
        song_script = load_song_script(store, job.project_id)
        lyrics = build_lyrics(
            whisperx_result,
            original,
            learning_map,
            song_script,
        )  # Req 4 + theme-first structured timing
        lyrics["provenance"] = {
            "audioSha256": audio_sha256,
            **(
                {"mappingRevision": int(learning_map["revision"])}
                if learning_map is not None
                else {}
            ),
            **(
                {"songScriptMappingRevision": int(song_script["mappingRevision"])}
                if song_script is not None
                else {}
            ),
        }
        # Production schema gate (PR-10): fail the job before mark_completed.
        validate_lyrics_payload(lyrics)
        store.write_json(job.project_id, LYRICS_ARTIFACT, lyrics)

        srt = lyrics_to_srt(lyrics)  # Req 5
        store.write_text(job.project_id, SRT_ARTIFACT, srt)
    finally:
        _cleanup_temp(audio_path)

    return [WHISPERX_ARTIFACT, LYRICS_ARTIFACT, SRT_ARTIFACT]


def _cleanup_temp(path: str) -> None:
    """Best-effort removal of the temp audio file created by ``read_to_temp``."""
    try:
        Path(path).unlink()
    except OSError:
        # Temp cleanup must never mask the real result (success or the original error).
        pass


# --------------------------------------------------------------------------- #
# WhisperX seam (heavy ML dependency, imported lazily; not unit tested here).  #
# --------------------------------------------------------------------------- #


def _run_whisperx(audio_path: str) -> dict:
    """Run WhisperX transcribe + forced alignment on ``audio_path`` (Req 3.1).

    This is the single isolation seam around the heavy WhisperX dependency. The
    ``whisperx`` import is performed *inside* the function so importing this module
    never requires WhisperX (or torch); the dependency is only needed when a real
    transcribe job runs. Model/device parameters are read from the environment with
    CPU-friendly defaults so the MVP runs without a GPU:

    - ``WHISPERX_MODEL``         (default ``"small"``)
    - ``WHISPERX_DEVICE``        (default ``"cpu"``)
    - ``WHISPERX_COMPUTE_TYPE``  (default ``"int8"``)
    - ``WHISPERX_BATCH_SIZE``    (default ``16``)
    - ``WHISPERX_LANGUAGE``      (default unset -> auto-detect)

    Returns a ``whisperx.json``-shaped dict ``{"segments": [...], "language"?: str}``
    normalized by :func:`_normalize_result`. Forced alignment adds word-level timing
    when possible; if alignment fails (e.g. an unsupported language) the segment-level
    transcription is used, leaving word timing absent for those lines (Req 3.4 treats
    word timing as optional).
    """
    import whisperx  # lazy: heavy ML dependency, only needed for a real run

    model_name = os.environ.get("WHISPERX_MODEL", "small")
    device = os.environ.get("WHISPERX_DEVICE", "cpu")
    compute_type = os.environ.get("WHISPERX_COMPUTE_TYPE", "int8")
    batch_size = int(os.environ.get("WHISPERX_BATCH_SIZE", "16"))
    language = os.environ.get("WHISPERX_LANGUAGE") or None

    asr_model = whisperx.load_model(
        model_name, device, compute_type=compute_type, language=language
    )
    audio = whisperx.load_audio(audio_path)
    result = asr_model.transcribe(audio, batch_size=batch_size)  # segments + language

    detected_language = result.get("language", language)
    segments = result.get("segments", [])
    try:
        align_model, metadata = whisperx.load_align_model(
            language_code=detected_language, device=device
        )
        aligned = whisperx.align(
            segments,
            align_model,
            metadata,
            audio,
            device,
            return_char_alignments=False,
        )
        segments = aligned.get("segments", segments)
    except Exception:
        # Alignment is best-effort: word timing is optional (Req 3.4). Fall back to
        # the segment-level transcription rather than failing the whole job.
        pass

    return _normalize_result(segments, detected_language)


def _normalize_result(segments: list[dict], language: Optional[str] = None) -> dict:
    """Normalize raw WhisperX segments into the ``whisperx.json`` artifact shape.

    Produces ``{"segments": [...], "language"?: str}`` with segments ordered by
    ascending start time. Each segment is normalized by :func:`_normalize_segment`
    so the artifact carries clean segment timestamps (Req 3.3) and well-formed,
    optional word timing (Req 3.4) that the Lyric_Aligner can consume directly.
    """
    normalized = [_normalize_segment(seg) for seg in segments]
    normalized.sort(key=lambda seg: seg["start"])
    result: dict[str, Any] = {"segments": normalized}
    if language:
        result["language"] = language
    return result


def _normalize_segment(seg: dict) -> dict:
    """Normalize a single WhisperX segment to ``{start, end, text, words?}``.

    ``start``/``end`` are coerced to floats with ``end >= start`` (Req 3.3). The
    optional ``words`` list is attached only when :func:`_normalize_words` yields a
    fully-timed list (Req 3.4); a segment with any untimed word (WhisperX leaves
    digits/symbols unaligned) keeps segment-level timing only, which is exactly the
    contract the Lyric_Aligner relies on when deciding whether to attach word timing.
    """
    start = float(seg.get("start", 0.0))
    end = float(seg.get("end", start))
    out: dict[str, Any] = {
        "start": start,
        "end": max(start, end),
        "text": str(seg.get("text", "")).strip(),
    }
    words = _normalize_words(seg.get("words"))
    if words:
        out["words"] = words
    return out


def _normalize_words(words: Any) -> Optional[list[dict]]:
    """Return a fully-timed word list, or ``None`` if any word lacks valid timing.

    WhisperX word entries use the ``word`` key and may omit ``start``/``end`` for
    words it cannot align. This is all-or-nothing per segment: a clean list of
    ``{word, start, end}`` (with ``end >= start``) is returned only when *every* word
    has numeric timing, otherwise ``None`` so the segment falls back to segment-level
    timing. That keeps ``whisperx.json`` well-formed and the downstream alignment
    safe (Req 3.4: word timing is optional).
    """
    if not isinstance(words, list) or not words:
        return None
    out: list[dict] = []
    for w in words:
        if not isinstance(w, dict):
            return None
        start = w.get("start")
        end = w.get("end")
        if not isinstance(start, (int, float)) or not isinstance(end, (int, float)):
            return None
        s = float(start)
        e = float(end)
        out.append({"word": str(w.get("word", "")), "start": s, "end": max(s, e)})
    return out
