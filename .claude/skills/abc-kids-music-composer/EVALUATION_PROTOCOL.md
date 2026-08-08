# ABC Kids Music Composer — Evaluation Protocol

Use this file when comparing generated variants, tuning heuristics, or deciding whether a rule change is supported by evidence.

This is a production evaluation protocol, not a validated clinical or academic assessment.

## Validation levels

```text
L0 = text/spec audit
L1 = generated-audio audit
L2 = naive listener / parent proxy
L3 = intended-age child observation/test when available
```

Do not claim real child memorability from L0 alone.

## Variant record

Record only task-relevant production data. No child names or identifying information are needed.

```yaml
song_id:
variant_id:
date:
provider_model:
voice_profile:
age_band: 2-3 | 4-6 | mixed-2-6
curriculum_stage:
learning_objectives:
tempo_bpm:
section_chunking:
word_count:
macro_hook_id:
round1_motif_id:
round2_motif_id:
```

## L1 generated-audio audit

First listen should happen without reading the lyric sheet.

Rate or record:

```yaml
target_intelligibility:
  clear_first_listen_count:
  unclear_targets: []
pronunciation:
  stress_errors: []
  homograph_errors: []
letter_boundaries:
  blurred_sequences: []
letter_identity:
  out_of_sequence_targets_sampled: []
  confused_targets: []
  sequence_only_success_risk: low/medium/high
prosody:
  awkward_lines: []
density:
  rushed_sections: []
  skipped_sections: []
hook:
  identity_stable: true/false
  memorable_fragment:
response_space:
  gaps_audible: true/false
  cue_target_gap_seconds: []
  cue_target_gap_beats: []
  compressed_gap_targets: []
asr_proxy:
  model_or_models: []
  exact_target_recognition_count:
  consensus_ambiguities: []
  note: "ASR is a proxy only; repeated errors prioritize human listening, they do not automatically prove pronunciation failure."
mix:
  masked_target_onsets: []
```

## L2 naive listener / parent proxy

Do not show lyrics before first listen.

Ask for:

1. What short phrase/hook do you remember?
2. Which letter-word pairs were easiest to understand?
3. Which words were hard to understand?
4. Without continuing the ABC chain, can you identify a few sampled letter-word pairs presented out of order?
5. Did any section feel rushed or tiring?
6. Could you predict when to clap/respond?
7. Did the repeated hook become annoying before the song ended?

Treat this as a proxy, not child evidence.

## L3 intended-age observation

When appropriate and available, observe behavior rather than demanding a full performance.

Useful observations:

```text
spontaneous hook echo
correct object recognition after target word
response during retrieval gap
imitation of congruent action
letter boundary confusion
which target words require adult modeling again
attention/fatigue across sections
```

For mixed ages, do not require a 2–3-year-old to reproduce the full adult-lead teaching line.

## A/B test discipline

Keep locked lyrics and change one major variable at a time when possible.

Good comparisons:

```text
A: 84 BPM vs B: 94 BPM
A: 1-beat retrieval gap vs B: 2-beat gap
A: repeated-note hook vs B: small-arch hook
A: sparse percussion vs B: denser percussion
```

Bad comparison:

```text
A and B change lyric + tempo + voice + instruments + hook simultaneously
```

## Failure taxonomy

```text
P1 EDUCATIONAL
wrong mapping, wrong phonics implication, semantic confusion

P1 PRONUNCIATION
wrong lexical stress, wrong target pronunciation, blurred letter boundary

P1 GENERATION
skipped learning target, severe rushing/compression

P2 MEMORABILITY
weak hook, unpredictable micro-hook, poor response timing

P2 SEMANTIC
Tier B/C word not taught clearly enough

P2 MIX
onset masked by percussion/backing vocal

P3 POLISH
minor transition, instrument color, cosmetic rhyme preference
```

Fix P1 before P2; fix P2 before P3.

## Aggregate calibration

Across multiple songs, track recurring patterns such as:

```text
mispronunciation rate by stress class
letter confusion rate by visual/phonological difficulty profile
sequence-only vs out-of-sequence recognition
rush/skip rate by section line count
late-song target-clarity rate by section line count
realized retrieval-gap ratio (actual beats / intended beats) by provider/model
ASR target-recognition proxy by round/section (never treated as child evidence)
rush rate by tempo + syllable density
Tier C target clarity rate
confusable-target error rate
retrieval-gap success by age band
adaptive-retrieval success across later sessions
hook fatigue by number of repetitions
masking errors by arrangement type
```

Do not change a general heuristic because of one unusual generation. Prefer repeated evidence across multiple songs/variants.

## Rule update policy

```text
HARD GATE
change only if the underlying educational/pronunciation premise is shown wrong

HEURISTIC
may be recalibrated from repeated production evidence

CREATIVE PREFERENCE
may change freely without rewriting educational policy
```

When updating a heuristic:

1. state what evidence motivated the change;
2. update `SKILL.md` core only if the change is broadly applicable;
3. update `REFERENCE.md` detail;
4. update project method if it affects the production pipeline;
5. run `REGRESSION_CASES.md` afterward.
