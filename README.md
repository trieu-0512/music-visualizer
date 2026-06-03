# Music Visualizer

Local-first app that turns song folders into lyric-synchronized,
audio-reactive music videos. It runs on one machine with local file storage and
a file-based job queue: no database, object store, or broker is required for the
MVP.

See [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) for the Vietnamese
project summary, folder contract, workflow, and output list.

## Project Structure

```text
music-visualizer/
  shared/     # schemas, TypeScript types, validators, startup config
  backend/    # Express API: projects, folder import, assets, jobs, config, artifacts
  workers/    # Python audio worker: transcription, lyrics, SRT, audio analysis
  remotion/   # Remotion templates, render orchestration, render worker
  frontend/   # React + Vite web app
  config/     # local storage + queue defaults
  storage/    # local project files and job records
  samples/    # sample project assets/artifacts
  docs/       # project documentation
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

Required per song:

- `assets/audio.mp3` or `assets/audio.wav`
- `assets/background.png|jpg|jpeg|webp`
- `assets/song-logo.png|svg`
- `assets/channel-logo.png|svg`
- `assets/letters/A.svg` through `assets/letters/Z.svg`

Optional:

- `assets/original-lyrics.txt|json|md`
- `metadata.json` or `project.json`
- `artifacts/lyrics.json`
- `artifacts/audio-analysis.json`

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
npm run worker        # Python transcribe/analyze worker
npm run render-worker # Remotion render worker
```

Web App default API target is `http://localhost:3000`. Override it with
`VITE_API_BASE_URL`.

## Jobs

After loading a song profile:

1. Run `Transcribe` if `lyrics.json` is not already present.
2. Run `Analyze` if `audio-analysis.json` is not already present.
3. Click `Build config`.
4. Run `Render`.

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
