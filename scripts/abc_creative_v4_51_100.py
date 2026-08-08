from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any
import json

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "abc-song"


DOMAIN_BLOCKS: tuple[tuple[range, str], ...] = (
    (range(51, 56), "space"),
    (range(56, 61), "dinosaur"),
    (range(61, 66), "insect"),
    (range(66, 71), "bird"),
    (range(71, 76), "pet"),
    (range(76, 81), "wildlife"),
    (range(81, 86), "herp"),
    (range(86, 91), "kitchen"),
    (range(91, 96), "produce"),
    (range(96, 101), "bakery"),
)


def domain_for_song(song_id: str) -> str | None:
    try:
        number = int(song_id)
    except ValueError:
        return None
    for block, domain in DOMAIN_BLOCKS:
        if number in block:
            return domain
    return None


@lru_cache(maxsize=64)
def mapping_for_song(song_id: str) -> dict[str, Any] | None:
    if domain_for_song(song_id) is None:
        return None
    path = CATALOG / song_id / "authoring" / "mapping.json"
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


# Every five-song domain block rotates through five genuinely different openings.
# The opening is a musical event, image or character action rather than a generic
# "come learn the alphabet" invitation.
OPENING_BANK: dict[str, tuple[tuple[str, str, str], ...]] = {
    "space": (
        ("countdown-cold-open", "Three, two, one—letters, lift off!", "A to Z is riding with us past the moon."),
        ("starlight-whisper", "Shh... a star just blinked our first clue.", "Catch the letter, catch the word, then send it into orbit."),
        ("mission-control-call", "Mission Control says: alphabet crew, ready?", "Tap the beat—every letter opens one space window."),
        ("zero-gravity-vocal-play", "A-a-a... float it up!", "Letters bounce like moon dust—catch each word before it drifts."),
        ("telescope-reveal", "Telescope up—what is glowing in the dark?", "One bright clue at a time, from A all the way to Z."),
    ),
    "dinosaur": (
        ("footprint-stomp", "Boom... boom... whose giant footprints cross the beat?", "Step into the past—A to Z is hiding on the trail."),
        ("fossil-brush-whisper", "Brush, brush—something old is showing through the stone.", "Name the letter, name the clue, build the past bone by bone."),
        ("museum-after-dark", "Click—the museum lights glow low.", "Every letter wakes one prehistoric picture in the row."),
        ("roar-echo", "Roaaar... echo it tiny, echo it tall!", "Letters stomp in with creatures big and small."),
        ("time-machine-start", "Tick-tock, lights flash—time machine on!", "A to Z, we are visiting a world long gone."),
    ),
    "insect": (
        ("garden-buzz", "Bzz-bzz... something tiny zipped past the flowers!", "Follow the little wings and feet from A to Z."),
        ("magnifying-glass-reveal", "Magnifying glass down—look at that tiny world.", "One letter, one creature, one close-up clue at a time."),
        ("flutter-tap-groove", "Flutter, tap, wiggle—who is moving in the leaves?", "Catch the letter on the beat, then catch the tiny name."),
        ("dew-drop-morning", "Ding—a dew drop shakes on the garden leaf.", "Morning bugs are waking, and the alphabet is underneath."),
        ("mini-parade", "Tiny feet, tiny wings—parade line ready!", "A to Z will march, hop, crawl, and flutter by."),
    ),
    "bird": (
        ("dawn-chorus", "Tweet-tweet... morning has a melody.", "Follow every feathered clue from A to Z."),
        ("binocular-reveal", "Binoculars up—something just crossed the sky!", "Spot the letter, name the bird, then let the wingbeat reply."),
        ("feather-fall", "A feather spins down—slow, slow, slow.", "Which bird left our next alphabet clue below?"),
        ("nest-rhythm", "Tap-tap, twig-twig—build a little nest beat.", "Bird names fly in where letters and wingbeats meet."),
        ("call-and-echo-sky", "A bird calls once; the hill sends the sound back.", "We answer with a letter and the bird name on its track."),
    ),
    "pet": (
        ("collar-jingle", "Jingle-jingle—someone is ready to play.", "Pet words and care clues are padding in from A to Z."),
        ("quiet-care-morning", "Soft paws, fresh water, a calm hello.", "One caring picture at a time—watch the alphabet grow."),
        ("toy-bounce", "Bounce... roll... stop! Which pet toy found the beat?", "Letters, pets, and care-time clues are waiting at our feet."),
        ("home-pet-soundscape", "Purr, chirp, splash—our little home is awake.", "A to Z brings one pet-picture clue for us to name."),
        ("pet-shop-window", "The picture window opens—who is peeking through?", "Find the letter, find the pet-care word, then show what it can do."),
    ),
    "wildlife": (
        ("zoo-gate-open", "Clack—the picture gates swing open wide.", "A to Z has animal tracks waiting on the other side."),
        ("safari-footprint", "One print in the dust... then two... then three.", "Follow the tracks and call the wildlife words with me."),
        ("habitat-window", "Forest, grassland, water, stone—four windows glow.", "Each letter finds an animal and a place it may know."),
        ("wild-drum-pulse", "Boom-ba, boom-ba—soft safari drum.", "Listen for the letter first; then let the animal come."),
        ("ranger-binocular", "Ranger eyes ready—look far, never chase.", "A to Z brings wildlife safely into our picture space."),
    ),
    "herp": (
        ("pond-plop", "Plop! One ripple spreads across the pond.", "Frogs, scales, shells, and letters answer from beyond."),
        ("safe-hiss-rhythm", "Sss-soft, sss-slow—only a picture-snake sound.", "Name the letter, name the creature, keep our feet on safe ground."),
        ("rainy-log-reveal", "Rain taps the log—something small peeks out.", "A to Z brings amphibian and reptile clues about."),
        ("scale-pattern", "Spot, stripe, scale, shine—patterns on parade.", "Follow the letter clue and name the creature that was made."),
        ("pond-to-rock-journey", "From cool pond water to a sunny rock picture—go!", "A to Z will show who swims, crawls, hops, or moves low."),
    ),
    "kitchen": (
        ("tabletop-percussion", "Tap the table: one-two—kitchen picture beat!", "We name the safe picture clues; real hot and sharp tools stay with grown-ups."),
        ("cupboard-picture-reveal", "Click—the picture cupboard opens, one shelf at a time.", "Find the letter, name the food or tool, and land it on the rhyme."),
        ("breakfast-sound", "Crunch, clink, pour—make the sounds with empty hands.", "A to Z brings kitchen words in little music bands."),
        ("chef-hat-imagination", "Pretend chef hat on—no cooking, just a picture-word game!", "Letters call; foods and kitchen objects answer with a name."),
        ("recipe-card-without-recipe", "No recipe today—just shapes, sounds, and names.", "A to Z turns kitchen pictures into alphabet games."),
    ),
    "produce": (
        ("rainbow-basket", "Red, green, gold—our basket woke up bright!", "A to Z brings produce shapes and colors into sight."),
        ("garden-to-market", "From garden row to market basket—follow the little beat.", "Every letter finds a produce word, earthy, crisp, or sweet."),
        ("color-call", "I call a letter; the basket answers with color.", "Look at shape, look at skin, then name the produce together."),
        ("market-morning", "Morning baskets line up—round, long, leafy, small.", "A to Z will help us notice and name them all."),
        ("seed-to-basket-story", "Tiny seed, leafy plant, harvest picture—turn the page.", "Letters bring the produce names onto our little stage."),
    ),
    "bakery": (
        ("bakery-window-morning", "Morning light lands on the bakery picture window.", "A to Z brings shapes, swirls, crumbs, and names into the glow."),
        ("dough-rhythm-pretend", "Pat-pat, roll-roll—with empty hands on the beat.", "Letters rise like pretend dough and meet a bakery treat."),
        ("cake-cookie-clap", "Clap-clap... stop! A bakery picture pops up.", "Name the letter, name the treat, then leave a little rhythm cup."),
        ("sweet-shop-walk", "Step past the picture case—no signs, just shapes to see.", "Every shelf gives one new clue from A through Z."),
        ("baking-day-story", "Ding goes the storybook timer—our picture baking day begins.", "A to Z comes rolling in with breads, cakes, and swirls."),
    ),
}


HOOK_BANK: dict[str, tuple[tuple[str, str], ...]] = {
    "space": (
        ("A-B-C, ignite the light!", "Name the space clue—send it bright!"),
        ("Star by star, A-B-C!", "Catch the word and orbit with me!"),
        ("Letter crew, call it clear!", "Space-word answer, loud and near!"),
        ("Float the letter, land the name!", "A to Z, our cosmic game!"),
        ("Look up high, then name what you see!", "Sky-full words from A to Z!"),
    ),
    "dinosaur": (
        ("Stomp the letter, name the clue!", "A to Z, the past comes through!"),
        ("Brush the stone, let the old clue show!", "Letter, fossil, name it—go!"),
        ("Museum lights, glow with me!", "Prehistoric words from A to Z!"),
        ("Roar it soft, then say it clear!", "Letter first, old creature near!"),
        ("Back in time, one-two-three!", "Name the past from A to Z!"),
    ),
    "insect": (
        ("Tiny wings, tiny feet—A-B-C!", "Find the little name with me!"),
        ("Look up close, what can you see?", "Mini-world words from A to Z!"),
        ("Flutter, crawl, land on the beat!", "Letter and creature finally meet!"),
        ("Garden morning—buzz with me!", "Little-life words from A to Z!"),
        ("Small parade, big melody!", "Name each tiny clue with me!"),
    ),
    "bird": (
        ("Wingbeat, word beat—A-B-C!", "Name the bird you spot with me!"),
        ("Spot the feather, say it clear!", "Letter and bird are landing here!"),
        ("Feather down, bird name high!", "A to Z across the sky!"),
        ("Twig by twig, beat by beat!", "Bird and letter finally meet!"),
        ("Call it once, echo it free!", "Bird-name chorus, A to Z!"),
    ),
    "pet": (
        ("Kind hands, clear words—A-B-C!", "Pet-care pictures, name with me!"),
        ("Care, share, look and see!", "Pet-home words from A to Z!"),
        ("Roll the toy, stop on the beat!", "Letter and pet word finally meet!"),
        ("Purr, chirp, splash—A-B-C!", "Home-pet words, come sing with me!"),
        ("Window clue, what can it be?", "Pet-shop words from A to Z!"),
    ),
    "wildlife": (
        ("Track the letter, name the beast!", "A to Z, from west to east!"),
        ("Footprint clue, what do you see?", "Wildlife words from A to Z!"),
        ("Habitat, animal—match the two!", "Letter first, then name the clue!"),
        ("Soft drum, clear name—one-two-three!", "Wild-world chorus, A to Z!"),
        ("Look from here, let wildlife be!", "Name the picture, A to Z!"),
    ),
    "herp": (
        ("Hop, crawl, glide—A-B-C!", "Name the creature safely with me!"),
        ("Soft hiss, clear word—one-two-three!", "Picture-creature, A to Z!"),
        ("Pond and log, what do you see?", "Creature clues from A to Z!"),
        ("Spot the pattern, say the name!", "Letter and creature join the game!"),
        ("Pond to rock, low and slow!", "A to Z—name as we go!"),
    ),
    "kitchen": (
        ("Picture first, safe hands—A-B-C!", "Kitchen words, come name with me!"),
        ("Shelf by shelf, what can you see?", "Kitchen-picture A to Z!"),
        ("Clink in the song, not in our hands!", "Name the kitchen picture bands!"),
        ("Pretend-chef beat, one-two-three!", "Food and tool words, A to Z!"),
        ("Shape, sound, name—A-B-C!", "Kitchen-word game, sing with me!"),
    ),
    "produce": (
        ("Color and shape—A-B-C!", "Produce rainbow, sing with me!"),
        ("Garden to basket, one-two-three!", "Name the produce A to Z!"),
        ("Letter calls, color replies!", "Name the produce with your eyes!"),
        ("Round or leafy, long or small!", "A to Z—we name them all!"),
        ("Seed to basket, page by page!", "Produce words step on the stage!"),
    ),
    "bakery": (
        ("Shape and swirl—A-B-C!", "Bakery pictures, name with me!"),
        ("Pat the beat, let the letter rise!", "Name the baked clue with your eyes!"),
        ("Clap, then stop—what can it be?", "Bakery words from A to Z!"),
        ("Picture case, row by row!", "Name the treat and let it go!"),
        ("Storybook baking—one-two-three!", "Bread and cake words, A to Z!"),
    ),
}


DOMAIN_SCENES = {
    "space": "past the quiet stars",
    "dinosaur": "along the prehistoric trail",
    "insect": "under the garden leaves",
    "bird": "across the open sky",
    "pet": "around our calm pet-care room",
    "wildlife": "across the habitat trail",
    "herp": "between pond, log, and sunny rock pictures",
    "kitchen": "across the safe kitchen-picture table",
    "produce": "through the garden and market baskets",
    "bakery": "along the storybook bakery window",
}

VARIANT_SCENES = {
    "space": (
        "through the launch-window glow",
        "under slow-turning starlight",
        "across the Mission Control screens",
        "inside our soft moon-dust drift",
        "beneath the observatory dome",
    ),
    "dinosaur": (
        "along the footprint trail",
        "inside the fossil dig",
        "between the museum exhibits",
        "across the echoing prehistoric valley",
        "through the time-machine window",
    ),
    "insect": (
        "between flower stems",
        "under the magnifying-glass circle",
        "across the flutter-and-tap garden",
        "through the dew-bright leaves",
        "along the tiny-creature parade",
    ),
    "bird": (
        "through the dawn branches",
        "inside the binocular circle",
        "beneath the falling feather",
        "around the nest-building tree",
        "across the echoing birdwatch trail",
    ),
    "pet": (
        "through the calm care routine",
        "around the cozy pet-home morning",
        "across the toy-and-play corner",
        "inside the gentle small-friends room",
        "along the pet-shop picture window",
    ),
    "wildlife": (
        "between the zoo habitat windows",
        "along the dust-and-footprint trail",
        "across forest, grassland, water, and stone",
        "beside the soft field-note drum",
        "through the ranger binocular view",
    ),
    "herp": (
        "between pond ripple and sunny stone",
        "inside the safe picture-reptile gallery",
        "beneath the rain-dark log",
        "across the scale-and-pattern wall",
        "from cool pond edge to warm exhibit rock",
    ),
    "kitchen": (
        "across the tabletop picture beat",
        "inside the open picture cupboard",
        "through the crunch-clink snack scene",
        "around the pretend-chef picture table",
        "across the shape-sound kitchen cards",
    ),
    "produce": (
        "inside the rainbow market basket",
        "from garden row to market crate",
        "across the color-call produce stall",
        "between the morning market baskets",
        "through the seed-to-harvest picture book",
    ),
    "bakery": (
        "along the morning bakery display",
        "across the pretend dough-shape table",
        "inside the clap-and-reveal pastry case",
        "along the quiet picture-shop shelves",
        "through the storybook baking-day window",
    ),
}

SPACE_SIGNATURES = (
    "a glockenspiel star-ping plus one soft countdown tom after each target",
    "a two-note celesta orbit figure with brushed shaker answering only after the target",
    "a dry mission-control click or light tom punctuation after each confirmed target",
    "a soft celesta shimmer and tiny synth-air swell after the target, leaving the word itself dry and clear",
    "a pizzicato discovery pluck followed by a small telescope-like bell ping after selected targets",
)

DINO_SIGNATURES = (
    "a low soft tom footprint followed by one dry woodblock click",
    "a tiny brush-shaker sweep followed by a glockenspiel fossil sparkle",
    "a short museum-xylophone note and muted marimba step after the target",
    "a friendly low tom echo with a brief whistle answer, never a realistic roar",
    "a clock-like woodblock tick followed by a warm xylophone landing note",
)

INSECT_SIGNATURES = (
    "a tiny marimba hop and dry shaker tick after each target",
    "a close-up kalimba pluck with one soft bell sparkle after the target",
    "a clave tap followed by a short glockenspiel wing-answer",
    "a soft pizzicato tiptoe figure with a dew-drop bell ping",
    "a tiny parade snare-brush tap plus bright marimba step after the target",
)

BIRD_SIGNATURES = (
    "a light flute chirp and one warm ukulele wingbeat after the target",
    "a soft woodblock perch-click followed by a small glockenspiel feather answer",
    "a whistle hop and hand-clap stop after the target, with no bird sound covering diction",
    "a marimba twig-tap plus brushed-percussion nest answer after the target",
    "a pizzicato binocular-click followed by one clear bell note after the target",
)

PET_SIGNATURES = (
    "a soft marimba paw-step and one warm bell after the target",
    "a gentle acoustic-pluck plus glockenspiel water-drop answer",
    "a short clap-stop and marimba toy-bounce after the target",
    "a kalimba paw/chirp figure with one soft shaker breath",
    "a light woodblock browse-click and marimba confirmation after the target",
)

WILDLIFE_SIGNATURES = (
    "a warm marimba footprint and soft hand-drum answer after the target",
    "a dry shaker track-step followed by one low marimba note",
    "a small habitat bell change plus muted drum footprint after the word",
    "a soft field-note drum tap with one short acoustic-pluck answer",
    "a binocular-click woodblock followed by a warm marimba confirmation",
)

HERP_SIGNATURES = (
    "a soft water-plop plus one dry woodblock scale-click after the target",
    "a muted shaker hiss-shape and marimba step after the word, never a realistic snake hiss bed",
    "a pizzicato raindrop figure followed by a tiny woodblock footstep",
    "a kalimba pattern-pluck plus soft bell glint after the target",
    "a museum woodblock click followed by one warm marimba exhibit note",
)

KITCHEN_SIGNATURES = (
    "a muted tabletop woodblock tap and marimba shape-note after the target",
    "a soft cupboard-click plus acoustic-pluck shelf answer after the word",
    "a dry clap-stop and tiny marimba crunch-shape answer, with no real utensil noise",
    "a warm guitar pluck plus soft hand-clap confirmation after the target",
    "a glockenspiel shape-ping followed by one muted woodblock answer",
)

PRODUCE_SIGNATURES = (
    "a bright marimba color-pluck and one ukulele basket-step after the target",
    "a soft acoustic garden-pluck followed by a woodblock harvest tap",
    "a marimba question-note and glockenspiel color-answer after the target",
    "a warm guitar pluck plus small market-bell confirmation",
    "a page-turn shaker sweep followed by one bright marimba harvest note",
)

BAKERY_SIGNATURES = (
    "a warm guitar crumb-pluck and glockenspiel display ping after the target",
    "a marimba dough-bounce followed by one soft ukulele shape answer",
    "a clap-stop followed by a tiny glockenspiel pastry-case sparkle",
    "a quiet acoustic shelf-pluck plus marimba confirmation",
    "a woodblock story-timer click followed by one warm guitar landing chord",
)

BAKERY_VARIANT_DIRECTIVES = (
    "Make 0096 a morning bakery-window noticing song: distinguish sponge, brownie, cupcake, laminated pastry, eclair, topping, bun, donut, macaron, layered pastry, cookie, pretzel, quiche, scone, tart, roll cake, waffle, and bread by visible construction rather than generic sweetness.",
    "Make 0097 a pretend dough-shape song, not a real baking lesson: pies show crust and filling, breads show crust/crumb or roll scoring, pastries show layers/folds, cakes show sponge/layer/fruit patterns, and Ice Cream is explicitly a frozen dessert rather than a baked item.",
    "Make 0098 a clap-stop cakes-and-cookies game: use wrapper, ring, cookie disk, cross bun, tart shell, macaron sandwich, bread loaf, pretzel knot, cake layer, toast slice, waffle grid, yeast roll, and zebra-stripe clues. No commercial or sugary-sales language.",
    "Make 0099 a quiet picture-shop browse: every shelf item gets one construction clue—crust, filling, glaze, rolled shape, oat flecks, raisins, sprinkles, sponge layers, waffle grid, X-knot, or yule-log spiral—without inviting purchase or overeating.",
    "Make 0100 a storybook baking-day classification song: breads, cakes, cookies, pastries, toppings, pies/tarts, and frozen/non-baked items should sound like different visual families. Round 2 is quick shape recall only; no real oven, knife, mixer, or hot-pan instructions.",
)

PRODUCE_VARIANT_DIRECTIVES = (
    "Make 0091 a rainbow-basket noticing song: rotate among stone fruit, roots, leafy heads, peppers, melons, onion layers, grapes, and unusual tubers. Color is only one clue; shape, rind, leaves, pit, bunch, and layers matter too.",
    "Make 0092 a garden-to-market journey: underground roots/tubers feel grounded, leafy produce uses lighter upward phrases, fruits use round/long/segmented/rind clues, and pods or beans use narrow linear gestures. Keep Kiwi firmly a fruit, never the bird meaning.",
    "Make 0093 a color-call market game, but do not let every answer be only color. Use outer seeds, rough rind, fuzzy skin, pod ridges, leafy texture, citrus segments, or root shape as the second clue.",
    "Make 0094 a morning sorting song by visible form: round, long, leafy, layered, bumpy, clustered, striped, segmented, or underground. No health claims or nutrition lectures; the task is visual vocabulary.",
    "Make 0095 a seed-to-harvest picture story: distinguish what grows underground, on vines, on trees/shrubs, as leafy heads, or as pods/fruits. Round 2 becomes quick category-and-shape recall rather than repeated basket pantomime.",
)

