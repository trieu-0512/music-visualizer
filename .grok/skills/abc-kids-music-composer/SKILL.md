---
name: abc-kids-music-composer
description: Project-specific preschool ABC, phonics, vocabulary and educational song composer for ages 2–6. Routes to the authoritative Claude-compatible ABC composer and project method instead of generic adult lyric rules.
---

# ABC Kids Music Composer — Grok Route

For preschool educational music, ABC songs, phonics songs, letter-word vocabulary songs, and related ages-2–6 work:

1. Read `ABC_KIDS_MUSIC_VISUAL_GENERATION_METHOD.md` as project authority.
2. Read `.claude/skills/abc-kids-music-composer/SKILL.md` as the compact operational core.
3. Load only the bundled reference files that core requests for the current task.
4. Treat generic Bitwize `lyric-writer`, `lyric-reviewer`, `suno-engineer`, and `pre-generation-check` as supporting craft/provider references only.
5. When generic Bitwize rules conflict with the project-specific preschool composer, the preschool method/core wins for pedagogy, density, rhyme, motif, retrieval, and readiness semantics.

Do not duplicate the full rule system here. The `.claude/skills/abc-kids-music-composer/` folder is the single project-local skill source of truth.
