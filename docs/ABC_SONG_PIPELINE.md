# ABC Theme-First Song-to-Video Pipeline

## 1. Muc tieu

Pipeline nay bien mot y tuong chu de thanh video ABC hoan chinh theo thu tu bat buoc:

```text
THEME
  -> A-Z OBJECT MAPPING
  -> MAPPING LOCK
  -> LYRICS + MUSIC PROMPT + IMAGE PROMPTS
  -> HUMAN GENERATION (Suno + image generator)
  -> SONG FOLDER HANDOFF
  -> PREPARE ASSETS / SEGMENTATION
  -> TRANSCRIBE + ALIGN
  -> AUDIO ANALYSIS
  -> BUILD CONFIG
  -> REMOTION RENDER
```

Nguyen tac quan trong nhat:

> Theme va `LETTER -> OBJECT` mapping duoc quyet dinh truoc. Lyric, prompt anh, alignment va renderer deu phai tham chieu cung mot mapping da khoa.

Khong reverse-engineer object tu lyric neu `authoring/mapping.json` ton tai.

---

## 2. Phan chia trach nhiem

| Phase | Agent | Human | Automatic tool |
|---|---|---|---|
| Theme brief | Tao/phan tich theme, age, mode, scope | Chon/duyet theme neu can | Validate schema sau khi luu |
| A-Z mapping | De xuat candidate theo theme, QC context-conditioned | **Duyet/lock mapping** | Validate A-Z completeness |
| Learning design | Tao action, visual hint, risk flag, teaching support | Review target dac biet neu can | Lint schema/rules |
| Lyrics/music | Viet lyric, rhyme architecture, Suno style prompt tu mapping da khoa | Co the duyet lyric | L0 lint/QC |
| Image prompts | Tao 26 prompt tu mapping/manifests | Co the chon style/anh dep | Prompt pack generation khi co agent |
| Audio generation | Chuan bi Suno inputs | **Dung Suno va chon file audio** | Chua tu dong hoa provider generation |
| Image generation | Chuan bi image prompts | **Dung image generator va chon 26 raw images** | Chua tu dong hoa provider generation |
| File handoff | Huong dan naming/manifest | **Copy MP3 + raw images vao song folder** | Folder importer normalize |
| Asset segmentation | Khong can agent neu adapter da cau hinh | Review/correct bad cuts; co the cat thu cong | `prepare-assets` job; external model adapter |
| Transcription/alignment | Khong can agent | Nghe/check neu target nghi ngo | WhisperX + canonical lyric alignment + mapping enrichment |
| Audio analysis | Khong can agent | Khong | Python analyze worker |
| Config | Khong can agent | Khong | Backend ConfigBuilder |
| Video render | Khong can agent | Preview/QC final | Remotion render worker |
| Failure repair | Agent co the chan doan lyric/prompt | Quyet dinh regenerate neu can | Local section/asset rerun khi phu hop |

### Quy tac ownership

- **Agent decides creative structure, not final human acceptance.**
- **Human owns provider generation and selection** cho Suno/image generation trong workflow hien tai.
- **Automatic pipeline owns deterministic processing** sau khi file duoc copy vao folder.
- Mapping da `LOCKED` la contract. Doi object sau lock phai mo lai Mapping Gate va regenerate cac artifact phu thuoc.

---

## 3. Gate G1 — Theme & Mapping Lock

### Input

```text
theme idea
age band
language/locale
LETTER_NAME or PHONICS
strict / guided / open theme scope
```

### Agent output dau tien

Chi tao:

```text
Theme Plan
A-Z Mapping
Mapping QC / warnings
```

**Khong viet lyric va khong viet image prompts truoc khi mapping duoc chap nhan/khoa.**

### Canonical file

`authoring/mapping.json`

Schema: `shared/src/schema/learning-map.schema.json`.

Vi du toi gian:

```json
{
  "version": 1,
  "theme": {
    "name": "Ocean Adventure",
    "scope": "strict",
    "mappingAuthority": "project-locked",
    "ageBand": "mixed-2-6",
    "mode": "LETTER_NAME"
  },
  "letters": {
    "A": { "object": "Anchor", "action": "drop", "familiarityTier": "B" },
    "B": { "object": "Boat", "action": "sail", "familiarityTier": "A" },
    "C": { "object": "Coral", "action": "wave", "familiarityTier": "B" }
  }
}
```

File thuc te phai co du A-Z.

### Mapping selection policy

Khong co universal word leaderboard. Candidate duoc so sanh theo context:

```text
LETTER FIT
MODE FIT
THEME FIT
AGE FAMILIARITY
IMAGEABILITY
ACTIONABILITY
PRONUNCIATION / STRESS RISK
DISTINCTIVENESS
SUPPORT COST
```

Tier A/B/C la **teaching-support requirement**, khong phai bang xep hang object toan cuc.

---

## 4. Gate G2 — Dependent Authoring Package

Sau khi mapping LOCKED, agent moi duoc tao cac artifact phu thuoc.

### Lyrics package

