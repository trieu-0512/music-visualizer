from __future__ import annotations

"""Creative V4 helpers for songs 0011-0050.

The goal is not to make every line maximally different. It is to keep the
educational target stable while giving each song an authored point of view,
opening, form, performance behavior, and object-conditioned semantic/action
language. Soft rhyme is used when it improves the song; it is never a quota.
"""

from typing import Any


DOMAIN_BY_RANGE = (
    (11, 15, "farm"),
    (16, 20, "garden"),
    (21, 25, "forest"),
    (26, 30, "rainforest"),
    (31, 35, "desert"),
    (36, 40, "polar"),
    (41, 45, "mountain"),
    (46, 50, "weather"),
)


def domain_for_song(song_id: str) -> str | None:
    value = int(song_id)
    for start, end, domain in DOMAIN_BY_RANGE:
        if start <= value <= end:
            return domain
    return None


# Intros are deliberately authored as scenes/sounds/movements rather than
# "Come explore ... with me". Hooks from the existing profile remain usable,
# but these openings make the song enter its world immediately.
SONG_OPENINGS: dict[str, tuple[str, str, str]] = {
    "0011": ("barnyard sound-image", "Cluck-cluck, hoof-step—morning at the gate!", "The barn wakes up, and the letters don't wait."),
    "0012": ("bell-and-door pickup", "Ding-ding—the barn door swings.", "Across the field, a new letter rings."),
    "0013": ("tractor rhythm pickup", "Chug-chug... wheels make a slow little beat.", "Crops, tools, letters—rolling down the field."),
    "0014": ("sunrise scene drop", "Golden light climbs over the fence.", "A quiet farm day starts to stir."),
    "0015": ("harvest sound montage", "Rustle, tumble—fruit in the basket!", "Harvest letters are ready to gather."),
    "0016": ("seed mystery", "A tiny seed wakes under the soil.", "Up comes a leaf—what letter comes too?"),
    "0017": ("buzz-and-petal cold open", "Buzz-buzz... one bright petal shakes.", "A little wing lands where a flower wakes."),
    "0018": ("tool percussion pickup", "Tap... scrape... swish through the soil.", "Garden work makes room for growing things."),
    "0019": ("growth-chain opening", "Seed to sprout, root to snack.", "Garden letters grow along the track."),
    "0020": ("back-door scene drop", "Back door open—sun on the leaves.", "Something small is moving by the garden beds."),
    "0021": ("leaf-crunch sound-image", "Crack... crunch... soft feet on leaves.", "A woodland clue moves between the trees."),
    "0022": ("look-down discovery", "Look down—moss, bark, one curled leaf.", "The forest floor has letters underneath."),
    "0023": ("bird-call pickup", "Tweet-tap... a branch begins to sing.", "Birds and leaves wake up the morning."),
    "0024": ("trail-ready pickup", "Map folded. Boots ready. Eyes wide.", "One woodland clue waits around the bend."),
    "0025": ("falling-leaf cold open", "Whoosh... one red leaf spins down.", "Autumn letters drift without a sound."),
    "0026": ("rainforest percussion image", "Drip-drop, flutter, rustle—listen!", "Rainforest letters hide in every layer."),
    "0027": ("canopy look-up", "Look up—sunlight breaks through green.", "A bright little clue swings into the scene."),
    "0028": ("jungle motion montage", "Slither low, flutter high, leaves go swish.", "Every jungle motion carries a clue."),
    "0029": ("binocular mystery", "Binoculars up—something moved!", "One rainforest letter just slipped from view."),
    "0030": ("river-under-canopy scene", "Water hums under a roof of leaves.", "The river carries a letter downstream."),
    "0031": ("footprint mystery", "Step... step... whose track is that?", "A desert letter crossed the sand."),
    "0032": ("heat-and-shadow pickup", "Hot sun, cool shade, cactus standing tall.", "A bouncing letter peeks around it all."),
    "0033": ("stone-and-bloom contrast", "Stone stays still; one desert flower opens.", "A letter waits between the rock and bloom."),
    "0034": ("dune-count pickup", "One dune, two dunes—up we go.", "A desert clue is hiding down below."),
    "0035": ("oasis reveal", "Palm shade, blue water—there it is!", "An oasis letter has come to visit."),
    "0036": ("snow-crunch parade pickup", "Crunch-crunch—tiny tracks in snow.", "The polar parade is starting to go."),
    "0037": ("tundra hush", "Hush... pale light over the snow.", "One quiet letter glows on the tundra."),
    "0038": ("ice-water sound-image", "Crack... splash... blue water under ice.", "A frozen-ocean clue swims into sight."),
    "0039": ("expedition count-in", "Zip the coat, check the map—ready?", "An Arctic clue waits beyond the next step."),
    "0040": ("wildlife-track montage", "Paw print, wing mark, flipper trail.", "Snowy wildlife leaves a letter behind."),
    "0041": ("echo cold open", "Hello, mountain! ... mountain! ... mountain!", "An echo sends a letter rolling back."),
    "0042": ("rise-fall movement pickup", "Hands up for a peak, hands low for a valley.", "A letter rides the rise and fall."),
    "0043": ("meadow breeze scene", "Soft wind bends the alpine grass.", "A flower nods as a letter passes."),
    "0044": ("trail-marker mystery", "Boot-step, trail mark—look ahead!", "A mountain clue is waiting by the path."),
    "0045": ("ice-step sound-image", "Step... sparkle... ice beside the trail.", "A glacier clue shines in the morning."),
    "0046": ("forecast sound montage", "Pitter-patter, whoosh, then hush.", "The sky has a letter in today's forecast."),
    "0047": ("cloud-shape question", "What shape is drifting over us?", "A cloud moves slowly, carrying a clue."),
    "0048": ("dress-for-weather pickup", "Zip, pull, button—what's the sky doing?", "A weather letter helps us choose what to wear."),
    "0049": ("three-weather rhythm", "Whoosh for wind, tap for rain, hush for snow.", "Three weather rhythms—and the letters go."),
    "0050": ("instrument-panel startup", "Click... spin... the little vane turns.", "Our weather station has a letter to learn."),
}


DOMAIN_SCENES = {
    "farm": "By the barn",
    "garden": "In the garden",
    "forest": "Under the trees",
    "rainforest": "Under the green canopy",
    "desert": "Across the warm sand",
    "polar": "Across the snow and ice",
    "mountain": "Along the mountain trail",
    "weather": "Under the changing sky",
}

DOMAIN_POV = {
    "farm": "a child following morning farm sounds, animals, crops and useful objects",
    "garden": "a small-garden observer noticing growth, color, insects and safe tools",
    "forest": "a quiet woodland walker following tracks, leaves, birds and tree shapes",
    "rainforest": "a curious canopy guide following movement, color, water and animal calls",
    "desert": "a gentle field-guide walk following tracks, shade, plants and desert wildlife",
    "polar": "a warm, calm observer noticing snow, ice, seabirds and cold-climate wildlife",
    "mountain": "a trail observer following echoes, slopes, alpine plants and wildlife",
    "weather": "a playful junior weather watcher noticing sky motion, clothing and simple instruments",
}

DOMAIN_SIGNATURE = {
    "farm": "fiddle or woodblock answers after the target, with a warm porch pulse",
    "garden": "marimba seed-to-sprout answer figures and tiny shaker breaths",
    "forest": "wood-flute or pizzicato leaf answers between target phrases",
    "rainforest": "soft marimba droplets and hand-percussion answers, never masking words",
    "desert": "dry shaker footsteps and sparse marimba echoes with open space",
    "polar": "soft bell sparkle after targets over a warm acoustic pulse",
    "mountain": "small echo responses after targets, with acoustic walking pulse",
    "weather": "glockenspiel or marimba weather-signals after the word, with percussion ducking on onset",
}

DOMAIN_ROUND1 = {
    "farm": "Round 1 feels like a moving farm scene: animal behavior, crop texture and useful-object function replace generic farmyard filler.",
    "garden": "Round 1 alternates growth images, color, shape, insects and safe garden-object functions; never say every object is growing.",
    "forest": "Round 1 uses small woodland observations—bark, wings, tracks, leaves, shade and movement—with plenty of air.",
    "rainforest": "Round 1 uses vivid motion and layered habitat images—flutter, climb, slither, drip and sway—without turning into rapid patter.",
    "desert": "Round 1 uses heat, shade, tracks, spines, stone and animal motion as concrete images, with short lines beside longer scene phrases.",
    "polar": "Round 1 stays spacious and warm, contrasting snow/ice images with animal motion; rare names remain near speech rhythm.",
    "mountain": "Round 1 follows rise-and-fall imagery, rock, trail, trees and wildlife, with natural breath between longer phrases.",
    "weather": "Round 1 is sound-and-motion rich: drip, gust, float, flash, freeze and measure; technical terms get clear speech-like treatment.",
}