KITCHEN_VARIANT_DIRECTIVES = (
    "Make 0086 a tabletop picture-beat song: foods use visual shape and texture; containers show cup/bowl/tray shapes; safe utensils show silhouette only; hot, sharp, or powered tools are point-only with empty-hand mime and an adult implied.",
    "Make 0087 a cupboard shelf-reveal song: each object should feel placed on a different shelf by job—wearing, holding, measuring, heating, mixing, serving, flavoring, or shaping. Never turn the sequence into real cooking instructions.",
    "Make 0088 a snack-and-sound picture song: foods get color, rind, grid, ring, strand, or texture motions, while Hot Pot, Knife, Pan, and other hazards interrupt the bounce with a quiet point-only cue.",
    "Make 0089 a pretend-chef word game rather than a recipe: powered and hot tools remain visual cards, while bowls, boards, ladles, spatulas, tongs, and foods get concise shape/job mimes with empty hands.",
    "Make 0090 a shape-sound classification song: emphasize oval Egg, tined Fork, citrus Lemon, looped Whisk, drawer rectangle, Xylophone bars, Yam tuber shape, and Zester texture. Keep the distinction between kitchen object and non-kitchen Xylophone explicit.",
)

HERP_VARIANT_DIRECTIVES = (
    "Make 0081 a pond-to-rock taxonomy song: contrast amphibian moist skin and external-gill/tail clues with reptile scales, shells, and armored skin. Round 2 visibly changes motion family when the animal group changes.",
    "Make 0082 a safe picture-snake and reptile game: cobra hood, rattlesnake tail, boa coil, turtle shell, chameleon head/tail, gecko toe pads, frog hop, and crocodilian armor should all sound and move differently. Dangerous animals stay picture-only.",
    "Make 0083 a rainy-log nature miniature: newts, salamanders, frogs, snakes, turtles, and lizards emerge as separate visual discoveries. Use softer textures for amphibians and drier plucks for scaled reptiles.",
    "Make 0084 a pattern-recognition song: emphasize stripes, spots, frills, horns, casques, shells, rough scales, and color-pattern clues without implying children should touch or handle any animal.",
    "Make 0085 a reptile-house museum walk: each target is an exhibit card with one precise body clue. Long or dangerous names get a calm point-and-name cue; no chase, handling, or close-approach language.",
)

WILDLIFE_VARIANT_DIRECTIVES = (
    "Make 0076 a zoo-picture habitat parade: each target gets one visible silhouette clue—trunk, horn, muzzle, mane, flipper, webbed foot, stripes, tail, or body posture. Safe observation is the frame; no chase, feeding, petting, or touching prompts.",
    "Make 0077 a footprint-safari memory song: tracks are only the entrance clue, then switch to species-specific ears, tail, horns, paws, bill, scales, flippers, or posture so the whole song does not become a footprint template.",
    "Make 0078 a habitat-matching song: explicitly contrast forest, grassland, water, rock, tree, and open-ground animals. The music may change small instrumental colors at habitat shifts, while target words stay dry and clear.",
    "Make 0079 a field-note nature song: organize chunks by changing body plans—hoofed, primate, cat/canid, marsupial, marine, bird, reptile/amphibian—so each section has a different physical vocabulary and motion contour.",
    "Make 0080 a ranger-binocular song: looking from a respectful distance is central. Use precise observation language and object-conditioned gestures, with a quieter cue for crocodile and other animals that should never be approached.",
)

PET_VARIANT_DIRECTIVES = (
    "Make 0071 a calm care-routine song: alternate animal identity with the real job of bowls, shelter, brush, leash, bed, lamp, harness, and carrier. Keep safety language brief; sharp, heated, medical, or powered items stay point-and-name only.",
    "Make 0072 a cozy home-pet morning: use water, habitat, rest, toileting, identification, play, and veterinary-picture clues. Round 2 should feel like matching each object to its job, not a generic pet-motion drill.",
    "Make 0073 a stop-and-go playtime song: toys get distinct roll, bounce, tug, scratch, wheel, perch, or yarn shapes; animals get species-congruent motion. Vet images and grooming tools interrupt the play groove with a quieter point-and-name cue.",
    "Make 0074 a gentle small-animal friendship song: calmer dynamics, clear care vocabulary, and contrast among fish, reptile, bird, rodent, rabbit, dog, housing, food, and enrichment. Avoid implying every toy fits every species.",
    "Make 0075 a browse-and-point pet-shop picture song: each target appears like a display card with one precise job or animal clue. Rare or potentially unsafe care equipment is visual-only and never turned into a child instruction.",
)

BIRD_VARIANT_DIRECTIVES = (
    "Make 0066 a dawn-chorus bird walk, not a generic flying song. Contrast waders, songbirds, climbers, and Kiwi; the hook must work for flightless birds too. Use bill, leg, foot, tail, perch, and habitat clues as often as wing clues.",
    "Make 0067 a binocular spotting song with a gentle folk sway. Long names get a clear pickup and extra bar space; water birds should feel grounded or wading, while Albatross and other soarers can open the melodic contour.",
    "Make 0068 a backyard hop-stop game: short target punches, perch/hop/climb gestures, and bright whistle answers. Kiwi and Ostrich remain grounded; Hummingbird gets a hovering gesture; Nuthatch gets a trunk-climb gesture.",
    "Make 0069 a nest-and-habitat song: twig percussion and gentle water pulse, with explicit contrast between nest object, wading birds, tree climbers, seed-billed birds, and aerial birds. Never describe Nest as a bird.",
    "Make 0070 a field-guide call-and-echo song: each rare name gets one useful visible clue, the echo remains short, and Round 2 should feel like quick binocular confirmations rather than repeated wing flaps.",
)

INSECT_VARIANT_DIRECTIVES = (
    "Make 0061 a bustling bug-garden bounce: quick but unhurried target punches, contrasting crawl/hop/fly gestures, and small sound-images such as buzz, chirp, wing flick, or glow only after the learning word.",
    "Make 0062 a magnifying-glass close-up song: slightly more space around each target, visual-detail language, and a light question-answer chorus. Non-insects in the locked mapping such as Orb Weaver or Pill Bug must be clearly identified without treating them as insects.",
    "Make 0063 a seek-and-find rhythm game: crisp clave gaps, tiny syncopated pickups, and object-specific motion answers. Let Cricket, Dragonfly, Firefly, Mantis, Leafhopper, and Weevil each have a recognizable movement or body clue.",
    "Make 0064 a dew-drop morning miniature: gentler dynamics, tiptoe phrasing, light pizzicato, and close visual clues. Alternate still/camouflage images with sudden hops or wing openings for contrast.",
    "Make 0065 a tiny-creature parade: each four-letter block should feel like a different parade unit—crawlers, hoppers, fliers, beetles—while the chorus becomes the marching reset. Keep rare labels deliberate and never rush them.",
)

DINO_VARIANT_DIRECTIVES = (
    "Make 0056 a footprint-stomp game: alternate heavy/light body percussion, keep the lead playful rather than fierce, and let the chorus reset the walking pulse. Use armor, horn, neck, claw, plate, crest, wing, nest, and fossil gestures instead of generic stomps whenever the object offers one.",
    "Make 0057 feel like a careful fossil dig: gentler tempo pocket, brush-and-reveal phrasing, more speech-like setup for long genus names, and small glockenspiel discoveries after target words. The chorus should feel like uncovering a clue, not a marching chant.",
    "Make 0058 a museum story-song: exhibit-to-exhibit walking rhythm, short scene-setting pickups, clear contrast between fossils/plants and living-animal reconstructions, and a chorus that opens like gallery lights turning on.",
    "Make 0059 a friendly roar-and-echo adventure: lead calls may be bold, child-facing echoes stay short, and the arrangement should contrast big-body dinosaurs with light bird-like or flying reptiles. Never put a roar over the target word.",
    "Make 0060 a time-machine museum march: clock/tick pickup, tidy exhibit pulse, long rare names receive extra bar space, and Round 2 feels like quick memory postcards from different prehistoric body plans rather than one repeated stomp pattern.",
)

SPACE_VARIANT_DIRECTIVES = (
    "Make 0051 feel like a launch sequence: firm downbeats, short countdown pickups, compact target punches, and brief rising transitions between chunks. The chorus is the ignition/reset hook; later repeats may add a small child echo on the last word, never a dense choir.",
    "Make 0052 feel like a slow orbit rather than a launch song: gentle 6/8 sway, soft pickup phrases, circular marimba/celesta motion, more air after long target names, and a chorus that feels like floating around one stable tonal center.",
    "Make 0053 a Mission-Control call-and-answer piece: speak-sing setups may be dry and rhythmic, target words land sung and clear, tom/countdown punctuation answers after the word, and Round 2 should feel like concise radio check-ins rather than the same orbit gesture repeated.",
    "Make 0054 a zero-gravity moon-drift song: lighter percussion, longer held space between phrases, occasional upward vocal pickup before the target, soft celesta answers, and a chorus that floats instead of punching. Keep the learning words crisp despite the dreamy texture.",
    "Make 0055 a curious observatory/science song: pizzicato discovery pulse, question-answer phrasing, brief speech-like support for Tier-C science terms, and small telescope-like instrumental reveals. Let the chorus feel like a discovery summary, not a launch chant.",
)

DOMAIN_POV = {
    "space": "curious child astronaut and calm mission guide",
    "dinosaur": "young time-traveler and museum guide",
    "insect": "tiny-world observer with a magnifying glass",
    "bird": "patient young birdwatcher",
    "pet": "gentle pet-care helper",
    "wildlife": "respectful wildlife observer",
    "herp": "safe pond-and-reptile-house observer",
    "kitchen": "picture-game learner with a supervising grown-up implied",
    "produce": "curious garden-and-market explorer",
    "bakery": "storybook bakery visitor using pretend motions only",
}

DOMAIN_ROUND1 = {
    "space": "Round 1 should feel like opening new spacecraft windows: vary direct calls, repeated letters, questions and short cinematic reveals; every target gets one real space clue or function.",
    "dinosaur": "Round 1 alternates stomp-sized short entries with longer fossil or body-shape clues; do not call every prehistoric animal a dinosaur when it is a pterosaur or marine reptile.",
    "insect": "Round 1 uses tiny rhythmic detail—wing, leg, body, web or life-stage clues—while preserving clear target diction.",
    "bird": "Round 1 uses birdwatching language—feather, beak, feet, perch, water or flight clues—and leaves long species names enough musical space.",
    "pet": "Round 1 alternates animal clues with care-item functions; care language stays gentle and never turns grooming or veterinary tools into child instructions.",
    "wildlife": "Round 1 gives one visible habitat or body clue per animal and frames wildlife as something to observe respectfully, never chase or touch.",
    "herp": "Round 1 distinguishes amphibians, snakes, turtles, crocodilians and lizards with visible clues; dangerous species are picture-only observations.",
    "kitchen": "Round 1 names foods and object jobs from pictures. Hot, sharp or powered equipment is described, never operated by the child.",
    "produce": "Round 1 uses shape, skin, leaf, root, color or market/garden clues without diet lectures or repetitive 'healthy food' claims.",
    "bakery": "Round 1 notices shape, layers, crust, swirl, crumb or topping; keep it descriptive and musical rather than advertising sweetness.",
}

DOMAIN_ROUND2 = {
    "space": "Round 2 strips back to cue-gap-answer timing with object-conditioned gestures: orbiters trace circles, planets show shape or tilt, comets sweep a tail, telescopes aim, rovers roll, and suit/helmet items use simple body-shape mime. Keep every action short and never let it obscure the target word.",
    "dinosaur": "Round 2 uses footprint-sized recall gaps followed by object-conditioned morphology gestures: plates, armor, horns, crests, long necks, sickle claws, pterosaur wings, marine swimming, nest/fossil shapes, or body-size silhouettes. Use a plain trace/stomp only when no clearer clue exists.",
    "insect": "Round 2 leaves a clean recall gap, then confirms with an object-conditioned gesture: ant six-step crawl, flea/grasshopper/leafhopper hop, mantis folded grasping forelegs, beetle wing-cover shell, butterfly/moth wing-open, orb-weaver web circle, pill-bug curl, stick-insect twig freeze, firefly glow, or other visible clue. Do not reduce the whole section to generic antenna/crawl motions.",
    "bird": "Round 2 uses binocular-style cue-gap-answer timing followed by an object-conditioned clue: waders show long legs or curved/spear bills, seed birds show cone bills, parrots show hooked bills/climbing feet, trunk birds climb or tap, soarers glide, hummingbirds hover, nest makes a cup shape, and flightless birds use grounded walking or swimming gestures.",
    "pet": "Round 2 confirms with object-conditioned matching: animals use species-congruent swim, hop, paw, perch, sniff, or tail motions; bowls cup, beds flatten, shelters roof, wheels circle, tags hang, leashes trace a line, perches branch, scratching posts stand tall, and toys roll/tug/flutter. Clippers, cleaners, UV lamps, vet kits, and X-ray images remain point-and-name only—no clipping, medicating, heating, or tool use.",
    "wildlife": "Round 2 uses track-and-name recall followed by species-conditioned observation gestures: horns curve, trunks lift, primate hands grasp, cats show spots/stripes or tails, canids show muzzle/ears, marsupials hop or balance, marine mammals show flippers, birds use bill/leg/ground-or-flight clues, and reptiles/amphibians use scale/tail/hop clues. No chase, feeding, touching, riding, or approach prompts.",
    "herp": "Round 2 uses one to two beats of recall and group-specific picture gestures: frogs hop and show webbed feet or eyes; newts and salamanders show tail-swim or external gills; snakes use S-curves plus hood, rattle, or coil when relevant; turtles show shell; crocodilians show armored back and tail; lizards show toe pads, frill, horns, casque, spiny tail, scales, or long tail. Dangerous animals remain hands-off and picture-only.",
    "kitchen": "Round 2 is picture recall only and object-conditioned: foods show shape, peel, grid, ring, strands, or portions; bowls/cups/jars/trays make container shapes; spoons/ladles/forks/tongs/whisks show empty-hand silhouettes; drawers open in the air; timers trace a dial; cookie cutters trace an outline. Hot, sharp, or powered tools remain point-only or empty-hand mime while a grown-up handles the real item.",
    "produce": "Round 2 uses object-conditioned recall: roots and tubers trace underground shapes; leafy produce fans leaf fingers; citrus opens segments; grapes cluster; melons show rind and roundness; peppers/pods show hollow or ridged shapes; stone fruits show a pit; berries show surface seeds or clustered drupelets; onions show layers; long squash/beans/pods trace length. Avoid repeating the same basket gesture for every target.",
    "bakery": "Round 2 uses a clean recall gap and item-specific visual gestures: pies/tarts trace crust and filling; cupcakes show wrapper and top; donuts make ring/fill shapes; eclairs go oblong; macarons show two shells plus filling; layered pastries stack fingers; breads show loaf, score, roll, cross, raisins, nuts, or wholegrain flecks; pretzels knot; waffles grid; roll cakes spiral; toppings spread, drip, or sprinkle in the air. Ice Cream stays a frozen scoop clue. No real baking operations are instructed.",
}

DOMAIN_SIGNATURE = {
    "space": "short synth-star ping or glockenspiel orbit after each target",
    "dinosaur": "low soft tom footprint plus wooden click, never a scary roar over the word",
    "insect": "tiny pizzicato, shaker or bell-wing answer after the target",
    "bird": "light flute/whistle feather answer kept separate from the sung target",
    "pet": "soft marimba or bell-paw answer with no barking over diction",
    "wildlife": "warm hand-drum or marimba footprint after the word",
    "herp": "soft woodblock/plop accent after the word, no alarming hiss bed",
    "kitchen": "muted woodblock, cup-tap or marimba answer; no appliance noise under vocals",
    "produce": "bright marimba/ukulele pluck that changes contour every few letters",
    "bakery": "warm guitar/marimba crumb-sized answer, never a commercial jingle sting",
}

DOMAIN_CALLBACK = {
    "space": "our space story",
    "dinosaur": "our prehistoric trail",
    "insect": "our tiny-world tune",
    "bird": "our birdwatching song",
    "pet": "our pet-care tune",
    "wildlife": "our wildlife trail",
    "herp": "our pond-and-rock song",
    "kitchen": "our kitchen picture game",
    "produce": "our garden-market tune",
    "bakery": "our bakery picture song",
}

OUTRO_FRAMES = (
    "A to Z—{callback} still glows!",
    "One last beat—{callback} comes home with me!",
    "Letters tucked in—{callback} is ours to keep!",
    "A through Z—{callback} lands on one bright final beat!",
    "Close the page softly—{callback} stays in the melody!",
)


FORM_PALETTE = (
    ((2, 5), (3, 6), True),
    ((3, 6), (4, 7), False),
    ((2, 5, 7), (3, 6), False),
    ((3, 7), (2, 5, 7), True),
    ((2, 6), (4, 7), False),
    ((3, 5), (3, 7), True),
    ((2, 4, 7), (4, 7), False),
)

PATTERN_PALETTES: tuple[tuple[tuple[str, ...], tuple[str, ...]], ...] = (
    (
        ("{letter}—{object}! {semantic}", "{letter} ... {letter} ... {object}. {semantic}", "{object} steps in for {letter}. {semantic}", "What does {letter} reveal? {object}! {semantic}", "{scene}, {letter} meets {object}. {semantic}"),
        ("{letter} ... {object}! {action}", "Remember {letter} ... {object}! {action}", "{letter}? ... {object}! {action}", "Find {letter}, hold the beat ... {object}! {action}"),
    ),
    (
        ("{object}—that is our {letter}. {semantic}", "Spot {letter}: {object}! {semantic}", "{letter} brings {object}; {semantic}", "A clue for {letter}: {object}. {semantic}", "{scene}, here comes {object} for {letter}. {semantic}"),
        ("Spot {letter} ... {object}! {action}", "Call {letter}, wait ... {object}! {action}", "Which word fits {letter}? ... {object}! {action}", "{letter} ... {letter} ... {object}! {action}"),
    ),
    (
        ("{letter} ... listen ... {object}! {semantic}", "Meet {object}, our {letter} clue. {semantic}", "{scene}: {letter} finds {object}. {semantic}", "{letter} for {object}—{semantic}", "Which picture starts with {letter}? {object}! {semantic}"),
        ("Cue {letter} ... {object}! {action}", "{letter} ... {letter} ... {object}! {action}", "Ready for {letter}? ... {object}! {action}", "Show the match for {letter} ... {object}! {action}"),
    ),
    (
        ("Look—{letter}! Look—{object}! {semantic}", "{letter} lands on {object}. {semantic}", "{object}? Yes—{letter}. {semantic}", "{scene}, the {letter} clue is {object}. {semantic}", "Say {letter}, then {object}. {semantic}"),
        ("Look for {letter} ... {object}! {action}", "Letter first: {letter} ... answer: {object}! {action}", "{letter}? Hold ... {object}! {action}", "One clue—{letter} ... {object}! {action}"),
    ),
    (
        ("{letter} is here; {object} is why. {semantic}", "{object} answers {letter}. {semantic}", "{scene}, what belongs to {letter}? {object}! {semantic}", "{letter}—short beat—{object}. {semantic}", "Hear {letter}; see {object}. {semantic}"),
        ("Hear {letter} ... say {object}! {action}", "Find the picture for {letter} ... {object}! {action}", "{letter} calls ... {object} answers! {action}", "{letter} ... wait ... {object}! {action}"),
    ),
    (
        ("{object} appears—{letter} found it. {semantic}", "{letter} ... {object}; {semantic}", "A tiny pause for {letter}, then {object}! {semantic}", "{scene}, {object} belongs with {letter}. {semantic}", "Question: {letter}? Answer: {object}. {semantic}"),
        ("Question: {letter}? ... {object}! {action}", "{letter} ... answer when ready ... {object}! {action}", "Remember the {letter} clue ... {object}! {action}", "{letter}, one quiet beat ... {object}! {action}"),
    ),
    (
        ("Start with {letter}; arrive at {object}. {semantic}", "{letter}—{object}! {semantic}", "{scene}, {object} catches the {letter} beat. {semantic}", "What word rides with {letter}? {object}. {semantic}", "{object}, loud and clear; {letter} brought it here. {semantic}"),
        ("Start with {letter} ... land on {object}! {action}", "{letter}? ... {object}! {action}", "Hold the rhythm after {letter} ... {object}! {action}", "Last clue in the pocket: {letter} ... {object}! {action}"),
    ),
)


