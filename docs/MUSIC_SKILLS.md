# Bitwize Music Skills (installed in-repo)

Upstream: [bitwize-music-studio/claude-ai-music-skills](https://github.com/bitwize-music-studio/claude-ai-music-skills). Installed vendored copy: **v0.99.0** (CC0). Audit note (2026-08-08): upstream `main` reports **v0.101.0**; treat a bulk refresh as a separate maintenance change and rerun project-local ABC routing/regression checks afterward.

## Layout

```text
.grok/plugins/bitwize-music/   # plugin root (skills, genres, reference, tools, MCP)
.grok/skills/music-production/ # Grok entry skill → routes to plugin
.claude/skills/                # vendored Bitwize skills + project-local abc-kids-music-composer
```

Tests suite from upstream was **not** vendored (keeps the monorepo small). Everything else needed for production workflows is present.

## Grok / Claude discovery

- **Plugin**: `.grok/plugins/bitwize-music` (project plugin; trust if prompted).
- **Skills**: `.claude/skills/*` and plugin `skills/*`.
- **Generic entry**: `/music-production` or describe lyric/Suno/album tasks.
- **Preschool ABC entry**: `abc-kids-music-composer` for ABC, phonics, letter-word vocabulary, and ages-2–6 educational songs. Its project-specific pedagogy/readiness rules take precedence over generic Bitwize adult/streaming lyric limits.

Reload plugins/skills after pull (`/plugins` → `r`, or restart TUI).

## MCP + audio tools (Python) — installed

Dedicated venv on this machine:

```text
C:\Users\Trieu\.bitwize-music\venv
```

Installed from `.grok/plugins/bitwize-music/requirements.txt` (mcp, matchering, librosa, playwright, boto3, …) plus Playwright Chromium.

MCP config (Windows): `.grok/plugins/bitwize-music/.mcp.json` points at that venv’s `python.exe`.  
Linux original path kept as `.mcp.linux.json`.

Reinstall / refresh:

```powershell
$py = "$env:USERPROFILE\.bitwize-music\venv\Scripts\python.exe"
py -3.12 -m venv $env:USERPROFILE\.bitwize-music\venv
& $py -m pip install -U pip
& $py -m pip install -r .grok\plugins\bitwize-music\requirements.txt
& $py -m playwright install chromium
```

Mastering / browser tools may still need system FFmpeg (already used by the visualizer). Prefer WSL if matchering/playwright paths misbehave on native Windows.

## Configure workspace

Run the `configure` skill (or set paths manually) so album/track templates land where you want (e.g. a `music/` or `albums/` folder next to the visualizer).

## Project-local preschool override

`ABC_KIDS_MUSIC_VISUAL_GENERATION_METHOD.md` and `.claude/skills/abc-kids-music-composer/` form a project-local specialization layered on top of Bitwize. Generic Bitwize skills remain useful for pronunciation, current Suno capabilities, prompt craft, and production, but must not override the ABC composer's objective-aware word-count, rhyme, section, melody, retrieval, or validation rules.

The bundled Learning Block / Section manifests and schemas are currently **authoring contracts**, not app runtime artifacts. Runtime contracts remain under `shared/src/schema/` until an explicit integration is implemented.

The vendored Bitwize copy may lag upstream. Update it as a separate maintenance task and rerun the ABC routing/conflict/regression audit after any bulk refresh so upstream generic rules do not silently regain precedence.

## Relation to music-visualizer

| Bitwize skills | Visualizer |
|----------------|------------|
| Lyrics, Suno prompts, mastering | Import folder → jobs → Remotion MP4 |
| Album/track markdown templates | `metadata.json` + `assets/*` song folders |

Handoff: finished audio + optional lyrics artifacts → song profile folder → Web App **Load selected song**.

## Update upstream

```powershell
# Re-clone shallow and re-copy (from repo root)
git clone --depth 1 https://github.com/bitwize-music-studio/claude-ai-music-skills.git _tmp_music_skills
robocopy _tmp_music_skills .grok\plugins\bitwize-music /E /XD .git .github tests __pycache__
robocopy .grok\plugins\bitwize-music\skills .claude\skills /E
Remove-Item _tmp_music_skills -Recurse -Force
```

Then re-apply Windows `.mcp.json` if overwritten.
