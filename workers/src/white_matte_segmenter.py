"""Deterministic segmentation adapters for ABC source composites.

The preferred prompt contract generates a solid ``#FFFFFF`` matte, but image
generators sometimes return the authored scene with guide rectangles and text.
When the clean background image is available, reference differencing removes
that scene while retaining the letter/object. Both paths share the same
component cleanup so guide frames do not become foreground assets.
"""

from __future__ import annotations

import argparse
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

REFERENCE_WIDTH = 1376
REFERENCE_HEIGHT = 768
LETTER_AREA = (35, 78, 597, 636)
OBJECT_AREA = (642, 78, 1320, 636)
MATTE_NOISE_FLOOR = 5.0
MATTE_FULL_ALPHA_DISTANCE = 30.0
REFERENCE_DIFF_NOISE_FLOOR = 16.0
REFERENCE_DIFF_FULL_ALPHA_DISTANCE = 64.0
MIN_COMPONENT_AREA = 32
FRAME_MIN_WIDTH_RATIO = 0.55
FRAME_MIN_HEIGHT_RATIO = 0.55
FRAME_MAX_FILL_RATIO = 0.12
MAX_FILLED_HOLE_RATIO = 0.015
EDGE_NOISE_MAX_RATIO = 0.01
SUBJECT_COMPONENT_JOIN_DISTANCE = 18
WHITE_CORNER_NOISE_LIMIT = 8.0
SOURCE_SIDE_OVERLAP_RATIO = 0.06
GUIDE_LINE_DARK_LIMIT = 200
GUIDE_LINE_GRAY_TOLERANCE = 18
GUIDE_LINE_MIN_RATIO = 0.35

__all__ = ["segment_source_image", "segment_white_matte", "segment_white_matte_file"]


def segment_white_matte(
    source: bytes | bytearray | str | Path,
    letter: str,
    object_name: str,
) -> tuple[bytes, bytes]:
    """Return cropped RGBA PNG bytes using the white-matte adapter."""

    del letter, object_name  # identity is encoded by the two fixed source ROIs
    rgb = _read_rgb(source)
    letter_rgba, object_rgba = _segment_white_rgb(rgb)
    return _encode_png(letter_rgba), _encode_png(object_rgba)


def segment_source_image(
    source: bytes | bytearray | str | Path,
    letter: str,
    object_name: str,
    *,
    background: bytes | bytearray | str | Path | None = None,
) -> tuple[bytes, bytes]:
    """Segment a source composite, using its clean background when present.

    White-matte composites use distance-to-white. A non-white composite is
    only accepted when a matching background reference is supplied; silently
    treating a scene as white matte would preserve the whole scene and guide
    boxes as foreground.
    """

    del letter, object_name
    rgb = _read_rgb(source)
    if _looks_like_white_matte(rgb):
        letter_rgba, object_rgba = _segment_white_rgb(rgb)
    else:
        if background is None:
            raise ValueError(
                "non-white ABC source composite requires its clean background reference"
            )
        reference = _read_rgb(background)
        reference = _resize_rgb(reference, width=rgb.shape[1], height=rgb.shape[0])
        letter_rgba, object_rgba = _segment_reference_rgb(rgb, reference)
    return _encode_png(letter_rgba), _encode_png(object_rgba)


def segment_white_matte_file(
    source_path: str | Path,
    letter: str,
    object_name: str,
    letter_out: str | Path,
    object_out: str | Path,
    background: str | Path | None = None,
) -> None:
    """CLI-facing file adapter used by ``prepare-assets``."""

    segmenter = segment_source_image if background is not None else segment_white_matte
    if background is None:
        letter_bytes, object_bytes = segmenter(source_path, letter, object_name)
    else:
        letter_bytes, object_bytes = segmenter(
            source_path,
            letter,
            object_name,
            background=background,
        )
    Path(letter_out).write_bytes(letter_bytes)
    Path(object_out).write_bytes(object_bytes)