def spec_payload(song_id: str, base_style: str, hook_a: str, hook_b: str, bpm: int, motif: str) -> dict[str, Any] | None:
    domain = domain_for_song(song_id)
    mapping = mapping_for_song(song_id)
    if domain is None or mapping is None:
        return None
    number = int(song_id)
    variant = (number - 51) % 5
    palette_index = (number - 51) % len(PATTERN_PALETTES)
    r1_patterns, r2_patterns = PATTERN_PALETTES[palette_index]
    scene = VARIANT_SCENES.get(domain, (DOMAIN_SCENES[domain],) * 5)[variant]
    r1_patterns = tuple(pattern.replace("{scene}", scene) for pattern in r1_patterns)
    opening = OPENING_BANK[domain][variant]
    hooks = HOOK_BANK[domain][variant]
    r1_after, r2_after, has_interlude = FORM_PALETTE[(number - 51) % len(FORM_PALETTE)]
    theme = mapping["theme"]["name"]

    interlude: tuple[str, ...] = ()
    if has_interlude:
        interlude = ({
            "space": "Engines hush; one star keeps blinking. Now the answers come back from memory.",
            "dinosaur": "The footprints stop at the museum door. One quiet beat—now remember the names.",
            "insect": "The garden goes still under one leaf. Tiny clues return after the hush.",
            "bird": "Wings settle on a branch. Listen—now call the bird words back.",
            "pet": "Playtime pauses for fresh water and one calm breath. Now remember the pet words.",
            "wildlife": "The trail goes quiet. We stay where we are and call the picture names back.",
            "herp": "The pond ripple disappears. One quiet beat—then the creature clues return.",
            "kitchen": "The picture table goes quiet; hands are empty. Now remember the kitchen words.",
            "produce": "The baskets rest between garden and market. Now call the colors, shapes, and names back.",
            "bakery": "The storybook bakery window goes still. One warm chord—then the picture names return.",
        }[domain],)

    if domain == "space":
        variant_directive = SPACE_VARIANT_DIRECTIVES[variant]
        signature = SPACE_SIGNATURES[variant]
    elif domain == "dinosaur":
        variant_directive = DINO_VARIANT_DIRECTIVES[variant]
        signature = DINO_SIGNATURES[variant]
    elif domain == "insect":
        variant_directive = INSECT_VARIANT_DIRECTIVES[variant]
        signature = INSECT_SIGNATURES[variant]
    elif domain == "bird":
        variant_directive = BIRD_VARIANT_DIRECTIVES[variant]
        signature = BIRD_SIGNATURES[variant]
    elif domain == "pet":
        variant_directive = PET_VARIANT_DIRECTIVES[variant]
        signature = PET_SIGNATURES[variant]
    elif domain == "wildlife":
        variant_directive = WILDLIFE_VARIANT_DIRECTIVES[variant]
        signature = WILDLIFE_SIGNATURES[variant]
    elif domain == "herp":
        variant_directive = HERP_VARIANT_DIRECTIVES[variant]
        signature = HERP_SIGNATURES[variant]
    elif domain == "kitchen":
        variant_directive = KITCHEN_VARIANT_DIRECTIVES[variant]
        signature = KITCHEN_SIGNATURES[variant]
    elif domain == "produce":
        variant_directive = PRODUCE_VARIANT_DIRECTIVES[variant]
        signature = PRODUCE_SIGNATURES[variant]
    elif domain == "bakery":
        variant_directive = BAKERY_VARIANT_DIRECTIVES[variant]
        signature = BAKERY_SIGNATURES[variant]
    else:
        variant_directive = ""
        signature = DOMAIN_SIGNATURE[domain]

    style = (
        f"{base_style}. This is the {theme} song, but avoid sounding like a stock educational jingle. "
        f"Use a clear warm adult lead around {bpm} BPM with crisp consonants, stable vowels and natural lexical stress. "
        "Write the melody around the words rather than forcing every line into equal length: short targets may hit in one compact bar; long targets may breathe across two or more bars. "
        f"Cold-open with {opening[0]} using the supplied intro text exactly enough to preserve its idea; do not add a generic spoken welcome. "
        f"{DOMAIN_ROUND1[domain]} Use mixed entry families—direct hit, repeated-letter pickup, object-first reveal, question-answer and small narrative turn—without cycling them mechanically A-B-C-D. "
        f"{variant_directive} "
        "Let selected Round-1 bars carry an audible internal/end rhyme around the written | phrase break, but never sacrifice meaning or pronunciation just to rhyme. "
        f"The chorus should widen melodically into the two-line hook, then change texture or response on later returns instead of copy-pasting the same arrangement. {DOMAIN_ROUND2[domain]} "
        f"At target onset, duck percussion, pads and backing vocals; after the target, answer with {signature}. "
        "Use small melodic surprises—pickup, held note, half-bar rest, call-and-answer, octave color or rhythmic displacement—sparingly so the catalog feels authored, not randomized. "
        "No melisma on learning words, no rapid list delivery, no dense choir over targets, no commercial slogan cadence. End with a short thematic callback and a clean cadence."
    )

    return {
        "opening_type": opening[0],
        "target_entry_families": ("direct", "repeated-letter", "object-first", "question-answer", "narrative", "pause-reveal"),
        "line_length_contour": ("short", "medium", "long", "short", "long", "medium"),
        "rhyme_engine": "mixed-internal-phraselet",
        "chorus_rhyme_engine": "paired-with-arrangement-variation" if variant in (0, 2, 4) else "refrain-with-echo-variation",
        "point_of_view": DOMAIN_POV[domain],
        "chorus_function": "two-line memory anchor whose orchestration changes on repeat",
        "groove_meter": ("elastic 4/4 bounce", "gentle 6/8 sway", "stop-and-go 4/4", "light swung 4/4", "story-song 3/4-to-4/4 feel")[variant],
        "round1_grammar": DOMAIN_ROUND1[domain],
        "round2_grammar": DOMAIN_ROUND2[domain],
        "section_contrast": f"Round 1 paints clues; chorus opens wide; Round 2 strips back for recall. Signature: {signature}.",
        "signature_color": signature,
        "intro_lines": (opening[1], opening[2]),
        "hook_lines": hooks,
        "outro_lines": (hooks[0], OUTRO_FRAMES[variant].format(callback=DOMAIN_CALLBACK[domain])),
        "interlude_lines": interlude,
        "chorus_after_round1": r1_after,
        "chorus_after_round2": r2_after,
        "round1_patterns": r1_patterns,
        "round2_patterns": r2_patterns,
        "style_blueprint": style,
        "object_craft_required": True,
    }


# --- Object-conditioned craft -------------------------------------------------

SPACE_FACTS = {
    "Asteroid": "An asteroid is a rocky or metallic body traveling around the Sun.",
    "Black Hole": "A black hole has gravity so strong that light cannot escape from inside it.",
    "Comet": "A comet is icy and can grow a glowing head and tail near the Sun.",
    "Dwarf Planet": "A dwarf planet is round and orbits the Sun, but shares its orbital neighborhood with other bodies.",
    "Earth": "Earth is our home planet, with liquid-water oceans and a protective atmosphere.",
    "Flag": "A flag is a marked piece of fabric used as a symbol; astronauts have carried flags on missions.",
    "Gemini Capsule": "A Gemini capsule carried two astronauts and helped crews prepare for later Moon missions.",
    "Helmet": "A space helmet protects the head and helps keep a safe breathing environment.",
    "International Space Station": "The International Space Station is a large research laboratory that orbits Earth.",
    "Jet Pack": "A spacecraft maneuvering pack uses small thrusters for carefully planned movement in space.",
    "Krypton Tank": "A krypton tank stores gas used as propellant in some electric spacecraft thrusters.",
    "Lander": "A lander is a spacecraft built to come down onto the surface of another world.",
    "Meteor": "A meteor is the streak of light seen when a small space rock heats up while passing through an atmosphere.",
    "Neptune": "Neptune is the eighth planet from the Sun, a cold blue giant world.",
    "Orbit": "An orbit is the curved path one object follows around another because of motion and gravity.",
    "Planet": "A planet is a large round world that travels in an orbit around a star.",
    "Quarter Moon": "A quarter moon is a lunar phase when we see about half of the Moon's sunlit face from Earth.",
    "Rocket": "A rocket produces thrust by pushing exhaust in the opposite direction of travel.",
    "Satellite": "A satellite is an object that travels in orbit around a planet, moon, or other body.",
    "Telescope": "A telescope collects light or other signals to help us study distant objects.",
    "Uranus": "Uranus is an ice-giant planet that rotates with an unusually large sideways tilt.",
    "Visor": "A spacesuit visor protects the eyes and face and can filter intense sunlight.",
    "World": "A world is a broad word for a planet, moon, or other place considered as its own environment.",
    "X-ray Telescope": "An X-ray telescope detects X-rays from hot and energetic objects in space.",
    "Yoke": "A control yoke is a hand control used in some vehicles; spacecraft use carefully designed controls for steering or orientation commands.",
    "Zero-gravity Chair": "A zero-gravity chair reclines the body for distributed support; it does not create real weightlessness.",
    "Astronaut": "An astronaut is a trained person who travels or works in space.",
    "Booster": "A rocket booster provides extra thrust during an early part of a launch.",
    "Eclipse": "An eclipse happens when one celestial body moves into the shadow of another or blocks our view of it.",
    "Fuel Tank": "A spacecraft fuel or propellant tank stores material used by an engine or thruster system.",
    "Galaxy": "A galaxy is a huge family of stars, gas, dust, and dark matter held together by gravity.",
    "Io": "Io is one of Jupiter's large moons and is known for intense volcanic activity.",
    "Jupiter": "Jupiter is our solar system's largest planet, with a giant atmosphere and powerful storms.",
    "Kuiper Belt": "The Kuiper Belt is a broad region beyond Neptune containing many icy bodies.",
    "Lunar Rover": "A lunar rover is a vehicle designed to travel across the Moon's surface.",
    "Moon": "The Moon is Earth's natural satellite and reflects sunlight as it travels around our planet.",
    "Observatory": "An observatory is a place built for studying the sky with telescopes and other instruments.",
    "Probe": "A space probe is an uncrewed spacecraft sent to collect information about space or another world.",
    "Rover": "A rover is a mobile robot or vehicle designed to explore the surface of another world.",
    "Universe": "The universe includes all known space, time, matter, and energy—everything we can observe belongs within it.",
    "Venus": "Venus is a rocky planet covered by a thick atmosphere and very hot surface conditions.",
    "Xenon Thruster": "A xenon thruster uses electrically accelerated xenon ions to produce gentle, efficient thrust.",
    "Capsule": "A space capsule is a compact spacecraft section built to carry crew, cargo, or experiments.",
    "Dish Antenna": "A dish antenna focuses radio waves so a spacecraft or ground station can send and receive signals.",
    "Hubble Telescope": "The Hubble Space Telescope orbits Earth and observes the universe above much of our atmosphere.",
    "Nebula": "A nebula is a cloud of gas and dust in space, sometimes linked to star birth or the remains of stars.",
    "Quasar": "A quasar is an extremely bright galactic core powered by matter falling toward a supermassive black hole.",
    "Thruster": "A spacecraft thruster produces controlled force used to change motion or orientation.",
    "White Dwarf": "A white dwarf is the hot, dense core left after a Sun-like star sheds its outer layers.",
    "Yellow Star": "A yellow-looking star appears warm yellowish-white because of its surface temperature and spectrum.",
    "Zodiac Chart": "A zodiac chart maps a band of sky along the path where the Sun, Moon, and planets appear to move from Earth's viewpoint.",
    "Spacesuit": "A spacesuit provides pressure, oxygen support, temperature control, and protection for an astronaut outside a spacecraft.",
}

DINO_FACTS = {
    "Bone": "A bone is a hard body structure; fossilized bones can preserve clues about prehistoric animals.",
    "Allosaurus": "Allosaurus was a large meat-eating theropod with three-fingered hands, a long tail, and blade-like teeth.",
    "Carnotaurus": "Carnotaurus was a meat-eating dinosaur with two horns above its eyes and extremely small forelimbs.",
    "Ceratopsian": "Ceratopsians were plant-eating dinosaurs recognized by beaks, frills, and—in many species—facial horns.",
    "Deinonychus": "Deinonychus was a feathered dromaeosaurid with a large sickle claw on each second toe.",
    "Diplodocus": "Diplodocus was a long-necked sauropod with a very long tail and peg-like teeth near the front of its jaws.",
    "Edmontosaurus": "Edmontosaurus was a large duck-billed hadrosaur that walked on two or four legs.",
    "Gastonia": "Gastonia was a low armored dinosaur with bony plates and large spikes along its sides.",
    "Giganotosaurus": "Giganotosaurus was a giant theropod with a huge skull and powerful hind legs.",
    "Hadrosaur": "Hadrosaurs were duck-billed plant eaters with rows of closely packed grinding teeth.",
    "Herrerasaurus": "Herrerasaurus was an early meat-eating dinosaur that walked on two legs and balanced with a long tail.",
    "Irritator": "Irritator was a spinosaurid theropod with a long narrow snout lined with conical teeth.",
    "Kentrosaurus": "Kentrosaurus was a stegosaur with back plates toward the front and long spikes toward the rear and tail.",
    "Kritosaurus": "Kritosaurus was a duck-billed hadrosaur, known from a broad beak and a large plant-eating body.",
    "Lambeosaurus": "Lambeosaurus was a duck-billed dinosaur with a tall hollow crest rising from its skull.",
    "Lesothosaurus": "Lesothosaurus was a small lightly built plant-eating dinosaur that moved on two long hind legs.",
    "Maiasaura": "Maiasaura was a duck-billed dinosaur known from nesting grounds with eggs, nests, and young dinosaurs.",
    "Nodosaurus": "Nodosaurus was an armored plant-eating dinosaur with bony plates and no heavy tail club.",
    "Ornithomimus": "Ornithomimus had long legs, a small head, and an ostrich-like body built for running.",
    "Oviraptor": "Oviraptor was a feathered theropod with a toothless beak; fossils show close association with nests and eggs.",
    "Pachycephalosaurus": "Pachycephalosaurus was a two-legged dinosaur with a very thick domed skull.",
    "Qianzhousaurus": "Qianzhousaurus was a tyrannosaur relative with an unusually long, narrow snout.",
    "Raptor": "Raptor is an informal nickname often used for dromaeosaurids, feathered theropods with enlarged curved toe claws.",
    "Unenlagia": "Unenlagia was a bird-like dromaeosaurid theropod with long arms and a lightly built body.",
    "Utahraptor": "Utahraptor was a very large dromaeosaurid with an enlarged curved claw on each second toe.",
    "Wannanosaurus": "Wannanosaurus was a small plant-eating dinosaur related to pachycephalosaurs, with a thickened skull roof.",
    "Wuerhosaurus": "Wuerhosaurus was a stegosaur with back plates and tail spikes.",
    "Xenoceratops": "Xenoceratops was a horned ceratopsian with a large frill decorated by bony projections.",
    "Xixiasaurus": "Xixiasaurus was a small bird-like theropod with a slender skull and many small teeth.",
    "Yinlong": "Yinlong was a small early ceratopsian that walked on two legs and had a parrot-like beak.",
    "Yutyrannus": "Yutyrannus was a large tyrannosauroid covered with simple filament-like feathers.",
    "Zephyrosaurus": "Zephyrosaurus was a small plant-eating ornithischian with a light two-legged body.",
    "Zuniceratops": "Zuniceratops was an early horned dinosaur with brow horns and a frill behind its head.",
    "Jawbone": "A jawbone holds teeth and can give paleontologists clues about how an animal ate.",
    "Rib Bone": "Ribs form a protective cage; fossil ribs help reveal an ancient body's shape.",
    "Fossil": "A fossil is preserved evidence of ancient life, such as bone, shell, a leaf impression, or a track.",
    "Footprint": "A fossil footprint is a trace fossil that records where an animal stepped long ago.",
    "Egg": "Fossil eggs can preserve clues about how some prehistoric animals reproduced and nested.",
    "Nest": "A fossil nest or nesting site can reveal how some prehistoric animals laid and cared for eggs.",
    "Jurassic Fern": "Ferns grew in many prehistoric plant communities, and fern relatives still grow today.",
    "Volcano": "A volcano is an opening where molten rock, gas, and ash can reach Earth's surface; volcanoes existed throughout dinosaur times.",
    "Pteranodon": "Pteranodon was a flying reptile called a pterosaur, not a dinosaur.",
    "Quetzalcoatlus": "Quetzalcoatlus was a giant pterosaur, a flying reptile rather than a dinosaur.",
    "Mosasaurus": "Mosasaurus was a large marine reptile that lived in the sea, not a dinosaur.",
    "Ankylosaurus": "Ankylosaurus was an armored dinosaur with bony plates and a heavy tail club.",
    "Brachiosaurus": "Brachiosaurus was a long-necked sauropod with front legs longer than its hind legs.",
    "Stegosaurus": "Stegosaurus was a plant-eating dinosaur with tall back plates and spikes on its tail.",
    "Triceratops": "Triceratops was a plant-eating dinosaur with three facial horns and a large bony frill.",
    "Tyrannosaurus": "Tyrannosaurus was a large meat-eating dinosaur with a massive skull and powerful hind legs.",
    "Velociraptor": "Velociraptor was a small feathered theropod with a curved claw on each second toe.",
    "Spinosaurus": "Spinosaurus was a large theropod dinosaur with tall spines forming a sail-like structure along its back.",
    "Iguanodon": "Iguanodon was a plant-eating dinosaur known for a large spike on each thumb.",
}

INSECT_FACTS = {
    "Ant": "An ant has six legs, elbowed antennae, and three main body sections.",
    "Beetle": "A beetle has hardened front wings called elytra covering the softer flight wings beneath.",
    "Dung Beetle": "A dung beetle feeds on animal dung; many species roll or bury dung for food or nesting.",
    "Earwig": "An earwig has a long flattened body and a pair of forceps-like pincers at the rear.",
    "Gnat": "A gnat is a tiny fly with six legs, antennae, and one pair of wings.",
    "Jewel Beetle": "A jewel beetle has hardened wing covers, and many species shine with metallic colors.",
    "Kissing Bug": "A kissing bug has a long narrow head and piercing beak-like mouthpart.",
    "Leafhopper": "A leafhopper is a small plant-feeding insect with strong hind legs for sudden hops.",
    "Mosquito": "A mosquito is a slender fly with long legs, narrow wings, and a projecting proboscis.",
    "Net-winged Beetle": "A net-winged beetle has soft-looking wing covers marked with raised ridges like a tiny net.",
    "Queen Bee": "A queen bee is the reproductive female in a social bee colony and usually has a longer abdomen than workers.",
    "Roach": "A cockroach has a flattened oval body, long antennae, and quick-running legs.",
    "Stick Insect": "A stick insect has a long narrow body that can resemble a twig among branches.",
    "Stag Beetle": "A stag beetle is known for the enlarged jaw-like mandibles of many males.",
    "Rhinoceros Beetle": "A rhinoceros beetle is a robust scarab; many males carry one or more large horn-like projections.",
    "Hercules Beetle": "A Hercules beetle is a very large rhinoceros beetle; males can have long opposing horn-like projections.",
    "Weevil": "A weevil is a beetle often recognized by an elongated snout with mouthparts at the tip.",
    "Xylocopa Bee": "Xylocopa are large carpenter bees; many females excavate nest galleries in wood.",
    "Xylophone Beetle": "This locked label is treated as a beetle picture: hardened front wing covers protect the softer wings beneath.",
    "Orange Butterfly": "An orange butterfly has scaled wings and an uncoiling proboscis for sipping nectar.",
    "Queen Butterfly": "A queen butterfly has scaled wings and a coiled proboscis for sipping nectar from flowers.",
    "Ulysses Butterfly": "A Ulysses butterfly is a large swallowtail known for brilliant blue patches on dark wings.",
    "Viceroy Butterfly": "A viceroy butterfly has orange-and-black patterned wings with a dark line crossing each hindwing.",
    "Yellow Butterfly": "A yellow butterfly has scaled wings and an uncoiling nectar-sipping proboscis.",
    "Zebra Longwing": "A zebra longwing has long dark wings crossed by pale yellow stripes.",
    "Zebra Butterfly": "A zebra-named butterfly is recognized in the picture by bold light-and-dark striping on its wings.",
    "Emperor Moth": "An emperor moth has broad wings with prominent eye-like spots.",
    "Underwing Moth": "An underwing moth can hide brighter hindwing colors beneath more camouflaged forewings.",
    "Tiger Moth": "Tiger moths often have bold spots or bands and thick furry-looking bodies.",
    "Bee": "A bee has six legs and visits flowers for nectar and pollen.",
    "Honeybee": "A honeybee is a social bee that lives in a colony and gathers nectar and pollen from flowers.",
    "Caterpillar": "A caterpillar is the larval stage of a butterfly or moth and has a long soft body made of segments.",
    "Inchworm": "An inchworm is a moth caterpillar that loops its body as it crawls.",
    "Nymph": "A nymph is a young insect stage that resembles a smaller, wingless version of the adult in groups with gradual change.",
    "Orb Weaver": "An orb weaver is a spider, not an insect, and many species build round wheel-shaped webs.",
    "Pill Bug": "A pill bug is a small land crustacean, not an insect, and many can curl into a ball.",
    "Praying Mantis": "A praying mantis is an insect with grasping front legs held in a folded position.",
    "Mantis": "A mantis is an insect with a triangular head and grasping front legs.",
    "Dragonfly": "A dragonfly has huge eyes and two pairs of long wings; its young stage lives in water.",
    "Firefly": "A firefly is a beetle; many species make light with special organs in the abdomen.",
    "Ladybug": "A ladybug is a round beetle, often red or orange with dark spots.",
    "Grasshopper": "A grasshopper has powerful enlarged hind legs built for jumping.",
    "Cricket": "A cricket has long antennae; many males chirp by rubbing their wings.",
    "Termite": "A termite is a social insect living in colonies and feeding mainly on cellulose from plant material.",
    "Aphid": "An aphid is a tiny plant-feeding insect that uses slender mouthparts to drink plant sap.",
}

