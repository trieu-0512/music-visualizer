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
        ("Wingbeat, word beat—A-B-C!", "Name the bird that flies to me!"),
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
    "space": "Round 2 strips back to cue-gap-answer timing with orbit, point, trace or launch-like pretend gestures that never obscure the word.",
    "dinosaur": "Round 2 uses footprint-sized recall gaps and safe stomp, trace, tail or fossil-brush pantomime after the answer.",
    "insect": "Round 2 leaves a clean recall gap, then confirms with one tiny crawl, flutter, wing or shape gesture.",
    "bird": "Round 2 uses binocular-style cue-gap-answer timing followed by one wing, perch, beak or walking gesture; flightless birds get grounded motions.",
    "pet": "Round 2 confirms with pointing, gentle animal motions or a care-item job gesture; no clipping, medicating, heating or tool use.",
    "wildlife": "Round 2 uses track-and-name recall with gestures done from a safe observation spot; no chase, feeding or touching prompts.",
    "herp": "Round 2 uses one to two beats of recall and a picture-trace, hop, swim or low-glide gesture; dangerous animals remain hands-off.",
    "kitchen": "Round 2 is picture recall only: safe foods may get shape motions, while hot, sharp or powered tools get pointing or empty-hand mime only.",
    "produce": "Round 2 uses color/shape recall and a point, trace, round, long, leafy or basket gesture after the word.",
    "bakery": "Round 2 uses a clean recall gap and visual shape/layer/swirl gestures with empty hands; no real baking operations are instructed.",
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
    scene = DOMAIN_SCENES[domain]
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

    style = (
        f"{base_style}. This is the {theme} song, but avoid sounding like a stock educational jingle. "
        f"Use a clear warm adult lead around {bpm} BPM with crisp consonants, stable vowels and natural lexical stress. "
        "Write the melody around the words rather than forcing every line into equal length: short targets may hit in one compact bar; long targets may breathe across two or more bars. "
        f"Cold-open with {opening[0]} using the supplied intro text exactly enough to preserve its idea; do not add a generic spoken welcome. "
        f"{DOMAIN_ROUND1[domain]} Use mixed entry families—direct hit, repeated-letter pickup, object-first reveal, question-answer and small narrative turn—without cycling them mechanically A-B-C-D. "
        "Let selected Round-1 bars carry an audible internal/end rhyme around the written | phrase break, but never sacrifice meaning or pronunciation just to rhyme. "
        f"The chorus should widen melodically into the two-line hook, then change texture or response on later returns instead of copy-pasting the same arrangement. {DOMAIN_ROUND2[domain]} "
        f"At target onset, duck percussion, pads and backing vocals; after the target, answer with {DOMAIN_SIGNATURE[domain]}. "
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
        "section_contrast": f"Round 1 paints clues; chorus opens wide; Round 2 strips back for recall. Signature: {DOMAIN_SIGNATURE[domain]}.",
        "signature_color": DOMAIN_SIGNATURE[domain],
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
    "Asteroid": "An asteroid is a rocky or metallic body that travels around the Sun.",
    "Black Hole": "A black hole is a region where gravity is so strong that even light cannot escape once it is inside.",
    "Comet": "A comet is an icy body that can grow a glowing coma and tail when it travels near the Sun.",
    "Dwarf Planet": "A dwarf planet orbits the Sun and is round, but it has not cleared other objects from its orbital neighborhood.",
    "Earth": "Earth is our home planet, with liquid-water oceans and a protective atmosphere.",
    "Flag": "A flag is a marked piece of fabric used as a symbol; astronauts have carried flags on missions.",
    "Gemini Capsule": "A Gemini capsule carried two astronauts during NASA missions that helped prepare for Apollo lunar flights.",
    "Helmet": "A space helmet protects an astronaut's head and helps provide a safe breathing environment inside the suit system.",
    "International Space Station": "The International Space Station is a large research laboratory that orbits Earth.",
    "Jet Pack": "A spacecraft maneuvering pack can use small thrusters to help an astronaut move in space during specially planned operations.",
    "Krypton Tank": "A krypton tank stores krypton gas that can be used as propellant in some electric spacecraft thrusters.",
    "Lander": "A lander is a spacecraft built to come down onto the surface of another world.",
    "Meteor": "A meteor is the streak of light seen when a small space rock heats up while passing through an atmosphere.",
    "Neptune": "Neptune is the eighth major planet from the Sun and is a cold blue giant world.",
    "Orbit": "An orbit is the curved path one object follows around another because of motion and gravity.",
    "Planet": "A planet is a large round world that travels in an orbit around a star.",
    "Quarter Moon": "A quarter moon is a lunar phase when we see about half of the Moon's sunlit face from Earth.",
    "Rocket": "A rocket produces thrust by pushing exhaust in the opposite direction of travel.",
    "Satellite": "A satellite is an object that travels in orbit around a planet, moon, or other body.",
    "Telescope": "A telescope collects light or other signals to help us study distant objects.",
    "Uranus": "Uranus is an ice-giant planet that rotates with an unusually large sideways tilt.",
    "Visor": "A spacesuit visor protects an astronaut's eyes and face and can filter intense sunlight.",
    "World": "A world is a broad word for a planet, moon, or other place considered as its own environment.",
    "X-ray Telescope": "An X-ray telescope detects X-rays from hot and energetic objects in space.",
    "Yoke": "A control yoke is a hand control used in some vehicles; spacecraft use carefully designed controls for steering or orientation commands.",
    "Zero-gravity Chair": "A zero-gravity chair is a reclining chair named for a body position that spreads support; it does not create real weightlessness.",
    "Astronaut": "An astronaut is a trained person who travels or works in space.",
    "Booster": "A rocket booster provides extra thrust during an early part of a launch.",
    "Eclipse": "An eclipse happens when one celestial body moves into the shadow of another or blocks our view of it.",
    "Fuel Tank": "A spacecraft fuel or propellant tank stores material used by an engine or thruster system.",
    "Galaxy": "A galaxy is a huge system of stars, gas, dust, and dark matter held together by gravity.",
    "Io": "Io is one of Jupiter's large moons and is known for intense volcanic activity.",
    "Jupiter": "Jupiter is the largest planet in our solar system and has a giant atmosphere with powerful storms.",
    "Kuiper Belt": "The Kuiper Belt is a broad region beyond Neptune containing many icy bodies.",
    "Lunar Rover": "A lunar rover is a vehicle designed to travel across the Moon's surface.",
    "Moon": "The Moon is Earth's natural satellite and reflects sunlight as it travels around our planet.",
    "Observatory": "An observatory is a place equipped for observing the sky with telescopes or other instruments.",
    "Probe": "A space probe is an uncrewed spacecraft sent to collect information about space or another world.",
    "Rover": "A rover is a mobile robot or vehicle designed to explore the surface of another world.",
    "Universe": "The universe includes all known space, time, matter, and energy.",
    "Venus": "Venus is a rocky planet covered by a thick atmosphere and very hot surface conditions.",
    "Xenon Thruster": "A xenon thruster uses electrically accelerated xenon ions to produce gentle, efficient thrust.",
    "Capsule": "A space capsule is a compact spacecraft section built to carry crew, cargo, or experiments.",
    "Dish Antenna": "A dish antenna focuses radio waves so a spacecraft or ground station can send and receive signals.",
    "Hubble Telescope": "The Hubble Space Telescope orbits Earth and observes the universe above much of our atmosphere.",
    "Nebula": "A nebula is a cloud of gas and dust in space, sometimes linked to star birth or the remains of stars.",
    "Quasar": "A quasar is an extremely bright galactic core powered by matter falling toward a supermassive black hole.",
    "Thruster": "A spacecraft thruster produces controlled force used to change motion or orientation.",
    "White Dwarf": "A white dwarf is the hot, dense remnant core left after a Sun-like star sheds its outer layers.",
    "Yellow Star": "A yellow-looking star is a star whose visible color appears yellowish because of its surface temperature and spectrum.",
    "Zodiac Chart": "A zodiac chart maps a band of sky along the path where the Sun, Moon, and planets appear to move from Earth's viewpoint.",
    "Spacesuit": "A spacesuit provides pressure, oxygen support, temperature control, and protection for an astronaut outside a spacecraft.",
}