```text
authoring/generation-lyrics.txt  # dua vao Suno, co section tags neu can
authoring/display-lyrics.txt     # canonical sung lines cho visual alignment
authoring/style-prompt.txt       # Suno style prompt
authoring/exclude-styles.txt     # optional
```

Sau khi copy vao runtime song folder, `display-lyrics.txt` nen duoc dat/normalize thanh:

```text
assets/original-lyrics.txt
```

`assets/original-lyrics.txt` chi chua sung lines. Khong chua Markdown title, `[Verse]`, `[Chorus]`, production instructions.

### Image prompt package

```text
authoring/object-prompts.json
```

Moi A-Z prompt phai lay object tu `mapping.json`, khong tu y thay object de de ve hon.

Raw image convention (ca hai kieu ten duoc folder importer normalize theo letter key):

```text
assets/source-images/A.png
assets/source-images/B.png
...
assets/source-images/Z.png

# hoac ten de human nhan dien hon
assets/source-images/A_apple.png
assets/source-images/B_book.png
...
```

Trong `source-images/` va `objects/`, ten co the bat dau bang `A_`/`A-`, `B_`/`B-`...; importer normalize ve runtime key A-Z. Processed `letters/` van nen dung ten mot chu cai de tranh nham glyph.

Raw image co the la combined foreground `target capital letter + object` neu segmentation model duoc thiet ke de tach ca hai.

---

## 5. Human generation handoff

### Human task: Suno

Dung:

```text
authoring/generation-lyrics.txt
authoring/style-prompt.txt
```

Chon generation tot va copy thanh:

```text
assets/audio.mp3
```

hoac `assets/audio.wav`.

### Human task: images

Dung 26 prompts trong `authoring/object-prompts.json`, chon 26 anh phu hop va copy:

```text
assets/source-images/A.png
...
assets/source-images/Z.png
```

Human khong can cat anh neu segmentation adapter da cau hinh. Neu model cut khong tot, human co the sua/cat thu cong va dat truc tiep:

```text
assets/letters/A.png
assets/objects/A.png
```

Neu processed letter + object da co, `prepare-assets` se bo qua target do.

Agent package da co `authoring/display-lyrics.txt`. Khi import folder, backend preserve file nay va neu ban khong dat san `assets/original-lyrics.*`, no tu dong bridge thanh `assets/original-lyrics.txt`. Vi vay handoff thu cong binh thuong chi can **audio Suno + 26 raw source images**.

---

## 6. Gate G3 — Asset Preparation

### Job

```text
prepare-assets
```

### Input

```text
authoring/mapping.json
assets/source-images/{A-Z}.*
```

hoac processed assets co san:

```text
assets/letters/{A-Z}.*
assets/objects/{A-Z}.*
```

### Output canonical

Default model adapter output duoc normalize thanh:

```text
assets/letters/A.png
assets/objects/A.png
...
assets/letters/Z.png
assets/objects/Z.png
```

Letter processed asset chap nhan SVG/PNG/WebP. Object processed asset chap nhan PNG/WebP/SVG.

### Segmentation adapter seam

Worker khong hard-code model/vendor. Cau hinh:

```text
ABC_SEGMENTER_COMMAND=<command>
```

Worker se goi:

```text
<command>
  --input <raw-image>
  --letter A
  --object Apple
  --letter-out <temp-letter.png>
  --object-out <temp-object.png>
```

Adapter chi can tao hai transparent PNG output.

Co the thay adapter bang:

```text
SAM/SAM2 wrapper
YOLO-seg wrapper
custom vision model
local Python segmentation script
remote-model CLI bridge
```

ma khong sua backend/Remotion.

### Idempotency

Neu `letter + object` da co cho target:

```text
prepare-assets -> skip target
```

Do do human co the mix manual cut va model cut trong cung mot bai.

---

## 7. Gate G4 — Audio Transcription & Learning Target Alignment

### Job

```text
transcribe
```

Worker doc:

```text
assets/audio.*
assets/original-lyrics.* (neu co)
authoring/mapping.json (neu co)
```

Output:

```text
artifacts/whisperx.json
artifacts/lyrics.json
artifacts/lyrics.srt
```

Theme-first `lyrics.json` line co the co:

```json
{
  "start": 12.4,
  "end": 15.1,
  "text": "A is for apple, crunchy and sweet.",
  "line1": "A is for apple,",
  "line2": "crunchy and sweet.",
  "letter": "A",
  "object": "Apple"
}
```

`object` den truc tiep tu `authoring/mapping.json`; renderer khong can doan object tu lyric.

### Current alignment limitation

MVP hien van pair canonical original lyric lines voi WhisperX segments theo order khi original lyrics ton tai. Vi vay production ABC can verify:

```text
line count
target occurrence count
timestamps
missing/skipped targets
```

Two-round A-Z thuong ky vong 52 learning-target occurrences, nhung chi co 26 canonical object assets.

---

## 8. Audio analysis

Job:

```text
analyze
```

Output:

```text
artifacts/audio-analysis.json
```

Remotion dung RMS/bass/beat/band data cho background/letter/object motion.

---

## 9. Gate G5 — Build Config / Render Readiness

### Legacy project