BIRD_SPECIAL = {
    "Nest": "A nest is a structure birds may build or use to hold eggs and shelter chicks; it is not a bird itself.",
    "Avocet": "An avocet is a long-legged wader with a slender bill that curves upward.",
    "Albatross": "An albatross is an ocean bird with very long narrow wings suited to efficient soaring.",
    "Bluebird": "A bluebird is a small thrush with blue plumage and a short straight bill.",
    "Budgie": "A budgie is a small parrot with a curved bill and two toes facing forward and two backward.",
    "Cardinal": "A cardinal has a stout cone-shaped bill well suited to cracking seeds.",
    "Crane": "A crane is a tall bird with long legs, a long neck, and a straight pointed bill.",
    "Dove": "A dove has a small head, rounded body, and a soft cooing call.",
    "Duck": "A duck has webbed feet for paddling and a broad bill suited to its feeding style.",
    "Egret": "An egret is a long-legged wading bird with a long neck and pointed bill.",
    "Finch": "A finch is a small bird often recognized by a compact body and seed-cracking cone-shaped bill.",
    "Goldfinch": "A goldfinch is a small finch with a cone-shaped seed bill and bright yellow-and-dark wing patterning in familiar forms.",
    "Goose": "A goose is a large water bird with webbed feet, a broad bill, and a long neck.",
    "Heron": "A heron is a long-legged wader with a long neck and spear-like bill for catching prey.",
    "Ibis": "An ibis is a long-legged wader with a long bill that curves downward for probing mud or soil.",
    "Indian Roller": "An Indian roller is known for bright blue wing flashes that show strongly in flight.",
    "Jay": "A jay is a sturdy-billed songbird in the crow family, often bold in voice and movement.",
    "Junco": "A junco is a small ground-feeding sparrow relative with a short cone-shaped bill.",
    "Lark": "A lark is a ground bird with walking feet and, in many species, a strong aerial song.",
    "Lorikeet": "A lorikeet is a colorful parrot with a curved bill and a brush-tipped tongue adapted for nectar and pollen.",
    "Macaw": "A macaw is a large parrot with a powerful curved bill, gripping feet, and a long tail.",
    "Magpie": "A magpie is a long-tailed bird in the crow family with a sturdy bill and bold contrasting plumage in many species.",
    "Parrot": "A parrot has a strong hooked bill and gripping feet with two toes forward and two backward.",
    "Quail": "A quail is a plump ground bird with short rounded wings and strong walking feet.",
    "Raven": "A raven is a large black bird in the crow family with a heavy bill and broad wings.",
    "Robin": "A robin is a ground-hopping songbird with a slim bill used to pick small foods.",
    "Sparrow": "A sparrow is a small bird with a compact body and a short cone-shaped bill suited to seeds.",
    "Swan": "A swan is a large water bird with a very long neck and webbed feet.",
    "Tern": "A tern is a slender water bird with narrow pointed wings; many species dive for fish.",
    "Umbrellabird": "An umbrellabird is a tropical bird named for the umbrella-like crest that arches over its head.",
    "Upland Sandpiper": "An upland sandpiper is a long-legged shorebird relative that spends much of its time in grasslands rather than at shorelines.",
    "Veery": "A veery is a small thrush with warm brown upperparts and faint spotting on the upper chest.",
    "Vulture": "A vulture is a scavenging bird with broad soaring wings and a hooked bill.",
    "Wren": "A wren is a small active songbird, often recognized by a short tail held upright.",
    "Xantus Hummingbird": "Xantus Hummingbird is tiny, with a slender bill and rapid wingbeats for hovering.",
    "Yellow Warbler": "A yellow warbler is a small slender-billed songbird with bright yellow plumage.",
    "Yellowhammer": "A yellowhammer is a bunting with a seed-cracking bill and yellow head markings, especially bright in males.",
    "Zebra Finch": "A zebra finch is a small seed-eating finch with a short bill and zebra-like barring around the throat and chest in males.",
    "Zenaida Dove": "A Zenaida dove is a warm brownish dove with a compact head and strong pointed wings.",
    "Kiwi": "A kiwi is a flightless New Zealand bird with tiny wings, strong legs, and a long sensitive bill.",
    "Ostrich": "An ostrich is the largest living bird; it cannot fly but can run quickly on strong legs.",
    "Penguin": "A penguin is a flightless seabird whose stiff wings work like flippers underwater.",
    "Hummingbird": "A hummingbird is a tiny bird that can hover by beating its wings extremely fast.",
    "Woodpecker": "A woodpecker uses a strong bill to tap or chisel wood and has feet suited for gripping trunks.",
    "Toucan": "A toucan is a tropical bird known for its very large, lightweight-looking colorful bill.",
    "Quetzal": "A quetzal is a colorful forest bird; some species have striking green plumage and long tail feathers.",
    "Flamingo": "A flamingo is a long-legged water bird with a bent bill adapted for filter feeding.",
    "Owl": "An owl is a bird with forward-facing eyes and soft flight feathers; many species are active at night.",
    "Eagle": "An eagle is a large bird of prey with strong talons, a hooked bill, and keen eyesight.",
    "Kingfisher": "A kingfisher is a bird with a sturdy pointed bill; many species catch fish or other small prey near water.",
    "Nuthatch": "A nuthatch is a small bird that often climbs along tree trunks and branches while searching bark for food.",
    "Xenops": "A xenops is a small tropical American bird that searches bark and branches for insects.",
}

PET_ANIMALS = {
    "Angelfish", "Cat", "Fish", "Hamster", "Iguana", "Puppy", "Rabbit", "Turtle", "Bunny", "Guinea Pig", "Kitten", "Mouse", "Dog", "Quail", "Yellow Canary", "Zebra Finch",
}

PET_CARE_FACTS = {
    "Aquarium": "An aquarium is a water-filled habitat kept clean and suitable for fish or other aquatic pets.",
    "Bowl": "A pet bowl holds food or fresh water.",
    "Meal Bowl": "A meal bowl holds a pet's measured food portion.",
    "Water Bowl": "A water bowl keeps fresh drinking water available for an appropriate pet.",
    "Doghouse": "A doghouse gives a dog outdoor shade and a protected resting space.",
    "Hutch": "A hutch is an enclosure or shelter used for suitable small animals with proper space, bedding, and care.",
    "Quilt Bed": "A quilt bed is a soft resting place where a suitable pet can settle comfortably.",
    "Feather Toy": "A feather toy is an enrichment toy that can flutter or move for supervised pet play.",
    "Jumping Toy": "A jumping toy is an enrichment toy designed to bounce or move during supervised play.",
    "Octopus Toy": "An octopus-shaped toy uses soft or flexible arms as play features for a suitable pet.",
    "Yarn Ball": "A yarn-ball picture represents a rolling play toy; loose yarn should not be left where a pet could swallow or tangle in it.",
    "Scratching Post": "A scratching post gives a cat a suitable vertical or angled surface for scratching and stretching.",
    "Feather Wand": "A feather wand is a supervised interactive toy that moves feathers for chase-style play.",
    "Grooming Brush": "A grooming brush helps a caregiver remove loose fur and care for an animal's coat.",
    "Undercoat Brush": "An undercoat brush helps a caregiver remove loose undercoat fur from suitable coats.",
    "Meal Scoop": "A meal scoop measures or transfers pet food into a bowl.",
    "Vest Harness": "A fitted vest harness supports a caregiver-guided walk with a leash.",
    "Nail Clipper": "A pet nail clipper trims nails; an experienced adult handles it carefully.",
    "Ear Cleaner": "Pet ear cleaner is used only when appropriate and with adult or veterinary guidance.",
    "UV Lamp": "A UV lamp can provide ultraviolet light for certain reptiles when a knowledgeable adult sets up the habitat correctly.",
    "Vet Kit": "A vet kit holds tools a veterinarian may use to examine an animal's health.",
    "X-ray Vet Image": "An X-ray vet image lets a veterinarian examine bones and some internal structures without surgery.",
    "Kibble": "Kibble is dry pet food; the right type and portion depend on the animal.",
    "Seed Mix": "Seed mix is food for some pet birds or small animals; the suitable mix and amount depend on the species.",
    "Treat": "A pet treat is an occasional food reward; the safe kind and amount depend on the animal.",
    "Litter Box": "A litter box gives a cat or another suitable pet a designated toileting place.",
    "ID Tag": "An ID tag carries contact information that can help identify and return a lost pet.",
    "Zip Carrier": "A ventilated zip carrier keeps a suitable pet contained during transport.",
    "Outdoor Kennel": "An outdoor kennel is a secure enclosure or shelter used for a dog under appropriate supervision and conditions.",
    "Perch": "A perch gives a bird a raised place to stand, rest, or move between levels.",
    "Rope Toy": "A rope toy is an enrichment item for suitable supervised play such as carrying or tugging.",
    "Jingle Ball": "A jingle ball is a rolling play toy that makes a small sound as it moves.",
    "Wheel": "A pet wheel lets an appropriate small animal run for exercise inside its enclosure.",
    "Exercise Wheel": "An exercise wheel lets an appropriate small pet run while staying in its enclosure.",
    "Xylophone Toy": "A xylophone-style pet toy has sound-making bars or pieces for suitable play.",
    "Nest": "A nest gives suitable pet birds a sheltered place associated with eggs or chicks.",
    "Collar": "A properly fitted collar goes around a pet's neck and may carry an ID tag.",
    "Leash": "A leash connects to suitable walking equipment so a caregiver can guide a pet safely.",
}

WILDLIFE_MAMMALS = {
    "Ape", "Bison", "Cheetah", "Dhole", "Elephant", "Gorilla", "Hippo", "Ibex", "Jackal", "Koala", "Lion", "Meerkat", "Okapi", "Panda", "Rhino", "Tiger", "Uakari", "Vicuna", "Wolf", "Yellow Mongoose", "Zebu", "Antelope", "Baboon", "Fox", "Giraffe", "Jaguar", "Kangaroo", "Lemur", "Monkey", "Puma", "Red Panda", "Urial", "Camel", "Deer", "Hyena", "Nyala", "Quokka", "Tapir", "Walrus", "Yak", "Serval",
}

WILDLIFE_BIRDS = {"Flamingo", "Quail", "Vulture", "Emu", "Ostrich"}
WILDLIFE_HERP = {"Iguana", "Nile Crocodile", "Xenopus"}
WILDLIFE_PRIMATES = {"Ape", "Baboon", "Gorilla", "Lemur", "Monkey", "Uakari"}
WILDLIFE_CATS = {"Cheetah", "Jaguar", "Lion", "Puma", "Serval", "Tiger"}
WILDLIFE_CANIDS = {"Dhole", "Fox", "Jackal", "Wolf"}
WILDLIFE_HOOFED = {"Antelope", "Bison", "Camel", "Deer", "Giraffe", "Ibex", "Nyala", "Okapi", "Rhino", "Tapir", "Urial", "Vicuna", "Zebu"}
WILDLIFE_MARSUPIALS = {"Kangaroo", "Koala", "Quokka"}
WILDLIFE_SMALL = {"Meerkat", "Yellow Mongoose", "Xerus"}

PRODUCE_SPECIAL = {
    "Quandong": "Quandong is an Australian fruit with a round red skin and a large stone inside.",
    "Ulluco": "Ulluco is an Andean plant grown for small colorful underground tubers.",
    "Xigua": "Xigua is a name used for watermelon, a large fruit with a hard rind and juicy flesh.",
    "Xoconostle": "Xoconostle is a tart fruit from a prickly pear cactus, with a thick skin and seeded center.",
    "Ugli Fruit": "Ugli fruit is a citrus fruit with a loose, rough-looking rind and juicy segments inside.",
    "Indian Fig": "Indian fig is a prickly pear cactus fruit with a colored skin and many small seeds inside.",
    "Zinfandel Grape": "A Zinfandel grape is a dark-skinned grape variety that grows in bunches on vines.",
    "Vidalia Onion": "A Vidalia onion is a named type of onion with papery outer skin and layered flesh.",
    "Napa Cabbage": "Napa cabbage forms a pale-green leafy head with broad crinkled leaves.",
    "Iceberg Lettuce": "Iceberg lettuce forms a tight round head of crisp pale-green leaves.",
}

KITCHEN_FACTS = {
    "Apple": "An apple is a firm fruit with skin around crisp flesh and a core in the middle.",
    "Apron": "An apron is a protective cloth layer worn over clothing during messy kitchen work.",
    "Blender": "A blender is a powered appliance with fast-moving blades used by a grown-up to mix or puree food.",
    "Bowl": "A bowl is a deep round container that holds food or ingredients.",
    "Cup": "A cup is a small open container used for drinking or measuring.",
    "Cutting Board": "A cutting board is a flat surface used to protect a counter during food preparation.",
    "Dish": "A dish is a plate, bowl, or prepared food served in a container.",
    "Donut": "A donut is a baked or fried pastry often shaped like a ring or filled round.",
    "Egg": "An egg has a shell around the white and yolk inside.",
    "Egg Timer": "An egg timer measures a short cooking interval; a grown-up sets it during kitchen work.",
    "Fork": "A fork is an eating utensil with several narrow tines.",
    "Frying Pan": "A frying pan is a shallow pan heated on a stove; a grown-up handles it when hot.",
    "Grapes": "Grapes are small round or oval fruits that grow in bunches on vines.",
    "Grater": "A grater has rough sharp-edged holes that shred food; it is a grown-up kitchen tool in this song.",
    "Honey": "Honey is a thick sweet liquid made by honeybees from flower nectar.",
    "Hot Pot": "A hot pot is a heated cooking vessel or shared hot broth dish; children only observe it from a safe distance.",
    "Ice Cream": "Ice cream is a frozen dessert that softens as it warms.",
    "Ice Tray": "An ice tray has small compartments that shape water into separate ice cubes as it freezes.",
    "Jar": "A jar is a rigid container with a wide opening and a lid.",
    "Juicer": "A juicer is a tool or appliance made to separate juice from fruit or vegetables.",
    "Kettle": "A kettle heats water; a grown-up handles it because the kettle and steam can be very hot.",
    "Knife": "A kitchen knife has a sharp blade for cutting food and is a grown-up tool in this preschool picture activity.",
    "Ladle": "A ladle is a long-handled spoon with a deep bowl for serving liquids.",
    "Lemon": "A lemon is a yellow citrus fruit with juicy acidic segments inside.",
    "Mixer": "A mixer is a hand or powered tool that combines ingredients; powered beaters move quickly.",
    "Muffin": "A muffin is a small baked bread or cake usually shaped in a cup-like mold.",
    "Napkin": "A napkin is a piece of cloth or paper used to wipe hands or the mouth during a meal.",
    "Noodles": "Noodles are long or shaped strips of dough cooked until tender.",
    "Orange": "An orange is a citrus fruit with a peel around juicy segments.",
    "Oven": "An oven is an enclosed appliance that cooks food with heat; a grown-up operates it because surfaces can become very hot.",
    "Pan": "A pan is a cooking vessel with a broad bottom; heated pans are handled by grown-ups.",
    "Pancake": "A pancake is a flat round cake cooked from batter.",
    "Quiche": "A quiche is a savory baked tart with a pastry crust and egg-based filling.",
    "Quart Cup": "A quart-sized measuring container shows a volume equal to four US cups.",
    "Rice": "Rice is a small grain that becomes soft as it cooks in water.",
    "Rolling Pin": "A rolling pin is a cylinder that rolls over dough to flatten it.",
    "Spatula": "A spatula is a flat kitchen tool used to lift, turn, spread, or scrape food.",
    "Spoon": "A spoon has a small rounded bowl on a handle for scooping or stirring.",
    "Toast": "Toast is bread browned by dry heat.",
    "Tongs": "Tongs are a hinged or springy tool used to grip and lift food.",
    "Under-counter Drawer": "An under-counter drawer is storage built below a counter for kitchen items.",
    "Utensil": "A utensil is a hand tool used for eating, serving, or preparing food.",
    "Vanilla": "Vanilla is a flavoring that comes from the cured seed pods of vanilla orchids.",
    "Vegetable Peeler": "A vegetable peeler has a sharp slot blade that removes thin strips of peel and is used with adult supervision.",
    "Waffle": "A waffle is a cooked batter cake with a grid pattern pressed into its surface.",
    "Whisk": "A whisk has loops of wire or flexible material used to mix air into ingredients.",
    "X-shaped Cookie Cutter": "An X-shaped cookie cutter presses an X outline into rolled dough.",
    "Xylophone": "A xylophone is a musical instrument, not a kitchen tool; its bars make pitched notes when struck.",
    "Yam": "A yam is an underground tuber with starchy flesh.",
    "Yogurt": "Yogurt is cultured milk thickened by helpful bacteria.",
    "Zester": "A zester has small sharp edges that remove thin fragrant pieces of citrus peel; a grown-up handles it here.",
    "Zucchini": "A zucchini is a long green summer squash with pale flesh and soft edible seeds inside.",
}

RISKY_KITCHEN = {"Blender", "Grater", "Hot Pot", "Juicer", "Kettle", "Knife", "Mixer", "Oven", "Frying Pan", "Pan", "Vegetable Peeler", "Zester"}
FLIGHTLESS_BIRDS = {"Kiwi", "Ostrich", "Penguin", "Emu"}


def _pick(obj: str, options: tuple[str, ...]) -> str:
    return options[sum(ord(ch) for ch in obj) % len(options)]


def _bird_fact(obj: str) -> str:
    if obj in BIRD_SPECIAL:
        return BIRD_SPECIAL[obj]
    if obj in FLIGHTLESS_BIRDS:
        return f"{obj} is feathered and flightless; strong legs or flipper-like wings do the moving."
    if "Hummingbird" in obj:
        return f"{obj} is a tiny bird that can hover with extremely rapid wingbeats and uses a slender bill at flowers."
    if any(word in obj for word in ("Duck", "Goose", "Swan", "Tern", "Sandpiper", "Heron", "Egret", "Avocet", "Ibis")):
        return f"{obj} is a water-associated bird; bill, legs, and feet reveal how it moves and feeds."
    return f"{obj} is a bird; bill, feet, tail, plumage, and habitat provide the clearest picture clues."


def _dino_fact(obj: str) -> str:
    if obj in DINO_FACTS:
        return DINO_FACTS[obj]
    # All non-animal prehistoric entries used by 0056-0060 are handled above.
    # The remaining locked targets are prehistoric animal taxa; calling them
    # "prehistoric animal" is accurate without overclaiming that every one is
    # a dinosaur.
    return f"{obj} is known from fossils; bones and body shape reveal an ancient animal."


def _insect_fact(obj: str) -> str:
    if obj in INSECT_FACTS:
        return INSECT_FACTS[obj]
    lower = obj.lower()
    if "butterfly" in lower or "longwing" in lower:
        return f"{obj} is a butterfly: scaled wings wide, curled proboscis tucked inside."
    if "moth" in lower:
        return f"{obj} is a moth with scaled wings and a caterpillar stage."
    if "beetle" in lower or obj in {"Weevil", "June Bug"}:
        return f"{obj} is a beetle; hardened front wings cover the softer flight wings beneath."
    if "bee" in lower or obj in {"Wasp", "Yellowjacket"}:
        return f"{obj} has six legs, antennae, wings, and a narrow-jointed body."
    if obj == "Flea":
        return "A flea is tiny and wingless, with powerful jumping legs."
    if obj in {"Gnat", "Mosquito", "Vinegar Fly"}:
        return f"{obj} is a small fly with six legs, antennae, and one wing pair."
    if obj in {"Katydid", "Stick Insect", "Kissing Bug", "Roach", "Earwig"}:
        return f"{obj} has six legs and a body shape that makes a clear clue."
    return f"{obj}: look for legs, wings, segments, web, or movement as the clue."


def _pet_fact(obj: str) -> str:
    if obj in PET_CARE_FACTS:
        return PET_CARE_FACTS[obj]
    if obj in PET_ANIMALS:
        if obj == "Angelfish":
            return "Angelfish is a freshwater fish with a tall flattened body, long fins, and gills for breathing underwater."
        if obj == "Fish":
            return "Fish breathe with gills and need clean, species-suitable water."
        if obj in {"Cat", "Kitten"}:
            return f"{obj} has whiskers, padded paws, retractable claws, and a flexible tail."
        if obj in {"Dog", "Puppy"}:
            return f"{obj} has padded paws and an exceptionally strong sense of smell."
        if obj == "Hamster":
            return "A hamster has cheek pouches and digging feet and needs safe space and enrichment."
        if obj == "Guinea Pig":
            return "A guinea pig is a tailless social rodent with a rounded body that needs species-appropriate food, space, and companionship."
        if obj == "Mouse":
            return "A pet mouse has whiskers, a long tail, quick feet, and needs a secure enriched enclosure."
        if obj in {"Rabbit", "Bunny"}:
            return f"{obj} has long ears and strong hind legs and needs room, suitable food, and gentle care."
        if obj == "Iguana":
            return "An iguana is a scaled lizard with claws and a long tail that needs a carefully designed reptile habitat."
        if obj == "Turtle":
            return "A pet turtle needs species-appropriate water or land space, temperature, light, and food."
        if obj in {"Yellow Canary", "Zebra Finch", "Quail"}:
            return _bird_fact(obj)
        return f"{obj} needs species-appropriate food, water, shelter, and careful adult-guided care."
    lower = obj.lower()
    if "bowl" in lower:
        return f"{obj} holds food or fresh water for a pet."
    if "brush" in lower:
        return f"{obj} helps a caregiver groom an animal's coat."
    if "clipper" in lower:
        return f"{obj} trims pet nails; an experienced adult handles it carefully."
    if "leash" in lower or "harness" in lower:
        return f"{obj} helps a caregiver guide a pet on a walk."
    if "bed" in lower or "hutch" in lower or "kennel" in lower or "doghouse" in lower or "carrier" in lower:
        return f"{obj} gives a pet a place to rest, shelter, travel, or stay safely."
    if "toy" in lower or obj in {"Jingle Ball", "Yarn Ball", "Wheel", "Exercise Wheel", "Scratching Post", "Perch"}:
        return f"{obj} gives an appropriate pet a way to play, climb, perch, scratch, or exercise."
    if obj == "ID Tag":
        return "An ID tag carries contact information that can help a lost pet be identified and returned."
    if obj == "UV Lamp":
        return "A UV lamp can provide ultraviolet light for certain reptiles when a knowledgeable adult sets up the habitat correctly."
    if obj == "Vet Kit":
        return "A vet kit holds tools a veterinarian may use to examine an animal's health."
    if obj == "X-ray Vet Image":
        return "An X-ray vet image lets a veterinarian look at bones and some structures inside an animal without surgery."
    if obj in {"Kibble", "Seed Mix", "Treat"}:
        return f"{obj} is a type of pet food; the correct kind and amount depend on the animal."
    if obj == "Litter Box":
        return "A litter box gives a cat or another suitable pet a designated place for toileting."
    if obj == "Ear Cleaner":
        return "Pet ear cleaner is a care product used only when appropriate and with adult or veterinary guidance."
    return f"{obj} has a pet-care job: feeding, housing, grooming, travel, ID, or play."


