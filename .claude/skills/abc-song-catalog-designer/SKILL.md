---
name: abc-song-catalog-designer
description: Designs large preschool ABC song catalogs with genuinely distinct themes and theme-conditioned A-Z object mappings. Use when creating, expanding, regenerating, or auditing batches of ABC song concepts such as 0001-0200.
model: opus
effort: max
allowed-tools:
  - Read
  - Edit
  - Write
  - Grep
  - Glob
---

# ABC Song Catalog Designer

This skill owns **catalog diversity and batch-level mapping quality**. It does not write final lyrics. After a catalog entry passes diversity review and its mapping is human/project locked, hand it to `abc-kids-music-composer`.

## Core dependency

```text
CATALOG UNIVERSE
-> DISTINCT THEME SPECS
-> THEME-CONDITIONED A-Z MAPPING PROPOSALS
-> BATCH DIVERSITY AUDIT
-> HUMAN/PROJECT REVIEW
-> LOCKED mapping.json
-> abc-kids-music-composer
```

Never generate 10 renamed titles from one mapping and count them as 10 distinct songs.

## Theme model

Each song has two levels:

```text
macro_domain
= broad organizational bucket, e.g. Ocean & Coast

semantic_focus
= the actual song theme, e.g. Tide Pools / Deep Sea / Harbor Boats
```

A macro domain may contain several songs, but each song must have a different semantic focus. Theme names are not allowed to differ only by generic suffixes such as `Adventure`, `Discovery`, `Friends`, `Learning Day`, or `Parade`.

## Mapping model

Every song receives its own proposed A-Z mapping. Mapping is evaluated in the context of that song's semantic focus using the composer policy:

- letter fit;
- theme fit;
- age familiarity;
- imageability;
- actionability;
- pronunciation/stress risk;
- distinctiveness;
- support cost.

Hard letters may use guided-theme fallbacks, but a fallback must still make sense in the scene/episode and must not silently redefine the theme.

## Batch Diversity Hard Gates

For a 200-song batch:

```text
song ids                         = exactly 200 expected ids
exact theme-name duplicates      = 0
exact A-Z mapping duplicates     = 0
macro domains                    >= 40
songs per macro domain           <= 5
semantic focus names             = unique
mapping state                    = PROPOSED until reviewed
A-Z completeness                 = 26/26 every song
letter/object initial fit        = 26/26 every song
```

### Mapping overlap

Use object-set Jaccard similarity between every pair of songs:

```text
J(A,B) = |A intersection B| / |A union B|
```

Hard gate for generated catalogs:

```text
max pairwise Jaccard <= 0.40
exact duplicate Jaccard = 1.0 is always FAIL
within-macro mean should normally <= 0.35
cross-macro mean should remain low
```

Do not game the metric by renaming the same concept (`Anchor` -> `Anchor Rope`) solely to appear unique. Human review should treat trivial modifiers, pluralization, and cosmetic compounds as the same semantic object when deciding whether a mapping is genuinely different.

### Theme-name similarity

Normalize case/punctuation and compare theme names pairwise.

```text
similarity >= 0.90 -> FAIL unless clearly different established concepts
0.82-0.89          -> REVIEW
```

Generic repeated tokens are also audited. A catalog should not be dominated by formula names like `[Domain] Adventure`, `[Domain] Discovery`, `[Domain] Friends`.

## Diversity design strategy

Prefer breadth before variants. Build a universe across nature, animals, places, routines, community, science, fantasy, food, arts, movement, transport, seasons, and everyday life.

Within a macro domain, use distinct semantic focuses rather than title variants. Example:

```text
GOOD
Coral Reef
Deep Sea
Tide Pools
Harbor Boats
Polar Ocean

BAD
Ocean Adventure
Ocean Discovery
Ocean Friends
Ocean Learning Day
Ocean Parade
```

## Output contract

For each song directory while still proposed:

```text
0001/
  theme.txt
  objects.txt
  mapping.proposal.json
```

Root catalog:

```text
THEMES.md
themes.csv
DIVERSITY_AUDIT.md
DIVERSITY_AUDIT.json
```

Do **not** create canonical `mapping.json` until review/lock. A batch-generation script may regenerate proposals, but it must never overwrite a locked production mapping silently.

## Audit order

1. Validate ids and files.
2. Validate 26 letters and first-letter fit.
3. Count exact theme duplicates.
4. Count macro domains and max songs/domain.
5. Check exact mapping signatures.
6. Calculate pairwise object Jaccard.
7. Calculate near-name similarity.
8. Inspect generic naming-token frequency.
9. Sample each macro domain for human semantic-fit review.
10. Emit PASS/WARN/FAIL report.

## Status

A generated 200-song catalog is ready for mapping review only when all hard gates pass.

```text
CATALOG_STATUS = REWORK | READY_FOR_MAPPING_REVIEW
```

`READY_FOR_MAPPING_REVIEW` does not mean mappings are production locked. It means the batch is diverse enough to begin per-song Mapping QC.

## Authoring batch handoff

After mappings are locked, create downstream composer packages in **batches of at most 10 songs**. Do not mass-generate all 200 authoring packages in one unchecked pass.

```text
10 locked songs
-> curated SongProfile per song
-> composer authoring package
-> schema + semantic + pronunciation audit
-> batch diversity audit
-> mark batch PASS
-> only then continue to the next 10
```

For every authoring batch require:

- all canonical mappings remain unchanged and revision-matched;
- 52 target occurrences per two-round song (26 teaching + 26 retrieval);
- Round 2 uses `objectReveal=target-word`;
- no unresolved pronunciation `VERIFY` before a clean PASS;
- unique hooks and style prompts inside the batch;
- no exact duplicate lyrics;
- batch progress is persisted so interrupted work resumes from the next pending group.

A `PASS_WITH_REVIEW` batch may be stored, but it is not equivalent to a clean `PASS`; clear the listed review items before treating it as generation-ready.

## Mapping QC and lock promotion

After diversity passes, review every proposal before creating a production mapping. Distinguish **hard failures** from **support cost**. Hard failures block lock: missing/duplicate A-Z targets, wrong initial letter, duplicate canonical object inside one song, empty/unstable labels, explicit child-safety contradiction, or a clear theme contradiction not justified by guided-theme scarcity. Tier B/C vocabulary, pronunciation/stress verification, visually complex targets, adult tools kept in safe context, and Q/X/Z fallbacks are support warnings rather than automatic rejection.

Passing proposals may be promoted to `<song>/authoring/mapping.json` with `version=1`, `revision=1`, `state=LOCKED`, and `mappingAuthority=project-locked`. Attach `familiarityTier` and `riskFlags` so `abc-kids-music-composer` can apply stronger teaching, pronunciation verification, safe-action restrictions, and visual support.

Use `scripts/review_and_lock_abc_mappings.py` without `--lock` first; use `--lock` only when the summary reports zero hard-fail songs.
