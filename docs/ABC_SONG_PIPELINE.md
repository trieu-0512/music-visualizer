# ABC Theme-First Song-to-Video Pipeline V2

## 1. Mục tiêu

V2 dùng một dependency flow duy nhất:

```text
THEME
  -> A-Z OBJECT MAPPING PROPOSAL
  -> HUMAN/PROJECT REVIEW
  -> LOCKED MAPPING (revisioned)
  -> LEARNING DESIGN
  -> STRUCTURED SONG SCRIPT
  -> SUNO LYRICS/PROMPT + SOURCE-COMPOSITE IMAGE PROMPTS
  -> HUMAN PROVIDER GENERATION/SELECTION
  -> COPY AUDIO + 26 SOURCE COMPOSITES
  -> ASSET PREP / SEGMENTATION
  -> TRANSCRIBE + ALIGN
  -> AUDIO ANALYSIS
  -> CONFIG GATE
  -> REMOTION COMPOSITING
  -> HUMAN FINAL QC
```

Nguyen tac trung tam:

> `mapping.json` khoa **target identity**; `song-script.json` khoa **line identity + objective + reveal policy**. Audio/image processing chi enrich timing/assets, khong duoc tu y doi semantic target.

---

## 2. Ownership: Agent / Human / Automatic

| Cong doan | Agent | Human | Automatic tool |
|---|---|---|---|
| Theme | Tao/phan tich theme, audience, mode, scope | Duyet neu can | Schema/lint |
| A-Z mapping proposal | De xuat candidate theo context | **Duyet va lock** | Validate A-Z completeness |
| Mapping revision | Tao proposal moi khi can | **Chap nhan thay doi** | Enforce `state=LOCKED`, revision |
| Learning design | Learning blocks, objective, action, risk | Review target dac biet | Lint |
| Song script | Stable IDs, targetId, objective, reveal policy | Co the review | Schema validation |
| Lyrics + Suno prompt | Viet tu locked mapping/script | Co the duyet | L0 QC |
| Source-composite prompts | Tao 26 prompt tu locked mapping | Chon style/anh | Prompt package |
| Suno generation | Chuan bi input | **Generate + chon audio** | Chua provider-automate |
| Image generation | Chuan bi prompt | **Generate + chon 26 source images** | Chua provider-automate |
| Handoff | Naming/folder contract | **Copy audio + images** | Import normalize |
| Segmentation | Khong can agent khi adapter on | Sua target cut loi neu can | `prepare-assets` |
| Alignment | Diagnose neu fail | Nghe/check low confidence | Worker |
| Analysis | Khong | Khong | Worker |
| Config/render | Khong | Preview/QC | Backend + Remotion |

Human van giu hai creative selection gate: **chon ban Suno** va **chon anh AI**.
Sau khi provider outputs duoc copy vao song folder, phan con lai duoc thiet ke de tu dong hoa.

---

## 3. Gate G1 — Theme + Mapping Lock

### 3.1 Proposal

Agent dau tien chi tao:

```text
Theme Plan
A-Z Mapping Proposal
Mapping QC / warnings
```

Khong viet full lyric va khong sinh 26 image prompts khi mapping con `PROPOSED`.

Proposal co the duoc mo ta la generated, nhung **proposal khong phai** `authoring/mapping.json`.

### 3.2 Canonical locked mapping

File production:

```text
authoring/mapping.json
```

Schema:

```text
shared/src/schema/learning-map.schema.json
```

Contract toi thieu:

```json
{
  "version": 1,
  "revision": 1,
  "state": "LOCKED",
  "theme": {
    "name": "Ocean Adventure",
    "scope": "strict",
    "mappingAuthority": "project-locked",
    "ageBand": "mixed-2-6",
    "mode": "LETTER_NAME"
  },
  "letters": {
    "A": { "object": "Anchor", "action": "drop" },
    "B": { "object": "Boat", "action": "sail" }
  }
}
```

File thuc te co du A-Z.

Production mapping chi chap nhan:

```text
mappingAuthority = user-locked | project-locked
state            = LOCKED
revision         >= 1
```

Moi lan thay object sau lock:

```text
reopen mapping gate
-> increment revision
-> regenerate/re-audit song-script, lyrics, prompts, cuts va alignment lien quan
```

### 3.3 Context-conditioned mapping

Khong co universal word leaderboard. Chon target dua tren:

