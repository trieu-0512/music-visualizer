# ABC Kids Music Composer — Pre-Generation Lint Spec

This file defines checks that can be evaluated deterministically or semi-deterministically before audio generation. It complements, but does not replace, the perceptual checks in `EVALUATION_PROTOCOL.md`.

## Check classes

```text
D = deterministic / machine-checkable
H = heuristic / warning threshold
A = audio/perceptual only; cannot honestly PASS at L0
```

Never mark an `A` check PASS from text alone. At L0 use `UNTESTED` or `PENDING AUDIO`.

## Schema validation

When manifests are serialized as JSON, validate against:

- `LEARNING_BLOCK_SCHEMA.json`
- `SECTION_SCHEMA.json`

Schema success is necessary for structural integrity but does not prove pedagogical or audio quality.

## Mapping integrity

### D-MAP-001 — A–Z coverage

For a full English alphabet round:

- exactly 26 target letters;
- unique A through Z;
- no missing letter;
- no duplicate target letter.

### D-MAP-002 — Round consistency

If two rounds exist:

- Round 1 and Round 2 reference the same canonical `LETTER -> WORD` mapping;
- any intentional mapping change requires explicit user/project approval.

### D-MAP-003 — Mode integrity

Every block declares or inherits one mode:

```text
LETTER_NAME
PHONICS
```

Flag accidental mixing inside the same learning claim.

### D-MAP-004 — Manifest completeness

Every canonical Learning Block Manifest contains required fields:

```text
letter
word
mode
familiarity_tier
syllable_count
stress_pattern
prosodic_motif_variant
round1_objective
risk_flags
```

Additional phonics/contrast fields may be required when relevant.

### H-MAP-005 — context-conditioned theme fit

Do not flag a word as weak solely because another globally more familiar word exists. Evaluate it under the declared `Theme Scope`.

```text
strict -> generated off-theme candidate = FAIL
          low familiarity alone = WARN/support requirement, not automatic rejection

guided -> weak theme fit = WARN unless justified by letter scarcity or another hard constraint

open   -> no narrow theme-fit penalty unless the song promises a specific semantic category
```

For user/project-locked mappings, report theme/familiarity concerns without silently replacing the mapping.

### H-MAP-006 — no universal word leaderboard

A lint/reviewer must not encode a permanent ordering such as `common word > specialized word` independent of context. Candidate comparison must include theme, age, mode, visual/action feasibility, pronunciation, distinctiveness, and support cost.

## Section structure

### D-SEC-001 — no mega-verse

A full A–Z round may not be represented as one 26-line verse.

### H-SEC-002 — section density

Default warning when a learning section exceeds 6 physical learning lines. A longer section requires explicit evidence/justification.

### D-SEC-003 — repeated hook identity

Repeated chorus/refrain instances must point to the same canonical identity unless a variation is explicitly designed.

### D-SEC-004 — line ownership

Each target learning line belongs to exactly one section occurrence. Prevent accidental duplicated/missing letters caused by editing.

### H-SEC-005 — intro/opening template diversity

For multi-song catalog work, flag adjacent songs that repeatedly open with the same generic invitation skeleton (for example `Come explore THEME with me`) unless a deliberate series format requires it.

Use a diverse opening palette: cold-open hook, question/mystery, movement pickup, scene drop, sound-image, spoken/chant pickup, countdown/ritual, character/guide POV, or instrument-first entry.

### H-SEC-006 — catalog form diversity

For a creative catalog batch, do not reuse one identical macro form automatically merely because all songs teach A-Z. Compare meaningful form variables such as chorus/refrain placement within each round, mid-song interlude/turnaround presence, opening type, and ending behavior.

A fixed series ritual is allowed, but nearby songs should not all feel like the same arrangement with nouns swapped. As a working 10-song batch heuristic, fewer than about 6 distinct chorus/interlude layouts deserves review. This is a catalog creative heuristic, not a pedagogical hard gate.

## Generation-facing lyrics

### D-LYR-001 — technical prose separation

Generation lyrics must not contain technical instructions intended for the style box, such as prose about BPM, mix, camera, or production.

### D-LYR-002 — risky homograph list

Flag unresolved context-sensitive words such as:

```text
read
tear
close
wind
lead
```

The list is extensible; context/pronunciation notes may resolve a flag.

### D-LYR-003 — repeated-letter tokenization

Repeated letters must be represented as separate tokens/events, not concatenated forms such as `AAA`.

### H-LYR-004 — phraselet-aware density

Do **not** warn merely because a physical line exceeds 12 words or 14 syllables. Physical line length is not the governing metric.

Evaluate the sung event as phraselets:

```text
natural stress
number of phraselets
planned bars/rests
breath point
semantic load
provider rushing risk
```

Warnings:

- long line with no explicit natural internal pause/phraselet plan;
- multiple low-familiarity targets or competing ideas packed into one line;
- wording that requires rapid syllable compression to fit the section's groove;
- repeated evidence that the provider skips/rushes comparable late-section lines.

Short lines are also valid and should not be padded merely to match neighboring lines.

### D-LYR-005 — target presence

