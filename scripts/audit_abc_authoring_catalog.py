from __future__ import annotations

import argparse
import difflib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "abc-song"
AUDIT_VERSION = 4
AUDIT_STANDARD = "creative-v4"


def norm(text: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", text.casefold()))


def main() -> None:
    parser = argparse.ArgumentParser(description="Cross-audit ABC authoring diversity and integrity across many completed songs.")
    parser.add_argument("--start", type=int, default=1)
    parser.add_argument("--end", type=int, required=True)
    parser.add_argument("--similarity-review", type=float, default=0.82)
    args = parser.parse_args()
    if args.start < 1 or args.end < args.start or args.end > 200:
        raise SystemExit("Expected 1 <= start <= end <= 200")

    failures: list[dict[str, object]] = []
    warnings: list[dict[str, object]] = []
    songs: list[dict[str, str]] = []
    hooks: dict[str, str] = {}
    styles: dict[str, str] = {}
    lyrics: dict[str, str] = {}
    fingerprints: dict[str, str] = {}
    creative_audit_coverage = 0
    creative_rework_song_ids: list[str] = []
    stale_batch_audits: list[str] = []

    # Per-song schema/semantic checks already ran in the 10-song batch audits.
    # Cross-audit verifies those reports plus package coverage and global diversity.
    for batch_start in range(((args.start - 1) // 10) * 10 + 1, args.end + 1, 10):
        batch_end = min(batch_start + 9, 200)
        audit_path = CATALOG / f"AUTHORING_AUDIT_{batch_start:04d}_{batch_end:04d}.json"
        if not audit_path.is_file():
            failures.append({"songId": "CATALOG", "errors": [f"missing batch audit {audit_path.name}"]})
            continue
        batch_report = json.loads(audit_path.read_text(encoding="utf-8"))
        batch_status = batch_report.get("status")
        batch_version = int(batch_report.get("auditVersion", 0))
        if batch_version != AUDIT_VERSION:
            label = f"{batch_start:04d}-{batch_end:04d}"
            stale_batch_audits.append(label)
            failures.append({"songId": "CATALOG", "errors": [f"batch {label} audit is stale for {AUDIT_STANDARD}: found v{batch_version}, require v{AUDIT_VERSION}"]})
            continue
        if batch_status not in {"PASS", "PASS_WITH_REVIEW"}:
            failures.append({"songId": "CATALOG", "errors": [f"batch {batch_start:04d}-{batch_end:04d} status is {batch_status}"]})
        if batch_status == "PASS_WITH_REVIEW":
            warnings.append({"songId": "CATALOG", "warnings": [f"batch {batch_start:04d}-{batch_end:04d} requires design review"]})
        for detail in batch_report.get("songsDetail", []):
            if "designStatus" in detail:
                creative_audit_coverage += 1
                if detail.get("designStatus") == "REWORK":
                    creative_rework_song_ids.append(str(detail.get("songId")))

    for i in range(args.start, args.end + 1):
        sid = f"{i:04d}"
        authoring = CATALOG / sid / "authoring"
        required = ("mapping.json", "song-plan.json", "song-script.json", "generation-lyrics.txt", "style-prompt.txt")
        missing = [name for name in required if not (authoring / name).is_file()]
        if missing:
            failures.append({"songId": sid, "errors": [f"missing authoring files: {missing}"]})
            continue
        songs.append({"songId": sid})
        mapping = json.loads((authoring / "mapping.json").read_text(encoding="utf-8"))
        script = json.loads((authoring / "song-script.json").read_text(encoding="utf-8"))
        plan = json.loads((authoring / "song-plan.json").read_text(encoding="utf-8"))
        lyric_text = (authoring / "generation-lyrics.txt").read_text(encoding="utf-8")
        hooks[sid] = norm(" | ".join(plan.get("hook", [])))
        styles[sid] = norm((authoring / "style-prompt.txt").read_text(encoding="utf-8"))
        lyrics[sid] = norm(lyric_text)
        object_a = str(mapping["letters"]["A"]["object"])
        r1 = next(line["text"] for line in script["lines"] if line.get("id") == "r1-A")
        r2 = next(line["text"] for line in script["lines"] if line.get("id") == "r2-A")
        def frame(text: str) -> str:
            text = re.sub(re.escape(object_a), " <object> ", text, flags=re.IGNORECASE)
            text = re.sub(r"\bA\b", " <letter> ", text)
            return norm(text)
        fingerprints[sid] = norm(" | ".join(plan.get("hook", []))) + " | " + frame(r1) + " | " + frame(r2)

    def duplicate_groups(values: dict[str, str]) -> list[list[str]]:
        by_value: dict[str, list[str]] = {}
        for sid, value in values.items():
            by_value.setdefault(value, []).append(sid)
        return [ids for ids in by_value.values() if len(ids) > 1]

    duplicate_hooks = duplicate_groups(hooks)
    duplicate_styles = duplicate_groups(styles)
    duplicate_lyrics = duplicate_groups(lyrics)
    if duplicate_hooks:
        failures.append({"songId": "CATALOG", "errors": [f"duplicate hooks: {duplicate_hooks}"]})
    if duplicate_styles:
        failures.append({"songId": "CATALOG", "errors": [f"duplicate styles: {duplicate_styles}"]})
    if duplicate_lyrics:
        failures.append({"songId": "CATALOG", "errors": [f"duplicate lyrics: {duplicate_lyrics}"]})

    pairs: list[tuple[float, str, str]] = []
    ids = list(fingerprints)
    for index, left_id in enumerate(ids):
        for right_id in ids[index + 1 :]:
            score = difflib.SequenceMatcher(None, fingerprints[left_id], fingerprints[right_id]).ratio()
            pairs.append((score, left_id, right_id))
    pairs.sort(reverse=True)
    near_pairs = [
        {"similarity": round(score, 4), "a": left, "b": right}
        for score, left, right in pairs
        if score >= args.similarity_review
    ]

    report = {
        "auditVersion": AUDIT_VERSION,
        "auditStandard": AUDIT_STANDARD,
        "status": "FAIL" if failures else ("PASS_WITH_REVIEW" if warnings or near_pairs else "PASS"),
        "range": f"{args.start:04d}-{args.end:04d}",
        "songs": len(songs),
        "songsWithErrors": len([item for item in failures if item.get("songId") != "CATALOG"]),
        "songsWithWarnings": len(warnings),
        "creativeAuditCoverageSongs": creative_audit_coverage,
        "staleBatchAudits": stale_batch_audits,
        "creativeReworkSongs": len(creative_rework_song_ids),
        "creativeReworkSongIds": creative_rework_song_ids[:200],
        "uniqueHooks": len(set(hooks.values())),
        "uniqueStyles": len(set(styles.values())),
        "uniqueLyrics": len(set(lyrics.values())),
        "duplicateHookGroups": duplicate_hooks,
        "duplicateStyleGroups": duplicate_styles,
        "duplicateLyricGroups": duplicate_lyrics,
        "maxAuthoringFingerprintSimilarity": round(pairs[0][0], 4) if pairs else 0.0,
        "mostSimilarFingerprintPair": list(pairs[0][1:]) if pairs else [],
        "fingerprintReviewThreshold": args.similarity_review,
        "nearFingerprintPairs": near_pairs[:50],
        "failures": failures,
        "warnings": warnings,
    }
    out = CATALOG / f"AUTHORING_CROSS_AUDIT_{args.start:04d}_{args.end:04d}.json"
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))
    raise SystemExit(0 if report["status"] in {"PASS", "PASS_WITH_REVIEW"} else 1)


if __name__ == "__main__":
    main()