def _wildlife_fact(obj: str) -> str:
    special = {
        "Ape": "An ape is a tailless primate with grasping hands, forward-facing eyes, and long arms.",
        "Antelope": "An antelope is a hoofed herbivore with slender legs; many species have horns.",
        "Baboon": "A baboon is a ground-traveling monkey with a long muzzle and strong limbs.",
        "Bison": "A bison has massive shoulders, shaggy forequarters, hooves, and short curved horns.",
        "Camel": "A camel has broad padded feet and one or two fat-storing humps depending on the species.",
        "Deer": "A deer has hooves and slender legs; males of many species grow antlers.",
        "Dhole": "A dhole is a reddish Asian wild dog with rounded ears and a bushy tail.",
        "Elephant": "An elephant is a huge plant-eating mammal with a trunk, tusks in many adults, and broad padded feet.",
        "Fox": "A fox has a pointed muzzle, upright ears, light paws, and a bushy tail.",
        "Gorilla": "A gorilla is the largest living primate, with long arms and a powerful knuckle-walking body.",
        "Hyena": "A hyena has strong jaws, rounded ears, and a back that often slopes downward toward the hindquarters.",
        "Ibex": "An ibex is a mountain goat with sure-footed hooves and large backward-curving horns.",
        "Jackal": "A jackal is a slender wild canid with pointed ears, a narrow muzzle, and a bushy tail.",
        "Jaguar": "A jaguar is a stocky big cat with powerful paws and a coat patterned with dark rosettes.",
        "Kangaroo": "A kangaroo has powerful hind legs, large feet, and a long balancing tail.",
        "Lemur": "A lemur is a Madagascar primate with grasping hands; many species have long tails.",
        "Lion": "A lion is a large cat with a tawny coat; adult males often grow a prominent mane.",
        "Meerkat": "A meerkat is a small mongoose relative that often stands upright on its hind legs to watch its surroundings.",
        "Monkey": "A monkey is a primate with grasping hands and agile limbs; many use a tail for balance.",
        "Nyala": "A nyala is an African antelope with pale vertical body stripes; adult males have long spiral horns.",
        "Puma": "A puma is a large tawny cat with a long balancing tail and powerful hind legs.",
        "Seal": "A seal is a streamlined marine mammal with flippers; true seals lack external ear flaps.",
        "Serval": "A serval is a long-legged spotted African cat with especially large ears.",
        "Tiger": "A tiger is a large cat with dark vertical stripes over orange-and-pale fur.",
        "Urial": "An urial is a wild sheep of dry hills and mountains; adult males grow large curved horns.",
        "Wolf": "A wolf is a large wild canid with long legs, a strong muzzle, upright ears, and a bushy tail.",
        "Yak": "A yak is a high-altitude bovine with a shaggy coat, sturdy legs, and horns in both wild and many domestic forms.",
        "Yellow Mongoose": "A yellow mongoose is a small southern African mammal with pale fur and a long tail.",
        "Zebra": "A zebra is an African equid with black-and-white stripes, a short upright mane, and hooves.",
        "Giraffe": "A giraffe is a very tall African mammal with a long neck and long legs.",
        "Cheetah": "A cheetah is a slender spotted cat built for very fast running over short distances.",
        "Hippo": "A hippopotamus is a large semi-aquatic mammal that spends much of the day in water or mud.",
        "Koala": "A koala is an Australian marsupial that climbs eucalyptus trees and eats mainly eucalyptus leaves.",
        "Panda": "A giant panda is a bear with black-and-white fur that eats mostly bamboo.",
        "Red Panda": "A red panda is a small tree-climbing mammal with reddish fur and a long ringed tail.",
        "Rhino": "A rhinoceros is a large thick-skinned mammal with one or two horns made of keratin on its snout.",
        "Walrus": "A walrus is a large marine mammal with flippers, whiskers, and long tusks in adults.",
        "Xerus": "A xerus is an African ground squirrel that lives in open dry habitats.",
        "Uakari": "A uakari is a rainforest monkey with a short tail and a distinctive bare face.",
        "Vicuna": "A vicuna is a slender South American camelid adapted to high Andean grasslands.",
        "Zebu": "A zebu is a type of cattle with a noticeable hump over the shoulders.",
        "Quokka": "A quokka is a small Australian marsupial with rounded ears and strong hind legs.",
        "Okapi": "An okapi is a forest-dwelling relative of the giraffe with striped markings on its legs.",
        "Tapir": "A tapir is a plant-eating mammal with a short flexible snout and sturdy body.",
        "Nile Crocodile": "A Nile crocodile is a large African reptile with powerful jaws and a long armored body; we observe it only from a safe distance.",
        "Xenopus": "Xenopus is an aquatic frog with webbed hind feet and eyes positioned high on its head.",
    }
    if obj in special:
        return special[obj]
    if obj in WILDLIFE_BIRDS:
        return _bird_fact(obj)
    if obj in WILDLIFE_HERP:
        return f"{obj}: body covering, limbs, and movement reveal a reptile or amphibian clue."
    if obj in WILDLIFE_PRIMATES:
        return _pick(obj, (
            f"{obj} is a primate; hands, face, and posture make strong clues.",
            f"{obj} is a primate; grasping hands and body shape give the clue.",
            f"{obj}: primate hands, face, and movement identify it.",
        ))
    if obj in WILDLIFE_CATS:
        return _pick(obj, (
            f"{obj} is a wild cat; paws, tail, and coat pattern give clues.",
            f"{obj} has a cat-like body, padded paws, and a balancing tail.",
            f"{obj}: wild-cat silhouette, paws, ears, and markings give the clue.",
        ))
    if obj in WILDLIFE_CANIDS:
        return _pick(obj, (
            f"{obj} is a wild canid; muzzle, ears, paws, and tail reveal it.",
            f"{obj} has a dog-family silhouette with a long muzzle and paws.",
            f"{obj}: ears, muzzle, and tail make the canid clue.",
        ))
    if obj in WILDLIFE_HOOFED:
        return _pick(obj, (
            f"{obj} is hoofed wildlife; legs, hooves, and head shape identify it.",
            f"{obj}: sturdy legs and hooves anchor the clue.",
            f"{obj} walks on hooves; horns, ears, or neck add the clue.",
        ))
    if obj in WILDLIFE_MARSUPIALS:
        return _pick(obj, (
            f"{obj} is a marsupial; ears, paws, body shape, and movement give clues.",
            f"{obj}: marsupial body shape and strong limbs help us recognize it.",
        ))
    if obj in WILDLIFE_SMALL:
        return _pick(obj, (
            f"{obj} is a smaller wild mammal; ears, paws, tail, and ground-level movement give clues.",
            f"{obj}: small body, quick feet, and habitat make the picture clue.",
        ))
    if obj in WILDLIFE_MAMMALS:
        return _pick(obj, (
            f"{obj} is a wild mammal; body shape and habitat give the clue.",
            f"{obj}: coat, feet, ears, and movement help us recognize it.",
            f"{obj} has a mammal silhouette shaped by the habitat where it lives.",
        ))
    return f"{obj} is wildlife; body shape and habitat help us recognize it from afar."


HERP_FACTS = {
    "Axolotl": "An axolotl is an aquatic salamander that usually keeps feathery external gills as an adult.",
    "Alligator": "An alligator is a large semi-aquatic reptile with armored skin, a broad snout, and a powerful tail.",
    "Boa": "A boa is a heavy-bodied snake that coils its muscular body around supports or prey.",
    "Bullfrog": "A bullfrog is a large frog with powerful hind legs and a broad head, closely tied to ponds and wetlands.",
    "Chameleon": "A chameleon is a lizard with grasping feet, independently moving eyes, and a curling tail; many species can shift skin color.",
    "Crocodile": "A crocodile is a large semi-aquatic reptile with armored skin, a long snout, and a powerful tail.",
    "Dart Frog": "A dart frog is a small frog with moist skin; many species have vivid warning colors.",
    "Dragon Lizard": "This dragon-lizard target is a scaled lizard picture with four limbs, claws, and a long tail.",
    "Eastern Newt": "An eastern newt is a salamander with a long tail and moist skin; adults often return to water.",
    "Emerald Tree Boa": "An emerald tree boa is a green tree-dwelling snake that often rests coiled over branches.",
    "Frilled Lizard": "A frilled lizard has a large folded neck frill that can spread outward when the animal displays.",
    "Frog": "A frog has moist skin and powerful hind legs; many frogs also have webbed feet for swimming.",
    "Garter Snake": "A garter snake is a slender snake with a long body; many species show lengthwise stripes.",
    "Gecko": "A gecko is a lizard; many species have specialized toe pads that help them cling to surfaces.",
    "Hellbender": "A hellbender is a large fully aquatic salamander with a flattened body and wrinkled skin along its sides.",
    "Horned Lizard": "A horned lizard has a broad flattened body and pointed horn-like scales around the head.",
    "Iguana": "An iguana is a scaled lizard with claws, a long tail, and a row of spines along the back in familiar species.",
    "Italian Newt": "An Italian newt is a small salamander with moist skin, four limbs, and a swimming tail.",
    "Jackson Chameleon": "A Jackson chameleon has grasping feet, a curling tail, and males commonly carry three horn-like projections on the head.",
    "Jumping Frog": "This jumping-frog target is a frog with moist skin and strong hind legs built for hopping.",
    "King Cobra": "A king cobra is a long venomous snake that can spread a neck hood; it is observed only from a safe distance.",
    "Komodo Dragon": "A Komodo dragon is a very large monitor lizard with strong limbs, claws, rough scales, and a long tail.",
    "Leopard Gecko": "A leopard gecko is a ground-dwelling gecko with spotted skin, movable eyelids, and clawed toes rather than adhesive toe pads.",
    "Lizard": "A lizard is a scaled reptile typically with four limbs, clawed feet, and a long tail.",
    "Monitor Lizard": "A monitor lizard has a long body, strong limbs, claws, a muscular tail, and a long forked tongue.",
    "Mudpuppy": "A mudpuppy is an aquatic salamander that keeps bushy external gills as an adult.",
    "Newt": "A newt is a salamander with moist skin and a tail; many species spend part of life in water.",
    "Nile Crocodile": "A Nile crocodile is a large African reptile with armored skin, powerful jaws, and a strong swimming tail.",
    "Olive Python": "An olive python is a large Australian python with a long muscular body and smooth olive-brown coloring.",
    "Ornate Box Turtle": "An ornate box turtle has a high domed shell patterned with yellow lines or spots and sturdy walking feet.",
    "Poison Frog": "A poison-frog target is a small moist-skinned frog; many poison-dart frogs show bright warning colors.",
    "Python": "A python is a nonvenomous constricting snake with a long muscular body and no limbs.",
    "Queen Snake": "A queen snake is a slender semi-aquatic snake often found around streams and other freshwater habitats.",
    "Queensland Frog": "This Queensland-frog target is a moist-skinned frog with strong hind legs for hopping or swimming.",
    "Rattlesnake": "A rattlesnake is a venomous pit viper with a segmented rattle at the tail tip; it is picture-only here.",
    "Red-eyed Tree Frog": "A red-eyed tree frog has bright red eyes, adhesive toe pads, and long legs for climbing among leaves.",
    "Salamander": "A salamander is an amphibian with moist skin, four limbs, and a long tail.",
    "Skink": "A skink is a smooth-scaled lizard, often with a long body, short legs, and a tapering tail.",
    "Toad": "A toad is a frog with relatively dry-looking bumpy skin and strong hind legs for short hops.",
    "Turtle": "A turtle is a reptile with a hard bony shell protecting the body.",
    "Uromastyx": "A uromastyx is a sturdy lizard with a thick tail covered in rings of spiny scales.",
    "Urutu Snake": "An urutu is a venomous pit viper with a stout body and bold dark side markings; it is picture-only here.",
    "Veiled Chameleon": "A veiled chameleon has grasping feet, a curling tail, and a tall helmet-like casque on the head.",
    "Viper": "A viper is a venomous snake with a stout body and prominent fangs; it is picture-only here.",
    "Water Dragon": "A water dragon is a long-tailed lizard with strong limbs that lives near water and can swim well.",
    "Wood Frog": "A wood frog is a moist-skinned frog with a dark mask-like stripe through each eye.",
    "Xenopus": "Xenopus is an aquatic frog with webbed hind feet and eyes positioned high on its head.",
    "Xenosaurus": "A xenosaurus is a rough-scaled lizard with a broad head and strong limbs adapted to rocky or crevice habitats.",
    "Yellow Anaconda": "A yellow anaconda is a large semi-aquatic boa with yellowish coloring patterned by dark blotches.",
    "Yellow-bellied Slider": "A yellow-bellied slider is a freshwater turtle with a dark shell and yellow markings, including yellow on the underside.",
    "Zebra Skink": "This zebra-skink target is a smooth-scaled skink picture with striped body patterning.",
    "Zigzag Salamander": "This zigzag-salamander target is a moist-skinned salamander with four limbs and a long tail.",
}


def _herp_fact(obj: str) -> str:
    if obj in HERP_FACTS:
        return HERP_FACTS[obj]
    lower = obj.lower()
    if any(word in lower for word in ("frog", "toad", "newt", "salamander")):
        return f"{obj} is a moist-skinned amphibian with a body plan tied to water or damp habitats."
    if any(word in lower for word in ("turtle", "slider")):
        return f"{obj} is a shelled reptile."
    if any(word in lower for word in ("crocodile", "alligator")):
        return f"{obj} is a large semi-aquatic reptile with armored skin and a strong tail."
    if any(word in lower for word in ("snake", "boa", "python", "viper", "anaconda", "urutu")):
        return f"{obj} is a limbless reptile with a long muscular body."
    if any(word in lower for word in ("lizard", "gecko", "chameleon", "skink", "uromastyx", "xenosaurus", "iguana")) or obj == "Komodo Dragon":
        return f"{obj} is a scaled lizard-type reptile; feet, tail, head, and pattern give clues."
    return f"{obj}: use skin, scales, shell, limbs, tail, and habitat as identification clues."


PRODUCE_FACTS = {
    "Apple": "An apple is a round-to-oval fruit with skin, crisp flesh, and a seed-filled core.",
    "Apricot": "An apricot is a small orange stone fruit with soft skin and one hard pit inside.",
    "Banana": "A banana is a long curved fruit with a peel around soft flesh.",
    "Beet": "A beet has a rounded edible root below the soil and leafy stems above.",
    "Carrot": "A carrot is a long edible root that grows below the soil with feathery leaves above.",
    "Cherry": "A cherry is a small round stone fruit with one hard pit inside.",
    "Daikon": "Daikon is a long pale radish root that grows below the soil with leafy tops above.",
    "Date": "A date is an oval fruit with wrinkled skin around sweet flesh and one elongated stone.",
    "Eggplant": "An eggplant is a smooth-skinned fruit that often appears purple and elongated, with many small seeds inside.",
    "Endive": "Endive is leafy produce with crisp leaves arranged in a head or loose rosette, depending on type.",
    "Fennel": "Fennel has a pale layered bulb-like base, upright stalks, and feathery leaves.",
    "Fig": "A fig is a soft fruit with thin skin and many tiny seeds packed inside.",
    "Grapes": "Grapes are small fruits that grow together in bunches on vines.",
    "Guava": "Guava is a round or oval fruit with fragrant flesh and many small seeds inside.",
    "Honeydew": "Honeydew is a round melon with a smooth pale rind and light green flesh.",
    "Horseradish": "Horseradish is grown for its long pale pungent root below the soil.",
    "Indian Fig": "Indian fig is a prickly-pear cactus fruit with colored skin and many small seeds inside.",
    "Iceberg Lettuce": "Iceberg lettuce forms a tight round head of crisp pale-green leaves.",
    "Jackfruit": "Jackfruit is a very large fruit with a rough bumpy rind and many yellow fleshy pods inside.",
    "Jalapeno": "A jalapeno is a narrow chile pepper with smooth skin and a hollow seeded center.",
    "Kale": "Kale is leafy produce with broad leaves that may be flat, ruffled, or curly.",
    "Kiwi": "A kiwi fruit is small and oval, with brown fuzzy skin, green or golden flesh, and many tiny black seeds.",
    "Leek": "A leek has long flat green leaves and a pale layered lower stalk.",
    "Lemon": "A lemon is a yellow citrus fruit with fragrant peel and juicy segments inside.",
    "Mango": "A mango is a smooth-skinned stone fruit with juicy flesh around one large flat pit.",
    "Melon": "A melon is a rounded fruit with a firm rind around juicy flesh and a seeded center.",
    "Nectarine": "A nectarine is a smooth-skinned stone fruit related to the peach, with one hard pit inside.",
    "Napa Cabbage": "Napa cabbage forms a pale-green leafy head with broad crinkled leaves.",
    "Okra": "Okra is a green ridged pod with rows of round seeds inside.",
    "Orange": "An orange is a citrus fruit with a peel around wedge-shaped juicy segments.",
    "Peach": "A peach is a stone fruit with fuzzy skin and one hard pit inside.",
    "Pumpkin": "A pumpkin has a firm often-ribbed rind around flesh and a hollow center filled with seeds.",
    "Quince": "A quince is a firm yellow stone-free pome fruit shaped somewhat like an apple or pear, with a seed core.",
    "Radish": "A radish is an edible root that grows below the soil with leafy tops above.",
    "Raspberry": "A raspberry is made of many tiny connected drupelets forming one soft clustered fruit.",
    "Spinach": "Spinach is leafy produce with smooth to slightly crinkled green leaves on tender stems.",
    "Strawberry": "A strawberry has red flesh with many tiny seed-like achenes visible on the outside surface.",
    "Tomato": "A tomato has smooth skin around juicy flesh divided into seed-filled chambers.",
    "Turnip": "A turnip has a rounded edible root below the soil and leafy greens above.",
    "Vanilla Bean": "A vanilla bean is a long narrow cured seed pod from a vanilla orchid.",
    "Watercress": "Watercress has small rounded green leaves on tender branching stems and grows in wet places.",
    "Watermelon": "A watermelon has a hard green rind around juicy flesh and many seeds or seedless seed traces.",
    "Yellow Pepper": "A yellow pepper is a hollow sweet pepper with smooth yellow walls and pale seeds clustered inside.",
    "Yam": "A yam is an underground tuber with rough skin around starchy flesh.",
    "Zucchini": "A zucchini is a long green summer squash with pale flesh and soft seeds inside.",
}


def _produce_fact(obj: str) -> str:
    if obj in PRODUCE_SPECIAL:
        return PRODUCE_SPECIAL[obj]
    if obj in PRODUCE_FACTS:
        return PRODUCE_FACTS[obj]
    lower = obj.lower()
    if obj in {"Carrot", "Daikon", "Radish", "Turnip", "Beet", "Yam"}:
        return f"{obj} grows food below the soil, with leafy growth reaching above."
    if obj == "Grapes":
        return "Grapes are fruits that grow together in bunches on vines."
    if obj in {"Kale", "Endive", "Spinach", "Watercress", "Iceberg Lettuce", "Napa Cabbage"}:
        return f"{obj} is leafy produce; leaf shape and texture make the clue."
    if obj in {"Apple", "Apricot", "Banana", "Cherry", "Date", "Fig", "Grapes", "Guava", "Honeydew", "Jackfruit", "Kiwi", "Lemon", "Mango", "Melon", "Nectarine", "Orange", "Peach", "Quince", "Raspberry", "Strawberry", "Watermelon"}:
        return f"{obj} is fruit; skin, shape, color, seeds, or segments give the clue."
    if obj in {"Eggplant", "Jalapeno", "Okra", "Pumpkin", "Tomato", "Yellow Pepper"}:
        return f"{obj} grows from a flower with seeds inside; shape and color give the clue."
    if obj in {"Fennel", "Horseradish", "Leek", "Vidalia Onion", "Vanilla Bean"}:
        return f"{obj} has a distinctive bulb, stem, root, pod, or layered shape."
    return f"{obj} is plant produce; shape, color, skin, leaf, stem, or texture tells it apart."


