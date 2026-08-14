# ABC Visual Prompt Rules

## Scope

These rules apply to every ABC song in this repository. They define the AI
image prompt pack for the 26 letter/object foreground assets, one background,
and one song logo. The song code, title, theme, style, and object mapping are
the only song-specific values.

## Required Output

Create these two UTF-8 text files:

```text
abc-song/<song_id>/<song_id>_prompt_gen.txt
abc-song/<song_id>/<song_id>_prompt_gen_no_background.txt
```

Each file must contain exactly 28 JSONL records, one valid JSON object per
line, in this order:

1. `<song_id>A` through `<song_id>Z`, one letter/object foreground prompt each.
2. `<song_id>background`, one normal 16:9 background prompt.
3. `<song_id>song_logo`, one square song-logo prompt.

The two files use the same LOCKED mapping and the same record order. The
`<song_id>background` prompt must be identical in both files. The generator
also keeps the song-logo record identical; only the A-Z foreground acquisition
contract changes between the two files.

The existing `authoring/object-prompts.json` is a backward-compatible artifact;
the two 28-line `.txt` files are the complete visual prompt handoff.

## Source Of Truth

- Read the pair directly from `abc-song/<song_id>/authoring/mapping.json`.
- The mapping must have `state: LOCKED`, `revision >= 1`, and exactly A-Z.
- Never infer or replace an object from lyrics, theme assumptions, or a new
  suggestion while generating prompts.
- Use the song profile title, theme, and visual style. Do not hard-code the
  style or title from another song.

## Common Foreground Contract

Each A-Z record must have `type: "letter_object"`, the uppercase `letter`, the
canonical mapped `object`, and a complete `prompt`.

Both foreground variants must require all of the following:

- Full canvas `1376x768`.
- The asset is a foreground cutout, not a real scene.
- Include an explicit object description: recognizable real-world shape,
  material, surface details, proportions, and construction. Use the object's
  natural color family and material; do not force a palette, recolor it, or
  turn it into an arbitrary toy, candy, plastic, metallic, or abstract theme
  prop.
- Use child-friendly rendering and song-coherent art direction for the letter
  and overall finish while preserving the object's real-world identity.
- One large uppercase target letter on the left and exactly one mapped object
  on the right; both fully visible and not cropped.
- Letter invisible layout area: `x=35..597, y=78..636`, centered around
  `x=316, y=357`, height about `538px`.
- Object invisible layout area: `x=642..1320, y=78..636`, centered around
  `x=981, y=357`, longest dimension about `538px`.
- Keep gutter `x=598..641` empty as a separation gutter.
- Place the exact mapped object word directly below the object, centered under
  it, inside the same invisible object area. The exact object word is the only
  permitted text; no other label, caption, or readable text is allowed.
- The layout areas and coordinates are instructions only and must never be
  drawn, outlined, labeled, or shown in the image. In particular, never draw
  a rectangle, border, guide line, measurement mark, coordinate text, crop
  frame, or visible box outline.
- The 26 prompts share the same lighting, edge softness, compositing quality,
  and preschool art direction. The letter may use a clean stylized material,
  but every mapped object keeps its real-world color family, physical material,
  surface texture, proportions, construction details, and light response.
- Use a distinct, high-contrast foreground color for the letter while keeping
  the object's natural colors. The letter and object must be visibly different
  from the background's dominant colors by hue, value, or saturation. This
  separation rule applies when the foreground is composited with the shared
  song background; it does not authorize drawing a background into the asset.
- The object itself must not contain text or letter-like markings. Self-shadow
  and highlights are allowed only inside the letter and object.

## Letter Color, Material, And Style Contract

The song has one stable rendering direction across all 26 letter/object
assets: the same camera and framing language, light direction, preschool art
direction, bevel treatment, edge softness, and shading discipline. A material
change between letters is an intentional design assignment, not a change of
style.

Every A-Z prompt must state a deterministic letter design assignment with:

- a named letter color;
- an explicit six-digit hex color;
- a named, child-friendly letter material;
- an instruction to keep that assignment for the letter only.

From song `0002` onward, choose the assignment from the mapped object's visible
real-world family and the song theme: water subjects may use shell, glass, or
river-stone surfaces; plants may use leaf, terracotta, or petal surfaces; food
may use produce, grain, or root surfaces; weather, earth, textile, animal,
bird, insect, and technical subjects use their own appropriate material
families. Rotate among compatible choices when useful, but do not impose a
fixed number of colors/materials or force every alphabet to use the same
palette. Never default every letter to blue, aqua, or one material. The mapped
object must keep its own real-world colors and material. Do not recolor an
object to match the letter.

Song `0001` is the active test fixture. Preserve its current mapping, lyrics,
artifacts, and current prompt files unless the user explicitly asks to change
that song. The object-aware assignment rule is applied to `0002` onward.

For transparent SVG output, represent the assigned letter material with clean
vector silhouettes and controlled internal highlights or shading paths. Do not
use raster texture, a background fill, or a visible guide box to fake material.

## Object And Theme Alignment Contract

Each mapped object must be a concrete, visible subject that belongs naturally
to the song theme and can be explained in one short child-friendly fact or
action line. Do not use a musical prop, a generic alphabet helper, or an
off-theme filler just to fill a rare letter. A context subject such as shore
gear, farm equipment, weather clothing, or a mountain route is acceptable when
the song theme explicitly includes that setting and the lyric explains its
real function. Avoid apologetic exception language that tries to excuse an
object that does not belong. Rare or technical objects are acceptable only
when they are directly visible, theme-relevant, and explained simply in the
generated lyric and prompt.

