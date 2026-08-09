# ABC Kids Music Composer — Rule Governance

This file governs how the rule system itself evolves. Use it when adding, removing, or materially changing rules.

## Goal

A strong rule system is not the one with the most rules. It is the one whose rules are:

- scoped;
- prioritized;
- evidence-labeled;
- testable;
- non-duplicative;
- override-safe;
- easy to maintain;
- connected to real generation/learning outcomes.

## Rule record

Every material new rule should be describable with:

```yaml
rule_id:
title:
scope:
class: HARD_GATE | OBJECTIVE_SPECIFIC | HEURISTIC | CREATIVE_PREFERENCE
applies_when:
does_not_apply_when:
evidence_class:
override_policy:
failure_severity:
regression_case:
owner_file:
```

Do not add a rule that cannot state its scope and override behavior.

## Evidence classes

```text
RESEARCH
peer-reviewed or credible research relevant to child learning/language/music

PROVIDER_DOC
current official documentation for Suno or another generation provider

PROJECT_EMPIRICAL
a recurring pattern observed across controlled project generations/evaluations

CRAFT_REFERENCE
professional songwriting/music-education practice such as Bitwize guidance

PROJECT_HEURISTIC
reasonable working default not yet empirically validated
```

A rule may have more than one evidence class.

Do not present a PROJECT_HEURISTIC as a research fact.

## Rule classes

### HARD_GATE

Use sparingly. Appropriate for:

- wrong educational mapping;
- child safety;
- known pronunciation/stress error;
- target unintelligibility after audio validation;
- letter-name/phonics mode contradiction;
- severe density causing skipped/rushed targets;
- manifest inconsistency that changes learning content.

Hard gates need at least one regression case.

### OBJECTIVE_SPECIFIC

Applies only to a learning job:

- lexical-semantic;
- verbatim/sequence;
- retrieval/action;
- phonics.

Never promote an objective-specific preference into a global rule without evidence.

### HEURISTIC

Examples:

- phraselet-aware line density rather than a universal physical-line word/syllable target;
- intentional short/medium/extended line contrast when it improves prosody and song identity;
- 4–6 learning targets per section;
- roughly 80–100 BPM starting envelope;
- four-beat call/response frame.

Heuristics must be easy to override when repeated audio/child evidence favors another value.

### CREATIVE_PREFERENCE

Examples:

- xylophone vs ukulele;
- exact transition color;
- optional backing vocal;
- exact rhyme family.

Creative preferences must never block a pedagogically strong song.

## Authority order

```text
explicit user constraint
> project method / locked mapping
> SKILL.md core
> REFERENCE.md detail
> provider convenience
> creative preference
```

If a user constraint creates a pedagogical or generation risk, preserve the user's locked content and report the risk unless the user authorizes a change.

`SKILL.md` is the compact operational core. `REFERENCE.md` may elaborate but may not silently override it.

## Duplication policy

Before adding a rule:

1. search `SKILL.md`;
2. search `REFERENCE.md`;
3. search project method;
4. decide which file owns the rule;
5. add cross-reference instead of duplicate wording when possible.

Use this ownership model:

```text
SKILL.md              core operational policy
REFERENCE.md          detailed craft/provider examples
LINT_SPEC.md          deterministic/semi-deterministic pre-generation checks
EVALUATION_PROTOCOL.md post-generation measurement/calibration
REGRESSION_CASES.md   maintenance tests
RULE_GOVERNANCE.md    rule-system evolution policy
project method        end-to-end project production source of truth
```

## Change protocol

For a material rule change:

1. identify the problem/failure pattern;
2. classify evidence;
3. state whether this is hard gate, objective-specific rule, heuristic, or creative preference;
4. patch the smallest authoritative location;
5. synchronize only the dependent summaries/contracts;
6. add or update regression cases;
7. run stale-rule searches;
8. if based on generation performance, log evidence using `EVALUATION_PROTOCOL.md`;
9. do not call the change stable until contradictions are resolved.

## Deprecation protocol

Do not leave an old heuristic beside the new one.

When replacing a rule:

- remove old positive wording;
- keep historical explanation only if clearly labeled `legacy/deprecated`;
- search all bundled files and project method for stale numeric ranges or old terminology;
- update regression tests if behavior intentionally changed.

Examples of stale-rule searches already useful in this project:

```text
8 seconds
70–85 BPM
82–86 BPM
10–18 sung words
12–24 sung syllables
26 clips
UM-brel-la
Rhyme-Forward Default
```

## Provider-version policy

Provider UI/features change faster than pedagogy.

- Keep educational rules provider-neutral.
- Put provider-specific current behavior in reference/provider sections.
- Prefer capability wording (`section replacement`, `saved voice identity`) over brittle UI wording.
- Re-check official provider documentation before changing a workflow rule based on current features.

## Research translation policy

Do not convert a research result into a broader rule than the evidence supports.

Examples:

