---
name: music-production
description: >
  Bitwize AI music production workflow (Suno lyrics, prompts, mastering, album pipeline).
  Use when the user wants to create songs, write lyrics, craft Suno prompts, master audio,
  plan albums, or runs /music-production, /suno, /lyric-writer, /bitwize-music.
---

# Music Production (bitwize-music)

Project-local install of [claude-ai-music-skills](https://github.com/bitwize-music-studio/claude-ai-music-skills) (v0.99.0, CC0).

## Where files live

| Path | Content |
|------|---------|
| `.grok/plugins/bitwize-music/` | Full plugin (53 skills, genres, reference, tools, MCP server) |
| `.claude/skills/` | Vendored Bitwize skills plus project-local skills such as `abc-kids-music-composer` |
| `docs/MUSIC_SKILLS.md` | Install & setup notes for this monorepo |

Set `CLAUDE_PLUGIN_ROOT` / `GROK_PLUGIN_ROOT` mentally to:

```text
F:\MMO\Nhac\.grok\plugins\bitwize-music
```

(or the absolute path of that folder on the current machine).

## How to route work

Read the matching skill under `.grok/plugins/bitwize-music/skills/<name>/SKILL.md` and follow it. Key entry points:

| Intent | Skill folder |
|--------|----------------|
| Preschool ABC / phonics / letter-word vocabulary / ages 2–6 learning song | project-local `abc-kids-music-composer` first; generic Bitwize skills are supporting only |
| First-time setup / deps | `setup` |
| Artist / paths config | `configure` |
| New album | `new-album`, `album-conceptualizer` |
| Write / refine lyrics | `lyric-writer`, `lyric-refiner`, `lyric-reviewer` |
| Suno style prompts | `suno-engineer` |
| Pre-gen QC | `pre-generation-check`, `pronunciation-specialist` |
| Import stems / audio | `import-audio`, `import-track` |
| Mastering | `mastering-engineer`, `mix-engineer` |
| Research true stories | `researcher` (+ `researchers-*`) |
| Help / glossary | `help`, `tutorial` |

Full index: `.grok/plugins/bitwize-music/reference/SKILL_INDEX.md` and `docs/skills.md` inside the plugin.

## Integration with music-visualizer

This monorepo (`music-visualizer`) turns a finished song folder into lyric-synced video. Typical handoff:

1. Use bitwize skills to write lyrics + Suno prompts → generate audio on Suno.
2. Export / import audio into a song folder that matches visualizer layout (`assets/audio.*`, logos, A–Z letters, `metadata.json`).
3. Run visualizer: Load folder → Transcribe/Analyze (or drop prebuilt artifacts) → Build config → Render.

Optional: put mastered `audio.wav` under `samples/` or a library folder used by the Web App import flow.

## Windows notes

- Upstream plugin prefers Linux/macOS/WSL; skills markdown still work on Windows for writing/prompting.
- MCP server + mastering tools need Python 3.11+ and deps from `requirements.txt` (see `docs/MUSIC_SKILLS.md`).
- Original Linux MCP path saved as `.mcp.linux.json` in the plugin folder.

## Rules

- For preschool/ABC/phonics/vocabulary learning songs, route to the project-local `abc-kids-music-composer` before generic `lyric-writer`; its pedagogy and readiness rules override generic adult/streaming lyric limits when they conflict.
- Prefer reading the skill file before improvising production steps.
- Do not invent Suno “artist style” clones that violate platform ToS; follow skill disclaimers.
- For documentary/true-crime lyrics, follow source verification skills before writing.