DINO_FACTS = {
    "Bone": "A bone is a hard body structure; fossilized bones can preserve clues about prehistoric animals.",
    "Jawbone": "A jawbone holds teeth and can give paleontologists clues about how an animal ate.",
    "Rib Bone": "A rib bone helps form a protective cage around organs; fossil ribs can show the shape of an ancient body.",
    "Fossil": "A fossil is preserved evidence of ancient life, such as bone, shell, a leaf impression, or a track.",
    "Footprint": "A fossil footprint is a trace fossil that records where an animal stepped long ago.",
    "Egg": "Fossil eggs can preserve clues about how some prehistoric animals reproduced and nested.",
    "Nest": "A fossil nest or nesting site can reveal how some prehistoric animals laid and cared for eggs.",
    "Jurassic Fern": "Ferns were part of many prehistoric plant communities and their relatives still grow today.",
    "Volcano": "A volcano is an opening where molten rock, gas, and ash can reach Earth's surface; volcanoes existed throughout dinosaur times.",
    "Pteranodon": "Pteranodon was a flying reptile called a pterosaur, not a dinosaur.",
    "Quetzalcoatlus": "Quetzalcoatlus was a giant pterosaur, a flying reptile rather than a dinosaur.",
    "Mosasaurus": "Mosasaurus was a large marine reptile that lived in the sea, not a dinosaur.",
    "Ankylosaurus": "Ankylosaurus was an armored dinosaur with bony plates and a heavy tail club.",
    "Brachiosaurus": "Brachiosaurus was a long-necked sauropod dinosaur with front legs longer than its hind legs.",
    "Stegosaurus": "Stegosaurus was a plant-eating dinosaur with tall back plates and spikes on its tail.",
    "Triceratops": "Triceratops was a plant-eating dinosaur with three facial horns and a large bony frill.",
    "Tyrannosaurus": "Tyrannosaurus was a large meat-eating dinosaur with a massive skull and powerful hind legs.",
    "Velociraptor": "Velociraptor was a relatively small feathered theropod dinosaur with a curved claw on each second toe.",
    "Spinosaurus": "Spinosaurus was a large theropod dinosaur with tall spines forming a sail-like structure along its back.",
    "Iguanodon": "Iguanodon was a plant-eating dinosaur known for a large spike on each thumb.",
}