- a study showing singing helps verbatim poem recall does **not** mean all vocabulary should be maximally melodic;
- a study showing retrieval helps retention does **not** define one universal retrieval-gap duration;
- common preschool tempo distributions do **not** create a magic BPM hard gate;
- letter-name sound-cue research matters most for phonics/sound instruction, not every letter-name song.

Translate research into the narrowest useful rule, then validate in project generations.

## Evidence-driven heuristic update

Change a heuristic only when at least one of these is true:

- repeated controlled project evidence shows the current default underperforms;
- strong new research directly addresses the same use case;
- current provider behavior makes the heuristic technically obsolete;
- the heuristic conflicts with a higher-priority hard gate/objective rule.

One anomalous generation should trigger local repair, not system-wide policy change.

## Rule-system health audit

Periodically inspect:

```text
core SKILL size
number of duplicated numeric heuristics
stale provider terminology
unscoped hard gates
heuristics stated as facts
missing regression tests
L0 checks falsely marked PASS despite requiring audio
method/skill/reference contradictions
manifest fields used by only one subsystem
```

Target outcome: fewer contradictions and clearer execution, not maximum rule count.
## Current creative-variation rule records — 2026-08-08

```yaml
- rule_id: CV-LYR-001
  title: Phraselet-aware line length
  scope: catalog-quality preschool/ABC songwriting
  class: HEURISTIC
  applies_when: writing or reviewing generation-facing learning lyrics
  does_not_apply_when: exact user-locked text must be preserved verbatim
  evidence_class: [CRAFT_REFERENCE, PROJECT_HEURISTIC]
  override_policy: audio/child evidence may favor a more regular meter; pronunciation/safety/mapping hard gates still win
  failure_severity: WARN or REWORK when fixed-length pressure causes filler/rushing
  regression_case: short and multi-phrase long Apple lines both remain valid
  owner_file: SKILL.md + CREATIVE_VARIATION_PLAYBOOK.md + LINT_SPEC.md

- rule_id: CV-LYR-002
  title: Controlled target-entry variation
  scope: catalog-quality adaptive songs
  class: HEURISTIC
  applies_when: A-Z or repeated target series is being authored
  does_not_apply_when: exact repetition is intentionally declared as chant/refrain hook
  evidence_class: [CRAFT_REFERENCE, PROJECT_HEURISTIC]
  override_policy: preserve more repetition when predictability/actual generation benefits; avoid random novelty
  failure_severity: WARN or REWORK for severe accidental template monotony
  regression_case: one skeleton x26 warns; coherent 3–6-family palette passes
  owner_file: SKILL.md + CREATIVE_VARIATION_PLAYBOOK.md + LINT_SPEC.md

- rule_id: CV-STY-001
  title: AI-music performance blueprint
  scope: Suno/AI-music handoff
  class: HEURISTIC
  applies_when: style prompt accompanies full structured educational lyrics
  does_not_apply_when: user requests an intentionally minimal style prompt
  evidence_class: [PROVIDER_DOC, CRAFT_REFERENCE, PROJECT_HEURISTIC]
  override_policy: provider limits may force compression; preserve diction/section behavior before decorative descriptors
  failure_severity: WARN when prompt is only genre + instruments and misses critical section behavior
  regression_case: prompted gap remains PENDING AUDIO; section-aware prompt preferred
  owner_file: SKILL.md + REFERENCE.md + LINT_SPEC.md

- rule_id: CV-LYR-003
  title: Authorial intent and lyric identity
  scope: catalog-quality preschool/ABC songwriting
  class: HEURISTIC
  applies_when: creating or deeply rewriting a full song intended to have its own catalog identity
  does_not_apply_when: user requests a deliberately neutral drill/chant or exact locked lyric must remain verbatim
  evidence_class: [CRAFT_REFERENCE, PROJECT_HEURISTIC]
  override_policy: mapping, pronunciation, semantics, safety, and intelligibility always outrank identity devices; a strong simple chant may intentionally use less narrative identity
  failure_severity: WARN or REWORK when technically varied songs remain interchangeable after target nouns are removed
  regression_case: different rhyme schemes do not count as distinct identity if the remaining language is generic; coherent narrator/image/verb/arc language passes
  owner_file: SKILL.md + CREATIVE_VARIATION_PLAYBOOK.md
```
## Audit-standard versioning

When a material lint/readiness change alters what `PASS` means for catalog authoring, increment the authoring audit standard/version. A historical PASS from an older audit version must not be silently treated as current-standard PASS.

Progress tracking must distinguish:

```text
authoring package exists
legacy structural audit passed
current creative standard validated
```

Cross-catalog validation for the current standard fails closed on stale batch audits. Re-running only one upgraded batch must not relabel untouched legacy batches as upgraded.

Regression requirement: a v0/legacy `PASS` audit cannot satisfy a `creative-v4` cross-audit that requires audit version 4.