Khong co `authoring/mapping.json`:

```text
26 processed letter assets required
object assets optional/not used
```

### Theme-first project

Co `authoring/mapping.json`:

```text
26 processed letters required
26 processed objects required
```

Config moi co the chua:

```json
{
  "assets": {
    "letters": { "A": "assets/letters/A.png" },
    "objects": { "A": "assets/objects/A.png" }
  }
}
```

ConfigBuilder khong khoa extension `.svg`; no resolve extension thuc te.

---

## 10. Remotion render contract

Moi frame:

```text
current time
  -> active lyrics.json line
  -> line.letter
  -> line.object
  -> config.assets.letters[letter]
  -> config.assets.objects[letter]
  -> render letter + object + timed lyric
```

Theme-first path:

```text
mapping.json -> lyrics.object -> object asset key
```

Legacy path:

```text
lyrics without object -> fallback object-word parser
```

Renderer do do backward-compatible.

### Visual stage

```text
LEFT                    RIGHT
processed letter        processed object
A                       APPLE IMAGE
                        APPLE label (controlled text, optional/current)

BOTTOM
karaoke lyric
```

Object image thay the viec chi render object word text o project theme-first.

---

## 11. Canonical song folder

```text
song-slug/
  metadata.json

  authoring/
    mapping.json
    generation-lyrics.txt
    display-lyrics.txt
    style-prompt.txt
    exclude-styles.txt
    object-prompts.json

  assets/
    audio.mp3
    original-lyrics.txt
    background.png
    song-logo.png
    channel-logo.png

    source-images/
      A.png
      ...
      Z.png

    letters/
      A.png
      ...
      Z.png

    objects/
      A.png
      ...
      Z.png

  artifacts/
    whisperx.json
    lyrics.json
    lyrics.srt
    audio-analysis.json
    project-config.json
    final-*.mp4
```

`source-images/` co the xoa/archive sau khi processed assets duoc verify, nhung nen giu trong production source project de co the re-run segmentation.

---

## 12. Operational run order

### Theme-first project with raw images

Sau khi import, Web App co nut **Run full pipeline**. Nut nay tu detect `learningMap` va orchestration:

```text
mapping project:
prepare-assets
-> transcribe + analyze (parallel)
-> build config
-> render

legacy project:
transcribe + analyze (parallel)
-> build config
-> render
```

Neu mot job `failed`, orchestration dung tai stage do va hien error; khong tiep tuc render tren artifact loi.

Luồng vận hành đầy đủ:

```text
1. Agent: Theme Plan
2. Agent: A-Z Mapping
3. Human/Project: LOCK Mapping
4. Agent: Lyrics + Suno Prompt + Image Prompt Pack
5. Human: Suno generate + select audio
6. Human: image generate + select A-Z images
7. Human: copy song folder
8. Web App: Import folder
9. Job: Prepare ABC assets
10. Job: Transcribe
11. Job: Analyze
12. Build config
13. Job: Render
14. Human: final preview/QC
```

### Theme-first project with manual cuts

Same flow, nhung human dat processed `letters/` + `objects/`; `prepare-assets` se no-op.

### Legacy project

Khong mapping/object pipeline. 26 letter assets + audio/bg/logo tiep tuc dung flow cu.

---

## 13. Failure ownership

| Failure | Owner dau tien | Xu ly |
|---|---|---|
| Mapping off-theme/wrong object | Agent + human mapping gate | Reopen mapping, regenerate dependent authoring artifacts |
| Lyric wrong object | Agent | Must conform to locked mapping |
| Image wrong object/style | Human/provider generation | Regenerate source image only |
| Bad letter/object cut | Segmentation adapter/human | Re-run target or provide manual processed assets |
| Missing processed A-Z asset | Automatic readiness | Block config/render |
| Wrong `object` in timed lyric | Mapping/alignment worker | Validate mapping + re-transcribe/repair artifact |
| Whisper segmentation mismatch | Alignment pipeline/human QC | Verify/repair `lyrics.json`; future semantic aligner |
| Render shows wrong visual | Runtime contract | Check `line.letter/object` and config asset map, never re-parse mapping from prose |
| Suno pronunciation/rush | Agent + human | Local lyric/prompt/generation repair |

---

## 14. What is intentionally NOT automated yet

Provider generation is intentionally manual for now:

```text
Suno song generation/selection
AI image generation/selection
final visual taste approval
final audio/listener approval
```

Reasons:

```text
provider credentials/API availability vary
human must choose the best generation
creative quality cannot be reduced to file-exists checks
```

Everything after the selected audio/images enter the project folder is designed to be automatable.

---

## 15. Future upgrades

The architecture keeps explicit seams for:

```text
semantic/word-level forced alignment instead of positional line pairing
programmatic letter rendering instead of segmented letter image
multiple object visual states per letter/round
automatic provider generation connectors
segmentation quality scoring
alpha/mask validation
object bounding-box normalization
batch series generation
mapping/version dependency hashes
```

These can be added without changing the central rule:

> `authoring/mapping.json` is the semantic source-of-truth; all downstream artifacts are derived from it.
