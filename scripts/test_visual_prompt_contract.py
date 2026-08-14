from __future__ import annotations

import json
import re
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from generate_abc_authoring_batch import PROFILES, _visual_object_family, visual_prompt_records  # noqa: E402


class VisualPromptContractTests(unittest.TestCase):
    def test_foreground_object_preserves_real_world_appearance(self) -> None:
        mapping = json.loads((ROOT / "abc-song" / "0001" / "authoring" / "mapping.json").read_text(encoding="utf-8"))
        records = visual_prompt_records("0001", mapping, PROFILES["0001"])

        foreground = records[:26]
        self.assertEqual(len(foreground), 26)
        for record in foreground:
            prompt = record["prompt"]
            self.assertIn("real-world counterpart", prompt)
            self.assertIn("true-to-life colors", prompt)
            self.assertIn("do not recolor", prompt.lower())
            self.assertIn("different from the background's dominant colors", prompt)
            self.assertNotIn("same theme-coherent material and visual style as the letter", prompt)
            self.assertIn("same clean preschool rendering, lighting, and edge clarity as the letter", prompt)

    def test_background_reserves_foreground_colors(self) -> None:
        mapping = json.loads((ROOT / "abc-song" / "0001" / "authoring" / "mapping.json").read_text(encoding="utf-8"))
        background = visual_prompt_records("0001", mapping, PROFILES["0001"])[26]
        prompt = background["prompt"]

        self.assertIn("must not reuse the dominant foreground colors", prompt)
        self.assertIn("muted environmental palette", prompt)
        self.assertIn("foreground subjects remain clearly separated", prompt)

    def test_white_and_no_background_packs_share_background_record(self) -> None:
        mapping = json.loads((ROOT / "abc-song" / "0001" / "authoring" / "mapping.json").read_text(encoding="utf-8"))
        white = visual_prompt_records("0001", mapping, PROFILES["0001"], foreground_mode="white")
        transparent = visual_prompt_records(
            "0001",
            mapping,
            PROFILES["0001"],
            foreground_mode="no-background",
        )

        self.assertEqual(len(white), 28)
        self.assertEqual(len(transparent), 28)
        self.assertEqual([record["id"] for record in white], [record["id"] for record in transparent])
        self.assertEqual(white[26]["prompt"], transparent[26]["prompt"])
        self.assertEqual(white[27]["prompt"], transparent[27]["prompt"])

        for white_record, transparent_record in zip(white[:26], transparent[:26]):
            self.assertIn("exact object word", white_record["prompt"])
            self.assertIn(white_record["object"], white_record["prompt"])
            self.assertIn("guide box", white_record["prompt"].lower())
            self.assertIn("solid pure white #FFFFFF", white_record["prompt"])
            self.assertIn("object description", white_record["prompt"].lower())

            self.assertIn("SVG", transparent_record["prompt"])
            self.assertIn("transparent background", transparent_record["prompt"].lower())
            self.assertIn('viewBox="0 0 1376 768"', transparent_record["prompt"])
            self.assertIn("exact object word", transparent_record["prompt"])
            self.assertIn(f'Below the {transparent_record["object"]}', transparent_record["prompt"])
            self.assertIn(transparent_record["object"], transparent_record["prompt"])
            self.assertIn("guide box", transparent_record["prompt"].lower())
            self.assertNotIn("solid pure white #FFFFFF matte", transparent_record["prompt"])
            self.assertIn("object description", transparent_record["prompt"].lower())

    def test_0001_fixture_keeps_varied_letter_designs_and_stable_song_style(self) -> None:
        mapping = json.loads((ROOT / "abc-song" / "0001" / "authoring" / "mapping.json").read_text(encoding="utf-8"))
        records = visual_prompt_records("0001", mapping, PROFILES["0001"], foreground_mode="no-background")[:26]

        colors: set[str] = set()
        materials: set[str] = set()
        for record in records:
            prompt = record["prompt"]
            match = re.search(r"LETTER DESIGN SPEC: color=[^;]+; hex=(#[0-9A-F]{6}); material=([^;]+);", prompt)
            self.assertIsNotNone(match, record["id"])
            colors.add(match.group(1))
            materials.add(match.group(2))
            self.assertIn("same rendering direction, lighting, edge softness", prompt)
            self.assertIn("do not replace the assigned letter color or material with a default blue", prompt)

        self.assertGreater(len(colors), 1)
        self.assertGreater(len(materials), 1)
        self.assertNotIn("color=blue", " ".join(record["prompt"].lower() for record in records))

    def test_from_0002_letter_design_follows_object_family(self) -> None:
        mapping = json.loads((ROOT / "abc-song" / "0002" / "authoring" / "mapping.json").read_text(encoding="utf-8"))
        records = visual_prompt_records("0002", mapping, PROFILES["0002"], foreground_mode="no-background")
        x_record = next(record for record in records[:26] if record["letter"] == "X")
        self.assertEqual(x_record["object"], "Xanthid Crab")
        self.assertIn("real-world water family", x_record["prompt"])
        self.assertIn("shore crab", x_record["prompt"].lower())
        self.assertIn("OBJECT CARTOONIZATION MODE (water)", x_record["prompt"])
        self.assertIn("no aggression", x_record["prompt"].lower())
        self.assertIn("do not force a color or material onto the object", x_record["prompt"])

    def test_family_specific_cartoonization_keeps_birds_readable(self) -> None:
        mapping = json.loads((ROOT / "abc-song" / "0026" / "authoring" / "mapping.json").read_text(encoding="utf-8"))
        records = visual_prompt_records("0026", mapping, PROFILES["0026"], foreground_mode="no-background")
        x_record = next(record for record in records[:26] if record["letter"] == "X")
        self.assertEqual(x_record["object"], "Xenops")
        self.assertIn("real-world bird family", x_record["prompt"])
        self.assertIn("OBJECT CARTOONIZATION MODE (bird)", x_record["prompt"])
        self.assertIn("real beak", x_record["prompt"].lower())

    def test_0002_to_0050_use_object_family_modes(self) -> None:
        for number in range(2, 51):
            sid = f"{number:04d}"
            mapping = json.loads((ROOT / "abc-song" / sid / "authoring" / "mapping.json").read_text(encoding="utf-8"))
            records = visual_prompt_records(sid, mapping, PROFILES[sid], foreground_mode="no-background")[:26]
            for record in records:
                family = _visual_object_family(record["object"], mapping["theme"]["name"])
                self.assertNotEqual(family, "theme", record["id"])
                self.assertIn(f"OBJECT CARTOONIZATION MODE ({family})", record["prompt"])


if __name__ == "__main__":
    unittest.main()
