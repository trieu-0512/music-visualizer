# Bitwize Music Skills (installed in-repo)

Upstream: [bitwize-music-studio/claude-ai-music-skills](https://github.com/bitwize-music-studio/claude-ai-music-skills) (v0.99.0, CC0).

## Layout

```text
.grok/plugins/bitwize-music/   # plugin root (skills, genres, reference, tools, MCP)
.grok/skills/music-production/ # Grok entry skill → routes to plugin
.claude/skills/                # 53 skills for Claude/Grok discovery
```

Tests suite from upstream was **not** vendored (keeps the monorepo small). Everything else needed for production workflows is present.

## Grok / Claude discovery

- **Plugin**: `.grok/plugins/bitwize-music` (project plugin; trust if prompted).
- **Skills**: `.claude/skills/*` and plugin `skills/*`.
- **Entry**: `/music-production` or describe lyric/Suno/album tasks (auto-route via description).

Reload plugins/skills after pull (`/plugins` → `r`, or restart TUI).

## Optional MCP + audio tools (Python)

Upstream MCP defaults to `~/.bitwize-music/venv`. On this Windows machine you can use the monorepo venv or create a dedicated one:

```powershell
# From repo root
py -3.12 -m venv $env:USERPROFILE\.bitwize-music\venv
& "$env:USERPROFILE\.bitwize-music\venv\Scripts\python.exe" -m pip install -U pip
& "$env:USERPROFILE\.bitwize-music\venv\Scripts\python.exe" -m pip install -r .grok\plugins\bitwize-music\requirements.txt
```

MCP config in plugin: `.grok/plugins/bitwize-music/.mcp.json`  
(Linux original path kept as `.mcp.linux.json`.)

Mastering / browser tools may need extra system deps (FFmpeg already used by the visualizer). Prefer WSL if matchering/playwright paths are painful on native Windows.

## Configure workspace

Run the `configure` skill (or set paths manually) so album/track templates land where you want (e.g. a `music/` or `albums/` folder next to the visualizer).

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