Each target block must explicitly contain the intended target letter and target word in the generation-facing learning content unless the section is a deliberate retrieval cue whose confirmation occurs immediately after the gap.

### H-LYR-006 — syntactic template monotony

For catalog-quality creative songs, normalize target/object tokens and inspect Round-1 sentence skeletons.

Warn when one non-deliberate full sentence skeleton dominates the great majority of target lines, especially when 20+ of 26 lines differ only by `{letter}` / `{object}` substitution.

Exact repetition is allowed when the section explicitly declares chant/refrain repetition as the hook mechanism.

### H-LYR-007 — generic-tail saturation

Warn when a generic suffix such as `in our world today`, `on our explorer trail`, or equivalent appears across many unrelated objects without adding object-specific meaning.

A repeated tail may pass when it is a deliberate refrain and semantically fits every line.

### H-LYR-008 — target-entry palette

For creative/adaptive songs, prefer a coherent palette of roughly 3–6 target-entry families across A–Z rather than one fixed frame or 26 unrelated forms.

Examples include direct naming, repeated-letter chant, `is for`, question-answer, action-first, object-first inversion, and narrative entry.

Warn when:

- one frame is used almost everywhere without declared chant intent; or
- syntax changes so randomly that the child cannot predict where letter/word targets arrive.

### H-LYR-009 — line-shape monotony

Warn when nearly every target line has the same word count, phraselet count, and cadence **and** there is no deliberate chant/meter reason.

Creative songs should normally contain intentional short/medium/long or pickup/downbeat contrast while preserving a recognizable motif family.

### H-LYR-010 — semantic-tail quality

Round-1 lexical-semantic lines should preferably use object-conditioned verbs, functions, locations, sensory details, or simple visible facts. Warn when most lines contain only generic theme filler and teach no additional meaning beyond the noun.

### H-LYR-011 — semantic follow-up monotony

Target-entry variation is not enough if nearly every semantic continuation restarts with the same pronoun or discourse frame. For a 26-target creative round, a very high concentration such as about 22+ lines restarting the second sentence with `It ...` deserves REWORK unless that repetition is an intentional chant device.

Mix natural reinforcement forms: repeat the noun when useful, use a pronoun continuation on other lines, or restructure the target entry so the semantic fact lands in a different grammatical shape. Do not add empty transition phrases merely to game this check.

## Rhyme and rhythm

### D-RHY-000 — rhyme architecture declared

For song-format preschool learning sections, require an explicit rhyme mode:

```text
paired
alternating
internal
mixed-internal-phraselet
refrain-driven
intentionally-unrhymed
```

When `intentionally-unrhymed` is used, require a concrete semantic/prosody/pronunciation/phonics justification. Do not accept accidental prose as a declared rhyme strategy. For catalog-quality preschool song work, a fully unrhymed lexical round is an exception rather than the default: prefer audible rhyme-bearing moments elsewhere in the learning verse when they can preserve meaning and target clarity.

### H-RHY-000A — audible rhyme presence in learning verses

A declared rhyme architecture is not enough if the child cannot hear any rhyme in the actual lexical-learning lines. For a 26-target catalog-quality Round 1, normally require repeated audible rhyme-bearing events distributed through the round. Rhyme may land at line endings, internally, or across phraselets separated by a deliberate bar/rest marker such as `|`.

Useful shapes:

```text
TARGET early | rhyme-bearing semantic phraselet
TARGET + phraselet A | phraselet B with a natural rhyme payoff
```

Do not force the mapped object itself to rhyme. Never distort pronunciation, lexical stress, grammar, or object meaning just to create a rhyme. Rhyme-count is only a review signal: a verse may use fewer explicit rhymes when melody, cadence, repetition, imagery, alliteration, groove, or another mnemonic device makes it musical. **Never rewrite a good line merely to increase a rhyme count.**

### D-RHY-001 — scheme completeness

When a section declares AABB/AABBCC/etc., every expected rhyme slot must have a partner; no orphan scheme position.

### H-RHY-001B — rhyme recall compatibility

Warn when a declared rhyme pair technically rhymes but has obviously mismatched rhythmic weight, stress placement, or cadence that makes the pair unlikely to feel like a memorable answer-response unit.

### H-RHY-002 — accent stability

Flag pairs known or suspected to depend on accent. Require target-locale read-aloud validation.

### H-RHY-003 — paired-line density delta

Warn when paired rhyme lines differ by more than roughly 2 sung syllables without an explicit held note/rest explanation.

## Pronunciation/prosody

### D-PRO-001 — stress metadata present

Every multi-syllable learning target must have a stress pattern or an explicit `VERIFY` risk flag before finalization.

### D-PRO-002 — no guessed unresolved stress

A target marked stress-uncertain cannot be `READY` until verified.

### A-PRO-003 — realized lexical stress

Whether the generated melody actually preserves lexical stress is audio-only.

### A-PRO-004 — target intelligibility

Whether the target word is understandable on first listen is audio-only.

## Sequence/identity

### D-SEQ-001 — ordered round integrity

When the song promises A–Z order, section manifests must concatenate to A…Z exactly.

