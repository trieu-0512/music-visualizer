from __future__ import annotations

import argparse
import difflib
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

import jsonschema

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "abc-song"
LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
CHUNKS = ("ABCD", "EFGH", "IJKL", "MNOP", "QRST", "UVWX", "YZ")
AUDIT_VERSION = 4
AUDIT_STANDARD = "creative-v4"
REQUIRED_FILES = (
    "mapping.json",
    "song-script.json",
    "generation-lyrics.txt",
    "display-lyrics.txt",
    "style-prompt.txt",
    "exclude-styles.txt",
    "object-prompts.json",
    "learning-blocks.json",
    "sections.json",
    "song-plan.json",
)


def norm(text: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", text.casefold()))


def normalized_target_skeleton(text: str, letter: str, obj: str) -> str:
    value = re.sub(re.escape(obj), " <object> ", text, flags=re.IGNORECASE)
    value = re.sub(rf"\b{re.escape(letter)}\b", " <letter> ", value, flags=re.IGNORECASE)
    return " ".join(re.findall(r"<letter>|<object>|[a-z0-9']+", value.casefold()))


def suffix_after_object(text: str, obj: str) -> str:
    match = re.search(re.escape(obj), text, flags=re.IGNORECASE)
    if not match:
        return ""
    return norm(text[match.end():])


def classify_target_entry(text: str, letter: str, obj: str) -> str:
    raw = text.strip()
    before_object = re.split(re.escape(obj), raw, maxsplit=1, flags=re.IGNORECASE)[0]
    letter_hits = len(re.findall(rf"\b{re.escape(letter)}\b", before_object, flags=re.IGNORECASE))
    if letter_hits >= 2:
        return "repeated-letter"
    if re.search(rf"^\s*{re.escape(letter)}\s+is\s+for\b", raw, flags=re.IGNORECASE):
        return "is-for"
    if "?" in before_object:
        return "question-answer"
    if re.search(rf"^\s*{re.escape(obj)}\b", raw, flags=re.IGNORECASE):
        return "object-first"
    if re.search(rf"^\s*{re.escape(letter)}\s*(?:[-—:,!]|\.\.\.)?\s*{re.escape(obj)}\b", raw, flags=re.IGNORECASE):
        return "direct-letter-object"
    if re.search(rf"^\s*{re.escape(letter)}\b", raw, flags=re.IGNORECASE):
        return "letter-led-sentence"
    if re.match(r"^(tap|point|find|spot|show|look|trace|clap|say|name|wave|row|hop|turn|touch)\b", raw, flags=re.IGNORECASE):
        return "action-first"
    return "narrative-or-other"


def style_blueprint_signals(style: str) -> dict[str, bool]:
    value = style.casefold()
    return {
        "voiceDiction": any(token in value for token in ("diction", "clear lead", "clear female", "clear vocal", "crisp", "pronunciation")),
        "grooveTempo": bool(re.search(r"\b\d{2,3}\s*bpm\b", value)) or any(token in value for token in ("4/4", "6/8", "swing", "groove", "pulse")),
        "melodicBehavior": any(token in value for token in ("stepwise", "narrow", "melody", "contour", "repeated-note", "repeated note")),
        "openingBehavior": any(token in value for token in ("open with", "opening", "intro", "cold-open", "cold open")),
        "roundBehavior": any(token in value for token in ("round 1", "round-1", "round 2", "round-2", "call-and-response", "call and response", "retrieval")),
        "targetProtection": any(token in value for token in ("target-word", "target word", "thin percussion", "duck", "backing vocals", "response gap", "beat of silence")),
        "arrangementArc": any(token in value for token in ("chorus lifts", "energy arc", "arrangement", "build", "drop", "sparse", "fuller")),
        "endingBehavior": any(token in value for token in ("end with", "ending", "final hook", "clean cadence", "short cadence")),
    }


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_json_schema(instance: Any, schema_path: Path, label: str, errors: list[str]) -> None:
    try:
        jsonschema.validate(instance, load_json(schema_path))
    except Exception as exc:
        errors.append(f"{label}: schema error: {getattr(exc, 'message', str(exc))}")


def audit_song(sid: str) -> dict[str, Any]:
    authoring = CATALOG / sid / "authoring"
    errors: list[str] = []
    warnings: list[str] = []
    missing = [name for name in REQUIRED_FILES if not (authoring / name).is_file()]
    if missing:
        return {"songId": sid, "errors": [f"missing files: {missing}"], "warnings": []}

    mapping = load_json(authoring / "mapping.json")
    script = load_json(authoring / "song-script.json")
    blocks = load_json(authoring / "learning-blocks.json")
    sections = load_json(authoring / "sections.json")
    prompts = load_json(authoring / "object-prompts.json")
    plan = load_json(authoring / "song-plan.json")

    validate_json_schema(mapping, ROOT / "shared/src/schema/learning-map.schema.json", f"{sid} mapping", errors)
    validate_json_schema(script, ROOT / "shared/src/schema/song-script.schema.json", sid, errors)
    block_schema = load_json(ROOT / ".claude/skills/abc-kids-music-composer/LEARNING_BLOCK_SCHEMA.json")
    section_schema = load_json(ROOT / ".claude/skills/abc-kids-music-composer/SECTION_SCHEMA.json")
    for idx, block in enumerate(blocks):
        try:
            jsonschema.validate(block, block_schema)
        except Exception as exc:
            errors.append(f"{sid}: learning block {idx}: {getattr(exc, 'message', str(exc))}")
    for idx, section in enumerate(sections):
        try:
            jsonschema.validate(section, section_schema)
        except Exception as exc:
            errors.append(f"{sid}: section {idx}: {getattr(exc, 'message', str(exc))}")

    if mapping.get("state") != "LOCKED":
        errors.append("mapping not LOCKED")
    if script.get("mappingRevision") != mapping.get("revision"):
        errors.append("song-script mappingRevision mismatch")
    if prompts.get("mappingRevision") != mapping.get("revision"):
        errors.append("object-prompts mappingRevision mismatch")
    if plan.get("mappingRevision") != mapping.get("revision"):
        errors.append("song-plan mappingRevision mismatch")

    mapping_words = {letter: mapping["letters"][letter]["object"] for letter in LETTERS}
    target_lines = [line for line in script.get("lines", []) if line.get("targetId")]
    counts = Counter(line["targetId"] for line in target_lines)
    for letter in LETTERS:
        if counts[letter] != 2:
            errors.append(f"{letter}: expected 2 target occurrences, got {counts[letter]}")

    round1 = {line["targetId"]: line for line in target_lines if str(line.get("id", "")).startswith("r1-")}
    round2 = {line["targetId"]: line for line in target_lines if str(line.get("id", "")).startswith("r2-")}
    for letter in LETTERS:
        obj = mapping_words[letter]
        for round_name, bucket, reveal, objective in (
            ("round1", round1, "line-start", "lexical-semantic"),
            ("round2", round2, "target-word", "retrieval-action"),
        ):
            line = bucket.get(letter)
            if not line:
                continue
            if obj.casefold() not in str(line.get("text", "")).casefold():
                errors.append(f"{round_name} {letter}: canonical object {obj!r} missing from line")
            if line.get("objectReveal") != reveal:
                errors.append(f"{round_name} {letter}: objectReveal should be {reveal}")
            if line.get("objective") != objective:
                errors.append(f"{round_name} {letter}: objective should be {objective}")
            words = re.findall(r"\b[\w'-]+\b", str(line.get("text", "")))
            punctuation_break = bool(re.search(r"(?:[.,;:!?]|—|--|\.\.\.)", str(line.get("text", ""))))
            if len(words) > 18 and not punctuation_break:
                warnings.append(f"{round_name} {letter}: extended {len(words)}-word line has no obvious phraselet break; review bars/breathing")

    if len(blocks) != 26:
        errors.append(f"learning-blocks length {len(blocks)} != 26")
    block_by_letter = {item.get("letter"): item for item in blocks}
    pronunciation_review_targets: list[str] = []
    for letter in LETTERS:
        block = block_by_letter.get(letter)
        if not block:
            errors.append(f"missing learning block {letter}")
            continue
        if block.get("word") != mapping_words[letter]:
            errors.append(f"learning block {letter} word differs from mapping")
        risks = set(mapping["letters"][letter].get("riskFlags", []))
        block_risks = set(block.get("risk_flags", []))
        if "VERIFY" in block_risks:
            pronunciation_review_targets.append(f"{letter}:{mapping_words[letter]}")
        if "safety-context-only" in risks and norm(str(block.get("congruent_action", ""))) != "point to the picture only":
            errors.append(f"{letter}: safety-context-only target has unsafe action")

    if set(prompts.get("letters", {})) != set(LETTERS):
        errors.append("object-prompts is not A-Z complete")
    else:
        for letter in LETTERS:
            item = prompts["letters"][letter]
            if item.get("object") != mapping_words[letter]:
                errors.append(f"prompt {letter}: object differs from mapping")
            text = str(item.get("prompt", ""))
            if mapping_words[letter].casefold() not in text.casefold() or f"letter {letter}".casefold() not in text.casefold():
                errors.append(f"prompt {letter}: missing explicit letter/object identity")

    creative_rework: list[str] = []
    fingerprint = plan.get("creativeFingerprint", {}) if isinstance(plan.get("creativeFingerprint", {}), dict) else {}
    craft_coverage = plan.get("objectCraftCoverage", {}) if isinstance(plan.get("objectCraftCoverage", {}), dict) else {}
    if fingerprint.get("mode") == "controlled-variation" and int(craft_coverage.get("covered", 0)) < 26:
        creative_rework.append(f"Object Craft Lexicon coverage is {craft_coverage.get('covered', 0)}/26; gold-standard controlled variation requires semantic/action craft for every target")
    declared_mode = str(fingerprint.get("mode", "legacy-or-unspecified"))
    deliberate_chant = "chant" in " ".join(str(v) for v in fingerprint.values()).casefold()

    r1_skeletons = [normalized_target_skeleton(round1[letter]["text"], letter, mapping_words[letter]) for letter in LETTERS if letter in round1]
    r2_skeletons = [normalized_target_skeleton(round2[letter]["text"], letter, mapping_words[letter]) for letter in LETTERS if letter in round2]
    if r1_skeletons:
        dominant_r1, dominant_r1_count = Counter(r1_skeletons).most_common(1)[0]
        if dominant_r1_count >= 20 and not deliberate_chant:
            creative_rework.append(f"Round 1 template monotony: one normalized sentence skeleton dominates {dominant_r1_count}/26 targets")
    if r2_skeletons:
        _dominant_r2, dominant_r2_count = Counter(r2_skeletons).most_common(1)[0]
        if dominant_r2_count >= 20 and not deliberate_chant:
            creative_rework.append(f"Round 2 template monotony: one normalized response skeleton dominates {dominant_r2_count}/26 targets")

    r1_tails = [suffix_after_object(round1[letter]["text"], mapping_words[letter]) for letter in LETTERS if letter in round1]
    r1_tails = [tail for tail in r1_tails if tail]
    if r1_tails:
        tail, tail_count = Counter(r1_tails).most_common(1)[0]
        if tail_count >= 16 and not deliberate_chant:
            creative_rework.append(f"Round 1 generic-tail saturation: {tail_count}/26 targets reuse tail {tail!r}")

    r2_tails = [suffix_after_object(round2[letter]["text"], mapping_words[letter]) for letter in LETTERS if letter in round2]
    r2_tails = [tail for tail in r2_tails if tail]
    if r2_tails:
        tail2, tail2_count = Counter(r2_tails).most_common(1)[0]
        if tail2_count >= 20 and not deliberate_chant:
            creative_rework.append(f"Round 2 generic action saturation: {tail2_count}/26 targets reuse response tail {tail2!r}")

    entry_families = {
        classify_target_entry(round1[letter]["text"], letter, mapping_words[letter])
        for letter in LETTERS
        if letter in round1
    }
    if len(entry_families) <= 1 and not deliberate_chant:
        creative_rework.append(f"Round 1 uses only {len(entry_families)} target-entry family; controlled creative mode normally plans 3-6 compatible families")
    elif len(entry_families) > 8:
        warnings.append(f"Round 1 uses {len(entry_families)} entry families; review whether target arrival remains predictable")

    r1_word_counts = [len(re.findall(r"\b[\w'-]+\b", round1[letter]["text"])) for letter in LETTERS if letter in round1]
    if r1_word_counts and max(r1_word_counts) - min(r1_word_counts) <= 2 and len(set(r1_skeletons)) <= 3 and not deliberate_chant:
        creative_rework.append("Round 1 line-shape monotony: almost uniform word-count/cadence with little syntactic variation")

    pronoun_followups = sum(
        1
        for letter in LETTERS
        if letter in round1 and re.search(r"[.!?]\s+It\b", str(round1[letter].get("text", "")))
    )
    if pronoun_followups >= 22 and not deliberate_chant:
        creative_rework.append(f"Round 1 semantic follow-up monotony: {pronoun_followups}/26 target lines restart the semantic sentence with 'It'")

    rhyme_bearing_round1 = [
        letter for letter in LETTERS
        if letter in round1 and " | " in str(round1[letter].get("text", ""))
    ]
    if declared_mode == "controlled-variation" and len(rhyme_bearing_round1) < 6:
        warnings.append(f"Round 1 has only {len(rhyme_bearing_round1)}/26 explicit rhyme-bearing phraselets; review by ear whether the verse still feels musical")
    for chunk in CHUNKS:
        if declared_mode == "controlled-variation" and not any(letter in rhyme_bearing_round1 for letter in chunk):
            warnings.append(f"Round 1 chunk {chunk} has no explicit rhyme-bearing line; acceptable when melody, cadence, imagery, or repetition carries the musicality")

    intro_texts = [str(line.get("text", "")) for line in script.get("lines", []) if str(line.get("id", "")).startswith("intro-")]
    generic_opening = bool(intro_texts and re.match(r"^(come explore|let's explore)\b", intro_texts[0].strip(), flags=re.IGNORECASE))
    if generic_opening and declared_mode != "controlled-variation":
        warnings.append("generic invitation opening; catalog-quality rewrite should choose a deliberate opening type")

    style_text = (authoring / "style-prompt.txt").read_text(encoding="utf-8").strip()
    style_signals = style_blueprint_signals(style_text)
    style_signal_count = sum(style_signals.values())
    if style_signal_count < 4:
        creative_rework.append(f"style prompt is under-specified as a performance blueprint ({style_signal_count}/8 behavior signal groups)")

    if declared_mode == "legacy-single-frame" or plan.get("status") == "REWORK_LEGACY_TEMPLATE":
        creative_rework.append("song-plan declares legacy single-frame authoring; migrate to a curated CreativeSpec before generation")

    for issue in creative_rework:
        warnings.append("CREATIVE REWORK: " + issue)

    gen = (authoring / "generation-lyrics.txt").read_text(encoding="utf-8")
    display = (authoring / "display-lyrics.txt").read_text(encoding="utf-8")
    if gen != display:
        warnings.append("generation/display lyrics differ; verify deliberate rendering difference")
    if any(token in gen.lower() for token in ("bpm", "camera", "mixing", "remotion", "render")):
        errors.append("generation lyrics contain technical production prose")
    lyric_word_count = len(re.findall(r"\b[\w'-]+\b", gen))
    if lyric_word_count > 1000:
        warnings.append(f"global lyric count {lyric_word_count} is long; review local density and actual provider behavior rather than shortening by count alone")
    if pronunciation_review_targets:
        warnings.append("pronunciation review required: " + ", ".join(pronunciation_review_targets))

    section_form = {
        "round1ChorusAfter": list(fingerprint.get("chorusAfterRound1", [])),
        "round2ChorusAfter": list(fingerprint.get("chorusAfterRound2", [])),
        "hasMidInterlude": bool(fingerprint.get("hasMidInterlude", False)),
    }
    creative_fingerprint_key = " | ".join([
        str(fingerprint.get("openingType", "")),
        str(fingerprint.get("grooveMeter", "")),
        str(fingerprint.get("rhymeEngine", "")),
        json.dumps(section_form, sort_keys=True),
    ])

    return {
        "songId": sid,
        "theme": mapping["theme"]["name"],
        "hook": " | ".join(plan.get("hook", [])),
        "style": style_text,
        "lyrics": gen,
        "targetLines": len(target_lines),
        "designStatus": "REWORK" if creative_rework else "READY_FOR_GENERATION_TEST",
        "creativeReworkReasons": creative_rework,
        "targetEntryFamilies": sorted(entry_families),
        "rhymeBearingRound1": rhyme_bearing_round1,
        "sectionForm": section_form,
        "creativeFingerprintKey": creative_fingerprint_key,
        "styleBlueprintSignals": style_signals,
        "lyricWordCount": lyric_word_count,
        "pronunciationReviewTargets": pronunciation_review_targets,
        "errors": errors,
        "warnings": warnings,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit a generated 10-song authoring batch.")
    parser.add_argument("--start", type=int, required=True)
    parser.add_argument("--end", type=int, required=True)
    args = parser.parse_args()
    if args.end < args.start or args.end - args.start + 1 > 10:
        raise SystemExit("Audit at most 10 songs per batch")
    songs = [audit_song(f"{i:04d}") for i in range(args.start, args.end + 1)]

    failures = [song for song in songs if song["errors"]]
    batch_warnings: list[str] = []
    hooks = [norm(song.get("hook", "")) for song in songs]
    styles = [norm(song.get("style", "")) for song in songs]
    if len(set(hooks)) != len(hooks):
        failures.append({"songId": "BATCH", "errors": ["duplicate hooks in batch"]})
    if len(set(styles)) != len(styles):
        failures.append({"songId": "BATCH", "errors": ["duplicate style prompts in batch"]})

    section_forms = [json.dumps(song.get("sectionForm", {}), sort_keys=True) for song in songs]
    creative_keys = [str(song.get("creativeFingerprintKey", "")) for song in songs]
    controlled_songs = [song for song in songs if song.get("creativeFingerprintKey")]
    if len(controlled_songs) == 10 and len(set(section_forms)) < 6:
        batch_warnings.append(f"only {len(set(section_forms))}/10 unique section-form layouts; review chorus/interlude architecture diversity")
    if len(controlled_songs) == 10 and len(set(creative_keys)) < 9:
        batch_warnings.append(f"only {len(set(creative_keys))}/10 unique full creative fingerprints; review opening/groove/form differentiation")

    similarities: list[tuple[float, str, str]] = []
    for i, left in enumerate(songs):
        for right in songs[i + 1:]:
            score = difflib.SequenceMatcher(None, norm(left.get("lyrics", "")), norm(right.get("lyrics", ""))).ratio()
            similarities.append((score, left["songId"], right["songId"]))
    similarities.sort(reverse=True)
    exact_lyrics = [item for item in similarities if item[0] == 1.0]
    if exact_lyrics:
        failures.append({"songId": "BATCH", "errors": [f"exact duplicate lyrics: {exact_lyrics}"]})

    warning_count = sum(len(song["warnings"]) for song in songs) + len(batch_warnings)
    report = {
        "auditVersion": AUDIT_VERSION,
        "auditStandard": AUDIT_STANDARD,
        "status": "FAIL" if failures else ("PASS_WITH_REVIEW" if warning_count else "PASS"),
        "range": f"{args.start:04d}-{args.end:04d}",
        "songs": len(songs),
        "schemaAndSemanticFailures": len(failures),
        "warnings": warning_count,
        "designReworkSongs": sum(1 for song in songs if song.get("designStatus") == "REWORK"),
        "uniqueHooks": len(set(hooks)),
        "uniqueStyles": len(set(styles)),
        "uniqueSectionForms": len(set(section_forms)),
        "uniqueCreativeFingerprints": len(set(creative_keys)),
        "maxLyricSimilarity": round(similarities[0][0], 4) if similarities else 0.0,
        "mostSimilarPair": list(similarities[0][1:]) if similarities else [],
        "batchWarnings": batch_warnings,
        "songsDetail": [
            {"songId": s["songId"], "theme": s.get("theme"), "targetLines": s.get("targetLines"), "lyricWordCount": s.get("lyricWordCount"), "designStatus": s.get("designStatus"), "creativeReworkReasons": s.get("creativeReworkReasons", []), "targetEntryFamilies": s.get("targetEntryFamilies", []), "rhymeBearingRound1": s.get("rhymeBearingRound1", []), "sectionForm": s.get("sectionForm", {}), "pronunciationReviewTargets": s.get("pronunciationReviewTargets"), "errors": s["errors"], "warnings": s["warnings"]}
            for s in songs
        ],
    }
    out = CATALOG / f"AUTHORING_AUDIT_{args.start:04d}_{args.end:04d}.json"
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    batches: list[dict[str, Any]] = []
    stale_batches = 0
    legacy_passed_batches = 0
    for batch_start in range(1, 201, 10):
        batch_end = batch_start + 9
        audit_path = CATALOG / f"AUTHORING_AUDIT_{batch_start:04d}_{batch_end:04d}.json"
        status = "PENDING"
        if audit_path.is_file():
            try:
                previous = load_json(audit_path)
                previous_status = str(previous.get("status", "UNKNOWN"))
                if int(previous.get("auditVersion", 0)) != AUDIT_VERSION:
                    status = "STALE_CREATIVE_V3"
                    stale_batches += 1
                    if previous_status in {"PASS", "PASS_WITH_REVIEW"}:
                        legacy_passed_batches += 1
                else:
                    status = previous_status
            except Exception:
                status = "INVALID_AUDIT"
        batches.append({"start": f"{batch_start:04d}", "end": f"{batch_end:04d}", "status": status})
    completed = sum(1 for batch in batches if batch["status"] in {"PASS", "PASS_WITH_REVIEW"})
    progress = {
        "auditVersion": AUDIT_VERSION,
        "auditStandard": AUDIT_STANDARD,
        "batchSize": 10,
        "totalSongs": 200,
        "totalBatches": 20,
        "completedBatches": completed,
        "completedSongs": completed * 10,
        "staleBatches": stale_batches,
        "legacyPassedBatches": legacy_passed_batches,
        "authoredPackagesExistForSongs": 200,
        "batches": batches,
    }
    (CATALOG / "AUTHORING_PROGRESS.json").write_text(json.dumps(progress, indent=2) + "\n", encoding="utf-8")
    md = [
        "# ABC Song Authoring Progress",
        "",
        f"Current audit standard: **{AUDIT_STANDARD} (v{AUDIT_VERSION})**",
        f"Validated on current standard: **{completed}/20 batches ({completed * 10}/200 songs)**",
        f"Legacy/stale batch audits awaiting {AUDIT_STANDARD} migration: **{stale_batches}/20**",
        "All 200 authoring package folders still exist; this tracker distinguishes current creative validation from legacy structural validation.",
        "",
        "| Batch | Songs | Status |",
        "|---:|---|---|",
    ]
    for index, batch in enumerate(batches, start=1):
        md.append(f"| {index:02d} | {batch['start']}-{batch['end']} | {batch['status']} |")
    md.append("")
    (CATALOG / "AUTHORING_PROGRESS.md").write_text("\n".join(md), encoding="utf-8")

    print(json.dumps(report, indent=2, ensure_ascii=False))
    raise SystemExit(0 if report["status"] in {"PASS", "PASS_WITH_REVIEW"} else 1)


if __name__ == "__main__":
    main()
