# ABC Subtitle Merge Rules

## Purpose

The word-level SRT is useful for timing but is not a suitable display timeline: it creates one cue per word, can split a lyric sentence into fragments, and can make the foreground letter/object disappear while the remaining words are still sung. The canonical song script defines the sentence boundaries; the new SRT supplies exact word timing.

## Rules

1. Normalize both sources for matching by lowercasing and removing punctuation. Treat `X-ray` as `X ray` and `KOH-hog` as `KOH hog`.
2. Require the complete word stream to match exactly. Stop on a missing, reordered, or extra word.
3. Emit one SRT cue per canonical line. Use the first word start and last word end as the cue interval.
4. Use clean ASCII words in the display text. Remove `|`, ellipses, question marks, hyphens, commas, periods, and other decorative characters.
5. Keep the complete sentence in `line1`; keep `line2` empty. Wrapping is a renderer layout concern, not a subtitle segmentation rule.
6. Preserve per-word timing in `lyrics.json` for diagnostics and future highlighting.
7. For A-Z learning lines, preserve `id`, `targetId`, `objective`, `letter`, and `object`. The object and letter remain active until the merged sentence ends.
8. Keep the fixed lyric-box size. Long sentences wrap inside that box but never create extra timeline cues.

## 0001 Audit

- Source SRT: `abc-song/0001/authoring/e0c06061-718e-4554-9e2e-0ef349b5c367.srt`
- Canonical source: `abc-song/0001/authoring/song-script.json`
- Output SRT: `abc-song/0001/authoring/subtitles-merged.srt`
- Merged lyrics artifact: `storage/projects/p_c53b2efa-01c3-47eb-891b-9e874cb258a1/artifacts/lyrics.json`
- Merged preview manifest: `abc-song/0001/authoring/Task_205634_08142026/processed/preview-data.json`
- Result: 679 source cues and 684 normalized words merged into 81 canonical sentence cues; target lines remain 52; final timing ends at 458.856 seconds.

## Rebuild

```powershell
python scripts/merge_word_timed_subtitles.py `
  --srt abc-song/0001/authoring/e0c06061-718e-4554-9e2e-0ef349b5c367.srt `
  --song-script abc-song/0001/authoring/song-script.json `
  --mapping abc-song/0001/authoring/mapping.json `
  --output-srt abc-song/0001/authoring/subtitles-merged.srt `
  --output-lyrics-json storage/projects/<projectId>/artifacts/lyrics.json `
  --preview-data <input-preview-data.json> `
  --output-preview-data <output-preview-data.json>
```

Validate cue count, ASCII display text, full target-line intervals, and Remotion preview before rendering.