### H-SEQ-002 — sequence-dependency risk

A full ordered alphabet song must carry a plan for out-of-sequence identity sampling at L2/L3. Ordered singing alone is insufficient evidence of independent recognition.

### A-SEQ-003 — audible letter boundaries

Whether `L-M-N-O-P` or other sequential letters remain perceptually separate is audio-only.

## Retrieval/action

### D-RET-001 — objective consistency

For every learning block that belongs to a section marked `retrieval-action`:

- the canonical Learning Block Manifest declares `retrieval_cue` and `retrieval_gap_plan`;
- the canonical `word` is the target-word confirmation unless a future schema explicitly adds a separate confirmation variant;
- the Section Manifest declares `learning_objective = retrieval-action` and a matching `response_frame`.

`retrieval_cue` / `retrieval_gap_plan` are per-letter learning-block fields, not Section Manifest fields. Action is optional only when a recall-only design is intentional.

### H-RET-002 — visual spoil risk

If retrieval is intended, flag a visual plan that fully reveals the object before the retrieval beat unless age-band support-first mode explicitly permits it.

### A-RET-003 — realized response gap

Whether the generated audio actually leaves usable response space is audio-only.

## Multimodal/visual

### D-VIS-001 — canonical asset identity

Each letter's visual must reference the same canonical target word as the Learning Block Manifest.

### D-VIS-002 — generated-asset text restriction

When the project requires target-letter-only **AI-generated foreground assets/scenes**:

- only the target capital letter may be baked into the generated pixels as text;
- no other letters/words/numbers/logos/watermarks may be hallucinated into that asset.

Trusted compositor overlays (lyrics, title/artist, controlled object label) are a separate presentation-layer policy. If the final frame itself must be target-letter-only, that requires an explicit render mode that disables those overlays.
### H-VIS-003 — cue competition

Flag blocks with too many independent secondary teaching cues (new color + number + direction + object + dance instruction) unless multi-domain learning is explicit.

## Style prompt

### D-STY-001 — artist names

No real artist/band names in generator-facing style prompts.

### D-STY-002 — limit compliance

If the provider/user specifies a character limit, the style prompt must fit it exactly.

### H-STY-003 — descriptor bloat

Warn when the prompt stacks many synonymous descriptors or too many instruments; clarity and delivery instructions take priority.

### H-STY-004 — performance-blueprint completeness

For a full Suno/AI-music generation handoff, warn when the style prompt is only genre + mood + instrument names and omits the song's important performance behavior.

When relevant, include a compact subset of:

```text
voice/diction
meter/groove + tempo
melodic contour/range
opening behavior
Round-1 delivery
chorus behavior
Round-2 cue/gap response
target-word mix protection
arrangement/energy arc
ending behavior
```

Do not require irrelevant fields. Prompted behavior remains `PENDING AUDIO` until realized.

### H-STY-005 — catalog style-fingerprint diversity

Across nearby songs, warn when style prompts differ only by swapping one or two instruments while sharing the same groove, opening, vocal behavior, chorus function, Round-1 phrasing, and Round-2 grammar.

Series voice/brand consistency is allowed; creative differentiation should come from meaningful musical/section behavior rather than adjective churn.

## Generation length

### H-LEN-001 — global risk

Global word count is a provider-risk signal, not a songwriting score. Do not warn merely because a song is around 800 words. Review local density, breathing, phrase structure, and actual provider behavior. Only substantially longer drafts or observed compression/skipping need length-driven repair.

## Runtime handoff lint

### D-RUN-001 — display/alignment lyric hygiene

`assets/original-lyrics.*` is a visualizer display/alignment input, not the Suno generation prompt. It must not carry Markdown headings, section tags, or production/performance prose as sung lines. The worker strips common markers, but clean source input remains preferred.

### D-RUN-002 — learning-letter occurrence integrity

After transcription/alignment, verify `artifacts/lyrics.json` against the song manifest:

- a one-round full A–Z song should contain 26 explicit learning-letter occurrences;
- a two-round full A–Z song should contain 52 explicit learning-letter occurrences;
- chorus/refrain/narration lines must not receive a `letter` merely from their first ordinary word.

### H-RUN-003 — positional-alignment limitation

The current MVP original-lyrics aligner pairs canonical display lines to transcriber segments by order. A segment-count mismatch can reduce phrase-timing confidence. For production ABC timing, inspect the resulting artifact and prefer a pre-aligned/verified `artifacts/lyrics.json` when exact phrase boundaries matter.

## L0 status vocabulary

Use:

```text
PASS
WARN
FAIL
PENDING AUDIO
N/A
```

Do not write `PASS` for audio-only properties at L0.

## Pre-generation release rule

A draft can be `READY FOR GENERATION TEST` only when:

- all deterministic hard gates PASS;
- no unresolved critical pronunciation/stress/mapping issue remains;
- heuristic WARN items are consciously accepted/mitigated;
- all audio-only checks are labeled `PENDING AUDIO` rather than falsely passed.

Actual `RELEASE READY` requires at least L1 generated-audio audit.
