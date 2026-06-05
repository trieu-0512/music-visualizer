# Music Visualizer - Tai lieu tong hop

## Muc tieu

Music Visualizer la ung dung local-first de bien mot thu muc bai hat thanh video
nhac co lyric dong bo va hieu ung theo audio. Ung dung uu tien workflow chon
thu muc nhac tren may, check du file bat buoc, tao project noi bo, sau do chay
transcribe/analyze/render bang worker.

## Kien truc

- `shared/`: JSON schema, type TypeScript, validator va startup config.
- `backend/`: Express API cho project, import folder, asset, artifact, config va
  job queue.
- `workers/`: Python Audio Worker cho transcription, lyric alignment, SRT va
  audio analysis.
- `remotion/`: Remotion composition, template, headless render va render worker.
- `frontend/`: React + Vite web app cho load folder, preview, jobs va download
  artifact.
- `storage/`: local storage mac dinh. Khong can database, object store hay
  message broker cho MVP.

## Renderer va hieu ung ngoai

Remotion van la renderer san xuat co san trong app. Neu can thu pipeline
`html-video`, dung handoff CLI de bien artifact chuan cua project thanh scene
data:

```bash
npm run handoff -- storage/projects/project-0001-render
```

Lenh nay tao:

- `artifacts/html-video-storyboard.json`: storyboard/timeline cho template
  `html-video`.
- `artifacts/openreel-effects-manifest.json`: danh sach hieu ung tham khao tu
  `Augani/openreel-video`.

OpenReel khong duoc dung lam renderer va khong tao `openreel-project.json`.
OpenReel chi la nguon tham khao de port hieu ung vao template HTML: beat letter
pop, karaoke word highlight, audio bars, background breathe, scene crossfade.

De cai `html-video` lam renderer core:

```powershell
cd F:\MMO\Nhac
git clone https://github.com/nexu-io/html-video.git
cd html-video
npx pnpm@9.15.0 install
npx pnpm@9.15.0 build
npx pnpm@9.15.0 --filter @html-video/adapter-hyperframes exec playwright install chromium
```

Render MP4 that bang `html-video` tu project hien tai:

```powershell
cd F:\MMO\Nhac\music-visualizer
npm run handoff -- storage/projects/project-0001-render
npm run render:html-video -- storage/projects/project-0001-render --target landscape-fullhd --max-duration 3
```

Bo `--max-duration 3` de render full song. File MP4 se nam trong
`storage/projects/<project-id>/artifacts/`. Video duoc capture bang
`html-video` Hyperframes adapter, sau do ffmpeg mux audio goc vao output.

## Workflow hien tai

1. Mo Web App tai `http://localhost:5173`.
2. Chon mot thu muc cha, vi du `nhac-thieu-nhi/`.
3. App tu nhom cac thu muc con thanh song profile.
4. Bam `Check` tren mot thu muc bai hat.
5. App hien file da nhan dien, danh sach file thieu, va metadata co the sua.
6. Bam `Load selected song` de tao project neu du file bat buoc.
7. Vao `Jobs` de chay:
   - `Transcribe`: tao `lyrics.json`, `lyrics.srt`, `whisperx.json`.
   - `Analyze`: tao `audio-analysis.json`.
   - `Build config`: tao `project-config.json`.
   - `Render`: tao video MP4.

Neu folder da co san `artifacts/lyrics.json` va `artifacts/audio-analysis.json`,
backend se build `project-config.json` ngay trong luc import.

## Cau truc thu muc nhac

Thu muc cha co nhieu thu muc bai hat:

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
    B.svg
    ...
    Z.svg
```

Hoac dung layout chuan noi bo:

```text
nhac-thieu-nhi/
  alphabet-song/
    metadata.json
    assets/
      audio.wav
      background.png
      song-logo.svg
      channel-logo.svg
      original-lyrics.md
      letters/
        A.svg
        B.svg
        ...
        Z.svg
```

Backend se tu chuan hoa ca hai dang ve layout noi bo `assets/...`.

## File bat buoc trong moi bai hat

- `assets/audio.mp3` hoac `assets/audio.wav`
- `assets/background.png|jpg|jpeg|webp`
- `assets/song-logo.png|svg`
- `assets/channel-logo.png|svg`
- `assets/letters/A.svg` den `assets/letters/Z.svg`

Neu file dat truc tiep trong thu muc bai hat, app cung nhan cac ten tuong duong
nhu `audio.wav`, `0001.mp3`, `background.png`, `song-logo.svg`,
`channel-logo.svg`, `0001_lyrics.md`, va `A.svg` den `Z.svg`.

Moi file chu cai A-Z nen la SVG nen trong suot, gom chu cai va object minh hoa.
Ung dung hien check thieu/du theo ten file; viec kiem tra noi dung SVG la trach
nhiem cua nguoi tao asset.

## File tuy chon

- `assets/original-lyrics.txt`, `assets/original-lyrics.json`, hoac `assets/original-lyrics.md`
- `metadata.json` hoac `project.json`
- `artifacts/lyrics.json`
- `artifacts/audio-analysis.json`

## Metadata

`metadata.json` co the dung cac key sau:

```json
{
  "songName": "Alphabet Song",
  "singerName": "Kids Choir",
  "videoFormat": "both"
}
```

Alias duoc chap nhan:

- `title` thay cho `songName`
- `artist` thay cho `singerName`

`videoFormat` hop le:

- `both`
- `landscape`
- `portrait`

Frontend se load metadata tu file, hien len form, va cho sua truoc khi import.

## Output render

Render worker tao video 60fps theo tung format:

- `artifacts/final-16x9-fullhd-60fps.mp4` - 1920x1080
- `artifacts/final-9x16-fullhd-60fps.mp4` - 1080x1920
- `artifacts/final-16x9-2k-60fps.mp4` - 2560x1440
- `artifacts/final-9x16-2k-60fps.mp4` - 1440x2560
- `artifacts/final-16x9-4k-60fps.mp4` - 3840x2160
- `artifacts/final-9x16-4k-60fps.mp4` - 2160x3840

Chon `both` se render ca 6 file. Chon `landscape` hoac `portrait` se render 3
file tuong ung.

## Lenh chay local

```bash
npm install
npm run dev:api
npm run dev:web
```

Python worker tren Windows nen dung venv Python 3.12:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python -m pip install --upgrade pip
.\.venv\Scripts\python -m pip install -r workers\requirements.txt
```

Chay worker:

```bash
npm run worker
npm run render-worker
```

## Kiem thu

```bash
npm run build
npm test
cd workers
..\.venv\Scripts\python -m pytest
```
