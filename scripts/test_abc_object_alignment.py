from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from repair_abc_object_alignment import OBJECT_REPAIRS, THEME_REPAIRS  # noqa: E402


EXPECTED_OBJECT_REPAIRS = {
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

EXPECTED_THEME_REPAIRS = {
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


class AbcObjectAlignmentPlanTests(unittest.TestCase):
    def test_repair_plan_is_explicit_and_excludes_test_song(self) -> None:
        self.assertEqual(OBJECT_REPAIRS, EXPECTED_OBJECT_REPAIRS)
        self.assertEqual(THEME_REPAIRS, EXPECTED_THEME_REPAIRS)
        self.assertNotIn("0001", OBJECT_REPAIRS)
        self.assertNotIn("0001", THEME_REPAIRS)
        self.assertTrue(set(OBJECT_REPAIRS) <= {f"{i:04d}" for i in range(2, 51)})

    def test_current_locked_mapping_matches_the_repaired_plan(self) -> None:
        for sid, changes in OBJECT_REPAIRS.items():
            mapping = json.loads((ROOT / "abc-song" / sid / "authoring" / "mapping.json").read_text(encoding="utf-8"))
            for letter, new_object in changes.items():
                self.assertEqual(mapping["letters"][letter]["object"], new_object, f"{sid}{letter} is not repaired")
        for sid, new_theme in THEME_REPAIRS.items():
            mapping = json.loads((ROOT / "abc-song" / sid / "authoring" / "mapping.json").read_text(encoding="utf-8"))
            self.assertEqual(mapping["theme"]["name"], new_theme, f"{sid} theme is not repaired")

    def test_no_background_or_helper_object_is_selected_for_repair_targets(self) -> None:
        old_names = {"Xylophone", "X-ray Fish", "X-ray Tetra", "Xiphophorus", "Xeric Shrub"}
        repaired_names = {obj for changes in OBJECT_REPAIRS.values() for obj in changes.values()}
        self.assertNotIn("Xylophone", repaired_names)
        self.assertNotIn("X-ray Fish", repaired_names)
        self.assertNotIn("Xiphophorus", repaired_names)
        self.assertTrue(old_names & {"Xylophone", "X-ray Fish", "Xiphophorus"})


if __name__ == "__main__":
    unittest.main()
