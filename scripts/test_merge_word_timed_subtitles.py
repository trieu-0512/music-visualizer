import importlib.util
import sys
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("merge_word_timed_subtitles.py")
spec = importlib.util.spec_from_file_location("merge_word_timed_subtitles", MODULE_PATH)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)


class MergeWordTimedSubtitlesTests(unittest.TestCase):
    def test_merges_one_cue_per_canonical_lyric_line_and_keeps_word_times(self):
        cues = [
            module.SrtCue(0.0, 0.2, "A"),
            module.SrtCue(0.3, 0.5, "is"),
            module.SrtCue(0.6, 0.9, "Cat |"),
            module.SrtCue(1.0, 1.2, "runs."),
        ]
        canonical = [{"id": "r-A", "text": "A is Cat runs."}]
        merged = module.align_cues_to_lines(cues, canonical)

        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0].text, "A is Cat runs")
        self.assertEqual(merged[0].start, 0.0)
        self.assertEqual(merged[0].end, 1.2)
        self.assertEqual([word.text for word in merged[0].words], ["A", "is", "Cat", "runs"])

    def test_rejects_a_missing_or_reordered_word_instead_of_silently_splitting(self):
        cues = [module.SrtCue(0.0, 0.2, "A"), module.SrtCue(0.3, 0.5, "dog")]
        with self.assertRaises(module.AlignmentError):
            module.align_cues_to_lines(cues, [{"text": "A is dog"}])


if __name__ == "__main__":
    unittest.main()
