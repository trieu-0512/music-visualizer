from __future__ import annotations

import csv
import difflib
import hashlib
import itertools
import json
import re
import statistics
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
GENERIC_TITLE_TOKENS = {
    "adventure", "abc", "day", "discovery", "friends", "learning", "little", "parade", "world"
}


def _norm(text: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", text.casefold()))


def _mapping_signature(mapping: dict[str, str]) -> str:
    canonical = "|".join(f"{letter}:{_norm(mapping[letter])}" for letter in LETTERS)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def audit_catalog(root: Path) -> dict[str, Any]:
    failures: list[str] = []
    warnings: list[str] = []
    expected_ids = [f"{i:04d}" for i in range(1, 201)]
    actual_ids = sorted(path.name for path in root.iterdir() if path.is_dir() and path.name.isdigit())
    if actual_ids != expected_ids:
        failures.append("song ids are not exactly 0001-0200")

    rows = list(csv.DictReader((root / "themes.csv").open(encoding="utf-8")))
    if len(rows) != 200:
        failures.append(f"themes.csv has {len(rows)} rows instead of 200")

    theme_counts = Counter(_norm(row["theme"]) for row in rows)
    duplicate_themes = sorted(theme for theme, count in theme_counts.items() if count > 1)
    if duplicate_themes:
        failures.append(f"duplicate theme names: {duplicate_themes[:10]}")

    domain_counts = Counter(row["macro_domain"] for row in rows)
    macro_domains = len(domain_counts)
    max_per_domain = max(domain_counts.values(), default=0)
    if macro_domains < 40:
        failures.append(f"only {macro_domains} macro domains; require >= 40")
    if max_per_domain > 5:
        failures.append(f"macro domain contains {max_per_domain} songs; require <= 5")

    mappings: dict[str, dict[str, str]] = {}
    signatures: defaultdict[str, list[str]] = defaultdict(list)
    for sid in expected_ids:
        path = root / sid / "mapping.proposal.json"
        if not path.is_file():
            failures.append(f"{sid}: missing mapping.proposal.json")
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        if payload.get("state") != "PROPOSED":
            failures.append(f"{sid}: mapping state is not PROPOSED")
        letters = payload.get("letters", {})
        if set(letters) != set(LETTERS):
            failures.append(f"{sid}: A-Z mapping incomplete")
            continue
        mapping = {letter: str(letters[letter].get("object", "")).strip() for letter in LETTERS}
        for letter, obj in mapping.items():
            if not obj or obj[0].upper() != letter:
                failures.append(f"{sid}: {letter} -> {obj!r} violates first-letter fit")
        mappings[sid] = mapping
        signatures[_mapping_signature(mapping)].append(sid)

    duplicate_mapping_groups = [ids for ids in signatures.values() if len(ids) > 1]
    if duplicate_mapping_groups:
        failures.append(f"exact duplicate mapping groups: {duplicate_mapping_groups[:5]}")

    pair_sims: list[tuple[float, str, str]] = []
    within_sims: list[float] = []
    cross_sims: list[float] = []
    row_by_id = {row["song_id"]: row for row in rows}
    for a, b in itertools.combinations(sorted(mappings), 2):
        aset = {_norm(v) for v in mappings[a].values()}
        bset = {_norm(v) for v in mappings[b].values()}
        sim = len(aset & bset) / len(aset | bset)
        pair_sims.append((sim, a, b))
        if row_by_id.get(a, {}).get("macro_domain") == row_by_id.get(b, {}).get("macro_domain"):
            within_sims.append(sim)
        else:
            cross_sims.append(sim)

    pair_sims.sort(reverse=True)
    max_jaccard = pair_sims[0][0] if pair_sims else 0.0
    if max_jaccard > 0.40:
        failures.append(f"max mapping Jaccard {max_jaccard:.3f} exceeds 0.40")
    within_mean = statistics.mean(within_sims) if within_sims else 0.0
    if within_mean > 0.35:
        warnings.append(f"within-domain mean Jaccard {within_mean:.3f} exceeds preferred 0.35")

    name_pairs: list[tuple[float, str, str, str, str]] = []
    for left, right in itertools.combinations(rows, 2):
        score = difflib.SequenceMatcher(None, _norm(left["theme"]), _norm(right["theme"])).ratio()
        if score >= 0.82:
            name_pairs.append((score, left["song_id"], left["theme"], right["song_id"], right["theme"]))
    name_pairs.sort(reverse=True)
    fail_name_pairs = [pair for pair in name_pairs if pair[0] >= 0.90]
    if fail_name_pairs:
        failures.append(f"{len(fail_name_pairs)} theme-name pairs have similarity >= 0.90")
    elif name_pairs:
        warnings.append(f"{len(name_pairs)} theme-name pairs are in the 0.82-0.89 review band")

    token_counts = Counter(token for row in rows for token in _norm(row["theme"]).split())
    generic_usage = {token: token_counts[token] for token in sorted(GENERIC_TITLE_TOKENS) if token_counts[token]}
    overused_generic = {token: count for token, count in generic_usage.items() if count > 12}
    if overused_generic:
        warnings.append(f"generic title tokens used >12 times: {overused_generic}")

    report: dict[str, Any] = {
        "status": "READY_FOR_MAPPING_REVIEW" if not failures else "REWORK",
        "songs": len(rows),
        "unique_themes": len(theme_counts),
        "macro_domains": macro_domains,
        "max_songs_per_domain": max_per_domain,
        "unique_mappings": len(signatures),
        "duplicate_mapping_groups": duplicate_mapping_groups,
        "max_mapping_jaccard": max_jaccard,
        "within_domain_mapping_jaccard_mean": within_mean,
        "cross_domain_mapping_jaccard_mean": statistics.mean(cross_sims) if cross_sims else 0.0,
        "top_mapping_similarity_pairs": [
            {"similarity": round(sim, 4), "a": a, "b": b} for sim, a, b in pair_sims[:20]
        ],
        "near_name_pairs": [
            {"similarity": round(score, 4), "a": aid, "a_theme": at, "b": bid, "b_theme": bt}
            for score, aid, at, bid, bt in name_pairs[:50]
        ],
        "generic_title_token_usage": generic_usage,
        "failures": failures,
        "warnings": warnings,
    }
    return report


def write_reports(root: Path, report: dict[str, Any]) -> None:
    (root / "DIVERSITY_AUDIT.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    lines = [
        "# ABC Song Catalog Diversity Audit",
        "",
        f"Status: **{report['status']}**",
        "",
        f"- Songs: {report['songs']}",
        f"- Unique theme names: {report['unique_themes']}",
        f"- Macro domains: {report['macro_domains']}",
        f"- Max songs per macro domain: {report['max_songs_per_domain']}",
        f"- Unique A-Z mappings: {report['unique_mappings']}",
        f"- Exact duplicate mapping groups: {len(report['duplicate_mapping_groups'])}",
        f"- Max pairwise mapping Jaccard: {report['max_mapping_jaccard']:.3f}",
        f"- Within-domain mean mapping Jaccard: {report['within_domain_mapping_jaccard_mean']:.3f}",
        f"- Cross-domain mean mapping Jaccard: {report['cross_domain_mapping_jaccard_mean']:.3f}",
        "",
        "## Naming token usage",
        "",
    ]
    for token, count in report["generic_title_token_usage"].items():
        lines.append(f"- {token}: {count}")
    lines.extend(["", "## Warnings", ""])
    lines.extend(f"- {item}" for item in report["warnings"] or ["None"])
    lines.extend(["", "## Failures", ""])
    lines.extend(f"- {item}" for item in report["failures"] or ["None"])
    lines.extend(["", "## Highest mapping overlaps", "", "| Similarity | Song A | Song B |", "|---:|---:|---:|"])
    for item in report["top_mapping_similarity_pairs"][:15]:
        lines.append(f"| {item['similarity']:.3f} | {item['a']} | {item['b']} |")
    lines.extend(["", "## Near-name review band", "", "| Similarity | Theme A | Theme B |", "|---:|---|---|"])
    for item in report["near_name_pairs"][:20]:
        lines.append(f"| {item['similarity']:.3f} | {item['a']} {item['a_theme']} | {item['b']} {item['b_theme']} |")
    lines.append("")
    (root / "DIVERSITY_AUDIT.md").write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    catalog = Path(__file__).resolve().parents[1] / "abc-song"
    result = audit_catalog(catalog)
    write_reports(catalog, result)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    raise SystemExit(0 if result["status"] == "READY_FOR_MAPPING_REVIEW" else 1)