def _scale_area(area: tuple[int, int, int, int], width: int, height: int) -> tuple[int, int, int, int]:
    x0, y0, x1, y1 = area
    return (
        max(0, round(x0 * width / REFERENCE_WIDTH)),
        max(0, round(y0 * height / REFERENCE_HEIGHT)),
        min(width, round(x1 * width / REFERENCE_WIDTH)),
        min(height, round(y1 * height / REFERENCE_HEIGHT)),
    )


def _read_rgb(source: bytes | bytearray | str | Path) -> np.ndarray:
    image = Image.open(source if isinstance(source, (str, Path)) else BytesIO(bytes(source)))
    try:
        return np.asarray(image.convert("RGB"), dtype=np.uint8).copy()
    finally:
        image.close()


def _resize_rgb(rgb: np.ndarray, *, width: int, height: int) -> np.ndarray:
    if rgb.shape[1] == width and rgb.shape[0] == height:
        return rgb
    image = Image.fromarray(rgb, mode="RGB")
    try:
        return np.asarray(image.resize((width, height), Image.Resampling.LANCZOS), dtype=np.uint8)
    finally:
        image.close()


def _looks_like_white_matte(rgb: np.ndarray) -> bool:
    height, width = rgb.shape[:2]
    patch = max(8, min(height, width) // 32)
    corners = np.concatenate(
        [
            rgb[:patch, :patch].reshape(-1, 3),
            rgb[:patch, -patch:].reshape(-1, 3),
            rgb[-patch:, :patch].reshape(-1, 3),
            rgb[-patch:, -patch:].reshape(-1, 3),
        ],
        axis=0,
    )
    distance = 255.0 - corners.min(axis=1).astype(np.float32)
    return float(np.mean(distance)) <= WHITE_CORNER_NOISE_LIMIT


def _segment_white_rgb(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Segment the full left/right source halves instead of fixed-height ROIs."""

    letter_region, object_region = _split_source_sides(rgb)
    letter_rgba = _extract_white_region(letter_region)
    object_rgba = _extract_white_region(object_region)
    return letter_rgba, object_rgba


def _segment_reference_rgb(rgb: np.ndarray, reference: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Remove a matching scene by keeping only pixels changed by the overlay."""

    letter_region, object_region = _split_source_sides(rgb)
    reference_letter, reference_object = _split_source_sides(reference)
    letter_rgba = _extract_reference_region(letter_region, reference_letter)
    object_rgba = _extract_reference_region(object_region, reference_object)
    return letter_rgba, object_rgba


def _split_source_sides(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Use a small overlap so subjects spilling over the center are not cut."""

    midpoint = rgb.shape[1] // 2
    overlap = max(16, round(rgb.shape[1] * SOURCE_SIDE_OVERLAP_RATIO))
    return rgb[:, : min(rgb.shape[1], midpoint + overlap)], rgb[:, max(0, midpoint - overlap) :]


def _extract_white_region(roi: np.ndarray) -> np.ndarray:
    distance = 255.0 - roi.min(axis=2).astype(np.float32)
    alpha = np.clip(
        (distance - MATTE_NOISE_FLOOR)
        * 255.0
        / (MATTE_FULL_ALPHA_DISTANCE - MATTE_NOISE_FLOOR),
        0.0,
        255.0,
    ).astype(np.uint8)
    mask = alpha > 0
    mask = _remove_guide_lines(roi, mask)
    mask = _remove_matte_artifacts(mask)
    mask = _select_primary_subject(mask)
    mask = _restore_small_enclosed_highlights(mask)
    return _crop_rgba(roi, alpha, mask)


def _extract_reference_region(roi: np.ndarray, reference: np.ndarray) -> np.ndarray:
    difference = np.abs(roi.astype(np.int16) - reference.astype(np.int16)).max(axis=2).astype(np.float32)
    alpha = np.clip(
        (difference - REFERENCE_DIFF_NOISE_FLOOR)
        * 255.0
        / (REFERENCE_DIFF_FULL_ALPHA_DISTANCE - REFERENCE_DIFF_NOISE_FLOOR),
        0.0,
        255.0,
    ).astype(np.uint8)
    mask = difference > REFERENCE_DIFF_NOISE_FLOOR
    mask = ndimage.binary_closing(mask, structure=np.ones((3, 3), dtype=bool))
    mask = _remove_guide_lines(roi, mask)
    mask = _remove_matte_artifacts(mask)
    mask = _select_primary_subject(mask)
    return _crop_rgba(roi, alpha, mask)


def _crop_rgba(roi: np.ndarray, alpha: np.ndarray, mask: np.ndarray) -> np.ndarray:
    alpha = np.where(mask & (alpha == 0), 255, alpha).astype(np.uint8)
    ys, xs = np.where(mask)
    if xs.size == 0 or ys.size == 0:
        raise ValueError("segmentation found no foreground pixels")

    padding = 5
    crop_x0 = max(0, int(xs.min()) - padding)
    crop_y0 = max(0, int(ys.min()) - padding)
    crop_x1 = min(roi.shape[1], int(xs.max()) + padding + 1)
    crop_y1 = min(roi.shape[0], int(ys.max()) + padding + 1)
    cropped_rgb = roi[crop_y0:crop_y1, crop_x0:crop_x1]
    cropped_alpha = alpha[crop_y0:crop_y1, crop_x0:crop_x1]
    cropped_alpha = np.where(
        mask[crop_y0:crop_y1, crop_x0:crop_x1], cropped_alpha, 0
    ).astype(np.uint8)
    return np.dstack((cropped_rgb, cropped_alpha))


def _remove_guide_lines(rgb: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Remove long neutral rules that can be connected to a subject edge."""

    if not np.any(mask):
        return mask

    minimum_length = max(24, round(min(rgb.shape[:2]) * GUIDE_LINE_MIN_RATIO))
    channel_spread = rgb.max(axis=2).astype(np.int16) - rgb.min(axis=2).astype(np.int16)
    neutral_dark = (
        (rgb.max(axis=2) <= GUIDE_LINE_DARK_LIMIT)
        & (channel_spread <= GUIDE_LINE_GRAY_TOLERANCE)
        & mask
    )
    horizontal_rows = neutral_dark.sum(axis=1) >= minimum_length
    vertical_columns = neutral_dark.sum(axis=0) >= minimum_length
    horizontal = neutral_dark & horizontal_rows[:, np.newaxis]
    vertical = neutral_dark & vertical_columns[np.newaxis, :]
    guide_pixels = ndimage.binary_dilation(
        horizontal | vertical,
        structure=np.ones((3, 3), dtype=bool),
    )
    return mask & ~guide_pixels


def _select_primary_subject(mask: np.ndarray) -> np.ndarray:
    """Drop text and detached guide artifacts after frame removal."""

    labels, count = ndimage.label(mask, structure=np.ones((3, 3), dtype=np.uint8))
    if count == 0:
        return mask
    sizes = np.bincount(labels.ravel(), minlength=count + 1)
    main_id = int(np.argmax(sizes[1:]) + 1)
    main_area = int(sizes[main_id])
    main_slice = ndimage.find_objects(labels)[main_id - 1]
    if main_slice is None:
        return mask
    main_y, main_x = main_slice
    keep = labels == main_id
    for label_id in range(1, count + 1):
        if label_id == main_id:
            continue
        area = int(sizes[label_id])
        if area < MIN_COMPONENT_AREA or area > main_area * 0.2:
            continue
        component_slice = ndimage.find_objects(labels)[label_id - 1]
        if component_slice is None:
            continue
        component_y, component_x = component_slice
        x_gap = max(component_x.start - main_x.stop, main_x.start - component_x.stop, 0)
        y_gap = max(component_y.start - main_y.stop, main_y.start - component_y.stop, 0)
        if max(x_gap, y_gap) <= SUBJECT_COMPONENT_JOIN_DISTANCE:
            keep |= labels == label_id
    return keep


def _remove_matte_artifacts(mask: np.ndarray) -> np.ndarray:
    """Keep foreground components while dropping thin inset matte frames/noise."""

    labels, count = ndimage.label(mask, structure=np.ones((3, 3), dtype=np.uint8))
    if count == 0:
        return mask

    sizes = np.bincount(labels.ravel(), minlength=count + 1)
    height, width = mask.shape
    component_slices = ndimage.find_objects(labels)
    components: list[tuple[int, tuple[slice, slice], int, int, int, float, bool]] = []
    for label_id, component_slice in enumerate(component_slices, start=1):
        if component_slice is None:
            continue
        area = int(sizes[label_id])
        if area < MIN_COMPONENT_AREA:
            continue
        y_slice, x_slice = component_slice
        y0, y1 = y_slice.start, y_slice.stop
        x0, x1 = x_slice.start, x_slice.stop
        component_height = y1 - y0
        component_width = x1 - x0
        fill_ratio = area / max(1, component_width * component_height)
        touches_edge = x0 == 0 or y0 == 0 or x1 == width or y1 == height
        components.append(
            (
                label_id,
                component_slice,
                area,
                component_width,
                component_height,
                fill_ratio,
                touches_edge,
            )
        )

    largest_component = max((item[2] for item in components), default=0)
    keep = np.zeros_like(mask, dtype=bool)
    for (
        label_id,
        component_slice,
        area,
        component_width,
        component_height,
        fill_ratio,
        touches_edge,
    ) in components:
        is_inset_frame = (
            component_width >= width * FRAME_MIN_WIDTH_RATIO
            and component_height >= height * FRAME_MIN_HEIGHT_RATIO
            and fill_ratio <= FRAME_MAX_FILL_RATIO
        )
        is_long_rule = (
            fill_ratio <= 0.4
            and (
                (
                    component_height >= height * 0.45
                    and component_width <= width * 0.08
                )
                or (
                    component_width >= width * 0.45
                    and component_height <= height * 0.08
                )
            )
        )
        is_edge_rule = touches_edge and (
            (
                component_height >= height * 0.45
                and component_width <= width * 0.08
            )
            or (
                component_width >= width * 0.45
                and component_height <= height * 0.08
            )
        )
        is_edge_noise = touches_edge and (
            area <= largest_component * EDGE_NOISE_MAX_RATIO or is_edge_rule
        )
        if not is_inset_frame and not is_long_rule and not is_edge_noise:
            keep[component_slice] |= labels[component_slice] == label_id

    # A pathological source should still fail clearly in the caller rather
    # than silently producing a fully empty PNG.
    return keep if np.any(keep) else mask


def _restore_small_enclosed_highlights(mask: np.ndarray) -> np.ndarray:
    """Restore small white highlights without filling letter holes."""

    if not np.any(mask):
        return mask
    labels, count = ndimage.label(mask, structure=np.ones((3, 3), dtype=np.uint8))
    sizes = np.bincount(labels.ravel(), minlength=count + 1)
    largest_component = int(sizes[1:].max(initial=0))
    if largest_component == 0:
        return mask

    filled = ndimage.binary_fill_holes(mask)
    holes = filled & ~mask
    hole_labels, hole_count = ndimage.label(
        holes, structure=np.ones((3, 3), dtype=np.uint8)
    )
    max_hole_area = max(512, int(largest_component * MAX_FILLED_HOLE_RATIO))
    restored = mask.copy()
    hole_sizes = np.bincount(hole_labels.ravel(), minlength=hole_count + 1)
    for hole_id in range(1, hole_count + 1):
        if int(hole_sizes[hole_id]) <= max_hole_area:
            restored[hole_labels == hole_id] = True
    return restored


def _encode_png(rgba: np.ndarray) -> bytes:
    image = Image.fromarray(rgba, mode="RGBA")
    with BytesIO() as output:
        image.save(output, format="PNG", optimize=True)
        return output.getvalue()


def _main() -> None:
    parser = argparse.ArgumentParser(description="Extract two transparent PNGs from a white ABC composite")
    parser.add_argument("--input", required=True)
    parser.add_argument("--letter", required=True)
    parser.add_argument("--object", required=True)
    parser.add_argument("--letter-out", required=True)
    parser.add_argument("--object-out", required=True)
    args = parser.parse_args()
    segment_white_matte_file(
        args.input,
        args.letter,
        args.object,
        args.letter_out,
        args.object_out,
    )


if __name__ == "__main__":
    _main()
