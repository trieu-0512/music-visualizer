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
- `workers/`: Python Worker cho `prepare-assets`/segmentation adapter, transcription, lyric alignment, SRT va
  audio analysis.
- `remotion/`: Remotion composition, template, headless render va render worker.
- `frontend/`: React + Vite web app cho load folder, preview, jobs va download
  artifact.
- `storage/`: local storage mac dinh. Khong can database, object store hay
  message broker cho MVP.

## Renderer va hieu ung ngoai

Remotion la renderer san xuat chinh trong app. Render truc tiep tu project
folder:

```powershell
cd F:\MMO\Nhac\music-visualizer
npm run render:remotion -- storage/projects/project-0001-render --target landscape-fullhd
```

Mac dinh Remotion encode H.264/AAC voi cau hinh chat luong cao, BT.709,
concurrency `6` va `offthreadVideoThreads=8`. Tren Windows, CLI uu tien AMD
AMF neu FFmpeg ho tro; dung `--encoder x264 --crf 12` neu muon ep CPU x264.
Neu can bitrate co dinh:

```powershell
npm run render:remotion -- storage/projects/project-0001-render --target landscape-4k --video-bitrate 80M --maxrate 80M --bufsize 160M
```

## Workflow hien tai

1. Mo Web App tai `http://localhost:5173`.
2. Chon mot thu muc cha, vi du `nhac-thieu-nhi/`.
3. App tu nhom cac thu muc con thanh song profile.
4. Bam `Check` tren mot thu muc bai hat.
5. App hien file da nhan dien, danh sach file thieu, va metadata co the sua.
6. Bam `Load selected song` de tao project neu du file bat buoc.
7. Vao `Jobs`; binh thuong bam `Run full pipeline`:
   - theme-first: `Prepare ABC assets` -> `Transcribe + Analyze` (parallel) -> `Build config` -> `Render`;
   - legacy: bo qua prepare-assets, sau do cung chay `Transcribe + Analyze` -> `Build config` -> `Render`.
   - cac nut tung stage van giu de debug/local repair.
   - `Transcribe` tao `lyrics.json`, `lyrics.srt`, `whisperx.json`; neu co mapping thi learning line mang explicit `letter` + `object`.

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

## File bat buoc va hai asset mode

Core moi bai:

- `assets/audio.mp3` hoac `assets/audio.wav`
- `assets/background.png|jpg|jpeg|webp`
- `assets/song-logo.png|svg`
- `assets/channel-logo.png|svg`

### Legacy mode

Khong co `authoring/mapping.json`: can processed `assets/letters/A..Z` (SVG/PNG/WebP).

### Theme-first mode

Co `authoring/mapping.json`: import co the bat dau voi 26 raw images:

```text
assets/source-images/A.png
...
assets/source-images/Z.png
```

hoac processed assets co san. Job `prepare-assets` chuan hoa ket qua thanh:

```text
assets/letters/A.png
assets/objects/A.png
...
assets/letters/Z.png
assets/objects/Z.png
```

Project theme-first chi render-ready khi du 26 processed letters + 26 processed objects. Letter va object la hai layer rieng; object label/lyric do Remotion render bang controlled text. Chi tiet: `docs/ABC_SONG_PIPELINE.md`.

## File tuy chon

- `assets/original-lyrics.txt`, `assets/original-lyrics.json`, hoac `assets/original-lyrics.md`
  - day la display/alignment lyrics, khong phai Suno generation prompt;
  - chi de cac dong lyric thuc su duoc hat/hien thi; khong chen Markdown title, `[Verse]`, `[Chorus]`, performance cue hay production instruction;
  - worker MVP hien ghep original lyric voi transcription theo thu tu/segment; production ABC phai verify count/timing sau transcribe, hoac import `artifacts/lyrics.json` da align/verify khi can timing chinh xac.
- `metadata.json` hoac `project.json`
- `artifacts/lyrics.json`
- `artifacts/audio-analysis.json`
- `authoring/mapping.json`: canonical theme-first A-Z object mapping.
- `authoring/generation-lyrics.txt`, `display-lyrics.txt`, `style-prompt.txt`, `object-prompts.json`: agent-authored dependent package sau Mapping Lock.
- `assets/source-images/A..Z.*`: raw generated images cho segmentation.
- `assets/objects/A..Z.*`: processed object assets.

## Quy tac tao prompt visual

Voi moi bai ABC, tao file `<ma_bai>_prompt_gen.txt` trong thu muc bai hat neu
can sinh anh bang AI. Moi dong la mot JSON object hop le, bat dau bang `{` va
ket thuc bang `}`.

Quy uoc id:

- `<ma_bai>A` den `<ma_bai>Z`: prompt foreground cho tung chu cai.
- `<ma_bai>background`: prompt background rieng.
- `<ma_bai>song_logo`: prompt logo bai hat rieng.

Quy tac foreground A-Z:

- Lay cap chu cai/object truc tiep tu `authoring/mapping.json` da `LOCKED`; khong reverse-engineer object tu lyric.
- Raw foreground generated co the gom target capital letter ben trai va object ben phai de segmentation model tach thanh hai processed assets; khong bake object label vao asset.
- Object label, lyric, title/artist neu can do Remotion/compositor render tu du lieu da kiem soat.
- Khong co background, phong hoc, tuong, san, khung, nguoi, watermark hay chu
  phu.
- Moi prompt foreground chi dung invisible placement/safe area. Prompt phai noi
  ro cac vung nay chi la layout instruction va khong duoc ve ra anh.
- Moi prompt foreground phai co negative instruction manh: `No visible
  placement boxes, no rectangle, no border, no outline, no frame, no black guide
  lines, no bounding box, no checkerboard pattern, no classroom scene, no floor,
  no wall, no scenery, no extra text, no watermark.`
- Neu dung Google Flow voi nen chroma green `#00FF00`, prompt foreground phai
  noi ngan gon rang mau chu cai va object khac ro mau nen chroma green.
- Prompt phai khoa layout bang invisible placement area de render video on
  dinh: canvas `2048x1152`, letter area `x=180..760 y=245..825`, object area
  `x=1110..1810 y=180..760`, gutter
  `x=820..1030`. Tranh cac cum nhu `fixed box`, `inside x=...`, hoac
  `do not exceed the box`.

Prompt background la anh nen binh thuong, tach rieng voi foreground. No phai
hop chu de bai hat va chua khoang trong cho info box, channel logo, foreground
asset va lyric box. Khong yeu cau SVG tru khi nguoi dung noi ro.

Phong cach visual khong co dinh cho moi bai. Moi bai phai lay material, bang
mau, mood va cach ve object tu chu de rieng cua bai do. Vi du bai classroom co
the dung paper-craft/school supplies, nhung bai farm/ocean/space/bedtime phai
co phong cach phu hop chu de do.

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
