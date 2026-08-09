from __future__ import annotations

import argparse
import json
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from abc_creative_gold_v4 import GOLD_V4_SPECS, OBJECT_CRAFT, RHYME_PHRASELETS
from abc_creative_gold_v5_1_10 import GOLD_V5_SPEC_PATCHES
from abc_creative_gold_v5_11_15 import GOLD_V5_11_15_SPEC_PATCHES
from abc_creative_gold_v5_16_20 import GOLD_V5_16_20_SPEC_PATCHES
from abc_creative_gold_v5_21_25 import GOLD_V5_21_25_SPEC_PATCHES
from abc_creative_gold_v5_26_30 import GOLD_V5_26_30_SPEC_PATCHES
from abc_creative_gold_v5_31_35 import GOLD_V5_31_35_SPEC_PATCHES
from abc_creative_gold_v5_36_40 import GOLD_V5_36_40_SPEC_PATCHES
from abc_creative_gold_v5_41_45 import GOLD_V5_41_45_SPEC_PATCHES
from abc_creative_gold_v5_46_50 import GOLD_V5_46_50_SPEC_PATCHES
from abc_creative_gold_v5_51_55 import GOLD_V5_51_55_SPEC_PATCHES
from abc_creative_gold_v5_56_60 import GOLD_V5_56_60_SPEC_PATCHES
from abc_creative_gold_v5_61_65 import GOLD_V5_61_65_SPEC_PATCHES
from abc_creative_gold_v5_66_70 import GOLD_V5_66_70_SPEC_PATCHES
from abc_creative_gold_v5_71_75 import GOLD_V5_71_75_SPEC_PATCHES
from abc_creative_gold_v5_76_80 import GOLD_V5_76_80_SPEC_PATCHES
from abc_creative_gold_v5_81_85 import GOLD_V5_81_85_SPEC_PATCHES
from abc_creative_gold_v5_86_90 import GOLD_V5_86_90_SPEC_PATCHES
from abc_creative_gold_v5_91_95 import GOLD_V5_91_95_SPEC_PATCHES
from abc_creative_gold_v5_96_100 import GOLD_V5_96_100_SPEC_PATCHES
from abc_creative_gold_v5_101_105 import GOLD_V5_101_105_SPEC_PATCHES
from abc_creative_gold_v5_106_110 import GOLD_V5_106_110_SPEC_PATCHES
from abc_creative_gold_v5_111_115 import GOLD_V5_111_115_SPEC_PATCHES
from abc_creative_gold_v5_116_120 import GOLD_V5_116_120_SPEC_PATCHES
from abc_creative_gold_v5_121_125 import GOLD_V5_121_125_SPEC_PATCHES
from abc_creative_gold_v5_126_130 import GOLD_V5_126_130_SPEC_PATCHES
from abc_creative_gold_v5_131_135 import GOLD_V5_131_135_SPEC_PATCHES
from abc_creative_gold_v5_136_140 import GOLD_V5_136_140_SPEC_PATCHES
from abc_creative_gold_v5_141_145 import GOLD_V5_141_145_SPEC_PATCHES
from abc_creative_gold_v5_146_150 import GOLD_V5_146_150_SPEC_PATCHES
from abc_creative_gold_v5_151_155 import GOLD_V5_151_155_SPEC_PATCHES
from abc_creative_gold_v5_101_200_support import OBJECT_CRAFT_REGISTRY
from abc_creative_v4_11_50 import (
    object_craft as object_craft_v4_11_50,
    rhyme_phraselet as rhyme_phraselet_v4_11_50,
    spec_payload as spec_payload_v4_11_50,
)
from abc_creative_v4_51_100 import (
    object_craft as object_craft_v4_51_100,
    rhyme_phraselet as rhyme_phraselet_v4_51_100,
    spec_payload as spec_payload_v4_51_100,
)

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "abc-song"
LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
CHUNKS = ("ABCD", "EFGH", "IJKL", "MNOP", "QRST", "UVWX", "YZ")


@dataclass(frozen=True)
class SongProfile:
    song_id: str
    title: str
    style: str
    exclude: str
    hook_a: str
    hook_b: str
    round1_frame: str
    round2_frame: str
    visual_style: str
    bpm: int
    motif: str
    response: str


@dataclass(frozen=True)
class CreativeSpec:
    """Opt-in creative authoring contract for gold-standard / regenerated songs.

    Legacy SongProfile frames remain readable so existing catalog artifacts are not
    silently rewritten. A CreativeSpec can progressively replace them with a
    curated opening, a controlled entry palette, exact semantic line overrides,
    richer Round-2 participation, and a section-aware AI-music style blueprint.
    """

    opening_type: str
    target_entry_families: tuple[str, ...]
    line_length_contour: tuple[str, ...]
    rhyme_engine: str
    chorus_rhyme_engine: str
    point_of_view: str
    chorus_function: str
    groove_meter: str
    round1_grammar: str
    round2_grammar: str
    section_contrast: str
    signature_color: str
    authorial_intent: str = ""
    lyric_identity: str = ""
    image_motifs: tuple[str, ...] = ()
    semantic_arc: tuple[str, ...] = ()
    forbidden_generic_language: tuple[str, ...] = ()
    intro_lines: tuple[str, ...] = ()
    hook_lines: tuple[str, ...] = ()
    outro_lines: tuple[str, ...] = ()
    interlude_lines: tuple[str, ...] = ()
    chorus_after_round1: tuple[int, ...] = (2, 4, 6)
    chorus_after_round2: tuple[int, ...] = (2, 4, 6)
    round1_patterns: tuple[str, ...] = ()
    round2_patterns: tuple[str, ...] = ()
    round1_overrides: tuple[tuple[str, str], ...] = ()
    round2_overrides: tuple[tuple[str, str], ...] = ()
    style_blueprint: str | None = None
    object_craft_required: bool = True


# Songs are migrated into this map only after a creative review. Keeping this
# separate from PROFILES prevents a skill upgrade from silently overwriting the
# already-authored 200-song catalog. The first migration target is 0001-0010.
CREATIVE_SPECS: dict[str, CreativeSpec] = {
    sid: CreativeSpec(**({**spec, **GOLD_V5_SPEC_PATCHES.get(sid, {})}))
    for sid, spec in GOLD_V4_SPECS.items()
}