DOMAIN_ROUND2 = {
    "farm": "Round 2 leaves a real recall beat, confirms the object, then uses an animal/crop/object-specific safe gesture.",
    "garden": "Round 2 leaves a recall beat and uses object-specific grow, open, wiggle, pour, point or shape gestures; tools stay safe.",
    "forest": "Round 2 uses quiet cue-gap-answer phrasing, then one woodland motion such as hop, flap, sway, tap or trace.",
    "rainforest": "Round 2 becomes stop-start call-and-response with one clean gap and a compact movement tied to the target.",
    "desert": "Round 2 uses short search cues, one recall beat and a safe motion—step, glide, point, spread, trace or sway.",
    "polar": "Round 2 thins the arrangement, leaves one to two beats for recall and confirms with a simple cold-climate motion.",
    "mountain": "Round 2 uses echo-like cue-gap-answer timing and one safe gesture tied to slope, flight, walking, shape or plant movement.",
    "weather": "Round 2 uses forecast-style cue-gap-answer timing and weather-specific hand motions; instruments/technical objects are pointed to or mimed safely.",
}

FORM_PALETTE = (
    ((2, 5), (4, 7), True),
    ((3, 7), (3, 7), False),
    ((2, 5, 7), (4, 7), True),
    ((3, 6), (4, 7), False),
    ((2, 5), (3, 6), False),
    ((2, 6), (3, 7), True),
    ((3, 5), (4, 7), False),
)

# Five compatible pattern palettes. They share a learnable grammar but rotate
# where the letter/object enters and how much scene language surrounds it.
PATTERN_PALETTES: tuple[tuple[tuple[str, ...], tuple[str, ...]], ...] = (
    (
        ("{letter} — {object}! {semantic}", "{letter} ... {letter} ... {object}! {semantic}", "{letter} is for {object}. {semantic}", "What does {letter} bring? {object}! {semantic}", "{scene}, {letter} meets {object}. {semantic}"),
        ("{letter} ... {object}! {action}", "{letter}? ... {object}! {action}", "Find {letter} ... {object}! {action}", "{letter} ... {letter} ... {object}! {action}"),
    ),
    (
        ("{object} — that's {letter}. {semantic}", "Spot {letter}: {object}! {semantic}", "{letter} brings {object}. {semantic}", "{letter}? {object}! {semantic}", "{scene}, here is {letter} with {object}. {semantic}"),
        ("Spot {letter} ... {object}! {action}", "Remember {letter} ... {object}! {action}", "{letter}? ... {object}! {action}", "Find {letter} ... {object}! {action}"),
    ),
    (
        ("{letter} ... {letter} ... {object}! {semantic}", "{object} — remember {letter}. {semantic}", "{scene}, {letter} finds {object}. {semantic}", "{letter} — {object}. {semantic}", "Which clue starts with {letter}? {object}! {semantic}"),
        ("Call {letter} ... {object}! {action}", "{letter} ... {letter} ... {object}! {action}", "Ready for {letter}? ... {object}! {action}", "Show {letter} ... {object}! {action}"),
    ),
    (
        ("{scene}, {letter} finds {object}. {semantic}", "{letter} — {object}. {semantic}", "What waits at {letter}? {object}! {semantic}", "{letter} is for {object}. {semantic}", "{object} — our {letter}. {semantic}"),
        ("Soft cue, {letter} ... {object}! {action}", "{letter}? ... {object}! {action}", "Show {letter} ... {object}! {action}", "Remember {letter} ... {object}! {action}"),
    ),
    (
        ("Look at {letter}: {object}! {semantic}", "{letter} — {object}. {semantic}", "{scene}, {letter} meets {object}. {semantic}", "{letter} ... {letter} ... {object}! {semantic}", "What did {letter} find? {object}! {semantic}"),
        ("Look for {letter} ... {object}! {action}", "{letter} ... {object}! {action}", "Clue {letter}? ... {object}! {action}", "{letter} ... {letter} ... {object}! {action}"),
    ),
)


def spec_payload(song_id: str, base_style: str, hook_a: str, hook_b: str, bpm: int, motif: str) -> dict[str, Any] | None:
    domain = domain_for_song(song_id)
    opening = SONG_OPENINGS.get(song_id)
    if domain is None or opening is None:
        return None
    variant = (int(song_id) - 11) % 5
    r1_patterns, r2_patterns = PATTERN_PALETTES[variant]
    r1_after, r2_after, has_interlude = FORM_PALETTE[(int(song_id) - 11) % len(FORM_PALETTE)]
    scene = DOMAIN_SCENES[domain]
    r1_patterns = tuple(pattern.replace("{scene}", scene) for pattern in r1_patterns)
    interlude = ()
    if has_interlude:
        interlude = ({
            "farm": "The barnyard settles for one breath—now call the words back.",
            "garden": "The leaves go still for one breath—what can we remember?",
            "forest": "The trail goes quiet—listen for the woodland words returning.",
            "rainforest": "The canopy hushes for one beat—now the clues come back.",
            "desert": "The footsteps stop in the shade—now remember the clues.",
            "polar": "Snow goes quiet for one breath—now call the cold-climate words back.",
            "mountain": "The echo fades—now send the letter words back to us.",
            "weather": "The forecast pauses—now call the weather words back.",
        }[domain],)
    style = (
        f"{base_style}. Clear warm adult lead with crisp dry diction and stable vowels. "
        f"Use a narrow mostly stepwise melody around {bpm} BPM; preserve lexical stress and give long targets extra bars instead of rushing. "
        f"Open with the song-specific {opening[0]}, not a generic spoken welcome. {DOMAIN_ROUND1[domain]} "
        f"Let the chorus lift into the exact two-line hook with a simple child-compatible echo. {DOMAIN_ROUND2[domain]} "
        f"Thin or duck percussion and backing vocals at every target-word onset; let the signature color answer after the word: {DOMAIN_SIGNATURE[domain]}. "
        "Keep harmony simple and stable, no melisma, no rapid list delivery, no dense choir over learning words. "
        "End with one final hook or short thematic callback and a clean cadence; no long instrumental tail."
    )
    return {
        "opening_type": opening[0],
        "target_entry_families": ("direct", "repeated-letter", "is-for", "question-answer", "narrative"),
        "line_length_contour": ("short", "medium", "long", "short", "medium"),
        "rhyme_engine": "mixed-internal-phraselet",
        "chorus_rhyme_engine": "paired" if variant in (0, 2, 4) else "refrain-driven",
        "point_of_view": DOMAIN_POV[domain],
        "chorus_function": "memorable two-line thematic reset with child-compatible echo",
        "groove_meter": ("light 4/4 bounce", "gentle 6/8 sway", "stop-go 4/4 pulse", "walking 4/4 folk", "light 3/4 or swung sway")[variant],
        "round1_grammar": DOMAIN_ROUND1[domain],
        "round2_grammar": DOMAIN_ROUND2[domain],
        "section_contrast": f"Verses stay sparse; chorus widens; retrieval strips back. {DOMAIN_SIGNATURE[domain]}",
        "signature_color": DOMAIN_SIGNATURE[domain],
        "intro_lines": (opening[1], opening[2]),
        "hook_lines": (hook_a, hook_b),
        "outro_lines": (hook_a, f"A to Z—{motif.replace('-', ' ')} stays with me!"),
        "interlude_lines": interlude,
        "chorus_after_round1": r1_after,
        "chorus_after_round2": r2_after,
        "round1_patterns": r1_patterns,
        "round2_patterns": r2_patterns,
        "style_blueprint": style,
        "object_craft_required": True,
    }


# --- Object-conditioned craft -------------------------------------------------

