import unittest

import numpy as np
from PIL import Image, ImageDraw

from scripts.process_abc_no_background_assets import split_foreground


class SplitForegroundTests(unittest.TestCase):
    def make_synthetic_asset(self) -> Image.Image:
        image = Image.new("RGBA", (96, 64), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)

        # The letter sits on the left, while the object starts before the
        # midpoint so a fixed x crop would visibly cut it.
        draw.rounded_rectangle((6, 10, 24, 52), radius=4, fill=(240, 80, 90, 255))
        draw.ellipse((27, 8, 74, 40), fill=(40, 150, 220, 255))
        draw.rectangle((46, 37, 48, 43), fill=(40, 150, 220, 255))
        draw.rounded_rectangle((38, 47, 83, 59), radius=3, fill=(250, 220, 80, 255))

        # A detached semi-transparent speck is not part of either asset.
        image.putpixel((91, 4), (255, 255, 255, 180))
        return image

    def test_keeps_object_that_crosses_the_midpoint_and_splits_the_letter(self):
        result = split_foreground(self.make_synthetic_asset())

        letter_alpha = np.asarray(result.letter)[..., 3]
        group_alpha = np.asarray(result.object_group)[..., 3]

        self.assertGreater(int((letter_alpha > 0).sum()), 500)
        self.assertGreater(int((group_alpha > 0).sum()), 500)
        self.assertEqual(int(letter_alpha[:, 27:].sum()), 0)
        self.assertGreater(int(group_alpha[:, 28:40].sum()), 0)
        self.assertEqual(int(group_alpha[4, 91]), 0)
        self.assertLess(result.letter_bbox[2], result.object_group_bbox[0])

    def test_returns_object_bbox_separate_from_word_bbox(self):
        result = split_foreground(self.make_synthetic_asset())

        self.assertGreater(result.object_bbox[2], 0)
        self.assertGreater(result.object_bbox[3], 0)
        self.assertGreater(result.word_bbox[2], 0)
        self.assertGreater(result.word_bbox[3], 0)
        self.assertLess(result.object_bbox[1] + result.object_bbox[3], 47)

    def test_trims_a_word_that_touches_the_object_component(self):
        image = Image.new("RGBA", (96, 80), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        draw.rounded_rectangle((6, 10, 24, 64), radius=4, fill=(240, 80, 90, 255))
        draw.rounded_rectangle((28, 8, 74, 62), radius=8, fill=(40, 150, 220, 255))
        draw.rounded_rectangle((40, 62, 83, 79), radius=3, fill=(250, 220, 80, 255))

        result = split_foreground(image)

        self.assertLessEqual(result.object_bbox[1] + result.object_bbox[3], 63)
        self.assertGreater(result.word_bbox[2], 0)


if __name__ == "__main__":
    unittest.main()