PROFILES: dict[str, SongProfile] = {
    "0001": SongProfile("0001", "Ocean Letter Splash", "bright preschool tropical-pop, light ukulele, marimba, hand claps, warm female lead, clear dry diction, playful ocean ambience, 88 BPM, simple major-key harmony, short response gaps", "rap, trap hats, EDM drops, distorted guitars, dense choir, melisma, baby-talk pronunciation", "Wave hello, A-B-C!", "Ocean words for you and me!", "{letter} is {object}, shining by the sea.", "{letter} ... {object}! Point and say it with me.", "friendly polished 3D storybook ocean art, aqua and coral palette, soft rounded shapes, clean preschool character design", 88, "splash-step", "one beat of quiet after the letter cue"),
    "0002": SongProfile("0002", "Shoreline ABC", "sunny acoustic surf-pop for preschoolers, ukulele strum, soft shaker, glockenspiel, gentle bass, clear female lead, 90 BPM, catchy two-bar refrain", "rock distortion, heavy drums, jazz runs, vocal riffs, fast patter, cinematic darkness", "Shore to shore, say the sound we see!", "A-B-C beside the sea!", "{letter} brings {object} to the shore today.", "{letter} ... {object}! Find it, point, and say.", "cheerful coastal storybook 3D, sandy shore plus blue water accents, rounded toy-like forms, crisp silhouettes", 90, "shore-skip", "brief predictable pause before the answer"),
    "0003": SongProfile("0003", "Row and Say ABC", "preschool sailor-march pop, light snare brushes, ukulele, accordion touches, hand claps, call-and-response lead, 92 BPM, strong beat-one diction", "military aggression, loud brass, rock shouting, rap, dense backing vocals, long instrumental solos", "Row, row, letters on our way!", "Boat and sea words—say, say, say!", "{letter} shows {object} on our ocean tour.", "{letter} ... {object}! Point to the picture for sure.", "playful nautical 3D storybook, toy boats and ocean creatures, navy-aqua-red accents, clean separable subjects", 92, "row-march", "one clear beat between cue and target"),
    "0004": SongProfile("0004", "Sail and See A to Z", "airy tropical preschool pop, kalimba, soft marimba, brushed percussion, gentle ukulele, warm lead vocal, 86 BPM, spacious phrasing and clear consonants", "fast dance music, trap, dramatic orchestral swells, belting, complex syncopation, vocal stacking", "Sail and see, come look with me!", "A to Z across the sea!", "{letter} meets {object} where sea and travel meet.", "{letter} ... {object}! Show the match, nice and neat.", "soft cinematic 3D preschool travel-ocean art, turquoise sky-water gradient, warm sunlight, simple rounded detail", 86, "sail-glide", "soft two-beat retrieval space for older preschoolers"),
    "0005": SongProfile("0005", "Coast Explorer ABC", "bouncy preschool beach-pop, acoustic guitar, claves, marimba, hand claps, curious lead vocal, 94 BPM, compact phrases, bright chorus", "aggressive EDM, rock solos, rap, breathless tempo, complex harmonies, spoken comedy", "Look, listen—coast explorer!", "Letters make our picture clearer!", "{letter} finds {object} on our coast explorer trail.", "{letter} ... {object}! Point it out without fail.", "colorful explorer-storybook 3D coast art, friendly field-guide feel, beach palette, bold clean foreground separation", 94, "coast-clap", "short one-beat retrieval gap"),
    "0006": SongProfile("0006", "Ripple River ABC", "gentle preschool folk-pop, acoustic guitar, pizzicato strings, soft woodblock, light glockenspiel, clear warm lead, 84 BPM, relaxed river-flow rhythm", "heavy drums, rap, EDM, dramatic strings, dense choir, rushed delivery", "Ripple, ripple, A-B-C!", "River words flow back to me!", "{letter} is {object}, by the pond and river side.", "{letter} ... {object}! Point and name it riverside.", "gentle freshwater 3D storybook, lily greens and river blues, friendly wildlife, soft rounded forms, clear isolated subjects", 84, "ripple-folk", "two-beat supportive pause before target"),
    "0007": SongProfile("0007", "Waterway Letter Ride", "playful acoustic bluegrass-lite preschool song, banjo plucks, upright bass, hand claps, whistle accents, friendly lead, 90 BPM, simple I-IV-V feel", "fast bluegrass virtuosity, country twang exaggeration, rock, rap, dense harmonies, shouting", "Across the lake, along the way!", "A-B-C—we point and say!", "{letter} brings {object} along the waterway.", "{letter} ... {object}! Spot it now and say.", "bright 3D lakes-and-waterways storybook, canoe-map adventure mood, teal-green palette, toy-like clarity", 90, "waterway-hop", "one beat of silence before confirmation"),
    "0008": SongProfile("0008", "Freshwater Friends ABC", "cheerful preschool acoustic-pop, marimba, ukulele, soft kick, finger snaps, clear female lead, 91 BPM, friendly animal-character energy", "trap, EDM drops, distorted guitars, scat singing, melisma, rapid syllables", "Freshwater friends, come swim and see!", "Twenty-six words from A to Z!", "{letter} shows {object} in our freshwater world.", "{letter} ... {object}! Point to it and say the word.", "cute freshwater animal 3D storybook, pond blues and leafy greens, expressive but anatomically clear creatures, uncluttered", 91, "friend-bounce", "brief retrieval pause, then warm confirmation"),
    "0009": SongProfile("0009", "Wetland Wonder ABC", "soft marimba-led preschool nature pop, kalimba, shakers, airy pads, gentle bass, calm clear lead vocal, 82 BPM, spacious lyrical pacing", "dark ambience, cinematic tension, rap, fast percussion, dense reverb, whisper vocals", "Wetland wonders, look and see!", "Green and blue from A to Z!", "{letter} is {object}, in the wetland green.", "{letter} ... {object}! Point to what you've seen.", "lush but simple wetland 3D storybook, reeds and water reflections, soft morning light, strong foreground silhouettes", 82, "wetland-sway", "two beats of quiet for retrieval"),
    "0010": SongProfile("0010", "Riverbank Explorer A-Z", "campfire-folk preschool pop, acoustic guitar, light stomps, shaker, glockenspiel, bright clear lead, 89 BPM, easy walking pulse", "rock shouting, rap, EDM, dramatic orchestration, vocal runs, dense percussion", "Step by step along the bank!", "A to Z—remember, thank!", "{letter} finds {object} along the riverbank trail.", "{letter} ... {object}! Point and tell the tale.", "warm 3D riverbank explorer storybook, golden afternoon light, river blues, natural greens, clear toy-like subjects", 89, "river-walk", "one-beat cue gap before answer"),
    "0011": SongProfile("0011", "Farmyard Hello ABC", "warm preschool farm-folk, acoustic guitar, fiddle pizzicato, hand claps, soft kick, clear smiling lead, 88 BPM, simple porch-swing pulse", "hard country twang, rock guitars, trap, rapid patter, dense harmonies, shouting", "Good morning, farm—A-B-C!", "Barnyard words for you and me!", "{letter} brings {object} into our farmyard view.", "{letter} ... {object}! Point, then say it true.", "sunny 3D farm storybook, red barn and green field palette, rounded friendly forms, clean isolated foregrounds", 88, "farm-porch", "one clear beat after each letter cue"),
    "0012": SongProfile("0012", "Barn Bell Letters", "gentle preschool country-pop, muted banjo, brushed snare, upright bass, bell accents, clear female lead, 90 BPM, tidy two-bar phrases", "fast bluegrass solos, loud cowbells, rock, rap, melisma, dense choir", "Ring the barn bell—A-B-C!", "Find the farm word, one-two-three!", "{letter} shows {object} beside the barn today.", "{letter} ... {object}! Find it, point, and say.", "cozy 3D barn storybook, warm wood textures, hay gold and sky blue, toy-like objects with strong outlines", 90, "barn-bell", "brief silent beat before target confirmation"),
    "0013": SongProfile("0013", "Tractor Trail A-Z", "bouncy preschool folk-pop, acoustic guitar, woodblock, light bass, tiny harmonica answers, crisp lead, 92 BPM, steady tractor-like pulse", "heavy engines, aggressive country rock, rap, EDM drops, vocal runs, cluttered percussion", "Tractor trail, roll with me!", "Tools and crops from A to Z!", "{letter} finds {object} on our tractor trail.", "{letter} ... {object}! Point and name it on the trail.", "bright 3D farm-tool storybook, tractor red and crop green accents, simple field backdrop, separated clean subjects", 92, "tractor-roll", "one-beat retrieval gap with percussion drop-out"),
    "0014": SongProfile("0014", "Country Sunrise ABC", "soft sunrise preschool folk, nylon guitar, mandolin taps, shaker, glockenspiel, warm lead, 84 BPM, relaxed open phrasing", "dark cinematic country, loud drums, rap, complex jazz chords, belting, long instrumental breaks", "Sun comes up—A-B-C!", "Country words wake up with me!", "{letter} meets {object} in the country morning light.", "{letter} ... {object}! Point and name it right.", "gentle 3D countryside storybook, sunrise gold, soft green fields, friendly rounded animals and objects, uncluttered", 84, "sunrise-sway", "two supportive beats between cue and answer"),
    "0015": SongProfile("0015", "Harvest Basket ABC", "cheerful harvest preschool pop, ukulele, hand drum, shaker, pizzicato strings, bright lead, 93 BPM, clap-friendly chorus", "hard rock, trap hats, EDM build, operatic voice, fast spoken lists, dense backing vocals", "Fill the basket—A-B-C!", "Harvest words are fun to see!", "{letter} brings {object} to our harvest day.", "{letter} ... {object}! Show the match and say.", "colorful 3D harvest storybook, orchard orange and leaf green, baskets and crops, clear centered subjects for segmentation", 93, "harvest-clap", "short predictable cue gap"),
    "0016": SongProfile("0016", "Grow With Letters", "light preschool garden-pop, ukulele, marimba, finger snaps, soft shaker, clear lead, 87 BPM, gentle growing-up contour", "rock distortion, trap, EDM, dramatic orchestration, scat, breathless delivery", "Grow, grow—A-B-C!", "Garden words sprout up with me!", "{letter} shows {object} growing in our garden scene.", "{letter} ... {object}! Point to what is green.", "fresh 3D garden storybook, leaf green and flower colors, rounded plants, clean simple background and isolated subjects", 87, "garden-grow", "one beat of quiet before confirmation"),
    "0017": SongProfile("0017", "Buzz and Bloom ABC", "playful preschool garden swing-pop, pizzicato strings, marimba, tiny shaker, soft hand claps, smiling lead, 91 BPM", "big band brass, fast swing solos, rock, rap, dense choir, loud insect effects", "Buzz and bloom—come sing with me!", "Flowers and bugs from A to Z!", "{letter} brings {object} where blossoms sway.", "{letter} ... {object}! Find it, point, and say.", "whimsical 3D flower-and-bug storybook, pastel petals, fresh greens, cute but recognizable insects, crisp silhouettes", 91, "buzz-bloom", "brief one-beat answer space"),
    "0018": SongProfile("0018", "Garden Tool Tap", "rhythmic preschool acoustic-pop, muted guitar, woodblock taps, claves, soft bass, clear lead, 94 BPM, tool-tap micro groove", "industrial noise, heavy percussion, rock, rap, EDM drops, shouting", "Tap-tap, garden A-B-C!", "Tools and plants—look carefully!", "{letter} shows {object} in our garden work today.", "{letter} ... {object}! Point to it and say.", "clean 3D garden-tool storybook, bright shed colors, simple soil-and-leaf backdrop, safe friendly tools, strong separation", 94, "garden-tap", "one beat with woodblock muted after cue"),
    "0019": SongProfile("0019", "Seed to Snack ABC", "sunny preschool acoustic groove, ukulele, shaker, marimba, light bass, warm lead, 89 BPM, simple seed-to-food storytelling feel", "rap, heavy rock, EDM, complex syncopation, vocal riffs, food sound effects", "Tiny seed, big A-B-C!", "Garden foods grow happily!", "{letter} brings {object} from the garden into view.", "{letter} ... {object}! Point and name it too.", "bright 3D vegetable-garden storybook, fresh produce colors, soft rounded forms, clean single-object compositions", 89, "seed-sprout", "one supportive beat before target"),
    "0020": SongProfile("0020", "Backyard Green A-Z", "easygoing preschool backyard-pop, acoustic guitar, glockenspiel, finger snaps, soft kick, friendly lead, 86 BPM, relaxed family-garden pulse", "fast dance pop, rock distortion, trap, heavy synth bass, belting, dense harmonies", "Backyard green—A-B-C!", "Look and point along with me!", "{letter} meets {object} in our backyard garden place.", "{letter} ... {object}! Point and name its place.", "cozy 3D backyard garden storybook, sunny fence and lawn, colorful planters, simple child-safe scene, crisp foregrounds", 86, "backyard-bop", "two short beats for mixed-age retrieval"),
    "0021": SongProfile("0021", "Woodland Footstep ABC", "gentle preschool forest-folk, acoustic guitar, soft stomp, wood flute accents, shaker, clear lead, 85 BPM, walking pulse", "dark forest ambience, rock, rap, thunderous drums, vocal whispers, dense reverb", "Tiptoe softly—A-B-C!", "Woodland friends, come walk with me!", "{letter} finds {object} along our woodland path.", "{letter} ... {object}! Point and name it softly.", "warm 3D woodland storybook, moss green and bark brown, friendly animals, dappled light, isolated foreground subjects", 85, "woodland-step", "one clear beat with arrangement thinned"),
    "0022": SongProfile("0022", "Forest Floor Letters", "calm preschool nature-pop, kalimba, pizzicato cello, soft shaker, gentle bell, intimate clear lead, 82 BPM", "cinematic suspense, loud strings, rap, EDM, heavy drums, whisper vocals", "Down on the forest floor—A-B-C!", "Leaves and logs are fun to see!", "{letter} shows {object} on the forest floor today.", "{letter} ... {object}! Find it, point, and say.", "detailed but simple 3D forest-floor storybook, mushrooms leaves logs, muted greens and golds, uncluttered subjects", 82, "forest-floor", "two-beat calm retrieval space"),
    "0023": SongProfile("0023", "Birdsong Forest ABC", "bright preschool folk-pop, acoustic guitar, light whistle, marimba, shaker, gentle claps, clear lead, 90 BPM, bird-call response accents", "realistic loud bird screeches, rock, rap, EDM, dense choir, fast ornaments", "Hear the forest—A-B-C!", "Birds and plants sing back to me!", "{letter} brings {object} into our forest song.", "{letter} ... {object}! Point and sing along.", "airy 3D forest storybook, birds and plants, spring green palette, soft sky light, crisp recognizable silhouettes", 90, "birdsong-hop", "one-beat silent pocket before target"),
    "0024": SongProfile("0024", "Woodland Scout A-Z", "preschool adventure-folk, acoustic guitar, hand drum, recorder accents, soft stomps, confident friendly lead, 92 BPM, easy trail cadence", "military march, aggressive drums, rock guitars, rap, cinematic danger, shouting", "Scout the trail—A-B-C!", "Spot each woodland clue with me!", "{letter} finds {object} on our woodland scout trail.", "{letter} ... {object}! Point and name it on the trail.", "playful 3D woodland scout storybook, simple trail-map mood, green-gold palette, safe explorer tone, clear objects", 92, "scout-march", "one clear beat before answer"),
    "0025": SongProfile("0025", "Autumn Leaf ABC", "cozy preschool autumn folk-pop, nylon guitar, brushed percussion, glockenspiel, soft bass, warm lead, 83 BPM, gentle leaf-fall sway", "dark melancholy, heavy drums, rap, EDM, dramatic strings, breathy whisper", "Leaves drift down—A-B-C!", "Autumn forest, sing with me!", "{letter} meets {object} in the autumn forest glow.", "{letter} ... {object}! Point and say what you know.", "cozy 3D autumn woodland storybook, amber orange and russet leaves, friendly wildlife, strong foreground contrast", 83, "leaf-sway", "two supportive beats before confirmation"),
    "0026": SongProfile("0026", "Rainforest Rhythm ABC", "lively preschool tropical-pop, hand drums kept soft, marimba, shaker, ukulele, clear lead, 92 BPM, simple jungle groove", "aggressive tribal stereotype, loud drums, rock, rap, EDM drops, animal roars", "Rainforest rhythm—A-B-C!", "Jungle words bounce back to me!", "{letter} brings {object} into our rainforest view.", "{letter} ... {object}! Point and say it too.", "lush friendly 3D rainforest storybook, emerald leaves, bright fruit and animals, clean separated foregrounds, no clutter", 92, "rainforest-beat", "one beat of quiet after cue"),
    "0027": SongProfile("0027", "Tropical Canopy ABC", "airy preschool tropical acoustic-pop, kalimba, marimba, soft shaker, plucked strings, warm lead, 86 BPM, canopy-sway phrasing", "heavy percussion, EDM, rock, rap, cinematic danger, dense vocal stacks", "Up in the canopy—A-B-C!", "Tropical words grow high with me!", "{letter} shows {object} beneath the canopy light.", "{letter} ... {object}! Point and name it right.", "bright 3D tropical canopy storybook, layered greens with sunbeams, one clear subject per frame, rounded preschool style", 86, "canopy-sway", "two short beats for retrieval"),
    "0028": SongProfile("0028", "Jungle Green Letters", "bouncy preschool nature-pop, ukulele, woodblock, marimba, soft bass, hand claps, clear lead, 94 BPM, crisp short phrases", "fast rap, rock distortion, EDM drops, loud animal effects, melisma, dense percussion", "Jungle green—A-B-C!", "Plants and creatures, look and see!", "{letter} meets {object} in our jungle green today.", "{letter} ... {object}! Find it, point, and say.", "colorful 3D jungle storybook, rich greens with flower accents, friendly creatures, clean toy-like silhouettes", 94, "jungle-bounce", "short one-beat answer gap"),
    "0029": SongProfile("0029", "Rainforest Explorer A-Z", "preschool explorer-pop, acoustic guitar, hand drum, shaker, flute accents, clear curious lead, 89 BPM, steady walking groove", "cinematic peril, heavy rock, rap, EDM, shouting, dense jungle noise", "Explorer eyes—A-B-C!", "Find the jungle clues with me!", "{letter} spots {object} beneath the rainforest canopy.", "{letter} ... {object}! Lift your pretend binoculars, then say.", "friendly 3D rainforest explorer storybook, simple trail markers, leaf green and sun gold, uncluttered educational composition", 89, "rainforest-walk", "one-beat cue gap with soft backing"),
    "0030": SongProfile("0030", "Canopy River ABC", "flowing preschool tropical-folk, acoustic guitar, kalimba, soft conga taps, glockenspiel, clear lead, 84 BPM, river-like phrasing", "loud drums, rap, rock, EDM, spooky ambience, vocal runs", "Canopy river—A-B-C!", "Flowing jungle words for me!", "{letter} brings {object} where canopy and river meet.", "{letter} ... {object}! Point and name it neat.", "soft 3D rainforest-river storybook, emerald and aqua palette, rounded creatures and plants, clean scene separation", 84, "canopy-river", "two-beat supportive pause"),
    "0031": SongProfile("0031", "Desert Tracks ABC", "warm preschool desert-folk, acoustic guitar, shaker, hand claps, soft marimba, clear lead, 88 BPM, walking-track rhythm", "western gunfight cues, heavy rock, rap, EDM, ominous desert ambience, shouting", "Follow the tracks—A-B-C!", "Desert friends walk on with me!", "{letter} finds {object} along our desert track.", "{letter} ... {object}! Point, then say it back.", "sunny 3D desert storybook, sand gold and sky blue, friendly wildlife, soft cactus shapes, crisp isolated subjects", 88, "desert-step", "one clear beat before target"),
    "0032": SongProfile("0032", "Cactus Bounce A-Z", "playful preschool desert-pop, ukulele, marimba, claves, shaker, bright lead, 93 BPM, buoyant cactus-bounce groove", "mariachi parody, rock distortion, rap, EDM drops, fast vocal runs, loud percussion", "Cactus bounce—A-B-C!", "Dunes and desert, look with me!", "{letter} shows {object} where cactus and dunes can be.", "{letter} ... {object}! Point and say it with me.", "cheerful 3D cactus-and-dune storybook, coral green and warm sand palette, rounded forms, simple background", 93, "cactus-bounce", "short predictable retrieval beat"),
    "0033": SongProfile("0033", "Desert Rock and Bloom", "gentle preschool acoustic-pop, nylon guitar, kalimba, soft shaker, bell tones, clear lead, 85 BPM, spacious desert-nature feel", "dark ambient drones, rock, rap, EDM, dense strings, breathy vocals", "Rock and bloom—A-B-C!", "Desert plants are fun to see!", "{letter} brings {object} to our desert nature scene.", "{letter} ... {object}! Point to what you've seen.", "polished 3D desert nature storybook, rocks succulents and open sky, muted warm colors, strong silhouettes", 85, "rock-bloom", "two gentle beats for retrieval"),
    "0034": SongProfile("0034", "Dune Explorer ABC", "preschool adventure-pop, acoustic guitar, light hand drum, woodblock, glockenspiel, curious lead, 91 BPM, steady dune-walk pulse", "cinematic danger, military march, heavy rock, rap, EDM, shouting", "Across the dunes—A-B-C!", "Explorer eyes, come look with me!", "{letter} finds {object} on our desert explorer way.", "{letter} ... {object}! Find it, point, and say.", "friendly 3D desert explorer storybook, dune paths and oasis hints, warm gold palette, child-safe adventure, clean objects", 91, "dune-walk", "one beat of silence before confirmation"),
    "0035": SongProfile("0035", "Oasis Friends A-Z", "soft cheerful preschool world-pop, acoustic guitar, marimba, shaker, light bass, warm lead, 87 BPM, gentle oasis sway", "ethnic caricature, heavy drums, rock, rap, EDM, dense choir, vocal ornamentation", "Oasis friends—A-B-C!", "Desert wildlife, sing with me!", "{letter} meets {object} near our desert oasis place.", "{letter} ... {object}! Point and name its place.", "bright 3D oasis storybook, palms water and warm sand, friendly wildlife, clean centered subjects, preschool-safe", 87, "oasis-sway", "two short beats before target"),
    "0036": SongProfile("0036", "Polar Parade ABC", "sparkling preschool winter-pop, glockenspiel, ukulele, soft kick, sleigh-bell accents kept light, clear lead, 90 BPM", "holiday song clichés, loud bells, rock, rap, EDM drops, dense choir, shouting", "Polar parade—A-B-C!", "Snowy animals march with me!", "{letter} shows {object} in our polar world today.", "{letter} ... {object}! Point and name it, hooray.", "friendly 3D polar storybook, icy blue and white with warm accents, rounded wildlife, uncluttered foregrounds", 90, "polar-parade", "one clear beat before answer"),
    "0037": SongProfile("0037", "Tundra Glow A-Z", "calm preschool winter-folk, nylon guitar, soft bells, brushed percussion, airy pad, clear lead, 82 BPM, spacious snowy phrasing", "dark arctic ambience, cinematic tension, rock, rap, heavy drums, whisper vocals", "Tundra glow—A-B-C!", "Ice and snow shine back to me!", "{letter} brings {object} into the tundra glow.", "{letter} ... {object}! Point and say what you know.", "soft 3D tundra storybook, pale blue lavender and snow white, gentle light, crisp simple subjects", 82, "tundra-glow", "two supportive beats of quiet"),
    "0038": SongProfile("0038", "Frozen Ocean ABC", "gentle preschool ocean-winter pop, kalimba, glockenspiel, soft shaker, plucked strings, warm lead, 86 BPM, flowing icy pulse", "dramatic cinematic ice, rock, rap, EDM, loud crashes, dense backing vocals", "Frozen ocean—A-B-C!", "Cold blue words swim back to me!", "{letter} meets {object} in our frozen ocean scene.", "{letter} ... {object}! Point to what you've seen.", "polished 3D frozen-ocean storybook, aqua ice and deep blue water, friendly animals, strong foreground separation", 86, "ice-flow", "two short beats before confirmation"),
    "0039": SongProfile("0039", "Arctic Trek A-Z", "preschool expedition-folk, acoustic guitar, soft stomp, shaker, bell accents, confident clear lead, 92 BPM, easy trek cadence", "survival drama, heavy drums, rock, rap, EDM, shouting, wind noise masking", "Arctic trek—A-B-C!", "Find the icy clues with me!", "{letter} reveals {object} across the Arctic snow.", "{letter} ... {object}! Point across the snow, then say it slow.", "friendly 3D arctic explorer storybook, simple map-and-snow mood, bright parkas and blue ice, clean objects", 92, "arctic-trek", "one-beat cue gap with backing thinned"),
    "0040": SongProfile("0040", "Snowy Wildlife ABC", "warm preschool winter acoustic-pop, guitar, marimba, soft shaker, light bells, smiling lead, 88 BPM, animal-friendly bounce", "holiday choir, heavy rock, rap, EDM, loud animal sounds, vocal runs", "Snowy wildlife—A-B-C!", "Cold-climate friends, come sing with me!", "{letter} brings {object} into our snowy wildlife view.", "{letter} ... {object}! Point and say it too.", "cute 3D snowy-wildlife storybook, soft snow fields and icy sky, recognizable animals, rounded clean forms", 88, "snow-friend", "one clear beat before target"),
    "0041": SongProfile("0041", "Mountain Echo ABC", "bright preschool mountain-folk, acoustic guitar, light stomp, glockenspiel, soft flute, clear lead, 88 BPM, echo-friendly refrain", "yodel parody, rock, rap, EDM, huge cinematic drums, shouting", "Mountain echo—A-B-C!", "Highland words come back to me!", "{letter} shows {object} on our mountain side.", "{letter} ... {object}! Point and name it with pride.", "sunny 3D mountain storybook, alpine green and sky blue, friendly wildlife, clear layered peaks and isolated subjects", 88, "mountain-echo", "one beat of quiet before answer"),
    "0042": SongProfile("0042", "Peaks and Valleys A-Z", "gentle preschool acoustic-pop, nylon guitar, marimba, shaker, soft bass, warm lead, 84 BPM, rise-and-fall melodic contour", "dramatic orchestral swells, rock, rap, EDM, belting, dense percussion", "Peaks up high—A-B-C!", "Valleys low—come sing with me!", "{letter} meets {object} between the peaks and valleys wide.", "{letter} ... {object}! Point and say it mountainside.", "soft 3D peaks-and-valleys storybook, blue mountains and green valleys, rounded nature shapes, uncluttered", 84, "peak-valley", "two supportive beats for retrieval"),
    "0043": SongProfile("0043", "Alpine Meadow ABC", "airy preschool meadow-folk, acoustic guitar, pizzicato strings, bells, soft shaker, clear lead, 86 BPM, gentle open phrasing", "dark ambience, rock, rap, EDM, heavy drums, long vocal ornaments", "Alpine meadow—A-B-C!", "Mountain nature blooms with me!", "{letter} brings {object} into our alpine nature scene.", "{letter} ... {object}! Point to what you've seen.", "fresh 3D alpine meadow storybook, wildflowers grass and distant peaks, soft daylight, crisp recognizable subjects", 86, "alpine-bloom", "two short beats before target"),
    "0044": SongProfile("0044", "Mountain Trail Scout", "preschool hiking-folk pop, acoustic guitar, woodblock, hand claps, recorder accents, clear curious lead, 92 BPM, steady trail rhythm", "military march, heavy rock, rap, EDM, danger effects, shouting", "Trail scout—A-B-C!", "Find the mountain clues with me!", "{letter} meets {object} between the peak and valley.", "{letter} ... {object}! Trace a mountain shape, then name it clearly.", "friendly 3D mountain-trail storybook, simple path signs and alpine scenery, warm daylight, clear foreground objects", 92, "mountain-trail", "one clear beat before confirmation"),
    "0045": SongProfile("0045", "Glacier Steps A-Z", "cool gentle preschool folk-pop, acoustic guitar, glockenspiel, soft shaker, muted drum, warm lead, 85 BPM, measured walking cadence", "ominous ice ambience, rock, rap, EDM, huge drums, whisper vocals", "Glacier steps—A-B-C!", "Trails and peaks, walk on with me!", "{letter} shows {object} where mountain trails and glaciers meet.", "{letter} ... {object}! Point and name it neat.", "polished 3D glacier-and-trail storybook, ice blue with warm hiking accents, safe friendly scene, strong silhouettes", 85, "glacier-step", "two-beat calm retrieval space"),
    "0046": SongProfile("0046", "Weather Watch ABC", "bright preschool weather-pop, ukulele, glockenspiel, shaker, soft kick, clear lead, 90 BPM, forecast-style call-and-response", "news-jingle parody, thunder masking, rock, rap, EDM drops, dense choir", "Weather watch—A-B-C!", "Look at the sky and sing with me!", "{letter} brings {object} to our weather watch today.", "{letter} ... {object}! Point and name it, hooray.", "clean 3D weather storybook, sky blue with sun cloud and rain accents, friendly rounded objects, high contrast", 90, "weather-watch", "one clear beat before target"),
    "0047": SongProfile("0047", "Cloud Parade A-Z", "airy preschool sky-pop, kalimba, glockenspiel, soft shaker, gentle bass, clear lead, 86 BPM, floating two-bar phrases", "storm drama, heavy drums, rock, rap, EDM, whisper vocals, dense reverb", "Cloud parade—A-B-C!", "Sky and weather float with me!", "{letter} shows {object} across our changing sky.", "{letter} ... {object}! Point and tell me why.", "soft 3D sky-and-cloud storybook, blue-white palette with weather icons rendered as objects, crisp simple silhouettes", 86, "cloud-float", "two short beats of quiet"),
    "0048": SongProfile("0048", "Dress for Weather ABC", "playful preschool acoustic-pop, ukulele, woodblock, hand claps, shaker, bright lead, 93 BPM, dress-and-point rhythm", "fashion-pop glamour, rock, rap, EDM, loud storm effects, vocal riffs", "Ready for weather—A-B-C!", "Gear and sky are fun to see!", "{letter} brings {object} for our weather day.", "{letter} ... {object}! Find it, point, and say.", "cheerful 3D weather-gear storybook, colorful coats boots and sky cues, clean child-safe objects, simple background", 93, "weather-gear", "short predictable answer gap"),
    "0049": SongProfile("0049", "Wind Rain Snow A-Z", "rhythmic preschool nature-pop, acoustic guitar, marimba, soft shaker, light hand drum, clear lead, 89 BPM, three-weather pulse", "loud thunder, storm sirens, heavy rock, rap, EDM drops, dense percussion", "Wind, rain, snow—A-B-C!", "Weather changes—sing with me!", "{letter} meets {object} in our wind, rain, and snow scene.", "{letter} ... {object}! Point to what you've seen.", "bright 3D mixed-weather storybook, wind swirls rain drops and snow shapes kept simple, strong isolated foregrounds", 89, "weather-triple", "one beat with percussion reduced"),
    "0050": SongProfile("0050", "Little Weather Station", "curious preschool science-pop, marimba, pizzicato strings, glockenspiel, soft kick, clear lead, 88 BPM, simple instrument-reading groove", "techno, EDM drops, complex science narration, rock, rap, dense synth layers", "Weather station—A-B-C!", "Measure, look, and sing with me!", "{letter} shows {object} at our little weather station.", "{letter} ... {object}! Point, then say the weather word.", "friendly 3D preschool weather-station storybook, simple instruments and sky backdrop, bright educational colors, clean contours", 88, "weather-station", "two short beats before answer confirmation"),
    "0051": SongProfile("0051", "Starship Letter Quest", "bright preschool space-pop, kalimba, glockenspiel, soft synth sparkles, hand claps, clear warm lead, 90 BPM, spacious cosmic bounce", "dark sci-fi, EDM drops, trap, robotic lead vocals, dense pads, fast rap", "Count the stars—A-B-C!", "Space words shine for you and me!", "{letter} finds {object} on our starship quest.", "{letter} ... {object}! Point, then say your best.", "friendly 3D preschool space storybook, deep blue and violet with warm star glow, rounded spacecraft forms, clean isolated subjects", 90, "starship-bounce", "one quiet beat after each letter cue"),
    "0052": SongProfile("0052", "Planet Parade A-Z", "gentle preschool orbit-pop, marimba, ukulele, celesta, soft kick, clear female lead, 86 BPM, circular two-bar groove", "heavy techno, cinematic menace, rap, distorted bass, long ambient intro, vocal runs", "Round the planets, A-B-C!", "Stars and worlds spin happily!", "{letter} shows {object} in our planet parade.", "{letter} ... {object}! Find the match we made.", "colorful 3D preschool planets-and-stars storybook, rounded planets, soft nebula accents, high-contrast foreground objects", 86, "orbit-circle", "soft two-beat retrieval window"),
    "0053": SongProfile("0053", "Rocket Ready ABC", "energetic preschool launch-pop, ukulele, light toms, glockenspiel, hand claps, clear lead, 94 BPM, countdown-like rhythmic lift", "aggressive rock, explosive sound effects, trap hats, rap, shouting, dense choir", "Rocket ready—A-B-C!", "Launch the letters, one-two-three!", "{letter} brings {object} to our rocket crew.", "{letter} ... {object}! Point and say it true.", "bright 3D preschool rockets-and-astronauts storybook, white-blue-orange palette, friendly suits, simple clean silhouettes", 94, "rocket-count", "one beat of silence before confirmation"),
    "0054": SongProfile("0054", "Moonbeam Alphabet", "dreamy preschool lunar-pop, celesta, soft ukulele, brushed shaker, warm lead, 82 BPM, gentle moonlit sway with clear diction", "dark ambient drones, sleepy whispering, complex jazz, rap, heavy drums, huge reverb", "Moonbeam letters, glow with me!", "Galaxy words from A to Z!", "{letter} meets {object} beneath the moonlit glow.", "{letter} ... {object}! Point, remember, know.", "soft 3D moon-and-galaxy storybook, silver blue lavender palette, glowing edges, uncluttered foreground composition", 82, "moonbeam-sway", "two calm beats before target reveal"),
    "0055": SongProfile("0055", "Little Space Lab", "curious preschool science-pop, pizzicato strings, marimba, soft synth plucks, glockenspiel, clear lead, 88 BPM, tidy discovery pulse", "hard techno, dense science narration, rap, rock, atonal effects, long instrumental breaks", "Space lab letters—A-B-C!", "Look and learn across the galaxy!", "{letter} shows {object} in our little space lab.", "{letter} ... {object}! Point and name the space clue.", "clean 3D preschool space-science lab storybook, bright consoles and star windows, toy-like equipment, strong foreground separation", 88, "space-lab", "short predictable pause before answer"),
    "0056": SongProfile("0056", "Dinosaur Stomp ABC", "bouncy preschool dino-pop, low marimba, ukulele, soft floor-tom stomps, claps, friendly lead, 90 BPM, playful heavy-light pulse", "scary roars, aggressive rock, cinematic danger, trap, shouting, distorted guitars", "Dino stomp—A-B-C!", "Ancient friends, come stomp with me!", "{letter} meets {object} in our dinosaur world.", "{letter} ... {object}! Point and say the word.", "friendly 3D dinosaur storybook, earthy greens and amber, rounded non-scary dinosaurs, museum-clean silhouettes", 90, "dino-stomp", "one stomp-sized beat of silence"),
    "0057": SongProfile("0057", "Fossil Finder A-Z", "curious preschool fossil-folk, acoustic guitar, woodblock, glockenspiel, light shaker, clear lead, 84 BPM, gentle digging rhythm", "dark archaeology ambience, rock, rap, loud impacts, complex orchestration, breathless delivery", "Brush the fossil—A-B-C!", "Bones and clues for you and me!", "{letter} finds {object} in our fossil search.", "{letter} ... {object}! Point to the ancient clue.", "warm 3D fossil-and-bones storybook, sandy museum dig palette, friendly specimens, clean separable foregrounds", 84, "fossil-brush", "two-beat thinking pause"),
    "0058": SongProfile("0058", "Prehistoric Picture Walk", "light preschool story-pop, marimba, ukulele, pizzicato bass, gentle claps, clear lead, 87 BPM, walking museum rhythm", "scary cinematic score, metal, rap, roaring effects over vocals, dense choir, fast patter", "Long ago—A-B-C!", "Prehistoric pictures, look with me!", "{letter} shows {object} from a prehistoric day.", "{letter} ... {object}! Point, remember, say.", "colorful 3D prehistoric-life storybook, fern greens and warm earth tones, calm creatures, uncluttered scene pieces", 87, "prehistoric-walk", "one clear beat before the answer"),
    "0059": SongProfile("0059", "Dino Trail Explorer", "adventure preschool folk-pop, acoustic guitar, light stomps, marimba, whistle accents, clear lead, 92 BPM, easy trail pulse", "action-movie score, heavy drums, rock shouting, rap, scary roars, dense effects", "Dino trail—come follow me!", "Track the letters A to Z!", "{letter} finds {object} on our dinosaur trail.", "{letter} ... {object}! Point it out without fail.", "3D preschool dinosaur explorer storybook, field-guide trail mood, bright foliage and rocks, safe friendly creatures, bold contours", 92, "dino-trail", "brief cue gap with percussion thinned"),
    "0060": SongProfile("0060", "Museum Dino March", "preschool museum-march pop, soft snare brushes, xylophone, ukulele, hand claps, clear lead, 89 BPM, neat exhibit-to-exhibit pulse", "military aggression, loud brass, hard rock, rap, scary effects, complex syncopation", "Museum march—A-B-C!", "Dinosaur displays for us to see!", "{letter} shows {object} in our dinosaur museum.", "{letter} ... {object}! Point to the exhibit now.", "bright 3D dinosaur museum storybook, polished exhibits and signs without readable text, warm gallery light, isolated subjects", 89, "museum-march", "one beat of quiet before target confirmation"),
    "0061": SongProfile("0061", "Tiny Bug Bounce", "playful preschool bug-pop, marimba, ukulele, shaker, finger snaps, clear lead, 93 BPM, tiny bouncing groove", "creepy ambience, buzzing over vocals, rock, rap, EDM drops, frantic tempo", "Tiny bugs—A-B-C!", "Crawl and flutter, look with me!", "{letter} shows {object} in our tiny bug world.", "{letter} ... {object}! Point and say the word.", "cute 3D bug storybook, macro garden colors, friendly non-scary insects, bold clean outlines, simple backgrounds", 93, "bug-bounce", "short one-beat retrieval gap"),
    "0062": SongProfile("0062", "Butterfly Beetle Beat", "bright preschool garden-pop, kalimba, marimba, hand claps, soft bass, clear lead, 95 BPM, flutter-and-tap rhythm", "EDM, heavy buzzing, distorted rock, rap, vocal riffs, dense percussion", "Flutter, tap—A-B-C!", "Butterflies and beetles dance with me!", "{letter} meets {object} where wings and beetles play.", "{letter} ... {object}! Find it, point, and say.", "vivid 3D butterfly-and-beetle storybook, flower colors, shiny but simple insect forms, segmentation-friendly spacing", 95, "flutter-tap", "one beat after cue, then bright answer"),
    "0063": SongProfile("0063", "Garden Bug Hunt", "curious preschool acoustic-pop, ukulele, claves, glockenspiel, shaker, friendly lead, 90 BPM, seek-and-find pulse", "creepy horror insects, rock, rap, trap, loud sound effects, fast patter", "Garden bugs—look with me!", "Find the letters A to Z!", "{letter} finds {object} on our garden bug hunt.", "{letter} ... {object}! Point to the tiny clue.", "friendly 3D garden-insect storybook, leafy greens and flower accents, close-up clean subjects, no clutter", 90, "bug-hunt", "brief search pause before answer"),
    "0064": SongProfile("0064", "Little Creature Crawl", "gentle preschool pizzicato-pop, plucked strings, marimba, soft shaker, clear lead, 86 BPM, tiptoe crawl rhythm", "spooky ambience, hard drums, rap, EDM, whisper vocals, dense reverb", "Creep and crawl—A-B-C!", "Tiny creatures, come with me!", "{letter} shows {object} in our little-creature view.", "{letter} ... {object}! Point and name the tiny one.", "soft 3D tiny-creature storybook, mossy garden palette, friendly magnified forms, high-contrast clean silhouettes", 86, "creature-crawl", "two small beats of thinking space"),
    "0065": SongProfile("0065", "Insect Explorer ABC", "bouncy preschool explorer-pop, acoustic guitar, marimba, claps, whistle accents, clear lead, 92 BPM, field-guide groove", "adventure-rock, scary insects, rap, EDM drops, dense backing vocals, shouting", "Bug explorer—A-B-C!", "Spot the tiny clues with me!", "{letter} finds {object} on our insect explorer trail.", "{letter} ... {object}! Point, then say what you found.", "3D preschool insect explorer storybook, friendly field-guide aesthetic, bright garden palette, isolated specimens", 92, "insect-trail", "one quiet beat before confirmation"),
    "0066": SongProfile("0066", "Birdsong Alphabet", "airy preschool acoustic-pop, flute-like whistle, ukulele, glockenspiel, soft shaker, clear lead, 88 BPM, light soaring contour", "loud bird calls masking words, rock, rap, EDM, operatic vocals, dense choir", "Birdsong letters—A-B-C!", "Feathered friends sing back to me!", "{letter} shows {object} in our bird world today.", "{letter} ... {object}! Point and softly say.", "bright 3D bird storybook, sky blues and leafy greens, anatomically clear friendly birds, clean branches and backgrounds", 88, "birdsong-lilt", "one beat with bird effects muted"),
    "0067": SongProfile("0067", "Feather Nest Melody", "gentle preschool folk-pop, acoustic guitar, soft woodblock, glockenspiel, warm lead, 84 BPM, nest-rocking sway", "loud avian effects, heavy drums, rap, EDM, dramatic strings, vocal runs", "Feather, nest—A-B-C!", "Bird homes and friends for us to see!", "{letter} meets {object} near a feathered nest.", "{letter} ... {object}! Point and say your best.", "cozy 3D feathers-and-nests storybook, warm twig browns and egg pastels, friendly birds, simple isolated subjects", 84, "nest-sway", "two calm beats before answer"),
    "0068": SongProfile("0068", "Backyard Bird Hop", "cheerful preschool backyard-pop, ukulele, hand claps, shaker, whistle, clear lead, 94 BPM, hop-stop groove", "rock shouting, rap, EDM drops, loud bird chorus, dense percussion, fast syllables", "Backyard birds—hop with me!", "Wing by wing from A to Z!", "{letter} finds {object} in our backyard bird scene.", "{letter} ... {object}! Point to what you've seen.", "sunny 3D backyard-bird storybook, fences shrubs feeders and sky kept simple, crisp isolated birds", 94, "bird-hop", "one hop-sized beat before target"),
    "0069": SongProfile("0069", "Wing and Water ABC", "light preschool nature-pop, marimba, soft acoustic guitar, brushed percussion, clear lead, 87 BPM, gentle wing-and-water pulse", "storm ambience, loud splashes, rock, rap, EDM, dense choir", "Wing and water—A-B-C!", "Land and lake birds, look with me!", "{letter} shows {object} where birds meet land and water.", "{letter} ... {object}! Point and name the bird clue.", "3D preschool water-and-land bird storybook, blue-green wetland palette, calm friendly birds, clean foreground spacing", 87, "wing-water", "soft two-beat retrieval pause"),
    "0070": SongProfile("0070", "Little Birdwatcher", "curious preschool field-guide pop, acoustic guitar, pizzicato strings, glockenspiel, soft claps, clear lead, 90 BPM, binocular-look rhythm", "dramatic nature documentary, rock, rap, loud bird calls, complex jazz, fast delivery", "Binoculars up—A-B-C!", "Birdwatch letters, look with me!", "{letter} finds {object} on our birdwatching walk.", "{letter} ... {object}! Point before we talk.", "friendly 3D birdwatching storybook, simple trail and binocular motifs, natural bright colors, isolated birds", 90, "birdwatch-step", "one clear observation beat before answer"),
    "0071": SongProfile("0071", "Pet Care ABC", "warm preschool acoustic-pop, ukulele, marimba, soft claps, gentle bass, caring lead vocal, 88 BPM, tidy routine groove", "loud barking, rock, rap, EDM, baby-talk, dense effects", "Pet care letters—A-B-C!", "Gentle hands and words with me!", "{letter} shows {object} in our pet-care day.", "{letter} ... {object}! Point, then gently say.", "cozy 3D pet-care storybook, warm home palette, friendly animals and supplies, clean safe scenes", 88, "pet-care", "one calm beat before confirmation"),
    "0072": SongProfile("0072", "Pets at Home A-Z", "cozy preschool home-pop, acoustic guitar, glockenspiel, shaker, soft kick, clear lead, 86 BPM, relaxed indoor bounce", "chaotic animal sounds, rock, trap, rap, EDM drops, vocal riffs", "Pets at home—A-B-C!", "Cozy words for you and me!", "{letter} finds {object} in our pet-friendly home.", "{letter} ... {object}! Find it, point, and name.", "soft 3D home-pet storybook, cozy rooms, pastel pet accessories, friendly animal proportions, uncluttered", 86, "home-pet", "two short beats of retrieval space"),
    "0073": SongProfile("0073", "Pet Playtime Beat", "bouncy preschool play-pop, ukulele, hand claps, marimba, light kick, clear lead, 96 BPM, playful stop-and-go groove", "hyperactive EDM, loud barking, rock, rap, fast vocal runs, dense percussion", "Pet playtime—A-B-C!", "Play and point along with me!", "{letter} brings {object} to our pet playtime.", "{letter} ... {object}! Point and say it on the beat.", "colorful 3D pet-play storybook, toys and friendly pets, bright rounded forms, clean object separation", 96, "pet-play", "short stop-beat before the target"),
    "0074": SongProfile("0074", "Small Animal Friends", "gentle preschool friendship-pop, kalimba, acoustic guitar, soft shaker, glockenspiel, warm lead, 84 BPM, small-step sway", "scary animal sounds, heavy rock, rap, EDM, whisper vocals, complex harmony", "Small friends—A-B-C!", "Tiny paws and tails with me!", "{letter} shows {object} among our small animal friends.", "{letter} ... {object}! Point and name your friend.", "cute 3D small-animal storybook, cozy pastel habitats, soft rounded animals, clear isolated forms", 84, "small-friend", "two gentle beats before answer"),
    "0075": SongProfile("0075", "Pet Shop Picture Song", "cheerful preschool shop-pop, marimba, ukulele, light woodblock, claps, clear lead, 91 BPM, browse-and-point rhythm", "commercial jingle shouting, rock, rap, EDM, dense chatter, cash-register effects over vocals", "Pet shop pictures—A-B-C!", "Look and learn along with me!", "{letter} finds {object} on our pet-shop picture wall.", "{letter} ... {object}! Point and name it all.", "bright 3D pet-shop storybook, organized shelves and animal enclosures, no readable labels, clean subjects", 91, "pet-shop", "one browse beat before confirmation"),
    "0076": SongProfile("0076", "Zoo Friends ABC", "bright preschool zoo-pop, marimba, ukulele, soft hand drums, claps, friendly lead, 92 BPM, easy animal parade groove", "scary roars, heavy drums, rock, rap, EDM drops, shouting", "Zoo friends—A-B-C!", "Animal words for you and me!", "{letter} shows {object} in our friendly zoo.", "{letter} ... {object}! Point and say it too.", "friendly 3D zoo storybook, colorful habitats, non-scary animals, bold silhouettes, simple backgrounds", 92, "zoo-parade", "one beat with animal sounds reduced"),
    "0077": SongProfile("0077", "Safari Letter Ride", "sunny preschool safari-pop, acoustic guitar, marimba, shaker, light toms, clear lead, 94 BPM, rolling jeep-like rhythm", "cinematic danger, loud drums, rock, rap, animal attacks, dense effects", "Safari ride—A-B-C!", "Wildlife words come ride with me!", "{letter} finds {object} on our safari ride.", "{letter} ... {object}! Point to the wild friend.", "bright 3D safari storybook, golden grass and blue sky, friendly wildlife, clean separated foreground subjects", 94, "safari-roll", "one clear beat before answer"),
    "0078": SongProfile("0078", "Habitat Hop A-Z", "playful preschool world-pop, marimba, ukulele, soft percussion, glockenspiel, clear lead, 90 BPM, habitat-to-habitat hop", "world-music pastiche overload, rock, rap, EDM, dense percussion, loud effects", "Habitat hop—A-B-C!", "Homes for animals, come and see!", "{letter} shows {object} in an animal habitat scene.", "{letter} ... {object}! Point to what you've seen.", "3D preschool animal-habitat storybook, clear mini-biomes, friendly creatures, uncluttered educational composition", 90, "habitat-hop", "brief thinking beat before reveal"),
    "0079": SongProfile("0079", "Wild World Letter Song", "upbeat preschool nature-pop, acoustic guitar, hand claps, marimba, soft bass, clear lead, 93 BPM, broad outdoor bounce", "aggressive wildlife soundtrack, rock, rap, EDM, scary roars, vocal belting", "Wild world letters—A-B-C!", "Big and small, come look with me!", "{letter} meets {object} in our wild animal world.", "{letter} ... {object}! Point and say the word.", "colorful 3D wild-animal storybook, varied but simple habitat backdrops, friendly proportions, bold contours", 93, "wild-world", "one beat of quiet before target"),
    "0080": SongProfile("0080", "Zoo Explorer Trail", "preschool explorer-folk pop, acoustic guitar, whistle, marimba, light claps, clear lead, 89 BPM, map-following groove", "action adventure score, rock, rap, EDM drops, scary animal effects, dense drums", "Zoo explorer—A-B-C!", "Follow the animal trail with me!", "{letter} finds {object} on our zoo explorer trail.", "{letter} ... {object}! Point and mark the clue.", "3D preschool zoo-explorer storybook, map-and-binocular mood, friendly habitats, clean isolated animal subjects", 89, "zoo-trail", "two short beats for searching"),
    "0081": SongProfile("0081", "Scales and Ponds ABC", "gentle preschool reptile-pop, marimba, acoustic guitar, soft woodblock, clear lead, 87 BPM, slow slither-and-hop rhythm", "horror snakes, dark ambience, heavy rock, rap, hiss effects over vocals, fast tempo", "Scales and ponds—A-B-C!", "Reptile friends, look with me!", "{letter} shows {object} in our reptile and amphibian world.", "{letter} ... {object}! Point and name it calmly.", "friendly 3D reptile-and-amphibian storybook, pond greens and warm stones, non-scary creatures, clean silhouettes", 87, "scale-pond", "two calm beats before answer"),
    "0082": SongProfile("0082", "Frog Snake Turtle Song", "playful preschool creature-pop, ukulele, marimba, soft claps, shaker, clear lead, 91 BPM, hop-slither-step groove", "scary hissing, rock, rap, EDM, loud croaks, dense percussion", "Hop, slither, turtle—A-B-C!", "Creature words come play with me!", "{letter} meets {object} in our frog, snake, and turtle scene.", "{letter} ... {object}! Point and say the creature name.", "bright 3D frogs-snakes-turtles storybook, friendly rounded reptiles and amphibians, simple pond-and-log setting", 91, "hop-slither", "one beat between cue and confirmation"),
    "0083": SongProfile("0083", "Scales and Slime Rhyme", "quirky preschool acoustic-pop, pizzicato strings, marimba, soft shaker, claps, clear lead, 89 BPM, playful tactile rhythm", "gross-out comedy, horror, rock, rap, EDM drops, squealing vocals", "Scales and slime—A-B-C!", "Look, don't touch—just point with me!", "{letter} shows {object} in our scales-and-slime view.", "{letter} ... {object}! Point and say the clue.", "friendly 3D scales-and-slime storybook, glossy but clean textures, non-scary creatures, high-contrast foregrounds", 89, "scale-slime", "one quiet beat before target"),
    "0084": SongProfile("0084", "Cool Creature ABC", "calm preschool nature-pop, kalimba, soft acoustic guitar, glockenspiel, brushed percussion, clear lead, 84 BPM, steady cool-tempo sway", "dark documentary, rock, rap, EDM, scary effects, dense choir", "Cool creatures—A-B-C!", "Scales and skins for us to see!", "{letter} finds {object} in our cold-blooded creature world.", "{letter} ... {object}! Point and name it slow.", "soft 3D cold-blooded-creature storybook, natural greens browns and water blues, friendly educational presentation", 84, "cool-creature", "two beats for recall"),
    "0085": SongProfile("0085", "Reptile House Walk", "curious preschool museum-pop, woodblock, marimba, ukulele, soft bass, clear lead, 88 BPM, exhibit-walk pulse", "spooky zoo ambience, rock, rap, EDM, loud hissing, fast patter", "Reptile house—A-B-C!", "Walk and point along with me!", "{letter} shows {object} in our reptile-house visit.", "{letter} ... {object}! Point to the exhibit friend.", "bright 3D reptile-house storybook, safe glass habitats without text, warm gallery light, isolated creatures", 88, "reptile-walk", "one exhibit-view beat before answer"),
    "0086": SongProfile("0086", "Kitchen Letter Mix", "cheerful preschool kitchen-pop, ukulele, woodblock, marimba, hand claps, clear lead, 92 BPM, stir-and-tap groove", "metal clanging over vocals, rock, rap, EDM, fast cooking instructions, dense effects", "Kitchen mix—A-B-C!", "Food and tools for you and me!", "{letter} shows {object} in our little kitchen.", "{letter} ... {object}! Point and name the picture.", "warm 3D preschool kitchen storybook, colorful safe utensils and foods, rounded forms, clean countertop composition", 92, "kitchen-mix", "one beat with utensil sounds muted"),
    "0087": SongProfile("0087", "Cook and Count Letters", "light preschool cooking-pop, marimba, acoustic guitar, soft shaker, claps, clear lead, 90 BPM, measured recipe pulse", "rapid recipe narration, rock, rap, EDM drops, loud appliance sounds, vocal riffs", "Cook and look—A-B-C!", "Tools and ingredients, sing with me!", "{letter} finds {object} in our cooking-tool scene.", "{letter} ... {object}! Point to what you've seen.", "3D preschool cooking-tools storybook, bright utensils and ingredients, child-safe presentation, segmentation-friendly spacing", 90, "cook-look", "short predictable pause before target"),
    "0088": SongProfile("0088", "Meal and Snack Beat", "bouncy preschool food-pop, ukulele, marimba, finger snaps, soft kick, clear lead, 94 BPM, snack-time bounce", "commercial pop belting, rap, EDM, fast food slogans, dense percussion, vocal runs", "Meals and snacks—A-B-C!", "Tasty pictures, look with me!", "{letter} brings {object} to our meal-and-snack table.", "{letter} ... {object}! Point and name it now.", "colorful 3D preschool meals-and-snacks storybook, cheerful plates and foods, simple table, clean isolated items", 94, "snack-bounce", "one beat before answer confirmation"),
    "0089": SongProfile("0089", "Cooking Together ABC", "warm preschool family-folk pop, acoustic guitar, hand claps, marimba, shaker, clear lead, 88 BPM, cooperative kitchen rhythm", "busy family chatter, rock, rap, EDM, loud appliances, complex harmonies", "Cook together—A-B-C!", "Share the kitchen words with me!", "{letter} shows {object} while we cook together.", "{letter} ... {object}! Point and say it safely.", "cozy 3D preschool family-kitchen storybook, warm colors, safe supervised cooking cues, uncluttered foregrounds", 88, "cook-together", "two short beats before confirmation"),
    "0090": SongProfile("0090", "Tasty Kitchen A-Z", "sunny preschool kitchen-pop, glockenspiel, ukulele, marimba, soft claps, clear lead, 93 BPM, crisp tasty bounce", "food commercial jingle, rock, rap, EDM, mouth sounds, dense vocal stacks", "Tasty kitchen—A-B-C!", "Name the foods and tools with me!", "{letter} finds {object} in our tasty kitchen view.", "{letter} ... {object}! Point and say the clue.", "bright 3D tasty-kitchen storybook, fresh food colors, friendly cookware, clean high-contrast composition", 93, "tasty-kitchen", "one clear beat before target"),
    "0091": SongProfile("0091", "Fruit Veggie Rainbow", "bright preschool produce-pop, ukulele, marimba, claps, shaker, clear lead, 95 BPM, colorful bouncing groove", "diet talk, commercial slogans, rock, rap, EDM drops, fast patter", "Fruit and veggies—A-B-C!", "Rainbow foods for us to see!", "{letter} shows {object} in our fruit-and-veggie rainbow.", "{letter} ... {object}! Point and name the produce.", "vivid 3D fruit-and-vegetable storybook, rainbow produce palette, simple baskets, clean isolated foods", 95, "produce-rainbow", "one beat before answer"),
    "0092": SongProfile("0092", "Garden Food Groove", "gentle preschool garden-pop, acoustic guitar, marimba, soft woodblock, clear lead, 88 BPM, grow-and-pick rhythm", "diet messaging, rock, rap, EDM, dense farm effects, shouting", "Garden foods—A-B-C!", "Grow and name them all with me!", "{letter} finds {object} in our garden-food patch.", "{letter} ... {object}! Point and name the match.", "friendly 3D garden-food storybook, raised beds and produce, leafy greens with bright vegetables, clean subjects", 88, "garden-food", "two small beats for retrieval"),
    "0093": SongProfile("0093", "Market Basket ABC", "cheerful preschool market-pop, marimba, ukulele, light hand percussion, claps, clear lead, 92 BPM, basket-to-basket groove", "crowd chatter over vocals, commercial jingles, rock, rap, EDM, fast sales patter", "Market basket—A-B-C!", "Fresh produce, look with me!", "{letter} shows {object} in our market basket row.", "{letter} ... {object}! Point and say what you know.", "bright 3D produce-market storybook, neat baskets and stalls without readable signs, colorful isolated foods", 92, "market-basket", "one beat of quiet before target"),
    "0094": SongProfile("0094", "Fresh Food Letter Song", "warm preschool acoustic-pop, guitar, glockenspiel, soft shaker, marimba, clear lead, 87 BPM, relaxed fresh-food rhythm", "nutrition lectures, rock, rap, EDM, complex harmony, vocal riffs", "Fresh foods—A-B-C!", "Colorful produce, sing with me!", "{letter} meets {object} in our fresh-produce picture.", "{letter} ... {object}! Point and name it clearly.", "clean 3D fresh-produce storybook, natural fruit and vegetable colors, simple white-and-green market setting, strong silhouettes", 87, "fresh-food", "two calm beats before confirmation"),
    "0095": SongProfile("0095", "Colorful Produce Parade", "upbeat preschool parade-pop, ukulele, marimba, hand claps, soft snare, clear lead, 94 BPM, colorful marching bounce", "military march, rock, rap, EDM drops, diet slogans, dense brass", "Color parade—A-B-C!", "Produce colors, come with me!", "{letter} brings {object} to our colorful food parade.", "{letter} ... {object}! Point to the produce now.", "vibrant 3D colorful-produce storybook, rainbow baskets, rounded fruit and vegetables, uncluttered parade layout", 94, "produce-parade", "one parade beat before answer"),
    "0096": SongProfile("0096", "Bakery Morning ABC", "cozy preschool bakery-pop, acoustic guitar, glockenspiel, soft shaker, hand claps, clear lead, 86 BPM, warm morning sway", "commercial jingles, rock, rap, EDM, loud oven sounds, sugary hype", "Bakery morning—A-B-C!", "Warm little treats for us to see!", "{letter} shows {object} in our bakery morning.", "{letter} ... {object}! Point and name the treat.", "warm 3D preschool bakery storybook, golden bread tones and pastel icing, clean counters, isolated baked goods", 86, "bakery-morning", "two gentle beats before target"),
    "0097": SongProfile("0097", "Bread and Pastry Bounce", "bouncy preschool bakery-pop, marimba, ukulele, light claps, soft bass, clear lead, 92 BPM, knead-and-bounce rhythm", "food commercials, hard rock, rap, EDM drops, kitchen noise, vocal runs", "Bread and pastry—A-B-C!", "Bake the picture words with me!", "{letter} finds {object} in our bread-and-pastry shop.", "{letter} ... {object}! Point before the beat can stop.", "bright 3D bread-and-pastry storybook, golden crusts and soft pastel bakery colors, clean isolated baked goods", 92, "pastry-bounce", "one beat before confirmation"),
    "0098": SongProfile("0098", "Cake Cookie Clap", "playful preschool dessert-pop, ukulele, glockenspiel, hand claps, marimba, clear lead, 95 BPM, clap-and-pause groove", "sugar marketing, rock, rap, EDM, dense frosting sound effects, belting", "Cake, cookie—A-B-C!", "Clap the bakery words with me!", "{letter} shows {object} on our cake-and-cookie table.", "{letter} ... {object}! Point and name it now.", "colorful 3D cakes-and-cookies storybook, playful icing colors, simple serving table, clear single-item foregrounds", 95, "cake-cookie-clap", "short clap-stop gap before target"),
    "0099": SongProfile("0099", "Sweet Shop Picture Walk", "gentle preschool shop-pop, marimba, acoustic guitar, soft shaker, glockenspiel, clear lead, 89 BPM, browse-and-smile pulse", "commercial shouting, rock, rap, EDM, crowd chatter, fast sales language", "Sweet shop pictures—A-B-C!", "Bakery treats for us to see!", "{letter} finds {object} in our sweet-shop picture row.", "{letter} ... {object}! Point and say what you know.", "friendly 3D sweet-shop storybook, pastel bakery cases without readable labels, neat isolated treats, warm light", 89, "sweet-shop", "one browse beat before answer"),
    "0100": SongProfile("0100", "Little Baking Day", "warm preschool baking-folk pop, acoustic guitar, woodblock, marimba, soft claps, clear lead, 88 BPM, mix-roll-bake rhythm", "loud appliances, rock, rap, EDM, complex recipe narration, commercial slogans", "Baking day—A-B-C!", "Mix and name the words with me!", "{letter} shows {object} on our little baking day.", "{letter} ... {object}! Point, remember, say.", "cozy 3D preschool baking-day storybook, warm kitchen colors, safe supervised tools and baked goods, clean foreground separation", 88, "baking-day", "two short beats before confirmation"),
}

