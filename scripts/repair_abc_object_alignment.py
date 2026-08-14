from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from review_and_lock_abc_mappings import _familiarity_tier, _risk_flags, review_song


ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "abc-song"


# 0001 is intentionally absent: it is the user's current test song.
OBJECT_REPAIRS: dict[str, dict[str, str]] = {
    "0002": {"X": "Xanthid Crab"},
    "0003": {"X": "Xanthid Crab"},
    "0004": {"X": "Xanthid Crab"},
    "0005": {"X": "Xanthid Crab"},
    "0007": {"X": "X-ray Tetra"},
    "0008": {"Q": "Quillwort", "X": "X-ray Tetra"},
    "0009": {"X": "X-ray Tetra"},
    "0011": {"X": "X-ray Vet Image"},
    "0012": {"F": "Fence"},
    "0013": {"Y": "Yam"},
    "0014": {"F": "Fence"},
    "0015": {"X": "Xylem"},
    "0016": {"Q": "Quince", "X": "Xylem"},
    "0017": {"A": "Ant", "Q": "Queen Butterfly"},
    "0020": {"X": "Xylem"},
    "0021": {"X": "Xylem"},
    "0022": {"X": "Xylem"},
    "0023": {"X": "Xylem", "Z": "Zebra Swallowtail"},
    "0024": {"X": "Xylem"},
    "0025": {"X": "Xylem"},
    "0026": {"X": "Xenops"},
    "0030": {"X": "Xenops"},
    "0036": {"X": "X-shaped Snowflake"},
    "0037": {"X": "X-shaped Snowflake"},
    "0038": {"X": "X-shaped Snowflake"},
    "0039": {"X": "X-shaped Snowflake"},
    "0040": {"X": "X-shaped Snowflake"},
    "0041": {"X": "Xenolith", "Y": "Yarrow"},
    "0042": {"X": "Xenolith", "Y": "Yarrow"},
    "0043": {"X": "Xenolith", "Z": "Zigzag Trail"},
    "0044": {"X": "Xenolith", "Y": "Yarrow"},
    "0045": {"X": "Xenolith", "Y": "Yarrow"},
    "0046": {"X": "X-band Radar"},
    "0050": {"X": "X-band Radar"},
}


THEME_REPAIRS: dict[str, str] = {
    "0008": "Freshwater Life",
    "0011": "Farmyard Life",
    "0013": "Farm Work & Life",
    "0016": "Garden Life & Growing",
    "0017": "Garden Flowers, Bugs & Helpers",
    "0018": "Garden Life & Tools",
    "0019": "Garden Growth & Harvest",
    "0021": "Woodland Life",
    "0023": "Forest Life & Plants",
    "0026": "Rainforest Life",
    "0031": "Desert Life",
    "0033": "Desert Life, Plants & Rocks",
    "0036": "Polar Life",
    "0038": "Frozen Ocean & Arctic Shore",
    "0041": "Mountain Life",
    "0047": "Sky, Clouds & Weather",
    "0048": "Weather Gear & Conditions",
    "0050": "Weather Station & Sky",
}


def _update_theme_file(path: Path, old_name: str, new_name: str) -> None:
    text = path.read_text(encoding="utf-8")
    text = text.replace(f"Theme: {old_name}", f"Theme: {new_name}")
    text = text.replace(f"Semantic Focus: {old_name}", f"Semantic Focus: {new_name}")
    path.write_text(text, encoding="utf-8")


def _update_objects_file(path: Path, mapping: dict[str, Any]) -> None:
    text = path.read_text(encoding="utf-8")
    for letter, entry in mapping["letters"].items():
        text = re.sub(
            rf"(?m)^{re.escape(letter)} -> .*$",
            f"{letter} -> {entry['object']}",
            text,
        )
    path.write_text(text, encoding="utf-8")


def apply_repairs(root: Path = ROOT) -> list[str]:
    changed: list[str] = []
    for sid in sorted(set(OBJECT_REPAIRS) | set(THEME_REPAIRS)):
        if sid == "0001":
            raise AssertionError("0001 is reserved as the user's test song")
        song_dir = root / "abc-song" / sid
        authoring = song_dir / "authoring"
        proposal_path = song_dir / "mapping.proposal.json"
        mapping_path = authoring / "mapping.json"
        proposal = json.loads(proposal_path.read_text(encoding="utf-8"))
        mapping = json.loads(mapping_path.read_text(encoding="utf-8"))
        if proposal.get("state") != "PROPOSED" or mapping.get("state") != "LOCKED":
            raise RuntimeError(f"{sid}: expected PROPOSED proposal and LOCKED mapping")

        old_theme = str(proposal["theme"]["name"])
        new_theme = THEME_REPAIRS.get(sid, old_theme)
        proposal["theme"]["name"] = new_theme
        proposal["theme"]["semanticFocus"] = new_theme
        for letter, new_object in OBJECT_REPAIRS.get(sid, {}).items():
            proposal["letters"][letter]["object"] = new_object
        proposal_path.write_text(json.dumps(proposal, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

        review = review_song(song_dir)
        if review["hardFailures"]:
            raise RuntimeError(f"{sid}: repaired proposal failed review: {review['hardFailures']}")
        mapping["revision"] = int(mapping.get("revision", 1)) + 1
        mapping["theme"]["name"] = new_theme
        mapping["letters"] = review["entries"]
        mapping_path.write_text(json.dumps(mapping, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

        qc = {key: value for key, value in review.items() if key not in {"proposal", "entries"}}
        (song_dir / "mapping-qc.json").write_text(json.dumps(qc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        _update_theme_file(song_dir / "theme.txt", old_theme, new_theme)
        _update_objects_file(song_dir / "objects.txt", mapping)
        changed.append(sid)
    return changed


if __name__ == "__main__":
    print("Repaired songs:", ", ".join(apply_repairs()))