# Exact facts are kept for technical, specialist, or potentially ambiguous
# words. Common nouns are handled by the category resolvers below.
SPECIAL_FACTS: dict[str, str] = {
    "Irrigation Pump": "An irrigation pump moves water through pipes or hoses so crops can be watered.",
    "Kid Goat": "A kid goat is a young goat with small hooves and curious ears.",
    "Utility Cart": "A utility cart carries tools, feed, or supplies around a farm or garden.",
    "Vet Kit": "A vet kit holds simple tools a veterinarian uses to check animal health.",
    "X-ray Vet Image": "An X-ray vet image lets a veterinarian see bones inside an animal without opening the body.",
    "Xanthid Crab": "A xanthid crab is a small shore crab with a rounded shell and walking legs that lives among rocks or tide pools.",
    "X-ray Tetra": "An X-ray tetra is a small freshwater fish with a silvery body and a partly transparent middle that shows its shape.",
    "Quillwort": "A quillwort is a small freshwater plant with stiff, quill-like leaves growing from the bottom of shallow water.",
    "X-shaped Snowflake": "An X-shaped snowflake is a branching ice crystal whose arms meet in a simple X-like pattern.",
    "Xenolith": "A xenolith is a piece of rock trapped inside a different rock, like a pebble held inside stone.",
    "Xylem": "Xylem is the plant tissue made of tiny tubes that carries water upward from roots through stems.",
    "Zebu": "A zebu is a type of cattle with a noticeable hump over its shoulders.",
    "Compost": "Compost is decayed plant and food material that can enrich garden soil.",
    "Kneeling Pad": "A kneeling pad is a soft cushion that protects knees during low garden work.",
    "Mulch": "Mulch covers soil to help hold moisture and reduce weeds.",
    "Nasturtium": "Nasturtium is a flowering plant with round leaves and bright blooms.",
    "Umbrella Plant": "An umbrella plant has leaf clusters that spread like little umbrellas.",
    "Vegetable Bed": "A vegetable bed is a prepared patch of soil where food plants grow together.",
    "Xeranthemum": "Xeranthemum is a flowering plant known for dry, papery-looking flower heads.",
    "Yarrow": "Yarrow is a plant with flat clusters of many tiny flowers.",
    "Zinnia": "A zinnia is a bright garden flower with layered petals around its center.",
    "Douglas Fir": "A Douglas fir is a tall evergreen tree with needle-like leaves and hanging cones.",
    "Quartz Rock": "Quartz is a hard mineral that can look glassy or sparkle in rock.",
    "Upland Fern": "An upland fern grows feathery fronds on the forest floor or slopes.",
    "Yellow Warbler": "A yellow warbler is a small bright-yellow songbird that moves among shrubs and trees.",
    "Zebra Swallowtail": "A zebra swallowtail is a butterfly with black-and-white striped wings and long tails.",
    "Xeric Shrub": "A xeric shrub is a woody plant adapted to dry conditions.",
    "Ceiba Tree": "A ceiba is a very tall tropical tree that can rise above the rainforest canopy.",
    "Drongo": "A drongo is a dark-colored bird known for agile flight and a forked or notched tail.",
    "Emerald Tree Boa": "An emerald tree boa is a green snake that coils around rainforest branches.",
    "Howler Monkey": "A howler monkey is a tree-dwelling monkey famous for very loud calls.",
    "Jungle Vine": "A jungle vine climbs through other plants to reach light in the canopy.",
    "Kapok Tree": "A kapok tree is a tall tropical tree with a huge trunk and spreading crown.",
    "Kinkajou": "A kinkajou is a small rainforest mammal that climbs trees and has a long tail.",
    "Liana": "A liana is a long woody vine that climbs through rainforest trees.",
    "Nectar Bat": "A nectar bat visits flowers and drinks nectar with a long tongue.",
    "Queen Butterfly": "A queen butterfly has orange-brown wings marked with dark veins and pale spots.",
    "Quetzal": "A quetzal is a colorful forest bird, often green with a bright red belly.",
    "Rattan": "Rattan is a climbing palm with long flexible stems that weave through tropical forest.",
    "Uakari": "A uakari is a rainforest monkey with a short tail and a distinctive bare face.",
    "Water Vine": "A water vine is a climbing rainforest vine whose stems can hold water.",
    "Xenops": "A xenops is a small tropical bird that searches bark and branches for insects.",
    "Yellow Anaconda": "A yellow anaconda is a large South American snake with dark blotches on yellowish skin.",
    "Zebra Longwing": "A zebra longwing is a butterfly with long black wings striped pale yellow.",
    "Zingiber Plant": "A Zingiber plant is a tropical ginger relative that grows leafy stems from underground rhizomes.",
    "Bighorn Sheep": "A bighorn sheep is a mountain and desert sheep whose adults can carry heavy curved horns.",
    "Desert Tortoise": "A desert tortoise carries a hard shell and shelters from extreme heat in burrows.",
    "Gila Monster": "A Gila monster is a heavy-bodied desert lizard with bead-like scales and patterned skin.",
    "Horned Lizard": "A horned lizard has a broad flat body and pointed scales around its head.",
    "Joshua Tree": "A Joshua tree is a desert plant with stiff pointed leaves on branching trunks.",
    "Kangaroo Rat": "A kangaroo rat is a small desert rodent with long hind legs for hopping.",
    "Mesquite": "Mesquite is a hardy desert tree or shrub with tiny leaves and long seed pods.",
    "Nopales": "Nopales are the flat green pads of prickly pear cactus.",
    "Prickly Pear": "Prickly pear is a cactus with flat pads and colorful fruit.",
    "Rattlesnake": "A rattlesnake is a snake with a rattle at the end of its tail; we observe it from a safe distance.",
    "Umbrella Thorn": "An umbrella thorn is a thorny acacia tree with a broad, umbrella-shaped crown.",
    "Xerophyte": "A xerophyte is a plant adapted to live where water is scarce.",
    "Xerus": "A xerus is an African ground squirrel that lives in open dry country.",
    "Yellow Scorpion": "A yellow scorpion is a pale desert scorpion; we only observe it from a safe distance.",
    "Ziziphus Shrub": "A Ziziphus shrub is a hardy thorny plant that can bear small round fruits.",
    "Arctic Fox": "An Arctic fox has thick fur and small ears that help it cope with cold weather.",
    "Beluga": "A beluga is a pale whale with a rounded forehead that lives in cold northern seas.",
    "Dovekie": "A dovekie is a small black-and-white seabird that dives for food in cold water.",
    "Floe": "An ice floe is a flat piece of floating sea ice.",
    "Fur Seal": "A fur seal swims with strong flippers and has a thick coat of fur.",
    "Harp Seal": "A harp seal is a northern seal whose adults have a dark harp-shaped marking on the back.",
    "Icefish": "An icefish is a fish adapted to very cold polar water.",
    "Jaeger": "A jaeger is a strong-flying seabird of northern oceans and tundra.",
    "Kittiwake": "A kittiwake is a gull-like seabird that nests on sea cliffs.",
    "Krill": "Krill are tiny shrimp-like animals that form an important food source in cold oceans.",
    "Lemming": "A lemming is a small northern rodent that lives on tundra and eats plants.",
    "Musk Ox": "A musk ox is a shaggy Arctic mammal with a thick coat and curved horns.",
    "Northern Fulmar": "A northern fulmar is a seabird that glides on stiff wings over cold ocean water.",
    "Polar Bear": "A polar bear is a large Arctic bear with thick fur and broad paws.",
    "Qajaq": "Qajaq is the Greenlandic word behind kayak, a narrow skin-covered boat traditionally used in Arctic waters.",
    "Ringed Seal": "A ringed seal is a small Arctic seal with pale ring-shaped markings on its coat.",
    "Snowy Owl": "A snowy owl is a pale Arctic owl with thick feathers and powerful wings.",
    "Umiak": "An umiak is a traditional open Arctic boat used to carry people and supplies.",
    "Upland Goose": "An upland goose is a sturdy goose of open southern grasslands and islands.",
    "Velvet Scoter": "A velvet scoter is a dark sea duck with a pale wing patch.",
    "Yellow-billed Loon": "A yellow-billed loon is a large diving bird with a long pale-yellow bill.",
    "Zoarcid Fish": "A zoarcid fish is an eel-shaped fish from a family often called eelpouts.",
    "Alpine Goat": "An alpine goat is sure-footed on steep rocky ground and climbs with strong hooves.",
    "Hiking Boot": "A hiking boot has a sturdy sole and supports feet on rough trails.",
    "Icefall": "An icefall is a steep, broken part of a glacier where the ice flows downhill.",
    "Kettle Lake": "A kettle lake is a bowl-shaped lake formed where a block of old glacier ice left a hollow.",
    "Nutcracker": "A nutcracker is a mountain bird with a strong bill that opens and carries seeds.",
    "Outcrop": "An outcrop is a place where solid rock is exposed at the ground surface.",
    "Pika": "A pika is a small round-eared mountain mammal that lives among rocks.",
    "Upland Meadow": "An upland meadow is an open grassy area high above lower valleys.",
    "Urial": "An urial is a wild sheep with curved horns that lives in dry hills and mountains.",
    "Yellow Bell": "A yellow bell is a bell-shaped yellow wildflower.",
    "Zigzag Trail": "A zigzag trail bends back and forth to climb a slope more gently.",
    "Altocumulus": "Altocumulus clouds form rounded patches or rolls in the middle levels of the sky.",
    "Anemometer": "An anemometer is an instrument that measures wind speed.",
    "Eye of Storm": "The eye of a strong tropical storm can be a calmer area near its center.",
    "Humidity Meter": "A humidity meter measures how much water vapor is in the air.",
    "Jet Stream": "The jet stream is a fast-moving band of air high in the atmosphere.",
    "Kelvin Thermometer": "A Kelvin thermometer shows temperature on the Kelvin scale.",
    "Nimbus Cloud": "Nimbus is a weather word associated with rain-bearing clouds.",
    "Overcast Sky": "An overcast sky is covered by a broad layer of cloud.",
    "Pressure Gauge": "A pressure gauge shows how much pressure is present in air or another fluid.",
    "Quiet Sky": "A quiet sky has little dramatic weather, with calm-looking clouds or clear air.",
    "Updraft": "An updraft is air moving upward.",
    "Vane": "A weather vane turns to show the direction the wind comes from.",
    "Vapor": "Water vapor is water in its invisible gas form in the air.",
    "Windsock": "A windsock points and fills out to show wind direction and give a clue about wind strength.",
    "X-band Radar": "X-band radar uses short radio waves to detect things such as rain or moving objects.",
    "Zephyr": "A zephyr is a soft, gentle breeze.",
}