# Batch 0101-0150 uses compact curated blueprints layered on domain presets.
# Each song keeps its own hook, teaching frame, retrieval frame, motif and BPM;
# shared domain presets only provide instrumentation/exclusion/visual art direction.
DOMAIN_PRESETS_0101_0150 = {
    "school": ("bright preschool classroom-pop, piano, marimba, woodblock, claps, clear lead", "rock, rap, EDM, school-bell masking, fast patter", "clean 3D classroom storybook, colorful supplies, simple desks, isolated objects"),
    "art": ("creative preschool art-pop, ukulele, marimba, glockenspiel, brushes, clear lead", "rock, rap, EDM, cluttered sound effects, fast tutorials", "colorful 3D art-studio storybook, safe materials, crisp separated foregrounds"),
    "music": ("playful preschool music-pop, piano, hand percussion, bells, light strings, clear lead", "rock solos, rap, EDM drops, dense orchestra, virtuoso runs", "polished 3D music-room storybook, one clear instrument or symbol per target"),
    "toys": ("bouncy preschool toy-pop, ukulele, toy piano, claps, marimba, clear lead", "commercial jingles, rock, rap, EDM, chaotic toy noise", "bright 3D playroom storybook, rounded safe toys, simple uncluttered scenes"),
    "sports": ("energetic preschool movement-pop, claps, light drum, guitar, marimba, clear lead", "stadium roar, rock, rap, EDM, aggressive competition", "friendly 3D preschool sports storybook, safe gear, simple active scenes"),
    "road": ("cheerful preschool transport-pop, ukulele, woodblock, marimba, soft drum, clear lead", "engine roar, sirens, rock, rap, EDM, traffic noise masking vocals", "bright 3D road-vehicle storybook, toy-like vehicles, safe roads, clean silhouettes"),
    "rail": ("gentle preschool train-pop, acoustic guitar, bell, woodblock, soft chug rhythm, clear lead", "loud train horns, rock, rap, EDM, station announcements masking words", "warm 3D railway storybook, toy trains, clean platforms and trackside scenes"),
    "air": ("airy preschool aviation-pop, kalimba, bells, light drum, soft pads, clear lead", "jet roar, combat themes, rock, rap, EDM, PA announcements masking words", "bright 3D civilian aviation storybook, toy aircraft and ground gear, clean sky scenes"),
    "boat": ("sunny preschool harbor-pop, ukulele, marimba, shaker, soft hand drum, clear lead", "storm drama, pirate battle, rock, rap, EDM, loud foghorns", "friendly 3D boat-and-harbor storybook, calm water, clean civilian watercraft"),
    "build": ("steady preschool construction-pop, woodblock, marimba, guitar, soft drum, clear lead", "real machinery noise, rock, rap, EDM, unsafe tool demonstrations", "friendly 3D construction storybook, safe observer framing, toy-like machines and tools"),
}

