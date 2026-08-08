---
name: abc-song-catalog-designer
description: Designs large preschool ABC song catalogs with genuinely distinct themes and theme-conditioned A-Z object mappings. Use when creating, expanding, regenerating, or auditing batches of ABC song concepts such as 0001-0200.
---

# ABC Song Catalog Designer

Project-local catalog diversity skill. The authoritative rules are mirrored from `.claude/skills/abc-song-catalog-designer/SKILL.md`.

Core contract:

```text
CATALOG UNIVERSE
-> DISTINCT THEME SPECS
-> THEME-CONDITIONED A-Z MAPPING PROPOSALS
-> BATCH DIVERSITY AUDIT
-> REVIEW/LOCK
-> abc-kids-music-composer
```

Hard gates for a 200-song batch:

- exactly 200 expected ids;
- 0 duplicate theme names;
- 0 exact duplicate A-Z mappings;
- at least 40 macro domains;
- at most 5 songs per macro domain;
- every song has A-Z exactly once and every object begins with its target letter;
- max pairwise object-set Jaccard <= 0.40;
- near-name similarity >= 0.90 fails unless manually justified;
- mappings remain `PROPOSED` until reviewed/locked.

Never count title-suffix changes (`Adventure`, `Discovery`, `Friends`, `Learning Day`, `Parade`) as distinct concepts. Never game mapping diversity with cosmetic modifiers on the same object.

After diversity passes, run per-song Mapping QC. Tier B/C or pronunciation/safety/visual support warnings do not automatically reject a theme-fit mapping; hard integrity/safety/theme contradictions do. Promote passing proposals to `<song>/authoring/mapping.json` with `revision=1`, `state=LOCKED`, and `mappingAuthority=project-locked`. Use `scripts/review_and_lock_abc_mappings.py` for the project batch gate.

Downstream authoring is processed in batches of at most 10 locked songs: generate curated per-song profiles/packages, audit schema + target identity + pronunciation + batch hook/style diversity, mark the batch PASS, then continue. Never generate all 200 unchecked in one pass.

Read the Claude skill file for the complete operational/audit contract when doing catalog work.