COMMON_FACTS: dict[str, str] = {
    # Farm / barn / harvest
    "Apron": "An apron covers the front of clothes and helps keep them cleaner during messy work.",
    "Bucket": "A bucket has a handle and a deep open top for carrying things such as water or feed.",
    "Barn": "A barn is a farm building that can shelter animals, hay, tools, or supplies.",
    "Farmer": "A farmer cares for crops, animals, land, and the daily work of a farm.",
    "Egg": "An egg has a smooth oval shell protecting what grows inside.",
    "Fence": "A fence makes a boundary around a field, yard, or animal area.",
    "Grain": "Grain is the small seed harvested from crops such as wheat, oats, or corn.",
    "Hay": "Hay is cut and dried grass or other plants stored as animal feed.",
    "Ice Chest": "An ice chest is an insulated box that helps food or drinks stay cold.",
    "Jar": "A jar is a rigid container with a wide opening and a lid.",
    "Jug": "A jug is a container with a handle and a narrow opening for pouring liquid.",
    "Kernel": "A kernel is one small seed or grain, such as a kernel of corn.",
    "Ladder": "A ladder has rungs between two side rails for reaching higher places; children only observe it safely.",
    "Milk": "Milk is a pale liquid food produced by mammals; on farms it is commonly collected from dairy animals.",
    "Orchard": "An orchard is a group of fruit or nut trees grown together.",
    "Pitchfork": "A pitchfork is a long-handled farm tool with several pointed tines; children only identify it from a safe distance.",
    "Quilt": "A quilt is a warm layered blanket stitched from fabric pieces.",
    "Rake": "A rake has a long handle and a row of teeth used to gather loose material; children only identify it safely.",
    "Scarecrow": "A scarecrow is a human-shaped figure placed in a field to discourage birds from feeding on crops.",
    "Tractor": "A tractor is a powerful farm vehicle built to pull or operate heavy equipment.",
    "Trough": "A trough is a long open container that can hold feed or water for farm animals.",
    "Udder": "An udder is the milk-producing organ beneath animals such as cows, goats, and sheep.",
    "Vegetable Basket": "A vegetable basket holds gathered produce so it can be carried together.",
    "Wagon": "A wagon is a four-wheeled cart used to carry people, crops, or supplies.",
    "Wheat": "Wheat is a tall grain crop whose seed is ground to make flour.",
    "Yarn": "Yarn is a long strand of spun fiber used for knitting, weaving, or tying craft materials.",
    "Xylophone": "A xylophone is our X-word helper: a row of tuned bars makes different notes when struck.",
    "Ant": "An ant is a small insect with six legs that follows scent trails and works around soil and plants.",
    "Cow": "A cow is a large farm animal that chews grass, walks on split hooves, and may produce milk.",
    "Donkey": "A donkey has long ears, sturdy hooves, and a strong body used for carrying or pulling loads.",
    "Ewe": "A ewe is an adult female sheep with a woolly coat.",
    "Goat": "A goat has cloven hooves, curious eyes, and a knack for climbing and browsing plants.",
    "Lamb": "A lamb is a young sheep with a soft woolly coat and small hooves.",
    "Mule": "A mule is a strong hoofed animal whose parents are a donkey and a horse.",
    "Ox": "An ox is cattle trained for pulling heavy loads or farm equipment.",
    "Pig": "A pig has a strong snout for rooting and a stout body carried on four hooved feet.",
    "Sheep": "A sheep grows a woolly fleece and grazes on grasses and other plants.",
    "Chicken": "A chicken scratches the ground with its feet and pecks for seeds or small bits of food.",
    "Hen": "A hen is an adult female chicken that can lay eggs.",
    "Rooster": "A rooster is an adult male chicken with a noticeable comb and a loud crow.",

    # Garden / plants / simple tools
    "Dirt": "Garden dirt is soil—a mix of mineral particles and organic material where roots can grow.",
    "Garden Gate": "A garden gate swings open and closed to make an entrance through a fence.",
    "Garden Hose": "A garden hose is a flexible tube that carries water to plants.",
    "Hoe": "A hoe is a long-handled garden tool used by adults to shape or loosen soil; children only identify it safely.",
    "Herb": "An herb is a leafy plant valued for flavor, scent, or another useful quality.",
    "Pot": "A plant pot is a container that holds soil and gives roots a small place to grow.",
    "Seed": "A seed holds a tiny plant embryo and stored food inside a protective coat.",
    "Trowel": "A trowel is a small hand tool for moving soil; children only identify it safely.",
    "Umbrella": "An umbrella opens into a wide canopy that helps keep rain off a person.",
    "Watering Can": "A watering can has a handle and spout for pouring water gently onto plants.",
    "Worm": "A worm has a long soft body and wriggles through moist soil, helping mix it as it moves.",
    "Apple Tree": "An apple tree has woody branches, blossoms in season, and fruit that grows from pollinated flowers.",
    "Bean": "A bean plant can climb or bush out, making pods that hold the beans inside.",
    "Carrot": "A carrot stores food in a thick orange root while feathery green leaves grow above the soil.",
    "Eggplant": "An eggplant plant grows broad leaves and glossy purple, white, or striped fruit.",
    "Kale": "Kale grows broad crinkled leaves that are harvested as a leafy vegetable.",
    "Onion": "An onion forms a layered bulb underground with green leaves above the soil.",
    "Pea": "A pea plant makes pods with round peas lined up inside.",
    "Quince": "A quince grows as a firm yellow fruit on a shrub or small tree.",
    "Radish": "A radish grows a crisp round or tapered root below the soil with leaves above.",
    "Tomato": "A tomato plant carries round fruit on branching green stems.",
    "Yam": "A yam stores food in a thick underground tuber.",
    "Zucchini": "A zucchini plant makes long green squash beneath broad leaves and yellow blossoms.",
    "Daisy": "A daisy has a round center surrounded by a ring of simple petals.",
    "Flower": "A flower is the blooming part of a plant, often carrying petals around its reproductive center.",
    "Iris": "An iris opens showy petals above long blade-like leaves.",
    "Jasmine": "Jasmine grows small fragrant flowers on a shrub or climbing vine.",
    "Lavender": "Lavender carries narrow fragrant leaves and spikes of tiny purple flowers.",
    "Marigold": "A marigold makes bright yellow, orange, or gold flower heads above leafy stems.",
    "Orchid": "An orchid flower often has a distinctive symmetrical shape and a specialized central lip.",
    "Rose": "A rose opens layers of petals on a woody stem that often carries prickles.",
    "Sunflower": "A sunflower holds a broad flower head on a tall sturdy stem, with many small flowers packed in the center.",
    "Violet": "A violet is a small low-growing plant with soft purple, blue, white, or yellow flowers.",

    # Woodland
    "Aspen": "Aspen leaves tremble on flattened stems, making the crown shimmer in a light breeze.",
    "Birch": "Birch trees are easy to notice by their pale bark, often peeling in thin papery layers.",
    "Cedar": "A cedar is an evergreen tree with aromatic wood and scale-like or needle-like foliage.",
    "Evergreen": "An evergreen keeps living green leaves or needles through the year instead of dropping them all at once.",
    "Juniper": "Juniper is an evergreen shrub or tree with needle- or scale-like leaves and berry-like seed cones.",
    "Maple": "A maple has broad lobed leaves and winged seeds that can spin as they fall.",
    "Oak": "An oak is a sturdy broadleaf tree that produces acorns.",
    "Pine": "A pine is an evergreen tree with bundles of needles and woody cones.",
    "Spruce": "A spruce is an evergreen tree with short stiff needles and hanging cones.",
    "Tree": "A tree has a woody trunk lifting branches and leaves high above its roots.",
    "Yew": "A yew is a dense evergreen tree or shrub with flat dark-green needles.",
    "Acorn": "An acorn is the hard-shelled seed of an oak tree, topped by a little cup.",
    "Grouse": "A grouse is a sturdy woodland bird that spends much of its time on the ground and can burst into fast flight.",
    "Knot": "A knot is a hard, twisted place in wood where a branch grew from the trunk.",
    "Log": "A log is a fallen or cut section of tree trunk that can become shelter for small forest life.",
    "Mushroom": "A mushroom is the fruiting body of a fungus, often shaped like a cap on a stalk.",
    "Pinecone": "A pinecone is a woody cone made of overlapping scales that protects a pine tree's seeds.",
    "Hollow Log": "A hollow log is a fallen trunk with an empty space inside that can shelter small animals.",
    "Fox": "A fox has pointed ears, a long bushy tail, and quiet paws for moving through its habitat.",
    "Hedgehog": "A hedgehog has a coat of stiff spines and can curl its body into a tight ball.",
    "Rabbit": "A rabbit has long ears and powerful back legs for quick hops.",
    "Squirrel": "A squirrel has a bushy tail and nimble feet for climbing, balancing, and gathering food.",

    # Rainforest
    "Anteater": "An anteater has a long snout and sticky tongue for reaching ants and termites.",
    "Banana": "A banana plant has huge leaves and grows clusters of curved fruit.",
    "Boa": "A boa is a thick-bodied snake that moves by muscular curves and can coil around branches.",
    "Chameleon": "A chameleon has gripping feet, independently moving eyes, and a long tongue for catching prey.",
    "Elephant": "An elephant uses its long flexible trunk to smell, touch, drink, and pick things up.",
    "Fern": "A fern unfurls divided green fronds from curled young growth called fiddleheads.",
    "Frog": "A frog has strong back legs for hopping and swimming and moist skin.",
    "Gecko": "Many geckos have gripping toe pads that help them cling to bark, leaves, or other surfaces.",
    "Hornbill": "A hornbill is a tropical bird with a large curved bill, often topped by a raised casque.",
    "Iguana": "An iguana is a large lizard with a long tail and a row of spines along its back.",
    "Leopard": "A leopard is a powerful spotted cat that can climb and move quietly through cover.",
    "Macaw": "A macaw is a large parrot with a strong curved beak, long tail, and vivid feathers.",
    "Monkey": "A monkey uses grasping hands and flexible limbs to climb, balance, and move through branches.",
    "Parrot": "A parrot has a strong curved beak and gripping feet for holding onto branches and food.",
    "Rainforest Frog": "A rainforest frog has moist skin and strong legs, and many species live among wet leaves or branches.",
    "Sloth": "A sloth hangs from branches with long curved claws and moves very slowly through the canopy.",
    "Snake": "A snake moves without legs by bending its long scaled body in muscular curves.",
    "Tapir": "A tapir is a sturdy forest mammal with a short flexible snout used to grasp leaves.",
    "Toucan": "A toucan is a tropical bird with an exceptionally large colorful bill.",
    "Viper": "A viper is a venomous snake; we learn its shape and markings while observing safely from a distance.",

    # Desert
    "Eagle": "An eagle has broad wings, strong feet, and keen eyesight for spotting things far below.",
    "Hawk": "A hawk is a keen-eyed bird of prey with strong wings and grasping feet.",
    "Kestrel": "A kestrel is a small falcon that can hover or perch while watching for prey.",
    "Lizard": "A lizard has a long body, four legs in most species, scales, and a tail.",
    "Fennec": "A fennec is a small desert fox with very large ears that help release heat and detect sounds.",
    "Jackrabbit": "A jackrabbit has very long ears and powerful hind legs for fast leaps across open ground.",
    "Nighthawk": "A nighthawk is a dusk-flying bird that catches insects in the air with a wide mouth.",
    "Roadrunner": "A roadrunner is a long-legged ground bird that can run quickly across dry country.",
    "Scorpion": "A scorpion has pincers and a curved stinging tail; we only observe it safely from a distance.",
    "Wren": "A wren is a small energetic songbird, often seen hopping through shrubs and low cover.",

    # Polar / mountain
    "Bear": "A bear is a large furry mammal with strong legs, broad paws, and an excellent sense of smell.",
    "Caribou": "A caribou is a northern deer with broad hooves and antlers; large herds can travel long distances.",
    "Reindeer": "Reindeer are caribou; their broad hooves help them travel over snow and soft ground.",
    "Murre": "A murre is a black-and-white seabird that nests on cliffs and dives underwater using its wings.",
    "Orca": "An orca is a black-and-white toothed whale that swims in family groups called pods.",
    "Walrus": "A walrus is a large Arctic marine mammal with long tusks, whiskers, and broad flippers.",
    "Yak": "A yak is a shaggy hoofed animal adapted to cold, high mountain regions.",
    "Fir": "A fir is an evergreen tree with soft-looking needles and upright cones on its branches.",
    "Nest": "A nest is a structure animals—especially birds—build or use to hold eggs and raise young.",
    "Rope": "A rope is a strong flexible length of twisted or braided fibers; children only identify climbing rope safely.",
    "Cabin": "A cabin is a small simple shelter or house, often built in a rural or mountain setting.",
    "Tent": "A tent is a portable fabric shelter held up by poles and secured to the ground.",
    "Quail": "A quail is a small round-bodied ground bird that walks, pecks, and can burst into short flight.",
    "Vulture": "A vulture is a large soaring bird that helps clean ecosystems by eating dead animals.",
    "Auk": "An auk is a compact black-and-white seabird that swims and dives using its wings underwater.",
    "Eider": "An eider is a sea duck with dense feathers that help insulate it in cold coastal water.",
    "Goose": "A goose has a long neck, webbed feet for paddling, and strong wings for long flights.",
    "Owl": "An owl has large forward-facing eyes, soft flight feathers, and a hooked beak.",
    "Puffin": "A puffin is a black-and-white seabird with a colorful bill and strong wings for both flight and underwater swimming.",
    "Tern": "A tern is a slender seabird with pointed wings that often dives toward the water for food.",
    "Cod": "A cod is a sturdy ocean fish with several fins and a small chin barbel on many species.",
    "Dog Sled": "A dog sled rides on long runners over snow and can be pulled by a trained team of sled dogs.",
    "Husky": "A husky is a thick-coated working dog with strong legs and paws suited to cold conditions.",
    "Ermine": "An ermine is a small weasel whose coat can turn white in winter in cold regions.",

    # Weather gear / instruments
    "Boots": "Boots cover the feet and ankles; weather boots help keep feet dry, warm, or protected.",
    "Coat": "A coat is an outer layer of clothing worn to help keep the body warm or dry.",
    "Earmuffs": "Earmuffs cover the ears with padded cups to help keep them warm in cold weather.",
    "Gauge": "A gauge has a scale, pointer, or display that shows a measurement.",
    "Jacket": "A jacket is an outer layer worn over other clothes for warmth or protection.",
    "Kite": "A kite is a light frame with a covering that can fly when moving air pushes against it.",
    "Mittens": "Mittens keep the hand warm by enclosing the fingers together in one pocket.",
    "Overcoat": "An overcoat is a long warm coat worn over other clothing in cold weather.",
    "Raincoat": "A raincoat uses water-resistant material to help keep clothing dry in rain.",
    "Thermometer": "A thermometer measures temperature.",
    "Yellow Rain Boots": "Yellow rain boots are waterproof boots that help keep feet dry on wet ground.",
    "Zipper Jacket": "A zipper jacket opens and closes with interlocking zipper teeth down the front.",
}