PROFILE_BLUEPRINTS_0101_0150: dict[str, tuple[str, str, str, str, str, str, int, str]] = {
    "0101": ("Classroom Picture Parade", "Classroom parade—A-B-C!", "School things march for us to see!", "{letter} puts {object} in our classroom parade.", "{letter} ... {object}! Point when the picture is displayed.", "class-parade", 90, "school"),
    "0102": ("Learning Tools Tap", "Tap the tools—A-B-C!", "Learning helpers, come with me!", "For {letter}, our learning tool is {object} today.", "{letter} ... {object}! Tap once, point, and say.", "tool-tap", 86, "school"),
    "0103": ("School Day Steps", "Step through school—A-B-C!", "Every school-day word with me!", "{letter} meets {object} during our school-day walk.", "Call {letter} ... {object}! Point before we talk.", "school-step", 92, "school"),
    "0104": ("Learn and Look A-Z", "Learn and look—A-B-C!", "Find the classroom clue with me!", "Look at {letter}; {object} is our learning clue.", "Show {letter} ... then {object}! Say the pair when you know.", "learn-look", 84, "school"),
    "0105": ("Classroom Action ABC", "Classroom action—A-B-C!", "Point, find, learn with me!", "{letter} brings {object} to today's classroom activity.", "Ready, {letter} ... {object}! Point and say it clearly.", "class-action", 94, "school"),
    "0106": ("Art Studio Colors", "Art studio—A-B-C!", "Shapes and colors, paint with me!", "{letter} shows {object} on our art-studio table.", "{letter} ... {object}! Point when you are able.", "studio-color", 88, "art"),
    "0107": ("Craft Box Bounce", "Craft box bounce—A-B-C!", "Colors and crafts jump with me!", "From the craft box, {letter} picks {object} for our design.", "Cue {letter} ... {object}! Point when the shapes align.", "craft-bounce", 93, "art"),
    "0108": ("Draw Paint Sing", "Draw, paint, sing—A-B-C!", "Make a picture, sing with me!", "On our picture page, {letter} draws {object} in view.", "First {letter} ... then {object}! Point to the drawing too.", "draw-paint", 85, "art"),
    "0109": ("Creative Tool Trail", "Creative tools—A-B-C!", "Make and name them carefully!", "{letter} finds {object} at our creative-work table.", "Find {letter} ... {object}! Point to the tool or material.", "creative-trail", 91, "art"),
    "0110": ("Make Create A-Z", "Make and create—A-B-C!", "Little makers, sing with me!", "For {letter}, {object} joins the thing we make today.", "Think of {letter} ... {object}! Point, remember, say.", "make-create", 89, "art"),
    "0111": ("Instrument Sound Parade", "Instruments play—A-B-C!", "Hear their names and sing with me!", "{letter} introduces {object} in our instrument parade.", "Listen: {letter} ... {object}! Point when its name is played.", "instrument-parade", 90, "music"),
    "0112": ("Rhythm Melody ABC", "Beat and melody—A-B-C!", "Hear the music, count with me!", "On the beat, {letter} names {object} in our music room.", "Hold {letter} ... {object}! Say it when the beat resumes.", "rhythm-melody", 94, "music"),
    "0113": ("Little Orchestra Letters", "Little orchestra—A-B-C!", "Every instrument has a name to see!", "{letter} brings {object} into our little orchestra scene.", "Conductor cues {letter} ... {object}! Point when it is seen.", "orchestra-cue", 86, "music"),
    "0114": ("Music Maker Hop", "Music makers—hop with me!", "A-B-C in harmony!", "{letter} finds {object} while our music makers play.", "Hop on {letter} ... {object}! Point and say.", "music-hop", 92, "music"),
    "0115": ("Sound Shelf A-Z", "Sound shelf—A-B-C!", "Name the instruments quietly!", "On our sound shelf, {letter} labels {object} for listening.", "Quiet cue: {letter} ... {object}! Point before the notes begin.", "sound-shelf", 84, "music"),
    "0116": ("Toy Box Letter Pop", "Toy box pop—A-B-C!", "Pick a toy and sing with me!", "Open the box: {letter} brings out {object} to play.", "Close your eyes—{letter} ... {object}! Point and say.", "toybox-pop", 95, "toys"),
    "0117": ("Playroom Letter Hunt", "Playroom hunt—A-B-C!", "Find the toy that's meant to be!", "Around the playroom, {letter} spots {object} nearby.", "Hunt for {letter} ... {object}! Point when it catches your eye.", "playroom-hunt", 90, "toys"),
    "0118": ("Game Night ABC", "Game time—A-B-C!", "Toys and games for you and me!", "Our game board gives {letter} the picture {object} this round.", "Your turn: {letter} ... {object}! Point when it is found.", "game-turn", 93, "toys"),
    "0119": ("Build Pretend Play", "Build, pretend—A-B-C!", "Make-believe and play with me!", "In pretend play, {letter} chooses {object} for our story.", "Imagine {letter} ... {object}! Point and name it for me.", "pretend-build", 88, "toys"),
    "0120": ("Playground Toy Train", "Playground toys—A-B-C!", "Roll and bounce along with me!", "{letter} rolls past {object} in our playground-toy line.", "Stop at {letter} ... {object}! Point when the toy is mine.", "playground-roll", 94, "toys"),
    "0121": ("Sports Gear Cheer", "Sports gear cheer—A-B-C!", "Move and name the gear with me!", "{letter} shows {object} beside our sports field today.", "Coach calls {letter} ... {object}! Point, then say.", "sports-cheer", 96, "sports"),
    "0122": ("Move and Play Letters", "Move and play—A-B-C!", "Little motions, follow me!", "With {letter}, {object} joins our move-and-play scene.", "Freeze on {letter} ... {object}! Point when you see it.", "move-freeze", 98, "sports"),
    "0123": ("Balls Bikes Gear Ride", "Balls and bikes—A-B-C!", "Sports gear rolls with me!", "{letter} brings {object} onto our balls-bikes-and-gear track.", "Signal {letter} ... {object}! Point before we circle back.", "gear-ride", 92, "sports"),
    "0124": ("Active Kids A-Z", "Active kids—A-B-C!", "Move, then name the word with me!", "For {letter}, we notice {object} during our active-kids game.", "Ready for {letter} ... {object}! Point and say the name.", "active-name", 95, "sports"),
    "0125": ("Playground Sports Stop-Go", "Stop and go—A-B-C!", "Playground sports, move with me!", "At our playground, {letter} points to {object} before we go.", "Stop! {letter} ... {object}! Say it, then go.", "stop-go", 97, "sports"),
    "0126": ("Things That Go Parade", "Things that go—A-B-C!", "Roll and ride along with me!", "{letter} brings {object} into our things-that-go parade.", "Traffic pauses: {letter} ... {object}! Point when it is displayed.", "go-parade", 93, "road"),
    "0127": ("Truck Machine Beat", "Cars and trucks—A-B-C!", "Machines roll by for us to see!", "On our vehicle lane, {letter} drives past {object} today.", "Park on {letter} ... {object}! Point and say.", "truck-beat", 91, "road"),
    "0128": ("Road Vehicle Signs", "Road vehicles—A-B-C!", "Watch the lane and sing with me!", "{letter} meets {object} on our calm road-vehicle route.", "Road sign cues {letter} ... {object}! Point it out.", "road-route", 89, "road"),
    "0129": ("Transport World A-Z", "Transport world—A-B-C!", "Ways to travel, come with me!", "Around transport world, {letter} discovers {object} in view.", "Map cue: {letter} ... {object}! Point to the travel clue.", "transport-map", 87, "road"),
    "0130": ("Moving Machine March", "Moving machines—A-B-C!", "Big and small, roll with me!", "{letter} sends {object} through our moving-machine line.", "Machine stop: {letter} ... {object}! Point right on time.", "machine-march", 94, "road"),
    "0131": ("Station Platform ABC", "Station platform—A-B-C!", "Train-time words arrive with me!", "At the station, {letter} welcomes {object} by the platform.", "Arrival cue: {letter} ... {object}! Point when it comes.", "station-arrive", 88, "rail"),
    "0132": ("Railway Rhythm Ride", "Railway rhythm—A-B-C!", "Chug the picture words with me!", "{letter} carries {object} along our railway rhythm track.", "Chug-chug, {letter} ... {object}! Point before we circle back.", "rail-rhythm", 92, "rail"),
    "0133": ("Trackside Letter Train", "Trackside letters—A-B-C!", "Train and track words, come with me!", "Beside the tracks, {letter} points out {object} as we pass.", "Window cue: {letter} ... {object}! Point through the glass.", "trackside-window", 90, "rail"),
    "0134": ("Subway Stop A-Z", "Subway stop—A-B-C!", "Railway words stop here with me!", "At each subway stop, {letter} reveals {object} on our route.", "Doors pause: {letter} ... {object}! Point it out.", "subway-stop", 91, "rail"),
    "0135": ("Railway Journey Song", "Railway journey—A-B-C!", "Ride the letter line with me!", "On our journey, {letter} finds {object} beyond the train window.", "Remember {letter} ... {object}! Point before we go.", "rail-journey", 86, "rail"),
    "0136": ("Airport Letter Lift", "Airport lift—A-B-C!", "Planes and ground things, sing with me!", "{letter} spots {object} around our friendly airport scene.", "Tower cues {letter} ... {object}! Point when it is seen.", "airport-lift", 90, "air"),
    "0137": ("Flying Machine Sky", "Flying machines—A-B-C!", "Up in the sky, look with me!", "Across the sky, {letter} brings {object} into view.", "Cloud cue: {letter} ... {object}! Point to the flying clue.", "flying-sky", 92, "air"),
    "0138": ("Ground Crew ABC", "Ground crew—A-B-C!", "Airport helpers, work safely!", "On the ground, {letter} labels {object} for our airport crew.", "Safety pause: {letter} ... {object}! Point to the clue.", "ground-crew", 88, "air"),
    "0139": ("Plane Helicopter Hop", "Planes and copters—A-B-C!", "Flying words hop back to me!", "{letter} sends {object} across our plane-and-helicopter picture.", "Land on {letter} ... {object}! Point and say it clearly.", "aviation-hop", 95, "air"),
    "0140": ("Little Flight Day", "Flight day—A-B-C!", "Look up high and sing with me!", "During flight day, {letter} shows {object} in our picture book.", "Pilot says {letter} ... {object}! Point and look.", "flight-day", 87, "air"),
    "0141": ("Harbor Boat Bounce", "Harbor boats—A-B-C!", "Float the picture words with me!", "At the harbor, {letter} brings {object} beside the water.", "Dock cue: {letter} ... {object}! Point to the answer.", "harbor-bounce", 92, "boat"),
    "0142": ("Sail Travel Song", "Sail and travel—A-B-C!", "Sea-trip words come ride with me!", "On our sea trip, {letter} meets {object} along the way.", "Sailor cue: {letter} ... {object}! Point and say.", "sail-travel", 86, "boat"),
    "0143": ("Watercraft Wake A-Z", "Watercraft wake—A-B-C!", "Boats make lines across the sea!", "{letter} guides {object} through our watercraft picture lane.", "Wake pauses: {letter} ... {object}! Point and name.", "watercraft-wake", 94, "boat"),
    "0144": ("Marina Rescue Helpers", "Marina helpers—A-B-C!", "Safe boat words, sing with me!", "At the marina, {letter} shows {object} in a safe rescue scene.", "Helper calls {letter} ... {object}! Point when it is seen.", "marina-helper", 89, "boat"),
    "0145": ("Boat Day Picture Song", "Boat day—A-B-C!", "Float and point along with me!", "On boat day, {letter} finds {object} in our water-side picture.", "Anchor cue: {letter} ... {object}! Point and say it clearly.", "boat-day", 88, "boat"),
    "0146": ("Building Site Picture Tour", "Building site—A-B-C!", "Look from far and learn with me!", "From our safe viewing spot, {letter} shows {object} at the building site.", "Safety cue: {letter} ... {object}! Point to the picture, that's right.", "site-tour", 90, "build"),
    "0147": ("Tool Machine Look", "Tools and machines—A-B-C!", "Look, don't touch—name with me!", "{letter} labels {object} in our supervised tools-and-machines display.", "Hands still: {letter} ... {object}! Point and say.", "tool-look", 86, "build"),
    "0148": ("Builders Work A-Z", "Builders working—A-B-C!", "Watch the jobs safely with me!", "On our picture tour, {letter} finds {object} while builders work.", "Foreman cues {letter} ... {object}! Point, no tool play.", "builder-watch", 92, "build"),
    "0149": ("Construction Gear Stop", "Construction gear—A-B-C!", "Safety first, then point with me!", "At our gear board, {letter} identifies {object} from a safe view.", "Stop sign: {letter} ... {object}! Point to the clue.", "gear-stop", 88, "build"),
    "0150": ("Build Repair Picture Book", "Build and repair—A-B-C!", "Picture-book tools, learn with me!", "Our picture book gives {letter} the object {object} to recognize.", "Book pause: {letter} ... {object}! Point, then say the name.", "repair-book", 85, "build"),
}