BAKERY_FACTS = {
    "Angel Cake": "Angel cake is a light sponge-style cake recognized by its tall shape and airy crumb.",
    "Apple Pie": "Apple pie has a pastry crust around an apple filling, often with a top crust or lattice.",
    "Bread": "Bread is a baked loaf with a crust outside and crumb inside.",
    "Brownie": "A brownie is a dense flat chocolate cake-bar often cut into squares or rectangles.",
    "Cookie": "A cookie is a small flat baked item whose outline and surface texture make clear picture clues.",
    "Cupcake": "A cupcake is a small cake baked in an individual paper or cup-shaped wrapper, often with a topping.",
    "Danish": "A Danish pastry shows flaky folded or layered dough, often surrounding a visible filling.",
    "Donut": "A donut is a fried or baked dough treat often shaped as a ring or filled round.",
    "Eclair": "An eclair is an oblong choux pastry filled inside and often finished with icing or glaze on top.",
    "Egg Tart": "An egg tart has a small pastry shell holding a smooth egg-custard filling.",
    "Frosting": "Frosting is a thick spreadable topping that can form swirls or smooth layers on cakes.",
    "Fruitcake": "Fruitcake is a dense cake with visible dried or candied fruit pieces through the crumb.",
    "Gingerbread": "Gingerbread can be baked as a loaf, cake, or shaped cookie; its brown spiced crumb and outline are useful picture clues.",
    "Glaze": "Glaze is a thin smooth coating that dries shiny or translucent over a baked item.",
    "Honey Bun": "A honey bun is a soft coiled or rolled sweet bun often finished with a thin glaze.",
    "Hot Cross Bun": "A hot cross bun is a round yeasted bun marked with a visible cross on top.",
    "Ice Cream": "Ice cream is a frozen dessert served as scoops, swirls, bars, or portions; it is not a baked pastry.",
    "Icing": "Icing is a sweet finish spread, piped, or drizzled onto cakes and pastries.",
    "Jam Tart": "A jam tart has a shallow pastry shell holding a visible jam filling.",
    "Jelly Donut": "A jelly donut is a filled round donut with fruit jelly or jam inside.",
    "Kaiser Roll": "A Kaiser roll is a round bread roll recognized by its segmented star-like pattern on top.",
    "Kolache": "A kolache is a small yeasted pastry with a visible center or enclosed filling, depending on style.",
    "Lemon Tart": "A lemon tart has a pastry shell filled with a smooth lemon filling.",
    "Loaf": "A loaf is bread baked as one larger piece, with crust outside and crumb inside.",
    "Macaron": "A macaron has two smooth round almond-meringue shells with a filling sandwiched between them.",
    "Muffin": "A muffin has a cup-shaped base and a rounded baked top with a crumb inside.",
    "Napoleon Pastry": "A Napoleon pastry shows many thin flaky pastry layers separated by cream or filling.",
    "Nut Bread": "Nut bread is a loaf with visible nut pieces mixed through the crumb.",
    "Oat Cookie": "An oat cookie is a flat cookie with visible oat flakes or rough oat texture on the surface.",
    "Orange Cake": "Orange cake is a cake whose sponge or topping is flavored with orange; layers, crumb, and citrus decoration are visual clues.",
    "Pie": "A pie has a pastry crust holding a filling, sometimes with a top crust or decorative edge.",
    "Pretzel": "A pretzel is a baked bread item twisted into a distinctive looped knot shape.",
    "Queen Cake": "A queen cake is a small sponge-style cake often baked as an individual portion.",
    "Quiche": "A quiche is a savory tart with a pastry crust and egg-based filling.",
    "Raisin Bread": "Raisin bread is a loaf with visible raisins dotted through the crumb.",
    "Roll": "A bread roll is a small individual bread piece with crust outside and soft crumb inside.",
    "Scone": "A scone is a small baked quick bread often shaped as a round, wedge, or thick disk.",
    "Sprinkles": "Sprinkles are tiny decorative pieces scattered over frosting, icing, or other surfaces.",
    "Tart": "A tart has a shallow pastry shell with an open filling visible on top.",
    "Toast": "Toast is a slice of bread browned by dry heat, showing a flat slice shape and browned surface.",
    "Ube Roll": "An ube roll is a rolled cake with a spiral cross-section and purple ube-colored sponge or filling.",
    "Upside-down Cake": "An upside-down cake displays fruit or another topping on the top surface after the cake is turned out.",
    "Vanilla Cake": "Vanilla cake is a sponge-style cake whose layers, crumb, frosting, or slice shape provide the picture clues.",
    "Victoria Sponge": "Victoria sponge has two sponge-cake layers with jam and cream or buttercream between them.",
    "Waffle": "A waffle is cooked batter pressed into a surface with a distinctive square grid pattern.",
    "Wholegrain Bread": "Wholegrain bread is a loaf whose crumb and crust may show darker grain flecks or seeds.",
    "X-shaped Pretzel": "An X-shaped pretzel uses pretzel dough crossed into a clear X-like outline.",
    "Xmas Cookie": "An Xmas cookie is a shaped or decorated cookie identified by its outline and surface decoration.",
    "Yeast Roll": "A yeast roll is a small risen bread roll with a rounded or folded shape and soft crumb.",
    "Yule Log": "A yule-log cake is a rolled cake shaped like a log, with a visible spiral when sliced.",
    "Zebra Cake": "Zebra cake shows alternating light and dark cake batter forming stripe-like patterns inside.",
    "Zucchini Bread": "Zucchini bread is a quick-bread loaf with a crust outside and soft crumb containing grated zucchini.",
}


def _bakery_fact(obj: str) -> str:
    if obj in BAKERY_FACTS:
        return BAKERY_FACTS[obj]
    lower = obj.lower()
    if obj == "Ice Cream":
        return "Ice Cream frozen scoop | smooth cold swirl makes the picture loop"
    if obj in {"Frosting", "Icing", "Glaze", "Sprinkles"}:
        return f"{obj} finishes the top; texture and surface pattern make the picture clue."
    if "bread" in lower or "loaf" in lower or "roll" in lower or obj in {"Pretzel", "X-shaped Pretzel", "Scone", "Hot Cross Bun", "Honey Bun"}:
        return f"{obj} is bread-like; crust, crumb, fold, score, or shape gives it away."
    if "cake" in lower or obj in {"Brownie", "Cupcake", "Muffin", "Yule Log", "Victoria Sponge"}:
        return f"{obj} is cake-like; layers, crumb, wrapper, topping, or shape set it apart."
    if any(word in lower for word in ("tart", "pie", "quiche", "danish", "eclair", "pastry", "kolache")):
        return f"{obj} is pastry-like; crust, layer, filling, fold, or outline gives the clue."
    if "cookie" in lower or obj == "Macaron" or obj == "Donut" or obj == "Waffle":
        return f"{obj} stands out by its baked shape and surface pattern."
    return f"{obj}: crust, crumb, layer, topping, fold, swirl, or outline gives the clue."


SPACE_ACTIONS = {
    "Asteroid": "Make a tiny rocky fist, then trace its path.",
    "Black Hole": "Draw a small dark circle in the air, then point inward.",
    "Comet": "Sweep one hand past with a long pretend tail.",
    "Dwarf Planet": "Make a small round world, then circle one finger around it.",
    "Earth": "Make a round Earth with both hands, then point home.",
    "Flag": "Wave one empty hand gently like a flag.",
    "Gemini Capsule": "Cup both hands into a small capsule shape.",
    "Helmet": "Frame your head with two hands like a helmet.",
    "International Space Station": "Stretch both hands wide, then trace one orbit.",
    "Jet Pack": "Hold two hands by your sides, then make one tiny upward puff motion.",
    "Krypton Tank": "Make a tall tank shape with both hands, then point.",
    "Lander": "Lower one flat hand slowly until it lands.",
    "Meteor": "Streak one finger downward like a flash of light.",
    "Neptune": "Make a big blue-world circle, then sway it far away.",
    "Orbit": "Trace one clean circle around an imaginary world.",
    "Planet": "Make one large round world with both hands.",
    "Quarter Moon": "Show a half-lit moon shape with one curved hand.",
    "Rocket": "Point upward, then lift one hand like a slow launch.",
    "Satellite": "Circle one finger around your other fist like a satellite.",
    "Telescope": "Make pretend binoculars, then look far away.",
    "Uranus": "Tilt a round hand-shape sideways, then slowly turn it.",
    "Visor": "Shade your eyes with one flat hand like a visor.",
    "World": "Make a round world, then hold it still in the picture frame.",
    "X-ray Telescope": "Pretend to aim a telescope high, then point to the X-ray picture.",
    "Yoke": "Hold an imaginary control, then make one gentle turn.",
    "Zero-gravity Chair": "Lean your hands back together like a reclining chair shape.",
    "Astronaut": "Float two hands slowly, then point to the astronaut.",
    "Booster": "Lift one fist under the other like extra launch power.",
    "Eclipse": "Slide one round hand slowly in front of the other.",
    "Fuel Tank": "Make a tall tank outline with both hands, then point only.",
    "Galaxy": "Spiral one finger outward like a galaxy arm.",
    "Io": "Make a tiny moon circle, then tap two pretend volcano spots.",
    "Jupiter": "Make the biggest round world you can with both hands.",
    "Kuiper Belt": "Trace a wide ring far around an imaginary Sun.",
    "Lunar Rover": "Roll two finger-wheels slowly across the table-air.",
    "Moon": "Make a round moon, then turn one side toward the light.",
    "Observatory": "Make a dome with both hands, then aim a pretend telescope.",
    "Probe": "Send one finger forward like a small robot explorer.",
    "Rover": "Roll two finger-wheels across an imaginary planet.",
    "Universe": "Open both arms wide, then hold the huge space around you.",
    "Venus": "Make a round planet, then wrap it in a thick-cloud hug.",
    "Xenon Thruster": "Point to the thruster, then make one tiny backward puff with your fingers.",
    "Capsule": "Cup both hands into a compact capsule shape.",
    "Dish Antenna": "Curve one palm like a dish, then aim it toward the sky.",
    "Hubble Telescope": "Make a long telescope tube with both hands, then look outward.",
    "Nebula": "Spread your fingers like a soft cloud of gas and dust.",
    "Quasar": "Make one tiny bright point, then spread a big glow around it.",
    "Thruster": "Point behind an imaginary spacecraft, then make one small push-back motion.",
    "White Dwarf": "Pinch a tiny bright star between two fingers, then hold it still.",
    "Yellow Star": "Open one hand like a bright starburst, then point.",
    "Zodiac Chart": "Trace one curved band across an imaginary sky chart.",
    "Spacesuit": "Pat your shoulders and chest like a protective suit outline.",
}