COMMON_ACTIONS: dict[str, str] = {
    "Apron": "Trace a little apron shape on your shirt.", "Bucket": "Make a round bucket with both hands.",
    "Barn": "Make a roof shape with both hands.", "Egg": "Make a small oval with your hands.", "Fence": "Hold fingers upright like fence posts.",
    "Grain": "Pinch two fingers like a tiny grain.", "Hay": "Spread fingers like a loose bundle of hay.", "Jug": "Mime one gentle pouring motion.",
    "Scarecrow": "Stretch arms out like a scarecrow.", "Tractor": "Roll two fists slowly like big wheels.", "Wagon": "Roll two hands forward like wagon wheels.",
    "Dirt": "Rub fingertips together like crumbly soil.", "Garden Gate": "Open one palm like a swinging gate.", "Garden Hose": "Trace one long wavy hose.",
    "Pot": "Cup both hands like a plant pot.", "Seed": "Pinch fingers tiny, then slowly open them.", "Umbrella": "Open both hands into a wide umbrella shape.",
    "Watering Can": "Mime one gentle pour toward the ground.", "Worm": "Wiggle one finger through imaginary soil.",
    "Acorn": "Make a tiny cup-and-cap shape with two fingers.", "Knot": "Twist two fingers together like a wood knot.", "Log": "Hold one forearm straight like a log.",
    "Mushroom": "Make one hand into a little mushroom cap.", "Pinecone": "Cup fingers into a small cone shape.", "Hollow Log": "Make a tunnel with both hands.",
    "Anteater": "Reach one finger out like a long tongue.", "Elephant": "Swing one arm gently like a trunk.", "Rainforest Frog": "Make one little finger-hop.",
    "Tapir": "Curl one hand forward like a short flexible snout.", "Fennec": "Hold two hands up like very large ears.", "Jackrabbit": "Make one gentle two-finger leap.",
    "Roadrunner": "Run two fingers quickly across your palm.", "Dog Sled": "Point to the sled picture and trace its runners.", "Husky": "Make two quiet paw-steps with your fingers.",
    "Ermine": "Make one small quiet paw-step.", "Fir": "Reach hands up like a narrow evergreen tree.", "Nest": "Cup both hands like a nest.",
    "Rope": "Point to the rope and trace one long line in the air.", "Cabin": "Make a little roof with both hands.", "Tent": "Touch fingertips into a tent shape.",
    "Boots": "Tap two pretend boot-steps.", "Coat": "Mime pulling a coat around your shoulders.", "Earmuffs": "Cup hands gently over your ears.",
    "Gauge": "Point to an imaginary dial and trace its pointer.", "Jacket": "Mime pulling on a jacket.", "Mittens": "Rub mittened hands together for warmth.",
    "Overcoat": "Mime wrapping a warm coat around your body.", "Raincoat": "Mime pulling up a raincoat hood.", "Thermometer": "Point to the picture and trace the temperature scale.",
    "Quilt": "Mime pulling a warm quilt up gently.", "Yellow Rain Boots": "Tap two pretend rain-boot steps.", "Zipper Jacket": "Mime one slow zipper motion.",
    "Xylophone": "Tap two fingers in the air like gentle xylophone mallets.",
    "Ant": "Wiggle two fingers like tiny ant legs.",
    "Xanthid Crab": "Wiggle fingers sideways like a small crab.",
    "X-ray Tetra": "Swim two fingers forward like a small fish.",
    "Quillwort": "Point fingers upward like a little cluster of plant leaves.",
    "X-shaped Snowflake": "Open both hands into a simple branching snowflake.",
    "Xenolith": "Point to the inner rock shape inside the larger stone.",
    "Xylem": "Trace a line upward from roots to leaves.",
}