for _sid, (_title, _hook_a, _hook_b, _round1, _round2, _motif, _bpm, _domain) in PROFILE_BLUEPRINTS_0101_0150.items():
    _style, _exclude, _visual = DOMAIN_PRESETS_0101_0150[_domain]
    PROFILES[_sid] = SongProfile(
        _sid,
        _title,
        f"{_style}, {_bpm} BPM, {_motif.replace('-', ' ')} participation groove",
        _exclude,
        _hook_a,
        _hook_b,
        _round1,
        _round2,
        f"{_visual}; visual identity: {_title}",
        _bpm,
        _motif,
        "one to two predictable beats of retrieval space before target confirmation",
    )


# Batch 0151-0200 follows the same scalable pattern: domain-level art/music
# presets plus a curated teaching blueprint for every individual song.
DOMAIN_PRESETS_0151_0200 = {
    "town": ("cheerful preschool town-pop, ukulele, marimba, light drum, bells, clear lead", "traffic noise, sirens, rock, rap, EDM, commercial jingles", "bright 3D neighborhood storybook, friendly streets and buildings, clean isolated subjects"),
    "helpers": ("warm preschool community-pop, acoustic guitar, marimba, claps, soft drum, clear lead", "sirens over vocals, job stereotypes, rock, rap, EDM, dramatic emergency sounds", "friendly 3D community-helper storybook, respectful everyday service scenes, clear foregrounds"),
    "home": ("cozy preschool home-pop, acoustic guitar, toy piano, marimba, shaker, clear lead", "appliance noise, rock, rap, EDM, cluttered room ambience", "warm 3D home storybook, tidy rooms, familiar household objects, simple segmentation-friendly scenes"),
    "clothes": ("playful preschool dress-up pop, ukulele, glockenspiel, claps, soft bass, clear lead", "fashion-commercial style, rock, rap, EDM, runway shouting", "colorful 3D clothing storybook, child-friendly garments and accessories, clean single-item presentation"),
    "body": ("gentle preschool body-learning pop, marimba, acoustic guitar, soft claps, bells, clear lead", "medical drama, graphic anatomy, rock, rap, EDM, scary hospital sounds", "friendly 3D body-learning storybook, non-graphic anatomy models and everyday wellness cues, clean shapes"),
    "feelings": ("soft upbeat preschool social-emotional pop, piano, ukulele, shaker, bells, warm clear lead", "sad cinematic drama, shouting, rock, rap, EDM, therapy jargon", "warm 3D feelings storybook, expressive friendly faces and simple social-emotional tools, uncluttered scenes"),
    "routine": ("cozy preschool routine-pop, acoustic guitar, marimba, woodblock, claps, clear lead", "alarm noise, household clutter sounds, rock, rap, EDM, fast instructions", "friendly 3D daily-routine storybook, simple home actions and objects, clean morning-evening scenes"),
    "fairy": ("whimsical preschool story-pop, harp, bells, pizzicato strings, soft hand drum, clear lead", "dark fantasy, battle music, scary monsters, rock, rap, EDM, cinematic peril", "bright 3D fairy-tale storybook, gentle castles magic and friendly creatures, safe whimsical scenes"),
    "science": ("curious preschool science-pop, marimba, pizzicato strings, soft synth plucks, bells, clear lead", "dangerous experiments, industrial noise, rock, rap, EDM, complex technical narration", "friendly 3D science-and-robots storybook, supervised lab displays and toy-like machines, clean educational layouts"),
    "seasons": ("bright preschool seasonal folk-pop, acoustic guitar, marimba, bells, shaker, clear lead", "holiday advertising, loud fireworks, rock, rap, EDM, crowded festival noise", "colorful 3D seasons storybook, weather and celebration objects in simple safe scenes, strong silhouettes"),
}

