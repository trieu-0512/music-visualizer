"""Prepare an authored ABC song directory for the Remotion 4K renderer.

The command is intentionally project-local and idempotent. It treats the
authored LRC as the timing source, the locked song script as display text, and
the pure-white composite JPGs as segmentation inputs. The resulting directory
is both directly renderable by ``render:remotion`` and importable by the web
app's folder-import endpoint.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
WORKERS_ROOT = ROOT / "workers"
if str(WORKERS_ROOT) not in sys.path:
    sys.path.insert(0, str(WORKERS_ROOT))

from src.align import AlignmentMismatchError  # noqa: E402
from src.analyze import analyze_signal  # noqa: E402
from src.lrc_align import build_lyrics_from_lrc, parse_lrc  # noqa: E402
from src.srt import lyrics_to_srt  # noqa: E402
from src.validate_artifacts import (  # noqa: E402
    validate_audio_analysis_payload,
    validate_learning_map_payload,
    validate_lyrics_payload,
    validate_song_script_payload,
)
from src.white_matte_segmenter import segment_source_image  # noqa: E402

LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


@dataclass(frozen=True)
class SourceImages:
    letters: dict[str, Path]
    background: Path
    song_logo: Path


def discover_source_images(image_dir: Path, song_id: str) -> SourceImages:
    """Discover the 26 keyed composites plus background and song logo."""

    letters: dict[str, Path] = {}
    background: Path | None = None
    song_logo: Path | None = None
    id_prefix = re.escape(song_id)
    for path in sorted(image_dir.iterdir()):
        if not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        name = path.name
        lower = name.lower()
        match = re.search(rf"id_{id_prefix}([a-z])(?:_|\.)", lower)
        if match:
            letters[match.group(1).upper()] = path
            continue
        if f"id_{song_id.lower()}background" in lower:
            background = path
        elif f"id_{song_id.lower()}song_logo" in lower:
            song_logo = path

    missing = [letter for letter in LETTERS if letter not in letters]
    if missing:
        raise RuntimeError(f"Missing source composite(s) for: {', '.join(missing)}")
    if background is None:
        raise RuntimeError(f"Missing {song_id}background image in {image_dir}")
    if song_logo is None:
        raise RuntimeError(f"Missing {song_id}song_logo image in {image_dir}")
    return SourceImages(letters=letters, background=background, song_logo=song_logo)


def build_project_config(
    project_id: str,
    song_name: str,
    assets: dict[str, Any],
    artifacts: dict[str, str],
) -> dict[str, Any]:
    """Build the schema-shaped config for the landscape export targets."""

    return {
        "version": 1,
        "projectId": project_id,
        "metadata": {"songName": song_name, "singerName": "ABC Kids Music"},
        "videoFormat": "landscape",
        "assets": assets,
        "artifacts": artifacts,
        "layout": {
            "template": "classic-landscape",
            "lyricBox": {"maxLines": 2},
            "bars": {"left": False, "right": False},
        },
    }


def prepare_song(
    song_dir: Path,
    *,
    image_dir: Path | None = None,
    render: bool = False,
    encoder: str = "amf",
    concurrency: str = "6",
    render_target: str = "landscape-4k",
) -> dict[str, Any]:
    song_dir = song_dir.resolve()
    song_id = song_dir.name
    if not re.fullmatch(r"\d{4}", song_id):
        raise RuntimeError(f"Song directory name must be a four-digit id, got {song_id!r}")
    authoring = song_dir / "authoring"
    if image_dir is None:
        image_dir = _find_image_dir(authoring)
    image_dir = image_dir.resolve()

    mapping = _read_json(authoring / "mapping.json")
    validate_learning_map_payload(mapping)
    script = _read_json(authoring / "song-script.json")
    validate_song_script_payload(script)
    if script["mappingRevision"] != mapping["revision"]:
        raise RuntimeError("song-script.json mappingRevision does not match mapping.json revision")

    sources = discover_source_images(image_dir, song_id)
    audio = _find_single(authoring, {".mp3", ".wav"}, "audio")
    lrc = _find_single(authoring, {".lrc"}, "LRC transcript")
    song_plan = _read_json(authoring / "song-plan.json", required=False) or {}
    song_name = str(song_plan.get("title") or f"ABC Song {song_id}")

    assets_dir = song_dir / "assets"
    letters_dir = assets_dir / "letters"
    objects_dir = assets_dir / "objects"
    source_dir = assets_dir / "source-images"
    artifacts_dir = song_dir / "artifacts"
    for directory in (letters_dir, objects_dir, source_dir, artifacts_dir):
        directory.mkdir(parents=True, exist_ok=True)

    audio_target = assets_dir / f"audio{audio.suffix.lower()}"
    background_target = assets_dir / f"background{sources.background.suffix.lower()}"
    background_4k_target = assets_dir / "background-4k.jpg"
    logo_target = assets_dir / f"song-logo{sources.song_logo.suffix.lower()}"
    _copy_file(audio, audio_target)
    _copy_file(sources.background, background_target)
    make_4k_background(background_target, background_4k_target)
    _copy_file(sources.song_logo, logo_target)
    channel_target = assets_dir / "channel-logo.png"
    _make_channel_logo(sources.song_logo, channel_target)

    asset_report: dict[str, Any] = {
        "version": 2,
        "mappingRevision": int(mapping["revision"]),
        "segmenter": "adaptive-reference-background-v3",
        "sourceDirectory": str(image_dir),
        "background": _image_record(background_4k_target, song_dir),
        "targets": {},
    }
    letter_paths: dict[str, str] = {}
    object_paths: dict[str, str] = {}
    for letter in LETTERS:
        source_path = sources.letters[letter]
        source_target = source_dir / f"{letter}{source_path.suffix.lower()}"
        _copy_file(source_path, source_target)
        object_name = str(mapping["letters"][letter]["object"])
        letter_bytes, object_bytes = segment_source_image(
            source_path,
            letter,
            object_name,
            background=sources.background,
        )
        letter_target = letters_dir / f"{letter}.png"
        object_target = objects_dir / f"{letter}.png"
        letter_target.write_bytes(letter_bytes)
        object_target.write_bytes(object_bytes)
        letter_paths[letter] = _relative(letter_target, song_dir)
        object_paths[letter] = _relative(object_target, song_dir)
        asset_report["targets"][letter] = {
            "object": object_name,
            "status": "generated",
            "source": _image_record(source_target, song_dir),
            "letter": _image_record(letter_target, song_dir),
            "objectAsset": _image_record(object_target, song_dir),
            "qc": {
                "outputsPresent": True,
                "manualReviewRequired": False,
            },
        }
    asset_report["complete"] = len(asset_report["targets"]) == 26
    _write_json(artifacts_dir / "asset-prep-report.json", asset_report)

    audio_duration = _probe_duration(audio)
    lrc_text = lrc.read_text(encoding="utf-8-sig")
    try:
        lyrics = build_lyrics_from_lrc(
            lrc_text,
            script,
            mapping,
            audio_duration=audio_duration,
        )
    except AlignmentMismatchError as exc:
        raise RuntimeError(
            f"LRC does not match authored song-script.json; no lyric artifact was written: {exc}"
        ) from exc
    audio_hash = _sha256_file(audio_target)
    transcript_hash = hashlib.sha256(lrc_text.encode("utf-8")).hexdigest()
    lyrics["provenance"] = {
        "audioSha256": audio_hash,
        "transcriptSha256": transcript_hash,
        "transcriptPath": _relative(lrc, song_dir),
        "mappingRevision": int(mapping["revision"]),
        "songScriptMappingRevision": int(script["mappingRevision"]),
    }
    validate_lyrics_payload(lyrics)
    _write_json(artifacts_dir / "lyrics.json", lyrics)
    (artifacts_dir / "lyrics.srt").write_text(lyrics_to_srt(lyrics), encoding="utf-8")
    _write_json(
        artifacts_dir / "lrc-transcript.json",
        {
            "version": 1,
            "source": "lrc",
            "path": _relative(lrc, song_dir),
            "sha256": transcript_hash,
            "cueCount": len(parse_lrc(lrc_text)),
            "canonicalLineCount": len(script["lines"]),
            "normalizedTokenMatch": True,
        },
    )

    analysis = _build_audio_analysis(audio_target, audio_hash, artifacts_dir)
    validate_audio_analysis_payload(analysis)
    _write_json(artifacts_dir / "audio-analysis.json", analysis)

    assets = {
        "background": _relative(background_4k_target, song_dir),
        "songLogo": _relative(logo_target, song_dir),
        "channelLogo": _relative(channel_target, song_dir),
        "audio": _relative(audio_target, song_dir),
        "letters": letter_paths,
        "objects": object_paths,
    }
    artifact_paths = {
        "lyrics": "artifacts/lyrics.json",
        "audioAnalysis": "artifacts/audio-analysis.json",
    }
    config = build_project_config(song_id, song_name, assets, artifact_paths)
    dependency_paths = [
        assets["background"],
        _relative(background_target, song_dir),
        assets["songLogo"],
        assets["channelLogo"],
        assets["audio"],
        *letter_paths.values(),
        *object_paths.values(),
        *artifact_paths.values(),
        "authoring/mapping.json",
        "authoring/song-script.json",
        _relative(lrc, song_dir),
    ]
    config["provenance"] = {
        "builtAt": "prepared-by-scripts/prepare_abc_song.py",
        "dependencies": {
            path: _sha256_file(song_dir / path.replace("/", os.sep))
            for path in sorted(set(dependency_paths))
            if (song_dir / path.replace("/", os.sep)).is_file()
        },
    }
    _write_json(artifacts_dir / "project-config.json", config)
    _write_json(
        song_dir / "metadata.json",
        {"songName": song_name, "singerName": "ABC Kids Music", "videoFormat": "landscape"},
    )

    result = {
        "songId": song_id,
        "songName": song_name,
        "audioDuration": audio_duration,
        "lrc": {
            "path": _relative(lrc, song_dir),
            "cueCount": len(parse_lrc(lrc_text)),
            "canonicalLineCount": len(script["lines"]),
            "normalizedTokenMatch": True,
        },
        "assets": 28,
        "foregroundAssets": 52,
        "videoTarget": "landscape-4k (3840x2160 @ 60fps)",
        "config": "artifacts/project-config.json",
    }
    if render:
        _render(
            song_dir,
            encoder=encoder,
            concurrency=concurrency,
            target=render_target,
        )
        quality = render_target.removeprefix("landscape-")
        result["video"] = f"artifacts/final-16x9-{quality}-60fps.mp4"
    return result


def _find_image_dir(authoring: Path) -> Path:
    candidates = [path for path in authoring.iterdir() if path.is_dir()]
    for candidate in sorted(candidates):
        if any("background" in path.name.lower() for path in candidate.iterdir() if path.is_file()):
            return candidate
    raise RuntimeError(f"Could not find an image directory under {authoring}; pass --image-dir explicitly")


def _find_single(directory: Path, extensions: set[str], label: str) -> Path:
    candidates = sorted(
        path for path in directory.iterdir() if path.is_file() and path.suffix.lower() in extensions
    )
    if not candidates:
        raise RuntimeError(f"Missing {label} ({', '.join(sorted(extensions))}) under {directory}")
    if len(candidates) > 1 and label == "LRC transcript":
        raise RuntimeError(f"Expected exactly one LRC transcript under {directory}, found {len(candidates)}")
    return candidates[0]


def _read_json(path: Path, *, required: bool = True) -> dict[str, Any] | None:
    if not path.is_file():
        if required:
            raise RuntimeError(f"Missing required file: {path}")
        return None
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise RuntimeError(f"Expected JSON object: {path}")
    return value


def _copy_file(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)


def make_4k_background(source: Path, target: Path) -> None:
    """Upscale/crop the authored background once for deterministic 4K output."""

    target_width, target_height = 3840, 2160
    target_ratio = target_width / target_height
    with Image.open(source) as image:
        rgb = image.convert("RGB")
        source_ratio = rgb.width / rgb.height
        if source_ratio > target_ratio:
            crop_width = round(rgb.height * target_ratio)
            left = max(0, (rgb.width - crop_width) // 2)
            rgb = rgb.crop((left, 0, left + crop_width, rgb.height))
        elif source_ratio < target_ratio:
            crop_height = round(rgb.width / target_ratio)
            top = max(0, (rgb.height - crop_height) // 2)
            rgb = rgb.crop((0, top, rgb.width, top + crop_height))
        upscaled = rgb.resize((target_width, target_height), Image.Resampling.LANCZOS)
        target.parent.mkdir(parents=True, exist_ok=True)
        upscaled.save(
            target,
            format="JPEG",
            quality=95,
            subsampling=0,
            optimize=True,
        )


def _make_channel_logo(source: Path, target: Path) -> None:
    with Image.open(source) as image:
        rgb = image.convert("RGB")
        size = min(rgb.width, rgb.height)
        left = (rgb.width - size) // 2
        top = (rgb.height - size) // 2
        logo = rgb.crop((left, top, left + size, top + size)).resize((512, 512), Image.Resampling.LANCZOS)
        logo.save(target, format="PNG", optimize=True)


def _image_record(path: Path, root: Path) -> dict[str, Any]:
    with Image.open(path) as image:
        rgba = np.asarray(image.convert("RGBA"))
    alpha = rgba[..., 3]
    ys, xs = np.where(alpha > 0)
    bbox = {
        "x": int(xs.min()) if xs.size else 0,
        "y": int(ys.min()) if ys.size else 0,
        "w": int(xs.max() - xs.min() + 1) if xs.size else 0,
        "h": int(ys.max() - ys.min() + 1) if ys.size else 0,
    }
    return {
        "path": _relative(path, root),
        "sha256": _sha256_file(path),
        "bytes": path.stat().st_size,
        "width": int(rgba.shape[1]),
        "height": int(rgba.shape[0]),
        "alphaCoverage": float(np.mean(alpha > 0)),
        "bbox": bbox,
    }


def _build_audio_analysis(audio: Path, audio_hash: str, artifacts_dir: Path) -> dict[str, Any]:
    import librosa

    y, sample_rate = librosa.load(str(audio), sr=None, mono=True)
    analysis = analyze_signal(y, int(sample_rate))
    analysis["provenance"] = {"audioSha256": audio_hash}
    return analysis


def _probe_duration(path: Path) -> float:
    candidates = []
    env = os.environ.get("FFPROBE_BIN")
    if env:
        candidates.append(Path(env))
    candidates.extend([Path("ffprobe"), Path(r"C:\ffmpeg\bin\ffprobe.exe")])
    for executable in candidates:
        try:
            completed = subprocess.run(
                [str(executable), "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
                capture_output=True,
                text=True,
                check=True,
            )
            value = float(completed.stdout.strip())
            if value > 0:
                return value
        except (OSError, subprocess.SubprocessError, ValueError):
            continue
    import librosa

    return float(librosa.get_duration(path=str(path)))


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _relative(path: Path, root: Path) -> str:
    return path.resolve().relative_to(root.resolve()).as_posix()


def _write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _render(song_dir: Path, *, encoder: str, concurrency: str, target: str) -> None:
    npm = "npm.cmd" if os.name == "nt" else "npm"
    command = [
        npm,
        "run",
        "render:remotion",
        "--",
        str(song_dir),
        "--target",
        target,
        "--encoder",
        encoder,
        "--concurrency",
        concurrency,
    ]
    subprocess.run(command, cwd=ROOT, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare and optionally render an authored ABC song")
    parser.add_argument("song_dir", type=Path)
    parser.add_argument("--image-dir", type=Path)
    parser.add_argument("--render", action="store_true", help="Render the final landscape 4K MP4 after preparation")
    parser.add_argument("--encoder", choices=("amf", "x264"), default="amf")
    parser.add_argument("--concurrency", default="6")
    parser.add_argument(
        "--target",
        choices=("landscape-4k", "landscape-2k", "landscape-fullhd"),
        default="landscape-4k",
        help="Render target when --render is supplied",
    )
    args = parser.parse_args()
    result = prepare_song(
        args.song_dir,
        image_dir=args.image_dir,
        render=args.render,
        encoder=args.encoder,
        concurrency=args.concurrency,
        render_target=args.target,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