BIRDS = {
    "Chicken", "Duck", "Hen", "Quail", "Rooster", "Eagle", "Jay", "Owl", "Woodpecker", "Yellow Warbler",
    "Drongo", "Hornbill", "Macaw", "Parrot", "Quetzal", "Toucan", "Vulture", "Wren", "Zebra Finch",
    "Auk", "Dovekie", "Eider", "Goose", "Jaeger", "Kittiwake", "Murre", "Northern Fulmar", "Puffin", "Snowy Owl",
    "Tern", "Upland Goose", "Velvet Scoter", "Yellow-billed Loon", "Falcon", "Kestrel", "Nutcracker",
}

HOOFED_ANIMALS = {
    "Cow", "Donkey", "Ewe", "Goat", "Kid Goat", "Lamb", "Mule", "Ox", "Pig", "Sheep", "Zebu",
    "Bighorn Sheep", "Camel", "Ibex", "Oryx", "Urial", "Caribou", "Musk Ox", "Reindeer", "Yak", "Alpine Goat", "Deer",
}

SMALL_MAMMALS = {"Chipmunk", "Hedgehog", "Rabbit", "Squirrel", "Kinkajou", "Meerkat", "Kangaroo Rat", "Lemming", "Vole", "Marmot", "Pika"}
PREDATOR_MAMMALS = {"Bear", "Fox", "Lynx", "Wolf", "Arctic Fox", "Polar Bear", "Jaguar", "Leopard", "Ocelot"}
PRIMATES = {"Gorilla", "Howler Monkey", "Monkey", "Uakari"}
REPTILES = {"Anaconda", "Boa", "Chameleon", "Emerald Tree Boa", "Gecko", "Iguana", "Snake", "Viper", "Armadillo", "Desert Tortoise", "Gila Monster", "Horned Lizard", "Lizard", "Rattlesnake", "Tortoise", "Yellow Anaconda"}
INSECTS = {"Bee", "Ladybug", "Earthworm", "Insect", "Dragonfly", "Queen Butterfly", "Yellow Butterfly", "Zebra Longwing", "Zebra Swallowtail", "Beetle", "Scorpion", "Yellow Scorpion", "Xenops", "Ant"}
MARINE = {"Beluga", "Cod", "Fur Seal", "Harp Seal", "Icefish", "Jellyfish", "Krill", "Narwhal", "Orca", "Ringed Seal", "Seal", "Walrus", "Whale", "X-ray Fish", "Xanthid Crab", "Zoarcid Fish", "Zooplankton"}

TREES = {"Apple Tree", "Aspen", "Birch", "Cedar", "Douglas Fir", "Evergreen", "Juniper", "Maple", "Oak", "Pine", "Spruce", "Tree", "Yew", "Ceiba Tree", "Kapok Tree", "Palm", "Joshua Tree", "Mesquite"}
FLOWERS = {"Daisy", "Flower", "Iris", "Jasmine", "Lavender", "Marigold", "Nasturtium", "Orchid", "Rose", "Sunflower", "Violet", "Xeranthemum", "Yarrow", "Zinnia", "Edelweiss", "Yellow Bell"}
GARDEN_FOOD = {"Apple", "Bean", "Carrot", "Eggplant", "Kale", "Nectarine", "Onion", "Pea", "Quince", "Radish", "Tomato", "Yam", "Zucchini", "Nopales", "Prickly Pear"}
GREEN_PLANTS = {"Fern", "Grass", "Ivy", "Underbrush", "Upland Fern", "Vine", "Jungle Vine", "Liana", "Rattan", "Umbrella Leaf", "Water Vine", "Zingiber Plant", "Agave", "Cactus", "Euphorbia", "Tumbleweed", "Umbrella Thorn", "Xeric Shrub", "Xerophyte", "Xylem", "Yucca", "Ziziphus Shrub", "Upland Meadow"}

LAND_WATER = {"Dune", "Limestone", "Oasis", "Quartz", "Sand", "Wadi", "Floe", "Glacier", "Iceberg", "Tundra", "Boulder", "Cliff", "Icefall", "Kettle Lake", "Ledge", "Mountain", "Outcrop", "Ridge", "Snow", "Summit", "Trail", "Valley", "Waterfall", "Xenolith", "Zigzag Trail", "River"}

WEATHER = {"Breeze", "Cloud", "Dew", "Drizzle", "Fog", "Frost", "Gust", "Hail", "Ice", "Icicle", "Lightning", "Low Cloud", "Mist", "Night Sky", "Puddle", "Rainbow", "Snowflake", "Sun", "Thunder", "Wind", "X-shaped Snowflake", "Yellow Sun"}


def _article(obj: str) -> str:
    return "An" if obj[:1].lower() in "aeiou" else "A"