INSECT_FACTS = {
    "Ant": "An ant is an insect with six legs, elbowed antennae, and a body divided into three main sections.",
    "Bee": "A bee is an insect with six legs; many bees visit flowers for nectar and pollen.",
    "Honeybee": "A honeybee is a social bee that lives in a colony and gathers nectar and pollen from flowers.",
    "Caterpillar": "A caterpillar is the larval stage of a butterfly or moth and has a long soft body made of segments.",
    "Inchworm": "An inchworm is a moth caterpillar that loops its body as it crawls.",
    "Nymph": "A nymph is a young stage of insects such as grasshoppers, dragonflies, or true bugs that changes gradually as it grows.",
    "Orb Weaver": "An orb weaver is a spider, not an insect, and many species build round wheel-shaped webs.",
    "Pill Bug": "A pill bug is a small land crustacean, not an insect, and many can curl into a ball.",
    "Praying Mantis": "A praying mantis is an insect with grasping front legs held in a folded position.",
    "Mantis": "A mantis is an insect with a triangular head and grasping front legs.",
    "Dragonfly": "A dragonfly is an insect with large eyes, two pairs of long wings, and an aquatic juvenile stage.",
    "Firefly": "A firefly is a beetle; many species produce light with special organs in the abdomen.",
    "Ladybug": "A ladybug is a round beetle, often red or orange with dark spots.",
    "Grasshopper": "A grasshopper is an insect with powerful hind legs adapted for jumping.",
    "Cricket": "A cricket is an insect with long antennae; many males make chirping sounds by rubbing their wings.",
    "Termite": "A termite is a social insect that lives in colonies and feeds mainly on cellulose from plant material.",
    "Aphid": "An aphid is a tiny plant-feeding insect that uses slender mouthparts to drink plant sap.",
}

