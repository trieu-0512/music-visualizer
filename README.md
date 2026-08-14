# Music Visualizer

Local-first app that turns song folders into lyric-synchronized,
audio-reactive music videos. It runs on one machine with local file storage and
a file-based job queue: no database, object store, or broker is required for the
MVP.

See [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) for the Vietnamese
project summary and [docs/ABC_SONG_PIPELINE.md](docs/ABC_SONG_PIPELINE.md) for
the theme-first ABC authoring -> Suno/image handoff -> segmentation -> render architecture.

**AI music production skills** (Suno lyrics/prompts, mastering, album pipeline)
are vendored from [bitwize-music](https://github.com/bitwize-music-studio/claude-ai-music-skills).
See [docs/MUSIC_SKILLS.md](docs/MUSIC_SKILLS.md) and Grok skill `/music-production`.
For preschool ABC/phonics/letter-word educational songs, use the project-local
`abc-kids-music-composer` skill and `ABC_KIDS_MUSIC_VISUAL_GENERATION_METHOD.md`
first; generic Bitwize lyric rules are supporting references for that route.

## Project Structure

```text
music-visualizer/
  shared/     # schemas, TypeScript types, validators, startup config
  backend/    # Express API: projects, folder import, assets, jobs, config, artifacts
  workers/    # Python worker: ABC asset prep/segmentation seam, transcription, lyrics, SRT, audio analysis
  remotion/   # Remotion templates, render orchestration, render worker
  frontend/   # React + Vite web app
  config/     # local storage + queue defaults
  storage/    # local project files and job records
  samples/    # sample project assets/artifacts
  docs/       # project documentation
  .grok/      # Grok project skills + bitwize-music plugin
  .claude/    # Claude-compatible skill copies (same music skills)
```

## Folder Workflow

The Web App no longer requires manually creating a project first. Select a
music library folder, for example:

```text
nhac-thieu-nhi/
  alphabet-song/
    metadata.json
    audio.wav
    background.png
    song-logo.svg
    channel-logo.svg
    original-lyrics.md
    A.svg
    ...
    Z.svg
  counting-song/
    metadata.json
    assets/
      audio.mp3
      background.jpg
      song-logo.png
      channel-logo.png
      letters/
        A.svg
        ...
        Z.svg
```

The app groups each song folder as a profile. Pick one profile, click `Check`,
review missing files, edit metadata, then click `Load selected song`.

Files may live directly inside each song folder, as shown above, or inside the
standard `assets/` layout (`assets/audio.wav`, `assets/letters/A.svg`, etc.).
The backend normalizes both forms into the same internal project layout. Direct
song folders can use names such as `audio.wav`, `0001.mp3`, `0001_lyrics.md`,
and `A.svg` through `Z.svg`.

Required core files per song:

- `assets/audio.mp3` or `assets/audio.wav`
- `assets/background.png|jpg|jpeg|webp`
- `assets/song-logo.png|svg`
- `assets/channel-logo.png|svg`

Asset mode is conditional:

- **Legacy:** processed `assets/letters/A..Z` (SVG/PNG/WebP).
- **Theme-first:** `authoring/mapping.json` plus either processed `letters/ + objects/` or one raw `assets/source-images/{A-Z}.*` image per target for the `prepare-assets` job. A mapping project is render-ready only after all 26 processed letters and objects exist.

Optional / authoring:

- `assets/original-lyrics.txt|json|md` — display/alignment lyric lines only. In theme-first folder import, `authoring/display-lyrics.txt` is automatically bridged here when no runtime lyric file is supplied. Do not paste Suno `[Verse]`/`[Chorus]` tags, Markdown headings, or production cues. For production ABC timing, verify the resulting `lyrics.json` or import a pre-aligned artifact.
- `metadata.json` or `project.json`
- `artifacts/lyrics.json`
- `artifacts/audio-analysis.json`
- `authoring/mapping.json` — canonical theme-first A-Z semantic mapping.
- `authoring/generation-lyrics.txt`, `display-lyrics.txt`, `style-prompt.txt`, `object-prompts.json` — agent-authored package derived from a locked mapping.
- `assets/source-images/A..Z.*` — raw AI-generated combined images for segmentation.

For a song folder that already contains `authoring/song-script.json`,
`authoring/mapping.json`, one audio file, one `.lrc`, and the 28 generated
source images, prepare all render inputs with:

```powershell
python scripts/prepare_abc_song.py abc-song/0001
```

The command validates the authored lyric against the LRC, extracts letter and
object PNGs from the pure-white matte, analyzes the audio, and writes a
landscape project config ready for the 2K renderer. Add `--render` to render
the full 2K video after preparation. The render CLI emits `RENDER_PROGRESS`
JSON lines with percent, frames, stage, elapsed time, and ETA.
- Processed `assets/objects/A..Z.*` for theme-first rendering.

`metadata.json` can contain:

```json
{
  "songName": "Alphabet Song",
  "singerName": "Kids Choir",
  "videoFormat": "both"
}
```

`title` and `artist` are also accepted as aliases.

## Render Outputs

Render jobs produce 60fps MP4s:

- `final-16x9-fullhd-60fps.mp4` at 1920x1080
- `final-9x16-fullhd-60fps.mp4` at 1080x1920
- `final-16x9-2k-60fps.mp4` at 2560x1440
- `final-9x16-2k-60fps.mp4` at 1440x2560
- `final-16x9-4k-60fps.mp4` at 3840x2160
- `final-9x16-4k-60fps.mp4` at 2160x3840

`both` renders all six files. `landscape` or `portrait` renders the three
matching outputs.

Use Remotion for production renders:

```powershell
cd F:\MMO\Nhac\music-visualizer
npm run render:remotion -- storage/projects/project-0001-render --target landscape-fullhd
```

The direct Remotion CLI writes MP4s to the project `artifacts/` folder. By
default it renders H.264/AAC with high quality settings, BT.709 color,
concurrency `6`, and `offthreadVideoThreads=8`. On Windows, the CLI will use
AMD AMF when a compatible FFmpeg is available; pass `--encoder x264 --crf 12`
to force CPU x264 CRF mode. To force a fixed bitrate:

```powershell
npm run render:remotion -- storage/projects/project-0001-render --target landscape-4k --video-bitrate 80M --maxrate 80M --bufsize 160M
```

## Prerequisites

- Node.js 20+ and npm.
- Python 3.10+ for the Audio Worker. Python 3.12 is the verified local runtime.
- FFmpeg on `PATH`.

## Install

```bash
npm install
```

Windows Python venv:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python -m pip install --upgrade pip
.\.venv\Scripts\python -m pip install -r workers\requirements.txt
```

`workers/requirements.txt` keeps WhisperX commented out so base installs stay
small. Install WhisperX separately on machines configured for real
transcription.

## Run Locally

Use separate terminals from the repo root:

```bash
npm run dev:api       # http://localhost:3000
npm run dev:web       # http://localhost:5173
npm run worker        # Python prepare-assets/transcribe/analyze worker
npm run render-worker # Remotion render worker
```

Web App default API target is `http://localhost:3000`. Override it with
`VITE_API_BASE_URL`.

## Jobs

After loading a song profile, the normal path is **Run full pipeline**. The Web App starts a persistent backend `PipelineRun`; the API detects whether the project has a locked mapping and runs:

```text
theme-first: prepare-assets -> transcribe + analyze -> build config -> render
legacy:      transcribe + analyze -> build config -> render
```

The run state is persisted under the project and resumed by the API supervisor, so closing/reloading the browser does not stop dependency continuation. Child jobs are tagged with the pipeline run id to avoid duplicate enqueue after API restart.

Manual per-stage buttons remain available for debugging/local repair. Mapping projects enrich timed learning lines with explicit `letter` + `object` identity. Newly built configs also snapshot SHA-256 hashes of every render dependency; the API and render worker reject stale configs if audio, lyrics, mapping, background, logos, letters, or objects change after the build.

If the imported folder already contains both `artifacts/lyrics.json` and
`artifacts/audio-analysis.json`, the backend builds `project-config.json`
during import.

## Test

```bash
npm run build
npm test
cd workers
..\.venv\Scripts\python -m pytest
```
