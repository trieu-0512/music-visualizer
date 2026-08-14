from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "abc-song"
LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

# PROJECT_HEURISTIC support-cost vocabulary. These flags are not research claims.
RARE_OR_TECHNICAL_TOKENS = {"anemometer","altocumulus","oscilloscope","pipette","quahog","qajaq","quoin","xiphophorus","xerophyte","zoarcid","xenops","xerus","uakari","zener","quadriceps","xiphoid","zygomatic","ultrasonic","voltmeter","hydraulic","quasar","kuiper","krypton","nuthatch","vallisneria","quillwort","xoconostle","ulluco","quandong","xaphoon","yangqin","yidaki","zills","umbrellabird","uromastyx","urutu","xenosaurus","qianzhousaurus","wuerhosaurus","xixiasaurus","zephyrosaurus","xanthid","xylem","xenolith","x-shaped"}
SAFETY_CONTEXT_TOKENS = {"axe","auger","drill","jackhammer","knife","laser","saw","firework","voltage","battery","fuel","kerosene","blender","kettle","oven","frying","zester","scissors","needle","stapler","hammer","pliers"}
VISUAL_REVIEW_TOKENS = {"orbit","universe","world","humidity","breeze","gust","updraft","zephyr","vision","voice","affection","delight","optimism","interest","routine","friendship","kindness","gratitude","patience","respect","quantum","zero-gravity","knowledge","quality","quiet"}


