# ABC Kids Music Composer — Regression Cases

Use this file after substantial changes to `SKILL.md`, `REFERENCE.md`, or the project method. These are maintenance tests, not user-facing song output.

## Rule precedence

- Wrong pronunciation must fail even if rhyme/hook is excellent.
- A heuristic such as tempo or word count may be overridden by evidence; a hard gate may not.
- Objective-specific rules must apply only to the matching learning objective.
- Generic Bitwize adult/streaming >400/>500-word hard-fail rules must not override preschool objective-aware length handling.
- Generic "<200 words is too short" guidance must not force filler into a concise preschool lesson.
- Generic genre rhyme-scheme rules must not override lexical-semantic clarity.
- Generic per-section Performance Cues are supporting provider guidance, not a preschool pedagogical hard gate.
- A generic "important word = high note" preference must not override Tier C teach-then-sing or correct lexical stress.

## Prosody and pronunciation

| Input | Expected |
|---|---|
| BOOK | 1-syllable motif class |
| APPLE | initial-stress 2-syllable class: `AP-ple` |
| ERASER | middle-stress class: `e-RA-ser` |
| UMBRELLA | middle-stress class: `um-BREL-la` |
| HIGHLIGHTER | initial-stress 3-syllable class: `HIGH-light-er` |
| XYLOPHONE | initial-stress class; Letter-Name mode OK; X phonics caveat required |
| `read`, `tear`, `close` | pronunciation/homograph risk must be resolved or rewritten |
| `rain / again` | do not assume a perfect en-US rhyme |

## Letter difficulty and sequence identity

- Letter-level difficulty must be tracked separately from word familiarity.
- In Phonics mode, a letter-name sound cue may be strong, embedded, weak, or misleading; do not assume equal cue strength across A–Z.
- A visually or phonologically confusable target must be isolated during first teaching; contrast comes later.
- Successful ABC-chain continuation is not sufficient evidence of independent recognition.
- L2/L3 should sample selected letter-word targets out of sequence.
- Secondary cues such as counting/color/clapping must not compete with the primary `LETTER -> WORD` target.

## Curriculum progression

- Stage 1 uppercase vocabulary song must not silently introduce lowercase + phonics + blending as simultaneous new objectives.
- Stage 4 mixed-order retrieval should happen after initial identities are established.
- Tier B/C or repeatedly confused targets may receive more spaced retrieval opportunities than easy targets.
- Adaptive retrieval means spaced targeted review, not back-to-back mass repetition.

## Learning-objective behavior

### Lexical-semantic

`Q -> Quill` for mixed ages 2–6:
- preserve mapping if user-locked;
- likely Tier C for younger preschoolers;
- use teach-then-sing / narrow-contour first exposure;
- strong visual support;
- rhyme may be relaxed rather than distort meaning.

### Verbatim / sequence

Same chorus text repeated twice:
- same or nearly same macro-hook motif;
- same rhythmic identity;
- exact wording preferred.

### Retrieval / action

`A -> Apple` Round 2:
- cue A;
- brief predictable retrieval beat;
- confirm Apple;
- one congruent action such as bite/crunch;
- do not reveal the answer before the retrieval beat when recall is intended.

### Phonics

`X -> Xylophone`:
- acceptable in Letter-Name / Letter-Word mode;
- must not be presented as canonical /ks/ onset evidence.

## Structure and density

- A single 26-line A–Z verse -> FAIL; split into short sections.
- Rhyme-forward sections -> even-sized chunks preferred when useful.
- Semantic sections -> may relax rhyme to preserve meaning.
- Two full A–Z rounds -> Round 1 teaching, Round 2 retrieval/action; not twin paraphrase.
- Two A–Z rounds -> 26 canonical learning-block specs, 52 letter timeline occurrences.

## Sequence boundary

`L M N O P`:
- every letter must be a separate audible event;
- no compressed `LMNOP` syllable stream.

## Mixed-age layering

For ages 2–6:
- adult lead may carry full teaching line;
- child-facing echo remains shorter and simpler;
- do not require a 2-year-old to reproduce the full descriptive line.

## Melody and rhythm

- Tier C target -> stable/repeated-note or speech-like first exposure, not a large decorative leap.
- Child echo motif -> narrower/simpler than adult-lead line.
- Same rhyme pair -> comparable stress positions and rhythmic pocket.
- Target-word onset -> not masked by clap/snare/bell/backing consonants.
- Response cue -> actual audible response space.

## Multimodal

`Z -> Zipper`:
- audio says zipper;
- visual shows zipper;
- action is zip/close rather than an unrelated gesture;
- in retrieval mode, object emphasis/reveal must respect the retrieval beat.

## Generation repair

- One mispronounced section -> local pronunciation/section repair first.
- One rushed section -> density/space repair first.
- Weak hook but good verses -> hook/motif repair first.
- Do not rewrite an otherwise successful full song by default.

## Runtime handoff

- `Say it! Show it! A-B-C!` chorus line with no explicit learning-letter metadata -> must not select `S` as Letter Asset.
- `A-B-C, sing with me` -> must not be treated as the A learning block merely because it starts with `A-`.
- `A is for apple` and `A ... A ... apple` -> may resolve to learning letter A.
- Visualizer `original-lyrics.*` -> display/sung lines only; Markdown headings and `[Verse]/[Chorus]` structure tags are not alignment lines.
- One full A–Z round -> 26 learning-letter timeline occurrences; two full rounds -> 52; chorus/refrain lines are excluded from this count.
- Composer Learning Block / Section Manifests are authoring contracts until runtime integration is explicitly implemented.

## Output integrity

A full-song package should be able to state:
- age band;
- letter difficulty profile / sound-cue risk when relevant;
- primary vs secondary cue budget;
- learning-objective map;
- lexical novelty tiers;
- learning-block manifest;
- section manifest;
- macro/round motifs;
- response/retrieval plan;
- QC hard gates;
- internal readiness score;
- validation level.

Any rule change that breaks these expected results requires review before being considered stable.