def _action_for(domain: str, obj: str) -> str:
    if domain == "space":
        return SPACE_ACTIONS.get(obj, "Point to one clear shape or motion clue, then freeze.")
    if domain == "dinosaur":
        dino_actions = {
            "Ankylosaurus": "Show armor, then swing one tiny tail-club arc.",
            "Brachiosaurus": "Stretch one arm up like a long neck.",
            "Carnotaurus": "Hold two horn fingers above your eyes.",
            "Ceratopsian": "Frame a wide frill; add two horn fingers.",
            "Deinonychus": "Curl one sickle-claw finger; take two light steps.",
            "Diplodocus": "Trace long neck forward, long tail behind.",
            "Edmontosaurus": "Make a broad duck-bill with flat hands.",
            "Gastonia": "Trace low armor and side spikes.",
            "Giganotosaurus": "Show a huge head; take two heavy steps.",
            "Hadrosaur": "Make a broad duck-bill with flat hands.",
            "Herrerasaurus": "Take two quick steps; balance a pretend tail.",
            "Iguanodon": "Lift one thumb like a thumb spike.",
            "Irritator": "Make a long narrow snout with two hands.",
            "Kentrosaurus": "Trace back plates; flick two tail-spike fingers.",
            "Kritosaurus": "Make a broad duck-bill; sweep its body shape.",
            "Lambeosaurus": "Curve one hand overhead like a tall crest.",
            "Lesothosaurus": "Make two tiny running finger-steps.",
            "Maiasaura": "Cup a nest; make a gentle duck-bill.",
            "Nodosaurus": "Trace low armor—no tail club.",
            "Ornithomimus": "Run two long finger-legs, ostrich-style.",
            "Oviraptor": "Make a beak, then cup a nest.",
            "Pachycephalosaurus": "Make a round dome above your head.",
            "Qianzhousaurus": "Stretch a long narrow snout forward.",
            "Raptor": "Curl one finger like a toe claw; freeze.",
            "Spinosaurus": "Raise one hand like a tall back sail.",
            "Stegosaurus": "Show a row of plates, then tail spikes.",
            "Triceratops": "Show three horns, then frame a broad frill.",
            "Tyrannosaurus": "Show a huge jaw and two tiny forearms.",
            "Unenlagia": "Open feathered arms; take two light steps.",
            "Utahraptor": "Show one large toe claw; take two strong steps.",
            "Velociraptor": "Open feathered arms; curl one sickle-claw finger.",
            "Wannanosaurus": "Make a small skull dome; take two tiny steps.",
            "Wuerhosaurus": "Trace back plates, then a tail spike.",
            "Xenoceratops": "Frame a large frill; show horn shapes.",
            "Xixiasaurus": "Make a slender snout; take two bird-like steps.",
            "Yinlong": "Make a small beak; take two tiny steps.",
            "Yutyrannus": "Brush feathered arms; show a large body.",
            "Zephyrosaurus": "Make two light running finger-steps.",
            "Zuniceratops": "Show two brow horns; frame a small frill.",
        }
        if obj in dino_actions:
            return dino_actions[obj]
        if obj in {"Bone", "Jawbone", "Rib Bone", "Fossil", "Footprint"}:
            return _pick(obj, ("Brush the air gently like a fossil helper, then point.", "Trace the fossil shape with one finger.", "Tap two tiny footprint beats, then show the picture."))
        if obj == "Egg":
            return "Make a small oval shell with both hands, then point."
        if obj == "Nest":
            return "Cup both hands like a shallow nest, then point."
        if obj == "Jurassic Fern":
            return "Uncurl one hand like a fern frond, then point."
        if obj == "Volcano":
            return "Make a wide mountain shape with both hands, then point."
        if obj in {"Pteranodon", "Quetzalcoatlus"}:
            return "Glide two gentle hand-wings once, then point to the pterosaur."
        if obj == "Mosasaurus":
            return "Glide one hand like a sea swimmer, then point."
        return _pick(obj, ("Tap two soft prehistoric footsteps.", "Trace head to tail in the air.", "Show its body size with both hands.", "Sway one pretend tail, then freeze."))
    if domain == "insect":
        insect_actions = {
            "Ant": "March six tiny finger-steps.",
            "Aphid": "Make a tiny leaf-sip point, then show six finger-legs.",
            "Bee": "Flutter two hand-wings, then point to a flower.",
            "Honeybee": "Flutter to a pretend flower, then brush two pollen dots.",
            "Queen Bee": "Make a long bee-body shape, then hold still.",
            "Beetle": "Close two hands like hard wing covers, then open them.",
            "Dung Beetle": "Roll a tiny pretend ball forward with two fingers.",
            "Jewel Beetle": "Close two shiny wing-cover hands, then flash them open.",
            "June Bug": "Close two wing-cover hands, then make one short flight arc.",
            "Hercules Beetle": "Show two opposing horn shapes, then a big beetle body.",
            "Rhinoceros Beetle": "Lift one horn finger, then show a round beetle body.",
            "Stag Beetle": "Open two curved finger-mandibles like antlers.",
            "Net-winged Beetle": "Trace a tiny crisscross pattern across two wing-cover hands.",
            "Weevil": "Stretch one finger forward like a long beetle snout.",
            "Xylophone Beetle": "Close two hands like beetle wing covers; point to the locked picture.",
            "Caterpillar": "Loop two fingers forward like a caterpillar body.",
            "Inchworm": "Arch two fingers up, then inch them forward.",
            "Earwig": "Make two tiny rear-pincer fingers, then freeze.",
            "Firefly": "Tap one pretend belly-light on, then off.",
            "Gnat": "Make one tiny flight circle with a fingertip.",
            "Mosquito": "Show long finger-legs, then one slender proboscis finger.",
            "Cricket": "Rub two fingertips softly, then lift long antenna fingers.",
            "Grasshopper": "Spring two finger-legs in one small hop.",
            "Leafhopper": "Make one quick sideways finger-hop from a pretend leaf.",
            "Katydid": "Lift long antenna fingers, then make one leaf-green hop shape.",
            "Mantis": "Fold two grasping forearms in front of your chest.",
            "Praying Mantis": "Fold two grasping forearms, then hold the triangular-head pose.",
            "Kissing Bug": "Trace a long narrow head, then point to the picture only.",
            "Roach": "Flatten one hand low and scurry two fingers once.",
            "Stick Insect": "Hold one finger straight like a twig and freeze.",
            "Termite": "Bring several tiny finger-steps together like a colony.",
            "Flea": "Make one tiny two-finger jump.",
            "Nymph": "Show a small version with your hands, then grow it slightly bigger.",
            "Orb Weaver": "Trace one round web with spoke lines.",
            "Pill Bug": "Curl one hand into a little ball.",
            "Dragonfly": "Hold two pairs of long hand-wings straight out.",
            "Wasp": "Pinch a narrow waist shape, then flutter once.",
            "Yellowjacket": "Show a striped body with two fingers, then flutter once.",
            "Xylocopa Bee": "Make a sturdy bee shape, then trace one short wood tunnel.",
            "Vinegar Fly": "Make one tiny fly loop, then land on a fingertip.",
        }
        if obj in insect_actions:
            return insect_actions[obj]
        if "butterfly" in obj.lower() or "moth" in obj.lower() or "longwing" in obj.lower():
            return "Open patterned hand-wings once, then fold them gently."
        return "Point to its clearest body or movement clue, then freeze."
    if domain == "bird":
        bird_actions = {
            "Nest": "Cup both hands into a nest; point to the eggs or chicks.",
            "Avocet": "Curve one finger upward like its bill; take two wading steps.",
            "Albatross": "Stretch very long wings and glide slowly.",
            "Bluebird": "Make one small perch, then flash two blue-wing shapes.",
            "Budgie": "Hook one finger like a parrot bill; perch two gripping toes.",
            "Cardinal": "Pinch a stout cone bill, then crack one pretend seed.",
            "Crane": "Stretch a long neck; take two tall wading steps.",
            "Dove": "Round both hands like a soft dove body; make one gentle perch.",
            "Duck": "Paddle two webbed feet with your fingers; show a broad bill.",
            "Eagle": "Hook one beak finger, then spread broad soaring wings.",
            "Egret": "Take two tall wading steps; point a long straight bill.",
            "Finch": "Pinch a tiny cone bill; peck one pretend seed.",
            "Goldfinch": "Pinch a seed bill; flick two bright wing patches.",
            "Flamingo": "Stand one finger-leg tall; bend a filtering bill shape.",
            "Goose": "Paddle two webbed feet, then stretch a long neck.",
            "Heron": "Stretch a long neck; aim one spear-like bill.",
            "Hummingbird": "Hover two tiny hand-wings quickly in one spot.",
            "Xantus Hummingbird": "Hover two tiny hand-wings quickly in one spot.",
            "Ibis": "Curve one long bill downward; take two wading steps.",
            "Indian Roller": "Open two bright-blue wing flashes, then perch.",
            "Jay": "Show one sturdy bill, then make a bold branch-hop.",
            "Junco": "Hop twice on the ground; pinch a small cone bill.",
            "Kingfisher": "Aim a pointed bill, then make one quick water-dive arc.",
            "Kiwi": "Walk two sturdy ground steps; trace one long bill.",
            "Lark": "Take two ground steps, then lift one small song-flight arc.",
            "Lorikeet": "Hook a parrot bill, then touch a pretend flower.",
            "Macaw": "Show a powerful curved bill and one long tail sweep.",
            "Magpie": "Sweep one long tail behind, then make a branch-hop.",
            "Nuthatch": "Walk two fingers downward along a pretend tree trunk.",
            "Ostrich": "Run two long ground steps—no flying gesture.",
            "Owl": "Make two big forward eyes, then spread silent wings once.",
            "Parrot": "Hook one strong bill; grip a pretend branch with two toes.",
            "Penguin": "Sweep two flipper-wings through pretend water.",
            "Quail": "Make a plump body shape; take two quick ground steps.",
            "Quetzal": "Sweep one long tail behind, then open bright forest wings.",
            "Raven": "Open broad black wings, then show one heavy bill.",
            "Robin": "Hop twice on the ground, then peck once.",
            "Sparrow": "Pinch a tiny seed bill, then make one short hop.",
            "Swan": "Curve one long neck; paddle two webbed feet.",
            "Tern": "Point narrow wings, then make one quick dive arc.",
            "Toucan": "Show one extra-large bill shape with both hands.",
            "Umbrellabird": "Arch one hand like an umbrella crest above your head.",
            "Upland Sandpiper": "Take two tall grassland steps; point a slender bill.",
            "Veery": "Make two quiet ground hops, then point to a softly spotted chest.",
            "Vulture": "Spread broad soaring wings and circle one slow turn.",
            "Woodpecker": "Tap two fingers on your palm like a tree trunk.",
            "Wren": "Make a tiny body and tilt one short tail upright.",
            "Xenops": "Walk two fingers along bark, then pick one tiny insect.",
            "Yellow Warbler": "Flutter once, then show a small bright-yellow body.",
            "Yellowhammer": "Show a yellow head patch, then pinch a seed bill.",
            "Zebra Finch": "Pinch a short seed bill; trace two little zebra bars.",
            "Zenaida Dove": "Make a compact dove body, then one pointed-wing glide.",
        }
        if obj in bird_actions:
            return bird_actions[obj]
        return "Point to its clearest bill, foot, tail, or habitat clue; freeze."
    if domain == "pet":
        pet_actions = {
            "Angelfish": "Glide one flat hand like a tall-finned fish.",
            "Fish": "Swim one hand slowly through the air.",
            "Cat": "Show whisker fingers, then one soft paw step.",
            "Kitten": "Show tiny whiskers, then one soft paw step.",
            "Dog": "Make one sniffing nose gesture, then a paw step.",
            "Puppy": "Sniff once; wag a finger-tail.",
            "Hamster": "Puff cheek pouches; run tiny finger-steps.",
            "Guinea Pig": "Make a round little body, then two short walking steps.",
            "Mouse": "Show whiskers and one long tail line, then scurry twice.",
            "Rabbit": "Lift long ear fingers; hop once.",
            "Bunny": "Lift two long ear fingers, then one gentle hop.",
            "Iguana": "Trace a long tail; take one low step.",
            "Turtle": "Make a shell dome; step slowly once.",
            "Quail": "Make a plump bird shape, then two ground steps.",
            "Yellow Canary": "Perch one hand, then show a tiny seed bill.",
            "Zebra Finch": "Perch one hand; trace two little chest bars.",
            "Aquarium": "Frame a tank; wave water inside.",
            "Bowl": "Cup both hands like a bowl.",
            "Meal Bowl": "Cup a bowl; point to one food portion.",
            "Water Bowl": "Cup a bowl; draw one water ripple.",
            "Doghouse": "Make a little roof with both hands.",
            "Hutch": "Frame a low enclosure shape with both hands.",
            "Quilt Bed": "Flatten both palms into a soft bed.",
            "Exercise Wheel": "Trace a wheel; run two finger-steps.",
            "Wheel": "Trace a wheel; run two finger-steps.",
            "Scratching Post": "Hold one hand tall like a post; stretch the other upward.",
            "Perch": "Hold one finger like a branch, then perch the other hand.",
            "Collar": "Trace a collar circle in the air; keep it off your neck.",
            "ID Tag": "Trace a small hanging tag shape.",
            "Leash": "Trace one long leash line in the air.",
            "Vest Harness": "Trace a vest shape around the pet picture.",
            "Zip Carrier": "Frame a carrier; close the pretend door.",
            "Outdoor Kennel": "Frame a secure kennel outline, then point to the shelter area.",
            "Jingle Ball": "Roll a pretend ball; stop on the beat.",
            "Feather Toy": "Flutter two pretend feathers with empty fingers.",
            "Jumping Toy": "Bounce one pretend toy twice, then freeze.",
            "Octopus Toy": "Wiggle eight pretend toy arms; freeze.",
            "Rope Toy": "Twist two empty hands like a rope; no real pulling.",
            "Yarn Ball": "Draw one yarn-ball circle in the air; no loose string.",
            "Xylophone Toy": "Tap three imaginary bars; stop.",
            "Grooming Brush": "Brush the air once beside the pet picture.",
            "Undercoat Brush": "Brush the air once; point to the coat picture.",
            "Kibble": "Point to pretend food pieces beside the bowl.",
            "Seed Mix": "Dot three tiny pretend seeds beside the bird picture.",
            "Treat": "Point to one tiny pretend treat portion.",
            "Litter Box": "Frame a shallow box shape, then point to it.",
            "Nest": "Cup both hands into a bird nest.",
        }
        if obj in pet_actions:
            return pet_actions[obj]
        if any(word in obj.lower() for word in ("clipper", "lamp", "cleaner", "vet", "x-ray")):
            return "Point only; name its job while an adult handles the real item."
        return "Point to the picture and mime only its safe visible shape or job."
    if domain == "wildlife":
        wildlife_actions = {
            "Ape": "Show grasping hands and long arms.",
            "Antelope": "Take two hoof-steps; curve horn shapes.",
            "Baboon": "Trace a long muzzle; show sturdy limbs.",
            "Bison": "Show massive shoulders and curved horns.",
            "Camel": "Make one hump; take two broad-foot steps.",
            "Cheetah": "Trace spots, then one running silhouette.",
            "Deer": "Take two hoof-steps; branch antler fingers.",
            "Dhole": "Show rounded ears, muzzle, and bushy tail.",
            "Elephant": "Curve a trunk arm; show broad feet.",
            "Emu": "Run two long ground steps—no flying gesture.",
            "Flamingo": "Stand one finger-leg tall; bend a filtering bill shape.",
            "Fox": "Point two upright ear fingers, then sweep one bushy tail.",
            "Giraffe": "Stretch a long neck; take two tall steps.",
            "Gorilla": "Show long arms in a knuckle-walk pose.",
            "Hippo": "Make a broad body; draw a water line.",
            "Hyena": "Show rounded ears, jaw, and sloping back.",
            "Ibex": "Curve horns backward; take two mountain steps.",
            "Iguana": "Trace scales and one long lizard tail; stay low.",
            "Jackal": "Show pointed ears, a narrow muzzle, and one bushy-tail sweep.",
            "Jaguar": "Dot rosettes; show a stocky cat body.",
            "Kangaroo": "Hop once; hold a long balancing tail.",
            "Koala": "Grip an imaginary tree trunk with both hands.",
            "Lemur": "Show grasping hands and a long tail.",
            "Lion": "Frame a mane; show large cat paws.",
            "Meerkat": "Stand two fingers upright like a lookout.",
            "Monkey": "Show grasping hands, then one agile branch reach.",
            "Nile Crocodile": "Trace armored back, snout, and tail from afar.",
            "Nyala": "Trace stripes; curve spiral horn shapes.",
            "Okapi": "Trace striped legs, then a giraffe-like head.",
            "Ostrich": "Run two long ground steps—no flying gesture.",
            "Panda": "Make round ear shapes; hold one bamboo line.",
            "Puma": "Show a tawny cat body and one long balancing tail.",
            "Quail": "Make a plump ground-bird shape; take two quick steps.",
            "Quokka": "Show two rounded ears, then one small hind-leg hop.",
            "Red Panda": "Trace a ringed tail; grip a branch.",
            "Rhino": "Show snout horns and a heavy body.",
            "Seal": "Sweep two flippers through pretend water.",
            "Serval": "Show huge ears, long legs, and spots.",
            "Tapir": "Curl a short snout; show a sturdy body.",
            "Tiger": "Trace stripes; show large cat paws.",
            "Uakari": "Frame a bare face; show grasping hands.",
            "Urial": "Curve sheep horns; take two hill steps.",
            "Vicuna": "Stretch a slender neck; take two light steps.",
            "Vulture": "Spread broad soaring wings and circle one slow turn.",
            "Walrus": "Show tusks, whiskers, and broad flippers.",
            "Wolf": "Show upright ears, muzzle, and bushy tail.",
            "Xenopus": "Hop once; spread webbed hind-foot shapes.",
            "Xerus": "Show a bushy tail; take two ground steps.",
            "Yak": "Ruffle shaggy-fur fingers, then show two horn curves.",
            "Yellow Mongoose": "Make a low body; sweep a long tail.",
            "Zebra": "Trace stripes; take two hoof-steps.",
            "Zebu": "Make a shoulder hump; show cattle horns.",
        }
        if obj in wildlife_actions:
            return wildlife_actions[obj]
        if obj in WILDLIFE_BIRDS:
            if obj in FLIGHTLESS_BIRDS:
                return "Take two grounded bird steps; point to the body clue."
            return "Use the bird's clearest bill, leg, wing, or ground clue; freeze."
        if obj in WILDLIFE_HERP:
            return "Trace its scale, skin, tail, or webbed-foot clue from afar."
        return "Point to one precise body clue from a safe observation spot."
    if domain == "herp":
        herp_actions = {
            "Axolotl": "Flutter gills; glide tail.",
            "Alligator": "Broad snout; armor; tail.",
            "Bullfrog": "Strong hop; webbed feet.",
            "Chameleon": "Curl tail; grasping feet; moving eyes.",
            "Crocodile": "Long snout; armor; tail.",
            "Dart Frog": "Tiny hop; bright pattern.",
            "Dragon Lizard": "Clawed feet; long tail.",
            "Eastern Newt": "Swim-tail; four small limbs.",
            "Emerald Tree Boa": "Green coil over a branch.",
            "Frilled Lizard": "Open neck frill; freeze.",
            "Frog": "Hop; spread webbed feet.",
            "Garter Snake": "Striped S-curve.",
            "Gecko": "Sticky toes on wall.",
            "Hellbender": "Flat body; wrinkled sides.",
            "Horned Lizard": "Flat body; head horns.",
            "Iguana": "Back spines; long tail.",
            "Italian Newt": "Swim-tail; four small limbs.",
            "Jackson Chameleon": "Three horns; grasping feet; curled tail.",
            "Jumping Frog": "One clear hop.",
            "King Cobra": "Hood wide; stay back.",
            "Komodo Dragon": "Large body; claws; tail.",
            "Leopard Gecko": "Spots; clawed ground toes.",
            "Lizard": "Clawed feet; long tail.",
            "Monitor Lizard": "Forked tongue; muscular tail.",
            "Mudpuppy": "Bushy gills; swim-tail.",
            "Newt": "Tail; four small limbs.",
            "Nile Crocodile": "Armor; long snout; tail.",
            "Olive Python": "Long olive S-curve.",
            "Ornate Box Turtle": "Domed shell; yellow lines.",
            "Poison Frog": "Tiny hop; warning colors.",
            "Python": "Long muscular S-curve.",
            "Queen Snake": "Slender stream-side S-curve.",
            "Queensland Frog": "Hop; strong hind legs.",
            "Rattlesnake": "S-curve; tail rattle; stay back.",
            "Red-eyed Tree Frog": "Red eyes; sticky toes.",
            "Salamander": "Four limbs; long tail.",
            "Skink": "Smooth body; short legs; tail.",
            "Toad": "Short hop; bumpy skin.",
            "Turtle": "Shell dome; slow step.",
            "Uromastyx": "Thick spiny tail rings.",
            "Urutu Snake": "Stout patterned S-curve; stay back.",
            "Veiled Chameleon": "Tall casque; curled tail; grasping feet.",
            "Viper": "Stout S-curve; stay back.",
            "Water Dragon": "Long tail; one swim stroke.",
            "Wood Frog": "Hop; dark eye mask.",
            "Xenopus": "Webbed feet; underwater glide.",
            "Xenosaurus": "Rough scales; broad head; strong limbs.",
            "Yellow Anaconda": "Thick S-curve; dark blotches.",
            "Yellow-bellied Slider": "Shell dome; yellow underside.",
            "Zebra Skink": "Smooth body; zebra-like stripes.",
            "Zigzag Salamander": "Four limbs; zigzag pattern.",
        }
        if obj in herp_actions:
            return herp_actions[obj]
        if any(word in obj.lower() for word in ("frog", "toad")):
            return "Hop once; point to a frog body clue."
        if any(word in obj.lower() for word in ("snake", "boa", "python", "viper", "anaconda", "urutu")):
            return "Trace one S-curve from a safe picture distance."
        if any(word in obj.lower() for word in ("turtle", "slider")):
            return "Make a shell dome; point."
        return "Trace its clearest scale, skin, limb, tail, or pattern clue."
    if domain == "kitchen":
        kitchen_actions = {
            "Apple": "Make a round apple; point to the core.",
            "Apron": "Trace an apron front and two tie straps.",
            "Bowl": "Cup both hands into a deep bowl.",
            "Cup": "Make a small cup shape with one handle.",
            "Cutting Board": "Flatten both palms into a board shape.",
            "Dish": "Trace a shallow plate or bowl circle.",
            "Donut": "Make a ring shape with both hands.",
            "Egg": "Make one oval shell shape.",
            "Egg Timer": "Trace a small timer dial; point to the picture.",
            "Fork": "Show four finger-tines; keep hands empty.",
            "Grapes": "Dot a small bunch of round grapes.",
            "Honey": "Draw one slow thick drip in the air.",
            "Ice Cream": "Make one scoop over an imaginary cone or cup.",
            "Ice Tray": "Trace a rectangle with little cube compartments.",
            "Jar": "Make a wide jar body and a lid circle.",
            "Ladle": "Make a long handle and deep scoop with empty hands.",
            "Lemon": "Make a yellow oval; point to segment wedges.",
            "Muffin": "Make a small round top over a wrapper shape.",
            "Napkin": "Fold one flat square in the air.",
            "Noodles": "Trace three long wavy strands.",
            "Orange": "Make a round peel; divide imaginary segments.",
            "Pancake": "Flatten one round pancake shape.",
            "Quiche": "Trace a round crust edge and wedge shape.",
            "Quart Cup": "Make a large measuring-cup outline; show four cup-count fingers.",
            "Rice": "Dot a tiny pile of grain shapes.",
            "Rolling Pin": "Roll two empty fists through the air—no real dough needed.",
            "Spatula": "Show a flat blade and handle with empty hands.",
            "Spoon": "Make one small bowl and handle shape.",
            "Toast": "Trace one flat bread rectangle with rounded top.",
            "Tongs": "Open and close two empty-hand tong arms once.",
            "Under-counter Drawer": "Draw a rectangle; slide it open in the air.",
            "Utensil": "Point to the utensil picture; trace its main silhouette.",
            "Vanilla": "Trace one long vanilla-pod shape.",
            "Waffle": "Draw a square or round waffle; cross a tiny grid.",
            "Whisk": "Trace a handle and looped whisk wires with empty hands.",
            "X-shaped Cookie Cutter": "Trace one big X outline in the air.",
            "Xylophone": "Tap three imaginary music bars—this one is not a kitchen tool.",
            "Yam": "Trace one long uneven tuber shape.",
            "Yogurt": "Cup a yogurt container; show a smooth surface.",
            "Zucchini": "Trace one long green squash shape.",
        }
        if obj in kitchen_actions:
            return kitchen_actions[obj]
        if obj in RISKY_KITCHEN:
            return "Point only; empty-hand mime while an adult handles the real tool."
        return "Trace the picture's safe shape or job with empty hands."

    if domain == "produce":
        produce_actions = {
            "Apple": "Make a round fruit; point to the core.",
            "Apricot": "Make a small round fruit; tap one pit at center.",
            "Banana": "Trace one long curve and peel line.",
            "Beet": "Trace a round root below an imaginary soil line.",
            "Carrot": "Trace a long root down; fan leafy tops up.",
            "Cherry": "Make one tiny round fruit and pit dot.",
            "Daikon": "Trace one long pale root below the soil line.",
            "Date": "Trace an oval fruit; mark one long stone.",
            "Eggplant": "Trace a smooth long fruit with a leafy cap.",
            "Endive": "Fan crisp leaf fingers into a small head.",
            "Fennel": "Make a layered bulb base; lift feathery leaves.",
            "Fig": "Make a soft round-pear shape; dot tiny seeds inside.",
            "Grapes": "Cluster several little round grape dots.",
            "Guava": "Make an oval fruit; dot many seeds inside.",
            "Honeydew": "Make a round melon; trace a smooth rind.",
            "Horseradish": "Trace one long root below the soil line.",
            "Indian Fig": "Make a cactus-fruit oval; dot many seeds inside.",
            "Iceberg Lettuce": "Cup a tight round head; fan crisp leaves.",
            "Jackfruit": "Show one huge oval; dot a bumpy rind.",
            "Jalapeno": "Trace a narrow pepper; dot seeds in the hollow center.",
            "Kale": "Fan one broad ruffled leaf.",
            "Kiwi": "Make a small oval; fuzz the outside; dot black seeds within.",
            "Leek": "Trace a pale layered stalk; lift long green leaves.",
            "Lemon": "Make a yellow oval; divide wedge-shaped segments.",
            "Mango": "Trace a smooth oval; mark one large flat pit.",
            "Melon": "Make a round rind; cup a seeded center.",
            "Napa Cabbage": "Cup a tall leafy head; crinkle leaf fingers.",
            "Nectarine": "Make a smooth round fruit; tap one pit at center.",
            "Okra": "Trace a ridged pod; dot seed rows inside.",
            "Orange": "Make a round peel; divide juicy segments.",
            "Peach": "Make a fuzzy round fruit; tap one pit at center.",
            "Pumpkin": "Make a big round body; trace rind ribs and seed center.",
            "Quince": "Make an apple-pear shape; point to the seed core.",
            "Radish": "Trace a round root below soil; fan leaves above.",
            "Raspberry": "Cluster many tiny drupelet dots together.",
            "Spinach": "Fan several soft green leaf shapes.",
            "Strawberry": "Make a heart-like berry; dot seeds on the outside.",
            "Tomato": "Make a round fruit; divide seed chambers inside.",
            "Turnip": "Trace a round root below soil; lift leafy greens.",
            "Vanilla Bean": "Trace one long narrow pod.",
            "Watercress": "Dot small round leaves along branching stems.",
            "Watermelon": "Make a huge oval rind; show juicy center.",
            "Yellow Pepper": "Trace a hollow pepper; dot pale seeds inside.",
            "Yam": "Trace an uneven tuber below the soil line.",
            "Zucchini": "Trace one long green squash.",
            "Zinfandel Grape": "Cluster dark grape dots on a vine stem.",
        }
        if obj in produce_actions:
            return produce_actions[obj]
        if obj in {"Ulluco"}:
            return "Cluster small colorful tuber ovals below a soil line."
        if obj in {"Quandong"}:
            return "Make one red round fruit; mark its large stone."
        if obj in {"Ugli Fruit"}:
            return "Make a round citrus shape; roughen the loose rind."
        if obj in {"Xigua"}:
            return "Make a watermelon rind and juicy center."
        if obj in {"Xoconostle"}:
            return "Make a cactus-fruit oval; mark thick skin and seeds."
        if obj in {"Vidalia Onion"}:
            return "Make an onion bulb; peel three layer rings in the air."
        return "Trace its most distinctive plant, shape, skin, leaf, root, or seed clue."

    bakery_actions = {
        "Angel Cake": "Tall cake; airy crumb.",
        "Apple Pie": "Round crust; apple filling.",
        "Bread": "Loaf crust; inner crumb.",
        "Brownie": "Flat brownie square.",
        "Cookie": "Small flat cookie disk.",
        "Cupcake": "Wrapper cup; rounded top.",
        "Danish": "Flaky folds; filling center.",
        "Donut": "Ring or filled round.",
        "Eclair": "Long oblong; filling inside.",
        "Egg Tart": "Small shell; smooth custard.",
        "Frosting": "Thick topping swirl.",
        "Fruitcake": "Cake slice; fruit-specked crumb.",
        "Gingerbread": "Brown crumb; loaf, cake, or cookie outline.",
        "Glaze": "Thin shiny coating.",
        "Honey Bun": "Coiled bun; thin glaze.",
        "Hot Cross Bun": "Round bun; top cross.",
        "Ice Cream": "Frozen scoop or swirl—no baking.",
        "Icing": "Spread or drizzle icing.",
        "Jam Tart": "Shallow shell; jam center.",
        "Jelly Donut": "Filled round; jelly center.",
        "Kaiser Roll": "Round roll; star-like top.",
        "Kolache": "Small pastry; filling center.",
        "Lemon Tart": "Tart shell; lemon filling.",
        "Loaf": "Long loaf; crust and crumb.",
        "Macaron": "Two round shells; filling line.",
        "Muffin": "Cup base; rounded top.",
        "Napoleon Pastry": "Thin layers; filling lines.",
        "Nut Bread": "Loaf; nut-specked crumb.",
        "Oat Cookie": "Flat cookie; oat flakes.",
        "Orange Cake": "Cake slice; citrus layer or decoration.",
        "Pie": "Crust edge; filling inside.",
        "Pretzel": "Twist a pretzel-knot outline.",
        "Queen Cake": "Small individual sponge shape.",
        "Quiche": "Shallow crust; open filling.",
        "Raisin Bread": "Loaf; raisin-specked crumb.",
        "Roll": "Small rounded bread roll.",
        "Scone": "Thick round or wedge.",
        "Sprinkles": "Tiny dots over topping.",
        "Tart": "Shallow shell; open filling.",
        "Toast": "Flat slice; browned surface.",
        "Ube Roll": "Purple cake spiral.",
        "Upside-down Cake": "Cake top; fruit surface.",
        "Vanilla Cake": "Cake slice; crumb and layers.",
        "Victoria Sponge": "Two sponge layers; filling line.",
        "Waffle": "Waffle outline; square grid.",
        "Wholegrain Bread": "Loaf; grain-flecked crumb.",
        "X-shaped Pretzel": "Cross two lines into an X.",
        "Xmas Cookie": "Shaped cookie; decoration dots.",
        "Yeast Roll": "Small risen roll.",
        "Yule Log": "Log shape; cake spiral.",
        "Zebra Cake": "Light-dark stripes in cake slice.",
        "Zucchini Bread": "Loaf; zucchini-flecked crumb.",
    }
    if obj in bakery_actions:
        return bakery_actions[obj]
    return "Trace its clearest crust, crumb, layer, filling, topping, grid, or outline clue."


def object_craft(song_id: str, obj: str) -> tuple[str, str] | None:
    domain = domain_for_song(song_id)
    if domain is None:
        return None
    if domain == "space":
        fact = SPACE_FACTS.get(obj, f"{obj} belongs in our space-science set and can be identified by its shape, motion, job, or place in the sky.")
    elif domain == "dinosaur":
        fact = _dino_fact(obj)
    elif domain == "insect":
        fact = _insect_fact(obj)
    elif domain == "bird":
        fact = _bird_fact(obj)
    elif domain == "pet":
        fact = _pet_fact(obj)
    elif domain == "wildlife":
        fact = _wildlife_fact(obj)
    elif domain == "herp":
        fact = _herp_fact(obj)
    elif domain == "kitchen":
        fact = KITCHEN_FACTS.get(obj, f"{obj} is part of our kitchen-picture set; its shape, material, food role, or tool job helps us recognize it.")
    elif domain == "produce":
        fact = _produce_fact(obj)
    else:
        fact = _bakery_fact(obj)
    return fact, _action_for(domain, obj)


