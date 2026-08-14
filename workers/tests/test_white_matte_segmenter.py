from __future__ import annotations

from io import BytesIO

import numpy as np
from PIL import Image, ImageDraw

from src.white_matte_segmenter import segment_source_image, segment_white_matte


def _decode(data: bytes) -> np.ndarray:
    with Image.open(BytesIO(data)) as image:
        return np.asarray(image.convert("RGBA"))


def test_white_matte_segmenter_returns_cropped_rgba_subjects() -> None:
    image = Image.new("RGB", (1376, 768), "white")
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((90, 120, 500, 620), radius=36, fill=(30, 170, 210))
    draw.ellipse((800, 190, 1200, 560), fill=(220, 90, 45))

    with BytesIO() as source:
        image.save(source, format="PNG")
        source_bytes = source.getvalue()

    letter_bytes, object_bytes = segment_white_matte(source_bytes, "A", "Object")
    letter = _decode(letter_bytes)
    object_image = _decode(object_bytes)

    assert letter.shape[2] == 4
    assert object_image.shape[2] == 4
    assert letter[..., 3].max() == 255
    assert object_image[..., 3].max() == 255
    assert letter[0, 0, 3] == 0
    assert object_image[0, 0, 3] == 0
    assert letter.shape[0] < 768 and letter.shape[1] < 562
    assert object_image.shape[0] < 768 and object_image.shape[1] < 678


def test_white_matte_segmenter_removes_matte_frame_and_preserves_small_white_highlights() -> None:
    image = Image.new("RGB", (1376, 768), "white")
    draw = ImageDraw.Draw(image)

    # Some generated source composites contain a thin dark rectangle around
    # the letter/object panel. It is a matte artifact, not foreground content.
    draw.rectangle((55, 100, 575, 625), outline=(24, 24, 24), width=4)
    # A few composites also carry a long annotation rule at the ROI edge.
    draw.line((35, 90, 35, 635), fill=(24, 24, 24), width=6)
    draw.rounded_rectangle((180, 180, 430, 540), radius=32, fill=(25, 165, 205))

    # A small white highlight is part of the physical object and must remain
    # opaque after matte removal.
    draw.ellipse((275, 255, 305, 285), fill="white")
    # A large enclosed white hole is real negative space and must stay clear.
    draw.ellipse((245, 315, 365, 485), fill="white")
    draw.ellipse((800, 190, 1200, 560), fill=(220, 90, 45))

    with BytesIO() as source:
        image.save(source, format="PNG")
        source_bytes = source.getvalue()

    letter_bytes, _ = segment_white_matte(source_bytes, "A", "Object")
    letter = _decode(letter_bytes)

    # The inset frame is gone, so the crop follows the rounded letter only.
    assert letter.shape[1] < 500
    assert letter.shape[0] < 430

    # Coordinates are relative to the cropped subject (the subject starts at
    # roughly x=178, y=178 with the current padding contract).
    assert letter[92, 112, 3] > 0
    assert letter[222, 187, 3] == 0


def test_white_matte_segmenter_removes_frame_when_it_touches_subject() -> None:
    image = Image.new("RGB", (1376, 768), "white")
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((180, 170, 500, 640), radius=36, fill=(25, 165, 205))
    # The generated guide is sometimes drawn over the subject, which makes
    # its bottom edge one connected component with the foreground.
    draw.rectangle((80, 100, 575, 640), outline=(24, 24, 24), width=4)
    draw.ellipse((820, 210, 1190, 565), fill=(220, 90, 48))

    with BytesIO() as source:
        image.save(source, format="PNG")
        source_bytes = source.getvalue()

    letter_bytes, _ = segment_white_matte(source_bytes, "A", "Object")
    letter = _decode(letter_bytes)
    dark = (letter[..., :3].max(axis=2) < 80) & (letter[..., 3] > 180)

    assert letter.shape[1] < 400
    assert letter.shape[0] < 500
    assert np.count_nonzero(dark) < 100


def test_reference_segmenter_removes_scene_and_guide_frame() -> None:
    background = Image.new("RGB", (1376, 768), (72, 184, 218))
    background_draw = ImageDraw.Draw(background)
    background_draw.rectangle((0, 500, 1376, 768), fill=(226, 190, 106))

    composite = background.copy()
    draw = ImageDraw.Draw(composite)
    draw.rounded_rectangle((180, 170, 500, 610), radius=36, fill=(34, 154, 190))
    draw.ellipse((820, 210, 1190, 565), fill=(220, 90, 48))
    # These are the guide rectangles and transcript artifacts from a bad
    # generated composite; neither should survive in a foreground PNG.
    draw.rectangle((80, 100, 575, 640), outline=(32, 32, 32), width=4)
    draw.rectangle((750, 100, 1300, 640), outline=(32, 32, 32), width=4)
    draw.rectangle((430, 675, 520, 735), fill=(10, 150, 60))
    draw.rectangle((535, 675, 625, 735), fill=(10, 150, 60))

    with BytesIO() as source_output, BytesIO() as background_output:
        composite.save(source_output, format="PNG")
        background.save(background_output, format="PNG")
        letter_bytes, object_bytes = segment_source_image(
            source_output.getvalue(),
            "A",
            "Object",
            background=background_output.getvalue(),
        )

    letter = _decode(letter_bytes)
    object_image = _decode(object_bytes)
    assert letter[..., 3].max() == 255
    assert object_image[..., 3].max() == 255
    assert letter[0, 0, 3] == 0
    assert object_image[0, 0, 3] == 0
    assert np.count_nonzero(letter[:, 0, 3]) == 0
    assert np.count_nonzero(object_image[:, 0, 3]) == 0
    assert letter.shape[0] < 540
    assert object_image.shape[0] < 500