def _norm(text: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", text.casefold()))


def _tokens(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+(?:-[a-z0-9]+)?", text.casefold())


def _familiarity_tier(obj: str) -> str:
    tokens = _tokens(obj)
    rare_hit = any(token.replace("-", "") in RARE_OR_TECHNICAL_TOKENS for token in tokens)
    if rare_hit or len(tokens) >= 3 or len(obj) >= 20:
        return "C"
    if len(tokens) == 2 or len(obj) >= 12:
        return "B"
    return "A"


def _risk_flags(obj: str, tier: str) -> list[str]:
    lowered = obj.casefold()
    tokens = _tokens(obj)
    flags: list[str] = []
    if tier == "C":
        flags.extend(["support-required", "verify-pronunciation"])
    elif "-" in obj:
        flags.append("verify-pronunciation")
    if any(token in lowered for token in SAFETY_CONTEXT_TOKENS):
        flags.append("safety-context-only")
    if any(token in lowered for token in VISUAL_REVIEW_TOKENS):
        flags.append("visual-clarity-review")
    if tokens and tokens[0][:1] in {"q", "x", "z"} and tier != "A":
        flags.append("guided-theme-fallback-review")
    return sorted(set(flags))


def review_song(song_dir: Path) -> dict[str, Any]:
    sid = song_dir.name
    proposal_path = song_dir / "mapping.proposal.json"
    hard_failures: list[str] = []
    warnings: list[str] = []
    entries: dict[str, dict[str, Any]] = {}
    if not proposal_path.is_file():
        return {"songId": sid, "status": "FAIL", "hardFailures": ["missing mapping.proposal.json"], "warnings": []}
    try:
        proposal = json.loads(proposal_path.read_text(encoding="utf-8"))
    except Exception as exc:
        return {"songId": sid, "status": "FAIL", "hardFailures": [f"invalid JSON: {exc}"], "warnings": []}
    if proposal.get("state") != "PROPOSED":
        hard_failures.append("proposal state must be PROPOSED")
    letters = proposal.get("letters")
    if not isinstance(letters, dict) or set(letters) != set(LETTERS):
        hard_failures.append("mapping must contain A-Z exactly once")
        letters = letters if isinstance(letters, dict) else {}
    seen_objects: dict[str, str] = {}
    tier_counts = Counter()
    risk_counts = Counter()
    for letter in LETTERS:
        raw = letters.get(letter, {})
        obj = str(raw.get("object", "")).strip() if isinstance(raw, dict) else ""
        if not obj:
            hard_failures.append(f"{letter}: empty object")
            continue
        if obj[0].upper() != letter:
            hard_failures.append(f"{letter}: object {obj!r} does not begin with target letter")
        key = _norm(obj)
        if key in seen_objects:
            hard_failures.append(f"duplicate object inside song: {seen_objects[key]} and {letter} -> {obj}")
        else:
            seen_objects[key] = letter
        if len(obj) > 48:
            hard_failures.append(f"{letter}: object label is too long to be a stable preschool target")
        tier = _familiarity_tier(obj)
        flags = _risk_flags(obj, tier)
        tier_counts[tier] += 1
        risk_counts.update(flags)
        if flags:
            warnings.append(f"{letter} -> {obj}: {', '.join(flags)}")
        entry: dict[str, Any] = {"object": obj, "familiarityTier": tier}
        if flags:
            entry["riskFlags"] = flags
        entries[letter] = entry
    theme = proposal.get("theme", {}) if isinstance(proposal.get("theme"), dict) else {}
    if not str(theme.get("name", "")).strip():
        hard_failures.append("theme name missing")
    if theme.get("scope") not in {"strict", "guided", "open"}:
        hard_failures.append("invalid theme scope")
    if theme.get("mode") not in {"LETTER_NAME", "PHONICS"}:
        hard_failures.append("invalid learning mode")
    status = "PASS_WITH_SUPPORT" if not hard_failures and warnings else "PASS" if not hard_failures else "FAIL"
    return {"songId": sid,"theme": theme.get("name"),"macroDomain": theme.get("macroDomain"),"status": status,"hardFailures": hard_failures,"warnings": warnings,"tierCounts": dict(tier_counts),"riskCounts": dict(risk_counts),"entries": entries,"proposal": proposal}


def build_locked_mapping(review: dict[str, Any]) -> dict[str, Any]:
    proposal = review["proposal"]
    theme = proposal["theme"]
    return {"version":1,"revision":1,"state":"LOCKED","theme":{"name":theme["name"],"scope":theme["scope"],"mappingAuthority":"project-locked","ageBand":theme["ageBand"],"mode":theme["mode"]},"letters":review["entries"]}


def write_song_review(song_dir: Path, review: dict[str, Any]) -> None:
    serializable = {key: value for key, value in review.items() if key not in {"proposal", "entries"}}
    (song_dir / "mapping-qc.json").write_text(json.dumps(serializable, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def write_summary(reviews: list[dict[str, Any]], locked: int) -> dict[str, Any]:
    failed = [review for review in reviews if review["hardFailures"]]
    tier_totals = Counter(); risk_totals = Counter()
    for review in reviews:
        tier_totals.update(review.get("tierCounts", {})); risk_totals.update(review.get("riskCounts", {}))
    summary = {"status":"READY_TO_LOCK" if not failed else "REWORK","songs":len(reviews),"hardFailSongs":len(failed),"supportWarningSongs":sum(1 for r in reviews if r.get("warnings")),"lockedSongs":locked,"tierTotals":dict(tier_totals),"riskTotals":dict(risk_totals),"failedSongs":[{"songId":r["songId"],"hardFailures":r["hardFailures"]} for r in failed]}
    (CATALOG / "MAPPING_QC_SUMMARY.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    lines = ["# ABC Song Mapping QC Summary","",f"Status: **{summary['status']}**","",f"- Songs reviewed: {summary['songs']}",f"- Songs with hard failures: {summary['hardFailSongs']}",f"- Songs with support warnings: {summary['supportWarningSongs']}",f"- Canonical mappings locked this run: {summary['lockedSongs']}",f"- Tier A targets: {tier_totals['A']}",f"- Tier B targets: {tier_totals['B']}",f"- Tier C targets: {tier_totals['C']}","","## Risk totals",""]
    lines.extend((f"- {name}: {count}" for name, count in sorted(risk_totals.items())) if risk_totals else ["- None"])
    lines.extend(["","## Hard-fail songs",""])
    lines.extend((f"- {r['songId']}: {'; '.join(r['hardFailures'])}" for r in failed) if failed else ["- None"])
    lines.extend(["","Tier/support classification is a PROJECT_HEURISTIC. Tier B/C means stronger teaching support is required; it is not an automatic mapping rejection.",""])
    (CATALOG / "MAPPING_QC_SUMMARY.md").write_text("\n".join(lines), encoding="utf-8")
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--lock", action="store_true"); args = parser.parse_args()
    song_dirs = [CATALOG / f"{i:04d}" for i in range(1, 201)]
    reviews = [review_song(song_dir) for song_dir in song_dirs]
    for song_dir, review in zip(song_dirs, reviews): write_song_review(song_dir, review)
    failed = [review for review in reviews if review["hardFailures"]]
    locked = 0
    if args.lock and not failed:
        for song_dir, review in zip(song_dirs, reviews):
            authoring = song_dir / "authoring"; authoring.mkdir(exist_ok=True)
            mapping_path = authoring / "mapping.json"
            if mapping_path.exists():
                existing = json.loads(mapping_path.read_text(encoding="utf-8"))
                if existing.get("state") == "LOCKED": continue
                raise RuntimeError(f"Refusing to overwrite non-canonical mapping: {mapping_path}")
            mapping_path.write_text(json.dumps(build_locked_mapping(review), indent=2, ensure_ascii=False) + "\n", encoding="utf-8"); locked += 1
    summary = write_summary(reviews, locked); print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0 if not failed else 1


if __name__ == "__main__":
    raise SystemExit(main())
