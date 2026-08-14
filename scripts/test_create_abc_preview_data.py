import json
import tempfile
import unittest
from pathlib import Path

from scripts.create_abc_preview_data import (
    create_preview_data,
    detect_target,
    find_target_events,
)


class PreviewTargetDetectionTests(unittest.TestCase):
    mapping = {
        "A": "Angelfish",
        "F": "Fish",
        "G": "Grouper",
        "K": "Kayak",
    }

    def test_requires_the_letter_and_object_pair_instead_of_any_object_word(self):
        self.assertIsNone(detect_target("building reefs where fish hide.", self.mapping))

    def test_accepts_letter_first_target_phrasing(self):
        self.assertEqual(
            detect_target("from water near. G ... Grouper!", self.mapping),
            ("G", "Grouper"),
        )

    def test_accepts_object_first_target_phrasing(self):
        self.assertEqual(
            detect_target("Kayak - that's K, paddle in hand", self.mapping),
            ("K", "Kayak"),
        )

    def test_finds_targets_when_lrc_splits_the_phrase_across_timestamps(self):
        entries = [
            (90.0, "built from shore. Kayak - that's"),
            (96.0, "K, paddle in hand"),
            (100.0, "A ... Angelfish! L ... Lobster!"),
        ]

        events = find_target_events(entries, {"A": "Angelfish", "K": "Kayak", "L": "Lobster"})

        self.assertEqual(events, [(90.0, "K", "Kayak"), (100.0, "A", "Angelfish"), (100.0, "L", "Lobster")])

    def test_keeps_model_background_as_a_render_variant(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest = root / "asset-manifest.json"
            lrc = root / "lyrics.lrc"
            manifest.write_text(
                json.dumps(
                    {
                        "letters": {
                            "A": {
                                "objectName": "Angelfish",
                                "letter": {"src": "letters/A.png"},
                                "object": {"src": "object-groups/A.png"},
                            }
                        }
                    }
                ),
                encoding="utf-8",
            )
            lrc.write_text("[00:00.00]A ... Angelfish", encoding="utf-8")

            data = create_preview_data(
                manifest_path=manifest,
                lrc_path=lrc,
                preview_dir=root,
                background="background.png",
                background_render="background-4k-model.png",
                song_logo="logo.png",
                audio="audio.mp3",
                audio_duration=4,
            )

            self.assertEqual(
                data["assets"]["backgroundRender"],
                "background-4k-model.png",
            )


if __name__ == "__main__":
    unittest.main()