BIRD_SPECIAL = {
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
    "Aquarium": "An aquarium holds a carefully maintained aquatic habitat for fish or other suitable animals.",
    "Collar": "A collar fits around a pet's neck and may carry an ID tag when properly fitted.",
    "Exercise Wheel": "An exercise wheel lets an appropriate small pet run while staying in its enclosure.",
    "Wheel": "A pet wheel gives an appropriate small animal a place to run for exercise.",
    "Jingle Ball": "A jingle ball is a play toy that rolls and makes a small sound as it moves.",
    "Xylophone Toy": "A xylophone-style pet toy is an enrichment object with bars or pieces that can make sounds when moved or tapped.",
    "Nest": "A nest gives suitable pet birds a sheltered place associated with resting, eggs, or chicks.",
    "Outdoor Kennel": "An outdoor kennel is a secure enclosure or shelter used for a dog under appropriate supervision and conditions.",
    "Perch": "A perch gives a bird a raised place to stand, rest, or move between levels.",
    "Rope Toy": "A rope toy gives an appropriate pet something to carry, tug, climb, or play with under supervision.",
    "Zip Carrier": "A zip carrier is a ventilated travel enclosure that helps keep a suitable pet contained during transport.",
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
    "Zester": "A zester has small sharp edges that scrape thin fragrant pieces from citrus peel and is a grown-up tool in this activity.",
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
    if any(word in obj for word in ("Duck", "Goose", "Swan", "Tern", "Sandpiper", "Heron", "Egret", "Avocet", "Ibis")):
        return f"{obj} is a water-side bird; beak, legs, and feet fit its watery habitat."
    return f"{obj} is a feathered bird; beak and feet hint at how it lives."


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
        return f"{obj} is a beetle; hard front wings cover softer flight wings."
    if "bee" in lower or obj in {"Wasp", "Yellowjacket"}:
        return f"{obj} has six legs, antennae, wings, and a narrow-jointed body."
    if obj == "Flea":
        return "A flea is wingless and tiny, with powerful jumping legs."
    if obj in {"Gnat", "Mosquito", "Vinegar Fly"}:
        return f"{obj} is a small fly with six legs, antennae, and one wing pair."
    if obj in {"Katydid", "Stick Insect", "Kissing Bug", "Roach", "Earwig"}:
        return f"{obj} has six legs and a body shape that makes a clear clue."
    return f"{obj}: look for legs, wings, segments, web, or movement as the clue."


def _pet_fact(obj: str) -> str:
    if obj in PET_CARE_FACTS:
        return PET_CARE_FACTS[obj]
    if obj in PET_ANIMALS:
        if obj in {"Fish", "Angelfish"}:
            return f"{obj} breathes with gills and needs clean, suitable water."
        if obj in {"Cat", "Kitten"}:
            return f"{obj} has whiskers, padded paws, and retractable claws."
        if obj in {"Dog", "Puppy"}:
            return f"{obj} has padded paws and a remarkably strong sense of smell."
        if obj in {"Hamster", "Guinea Pig", "Mouse", "Rabbit", "Bunny"}:
            return f"{obj} needs the right food, fresh water, shelter, space, and gentle care."
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
        "Elephant": "An elephant is a huge plant-eating mammal with a trunk, tusks in many adults, and broad padded feet.",
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
            f"{obj} is a primate; hands, feet, face, and climbing posture make strong clues.",
            f"{obj} belongs to the primate family; watch its grasping hands and body shape.",
            f"{obj}: primate hands, forward-looking face, and movement help identify it.",
        ))
    if obj in WILDLIFE_CATS:
        return _pick(obj, (
            f"{obj} is a wild cat; paws, tail, coat pattern, and feline body shape give clues.",
            f"{obj} has a cat-like body with padded paws, keen senses, and a balancing tail.",
            f"{obj}: look for the wild-cat silhouette, paws, ears, and coat markings.",
        ))
    if obj in WILDLIFE_CANIDS:
        return _pick(obj, (
            f"{obj} is a wild canid; muzzle, pointed ears, paws, and tail help reveal it.",
            f"{obj} has a dog-family silhouette with a long muzzle and walking paws.",
            f"{obj}: ears, muzzle, coat, and tail make the canid clue.",
        ))
    if obj in WILDLIFE_HOOFED:
        return _pick(obj, (
            f"{obj} is hoofed wildlife; legs, hoof shape, head, and coat help identify it.",
            f"{obj}: sturdy legs and hooves anchor the body-shape clue.",
            f"{obj} walks on hooves; horns, ears, neck, or coat add the next clue.",
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


def _herp_fact(obj: str) -> str:
    lower = obj.lower()
    if obj == "Axolotl":
        return "An axolotl is an aquatic salamander that usually keeps its feathery external gills as an adult."
    if obj in {"Mudpuppy", "Hellbender"}:
        return f"{obj} is an aquatic salamander with a long swimming body and tail."
    if any(word in lower for word in ("frog", "toad", "newt", "salamander")):
        return f"{obj} is a moist-skinned amphibian closely tied to water or damp places."
    if any(word in lower for word in ("turtle", "slider")):
        return f"{obj} is a reptile with a hard protective shell."
    if any(word in lower for word in ("crocodile", "alligator")):
        return f"{obj} is a large semi-aquatic reptile with armored skin, long snout, and strong tail."
    if any(word in lower for word in ("snake", "boa", "python", "viper", "anaconda", "urutu")):
        return f"{obj} is a limbless reptile that moves in muscular curves along the ground or branches."
    if any(word in lower for word in ("lizard", "gecko", "chameleon", "skink", "uromastyx", "xenosaurus", "iguana")) or obj == "Komodo Dragon":
        return f"{obj} is a scaled lizard-type reptile; feet, tail, head, and pattern give clues."
    return f"{obj}: skin, scales, shell, limbs, tail, and habitat reveal the clue."


def _produce_fact(obj: str) -> str:
    if obj in PRODUCE_SPECIAL:
        return PRODUCE_SPECIAL[obj]
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


def _bakery_fact(obj: str) -> str:
    lower = obj.lower()
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


def _action_for(domain: str, obj: str) -> str:
    if domain == "space":
        return _pick(obj, (
            "Trace one orbit, then point.",
            "Lift one launch-finger, then freeze.",
            "Make a round space-window, then point.",
            "Glide one hand, then tap the picture.",
        ))
    if domain == "dinosaur":
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
        if "butterfly" in obj.lower() or "moth" in obj.lower() or "longwing" in obj.lower():
            return "Open and close two gentle hand-wings once, then point."
        if obj == "Orb Weaver":
            return "Trace one small web circle in the air, then point."
        return _pick(obj, ("Wiggle six tiny finger-steps, then stop.", "Crawl two fingers across your palm.", "Lift two antenna fingers, then point.", "Flutter or crawl once, then freeze."))
    if domain == "bird":
        if obj in FLIGHTLESS_BIRDS:
            return "Tap two gentle walking steps with your fingers, then point."
        return _pick(obj, ("Lift two gentle wings, then hold.", "Make a tiny beak, then point.", "Perch one hand, then name it.", "Glide one flat hand, then stop."))
    if domain == "pet":
        if any(word in obj.lower() for word in ("clipper", "lamp", "cleaner", "vet", "x-ray")):
            return "Point and name its care job; a grown-up handles the real item."
        if obj in PET_ANIMALS:
            return _pick(obj, ("Copy one gentle paw, hop, swim, or perch motion.", "Point, then copy one calm animal move.", "Show one tiny tail, fin, paw, or wing motion."))
        return _pick(obj, ("Point, then mime its job with empty hands.", "Trace its shape, then name its pet-care job.", "Point to the care item; make one pretend gesture."))
    if domain == "wildlife":
        if obj in WILDLIFE_BIRDS:
            if obj in FLIGHTLESS_BIRDS:
                return "Tap two gentle walking steps, then point."
            return "Lift two gentle wings, then point."
        if obj == "Xenopus":
            return "Make one tiny finger-hop, then point."
        if obj in {"Iguana", "Nile Crocodile"}:
            return "Trace one low body-and-tail line in the air."
        return _pick(obj, ("Point, then trace its silhouette.", "Make two quiet track-steps, then stop.", "Show its body shape with your hands.", "Point to one clue—ears, tail, horn, feet, or coat."))
    if domain == "herp":
        if any(word in obj.lower() for word in ("frog", "toad")):
            return "Finger-hop once, then point."
        if any(word in obj.lower() for word in ("snake", "boa", "python", "viper", "anaconda", "urutu")):
            return "Trace one slow S-curve in the air."
        if any(word in obj.lower() for word in ("turtle", "slider")):
            return "Make a shell dome, then point."
        return "Trace one low body line, then point."
    if domain == "kitchen":
        if obj in RISKY_KITCHEN:
            return "Point only; mime with empty hands while a grown-up handles the real tool."
        return _pick(obj, ("Trace its shape, then point.", "Mime its job with empty hands.", "Point, then make one small shape gesture.", "Show round, long, flat, or scoop-shaped, then point."))
    if domain == "produce":
        return _pick(obj, ("Trace its outline; point to one color clue.", "Show round, long, leafy, or bumpy, then point.", "Pretend to basket the picture, then name it.", "Point to skin or leaf shape; hold the beat."))
    return _pick(obj, ("Trace its outline or swirl; point.", "Show its round, layered, folded, or long shape.", "Point to one crust, topping, grid, or layer clue.", "Pretend one tiny pat or roll; freeze."))


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
    "Yoke": "Yoke in hand-control view | steering input is the clue",
    "Ankylosaurus": "Armor on its back | heavy tail-club gives the clue a smack",
    "Mosasaurus": "Mosasaurus in the sea | marine reptile, not a dinosaur, remember me",
    "Quetzalcoatlus": "Quetzalcoatlus in the sky | giant pterosaur wings could carry it high",
    "Fossil": "Fossil in stone | ancient clue from life once known",
    "Footprint": "Print on the ground | ancient walking trace is found",
    "Stegosaurus": "Plates in a row | tail spikes give another clue to know",
    "Triceratops": "Three horns in view | giant frill completes the clue",
    "Caterpillar": "Caterpillar crawl | larva first, then wings may call",
    "Firefly": "Firefly at night | beetle body makes its light",
    "Ladybug": "Ladybug round | hard beetle wing-covers can be found",
    "Dragonfly": "Dragonfly near blue | four long wings and big eyes too",
    "Kiwi": "Kiwi on the ground | tiny wings, strong legs stepping round",
    "Ostrich": "Ostrich runs fast | flightless wings and long legs pass",
    "Penguin": "Penguin in the blue | flipper-wings can swim right through",
    "Hummingbird": "Hummingbird can hover | rapid wings keep beating over",
    "Puppy": "Puppy paws in view | food, water, care, and playtime too",
    "Water Bowl": "Water bowl stays near | fresh clean water waiting clear",
    "Leash": "Leash in a line | caregiver guides the walk in time",
    "Elephant": "Elephant so grand | trunk can lift and smell and understand",
    "Giraffe": "Giraffe up high | long neck reaches toward the sky",
    "Panda": "Panda black and white | bamboo is its favorite bite",
    "Red Panda": "Red panda in a tree | ringed tail helps us know what we see",
    "Axolotl": "Axolotl in blue | feathery outside gills are a clue",
    "Frog": "Frog by the pond | moist-skinned amphibian hops beyond",
    "Turtle": "Turtle shell dome | hard shell travels where it roams",
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
        if obj in WILDLIFE_BIRDS:
            return _pick(obj, (f"{obj} in sight | feather, bill, and feet give clues just right", f"{obj} in its place | wings and legs give clues to trace"))
        return _pick(obj, (f"{obj} on the track | coat and habitat bring the clue right back", f"{obj} from afar | shape and habitat show what you are", f"{obj} in its place | feet, coat, ears, and tail give clues to trace"))
    if domain == "herp":
        return _pick(obj, (f"{obj} low and slow | skin, scales, shell, or limbs give clues to know", f"{obj} by pond or stone | body covering helps the creature be known", f"{obj} in our sight | shape and movement make the clue just right"))
    if domain == "kitchen":
        return _pick(obj, (f"{obj} on display | shape or kitchen job gives the clue today", f"{obj} in the frame | food or tool details tell its name", f"{obj} on the table | shape and job make the clue stable"))
    if domain == "produce":
        return _pick(obj, (f"{obj} in the row | shape and color help the produce show", f"{obj} in the crate | skin, leaf, or shape helps us identify it straight", f"{obj} in our sight | garden or market clues make the name feel right"))
    lower = obj.lower()
    if obj in {"Frosting", "Icing", "Glaze", "Sprinkles"}:
        return _pick(obj, (f"{obj} on top | texture, dots, or shine make the picture pop", f"{obj} spread or bright | surface pattern gives the clue in sight"))
    if "bread" in lower or "loaf" in lower or "roll" in lower or "pretzel" in lower or "bun" in lower:
        return _pick(obj, (f"{obj} in the row | crust, crumb, or fold gives a clue to know", f"{obj} baked in view | crust and shape become the clue"))
    if "cake" in lower or obj in {"Brownie", "Cupcake", "Muffin", "Yule Log", "Victoria Sponge"}:
        return _pick(obj, (f"{obj} on display | crumb and layers give its shape away", f"{obj} in our sight | layer, crumb, or topping gives the clue just right"))
    return _pick(obj, (f"{obj} on display | crust, fold, swirl, or shape gives the clue today", f"{obj} in our sight | outline and surface make the clue feel right"))