SPECIAL_RHYMES = {
    "Asteroid": "Asteroid in flight | rocky body crossing night",
    "Comet": "Comet comes near | icy glow and tail appear",
    "Earth": "Earth, blue and round | ocean, land, and air are found",
    "Gemini Capsule": "Gemini takes flight | two-seat capsule trained for lunar flight",
    "International Space Station": "Station circles round | orbiting lab above the ground",
    "Krypton Tank": "Krypton stored just right | gas can feed an ion-thruster flight",
    "Meteor": "Meteor burns bright | atmosphere turns a space-rock path to light",
    "Orbit": "Orbit bends around | motion joined with gravity keeps the path bound",
    "Quarter Moon": "Quarter Moon tonight | half the sunlit face appears in sight",
    "Rocket": "Rocket on the go | thrust pushes back, so up we go",
    "Moon": "Moon in view | sunlight makes its phases new",
    "Satellite": "Satellite goes round | orbit keeps its path Earth-bound",
    "Telescope": "Telescope to sky | gathers light from far and high",
    "Uranus": "Uranus rolls by | sideways tilt turns under distant sky",
    "World": "World in the frame | planet or moon can carry the name",
    "Yoke": "Yoke turns left or right | hand-control clue in plain sight",
    "Astronaut": "Astronaut drifts slow | trained for work where spacecraft go",
    "Booster": "Booster starts the climb | extra thrust for launch-time",
    "Eclipse": "Eclipse slides through | one world blocks the light from view",
    "Fuel Tank": "Fuel Tank stores supply | propellant waits before the engines fly",
    "Galaxy": "Galaxy curls wide | stars and dust are gravity-tied",
    "Io": "Io, little moon | volcanoes change its surface soon",
    "Jupiter": "Jupiter, giant and wide | largest planet with storms inside",
    "Kuiper Belt": "Kuiper Belt, cold and far | icy bodies orbit beyond Neptune's path",
    "Lunar Rover": "Lunar Rover rolls | wheels cross dusty lunar holes",
    "Observatory": "Observatory dome | telescopes give sky-watchers a home",
    "Probe": "Probe travels light | robot explorer gathers clues in flight",
    "Rover": "Rover wheels along | robot explorer rolling strong",
    "Universe": "Universe opens wide | space and time and matter all inside",
    "Venus": "Venus wrapped in cloud | rocky world beneath a blanket thick and proud",
    "Xenon Thruster": "Xenon ions stream | gentle thrust from an electric beam",
    "Capsule": "Capsule small and round | crew or cargo rides space-bound",
    "Dish Antenna": "Dish Antenna turns | radio signals travel out and return",
    "Hubble Telescope": "Hubble circles high | above much of our air it studies sky",
    "Nebula": "Nebula, cloud aglow | gas and dust where star stories grow",
    "Quasar": "Quasar, tiny gleam | giant galactic core with a brilliant beam",
    "Thruster": "Thruster gives a nudge | changing spacecraft motion with a measured push",
    "White Dwarf": "White Dwarf, small and bright | dense old stellar core still shining light",
    "Yellow Star": "Yellow Star shines warm | surface heat gives color to its form",
    "Zodiac Chart": "Zodiac Chart bends round | sky-path band where Sun and planets can be found",
    "Spacesuit": "Spacesuit seals around | pressure, air, and protection space-bound",
    "Ankylosaurus": "Armor head to back | heavy tail club marks the track",
    "Allosaurus": "Allosaurus strides by | three-fingered hands and sharp teeth catch the eye",
    "Carnotaurus": "Carnotaurus draws near | two brow horns make the picture clear",
    "Ceratopsian": "Ceratopsian face | beak and frill are clues to trace",
    "Deinonychus": "Deinonychus steps through | sickle toe claw gives the clue",
    "Diplodocus": "Diplodocus long | neck in front, whip-like tail behind it strong",
    "Edmontosaurus": "Edmontosaurus, broad bill | rows of grinding teeth worked plants still",
    "Gastonia": "Gastonia low | armor plates and side spikes show",
    "Hadrosaur": "Hadrosaur bill | rows of grinding teeth worked plants still",
    "Lambeosaurus": "Lambeosaurus crest | hollow head crest makes the picture best",
    "Maiasaura": "Maiasaura nesting ground | eggs and young were fossil-found",
    "Nodosaurus": "Nodosaurus low | armored back, but no tail club to show",
    "Ornithomimus": "Ornithomimus runs light | long legs, small head, ostrich-like sight",
    "Oviraptor": "Oviraptor by the nest | beak and feathers make the clue stand best",
    "Pachycephalosaurus": "Pachycephalosaurus dome | thick round skull makes the clue feel known",
    "Qianzhousaurus": "Qianzhousaurus, snout stretched long | narrow tyrannosaur profile makes the clue strong",
    "Utahraptor": "Utahraptor tall | giant dromaeosaur with a curved toe claw",
    "Yutyrannus": "Yutyrannus feathered frame | giant fuzzy tyrannosauroid is the name",
    "Zuniceratops": "Zuniceratops in view | brow horns and a frill become the clue",
    "Mosasaurus": "Mosasaurus swims the sea | marine reptile—not dinosaur—our clue to see",
    "Quetzalcoatlus": "Quetzalcoatlus in the sky | giant pterosaur wings could carry it high",
    "Fossil": "Fossil in stone | ancient clue from life once known",
    "Footprint": "Print on the ground | ancient walking trace is found",
    "Stegosaurus": "Plates in a row | tail spikes give another clue to know",
    "Triceratops": "Three horns in view | giant frill completes the clue",
    "Caterpillar": "Caterpillar bends and crawls | larva now, winged adult later calls",
    "Aphid": "Aphid on a leaf | tiny sap-sipper, body small and brief",
    "Beetle": "Beetle shell-like wing | hard covers hide the softer wings within",
    "Dung Beetle": "Dung Beetle rolls away | ball or buried meal becomes the clue today",
    "Earwig": "Earwig at the rear | curved pincer pair makes the picture clear",
    "Honeybee": "Honeybee at bloom | nectar, pollen, colony room",
    "Inchworm": "Inchworm makes a loop | arch and stretch in a tiny moving scoop",
    "Jewel Beetle": "Jewel Beetle gleams | metallic wing covers flash like tiny beams",
    "Kissing Bug": "Kissing Bug, narrow head | long piercing beak is the clue instead",
    "Mosquito": "Mosquito slim and light | long legs, narrow wings in sight",
    "Net-winged Beetle": "Net-winged Beetle shows | raised little ridges in crisscross rows",
    "Praying Mantis": "Praying Mantis waits | folded grasping forelegs are its gates",
    "Queen Bee": "Queen Bee, body long | colony's egg-laying female in the throng",
    "Rhinoceros Beetle": "Rhinoceros Beetle horn | sturdy scarab shape makes the clue reborn",
    "Stag Beetle": "Stag Beetle jaws spread wide | antler-like mandibles open on each side",
    "Stick Insect": "Stick Insect holds still | twig-like body hides with skill",
    "Underwing Moth": "Underwing Moth folds tight | hidden hindwing colors wait out of sight",
    "Weevil": "Weevil snout out front | long beetle nose makes the clue we want",
    "Zebra Longwing": "Zebra Longwing stripe | long dark wings with yellow bands in sight",
    "Firefly": "Firefly at night | beetle body makes its light",
    "Ladybug": "Ladybug round | hard beetle wing-covers can be found",
    "Dragonfly": "Dragonfly near blue | four long wings and big eyes too",
    "Avocet": "Avocet wades slow | up-curved bill sweeps water below",
    "Albatross": "Albatross wings spread wide | ocean winds can carry its glide",
    "Cardinal": "Cardinal at the seed | stout cone bill is built for the feed",
    "Crane": "Crane stands tall | long neck, long legs above them all",
    "Duck": "Duck on the blue | webbed feet paddle, broad bill too",
    "Egret": "Egret steps light | long legs and pointed bill in sight",
    "Goldfinch": "Goldfinch small and bright | cone bill, yellow-dark wings in sight",
    "Heron": "Heron stands still | spear-like bill waits by water at will",
    "Ibis": "Ibis probes down | curved bill searches soft wet ground",
    "Kiwi": "Kiwi on the ground | tiny wings, strong legs stepping round",
    "Macaw": "Macaw tail streams long | curved bill, bright colors, parrot strong",
    "Nest": "Nest in the tree | eggs or chicks can shelter safely",
    "Nuthatch": "Nuthatch on bark | down the trunk it searches every mark",
    "Ostrich": "Ostrich runs fast | flightless wings and long legs pass",
    "Parrot": "Parrot on the tree | hooked bill, gripping toes—two and two you see",
    "Quetzal": "Quetzal tail flows | forest colors flash wherever it goes",
    "Swan": "Swan on the lake | long neck curves, webbed feet make a wake",
    "Toucan": "Toucan bill out wide | huge colorful beak is hard to hide",
    "Umbrellabird": "Umbrellabird up high | umbrella crest makes the clue easy to spy",
    "Vulture": "Vulture circles high | broad wings ride warm air in the sky",
    "Woodpecker": "Woodpecker on a tree | tapping bill and gripping feet are clues to see",
    "Yellow Warbler": "Yellow Warbler, small and bright | slender bill, yellow feathers in sight",
    "Zebra Finch": "Zebra Finch, little bars | short seed bill and striped chest marks",

    "Ostrich": "Ostrich runs fast | flightless wings and long legs pass",
    "Penguin": "Penguin in the blue | flipper-wings can swim right through",
    "Hummingbird": "Hummingbird can hover | rapid wings keep beating over",
    "Angelfish": "Angelfish glides by | tall fins wave as gills work underwater nearby",
    "Aquarium": "Aquarium clear and blue | clean water habitat is the clue",
    "Bowl": "Bowl on the floor | food or fresh water is what it's for",
    "Collar": "Collar in a ring | fitted neckband may hold an ID thing",
    "Doghouse": "Doghouse roof and shade | sheltered resting space is why it's made",
    "Exercise Wheel": "Exercise Wheel turns round | safe running space without leaving the ground",
    "Grooming Brush": "Grooming Brush in view | caregiver lifts loose fur as the clue",
    "Hamster": "Hamster cheeks can pouch | tiny runner, digger, burrow-house crouch",
    "ID Tag": "ID Tag hangs small | contact details can help a lost pet home-call",
    "Iguana": "Iguana tail runs long | scales and careful habitat make the clue strong",
    "Jingle Ball": "Jingle Ball rolls near | moving toy with a little sound to hear",
    "Kibble": "Kibble in the bowl | right type, right portion make the feeding goal",
    "Leash": "Leash draws a line | caregiver guides a fitted walk in time",
    "Litter Box": "Litter Box sits low | designated toilet place is what we know",
    "Nail Clipper": "Nail Clipper picture only | adult care tool—point and name it slowly",
    "Perch": "Perch like a branch | raised bird-resting place gives the clue a chance",
    "Puppy": "Puppy paws in view | strong nose, little wag, and gentle care too",
    "Quilt Bed": "Quilt Bed soft and low | resting place where a pet can settle slow",
    "Scratching Post": "Scratching Post stands tall | cat can stretch and scratch along the wall",
    "UV Lamp": "UV Lamp picture bright | expert-set reptile habitat may need its light",
    "Vest Harness": "Vest Harness wraps around | fitted body support for a guided walk is found",
    "X-ray Vet Image": "X-ray Vet Image shows | bones inside without surgery being exposed",
    "Zip Carrier": "Zip Carrier on the go | ventilated travel space keeps the pet secure below",

    "Water Bowl": "Water bowl stays near | fresh clean water waiting clear",
    "Leash": "Leash in a line | caregiver guides the walk in time",
    "Elephant": "Elephant so grand | trunk can lift and smell and understand",
    "Giraffe": "Giraffe up high | long neck reaches toward the sky",
    "Panda": "Panda black and white | bamboo is its favorite bite",
    "Red Panda": "Red panda in a tree | ringed tail helps us know what we see",
    "Axolotl": "Axolotl in blue | feathery outside gills are a clue",
    "Alligator": "Alligator lies low | broad snout, armored back, strong tail show",
    "Chameleon": "Chameleon grips tight | curling tail and moving eyes in sight",
    "Frilled Lizard": "Frilled Lizard opens wide | neck frill spreads on either side",
    "Frog": "Frog by the pond | moist-skinned amphibian hops beyond",
    "Gecko": "Gecko on the wall | toe-pad grip can help it crawl",
    "Horned Lizard": "Horned Lizard low | pointed head scales make the clue show",
    "Jackson Chameleon": "Jackson Chameleon, horns of three | grasping feet and curled tail are clues to see",
    "King Cobra": "King Cobra hood spreads wide | picture-only snake, observed from the safe side",
    "Leopard Gecko": "Leopard Gecko spots in sight | ground-walking toes and eyelids mark it right",
    "Mudpuppy": "Mudpuppy swims through | bushy outside gills are the clue",
    "Rattlesnake": "Rattlesnake tail at rear | segmented rattle makes the picture clear",
    "Red-eyed Tree Frog": "Red-eyed Tree Frog climbs high | sticky toes and bright red eyes nearby",
    "Turtle": "Turtle shell dome | hard shell travels where it roams",
    "Uromastyx": "Uromastyx tail is stout | spiny scale rings make it stand out",
    "Veiled Chameleon": "Veiled Chameleon wears a crest | tall head casque helps us name it best",
    "Xenopus": "Xenopus in the blue | webbed hind feet and high-set eyes give the clue",
    "Yellow-bellied Slider": "Yellow-bellied Slider shell | yellow underside markings help us tell",
    "Zigzag Salamander": "Zigzag Salamander near | moist skin, four limbs, long tail clear",
    "Apple": "Apple round and bright | skin and core are picture clues in sight",
    "Carrot": "Carrot down low | root below, green leaves above it grow",
    "Watermelon": "Watermelon wide | hard green rind with juicy fruit inside",
    "Cupcake": "Cupcake in its cup | crumb below, little topping up",
    "Pretzel": "Pretzel twists around | looping baked shape easy to be found",
    "Waffle": "Waffle on display | little grid marks cross it every way",
}


def rhyme_phraselet(song_id: str, obj: str, ordinal: int) -> str | None:
    domain = domain_for_song(song_id)
    if domain is None:
        return None
    if domain == "dinosaur" and obj == "Egg":
        return "Egg, oval shell | fossil nests have stories to tell"
    if domain == "kitchen" and obj == "Egg":
        return "Egg, oval shell | white and yolk are tucked in well"
    if domain == "produce" and obj == "Kiwi":
        return "Kiwi fruit, fuzzy brown | tiny black seeds ring green flesh around"
    if domain == "bakery" and obj == "Ice Cream":
        return "Ice Cream frozen scoop | smooth cold swirl makes the picture clue"
    if obj in SPECIAL_RHYMES:
        return SPECIAL_RHYMES[obj]
    # Full semantic facts are stronger than filler rhyme. Use a generic
    # phraselet only on every fourth alphabet slot; the other eligible slots
    # keep their complete fact. This makes rhyme audible without turning 13
    # lines per song into the same sing-song tail.
    if ordinal % 4 != 0:
        return None
    # Each fallback still carries a semantic clue. The pipe is an intentional
    # musical bar/phrase break, not punctuation decoration.
    if domain == "space":
        return _pick(obj, (f"{obj} in view | space clue coming through", f"{obj} up high | shape, motion, or job tells us why", f"{obj} in the frame | sky or spacecraft clues explain the name"))
    if domain == "dinosaur":
        return _pick(obj, (f"{obj} in stone | fossil clues make ancient life known", f"{obj} on the track | fossil shapes bring the old clue back", f"{obj} long ago | bones and body leave a clue to show"))
    if domain == "insect":
        return _pick(obj, (f"{obj} small in sight | legs, wings, or body make the clue feel right", f"{obj} down low | tiny body clues help the name to show", f"{obj} on the leaf | shape and movement make the clue brief"))
    if domain == "bird":
        return _pick(obj, (f"{obj} in sight | feathers, beak, and feet give clues just right", f"{obj} on the sky-line | feathered body gives a clue to find", f"{obj} on the perch | bill and feet are clues we search"))
    if domain == "pet":
        return _pick(obj, (f"{obj} in view | pet or care-item job becomes our clue", f"{obj} in our care | shape or job tells why it is there", f"{obj} on the scene | pet-care clue makes the meaning clean"))
    if domain == "wildlife":
        wildlife_rhymes = {
            "Iguana": "Iguana scales run long | clawed feet and trailing tail make the clue strong",
            "Nile Crocodile": "Nile Crocodile lies low | armored back and powerful tail show",
            "Xenopus": "Xenopus in the blue | webbed hind feet and high-set eyes give the clue",
            "Seal": "Seal in the sea | streamlined body, flippers moving free",
            "Zebra": "Zebra stripes in view | hooves and upright mane are clues too",
            "Hyena": "Hyena profile slopes | strong jaws, rounded ears give us hopes",
            "Yak": "Yak on mountain ground | shaggy coat and sturdy horns are found",
            "Serval": "Serval stands tall | giant ears and spotted coat give the call",
            "Camel": "Camel crosses sand | padded feet and hump make the clue easy to understand",
            "Bison": "Bison shoulders high | shaggy front and curved horns catch the eye",
        }
        if obj in wildlife_rhymes:
            return wildlife_rhymes[obj]
        if obj in WILDLIFE_BIRDS:
            return _pick(obj, (f"{obj} in sight | feather, bill, and feet give clues just right", f"{obj} in its place | wings and legs give clues to trace"))
        if obj in WILDLIFE_HERP:
            return _pick(obj, (f"{obj} low and clear | scales, skin, tail, or webbed feet bring the clue near", f"{obj} in its place | reptile-or-frog body clues we trace"))
        if obj in WILDLIFE_PRIMATES:
            return _pick(obj, (f"{obj} in view | grasping hands and primate posture make the clue", f"{obj} on the scene | face, hands, and agile limbs keep the meaning clean"))
        if obj in WILDLIFE_HOOFED:
            return _pick(obj, (f"{obj} on the track | hoof and horn or head clues bring the answer back", f"{obj} in its place | sturdy legs and hoofed feet give clues to trace"))
        if obj in WILDLIFE_CATS:
            return _pick(obj, (f"{obj} cat shape clear | paws, tail, spots or stripes bring the clue near", f"{obj} from afar | feline body clues show who you are"))
        if obj in WILDLIFE_CANIDS:
            return _pick(obj, (f"{obj} from afar | muzzle, ears, and bushy tail show who you are", f"{obj} on the trail | canid muzzle, paws, and tail tell the tale"))
        return _pick(obj, (f"{obj} from afar | shape and habitat show what you are", f"{obj} in its place | body and habitat give clues to trace"))
    if domain == "herp":
        lower = obj.lower()
        if any(word in lower for word in ("frog", "toad")) or obj == "Xenopus":
            return _pick(obj, (f"{obj} by the pond | moist skin and hind-leg clues respond", f"{obj} hop in sight | frog body clues make the answer right"))
        if any(word in lower for word in ("newt", "salamander")) or obj in {"Axolotl", "Mudpuppy", "Hellbender"}:
            return _pick(obj, (f"{obj} near the blue | moist skin and swimming tail give the clue", f"{obj} low and long | salamander tail makes the body clue strong"))
        if any(word in lower for word in ("snake", "boa", "python", "viper", "anaconda", "urutu", "cobra")):
            return _pick(obj, (f"{obj} curves in view | limbless scaled body is the clue", f"{obj} S-curve line | snake body shape makes the answer shine"))
        if any(word in lower for word in ("turtle", "slider")):
            return _pick(obj, (f"{obj} shell in sight | hard protective dome makes the clue right", f"{obj} walks slow | shell shape gives the clue to know"))
        if any(word in lower for word in ("crocodile", "alligator")):
            return _pick(obj, (f"{obj} lies low | armored back and powerful tail show", f"{obj} by the blue | long snout, armor, tail give the clue"))
        return _pick(obj, (f"{obj} scales in sight | feet, tail, head, or pattern make the clue right", f"{obj} low and long | lizard body clues make the answer strong"))
    if domain == "kitchen":
        kitchen_rhymes = {
            "Ice Tray": "Ice Tray little squares | cube compartments line in pairs",
            "Muffin": "Muffin in its cup | rounded top is rising up",
            "Quart Cup": "Quart Cup measure shown | four US cups make one quart known",
            "Yam": "Yam below the ground | rough long tuber shape is found",
            "Egg Timer": "Egg Timer marks the wait | little dial or timer counts the date",
            "Utensil": "Utensil in our view | shape and job tell what the tool can do",
            "Under-counter Drawer": "Drawer under counter slides | storage space is tucked inside",
            "Zucchini": "Zucchini long and green | pale soft-seeded squash inside is seen",
        }
        if obj in kitchen_rhymes:
            return kitchen_rhymes[obj]
        if obj in RISKY_KITCHEN:
            return _pick(obj, (f"{obj} picture clue | adult-handled tool, we only name and view", f"{obj} on display | point and name—grown-up tool today"))
        return _pick(obj, (f"{obj} on display | shape or kitchen job gives the clue today", f"{obj} in the frame | food or tool details tell its name", f"{obj} on the table | shape and job make the clue stable"))
    if domain == "produce":
        produce_rhymes = {
            "Apricot": "Apricot orange round | one hard pit at center can be found",
            "Eggplant": "Eggplant smooth and long | leafy cap and seeded flesh make the clue strong",
            "Endive": "Endive leaves curl tight | crisp leafy layers make the picture right",
            "Indian Fig": "Indian Fig cactus-grown | colored skin and tiny seeds are shown",
            "Melon": "Melon round and wide | firm rind, juicy seeded center inside",
            "Quandong": "Quandong red and round | one large stone in the center is found",
            "Ugli Fruit": "Ugli Fruit rough rind | loose citrus peel makes the clue easy to find",
            "Ulluco": "Ulluco underground | little colorful tubers can be found",
            "Yellow Pepper": "Yellow Pepper hollow bright | smooth wall and pale seeds in sight",
            "Zucchini": "Zucchini long and green | pale soft-seeded squash inside is seen",
        }
        if obj in produce_rhymes:
            return produce_rhymes[obj]
        return _pick(obj, (f"{obj} in the row | plant shape gives a clue to know", f"{obj} in the crate | skin, leaf, root, or seed helps us identify it straight", f"{obj} in our sight | garden or market details make the clue feel right"))
    lower = obj.lower()
    if obj in {"Frosting", "Icing", "Glaze", "Sprinkles"}:
        return _pick(obj, (f"{obj} on top | texture, dots, or shine make the picture pop", f"{obj} spread or bright | surface pattern gives the clue in sight"))
    if "bread" in lower or "loaf" in lower or "roll" in lower or "pretzel" in lower or "bun" in lower:
        return _pick(obj, (f"{obj} in the row | crust, crumb, or fold gives a clue to know", f"{obj} baked in view | crust and shape become the clue"))
    if "cake" in lower or obj in {"Brownie", "Cupcake", "Muffin", "Yule Log", "Victoria Sponge"}:
        return _pick(obj, (f"{obj} on display | crumb and layers give its shape away", f"{obj} in our sight | layer, crumb, or topping gives the clue just right"))
    return _pick(obj, (f"{obj} on display | crust, fold, swirl, or shape gives the clue today", f"{obj} in our sight | outline and surface make the clue feel right"))
