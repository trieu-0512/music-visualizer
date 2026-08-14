from __future__ import annotations

from pathlib import Path

from PIL import Image

from prepare_abc_song import (
    build_project_config,
    discover_source_images,
    make_4k_background,
)


def test_discover_source_images_maps_all_canonical_keys(tmp_path: Path) -> None:
    for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
        (tmp_path / f"12_id_0001{letter}_type_lette_s1_2K.jpg").write_bytes(b"image")
    (tmp_path / "27_id_0001background_type_s1_2K.jpg").write_bytes(b"background")
    (tmp_path / "28_id_0001song_logo_type_s1_2K.jpg").write_bytes(b"logo")

    found = discover_source_images(tmp_path, "0001")

    assert set(found.letters) == set("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    assert found.background.name.endswith("background_type_s1_2K.jpg")
    assert found.song_logo.name.endswith("song_logo_type_s1_2K.jpg")


def test_project_config_is_locked_to_landscape_2k_render_inputs() -> None:
    config = build_project_config(
        "0001",
        "Ocean Letter Splash",
        {
            "background": "assets/background.jpg",
            "songLogo": "assets/song-logo.jpg",
            "channelLogo": "assets/channel-logo.png",
            "audio": "assets/audio.mp3",
            "letters": {letter: f"assets/letters/{letter}.png" for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ"},
            "objects": {letter: f"assets/objects/{letter}.png" for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ"},
        },
        {"lyrics": "artifacts/lyrics.json", "audioAnalysis": "artifacts/audio-analysis.json"},
    )

    assert config["videoFormat"] == "landscape"
    assert config["assets"]["objects"]["Z"] == "assets/objects/Z.png"
    assert config["layout"]["template"] == "classic-landscape"


def test_make_4k_background_upscales_and_crops_to_landscape_canvas(tmp_path: Path) -> None:
    source = tmp_path / "source.jpg"
    target = tmp_path / "background-4k.jpg"
    Image.new("RGB", (2752, 1536), (20, 120, 180)).save(source, quality=90)

    make_4k_background(source, target)

    with Image.open(target) as image:
        assert image.size == (3840, 2160)