def object_craft(song_id: str, obj: str) -> tuple[str, str] | None:
    domain = domain_for_song(song_id)
    if domain is None:
        return None
    if obj in SPECIAL_FACTS:
        fact = SPECIAL_FACTS[obj]
    elif obj in COMMON_FACTS:
        fact = COMMON_FACTS[obj]
    elif obj in BIRDS:
        fact = f"{_article(obj)} {obj.lower()} is a bird with feathers, wings, and a beak; it moves through its habitat by walking, hopping, swimming, or flying."
    elif obj in HOOFED_ANIMALS:
        fact = f"{_article(obj)} {obj.lower()} has sturdy legs and hooves and moves around on land."
    elif obj in SMALL_MAMMALS:
        fact = f"{_article(obj)} {obj.lower()} is a small mammal that moves close to the ground and searches its habitat for food or shelter."
    elif obj in PREDATOR_MAMMALS:
        fact = f"{_article(obj)} {obj.lower()} is a furry mammal that walks quietly and uses keen senses to explore its habitat."
    elif obj in PRIMATES:
        fact = f"{_article(obj)} {obj.lower()} is a primate that uses grasping hands to climb, hold, or move through its habitat."
    elif obj in REPTILES:
        fact = f"{_article(obj)} {obj.lower()} is a reptile with scales that moves close to the ground or through branches."
    elif obj in INSECTS:
        if obj in {"Earthworm"}:
            fact = "An earthworm has a long soft body and tunnels through moist soil."
        elif "Butterfly" in obj or "Swallowtail" in obj or "Longwing" in obj:
            fact = f"{_article(obj)} {obj.lower()} is a butterfly with broad patterned wings that visits plants and flowers."
        else:
            fact = f"{_article(obj)} {obj.lower()} is a small creature that can be noticed by its legs, body shape, or movement."
    elif obj in MARINE:
        fact = f"{_article(obj)} {obj.lower()} lives in cold water and moves by swimming, drifting, or diving."
    elif obj in TREES:
        fact = f"{obj} is a woody plant with a trunk or strong stems and a crown of leaves or needles."
    elif obj in FLOWERS:
        fact = f"{obj} is a flowering plant whose bloom gives the garden or meadow a clear shape and color."
    elif obj in GARDEN_FOOD:
        fact = f"{obj} is a plant food that grows from a crop, vine, shrub, or tree before it is picked."
    elif obj in GREEN_PLANTS:
        fact = f"{obj} is a plant adapted to its habitat, using leaves, stems, roots, or climbing growth to reach water and light."
    elif obj in LAND_WATER:
        fact = {
            "Dune": "A dune is a hill or ridge of sand shaped by wind.",
            "Limestone": "Limestone is a pale sedimentary rock often formed from calcium-rich material.",
            "Oasis": "An oasis is a place in a dry region where water supports plants and animals.",
            "Quartz": "Quartz is a hard mineral that can sparkle with a glassy surface.",
            "Sand": "Sand is made of many tiny grains of rock or mineral.",
            "Wadi": "A wadi is a dry valley or channel that can carry water after rain.",
            "Floe": "An ice floe is a flat piece of sea ice floating on water.",
            "Glacier": "A glacier is a huge mass of ice that slowly flows over land.",
            "Iceberg": "An iceberg is a large floating piece of ice broken from a glacier or ice shelf.",
            "Tundra": "Tundra is cold open land where trees are scarce and low plants grow.",
            "Boulder": "A boulder is a very large rounded or broken piece of rock.",
            "Cliff": "A cliff is a steep face of rock or earth; we view it from a safe place.",
            "Icefall": "An icefall is a steep broken section of a glacier.",
            "Kettle Lake": "A kettle lake sits in a hollow left by an old block of glacier ice.",
            "Ledge": "A ledge is a narrow shelf of rock; we only observe it from a safe place.",
            "Mountain": "A mountain rises high above the land around it.",
            "Outcrop": "An outcrop is exposed solid rock visible at the ground surface.",
            "Ridge": "A ridge is a long narrow line of high ground.",
            "Snow": "Snow is made of ice crystals that fall from clouds when the air is cold enough.",
            "Summit": "A summit is the highest point of a hill or mountain.",
            "Trail": "A trail is a path people follow through outdoor places.",
            "Valley": "A valley is low land between hills or mountains.",
            "Waterfall": "A waterfall is water dropping over a steep edge of rock.",
            "Zigzag Trail": "A zigzag trail bends back and forth across a slope.",
            "River": "A river is flowing water moving through a channel toward a lake, sea, or another river.",
        }[obj]
    elif obj in WEATHER:
        fact = {
            "Breeze": "A breeze is a light wind you may feel moving across your skin or leaves.",
            "Cloud": "A cloud is a visible collection of tiny water droplets or ice crystals in the air.",
            "Dew": "Dew is water that forms as tiny drops on cool surfaces.",
            "Drizzle": "Drizzle is very light rain made of small drops.",
            "Fog": "Fog is a cloud close to the ground that makes distant things harder to see.",
            "Frost": "Frost is a thin layer of ice crystals that can form on cold surfaces.",
            "Gust": "A gust is a short, stronger burst of wind.",
            "Hail": "Hail is made of balls or lumps of ice that fall from storm clouds.",
            "Ice": "Ice is water that has frozen solid.",
            "Icicle": "An icicle is a hanging piece of ice formed when dripping water freezes.",
            "Lightning": "Lightning is a bright electrical flash in a storm; we watch storms safely from indoors.",
            "Low Cloud": "A low cloud forms close to the ground compared with higher cloud layers.",
            "Mist": "Mist is made of tiny water droplets floating in the air near the ground.",
            "Night Sky": "The night sky is the dark sky we see after sunset, often with stars or the moon.",
            "Puddle": "A puddle is a small shallow pool of water on the ground.",
            "Rainbow": "A rainbow appears when light is separated into colors by water droplets in the air.",
            "Snowflake": "A snowflake is an ice crystal with a branching six-sided pattern.",
            "Sun": "The Sun is the star that gives Earth daylight and warmth.",
            "Thunder": "Thunder is the sound made by air rapidly expanding around lightning.",
            "Wind": "Wind is air moving from one place to another.",
            "Yellow Sun": "The Sun often looks yellow in simple pictures, though its light contains many colors.",
        }[obj]
    else:
        fact = _fallback_fact(domain, obj)

    return fact, _action_for(domain, obj)


def _fallback_fact(domain: str, obj: str) -> str:
    # These fallbacks are deliberately concrete enough to be useful but modest
    # enough not to invent a specialized fact when the object name is unusual.
    if obj.endswith(" Tree"):
        return f"{obj} is a tree with woody branches and leaves adapted to its habitat."
    if obj.endswith(" Plant") or obj.endswith(" Shrub"):
        return f"{obj} is a plant whose leaves, stems, or flowers help it live in this habitat."
    if obj.endswith(" Flower"):
        return f"{obj} is a flowering plant with a visible bloom that can be recognized by shape and color."
    if domain == "farm":
        return f"{obj} is part of farm life, where animals, crops, food, buildings, and useful equipment share the work of the day."
    if domain == "garden":
        return f"{obj} belongs in a garden scene and can be recognized by its shape, material, color, or job around plants."
    if domain == "forest":
        return f"{obj} belongs in a woodland scene and can be noticed by its shape, texture, movement, or place among the trees."
    if domain == "rainforest":
        return f"{obj} belongs in a tropical rainforest scene, among layered plants, water, branches, and wildlife."
    if domain == "desert":
        return f"{obj} belongs in a dry-land scene and is adapted to, used in, or found around heat, rock, sand, or scarce water."
    if domain == "polar":
        return f"{obj} belongs in a cold-climate scene and can be recognized by its shape, movement, or connection to snow, ice, sea, or tundra."
    if domain == "mountain":
        return f"{obj} belongs in a mountain scene and can be recognized by its shape, movement, or place along slopes and trails."
    return f"{obj} belongs in a weather scene and helps us notice, measure, describe, or prepare for changing conditions."


def _action_for(domain: str, obj: str) -> str:
    if obj in COMMON_ACTIONS:
        return COMMON_ACTIONS[obj]
    lower = obj.lower()
    if any(word in lower for word in ("pitchfork", "hoe", "rake", "trowel", "pump", "tractor", "cart", "x-ray", "radar", "thermometer", "gauge", "meter")):
        return "Point to the picture and name its job."
    if obj in BIRDS:
        return "Lift two gentle wings, then hold still."
    if obj in HOOFED_ANIMALS:
        return "Tap two quiet hoof-beats with your fingers."
    if obj in SMALL_MAMMALS:
        return "Make two tiny walking or hopping finger-steps."
    if obj in PREDATOR_MAMMALS:
        return "Make two quiet paw-steps."
    if obj in PRIMATES:
        return "Reach one hand up like a gentle climber."
    if obj in REPTILES:
        return "Trace one slow curving path with a finger."
    if obj in INSECTS:
        return "Wiggle tiny fingers or make a small flutter."
    if obj in MARINE:
        return "Glide one hand gently like a swimmer."
    if obj in TREES:
        return "Reach both hands up like branches."
    if obj in FLOWERS:
        return "Open both hands like a flower."
    if obj in GARDEN_FOOD:
        return "Pretend to pick it gently, then show the picture."
    if obj in GREEN_PLANTS:
        return "Grow one hand upward, then sway."
    if obj in LAND_WATER:
        if obj in {"Cliff", "Ledge", "Icefall", "Summit"}:
            return "Trace its shape in the air from a safe viewing spot."
        if obj in {"River", "Waterfall"}:
            return "Move one hand like flowing water."
        return "Trace the land or ice shape in the air."
    if obj in WEATHER:
        weather_actions = {
            "Breeze": "Wave one hand softly like a light wind.", "Cloud": "Make a soft cloud shape with both hands.",
            "Dew": "Tap tiny fingertip drops.", "Drizzle": "Tap light raindrops with fingertips.", "Fog": "Spread hands softly like a low cloud.",
            "Frost": "Sparkle fingertips over an imaginary cold window.", "Gust": "Make one quick whoosh with your hand.", "Hail": "Tap two quiet ice-drop beats.",
            "Ice": "Hold palms still and flat like frozen water.", "Icicle": "Point one finger downward like an icicle.", "Lightning": "Trace one zigzag flash, then hands still.",
            "Low Cloud": "Float both hands low and slowly.", "Mist": "Wiggle soft fingers close to the ground.", "Night Sky": "Make a wide sky arc with both hands.",
            "Puddle": "Make a small flat circle with both hands.", "Rainbow": "Draw a big gentle arch in the air.", "Snowflake": "Open six fingers like branching snowflake arms.",
            "Sun": "Make a round sun with both hands.", "Thunder": "Tap one soft drum-beat on your knees.", "Wind": "Sweep one hand smoothly sideways.", "Yellow Sun": "Make a round sun and lift it high.",
        }
        return weather_actions.get(obj, "Show the weather motion with one gentle hand gesture.")
    if domain == "weather" and any(word in lower for word in ("coat", "boot", "jacket", "earmuff", "mittens", "raincoat", "umbrella", "quilt", "zipper")):
        return "Point to the clothing picture and mime getting ready."
    return "Point to the matching picture, then make one small shape gesture."