```text
LETTER FIT
MODE FIT
THEME FIT
AGE FAMILIARITY
IMAGEABILITY
ACTIONABILITY
PRONUNCIATION / STRESS RISK
DISTINCTIVENESS
LETTER DIFFICULTY
SUPPORT COST
```

Tier A/B/C la muc teaching support, khong phai global ranking.

---

## 4. Gate G2 — Structured Authoring Package

Sau khi mapping LOCKED, agent tao:

```text
authoring/
  mapping.json
  song-script.json
  generation-lyrics.txt
  display-lyrics.txt
  style-prompt.txt
  exclude-styles.txt
  object-prompts.json
  learning-blocks.json
  sections.json
```

### 4.1 `song-script.json`

Schema:

```text
shared/src/schema/song-script.schema.json
```

No la machine-readable line source-of-truth:

```json
{
  "version": 1,
  "mappingRevision": 1,
  "lines": [
    {
      "id": "r1-A",
      "sectionId": "round1-a-d",
      "text": "A is for apple, crunchy and sweet.",
      "targetId": "A",
      "objective": "lexical-semantic",
      "objectReveal": "line-start"
    },
    {
      "id": "r2-A",
      "sectionId": "round2-a-d",
      "text": "A ... apple! Crunch a tasty bite.",
      "targetId": "A",
      "objective": "retrieval-action",
      "objectReveal": "target-word"
    }
  ]
}
```

`mappingRevision` phai trung `mapping.json.revision`.

Objective:

```text
narration
lexical-semantic
verbatim
retrieval-action
phonics
```

Reveal policy:

```text
line-start
 target-word
line-end
none
```

Default educational intent:

```text
Round 1 lexical teaching -> line-start
Round 2 retrieval         -> target-word
```

`display-lyrics.txt` la view de human/provider doc; no khong con la semantic database duy nhat.

---

## 5. Source-Composite Image Architecture

### 5.1 Ly do van tach ca LETTER va OBJECT

Stylized letter la mot phan cua art direction do AI tao, khong phai glyph font thuong.
Vi vay pipeline dung:

```text
AI SOURCE COMPOSITE
  = stylized letter + mapped object + temporary generation background

        ↓ segmentation

LETTER FOREGROUND RGBA   OBJECT FOREGROUND RGBA
        \                 /
         \               /
          + FINAL VIDEO BACKGROUND
                  ↓
               REMOTION
```

Khong thay letter segmentation bang font/vector trong default workflow.

### 5.2 Ba asset class phai tach ro

```text
1. Source Composite
   assets/source-images/A_apple.png
   -> chi dung cho extraction
   -> KHONG render truc tiep vao final video

2. Processed Foregrounds
   assets/letters/A.png
   assets/objects/A.png
   -> transparent foreground assets

3. Final Scene Background
   assets/background.png
   -> background video thuc su
```

Source image prompt nen:

- chua dung target capital letter + mapped object;
- giu full contour;
- safe margin quanh hai foreground;
- han che letter/object overlap;
- khong them unrelated text/object;
- art direction nhat quan voi theme;
- co background tam de model gen anh, nhung background nay se bi loai.

### 5.3 Prompt package

```text
authoring/object-prompts.json
```

Ten file duoc giu de backward compatibility, nhung semantic V2 la **Source-Composite Prompt Pack**.

Moi prompt lay object tu locked mapping, khong tu lyric va khong duoc tu y doi object.

---

## 6. Human Provider Handoff

### Suno

Human dung:

```text
authoring/generation-lyrics.txt
authoring/style-prompt.txt
```

chon generation tot va copy:

```text
assets/audio.mp3
# hoac
assets/audio.wav
```

### Images

Human dung 26 source-composite prompts, chon anh va copy:

```text
assets/source-images/A_apple.png
assets/source-images/B_book.png
...
assets/source-images/Z_zipper.png
```

Importer normalize friendly filename ve A-Z runtime key.

Agent package da co `display-lyrics.txt`; importer co the bridge sang:

```text
assets/original-lyrics.txt
```

Nen handoff thuong ngay cua human chi can **audio + 26 source composites**.

---

## 7. Gate G3 — Asset Preparation / Segmentation

Job:

```text
prepare-assets
```

Input:

```text
authoring/mapping.json
assets/source-images/{A-Z}.*
```

Output:

```text
assets/letters/{A-Z}.png
assets/objects/{A-Z}.png
artifacts/asset-prep-report.json
```

### 7.1 Adapter seam

Worker khong hard-code vendor/model:

```text
ABC_SEGMENTER_COMMAND=<command>
```