PROFILE_BLUEPRINTS_0151_0200: dict[str, tuple[str, str, str, str, str, str, int, str]] = {
    "0151": ("Town Picture Walk", "Around town—A-B-C!", "Street and place words walk with me!", "On our town walk, {letter} points out {object} along the way.", "Corner pause: {letter} ... {object}! Point and say.", "town-walk", 90, "town"),
    "0152": ("City Place Stop", "City places—A-B-C!", "Stop and spot a place with me!", "At city stop {letter}, we see {object} in the picture.", "Stop sign: {letter} ... {object}! Point to the city clue.", "city-stop", 88, "town"),
    "0153": ("Street Building Beat", "Streets and buildings—A-B-C!", "Look along the block with me!", "Down our picture street, {letter} shows {object} by the buildings.", "Block cue: {letter} ... {object}! Point when the answer rings.", "street-beat", 93, "town"),
    "0154": ("Neighborhood Hello ABC", "Neighborhood hello—A-B-C!", "Friendly places, come with me!", "Around the neighborhood, {letter} introduces {object} nearby.", "Hello {letter} ... {object}! Point when it catches your eye.", "neighbor-hello", 86, "town"),
    "0155": ("Town Map Explorer", "Town map—A-B-C!", "Follow every clue with me!", "Our town map gives {letter} the landmark {object} to find.", "Map clue: {letter} ... {object}! Point when the two align.", "town-map", 91, "town"),
    "0156": ("Helpers Around Us", "Community helpers—A-B-C!", "People helping you and me!", "For {letter}, our helper-world picture shows {object} at work.", "Helper cue: {letter} ... {object}! Point, no pretend tool work.", "helper-world", 89, "helpers"),
    "0157": ("Jobs Around Town Song", "Jobs around town—A-B-C!", "Name the people working with me!", "Around town, {letter} introduces {object} doing a community job.", "Job card: {letter} ... {object}! Point when the name pops.", "job-card", 92, "helpers"),
    "0158": ("People Who Help Parade", "People who help—A-B-C!", "Kind community, sing with me!", "In our helper parade, {letter} brings {object} into view.", "Parade pause: {letter} ... {object}! Point to the helper clue.", "help-parade", 94, "helpers"),
    "0159": ("Work Service Picture Book", "Work and service—A-B-C!", "Every helpful role we see!", "Our picture book pairs {letter} with {object} in a service scene.", "Book pause: {letter} ... {object}! Point when it is seen.", "service-book", 85, "helpers"),
    "0160": ("Helping Hands A-Z", "Helping hands—A-B-C!", "Kind jobs make a community!", "{letter} shows {object} as part of our helping-hands story.", "Hands still: {letter} ... {object}! Point and name it for me.", "helping-hands", 90, "helpers"),
    "0161": ("House Room Hop", "Around the house—A-B-C!", "Room to room, hop with me!", "In our house, {letter} finds {object} in a familiar room.", "Doorway cue: {letter} ... {object}! Point when the answer comes.", "house-hop", 91, "home"),
    "0162": ("Home Things Shelf", "Home things—A-B-C!", "Rooms and objects, look with me!", "On our home shelf, {letter} labels {object} for today.", "Shelf pause: {letter} ... {object}! Point and say.", "home-shelf", 86, "home"),
    "0163": ("Everyday Home ABC", "Everyday home—A-B-C!", "Familiar things for you and me!", "Everyday {letter} brings {object} into our home picture.", "Remember {letter} ... {object}! Point to the home clue.", "everyday-home", 89, "home"),
    "0164": ("Home Helper Objects", "Home helpers—A-B-C!", "Objects help around with me!", "For {letter}, {object} appears in our tidy home-helper scene.", "Tidy cue: {letter} ... {object}! Point when it is seen.", "home-helper", 88, "home"),
    "0165": ("Cozy House Letter Song", "Cozy house—A-B-C!", "Warm home words, sing with me!", "Inside our cozy house, {letter} shows {object} in view.", "Cozy pause: {letter} ... {object}! Point to the clue.", "cozy-house", 84, "home"),
    "0166": ("Closet Color ABC", "Clothes and colors—A-B-C!", "Dress-up pictures, look with me!", "In our closet, {letter} shows {object} ready to wear.", "Closet cue: {letter} ... {object}! Point to the pair.", "closet-color", 93, "clothes"),
    "0167": ("Getting Dressed Steps", "Getting dressed—A-B-C!", "Find the clothes step by step with me!", "At step {letter}, our picture gives {object} for getting dressed.", "Step pause: {letter} ... {object}! Point to your best guess.", "dress-step", 88, "clothes"),
    "0168": ("Shoes Hats Coats Clap", "Shoes, hats, coats—A-B-C!", "Clap for clothes we know and see!", "{letter} brings {object} to our shoes-hats-coats display.", "Clap-stop: {letter} ... {object}! Point and say.", "clothes-clap", 95, "clothes"),
    "0169": ("Wardrobe Window A-Z", "Wardrobe window—A-B-C!", "Open, look, and sing with me!", "Through our wardrobe window, {letter} reveals {object} today.", "Window pause: {letter} ... {object}! Point right away.", "wardrobe-window", 87, "clothes"),
    "0170": ("Weather Clothes Match", "Weather clothes—A-B-C!", "Dress for the day with me!", "For weather clue {letter}, our picture matches {object} to the day.", "Match cue: {letter} ... {object}! Point, then say.", "weather-clothes", 90, "clothes"),
    "0171": ("My Body Picture Song", "My body—A-B-C!", "Body picture words with me!", "On our friendly body chart, {letter} points to {object} to learn.", "Chart pause: {letter} ... {object}! Point when it's your turn.", "body-chart", 86, "body"),
    "0172": ("Body Senses ABC", "Body and senses—A-B-C!", "See and hear the words with me!", "For {letter}, our senses lesson shows {object} on a simple chart.", "Sense cue: {letter} ... {object}! Point to the part.", "sense-chart", 84, "body"),
    "0173": ("Healthy Body Look", "Healthy body—A-B-C!", "Learn the picture, move gently!", "Our wellness picture pairs {letter} with {object} to recognize.", "Gentle cue: {letter} ... {object}! Point with your eyes.", "wellness-look", 88, "body"),
    "0174": ("Doctor Body Picture Book", "Doctor picture—A-B-C!", "Body models, look with me!", "From a safe picture-book view, {letter} labels {object} for learning.", "Picture only: {letter} ... {object}! Point when you know the meaning.", "doctor-book", 82, "body"),
    "0175": ("Move Feel Body Beat", "Move and feel—A-B-C!", "Gentle body words with me!", "{letter} shows {object} in our move-and-feel body scene.", "Freeze softly: {letter} ... {object}! Point when it is seen.", "body-freeze", 92, "body"),
    "0176": ("Feelings Face Song", "Feelings faces—A-B-C!", "Name a feeling gently with me!", "On our feelings board, {letter} brings {object} into view.", "Face cue: {letter} ... {object}! Point to the clue.", "feelings-face", 85, "feelings"),
    "0177": ("Kindness Friend ABC", "Friendship kindness—A-B-C!", "Kind little choices, sing with me!", "For {letter}, our friendship story shows {object} as a kind clue.", "Kindness pause: {letter} ... {object}! Point to what you knew.", "kindness-story", 88, "feelings"),
    "0178": ("Calm Happy Breathing Song", "Calm and happy—A-B-C!", "Slow little breaths with me!", "{letter} places {object} on our calm-and-happy picture board.", "Quiet cue: {letter} ... {object}! Point when you know the word.", "calm-breathe", 78, "feelings"),
    "0179": ("Sharing Caring A-Z", "Sharing, caring—A-B-C!", "Kindness grows for you and me!", "In our sharing story, {letter} pairs with {object} today.", "Care cue: {letter} ... {object}! Point and say.", "sharing-care", 87, "feelings"),
    "0180": ("Feelings Toolbox ABC", "Feelings toolbox—A-B-C!", "Helpful picture tools with me!", "Our feelings toolbox gives {letter} the support picture {object}.", "Toolbox pause: {letter} ... {object}! Point, no need to rush.", "feelings-toolbox", 80, "feelings"),
    "0181": ("Daily Routine Steps", "Daily routine—A-B-C!", "Step through the day with me!", "During our day, {letter} shows {object} in the routine line.", "Next step: {letter} ... {object}! Point right on time.", "routine-step", 88, "routine"),
    "0182": ("Morning Evening Clock", "Morning, evening—A-B-C!", "Clock the routine words with me!", "At our picture clock, {letter} brings {object} into the day.", "Clock pause: {letter} ... {object}! Point and say.", "day-clock", 84, "routine"),
    "0183": ("Home Routine Round", "Home routine—A-B-C!", "Round the house, come with me!", "Around our routine wheel, {letter} points to {object} at home.", "Wheel stop: {letter} ... {object}! Point when it is shown.", "routine-wheel", 90, "routine"),
    "0184": ("Ready Clean ABC", "Ready and clean—A-B-C!", "Simple routine pictures with me!", "For {letter}, our getting-ready chart shows {object} today.", "Ready cue: {letter} ... {object}! Point and say.", "ready-clean", 92, "routine"),
    "0185": ("Family Day Picture Song", "Family day—A-B-C!", "Everyday home moments with me!", "On family day, {letter} finds {object} in our gentle routine scene.", "Family pause: {letter} ... {object}! Point when it is seen.", "family-day", 86, "routine"),
    "0186": ("Fairy Tale Letter Door", "Fairy-tale door—A-B-C!", "Open a story world with me!", "Behind story door {letter}, we discover {object} in our fairy tale.", "Magic pause: {letter} ... {object}! Point before the next page turns.", "fairy-door", 86, "fairy"),
    "0187": ("Castle Magic ABC", "Castle magic—A-B-C!", "Gentle magic, sing with me!", "Inside the bright castle, {letter} reveals {object} in our story.", "Castle cue: {letter} ... {object}! Point to the magic clue.", "castle-magic", 88, "fairy"),
    "0188": ("Dragon Knight Fairy Song", "Dragons, knights, fairies—A-B-C!", "Friendly story friends with me!", "In our gentle storybook, {letter} introduces {object} on the page.", "Story cue: {letter} ... {object}! Point, no battle play.", "story-friends", 90, "fairy"),
    "0189": ("Kingdom Picture Parade", "Storybook kingdom—A-B-C!", "Royal picture words with me!", "Through our kingdom parade, {letter} brings {object} into sight.", "Royal pause: {letter} ... {object}! Point when it feels right.", "kingdom-parade", 92, "fairy"),
    "0190": ("Magic Quest A-Z", "Magic quest—A-B-C!", "Find the friendly clues with me!", "Our gentle quest gives {letter} the clue {object} to discover.", "Quest pause: {letter} ... {object}! Point to the answer.", "magic-quest", 89, "fairy"),
    "0191": ("Robot Science Lab Look", "Science robots—A-B-C!", "Look at lab tools safely with me!", "From our supervised display, {letter} labels {object} in the science lab.", "Lab cue: {letter} ... {object}! Point only, that's our task.", "science-lab-look", 88, "science"),
    "0192": ("Machine Lab ABC", "Lab machines—A-B-C!", "Gadgets and tools, look with me!", "At our science display, {letter} shows {object} behind the safety line.", "Display pause: {letter} ... {object}! Point when the labels align.", "machine-lab", 90, "science"),
    "0193": ("Circuit Gadget Beat", "Circuits, gadgets—A-B-C!", "Picture-board science, sing with me!", "On our circuit board picture, {letter} identifies {object} for the lesson.", "Hands off: {letter} ... {object}! Point to your selection.", "circuit-beat", 93, "science"),
    "0194": ("Robot Builder Picture Book", "Robot builder—A-B-C!", "Parts and tools are pictures to see!", "Our robot-builder book pairs {letter} with {object} on the page.", "Book cue: {letter} ... {object}! Point, no tool play.", "robot-book", 87, "science"),
    "0195": ("Future Science A-Z", "Future science—A-B-C!", "Bright inventions, look with me!", "In our future-science gallery, {letter} brings {object} into view.", "Gallery pause: {letter} ... {object}! Point to the clue.", "future-gallery", 91, "science"),
    "0196": ("Season Wheel ABC", "Season wheel—A-B-C!", "Turn through the year with me!", "On our season wheel, {letter} shows {object} in its yearly scene.", "Wheel pause: {letter} ... {object}! Point when it is seen.", "season-wheel", 88, "seasons"),
    "0197": ("Weather Seasons Song", "Weather, seasons—A-B-C!", "Sun, rain, cold, warm with me!", "Across our weather calendar, {letter} brings {object} into the season.", "Calendar cue: {letter} ... {object}! Point to the season clue.", "weather-season", 90, "seasons"),
    "0198": ("Seasonal Things Parade", "Seasonal things—A-B-C!", "Yearly picture clues with me!", "{letter} carries {object} through our seasonal picture parade.", "Parade pause: {letter} ... {object}! Point when it is displayed.", "season-parade", 93, "seasons"),
    "0199": ("Year Round Letter Loop", "Year-round fun—A-B-C!", "Round the calendar with me!", "Around our year loop, {letter} finds {object} in a changing scene.", "Loop stop: {letter} ... {object}! Point when it is seen.", "year-loop", 86, "seasons"),
    "0200": ("Celebration Seasons A-Z", "Celebrate seasons—A-B-C!", "Gentle yearly joys with me!", "For {letter}, our celebration calendar shows {object} in season.", "Celebrate softly: {letter} ... {object}! Point to the picture clue.", "celebrate-season", 89, "seasons"),
}

for _sid, (_title, _hook_a, _hook_b, _round1, _round2, _motif, _bpm, _domain) in PROFILE_BLUEPRINTS_0151_0200.items():
    _style, _exclude, _visual = DOMAIN_PRESETS_0151_0200[_domain]
    PROFILES[_sid] = SongProfile(
        _sid,
        _title,
        f"{_style}, {_bpm} BPM, {_motif.replace('-', ' ')} participation groove",
        _exclude,
        _hook_a,
        _hook_b,
        _round1,
        _round2,
        f"{_visual}; visual identity: {_title}",
        _bpm,
        _motif,
        "one to two predictable beats of retrieval space before target confirmation",
    )


VISUAL_CONFUSABILITY_HIGH = set("BDPQ")
VISUAL_CONFUSABILITY_MED = set("CGOQSU")
PHONO_CONFUSABILITY_HIGH = set("BCDEGPTVZ")
SEQUENCE_RISK_HIGH = set("LMNOP")
SEQUENCE_RISK_MED = set("EFGHIJKQRSTUV")

# Project-canonical pronunciation metadata for recurring rare/compound targets in
# batch 0001-0010. Dictionary-backed where available; transparent compounds use
# ordinary English component stress. Scientific-name pronunciation is frozen
# project-locally so provider generations are compared against one target.
PRONUNCIATION_OVERRIDES: dict[str, tuple[int, str, str]] = {
    "Quahog": (2, "S-w", "Project canonical: KOH-hog; Merriam-Webster also records KWAH/KWO variants."),
    "Quillwort": (2, "S-w", "QUILL-wort; transparent English compound."),
    "Vallisneria": (5, "w-w-S-w-w", "val-ih-SNEER-ee-uh; stress on SNEER (Merriam-Webster)."),
    "Xiphophorus": (4, "w-S-w-w", "Project canonical: zai-FOH-for-us; keep four clear syllables."),
    "X-ray Tetra": (4, "S-S-S-w", "EX-RAY TET-ra; tetra has first-syllable stress."),
    "X-ray Fish": (3, "S-S-S", "EX-RAY FISH; three clearly separated stressed words/syllables."),
    "Violet Sea Snail": (5, "S-w-w-S-S", "VAI-uh-let SEA SNAIL; preserve ordinary compound stresses."),
    "Yellow Water Lily": (6, "S-w-S-w-S-w", "YEL-low WAT-er LIL-y; preserve three ordinary word stresses."),
    "X-ray Vet Image": (5, "S-S-S-S-w", "EX-RAY VET IM-age; transparent English compound."),
    "Uakari": (3, "w-S-w", "Project canonical: wah-KAR-ee; English references place primary stress on KAR."),
    "Emerald Tree Boa": (6, "S-w-w-S-S-w", "EM-er-ald TREE BO-a; preserve ordinary component stresses."),
    "Xenops": (2, "S-w", "ZEE-nops; English IPA /ˈzinɑps/."),
    "Xerus": (2, "S-w", "ZEER-us; Merriam-Webster gives primary stress on the first syllable."),
    "Xerophyte": (3, "S-w-S", "ZEER-uh-fyte; Merriam-Webster gives primary stress first with secondary stress on -phyte."),
    "Qajaq": (2, "w-S", "Project canonical follows Greenlandic qajaq [qə.jɑq]; keep two deliberate syllables."),
    "Yellow-billed Loon": (4, "S-w-S-S", "YEL-low-BILLED LOON; transparent English compound."),
    "Zoarcid Fish": (4, "w-S-w-S", "Project canonical: zoh-AR-sid FISH; derived consistently from Zoarces/Zoarcidae dictionary forms."),
    "Altocumulus": (5, "w-w-S-w-w", "al-toh-KYOO-myuh-lus; Merriam-Webster primary stress on KYOO."),
    "Anemometer": (5, "w-w-S-w-w", "an-uh-MOM-uh-ter; Merriam-Webster primary stress on MOM."),
    "Eye of Storm": (3, "S-w-S", "EYE of STORM; transparent English phrase."),
    "X-band Radar": (4, "S-S-S-w", "EX-BAND RAY-dar; preserve clear X and band before radar."),
    "Yellow Rain Boots": (4, "S-w-S-S", "YEL-low RAIN BOOTS; transparent English compound."),
    "International Space Station": (8, "w-w-S-w-w-S-S-w", "in-ter-NA-tion-al SPACE STA-tion; transparent English proper-name phrase."),
    "Krypton Tank": (3, "S-w-S", "KRYP-ton TANK; transparent English compound."),
    "X-ray Telescope": (5, "S-S-S-w-w", "EX-RAY TEL-uh-scope; transparent English compound."),
    "Zero-gravity Chair": (6, "S-w-S-w-w-S", "ZE-ro GRAV-i-ty CHAIR; transparent English compound."),
    "Kuiper Belt": (3, "S-w-S", "KY-per BELT; Merriam-Webster gives Kuiper as /KYE-per/."),
    "Quasar": (2, "S-w", "KWAY-zar; Merriam-Webster/Cambridge place primary stress on the first syllable."),
    "Qianzhousaurus": (4, "w-w-S-w", "Project canonical: chyen-joh-SAUR-us; English Wiktionary gives final -saurus primary stress for this taxon."),
    "Wuerhosaurus": (5, "w-S-w-S-w", "Project canonical: woo-EHR-ho-SAUR-us; Enchanted Learning gives woo-EHR-ho-SAWR-us."),
    "Xixiasaurus": (4, "S-w-S-w", "Project canonical: SHEE-shyah-SAUR-us; Xixia is from Mandarin Xixia plus -saurus."),
    "Zephyrosaurus": (5, "S-w-w-S-w", "Project canonical: ZEF-ih-roh-SAUR-us; derived from Zephyro- plus English -saurus."),
    "Net-winged Beetle": (4, "S-S-S-w", "NET-WINGED BEE-tle; transparent English compound."),
    "Umbrellabird": (4, "w-S-w-S", "um-BREL-la-BIRD; Dictionary.com gives umbrella bird as /um-BREL-uh-burd/."),
    "Nuthatch": (2, "S-w", "NUT-hatch; Merriam-Webster gives primary stress on NUT."),
    "Urutu Snake": (4, "w-w-S-S", "oo-roo-TOO SNAKE; urutu pronunciation based on Merriam-Webster, with snake stressed separately."),
    "Yellow-bellied Slider": (6, "S-w-S-w-S-w", "YEL-low-BEL-lied SLI-der; transparent English compound."),
    "Ornate Box Turtle": (5, "w-S-S-S-w", "or-NATE BOX TUR-tle; transparent English phrase."),
    "Red-eyed Tree Frog": (4, "S-S-S-S", "RED-EYED TREE FROG; transparent English compound."),
    "Uromastyx": (4, "S-w-S-w", "Project canonical: YUR-oh-MAS-tiks; keep the -mastix component crisp and four syllables total."),
    "Xenosaurus": (4, "S-w-S-w", "Project canonical: ZEE-no-SAUR-us; xeno- follows standard English ZEE/ZEH-no variants, frozen here as ZEE-no."),
    "Under-counter Drawer": (5, "S-w-S-w-S", "UN-der COUN-ter DRAWER; transparent English compound."),
    "X-shaped Cookie Cutter": (6, "S-S-S-w-S-w", "EX-SHAPED COOK-ie CUT-ter; transparent English compound."),
    "Quandong": (2, "S-w", "KWON-dong; Merriam-Webster gives primary stress on the first syllable."),
    "Ulluco": (3, "w-S-w", "oo-YOO-koh; Spanish pronunciation /u-YU-ko/ with middle-syllable stress."),
    "Xoconostle": (4, "w-w-S-w", "ho-ko-NOS-tleh; Spanish/Nahuatl-derived pronunciation with stress on NOS."),
    "Upside-down Cake": (4, "S-S-S-S", "UP-SIDE-DOWN CAKE; transparent English compound."),
    "X-shaped Pretzel": (4, "S-S-S-w", "EX-SHAPED PRET-zel; transparent English compound."),
    "Hot Cross Bun": (3, "S-S-S", "HOT CROSS BUN; transparent English compound."),
    "X-axis Graph": (4, "S-S-w-S", "EX AK-sis GRAPH; transparent math phrase."),
    "X-shaped Sticker": (4, "S-S-S-w", "EX-SHAPED STICK-er; transparent English compound."),
    "Yangqin": (2, "S-S", "Project canonical: YAHNG-cheen; two clear syllables from Mandarin yangqin, kept even for singing."),
    "Zills": (1, "S", "ZILZ; Merriam-Webster gives /zil/ for zills/finger cymbals."),
    "Xaphoon": (2, "w-S", "Project canonical: za-FOON; two clear syllables for the pocket reed instrument."),
    "Yidaki": (3, "w-S-w", "Project canonical: yee-DAH-kee; three separated syllables."),
    "Etch-a-Sketch": (3, "S-w-S", "ETCH-uh-SKETCH; preserve the familiar product-name phrase."),
    "X-shaped Puzzle": (4, "S-S-S-w", "EX-SHAPED PUZ-zle; transparent English compound."),
    "Yo-yo": (2, "S-w", "YO-yo; ordinary English pronunciation."),
    "Zipper Toy Bag": (4, "S-w-S-S", "ZIP-per TOY BAG; transparent English phrase."),
    "X-shaped Agility Marker": (8, "S-S-w-S-w-w-S-w", "EX-SHAPED uh-JIL-ih-tee MAR-ker; keep the compound in three clear chunks."),
    "Ice Cream Truck": (3, "S-S-S", "ICE CREAM TRUCK; transparent English compound."),
    "Off-road Car": (3, "S-S-S", "OFF-ROAD CAR; transparent English compound."),
    "X-ray Van": (3, "S-S-S", "EX-RAY VAN; transparent English compound."),
    "Zero-emission Bus": (6, "S-w-w-S-w-S", "ZE-ro e-MISH-un BUS; transparent English compound."),
    "High-speed Train": (3, "S-S-S", "HIGH-SPEED TRAIN; transparent English compound."),
    "X-crossing Sign": (4, "S-S-w-S", "EX CROSS-ing SIGN; preserve X as its letter name."),
    "X-wing Model": (4, "S-S-S-w", "EX-WING MOD-el; preserve X as its letter name."),
    "Yellow Taxiway Sign": (6, "S-w-S-w-w-S", "YEL-low TAX-i-way SIGN; transparent aviation phrase."),
    "Zero-gravity Plane": (6, "S-w-S-w-w-S", "ZE-ro GRAV-i-ty PLANE; transparent English compound."),
    "X-ray Scanner": (4, "S-S-S-w", "EX-RAY SCAN-ner; transparent English compound."),
    "X-ray Sonar Screen": (5, "S-S-S-w-S", "EX-RAY SO-nar SCREEN; transparent English compound."),
    "Quoin Brick": (2, "S-S", "KWOYN BRICK; Cambridge gives quoin /koin/, followed by stressed brick."),
    "I-beam": (2, "S-S", "EYE-BEAM; preserve I as its letter name."),
    "X-brace": (2, "S-S", "EX-BRACE; preserve X as its letter name."),
    "X-ray Clinic": (4, "S-S-S-w", "EX-RAY CLIN-ic; transparent English phrase."),
    "X-crossing": (3, "S-S-w", "EX CROSS-ing; preserve X as its letter name."),
    "X-ray Technician": (5, "S-S-w-S-w", "EX-RAY tek-NISH-un; preserve X-ray clearly before technician."),
    "Kindergarten Teacher": (6, "S-w-w-w-S-w", "KIN-der-gar-ten TEACH-er; transparent English phrase."),
    "X-shaped Shelf": (3, "S-S-S", "EX-SHAPED SHELF; transparent English compound."),
    "Flip-flops": (2, "S-S", "FLIP-FLOPS; ordinary English compound."),
    "T-shirt": (2, "S-S", "TEE-SHIRT; preserve T as its letter name."),
    "X-shaped Suspenders": (5, "S-S-w-S-w", "EX-SHAPED sus-PEN-ders; transparent English compound."),
    "Lace-up Shoes": (3, "S-S-S", "LACE-UP SHOES; transparent English compound."),
    "X-ray": (2, "S-S", "EX-RAY; preserve X as its letter name."),
    "Y-shaped Bone Model": (5, "S-S-S-S-w", "WHY-SHAPED BONE MOD-el; preserve Y as its letter name."),
    "Xiphoid Bone": (3, "S-w-S", "ZIF-oyd BONE; project canonical English medical pronunciation."),
    "Quadriceps": (3, "S-w-w", "KWOD-ri-seps; project canonical English pronunciation."),
    "Zygomatic Bone": (5, "w-w-S-w-S", "zai-go-MAT-ik BONE; project canonical English medical pronunciation."),
    "Note of Thanks": (3, "S-w-S", "NOTE of THANKS; transparent English phrase."),
    "Thank-you Card": (3, "S-w-S", "THANK-you CARD; transparent English phrase."),
    "Zigzag Breath Card": (4, "S-S-S-S", "ZIG-ZAG BREATH CARD; transparent English phrase."),
    "Xylophone Calm Toy": (5, "S-w-w-S-S", "ZY-lo-phone CALM TOY; preserve familiar xylophone stress."),
    "Warm Hug Card": (3, "S-S-S", "WARM HUG CARD; transparent English phrase."),
    "Yellow Feelings Chart": (5, "S-w-S-w-S", "YEL-low FEEL-ings CHART; transparent English phrase."),
    "Getting-dressed Chart": (4, "S-w-S-S", "GET-ting-DRESSED CHART; transparent English compound."),
    "X-shaped Timer": (4, "S-S-S-w", "EX-SHAPED TI-mer; transparent English compound."),
    "X-marked Treasure Map": (5, "S-S-S-w-S", "EX-MARKED TREAS-ure MAP; transparent English phrase."),
    "Oscilloscope": (4, "w-S-w-S", "uh-SILL-uh-scope; project canonical English technical pronunciation."),
    "Pipette": (2, "w-S", "pi-PET; project canonical English laboratory pronunciation."),
    "Ultrasonic Sensor": (6, "w-w-S-w-S-w", "ul-tra-SON-ic SEN-sor; transparent technical phrase."),
    "X-ray Image": (4, "S-S-S-w", "EX-RAY IM-age; transparent English technical phrase."),
    "Zero-gravity Robot": (7, "S-w-S-w-w-S-w", "ZE-ro GRAV-i-ty RO-bot; transparent English compound."),
    "Voltmeter": (3, "S-w-w", "VOLT-mee-ter; project canonical English technical pronunciation."),
    "X-axis Plotter": (5, "S-S-w-S-w", "EX AK-sis PLOT-ter; transparent technical phrase."),
    "Hydraulic Arm": (4, "w-S-w-S", "hy-DRAW-lic ARM; project canonical English technical pronunciation."),
    "Zener Diode": (4, "S-w-S-w", "ZEE-ner DYE-ode; project canonical electronics pronunciation."),
    "New Year Clock": (3, "S-S-S", "NEW YEAR CLOCK; transparent English phrase."),
    "Under-sun Hat": (4, "S-w-S-S", "UN-der-SUN HAT; transparent English compound."),
}


