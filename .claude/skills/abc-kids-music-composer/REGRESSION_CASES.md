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

## Creative variation / anti-template

- `A — Apple!` -> valid short target-entry form when the letter-word association is explicit.
- `A ... A ... A ... Apple!` -> valid repeated-letter chant only when each A is a separate audible event; concatenated `AAA` remains invalid.
- `A is for Apple, red and round.` -> valid classic association form.
- `A? Apple!` -> valid question-answer micro-hook when the target remains intelligible.
- A long line with 2–3 natural phraselets and adequate bars/rests -> may PASS; do not fail from word count alone.
- A 2–4-word target line -> may PASS; do not pad solely for symmetry.
- 26 Round-1 lines that differ only by `{letter}` / `{object}` substitution -> WARN/REWORK in catalog-quality creative mode unless exact repetition is explicitly declared as the chant hook.
- Generic suffix attached to unrelated targets (`... in our world today`) across most of A–Z -> WARN unless it is an intentional refrain and semantically fits.
- 26 Round-2 lines using exactly `Point and say` -> WARN/REWORK when object-specific actions/echo/search grammar could provide better participation.
- 22+ of 26 Round-1 lines using varied target entries but restarting the semantic continuation with the same `It ...` frame -> semantic-follow-up REWORK unless deliberately designed.
- A song declares `internal` or `refrain-driven` rhyme but the 26 lexical-learning lines contain no audible rhyme-bearing phraselets/endings -> creative REWORK; metadata is not evidence of heard rhyme.
- Natural phraselet rhyme such as `Glide with the tide | tall fins open wide` -> preferred when it keeps the target early and preserves semantic clarity.
- Forcing a mapped object into an unnatural rhyme position or changing its pronunciation/stress to rhyme -> FAIL/REWORK.
- 26 completely unrelated syntactic forms -> also WARN when the target arrival becomes unpredictable. Controlled palette beats random novelty.
- Intentional song-level palette of 3–6 target-entry families -> preferred creative behavior.
- Nearby catalog songs all opening with `Come explore THEME with me` -> catalog diversity WARN unless a fixed series ritual is intentional.
- Ten creative catalog songs all inserting the chorus after the exact same Round-1/2 chunks with no deliberate series reason -> form-diversity WARN; vary chorus/refrain placement and/or interlude/turnaround behavior while preserving learning order.
- Nearby songs that differ only by instrument swaps but share opening, groove, Round-1 grammar, chorus function and Round-2 grammar -> style-fingerprint WARN.

## Cross-genre craft transfer

- Pop/folk/musical-theatre/hip-hop/swing/call-response techniques may inform structure, phrasing, rhyme, hook, POV and rhythm.
- Do not import adult themes, unsafe content, copyrighted lyrics, distinctive melody, named-artist imitation or cultural caricature.
- Internal rhyme or light syncopation may be used; rapid rap delivery must not compromise target clarity.
- Verse/refrain, cumulative, question-answer, scene-setting and speak-sing forms are valid when educational contracts remain intact.

## Suno / AI-music performance blueprint

- Full style prompt containing only `genre + 3 instruments + mood` -> WARN for serious generation handoff when section behavior matters.
- Prompt that specifies opening, Round-1 phrasing, chorus lift, Round-2 cue/gap behavior and target-word mix protection -> preferred when relevant.
- Prompted one-beat retrieval gap -> `PENDING AUDIO`, never L0 PASS.
- Section-level provider repair is preferred over flattening the whole song when one localized passage fails.

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

## Audit-version integrity

- A legacy batch audit with `status = PASS` but no current `auditVersion` -> STALE for a current-standard cross audit.
- Revalidating 0001-0010 under creative-v4 -> must not promote untouched 0011-0200 legacy audits to creative-v4 PASS.
- Progress may report all 200 authoring packages exist while separately reporting only the current-standard validated song count.

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