Contract:

```text
<command>
  --input <source-composite>
  --letter A
  --object Apple
  --letter-out <temp-letter.png>
  --object-out <temp-object.png>
```

Co the adapter SAM/SAM2, YOLO-seg, local model, custom script hoac remote bridge.

### 7.2 Idempotency + target rerun

Neu letter/object processed da ton tai:

```text
prepare-assets -> reuse
```

Neu rieng B cut loi:

```json
{
  "type": "prepare-assets",
  "params": { "target": "B", "force": true }
}
```

chi rerun B.

### 7.3 Provenance/QC report

Moi target ghi:

```text
mapping revision
object name
source path/hash/bytes
letter output path/hash/bytes
object output path/hash/bytes
generated | reused
outputsPresent
```

Generated output phai co PNG signature va khong rong. Pixel-level alpha/bbox/mask quality van la adapter-QC upgrade tiep theo; V2 khong tu nhan da kiem pixel neu chua co decoder/model QC.

---

## 8. Gate G4 — Audio Alignment

Jobs:

```text
transcribe
analyze
```

### 8.1 Transcribe inputs

```text
assets/audio.*
authoring/mapping.json
authoring/song-script.json
assets/original-lyrics.*   # legacy/fallback
```

Output:

```text
artifacts/whisperx.json
artifacts/lyrics.json
artifacts/lyrics.srt
```

Structured timed line:

```json
{
  "start": 100.0,
  "end": 103.0,
  "text": "A ... apple! Crunch a tasty bite.",
  "line1": "A ... apple! Crunch a tasty bite.",
  "line2": "",
  "id": "r2-A",
  "targetId": "A",
  "objective": "retrieval-action",
  "letter": "A",
  "object": "Apple",
  "objectRevealAt": 100.9,
  "alignmentConfidence": 0.93
}
```

### 8.2 No silent truncation

Legacy implementation tung dung `zip(canonicalLines, asrSegments)`, co the am tham mat du lieu.
V2 fail closed:

```text
canonical count != ASR segment count
-> transcribe job FAIL
-> khong tao mot timeline co ve hop le nhung thieu line
```

Khi count khop, worker ghi text-similarity confidence tung line va top-level:

```json
{
  "alignment": {
    "mode": "canonical-order",
    "status": "clean",
    "canonicalLineCount": 64,
    "segmentCount": 64,
    "averageTextSimilarity": 0.91
  }
}
```

Structured project chi build config khi `alignment.status = clean`.

Day la **fail-safe V2**, khong phai forced-aligner cuoi cung. Semantic/word-level forced alignment xu ly split/merge ASR segment la phase tiep theo.

### 8.3 Retrieval reveal timing

Voi:

```text
A ... apple!
```

renderer khong duoc show Apple tai line start.

Worker resolve:

```text
letter cue starts
-> retrieval gap
-> target word onset
-> objectRevealAt
```

Neu aligned word `apple` co timestamp, dung onset that.
Neu word timing thieu, fallback de lai gap bao thu thay vi reveal ngay tai cue.

---

## 9. Audio Analysis + Artifact Lineage

`analyze` output:

```text
artifacts/audio-analysis.json
```

V2 them SHA-256 provenance cua audio input.
`lyrics.json` cung ghi:

```text
audioSha256
mappingRevision
songScriptMappingRevision
```

Config Builder so:

```text
current audio bytes SHA-256
== lyrics.provenance.audioSha256
== audio-analysis.provenance.audioSha256
```

va:

```text
mapping.revision
== song-script.mappingRevision
== lyrics provenance revisions
```

Vi vay neu human thay MP3 Suno sau khi da transcribe/analyze:

```text
old artifacts -> STALE -> config build blocked
```

khong render nham timing/audio cu.

---

## 10. Stage-Aware Readiness

Readiness khong chi la mot boolean. Backend tra them stage state:

```text
prepareAssets: ready | blocked | not-applicable
transcribe:    ready | blocked
analyze:       ready | blocked
buildConfig:   ready | blocked
render:        ready | blocked
```

Theme-first project co mapping + 26 raw source composites co the la:

```text
prepareAssets = ready
render assets = not complete yet
```

Day la trang thai hop le, khong phai project "hong".

---

## 11. Gate G5 — Config

Theme-first ConfigBuilder yeu cau:

```text
core assets
26 processed letters
26 processed objects
lyrics.json
audio-analysis.json
```

Neu co `song-script.json`, them gate:

```text
mapping schema/state valid
script schema valid
script mappingRevision current
lyrics alignment clean
lyrics mapping/script provenance current
lyrics + analysis audio hash == current audio bytes
```

Bat ky gate nao fail -> khong tao config moi.

---

## 12. Remotion Compositing Contract

Moi frame:

```text
current time
  -> active timed line
  -> targetId / letter
  -> letter foreground
  -> canonical object + object foreground
  -> objectRevealAt
  -> separate final background
  -> lyric display
```

### Round 1

```text
line start
-> letter + object co the cung appear
```

### Round 2 retrieval

```text
cue onset:      LETTER visible
retrieval gap:  OBJECT hidden, answer token masked
word onset:     OBJECT reveal + answer token reveal
```

Renderer hien dung `objectRevealAt` cho ca object image va object token trong lyric box.

Legacy project khong co reveal timing van giu behavior cu.

---

## 13. Canonical Song Folder

```text
song-slug/
  metadata.json

  authoring/
    mapping.json
    song-script.json
    generation-lyrics.txt
    display-lyrics.txt
    style-prompt.txt
    exclude-styles.txt
    object-prompts.json
    learning-blocks.json
    sections.json

  assets/
    audio.mp3
    original-lyrics.txt
    background.png
    song-logo.png
    channel-logo.png

    source-images/
      A_apple.png
      ...
      Z_zipper.png

    letters/
      A.png
      ...
      Z.png

    objects/
      A.png
      ...
      Z.png

  artifacts/
    asset-prep-report.json
    whisperx.json
    lyrics.json
    lyrics.srt
    audio-analysis.json
    project-config.json
    final-*.mp4
```

`source-images/` nen duoc giu nhu production source de co the rerun segmentation.

---

## 14. Operational Run Order

```text
1. Agent     Theme Plan
2. Agent     A-Z proposal
3. Human     Review/lock -> mapping.json revision N
4. Agent     learning design + song-script.json
5. Agent     generation lyrics + Suno prompt + source-composite prompts
6. Human     Suno generate/select
7. Human     image generate/select
8. Human     copy audio + source images
9. Tool      import/validate
10. Tool     prepare-assets
11. Tool     transcribe + analyze
12. Tool     config gates / provenance gates
13. Tool     Remotion render
14. Human    final preview/QC
```

Current Web App van co one-click sequencing, nhung orchestration hien duoc khoi dong tu browser. Durable backend `PipelineRun` la upgrade tiep theo de viec dong/reload tab khong anh huong dependency continuation.

---

## 15. Failure Ownership

| Failure | Owner dau tien | Repair |
|---|---|---|
| Wrong/off-theme mapping | Agent + human G1 | Reopen mapping, bump revision |
| Script target differs mapping | Agent/schema | Regenerate script |
| Image wrong semantic | Human/provider | Regenerate target source image |
| Bad letter/object cut | Segmentation/human | `target + force` rerun or manual cut |
| Segmentation output malformed | Worker QC | Fail target, do not continue |
| ASR/canonical count mismatch | Alignment | Fail closed; repair/use stronger aligner |
| Low text alignment confidence | Alignment/human | Review before config |
| Replaced audio after alignment | Provenance gate | Re-transcribe + re-analyze |
| Retrieval object appears early | Script/alignment/render | Check `objectReveal=target-word` + `objectRevealAt` |
| Suno pronunciation/rush | Agent + human | Local lyric/prompt/generation repair |

---

## 16. What remains intentionally manual

```text
Suno generation/selection
AI source-composite generation/selection
final listening approval
final visual/taste approval
```

Do not replace these creative decisions with file-exists checks.

---

## 17. Next Architecture Upgrades

V2 deliberately keeps seams for:

```text
P1  semantic/word-level forced alignment handling split/merge automatically
P1  durable backend PipelineRun DAG instead of browser-owned sequencing
P2  pixel-level segmentation QC: alpha coverage, bbox, edge crop, confidence
P2  transactional/streaming folder import
P2  full dependency DAG invalidation for every asset, not only mapping/audio lineage
P2  Brand/Series preset for shared background/logo/style assets
P2  review/publish render presets instead of rendering all six outputs by default
P3  provider connectors when generation APIs/credentials are intentionally enabled
```

Khong upgrade nao o tren duoc phep pha quy tac trung tam:

> Locked mapping defines what is taught; structured song script defines when/how it is taught; processed foreground assets define what is shown; audio alignment defines when it is shown.