SPECIAL_RHYMES: dict[str, str] = {
    "Ant": "Ant in the ground | six tiny legs move all around",
    "Cow": "Cow says moo | slow farm steps come into view",
    "Donkey": "Ears up high | steady hooves go walking by",
    "Egg": "Egg in the nest | oval shell at rest",
    "Hay": "Hay in a stack | dry golden stems piled at the back",
    "Lamb": "Lamb on the land | little hooves beside the hand",
    "Pig": "Pig, little dig | snout near the ground, body round and big",
    "Rooster": "Rooster at dawn | bright comb up when night is gone",
    "Tractor": "Roll down the row | tractor wheels go slow, slow, slow",
    "Wagon": "Wagon on the way | four wheels carry things today",
    "Bean": "Bean starts small | climbing stem can grow up tall",
    "Carrot": "Carrot down low | leafy top above where orange roots grow",
    "Daisy": "Daisy in the day | white petals round a center like a ray",
    "Flower": "Bloom in view | petals open fresh with dew",
    "Ivy": "Climb and wind | ivy leaves trail close behind",
    "Rose": "Rose in a row | layered petals open as they grow",
    "Seed": "Seed down deep | tiny start that soil can keep",
    "Sunflower": "Face the light | tall stem, yellow petals bright",
    "Tomato": "Red in a row | tomato fruit on green stems grow",
    "Worm": "Wiggle through earth | soft soil tunnel from the dirt",
    "Fox": "Fox steps light | quiet paws move out of sight",
    "Owl": "Owl in the night | round eyes watching, wings in flight",
    "Rabbit": "Hop, then stop | rabbit feet go hop-hop-hop",
    "Squirrel": "Tail in a curl | quick little feet around the tree whirl",
    "Woodpecker": "Tap-tap tree | woodpecker searches bark carefully",
    "Macaw": "Bright in flight | broad wings flash with color and light",
    "Monkey": "Swing and cling | grasping hands hold everything",
    "Sloth": "Slow as we go | sloth hangs gently, moving low",
    "Toucan": "Bill so bright | toucan perches in the light",
    "Agave": "Spikes in a ring | thick desert leaves spread from the spring",
    "Cactus": "Spines in the sun | cactus stores water when rain is done",
    "Dune": "Dune by noon | wind shapes sand beneath the moon",
    "Fox": "Fox steps light | quiet paws move out of sight",
    "Oasis": "Shade by the blue | oasis water brings green plants into view",
    "Roadrunner": "Run in the sun | roadrunner legs go quick for fun",
    "Tortoise": "Slow on the go | hard shell travels down low",
    "Arctic Fox": "White in the light | thick fur warm in Arctic white",
    "Floe": "Ice afloat | flat floe drifting like a frozen boat",
    "Glacier": "Ice moves slow | glacier creeping down below",
    "Iceberg": "Iceberg bright | most stays hidden out of sight",
    "Narwhal": "Tusk in the blue | narwhal rises into view",
    "Puffin": "Puffin on stone | bright bill, black-and-white coat shown",
    "Seal": "Slide and glide | flippers sweep from side to side",
    "Walrus": "Tusks in view | whiskered walrus in the blue",
    "Boulder": "Round and sound | heavy rock sits on the ground",
    "Cliff": "Cliff rises high | steep rock face against the sky",
    "Mountain": "Mountain high | rocky slopes climb toward the sky",
    "Ridge": "Ridge in a line | high ground running like a spine",
    "Trail": "Trail bends round | little path across the ground",
    "Valley": "Valley down low | land between the hills where waters flow",
    "Waterfall": "Water falls tall | rushing sheet beside the wall",
    "Breeze": "Breeze through trees | light wind moving leaves with ease",
    "Cloud": "Cloud up high | tiny drops are floating in the sky",
    "Drizzle": "Drip little, light | tiny rain falls soft and slight",
    "Fog": "Fog down low | ground-level cloud makes far things slow to show",
    "Gust": "Gust goes rush | quick strong wind, then back to hush",
    "Hail": "Ice from the sky | little frozen pieces falling by",
    "Mist": "Mist near ground | tiny floating droplets all around",
    "Rainbow": "Arc after rain | colors spread across the sky again",
    "Snowflake": "Branching white | six-sided crystal, tiny and light",
    "Wind": "Whoosh and bend | moving air from end to end",
    "Zephyr": "Soft and light | zephyr breeze barely moves the night",
    "Anemometer": "Spin in the breeze | wind-speed readings come with ease",
    "Altocumulus": "Cloudlets in rows | middle-sky patches where the wind blows",
    "Coat": "Coat wrapped round | warm outer layer when cold comes down",
    "Earmuffs": "Ears tucked warm | padded cups for winter storm",
    "Eye of Storm": "Calm at the core | storm winds circle round once more",
    "Ice": "Cold and bright | frozen water catches light",
    "Icicle": "Drip then freeze | hanging ice grows in the breeze",
    "Kelvin Thermometer": "Kelvin scale | temperature numbers tell the tale",
    "Mittens": "Hands tucked in | fingers share the warmth within",
    "Overcast Sky": "Clouds spread wide | one gray layer side to side",
    "Overcoat": "Long coat on | extra warmth when cold comes on",
    "Quilt": "Stitch by stitch | warm layered fabric, soft and rich",
    "Sun": "Sun up high | daylight warms us from the sky",
    "Umbrella": "Open it wide | raindrops slide from side to side",
    "Updraft": "Air goes high | rising current climbs the sky",
    "Windsock": "Fill and fly | wind direction meets our eye",
    "Yellow Sun": "Picture sun high | bright yellow circle in the sky",
    "Yellow Rain Boots": "Boots in the rain | waterproof steps through puddles again",
    "Xanthid Crab": "Shore rock, tide pool | little crab moves where the water is cool",
    "X-ray Tetra": "Silver fish | clear little body flashes as it swims",
    "Quillwort": "Quill leaves | freshwater plant grows where the water gently weaves",
    "X-shaped Snowflake": "Branches meet | icy arms make an X so neat",
    "Xenolith": "Stone inside | one rock fragment held where layers hide",
    "Xylem": "Water climbs | tiny plant tubes carry it up in lines",
}


def rhyme_phraselet(song_id: str, obj: str, ordinal: int) -> str | None:
    if obj in SPECIAL_RHYMES:
        return SPECIAL_RHYMES[obj]
    domain = domain_for_song(song_id)
    if domain is None:
        return None
    # Category rhymes are rotated by ordinal so a song does not repeat one tail.
    if obj in FLOWERS:
        return ("Bloom in view | petals open fresh with dew", "Petals bright | flower colors catch the light", "Bloom and show | little petals open as they grow")[ordinal % 3]
    if obj in TREES:
        return ("Roots down low | branches reach and grow", "Trunk stands strong | leaves or needles spread along", "Tree to sky | branches lift up high")[ordinal % 3]
    if obj in BIRDS:
        return ("Wing to sky | feathered bird goes gliding by", "Feather light | beak and wings come into sight", "Perch, then fly | quick wingbeats cross the sky")[ordinal % 3]
    if obj in HOOFED_ANIMALS:
        return ("Hooves on ground | steady little steps go round", "Step by step | sturdy legs keep moving yet", "Hooves go slow | sure-foot steps along below")[ordinal % 3]
    if obj in SMALL_MAMMALS:
        return ("Small and quick | little feet go tick-tick-tick", "Near the ground | tiny footsteps move around", "Hop or hide | little mammal moves outside")[ordinal % 3]
    if obj in GREEN_PLANTS:
        return ("Root down low | leaves reach up and grow", "Leaf in light | green stems stretch up bright", "Sway and grow | plant finds light from down below")[ordinal % 3]
    if obj in MARINE:
        return ("Cold blue sea | swim or drift so easily", "Dive and glide | cold-water life moves side to side", "Blue below | ocean swimmer on the go")[ordinal % 3]
    if obj in WEATHER:
        return SPECIAL_RHYMES.get(obj)
    return None