def simple_syllables(text: str) -> int:
    words = re.findall(r"[A-Za-z]+", text)
    if not words:
        return 1
    total = 0
    for word in words:
        w = word.lower()
        if len(w) <= 3:
            total += 1
            continue
        groups = re.findall(r"[aeiouy]+", w)
        count = len(groups)
        if w.endswith("e") and not w.endswith(("le", "ye")) and count > 1:
            count -= 1
        total += max(1, count)
    return min(total, 12)


def stress_pattern(obj: str, risk_flags: list[str]) -> tuple[int, str, str | None, list[str]]:
    flags = list(risk_flags)
    override = PRONUNCIATION_OVERRIDES.get(obj)
    if override is not None:
        syllables, pattern, note = override
        flags = [flag for flag in flags if flag != "verify-pronunciation"]
        return syllables, pattern, note, flags
    syllables = simple_syllables(obj)
    if "verify-pronunciation" in flags:
        if "VERIFY" not in flags:
            flags.append("VERIFY")
        return syllables, "VERIFY", "Verify dictionary pronunciation and lexical stress before final generation approval.", flags
    if syllables == 1:
        return syllables, "S", None, flags
    # Conservative metadata: use a neutral first-stress working pattern and mark
    # it as a pre-generation prosody review item rather than claiming research-level certainty.
    pattern = "S-" + "-".join("w" for _ in range(syllables - 1))
    flags.append("prosody-review")
    return syllables, pattern, "Working stress pattern; confirm naturally during L0 read-aloud and L1 audio review.", flags


def letter_sound_cue(letter: str) -> str:
    if letter in "AEIKOU":
        return "strong-initial"
    if letter in "FLMNSXR":
        return "embedded-final"
    if letter in "CQWY":
        return "weak-or-misleading"
    return "strong-initial"


def visual_conf(letter: str) -> str:
    if letter in VISUAL_CONFUSABILITY_HIGH:
        return "high"
    if letter in VISUAL_CONFUSABILITY_MED:
        return "medium"
    return "low"


def phono_conf(letter: str) -> str:
    if letter in PHONO_CONFUSABILITY_HIGH:
        return "high"
    if letter in "AIJKOQUWXY":
        return "medium"
    return "low"


def sequence_risk(letter: str) -> str:
    if letter in SEQUENCE_RISK_HIGH:
        return "high"
    if letter in SEQUENCE_RISK_MED:
        return "medium"
    return "low"


def action_for(object_name: str, risk_flags: list[str], song_id: str | None = None) -> str:
    lower = object_name.lower()
    if "safety-context-only" in risk_flags:
        return "Point to the picture only."
    craft = OBJECT_CRAFT.get(object_name)
    if craft:
        return craft[1]
    if song_id:
        extended = object_craft_v4_11_50(song_id, object_name)
        if extended:
            return extended[1]
    if any(k in lower for k in ("fish", "whale", "dolphin", "eel", "ray", "shark", "trout", "minnow", "pike", "tadpole")):
        return "make a gentle swimming motion"
    if any(k in lower for k in ("bird", "gull", "pelican", "heron", "egret", "swan", "kingfisher", "quail")):
        return "flap two gentle wings"
    if any(k in lower for k in ("boat", "canoe", "kayak", "vessel", "oar")):
        return "pretend to row slowly"
    if any(k in lower for k in ("frog", "salamander", "newt")):
        return "make one small hop"
    if any(k in lower for k in ("wave", "waterfall", "river", "lake", "pond", "lagoon", "estuary")):
        return "wave both hands like water"
    if any(k in lower for k in ("plant", "kelp", "algae", "reed", "iris", "lily", "quillwort", "vallisneria")):
        return "grow hands upward like a plant"
    return "Point to the matching picture."


def rhyme_family(profile: SongProfile, letter: str) -> str:
    families = ("see-me", "say-way", "blue-you", "trail-tell", "go-show", "bright-right", "near-clear")
    return families[(ord(letter) - ord("A") + int(profile.song_id)) % len(families)]


def build_learning_blocks(mapping: dict[str, Any], profile: SongProfile) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    for letter in LETTERS:
        entry = mapping["letters"][letter]
        obj = str(entry["object"])
        risks = list(entry.get("riskFlags", []))
        syllables, stress, note, risks = stress_pattern(obj, risks)
        block = {
            "letter": letter,
            "word": obj,
            "mode": "letter-name",
            "familiarity_tier": entry.get("familiarityTier", "A"),
            "letter_name_sound_cue": letter_sound_cue(letter),
            "visual_confusability": visual_conf(letter),
            "phonological_name_confusability": phono_conf(letter),
            "sequence_dependency_risk": sequence_risk(letter),
            "syllable_count": syllables,
            "stress_pattern": stress,
            "pronunciation_note": note,
            "prosodic_motif_variant": f"{profile.motif}-{min(syllables, 4)}syll",
            "round1_objective": "lexical-semantic",
            "round2_objective": "retrieval-action",
            "retrieval_cue": letter,
            "retrieval_gap_plan": profile.response,
            "congruent_action": action_for(obj, risks, profile.song_id),
            "rhyme_family": rhyme_family(profile, letter),
            "visual_reveal_rule": "round1=line-start; round2=target-word",
            "contrast_notes": "Isolate the capital letter before showing confusable competitors." if visual_conf(letter) != "low" else None,
            "risk_flags": sorted(set(risks)),
        }
        blocks.append(block)
    return blocks


def section_manifest(profile: SongProfile) -> list[dict[str, Any]]:
    spec = creative_spec(profile)
    intro_count = len(spec.intro_lines) if spec and spec.intro_lines else 2
    chorus_count = len(spec.hook_lines) if spec and spec.hook_lines else 2
    outro_count = len(spec.outro_lines) if spec and spec.outro_lines else 2
    interlude_count = len(spec.interlude_lines) if spec and spec.interlude_lines else 0
    learning_rhyme_engine = spec.rhyme_engine if spec else "refrain-driven"
    sections: list[dict[str, Any]] = [
        {
            "section_id": "intro",
            "section_type": "intro",
            "round": None,
            "learning_objective": "transition",
            "letters": [],
            "line_count": intro_count,
            "rhyme_scheme": "refrain-driven",
            "motif_id": f"{profile.motif}-intro",
            "energy_level": "medium",
            "response_frame": None,
            "refrain_or_chorus_identity": None,
            "tempo_bpm": profile.bpm,
            "density_override_evidence": None,
            "notes": "Introduce theme and participation grammar without adding a second curriculum target.",
        }
    ]
    for round_no, objective, suffix in ((1, "lexical-semantic", "teach"), (2, "retrieval-action", "retrieve")):
        for idx, chunk in enumerate(CHUNKS, start=1):
            section_id = f"r{round_no}-{chunk[0].lower()}-{chunk[-1].lower()}"
            sections.append({
                "section_id": section_id,
                "section_type": "verse",
                "round": round_no,
                "learning_objective": objective,
                "letters": list(chunk),
                "line_count": len(chunk),
                "rhyme_scheme": learning_rhyme_engine,
                "motif_id": f"{profile.motif}-{suffix}",
                "energy_level": "medium" if round_no == 1 else "medium-high",
                "response_frame": None if round_no == 1 else profile.response,
                "refrain_or_chorus_identity": None,
                "tempo_bpm": profile.bpm,
                "density_override_evidence": None,
                "notes": (("Controlled syntax/line-length variation occurs inside the shared motif family; meaning-first semantic snapshots intentionally avoid forced verse rhyme, with rhyme concentrated in the hook." if spec and spec.rhyme_engine == "intentionally-unrhymed" else "Controlled syntax/line-length variation may occur inside the shared motif family; target word remains clear and early.") if spec else "Target word remains clear and early.") if round_no == 1 else "Letter cue precedes target; object reveal waits for target-word onset.",
            })
            chorus_points = (spec.chorus_after_round1 if round_no == 1 else spec.chorus_after_round2) if spec else (2, 4, 6)
            if idx in chorus_points:
                sections.append({
                    "section_id": f"chorus-r{round_no}-{idx}",
                    "section_type": "chorus",
                    "round": round_no,
                    "learning_objective": "verbatim-sequence",
                    "letters": [],
                    "line_count": chorus_count,
                    "rhyme_scheme": spec.chorus_rhyme_engine if spec else "paired",
                    "motif_id": f"{profile.motif}-hook",
                    "energy_level": "high",
                    "response_frame": None,
                    "refrain_or_chorus_identity": f"hook-{profile.song_id}",
                    "tempo_bpm": profile.bpm,
                    "density_override_evidence": None,
                    "notes": "Exact hook text repeats to strengthen song identity.",
                })
        if round_no == 1 and interlude_count:
            sections.append({
                "section_id": "mid-interlude",
                "section_type": "interlude",
                "round": None,
                "learning_objective": "transition",
                "letters": [],
                "line_count": interlude_count,
                "rhyme_scheme": "refrain-driven",
                "motif_id": f"{profile.motif}-interlude",
                "energy_level": "medium-low",
                "response_frame": None,
                "refrain_or_chorus_identity": None,
                "tempo_bpm": profile.bpm,
                "density_override_evidence": None,
                "notes": "Optional song-specific reset between teaching and retrieval rounds.",
            })
    sections.append({
        "section_id": "outro",
        "section_type": "outro",
        "round": None,
        "learning_objective": "transition",
        "letters": [],
        "line_count": outro_count,
        "rhyme_scheme": "refrain-driven",
        "motif_id": f"{profile.motif}-outro",
        "energy_level": "medium-low",
        "response_frame": None,
        "refrain_or_chorus_identity": f"hook-{profile.song_id}",
        "tempo_bpm": profile.bpm,
        "density_override_evidence": None,
        "notes": "Short positive closure.",
    })
    return sections


def creative_spec(profile: SongProfile) -> CreativeSpec | None:
    explicit = CREATIVE_SPECS.get(profile.song_id)
    if explicit is not None:
        return explicit
    payload = spec_payload_v4_11_50(
        profile.song_id,
        profile.style,
        profile.hook_a,
        profile.hook_b,
        profile.bpm,
        profile.motif,
    )
    if payload is not None and profile.song_id in GOLD_V5_11_15_SPEC_PATCHES:
        payload = {**payload, **GOLD_V5_11_15_SPEC_PATCHES[profile.song_id]}
    if payload is not None and profile.song_id in GOLD_V5_16_20_SPEC_PATCHES:
        payload = {**payload, **GOLD_V5_16_20_SPEC_PATCHES[profile.song_id]}
    if payload is not None and profile.song_id in GOLD_V5_21_25_SPEC_PATCHES:
        payload = {**payload, **GOLD_V5_21_25_SPEC_PATCHES[profile.song_id]}
    if payload is not None and profile.song_id in GOLD_V5_26_30_SPEC_PATCHES:
        payload = {**payload, **GOLD_V5_26_30_SPEC_PATCHES[profile.song_id]}
    if payload is not None and profile.song_id in GOLD_V5_31_35_SPEC_PATCHES:
        payload = {**payload, **GOLD_V5_31_35_SPEC_PATCHES[profile.song_id]}
    if payload is not None and profile.song_id in GOLD_V5_36_40_SPEC_PATCHES:
        payload = {**payload, **GOLD_V5_36_40_SPEC_PATCHES[profile.song_id]}
    if payload is not None and profile.song_id in GOLD_V5_41_45_SPEC_PATCHES:
        payload = {**payload, **GOLD_V5_41_45_SPEC_PATCHES[profile.song_id]}
    if payload is not None and profile.song_id in GOLD_V5_46_50_SPEC_PATCHES:
        payload = {**payload, **GOLD_V5_46_50_SPEC_PATCHES[profile.song_id]}
    if payload is None:
        payload = spec_payload_v4_51_100(
            profile.song_id,
            profile.style,
            profile.hook_a,
            profile.hook_b,
            profile.bpm,
            profile.motif,
        )
    if payload is not None and profile.song_id in GOLD_V5_51_55_SPEC_PATCHES:
        payload = {**payload, **GOLD_V5_51_55_SPEC_PATCHES[profile.song_id]}
    if payload is not None and profile.song_id in GOLD_V5_56_60_SPEC_PATCHES:
        payload = {**payload, **GOLD_V5_56_60_SPEC_PATCHES[profile.song_id]}
    if payload is not None and profile.song_id in GOLD_V5_61_65_SPEC_PATCHES:
        payload = {**payload, **GOLD_V5_61_65_SPEC_PATCHES[profile.song_id]}
    if payload is not None and profile.song_id in GOLD_V5_66_70_SPEC_PATCHES:
        payload = {**payload, **GOLD_V5_66_70_SPEC_PATCHES[profile.song_id]}
    if payload is not None and profile.song_id in GOLD_V5_71_75_SPEC_PATCHES:
        payload = {**payload, **GOLD_V5_71_75_SPEC_PATCHES[profile.song_id]}
    if payload is not None and profile.song_id in GOLD_V5_76_80_SPEC_PATCHES:
        payload = {**payload, **GOLD_V5_76_80_SPEC_PATCHES[profile.song_id]}
    if payload is not None and profile.song_id in GOLD_V5_81_85_SPEC_PATCHES:
        payload = {**payload, **GOLD_V5_81_85_SPEC_PATCHES[profile.song_id]}
    if payload is not None and profile.song_id in GOLD_V5_86_90_SPEC_PATCHES:
        payload = {**payload, **GOLD_V5_86_90_SPEC_PATCHES[profile.song_id]}
    if payload is not None and profile.song_id in GOLD_V5_91_95_SPEC_PATCHES:
        payload = {**payload, **GOLD_V5_91_95_SPEC_PATCHES[profile.song_id]}
    if payload is not None and profile.song_id in GOLD_V5_96_100_SPEC_PATCHES:
        payload = {**payload, **GOLD_V5_96_100_SPEC_PATCHES[profile.song_id]}
    if profile.song_id in GOLD_V5_101_105_SPEC_PATCHES:
        payload = {**(payload or {}), **GOLD_V5_101_105_SPEC_PATCHES[profile.song_id]}
    if profile.song_id in GOLD_V5_106_110_SPEC_PATCHES:
        payload = {**(payload or {}), **GOLD_V5_106_110_SPEC_PATCHES[profile.song_id]}
    if profile.song_id in GOLD_V5_111_115_SPEC_PATCHES:
        payload = {**(payload or {}), **GOLD_V5_111_115_SPEC_PATCHES[profile.song_id]}
    if profile.song_id in GOLD_V5_116_120_SPEC_PATCHES:
        payload = {**(payload or {}), **GOLD_V5_116_120_SPEC_PATCHES[profile.song_id]}
    if profile.song_id in GOLD_V5_121_125_SPEC_PATCHES:
        payload = {**(payload or {}), **GOLD_V5_121_125_SPEC_PATCHES[profile.song_id]}
    if profile.song_id in GOLD_V5_126_130_SPEC_PATCHES:
        payload = {**(payload or {}), **GOLD_V5_126_130_SPEC_PATCHES[profile.song_id]}
    if profile.song_id in GOLD_V5_131_135_SPEC_PATCHES:
        payload = {**(payload or {}), **GOLD_V5_131_135_SPEC_PATCHES[profile.song_id]}
    if profile.song_id in GOLD_V5_136_140_SPEC_PATCHES:
        payload = {**(payload or {}), **GOLD_V5_136_140_SPEC_PATCHES[profile.song_id]}
    if profile.song_id in GOLD_V5_141_145_SPEC_PATCHES:
        payload = {**(payload or {}), **GOLD_V5_141_145_SPEC_PATCHES[profile.song_id]}
    if profile.song_id in GOLD_V5_146_150_SPEC_PATCHES:
        payload = {**(payload or {}), **GOLD_V5_146_150_SPEC_PATCHES[profile.song_id]}
    if profile.song_id in GOLD_V5_151_155_SPEC_PATCHES:
        payload = {**(payload or {}), **GOLD_V5_151_155_SPEC_PATCHES[profile.song_id]}
    return CreativeSpec(**payload) if payload is not None else None


