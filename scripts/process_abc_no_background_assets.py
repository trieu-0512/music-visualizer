"""Split generated transparent ABC assets into letter and object-word layers.

The source images are already transparent PNGs. This script only uses their
alpha channel and connected components; it never calls an image-generation or
background-removal model.
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
from PIL import Image
from scipy import ndimage


ASSET_RE = re.compile(r"id_(?P<song>\d{4})(?P<letter>[A-Z])_type_lette", re.IGNORECASE)
DEFAULT_ALPHA_THRESHOLD = 24
DEFAULT_MIN_COMPONENT_AREA = 64
DEFAULT_WORD_BAND_RATIO = 0.70
DEFAULT_CONNECTED_WORD_CUT_RATIO = 0.78


@dataclass(frozen=True)
class SplitResult:
    letter: Image.Image
    object_group: Image.Image
    letter_bbox: tuple[int, int, int, int]
    object_bbox: tuple[int, int, int, int]
    object_group_bbox: tuple[int, int, int, int]
    word_bbox: tuple[int, int, int, int]
    diagnostics: dict[str, int | float | str]


@dataclass(frozen=True)
class _Component:
    label: int
    area: int
    x: int
    y: int
    w: int
    h: int
    center_x: float


def _bbox(mask: np.ndarray) -> tuple[int, int, int, int]:
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return (0, 0, 0, 0)
    return (
        int(xs.min()),
        int(ys.min()),
        int(xs.max() - xs.min() + 1),
        int(ys.max() - ys.min() + 1),
    )


def _component_list(labels: np.ndarray, count: int, minimum_area: int) -> list[_Component]:
    components: list[_Component] = []
    slices = ndimage.find_objects(labels)
    for label, component_slice in enumerate(slices, start=1):
        if component_slice is None:
            continue
        ys, xs = component_slice
        component = labels[component_slice] == label
        area = int(component.sum())
        if area < minimum_area:
            continue
        yy, xx = np.where(labels == label)
        components.append(
            _Component(
                label=label,
                area=area,
                x=int(xs.start),
                y=int(ys.start),
                w=int(xs.stop - xs.start),
                h=int(ys.stop - ys.start),
                center_x=float(xx.mean()),
            )
        )
    return sorted(components, key=lambda component: component.area, reverse=True)


def _rgba_from_mask(source: np.ndarray, mask: np.ndarray) -> Image.Image:
    output = np.zeros_like(source)
    output[mask] = source[mask]
    # RGB data under transparent pixels can otherwise produce a fringe in
    # browser decoders and thumbnails even though alpha is zero.
    output[~mask, :3] = 0
    output[~mask, 3] = 0
    return Image.fromarray(output, mode="RGBA")


def _near_component_pixels(
    alpha: np.ndarray,
    core: np.ndarray,
) -> np.ndarray:
    if not core.any():
        return core
    expanded = ndimage.binary_dilation(core, structure=np.ones((3, 3), dtype=bool), iterations=1)
    return expanded & (alpha > 0)


def _trim_connected_object_word(
    labels: np.ndarray,
    object_labels: set[int],
    object_mask: np.ndarray,
    group_mask: np.ndarray,
    height: int,
    word_band_ratio: float,
    connected_word_cut_ratio: float,
    word_component_y: int | None,
) -> tuple[np.ndarray, np.ndarray]:
    """Trim a rare object/word component that touched at the generated edge.

    Most assets have separate object and word components. An island asset can
    have the lower word outline touch the water edge, making one connected
    component. For that case the lower band belongs to the word group, while
    the object bbox is measured above the conservative cut line.
    """
    if not object_labels:
        return object_mask, group_mask

    components = [label for label in object_labels if np.any(labels == label)]
    if len(components) != 1:
        return object_mask, group_mask
    label = components[0]
    ys, xs = np.where(labels == label)
    if len(ys) == 0:
        return object_mask, group_mask
    component_height = int(ys.max() - ys.min() + 1)
    if component_height < int(height * 0.82) or ys.min() > int(height * 0.16):
        return object_mask, group_mask

    cut_y = max(
        int(height * word_band_ratio),
        int(height * connected_word_cut_ratio),
        word_component_y or 0,
    )
    component_near = _near_component_pixels(
        np.where(labels == label, 255, 0).astype(np.uint8),
        labels == label,
    )
    rows = np.indices(labels.shape)[0]
    connected_object = component_near & (rows < cut_y)
    connected_word = component_near & ~connected_object
    object_mask = object_mask & (rows < cut_y)
    group_mask = (group_mask & ~(labels == label)) | connected_object | connected_word
    return object_mask, group_mask


def split_foreground(
    image: Image.Image,
    *,
    alpha_threshold: int = DEFAULT_ALPHA_THRESHOLD,
    min_component_area: int = DEFAULT_MIN_COMPONENT_AREA,
    word_band_ratio: float = DEFAULT_WORD_BAND_RATIO,
    connected_word_cut_ratio: float = DEFAULT_CONNECTED_WORD_CUT_RATIO,
) -> SplitResult:
    """Return letter-only and object-plus-word transparent layers.

    Letter selection is based on the centroid of a connected alpha component,
    not on a fixed x boundary. This keeps long object features such as a horn
    or antennae intact when they cross into the left half of the canvas.
    """
    source = np.asarray(image.convert("RGBA"), dtype=np.uint8)
    alpha = source[..., 3]
    core_mask = alpha >= alpha_threshold
    labels, count = ndimage.label(core_mask, structure=np.ones((3, 3), dtype=np.uint8))
    components = _component_list(labels, count, min_component_area)
    if not components:
        raise ValueError("The image has no connected alpha component above the configured threshold")

    width = source.shape[1]
    letter_candidates = [component for component in components if component.center_x < width * 0.48]
    if not letter_candidates:
        raise ValueError("Could not identify a left-side letter component")
    letter_component = max(letter_candidates, key=lambda component: component.area)

    retained_labels = {component.label for component in components}
    group_labels = retained_labels - {letter_component.label}
    letter_core = labels == letter_component.label
    group_core = np.isin(labels, list(group_labels)) if group_labels else np.zeros_like(core_mask)
    letter_mask = _near_component_pixels(alpha, letter_core)
    group_mask = _near_component_pixels(alpha, group_core)

    word_band_y = int(source.shape[0] * word_band_ratio)
    large_component_area = max(10_000, int(source.shape[0] * source.shape[1] * 0.08))
    object_labels = {
        component.label
        for component in components
        if component.label in group_labels
        and (component.y < word_band_y or component.area >= large_component_area)
    }
    object_core = np.isin(labels, list(object_labels)) if object_labels else np.zeros_like(core_mask)
    object_mask = _near_component_pixels(alpha, object_core)
    object_mask, group_mask = _trim_connected_object_word(
        labels,
        object_labels,
        object_mask,
        group_mask,
        source.shape[0],
        word_band_ratio,
        connected_word_cut_ratio,
        min(
            (component.y for component in components if component.label in group_labels and component.label not in object_labels),
            default=None,
        ),
    )
    word_mask = group_mask & ~object_mask

    letter_image = _rgba_from_mask(source, letter_mask)
    group_image = _rgba_from_mask(source, group_mask)
    return SplitResult(
        letter=letter_image,
        object_group=group_image,
        letter_bbox=_bbox(letter_mask),
        object_bbox=_bbox(object_mask),
        object_group_bbox=_bbox(group_mask),
        word_bbox=_bbox(word_mask),
        diagnostics={
            "width": int(source.shape[1]),
            "height": int(source.shape[0]),
            "componentCount": int(count),
            "retainedComponentCount": int(len(components)),
            "letterComponentArea": int(letter_component.area),
            "objectComponentCount": int(len(object_labels)),
            "alphaThreshold": int(alpha_threshold),
            "wordBandY": int(word_band_y),
        },
    )


def _asset_meta(path: str, image: Image.Image, bbox: tuple[int, int, int, int]) -> dict[str, object]:
    return {
        "src": path,
        "file": {"w": image.width, "h": image.height},
        "bbox": {"x": bbox[0], "y": bbox[1], "w": bbox[2], "h": bbox[3]},
    }


def _load_mapping(mapping_path: Path) -> dict[str, str]:
    payload = json.loads(mapping_path.read_text(encoding="utf-8"))
    return {letter: value["object"] for letter, value in payload["letters"].items()}


def process_directory(
    input_dir: Path,
    output_dir: Path,
    *,
    mapping_path: Path | None = None,
    alpha_threshold: int = DEFAULT_ALPHA_THRESHOLD,
) -> dict[str, object]:
    """Process all 26 letter assets and write a renderer-ready manifest."""
    input_dir = input_dir.resolve()
    output_dir = output_dir.resolve()
    letters_dir = output_dir / "letters"
    groups_dir = output_dir / "object-groups"
    letters_dir.mkdir(parents=True, exist_ok=True)
    groups_dir.mkdir(parents=True, exist_ok=True)

    mapping = _load_mapping(mapping_path) if mapping_path else {}
    entries: dict[str, object] = {}
    source_files = sorted(
        path
        for path in input_dir.glob("*.png")
        if ASSET_RE.search(path.name)
    )
    if len(source_files) != 26:
        raise ValueError(f"Expected 26 letter PNGs in {input_dir}, found {len(source_files)}")

    for source_path in source_files:
        match = ASSET_RE.search(source_path.name)
        assert match is not None
        letter = match.group("letter").upper()
        image = Image.open(source_path).convert("RGBA")
        result = split_foreground(image, alpha_threshold=alpha_threshold)
        letter_path = letters_dir / f"{letter}.png"
        group_path = groups_dir / f"{letter}.png"
        result.letter.save(letter_path, format="PNG", optimize=True)
        result.object_group.save(group_path, format="PNG", optimize=True)

        entries[letter] = {
            "letter": _asset_meta(f"letters/{letter}.png", result.letter, result.letter_bbox),
            "object": {
                **_asset_meta(f"object-groups/{letter}.png", result.object_group, result.object_bbox),
                "groupBbox": {
                    "x": result.object_group_bbox[0],
                    "y": result.object_group_bbox[1],
                    "w": result.object_group_bbox[2],
                    "h": result.object_group_bbox[3],
                },
                "wordBbox": {
                    "x": result.word_bbox[0],
                    "y": result.word_bbox[1],
                    "w": result.word_bbox[2],
                    "h": result.word_bbox[3],
                },
                "includesObjectWord": True,
            },
            "objectName": mapping.get(letter, ""),
            "source": source_path.name,
            "diagnostics": result.diagnostics,
        }

    manifest = {
        "version": 1,
        "mode": "alpha-connected-components-no-ai-background-removal",
        "sourceDir": str(input_dir),
        "outputDir": str(output_dir),
        "letters": entries,
    }
    (output_dir / "asset-manifest.json").write_text(
        json.dumps(manifest, indent=2),
        encoding="utf-8",
    )
    return manifest


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_dir", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--mapping", type=Path, default=None)
    parser.add_argument("--alpha-threshold", type=int, default=DEFAULT_ALPHA_THRESHOLD)
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    manifest = process_directory(
        args.input_dir,
        args.output_dir,
        mapping_path=args.mapping,
        alpha_threshold=args.alpha_threshold,
    )
    print(json.dumps({"outputDir": manifest["outputDir"], "letters": len(manifest["letters"])}))


if __name__ == "__main__":
    main()
