# Music Visualizer — Project Instructions

## Preschool / ABC routing

For preschool educational songs, ABC songs, phonics songs, letter-to-word vocabulary songs, or kids learning songs for roughly ages 2–6, use the project-specific composer first:

- `.claude/skills/abc-kids-music-composer/SKILL.md`
- `ABC_KIDS_MUSIC_VISUAL_GENERATION_METHOD.md`

For these tasks, authority is explicit: **user instruction / locked mapping > project method > ABC composer core > generic Bitwize support > creative preference**. Generic Bitwize music skills may be used as supporting craft/provider references, but they must not override the preschool rules.

### Conflict policy for preschool tasks

Do **not** inherit these generic adult/streaming rules as hard gates when they conflict with the ABC composer:

- generic >400/>500-word hard-fail thresholds;
- generic <200-word "too short" assumptions;
- genre rhyme-scheme hard requirements;
- universal verse-length rules when the ABC section manifest is already within its objective-aware density limits;
- universal per-section performance-cue requirements;
- a requirement that important words must receive a melodic high note.

Use the ABC composer's objective-aware rules instead: lexical-semantic clarity, correct pronunciation/stress, target intelligibility, safe local density, predictable motif families, retrieval/response space, and child participation.

Generic pronunciation tools remain useful. For avoidable homographs in preschool lyrics, rewriting to a clear word is preferred when it preserves the locked mapping and meaning; if ambiguity remains, resolve pronunciation explicitly.

For non-preschool music work, use the normal Bitwize routing and rules.

## Runtime vs authoring contracts

The ABC `Learning Block Manifest` and `Section Manifest` are currently **authoring/composer contracts**. Their schemas live under `.claude/skills/abc-kids-music-composer/` and are not yet part of the app's shared runtime artifact contract.

The current runtime source of truth remains the schemas under `shared/src/schema/` plus the worker/backend/remotion contracts. Do not claim the app consumes composer manifests unless that integration is implemented.

## Change discipline

- Never silently change a user-locked `LETTER -> WORD` mapping.
- Keep provider-specific assumptions lower priority than educational hard gates.
- Re-run ABC regression/lint checks after material rule changes.
- Keep unrelated `local-coding-agent/` and `Bat_Tunnel.bat` changes separate from ABC work.