def creative_fingerprint(profile: SongProfile) -> dict[str, Any]:
    spec = creative_spec(profile)
    if spec is None:
        return {
            "mode": "legacy-single-frame",
            "designStatus": "REWORK_LEGACY_TEMPLATE",
            "openingType": "generic-theme-invitation",
            "targetEntryFamilies": ["single-fixed-frame"],
            "lineLengthContour": ["uniform"],
            "rhymeEngine": "refrain-driven",
            "pointOfView": "generic-guide",
            "chorusFunction": "two-line-reset",
            "grooveMeter": "profile-defined-4-4-like",
            "round1Grammar": profile.round1_frame,
            "round2Grammar": profile.round2_frame,
            "sectionContrast": "minimal",
            "signatureColor": profile.motif,
        }
    return {
        "mode": "controlled-variation",
        "designStatus": "CURATED_CREATIVE_SPEC",
        "openingType": spec.opening_type,
        "targetEntryFamilies": list(spec.target_entry_families),
        "lineLengthContour": list(spec.line_length_contour),
        "rhymeEngine": spec.rhyme_engine,
        "chorusRhymeEngine": spec.chorus_rhyme_engine,
        "pointOfView": spec.point_of_view,
        "chorusFunction": spec.chorus_function,
        "grooveMeter": spec.groove_meter,
        "round1Grammar": spec.round1_grammar,
        "round2Grammar": spec.round2_grammar,
        "sectionContrast": spec.section_contrast,
        "signatureColor": spec.signature_color,
        "authorialIntent": spec.authorial_intent,
        "lyricIdentity": spec.lyric_identity,
        "imageMotifs": list(spec.image_motifs),
        "semanticArc": list(spec.semantic_arc),
        "forbiddenGenericLanguage": list(spec.forbidden_generic_language),
        "chorusAfterRound1": list(spec.chorus_after_round1),
        "chorusAfterRound2": list(spec.chorus_after_round2),
        "hasMidInterlude": bool(spec.interlude_lines),
        "objectCraftRequired": spec.object_craft_required,
    }


def intro_lines(profile: SongProfile, theme: str) -> list[str]:
    spec = creative_spec(profile)
    if spec and spec.intro_lines:
        return list(spec.intro_lines)
    spoken_theme = theme.replace("&", "and").lower()
    if spoken_theme.endswith(" explorer"):
        place = spoken_theme.removesuffix(" explorer").strip()
        return [f"Let's explore {place} together!", profile.hook_a]
    return [f"Come explore {spoken_theme} with me!", profile.hook_a]


def _override_map(items: tuple[tuple[str, str], ...]) -> dict[str, str]:
    return dict(items)


def hook_lines(profile: SongProfile) -> list[str]:
    spec = creative_spec(profile)
    if spec and spec.hook_lines:
        return list(spec.hook_lines)
    return [profile.hook_a, profile.hook_b]


def semantic_followup(obj: str, sentence: str) -> str:
    subject_patterns = (
        rf"^(?:a|an|the)\s+{re.escape(obj)}\s+",
        rf"^{re.escape(obj)}\s+",
    )
    for pattern in subject_patterns:
        match = re.match(pattern, sentence, flags=re.IGNORECASE)
        if match:
            remainder = sentence[match.end():].strip()
            if remainder:
                first = re.match(r"^[A-Za-z'-]+", remainder)
                # Only collapse to a pronoun when the remainder already starts
                # with a singular-predicate shape. Preserve the full sentence
                # for noun compounds ("eggplant plant grows") and plural
                # predicates ("Reindeer are", "Boots cover") so the renderer
                # never invents ungrammatical "It plant..." / "It are..." lines.
                singular_starts = {
                    "is", "has", "uses", "moves", "grows", "forms", "carries", "stores",
                    "opens", "keeps", "covers", "holds", "unfurls", "climbs", "bends",
                    "drifts", "swims", "glides", "walks", "eats", "produces", "builds",
                    "makes", "turns", "shows", "helps", "protects", "reaches", "sticks",
                    "floats", "paddles", "hops", "lives", "travels", "rises", "falls",
                    "runs", "stands", "sits", "wears", "looks", "contains", "measures",
                }
                if first and first.group(0).casefold() in singular_starts:
                    return "It " + remainder[0].lower() + remainder[1:]
                return sentence
    return sentence


def curated_object_craft(profile: SongProfile, obj: str) -> tuple[str, str] | None:
    number = int(profile.song_id)
    # Later creative modules own their ranges. This prevents a common word such
    # as Egg, Nest, Duck or Apple from inheriting a fact/action written for an
    # earlier, unrelated theme merely because the spelling matches.
    if 51 <= number <= 100:
        return object_craft_v4_51_100(profile.song_id, obj)
    if 101 <= number <= 200:
        return OBJECT_CRAFT_REGISTRY.get((profile.song_id, obj))
    craft = OBJECT_CRAFT.get(obj)
    if craft is None:
        craft = object_craft_v4_11_50(profile.song_id, obj)
    return craft


def curated_rhyme_phraselet(profile: SongProfile, obj: str, ordinal: int) -> str | None:
    number = int(profile.song_id)
    if 51 <= number <= 100:
        return rhyme_phraselet_v4_51_100(profile.song_id, obj, ordinal)
    phraselet = RHYME_PHRASELETS.get(obj)
    if phraselet is None:
        phraselet = rhyme_phraselet_v4_11_50(profile.song_id, obj, ordinal)
    return phraselet


def object_craft_for(profile: SongProfile, obj: str) -> tuple[str, str]:
    craft = curated_object_craft(profile, obj)
    spec = creative_spec(profile)
    if craft is None and spec and spec.object_craft_required:
        raise RuntimeError(f"{profile.song_id}: missing Object Craft Lexicon entry for {obj!r}")
    if craft is None:
        return (f"{obj} belongs in this theme.", "Point to the matching picture.")
    return craft


def render_target_line(profile: SongProfile, round_no: int, letter: str, obj: str) -> str:
    spec = creative_spec(profile)
    if spec is None:
        frame = profile.round1_frame if round_no == 1 else profile.round2_frame
        return frame.format(letter=letter, object=obj)

    semantic_full, action = object_craft_for(profile, obj)
    semantic_follow = semantic_followup(obj, semantic_full)
    patterns = spec.round1_patterns if round_no == 1 else spec.round2_patterns
    ordinal = LETTERS.index(letter)
    pattern_index = ordinal % len(patterns) if patterns else 0
    semantic = semantic_follow if round_no == 2 or pattern_index % 2 == 0 else semantic_full
    if round_no == 1 and ordinal % 2 == 0:
        rhyme_phraselet = curated_rhyme_phraselet(profile, obj, ordinal)
        if rhyme_phraselet:
            semantic = rhyme_phraselet
    render_values = {
        "letter": letter,
        "object": obj,
        "semantic": semantic,
        "action": action,
    }
    overrides = _override_map(spec.round1_overrides if round_no == 1 else spec.round2_overrides)
    if letter in overrides:
        return overrides[letter].format(**render_values)

    if not patterns:
        raise RuntimeError(f"{profile.song_id}: CreativeSpec round {round_no} has no patterns or override for {letter}")
    return patterns[pattern_index].format(**render_values)


def outro_lines(profile: SongProfile) -> list[str]:
    spec = creative_spec(profile)
    if spec and spec.outro_lines:
        return list(spec.outro_lines)
    return [profile.hook_a, "Great pointing, great saying—A to Z!"]


def build_script(mapping: dict[str, Any], profile: SongProfile) -> tuple[dict[str, Any], list[tuple[str, list[str]]]]:
    lines: list[dict[str, Any]] = []
    ordered_sections: list[tuple[str, list[str]]] = []

    intro = intro_lines(profile, mapping["theme"]["name"])
    ordered_sections.append(("Intro", intro))
    for n, text in enumerate(intro, start=1):
        lines.append({"id": f"intro-{n}", "sectionId": "intro", "text": text, "objective": "narration", "objectReveal": "none"})

    spec = creative_spec(profile)
    for round_no in (1, 2):
        for idx, chunk in enumerate(CHUNKS, start=1):
            section_id = f"r{round_no}-{chunk[0].lower()}-{chunk[-1].lower()}"
            rendered: list[str] = []
            for letter in chunk:
                obj = mapping["letters"][letter]["object"]
                text = render_target_line(profile, round_no, letter, obj)
                rendered.append(text)
                lines.append({
                    "id": f"r{round_no}-{letter}",
                    "sectionId": section_id,
                    "text": text,
                    "targetId": letter,
                    "objective": "lexical-semantic" if round_no == 1 else "retrieval-action",
                    "objectReveal": "line-start" if round_no == 1 else "target-word",
                })
            ordered_sections.append((f"{'Verse' if round_no == 1 else 'Call and Response'} {idx}", rendered))
            chorus_points = (spec.chorus_after_round1 if round_no == 1 else spec.chorus_after_round2) if spec else (2, 4, 6)
            if idx in chorus_points:
                chorus = hook_lines(profile)
                ordered_sections.append(("Chorus", chorus))
                for cidx, text in enumerate(chorus, start=1):
                    lines.append({
                        "id": f"chorus-r{round_no}-{idx}-{cidx}",
                        "sectionId": f"chorus-r{round_no}-{idx}",
                        "text": text,
                        "objective": "verbatim",
                        "objectReveal": "none",
                    })
        if round_no == 1 and spec and spec.interlude_lines:
            interlude = list(spec.interlude_lines)
            ordered_sections.append(("Interlude", interlude))
            for n, text in enumerate(interlude, start=1):
                lines.append({
                    "id": f"interlude-{n}",
                    "sectionId": "mid-interlude",
                    "text": text,
                    "objective": "narration",
                    "objectReveal": "none",
                })

    outro = outro_lines(profile)
    ordered_sections.append(("Outro", outro))
    for n, text in enumerate(outro, start=1):
        lines.append({"id": f"outro-{n}", "sectionId": "outro", "text": text, "objective": "narration", "objectReveal": "none"})

    return {"version": 1, "mappingRevision": mapping["revision"], "lines": lines}, ordered_sections


def lyrics_text(ordered_sections: list[tuple[str, list[str]]]) -> str:
    out: list[str] = []
    verse_count = 0
    response_count = 0
    chorus_count = 0
    for label, lines in ordered_sections:
        if label.startswith("Verse"):
            verse_count += 1
            tag = f"[Verse {verse_count}]"
        elif label.startswith("Call and Response"):
            response_count += 1
            tag = f"[Call and Response {response_count}]"
        elif label == "Chorus":
            chorus_count += 1
            tag = "[Chorus]"
        else:
            tag = f"[{label}]"
        out.append(tag)
        out.extend(lines)
        out.append("")
    return "\n".join(out).rstrip() + "\n"


def object_prompt_pack(mapping: dict[str, Any], profile: SongProfile) -> dict[str, Any]:
    items: dict[str, Any] = {}
    for letter in LETTERS:
        obj = mapping["letters"][letter]["object"]
        items[letter] = {
            "object": obj,
            "prompt": (
                f"Preschool source-composite extraction image for letter {letter} and {obj}. "
                f"{profile.visual_style}. Show one large stylized uppercase {letter} on the left and exactly one clear {obj} on the right, "
                "both fully visible, separated with generous safe margin, no overlap, no extra letters, no words, no duplicate objects, "
                "simple temporary background with strong foreground contrast, centered composition, clean contours suitable for segmentation into transparent letter and object PNGs."
            ),
            "negativePrompt": "extra text, lowercase letters, duplicate objects, cropped edges, overlap, clutter, scary expression, watermark, logo, photorealistic danger, busy background",
        }
    return {
        "version": 1,
        "mappingRevision": mapping["revision"],
        "theme": mapping["theme"]["name"],
        "globalStyle": profile.visual_style,
        "semantic": "source-composite-extraction-pack",
        "letters": items,
    }


def validate_mapping(mapping: dict[str, Any], sid: str) -> None:
    if mapping.get("state") != "LOCKED" or mapping.get("revision", 0) < 1:
        raise RuntimeError(f"{sid}: mapping is not LOCKED")
    if set(mapping.get("letters", {})) != set(LETTERS):
        raise RuntimeError(f"{sid}: mapping is not complete A-Z")


def write_song(sid: str) -> None:
    profile = PROFILES.get(sid)
    if profile is None:
        raise RuntimeError(f"No curated SongProfile for {sid}; add a profile before generating this batch")
    authoring = CATALOG / sid / "authoring"
    mapping_path = authoring / "mapping.json"
    if not mapping_path.is_file():
        raise RuntimeError(f"{sid}: missing locked authoring/mapping.json")
    mapping = json.loads(mapping_path.read_text(encoding="utf-8"))
    validate_mapping(mapping, sid)

    script, ordered_sections = build_script(mapping, profile)
    blocks = build_learning_blocks(mapping, profile)
    sections = section_manifest(profile)
    lyrics = lyrics_text(ordered_sections)

    authoring.mkdir(parents=True, exist_ok=True)
    (authoring / "song-script.json").write_text(json.dumps(script, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (authoring / "generation-lyrics.txt").write_text(lyrics, encoding="utf-8")
    (authoring / "display-lyrics.txt").write_text(lyrics, encoding="utf-8")
    spec = creative_spec(profile)
    style_prompt = spec.style_blueprint if spec and spec.style_blueprint else profile.style
    if spec and spec.rhyme_engine == "mixed-internal-phraselet":
        style_prompt += " Round 1 must make the written rhyme audible: honor the bar/phrase break at |, let each internal or phraselet rhyme land clearly with a tiny pocket of space, and do not smear the target word into the rhyme."
    (authoring / "style-prompt.txt").write_text(style_prompt + "\n", encoding="utf-8")
    (authoring / "exclude-styles.txt").write_text(profile.exclude + "\n", encoding="utf-8")
    (authoring / "object-prompts.json").write_text(json.dumps(object_prompt_pack(mapping, profile), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (authoring / "learning-blocks.json").write_text(json.dumps(blocks, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (authoring / "sections.json").write_text(json.dumps(sections, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    plan = {
        "songId": sid,
        "title": profile.title,
        "theme": mapping["theme"]["name"],
        "mappingRevision": mapping["revision"],
        "tempoBpm": profile.bpm,
        "motifFamily": profile.motif,
        "hook": hook_lines(profile),
        "roundStructure": "Round 1 lexical-semantic A-Z; Round 2 retrieval-action A-Z; 4+4+4+4+4+4+2 chunks",
        "responseSpace": profile.response,
        "visualStyle": profile.visual_style,
        "creativeFingerprint": creative_fingerprint(profile),
        "objectCraftCoverage": {
            "covered": sum(1 for letter in LETTERS if curated_object_craft(profile, mapping["letters"][letter]["object"]) is not None),
            "total": 26,
        },
        "rhymeCraftCoverage": {
            "available": sum(1 for index, letter in enumerate(LETTERS) if curated_rhyme_phraselet(profile, mapping["letters"][letter]["object"], index) is not None),
            "usedRound1": sum(1 for index, letter in enumerate(LETTERS) if index % 2 == 0 and curated_rhyme_phraselet(profile, mapping["letters"][letter]["object"], index) is not None),
            "total": 26,
        },
        "status": "READY_FOR_L0_VALIDATION" if creative_spec(profile) else "REWORK_LEGACY_TEMPLATE",
    }
    (authoring / "song-plan.json").write_text(json.dumps(plan, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate curated ABC authoring files for a 10-song batch.")
    parser.add_argument("--start", type=int, default=1)
    parser.add_argument("--end", type=int, default=10)
    args = parser.parse_args()
    if args.end < args.start or args.end - args.start + 1 > 10:
        raise SystemExit("Generate at most 10 songs per batch")
    ids = [f"{i:04d}" for i in range(args.start, args.end + 1)]
    for sid in ids:
        write_song(sid)
    print(f"Generated authoring package for {ids[0]}-{ids[-1]} ({len(ids)} songs)")


if __name__ == "__main__":
    main()