When an object or theme is repaired, update the proposal, LOCKED mapping
revision, mapping QC, theme file, object list, lyrics, display lyrics, object
craft/fact/action data, and both visual prompt packs together. Keep song `0001`
unchanged when it is being used as a test fixture.

## Object Cartoonization Contract

Object prompts intentionally combine real-world identity with a family-specific
preschool cartoon treatment. Do not use one generic "cute" filter for every
subject. Select the mode that matches the object:

- living water subjects: rounded educational storybook or soft 3D forms,
  calm pose, recognizable anatomy, no attack, gore, sharp teeth, or threat;
- plants: cheerful botanical illustration or clay-like cutout with clear leaf,
  stem, root, flower, fruit, or tissue structure, without invented faces or
  fantasy glow;
- food and crops: friendly produce cutout with true skin/rind/root/seed cues,
  without candy recoloring, knives, mess, or bite marks;
- animals and birds: gentle natural-history cartoon with true silhouette and
  defining features, rounded forms, and no chase, attack, menacing eyes, or
  frightening realism;
- insects: clear macro-cartoon with real body segments, legs, wings, or case
  pattern, simplified for recognition and without venom/stinger horror;
- rocks and landforms: tactile educational specimen or clean terrain shape,
  with readable layers and no explosion, hazard drama, or fantasy crystal glow;
- weather and ice: soft weather-symbol or calm storybook shape, not a disaster
  scene or dark threatening storm;
- tools and technical objects: clean child-safe educational prop or simplified
  diagram-like object at rest, with no operation, heat, electricity,
  radiation, sharp-edge, or clinical horror detail;
- textiles: soft material-focused cutout with recognizable weave, closure, or
  shelter construction and no unsafe tangles or sharp hardware emphasis.

The cartoon treatment may vary by object family while camera, lighting, bevel
language, edge softness, and overall preschool rendering remain stable within a
song. Preserve the object's natural color family, material cues, proportions,
and defining construction; cartoonization is for recognition and emotional
safety, not permission to make the object generic or inaccurate.

## White-Matte Foreground Variant

`<song_id>_prompt_gen.txt` is the white-matte source used when a later
segmentation step removes the matte. It must require:

- Solid pure white `#FFFFFF` on every pixel outside the letter, object, and
  exact object word.
- No transparency, checkerboard, scene, matte texture, or non-white
  background area.
- Flat, clean white-matte output suitable for alpha extraction.

## No-Background SVG Foreground Variant

`<song_id>_prompt_gen_no_background.txt` is the direct transparent foreground
variant. Its A-Z prompts must require:

- A real transparent background and SVG-compatible vector output with
  `viewBox="0 0 1376 768"`.
- Closed vector silhouettes or editable SVG text for the letter, object, and
  exact object word below the object.
- No white rectangle, background fill, checkerboard, scene, matte, or canvas
  fill outside the foreground shapes.
- No raster background; soft shading is allowed only inside the letter and
  object shapes.

The no-background file is not a white image with a background removed later;
the prompt must request transparency from the source.

## Background Contract

The background record must be a separate normal `16:9` image on canvas
`1376x768`, using the song theme and visual style. Keep the center stage open,
low-detail, and lightly colored for keyed foreground assets. Leave negative
space at top-left for song info, top-right for a circular channel logo, and at
the bottom for lyrics.

Use a muted environmental palette with low-to-medium saturation. The
background must not reuse the dominant foreground colors as large regions; keep
its dominant hue, value, and saturation different from the letter and object's
colors so the foreground subjects remain clearly separated. Do not place
matching saturated color blocks behind the subjects.

Do not include foreground letter/object pairs, standalone large letters,
object labels, lyrics, readable text, song logo, channel logo, people,
characters, watermark, border, frame, guide line, placement box, or cutout
processing matte. This exact background prompt is shared by both foreground
packs.

## Song Logo Contract

The logo record must be a separate square asset, normally `1024x1024`, using
the same song visual language. It may contain the exact song title as its only
readable text. It must not contain an alphabet grid, A-Z letter/object pair,
lyrics, channel logo, watermark, visible guide box, or busy scene. A pure white
matte may be used when the logo will be alpha-extracted.

## Generation And Validation

Use the repository generator so future songs follow the same contract:

```text
python scripts/generate_abc_authoring_batch.py --start <n> --end <n> --prompt-only
```

After generation, parse every line in both files as JSON and verify exactly 28
records, the required ID order, the A-Z objects against the LOCKED mapping,
the shared `background` prompt, and the mode-specific foreground phrases.
Verify white-matte prompts require `#FFFFFF` and no-background prompts require
transparent SVG output with no white fill. Do not run a full authoring
generation when only the visual prompt `.txt` files are requested.

For a repaired song, also verify that the lyrics and object craft entries use
the current LOCKED object names, no old forced/helper object remains in the
letter lines, the mapping revision is propagated to all generated artifacts,
and the full first-50 catalog contains no off-theme filler or apologetic
exception language. Positive boundary/context wording is valid when the
object belongs to the named setting. For `0002` onward, verify that each
letter's color/material assignment is visibly
compatible with the mapped object's family and that the song does not collapse
to one default color/material; do not enforce an artificial palette count.
Also verify that each foreground prompt names an appropriate cartoonization mode
and forbids scary, graphic, threatening, or unsafe presentation where relevant.
