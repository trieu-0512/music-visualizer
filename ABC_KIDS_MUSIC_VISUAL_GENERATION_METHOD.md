# ABC Kids Music & Visual Generation Method

> Tài liệu chuẩn hóa workflow đã thống nhất trong quá trình xây dựng kênh video nhạc trẻ em dạy chữ cái A–Z.  
> Mục tiêu: tạo bài hát, lyric, prompt sinh ảnh và prompt sinh video có cấu trúc nhất quán, dễ tự động hóa, dễ đồng bộ audio/video và phù hợp trẻ 2–6 tuổi.
>
> **AI loading strategy:** phần đầu tài liệu là executive core. Với task cụ thể, đọc core trước rồi dùng search/Grep để mở đúng section chi tiết; không cần nạp toàn bộ tài liệu dài trong mọi invocation.

---

## 1. Mục tiêu nội dung

Series tập trung vào việc giúp trẻ:

- Nhận diện **một chữ cái in hoa** tại một thời điểm.
- Liên kết chữ cái với **một đồ vật/từ vựng cụ thể**.
- Nghe chữ cái được lặp lại chậm, rõ, có khoảng nghỉ.
- Ghi nhớ thông qua **nhạc đơn giản + lặp lại + hình ảnh lớn, rõ ràng**.
- Xem video với nhịp chậm, không bị quá tải bởi nhiều chữ, nhiều vật thể hoặc chuyển động nhanh.

Đối tượng chính: trẻ 2–6 tuổi.

### 1.1. Không coi 2–6 tuổi là một mức khả năng duy nhất

Default của series là **mixed-age layering**:

```text
AGE 2–3
adult lead hát câu giáo dục đầy đủ
child-facing response thường 1–4 từ
một action đơn giản
rhythm cực kỳ predictable

AGE 4–6
child-facing response có thể khoảng 2–6 từ
có thể dùng câu mô tả đầy hơn
recall/call-and-response có thể khó hơn một chút

MIXED 2–6
adult lead = information layer
child = target word / short hook / clap / action layer
```

Không đánh giá một bài mixed-age bằng việc trẻ 2 tuổi có thể hát toàn bộ câu mô tả hay không. PASS khi trẻ nhỏ vẫn có một lớp tham gia ngắn, còn trẻ lớn hơn vẫn nhận được nội dung phong phú hơn.

Với target word có articulation khó đối với một phần trẻ mầm non, **không tự đổi mapping**. Thay vào đó:

- adult lead model rõ;
- cô lập target word;
- tránh tongue-twister/consonant cluster nhanh;
- không yêu cầu child response quá dày.

---

### 1.2. Mapping Quality Gate

Trước khi viết lyric, chấm từng `LETTER -> WORD` theo:

```text
LETTER FIT
MODE FIT: Letter Name / Phonics
AGE FAMILIARITY
IMAGEABILITY
ACTIONABILITY
THEME FIT
PRONUNCIATION / STRESS RISK
DISTINCTIVENESS trong cùng bài
LETTER DIFFICULTY PROFILE
```

Nếu hệ thống tự tạo mapping, ưu tiên word mạnh trên hầu hết tiêu chí.

Nếu mapping do user cung cấp:

- **không tự thay**;
- ghi warning theo dimension yếu;
- đề xuất alternative riêng;
- chỉ đổi sau khi user cho phép.

Ví dụ:

- một word có thể đúng letter nhưng quá hiếm với trẻ nhỏ;
- `Diary` và `Journal` cùng bài có thể giảm distinctiveness;
- `Xylophone` hợp Letter-Name / Letter-Word mode nhưng không nên được mô tả như ví dụ canonical /ks/ phonics của X;
- một word khó tạo action không phải invalid, nhưng Round 2 có thể cần recall cue thay cho movement cue.

#### Letter Difficulty Profile

Không coi A–Z là 26 item có độ khó bằng nhau. Theo locale/mode, lưu:

```text
letter_name_sound_cue: strong-initial / embedded-final / weak-or-misleading / N-A
visual_confusability: low / medium / high
phonological_name_confusability: low / medium / high
sequence_dependency_risk: low / medium / high
contrast_notes: optional
```

Trong phonics mode, letter name có thể cue sound mạnh/yếu khác nhau; letter name không tự động là bằng chứng sound. Với target dễ nhầm theo shape/name, first teaching phải isolate target trước, contrast later sau khi identity đã ổn.

Không hard-code một confusable-pair list universal; phụ thuộc uppercase/lowercase, locale, mode và visual design.

#### Primary vs Secondary Cue Budget

Mỗi learning block có **một primary target**:

```text
PRIMARY = LETTER -> WORD
```

Color/count/clap/rhyme/location/action là secondary scaffolds. Không để một block đồng thời thành lesson mới về chữ + từ + số + màu + direction + dance sequence nếu user không yêu cầu multi-domain learning.

> **GOOD MAPPING REDUCES THE AMOUNT OF LYRIC ENGINEERING NEEDED LATER.**

### 1.3. Curriculum Progression

Không nhồi mọi alphabet skill vào một bài nếu user không yêu cầu review tổng hợp.

Recommended series stages:

```text
STAGE 1 — UPPERCASE LETTER-NAME + WORD ASSOCIATION
STAGE 2 — UPPERCASE / LOWERCASE EQUIVALENCE
STAGE 3 — EXPLICIT LETTER-SOUND / PHONICS
STAGE 4 — MIXED-ORDER RETRIEVAL
STAGE 5 — APPLICATION / EARLY BLENDING khi curriculum phù hợp
```

Project hiện có thể cố ý ở Stage 1 với capital-letter-only visuals; progression là roadmap cho series, không phải lý do tự thêm lowercase/phonics vào bài hiện tại.

#### Adaptive Retrieval Scheduling

Target khó không cần được lặp y hệt target dễ chỉ vì symmetry.

```text
Tier A + low confusion -> ordinary spaced revisit
Tier B/C or confusable -> earlier/more frequent retrieval opportunity
repeated L2/L3 error   -> targeted contrast/modeling episode
```

Vẫn phải **spaced**, không mass-repeat back-to-back.

### 1.4. Learning Objective Modes

Không tối ưu mọi section cho cùng một nhiệm vụ. Trước khi viết, gán **primary learning objective**:

```text
LEXICAL-SEMANTIC
= học/khóa LETTER -> WORD và nghĩa/object
= target rõ, concrete, melody hẹp, rhyme phụ

VERBATIM / SEQUENCE
= nhớ đúng hook / ABC order / phrase
= repetition + meter + rhyme + text-tune stability mạnh hơn

RETRIEVAL / ACTION
= cue -> retrieval beat -> confirm word -> congruent action
= response space bắt buộc

PHONICS
= phoneme clarity cao nhất
= không trộn vô tình với letter-name mode
```

Default cho two-round ABC:

```text
Round 1        = Lexical-Semantic Teaching
Refrain/Chorus = Verbatim / Sequence Memory
Round 2        = Retrieval / Action
Phonics        = separate explicit mode unless requested
```

Dễ thuộc một rhyme và học đúng nghĩa/từ mới không phải cùng một mục tiêu. Rhyme không được thay thế semantic teaching.

### 1.5. Lexical Novelty Tier

Mỗi target word phải được xếp tier trước melody:

```text
TIER A — HIGH FAMILIARITY
common + concrete + preschool-known
-> normal singable treatment

TIER B — MEDIUM FAMILIARITY
known to some, not all
-> repeat target clearly
-> narrow contour
-> strong visual/action support

TIER C — LOW FAMILIARITY / SPECIALIZED
uncommon / technical / archaic / age-stretched
-> TEACH-THEN-SING
-> first exposure speech-like / chant-like / repeated-note
-> concrete visual reveal before decorative melody
-> extra retrieval support later
-> mapping warning if needed
```

Không tự đổi Tier C khi mapping do user cung cấp; preserve + warn + adapt teaching strategy.

### 1.6. Semantic vs Mnemonic Rhyme Budget

```text
Lexical-Semantic section -> meaning first, rhyme light/moderate
Verbatim Hook section     -> rhyme/repetition stronger when natural
Retrieval section         -> cue clarity + gap + action first
Phonics section           -> sound accuracy first
```

Không để full-song rhyme scheme ép semantic verse thành câu vô nghĩa hoặc teacher-prose giả vần.

### 1.7. Text-Tune Binding

Khi cùng một important text trở lại, giữ melodic/rhythmic identity gần như không đổi:

```text
same chorus text -> same chorus motif
same refrain     -> same refrain motif
same recall cue  -> same response grammar
```

Predictability là một phần của encoding.

### 1.8. Rule Precedence

Không phải mọi rule có cùng mức bắt buộc.

```text
HARD GATE
> OBJECTIVE-SPECIFIC RULE
> EVIDENCE-BACKED HEURISTIC
> DEFAULT HEURISTIC
> CREATIVE PREFERENCE
```

**Hard Gate** gồm:

- educational/mapping integrity;
- child safety;
- pronunciation + lexical stress;
- natural prosody của learning target;
- letter-name/phonics mode integrity;
- target-word intelligibility;
- sequence boundary clarity;
- không unresolved homograph/pronunciation trap;
- không local density gây rush/compress/skip rõ ràng.

**Objective-Specific Rule** chỉ áp theo learning mode: lexical-semantic, verbatim/sequence, retrieval/action hoặc phonics.

**Default Heuristic** gồm các vùng như 6–12 words/line, 8–14 syllables, 4–6 lines/section, khoảng 80–100 BPM như broad preschool envelope, narrow range, four-beat response. Có thể override nếu generation/child evidence chứng minh lựa chọn khác tốt hơn.

**Creative Preference** gồm instrument palette, decorative transition, optional backing vocal, genre modifier.

Actual evidence có thể override heuristic nhưng **không override Hard Gate**.

---

## 2. Quy luật cốt lõi của toàn bộ hệ thống

### 2.1. Một learning block = một chữ cái

Mỗi chữ cái là một module giáo dục độc lập:

- 1 chữ cái duy nhất;
- 1 từ vựng/đồ vật chính;
- 1 **complete singable phrase**;
- 1–2 internal phraselets typical; 3 chỉ khi thật sự cần;
- 1 cảnh hình ảnh/video riêng;
- thời lượng **linh hoạt theo prosody, bars và breathing space**, không khóa theo số giây.

Ví dụ:

```text
A -> Apple -> complete musical phrase -> image/video A + Apple
B -> Book  -> complete musical phrase -> image/video B + Book
```

Không trộn nhiều learning target trong cùng một letter block.

Master unit mới:

```text
ONE LETTER = ONE COMPLETE SINGABLE PHRASE
```

không phải:

```text
ONE LETTER = FIXED NUMBER OF SECONDS
```

### 2.1.1. Mapping quality phụ thuộc chủ đề

Không có bảng xếp hạng từ vựng toàn cục kiểu `Apple luôn tốt hơn Quill`. Chất lượng mapping phụ thuộc **theme + age band + learning mode + visual/action context** của từng bài.

Trước khi chọn mapping, khai báo:

```text
mapping_authority: user-locked / project-locked / generated
theme_scope: strict / guided / open
```

- `strict`: generated target phải thuộc chủ đề tự nhiên; từ ít quen nhưng đúng theme có thể tốt hơn từ quen nhưng off-theme.
- `guided`: ưu tiên strong/acceptable theme fit; chữ khó có thể dùng fallback yếu hơn nếu có rationale rõ.
- `open`: theme broad/aesthetic; familiarity, imageability, pronunciation và actionability có thể quan trọng hơn theme purity.

Không cộng các yếu tố thành một permanent global score. Chọn theo context sau khi loại hard failures: `letter fit`, `mode fit`, `theme fit`, `age familiarity`, `imageability`, `actionability`, `pronunciation/stress risk`, `distinctiveness`, `support cost`.

Nếu một target ít quen nhưng rất đúng theme, tăng teaching support thay vì tự đổi sang từ phổ biến off-theme. Mapping do user/project khóa luôn được giữ nguyên; warning không có quyền tự đổi mapping.

### 2.2. Learning Block Manifest

Khi serialize sang JSON cho automation, validate bằng `.claude/skills/abc-kids-music-composer/LEARNING_BLOCK_SCHEMA.json`.

**Scope hiện tại:** Learning Block Manifest và Section Manifest là **authoring/composer contracts** dùng để khóa lesson, lyric, melody, pronunciation, visual plan và QC trước generation. Chúng **chưa phải runtime artifacts của app** và chưa nằm trong `shared/src/schema/`. Runtime hiện vẫn dùng `lyrics.json`, `audio-analysis.json` và `project-config.json`. Chỉ coi manifest là runtime source-of-truth sau khi có integration code + shared schema tương ứng.

Để lyric, melody, pronunciation, visual và QC không tự suy khác nhau, mỗi chữ phải có một **canonical learning-block spec**.

Recommended fields:

```text
letter:
word:
mode: letter-name / phonics
familiarity_tier: A / B / C
letter_name_sound_cue: strong-initial / embedded-final / weak-or-misleading / N-A
visual_confusability: low / medium / high
phonological_name_confusability: low / medium / high
sequence_dependency_risk: low / medium / high
syllable_count:
stress_pattern: S / S-w / w-S-w / S-w-w / other
pronunciation_note:
prosodic_motif_variant:
round1_objective: lexical-semantic
round2_objective: retrieval-action / N-A
retrieval_cue:
retrieval_gap_plan:
congruent_action:
rhyme_family: optional
visual_reveal_rule:
risk_flags: []
```

Manifest là canonical **theo letter**, không theo timeline occurrence.

```text
1 round  -> 26 canonical specs -> 26 letter instances
2 rounds -> 26 canonical specs -> 52 letter instances
```

Round 2 phải reference lại đúng canonical `LETTER -> WORD`, không tạo mapping mới.

### 2.3. Section Manifest

Khi serialize sang JSON cho automation, validate bằng `.claude/skills/abc-kids-music-composer/SECTION_SCHEMA.json`.

Mỗi musical section có contract riêng:

```text
section_id:
section_type:
round:
learning_objective:
letters:
line_count:
rhyme_scheme:
motif_id:
energy_level:
response_frame:
refrain_or_chorus_identity:
```

Integrity gate:

- đủ A–Z đúng một lần trong mỗi full round;
- không duplicate/missing accidental;
- section line count không vượt density rule;
- repeated chorus/refrain dùng cùng identity;
- Round 1/Round 2 cùng canonical target.

---

## 3. Quy luật tạo lyric

### 3.0. Rhyme architecture phải được chọn trước khi viết full song

Với preschool **song-format** có mục tiêu catchy/memorability, không được viết prose trước rồi mới cố gắn rhyme ở cuối. Trước khi draft từng section phải khai báo một `rhyme_mode`:

```text
paired
alternating
internal
refrain-driven
intentionally-unrhymed
```

Default cho catchy ABC learning sections là **paired rhyme khi mapping cho phép**:

```text
4 lines -> AABB
6 lines -> AABBCC
```

`intentionally-unrhymed` chỉ hợp lệ khi có lý do rõ như pronunciation, lexical stress, Tier-C vocabulary, phonics accuracy hoặc không có natural semantic rhyme. `Meaning > rhyme` không có nghĩa `rhyme = optional afterthought`.

Rhyme pair tốt phải cùng lúc đạt:

```text
natural meaning
+ natural grammar
+ compatible stress
+ similar rhythmic weight
+ audible rhyme/near-rhyme
+ satisfying answer cadence
```

Nếu chỉ vần ở cuối nhưng rhythmic pocket khác hẳn thì chưa đạt preschool memorability.

### 3.1. Cấu trúc lyric chuẩn: phrase-based, không khóa một template duy nhất

Default mới là **adaptive phrase mode**. Mỗi chữ phải tạo thành một musical sentence hoàn chỉnh, dễ hát và có chỗ thở.

Vùng gợi ý cho một letter block:

```text
6–12 sung words preferred per physical letter line
roughly 8–14 sung syllables preferred per physical letter line
up to ~16 syllables only with a strong natural internal pause
1–2 internal phraselets typical; 3 only when clearly needed
usually 2–4 bars; extend when needed
low lyric density
clear breathing points
flexible duration
```

Đây là heuristic, **không phải hard minimum/maximum**. Một phrase 9 từ vẫn PASS nếu hoàn chỉnh và rõ; một phrase 18 từ phải FAIL hoặc mở rộng bars nếu singer buộc phải chạy chữ.

Template mô tả điển hình:

```text
LETTER is for WORD,
SHORT DESCRIPTION,
SIMPLE CONTEXT OR ACTION.
```

Ví dụ:

```text
A is for apple, red and sweet,
packed beside my morning snack.
```

Có thể phân tích thành:

```text
Phraselet 1: A is for APP-le
Phraselet 2: RED and SWEET
Phraselet 3: PACKED beside my MOR-ning SNACK
```

Target letter có thể được reinforce thêm nếu cần:

```text
A ... A ... A ... apple,
red and sweet,
packed beside my morning snack.
```

### 3.1.1. Legacy chant mode

Template cũ vẫn là một mode hợp lệ cho bài chant cực đơn giản:

```text
LETTER LETTER LETTER is a/an WORD,
LETTER LETTER LETTER,
LETTER is a/an WORD,
LETTER LETTER LETTER.
```

Nhưng **không còn là template bắt buộc cho mọi bài ABC**.

AI phải chọn giữa:

```text
ADAPTIVE PHRASE MODE — default for full songs
LEGACY CHANT MODE    — optional for very simple repetition songs
```

Trong cả hai mode, pronunciation, prosody và learning clarity quan trọng hơn rhyme hoặc timing.

### 3.2. Không sử dụng từ điều khiển như một phần lyric

Không đưa các từ kỹ thuật vào lời hát, ví dụ:

```text
repeat
pause
silence
next letter
```

Các chỉ dẫn này thuộc **Style Prompt / performance instruction**, không thuộc lyric.

Sai:

```text
A A is for Apron repeat repeat
```

Đúng:

```text
A A A is an Apron,
A A A,
A is an Apron,
A A A.
```

### 3.3. Ngắt giữa từng chữ

Khi lyric có:

```text
A A A
```

thì cách thể hiện mong muốn là:

```text
A ... A ... A ...
```

không phải:

```text
AAA
```

Mỗi chữ phải được phát âm thành một đơn vị độc lập với khoảng nghỉ ngắn giữa các lần lặp.

### 3.4. Ngữ pháp

Ưu tiên ngữ pháp tự nhiên cho trẻ:

- `a` trước âm phụ âm:
  - a Cap
  - a Dress
  - a Hat
  - a Jacket
  - a Kimono
  - a Mitten
  - a Necklace
  - a Raincoat
  - a T-shirt
  - a Uniform
  - a Vest
  - a Winter Coat
  - a Zipper

- `an` trước âm nguyên âm:
  - an Apron
  - an Observatory

Với danh từ số nhiều như Boots, Earrings, Gloves, Pajamas, Shoes, Yoga Pants, tránh dùng `a/an`.

Trong Adaptive Phrase Mode, ưu tiên cấu trúc tự nhiên hơn:

```text
B is for Boots,
soft and warm,
ready for a rainy walk.
```

Trong Legacy Chant Mode, dạng `B B B is Boots` vẫn có thể tồn tại như một chant convention, nhưng không nên dùng nó làm chuẩn ngữ pháp cho các bài full-song mới.

Lưu ý: rhythm không được biện minh cho grammar quá gượng nếu có một câu tự nhiên và dễ hát hơn.

---

## 4. Quy luật thời lượng: phrase-first, duration-flexible

### 4.1. Duration là kết quả, không phải constraint chính

Không khóa mỗi chữ ở 8 giây, 10 giây hay một con số cố định khác.

Thời lượng tự nhiên của một letter block được quyết định bởi:

- số sung syllables;
- natural word stress;
- tempo;
- meter;
- bar count;
- note length;
- internal phrase breaks;
- breathing space;
- repeated-letter separation;
- cadence/transition.

Rule chuẩn:

> **A letter block is complete when the learning target is clearly sung, the phrase resolves musically, and the vocalist never needs to rush.**

### 4.2. Đo bằng phrase, syllable và bars trước khi đo bằng giây

Thứ tự kiểm tra:

```text
1. Is the sentence natural when spoken?
2. Is natural stress preserved?
3. Can it be divided into 1–2 clear phraselets, or 3 only when genuinely needed?
4. Does it fit the chosen bars without rushing?
5. Is there breathing space?
6. Only then observe the resulting duration.
```

Typical letter phrase:

```text
6–12 sung words preferred per physical letter line
roughly 8–14 sung syllables preferred
up to ~16 only with a strong natural pause
1–2 phraselets typical; 3 when clearly needed
2–4 bars typical
more bars allowed for longer words or slower delivery
```

Không tăng vocal speed chỉ để giữ bar count hoặc duration.

### 4.3. Spread, do not compress

Nếu một phrase không vừa:

```text
GOOD:
add bars
split into phraselets
simplify wording
reduce ornamentation
allow a longer block

BAD:
rush the vocal
compress syllables
use rapid sixteenth-note delivery
remove pauses from learning targets
```

### 4.4. Audio quyết định timeline video

Sau khi generate audio:

- detect/align thời gian thực của từng letter phrase;
- video clip hoặc scene duration lấy theo audio phrase thực tế;
- thêm tail/transition nếu cần;
- chỉ time-stretch rất nhẹ khi không làm biến dạng giọng;
- không ép tất cả letter scene về cùng một duration.

### 4.5. Tổng thời lượng A–Z là adaptive

Không dùng công thức `26 × fixed seconds`.

Tổng duration phụ thuộc:

```text
letter phrase lengths
+ musical breaths between groups
+ chorus/refrain
+ optional second A–Z round
+ intro/outro
```

Một bài dài hơn là hợp lệ nếu local density vẫn thấp và pronunciation vẫn rõ.

---

## 5. Tách Lyric Prompt và Style Prompt

Đây là quy luật quan trọng.

### 5.1. Lyric Prompt chỉ chứa lời

Lyric prompt không nên chứa:

- BPM;
- nhạc cụ;
- giọng nữ;
- mood;
- thời lượng;
- chỉ thị mixer.

Nó chỉ chứa lời và cấu trúc lời.

Ví dụ:

```text
A A A is an Apron,
A A A,
A is an Apron,
A A A.

B B B is Boots,
B B B,
B is Boots,
B B B.
```

### 5.2. Style Prompt chỉ điều khiển cách hát

Style prompt chứa:

- đối tượng trẻ 2–6 tuổi;
- tốc độ;
- cách ngắt từng chữ;
- giọng hát;
- melody;
- nhạc cụ;
- độ rõ;
- khoảng nghỉ;
- cách chuyển block.

Không lặp toàn bộ lyric trong style prompt.

---

## 6. Style Prompt chuẩn cho nhạc

Phiên bản ngắn, phù hợp giới hạn khoảng 1000 ký tự:

```text
Warm clear adult female lead, friendly teacher-like delivery, crisp diction, stable vowels, minimal vibrato, no melisma. Preschool educational sing-along for ages 2–6, steady 4/4, usually 80–100 BPM but calibrated to age, lyric density and learning objective. Simple diatonic melody, repeated notes and stepwise motion, narrow range. Piano, xylophone, soft bells, ukulele, handclaps and light percussion; vocals forward, arrangement sparse. Each letter is one complete singable phrase with natural stress, low density, flexible bars and clear breathing space. Never rush to fit duration. Repeated letters are separate audible events. For two-round songs, Round 1 teaches clearly; Round 2 uses short cue-gap-confirm-action phrasing with real response space. Keep hooks and repeated text melodically stable. Clarity, pronunciation, participation and memorability come before rhyme or production complexity.
```

### 6.1. Quy tắc quan trọng nhất của style

Luôn nhấn mạnh:

```text
Every repeated letter must be sung separately.
A ... A ... A ...
Never rush or connect repeated letters.
Pauses are more important than melody.
```

Nếu AI vẫn hát nhanh, tăng mức nhấn mạnh ở đầu prompt:

```text
CRITICAL: DO NOT sing repeated letters quickly.
```

---

## 7. Phong cách âm nhạc

### 7.1. Mood

- cheerful;
- playful;
- warm;
- friendly;
- educational;
- calm enough để trẻ nghe rõ.

Không nên:

- quá nhanh;
- quá dày;
- EDM nặng;
- bass mạnh;
- trống mạnh;
- rap nhanh;
- vocal chạy chữ.

### 7.2. Nhạc cụ phù hợp

Có thể dùng:

- piano;
- xylophone;
- bells;
- ukulele;
- acoustic guitar nhẹ;
- claps nhẹ;
- percussion nhẹ;
- whistle nhẹ;
- children's choir rất nhẹ nếu không che giọng chính.

### 7.3. Tempo

Vùng tham khảo:

```text
80–100 BPM broad starting envelope
```

Không coi BPM là quy tắc tuyệt đối. Mục tiêu chính vẫn là **khả năng nghe rõ từng chữ**.

---

## 8. Quy luật chọn từ vựng

Một từ tốt phải:

- bắt đầu bằng đúng chữ đang học;
- dễ minh họa;
- hình dáng dễ nhận biết;
- phù hợp trẻ em;
- không quá trừu tượng;
- không cần nhiều vật phụ để giải thích.

### 8.1. Ví dụ legacy: Clothing episode mapping

Danh sách dưới đây là **example/legacy mapping của một clothing episode cũ**, không phải global mapping của project và không được tự áp vào bài mới. Mapping thực của mỗi bài đến từ user/song plan/locked manifest của bài đó.

```text
A – Apron
B – Boots
C – Cap
D – Dress
E – Earrings
F – Flip-flops
G – Gloves
H – Hat
I – Innerwear
J – Jacket
K – Kimono
L – Long Pants
M – Mitten
N – Necklace
O – Observatory
P – Pajamas
Q – Queen Dress
R – Raincoat
S – Shoes
T – T-shirt
U – Uniform
V – Vest
W – Winter Coat
X – Xmas Sweater
Y – Yoga Pants
Z – Zipper
```

### 8.2. Lưu ý về tính đồng nhất chủ đề của legacy example

Danh sách trên chủ yếu là **Clothes / Clothing & Accessories**, nhưng:

```text
O – Observatory
```

không thuộc chủ đề quần áo.

Nếu cần series **100% clothing**, nên thay O bằng:

```text
O – Overalls
```

Nếu muốn giữ đúng lyric hiện tại thì giữ Observatory và coi series là “Alphabet Objects” hoặc “mixed vocabulary”.

Không âm thầm đổi từ; phải quyết định theo theme của video.

---

## 9. Prompt tạo ảnh

### 9.1. Mục tiêu hình ảnh

Mỗi ảnh cần:

- đúng **một chữ cái in hoa**;
- chữ cực lớn, rõ ràng;
- một vật thể duy nhất;
- vật thể lớn, dễ nhận biết;
- cartoon vui nhộn;
- nền pastel sạch;
- không có text phụ;
- không có chữ cái khác.

### 9.2. Quy tắc khóa chữ

Đây là constraint bắt buộc:

```text
Only show the target capital letter.
No other letters.
No words.
No numbers.
No symbols.
No logos.
No watermark.
```

Ví dụ khi làm chữ A:

```text
ONLY the capital letter A may appear as text.
```

Không để:

- chữ A trên áo;
- nhãn quần áo có text;
- chữ trên bảng;
- typography trang trí;
- các ký hiệu dễ bị hiểu thành chữ khác.

### 9.2.1. Scope của text restriction

Constraint `only the target capital letter may appear as text` áp cho **pixel/content do AI sinh trong canonical foreground image/video asset**. Nó ngăn model tự hallucinate nhãn, logo, chữ phụ hoặc typography không kiểm soát.

Nó **không mặc định cấm** các overlay đáng tin cậy do compositor của project thêm sau đó. Remotion hiện có thể chủ động render lyric box, song title/artist và object label từ dữ liệu đã kiểm soát. Các overlay này thuộc presentation layer, không phải text hallucinated trong generated asset.

Nếu một episode thật sự yêu cầu `target-letter-only` trên **toàn bộ final frame**, đó phải là một explicit render mode và compositor phải tắt lyric/title/object-label overlays. Không dùng prompt asset để giả định final compositor cũng không có text.

### 9.3. Prompt ảnh một dòng

Template:

```text
A single very large bold rounded capital letter {LETTER} as the main focus, bright high-contrast color, beside one large cute clearly recognizable cartoon {OBJECT}, cheerful preschool educational animation style, soft polished 2D/3D storybook look, clean smooth shapes, bright friendly lighting, simple pastel environment with subtle playful depth, balanced composition, no clutter, only the letter {LETTER} may appear as text, no other letters, no words, no numbers, no symbols, no logos, no watermark.
```

Ví dụ A:

```text
A single very large bold rounded capital letter A as the main focus, bright high-contrast color, beside one large cute clearly recognizable cartoon apron, cheerful preschool educational animation style, soft polished 2D/3D storybook look, clean smooth shapes, bright friendly lighting, simple pastel environment with subtle playful depth, balanced composition, no clutter, only the letter A may appear as text, no other letters, no words, no numbers, no symbols, no logos, no watermark.
```

---

## 10. Prompt ảnh dạng JSON

Quy ước đánh số:

```text
#1
{ JSON }

#2
{ JSON }
```

Mỗi prompt là một object độc lập.

Template:

```json
{
  "id": "A",
  "task": "generate_image",
  "audience": "toddlers ages 2-6",
  "style": "bright playful educational cartoon, polished soft 2D/3D storybook look",
  "letter": {
    "text": "A",
    "case": "capital",
    "size": "very large",
    "font": "bold rounded child-friendly",
    "position": "main visual focus",
    "contrast": "high"
  },
  "object": {
    "name": "apron",
    "size": "large",
    "look": "cute, colorful, simple, immediately recognizable"
  },
  "background": "clean pastel environment with subtle playful depth",
  "lighting": "bright soft cheerful lighting",
  "composition": "clear balanced preschool educational composition",
  "constraints": [
    "only the capital letter A may appear as text",
    "no other letters",
    "no words",
    "no numbers",
    "no symbols",
    "no logos",
    "no watermark",
    "no clutter"
  ]
}
```

---

## 11. Quy luật tạo video

### 11.1. Tách canonical asset khỏi timeline scene instance

Không đồng nhất `26 letters` với `26 timeline clips` khi bài có nhiều round.

Dùng hai lớp:

```text
CANONICAL LETTER ASSET
= 26 unique letter/object identities
= A asset ... Z asset
= giữ brand/style/mapping ổn định

TIMELINE SCENE INSTANCE
= một lần letter xuất hiện trong audio timeline
= duration theo aligned sung phrase
= có thể reuse canonical asset nhưng đổi action/state
```

Với một round A–Z:

```text
26 canonical assets
26 letter timeline instances
```

Với hai round A–Z:

```text
26 canonical assets
52 letter timeline instances
+ chorus/refrain/intro/outro instances
```

Round 1 instance ưu tiên **identify/describe**. Round 2 instance ưu tiên **action/retrieval/participation**, không chỉ copy nguyên animation Round 1.

Duration từng instance có thể khác nhau và lấy theo audio alignment thực.

Ưu điểm:

- dễ regenerate một chữ lỗi;
- sync đúng với prosody thật;
- không phải ép vocal theo video;
- dễ thay từ;
- dễ giữ bố cục;
- dễ tự động hóa.

### 11.2. Không audio khi sinh video

Nếu audio đã được tạo riêng:

```text
NO AUDIO
NO MUSIC
NO VOICE
VISUAL ONLY
```

Lý do:

- tránh âm thanh ngẫu nhiên;
- dễ sync với bài hát;
- dễ mix/master;
- không bị lệch lyric.

---

## 12. Video không nên giống slide tĩnh

Mục tiêu là cảm giác **mini cartoon scene**, không phải chỉ chữ + ảnh đứng yên.

Cảnh có thể có:

- letter pop-in nhẹ;
- object bước/trượt/bay vào;
- bounce nhẹ;
- idle motion;
- sparkle rất nhỏ;
- chuyển động môi trường nhẹ;
- parallax nhẹ;
- ánh sáng vui nhộn.

Nhưng chữ vẫn phải rõ và dễ đọc.

Nguyên tắc:

> Sinh động ở vật thể và môi trường, ổn định ở typography.

Không để chữ:

- xoay quá mạnh;
- méo;
- biến thành nhân vật khó đọc;
- thay hình dạng;
- bị che;
- ra khỏi frame.

---

## 13. Timeline video adaptive theo audio phrase

Không dùng timeline cố định theo giây cho mọi chữ. Dùng **relative phases** theo duration thực `D` của letter phrase:

```text
0–15% D
Establish background / target letter quickly.

15–35% D
Target object enters with one simple readable action.

35–85% D
Letter remains stable and readable while the object performs its main action.

85–100% D
Composition settles and prepares transition.
```

Nếu audio phrase có internal pauses, animation có thể dùng các pause đó làm beat cho bounce, gesture hoặc transition nhỏ.

Không kéo camera/action nhanh hơn chỉ vì phrase ngắn; nếu scene cần nhiều thời gian hơn, đơn giản hóa action.

---

## 14. Prompt video JSON template

```json
{
  "id": "A",
  "duration_seconds": "FROM_ALIGNED_AUDIO_PHRASE",
  "audio": {
    "enabled": false,
    "music": false,
    "voice": false
  },
  "visual_style": "bright polished preschool cartoon, playful cinematic storybook animation, soft 2D/3D look",
  "scene": {
    "letter": {
      "text": "A",
      "case": "capital",
      "size": "very large",
      "font": "bold rounded",
      "priority": "primary focus",
      "readability": "must remain perfect throughout the clip"
    },
    "object": {
      "name": "apron",
      "size": "large",
      "look": "cute colorful clearly recognizable cartoon apron",
      "action": "gently enters, gives a small playful bounce, then settles beside the letter"
    },
    "environment": {
      "background": "bright pastel cartoon environment",
      "detail_level": "simple but cinematic",
      "motion": "subtle ambient movement only"
    }
  },
  "timeline": [
    {
      "time": "0%-15%",
      "action": "establish the cheerful pastel cartoon scene and reveal the target letter"
    },
    {
      "time": "15%-35%",
      "action": "the apron enters with a soft playful animated movement"
    },
    {
      "time": "35%-85%",
      "action": "the apron performs one simple cute action while A remains large, stable and readable"
    },
    {
      "time": "85%-100%",
      "action": "the scene settles into a clear final composition ready for transition"
    }
  ],
  "camera": {
    "movement": "mostly static with optional very subtle cinematic push",
    "shake": false,
    "fast_zoom": false
  },
  "constraints": [
    "ONLY the capital letter A may appear as text",
    "no other letters",
    "no words",
    "no numbers",
    "no symbols",
    "no logos",
    "no watermark",
    "do not distort the letter",
    "do not cover the letter",
    "no fast chaotic motion",
    "child-safe"
  ]
}
```

---

## 15. Quy luật prompt video theo kiểu phim hoạt hình

Mỗi clip nên có một hành động trực quan gắn với vật thể.

Ví dụ:

```text
Apron:
gently floats in and ties its straps by itself.

Boots:
two boots hop once and stop.

Cap:
cap spins slowly once and lands beside B/C depending on target.

Dress:
dress gives a soft twirl.

Earrings:
earrings shimmer gently.

Flip-flops:
flip-flops make two tiny playful hops.

Gloves:
gloves wave.

Hat:
hat drops gently into place.

Jacket:
zipper closes slowly.

Raincoat:
a few soft cartoon raindrops appear around it.

Zipper:
zipper slider moves smoothly upward.
```

Hành động phải:

- chỉ có một ý chính;
- dễ nhận biết trong duration thực của letter phrase;
- không quá nhanh;
- không che chữ;
- không làm xuất hiện text phụ.

---

## 16. Giữ style đồng nhất A–Z và giữa các round

Để 26 canonical letter assets và mọi timeline instance giống cùng một series:

Giữ cố định:

- font;
- tỷ lệ chữ;
- vị trí chữ;
- mức độ render;
- saturation;
- lighting;
- camera;
- background family;
- edge softness;
- object scale;
- animation speed;
- transition style.

Chỉ thay:

```text
LETTER
OBJECT
OBJECT ACTION
accent background variation
```

Không đổi style hoàn toàn giữa các chữ.

---

## 17. Cấu trúc prompt hàng loạt

Mỗi prompt nên bắt đầu bằng:

```text
#1
```

rồi JSON.

Quy ước:

```text
#1 = A
#2 = B
...
#26 = Z
```

Điều này giúp:

- copy/paste;
- batch processing;
- log lỗi;
- regenerate theo ID;
- map audio/video dễ dàng.

---

## 18. Legacy example mapping A–Z — không phải global source of truth

> Đây là cùng clothing mapping lịch sử dùng cho các ví dụ batch/chant bên dưới. Với bài mới, luôn lấy `LETTER -> WORD` từ locked mapping / Learning Block Manifest của chính bài đó.

```text
#1  A – Apron
#2  B – Boots
#3  C – Cap
#4  D – Dress
#5  E – Earrings
#6  F – Flip-flops
#7  G – Gloves
#8  H – Hat
#9  I – Innerwear
#10 J – Jacket
#11 K – Kimono
#12 L – Long Pants
#13 M – Mitten
#14 N – Necklace
#15 O – Observatory
#16 P – Pajamas
#17 Q – Queen Dress
#18 R – Raincoat
#19 S – Shoes
#20 T – T-shirt
#21 U – Uniform
#22 V – Vest
#23 W – Winter Coat
#24 X – Xmas Sweater
#25 Y – Yoga Pants
#26 Z – Zipper
```

---

## 19. Legacy chant lyric A–Z — reference only

> Phần này giữ lại để tham chiếu lịch sử/template chant cũ. **Không phải default lyric architecture mới.** Với bài full-song mới, ưu tiên Adaptive Phrase Mode ở Section 3 và density/chunking rules ở Section 29.

```text
A A A is an Apron,
A A A,
A is an Apron,
A A A.

B B B is Boots,
B B B,
B is Boots,
B B B.

C C C is a Cap,
C C C,
C is a Cap,
C C C.

D D D is a Dress,
D D D,
D is a Dress,
D D D.

E E E is Earrings,
E E E,
E is Earrings,
E E E.

F F F is Flip-flops,
F F F,
F is Flip-flops,
F F F.

G G G is Gloves,
G G G,
G is Gloves,
G G G.

H H H is a Hat,
H H H,
H is a Hat,
H H H.

I I I is Innerwear,
I I I,
I is Innerwear,
I I I.

J J J is a Jacket,
J J J,
J is a Jacket,
J J J.

K K K is a Kimono,
K K K,
K is a Kimono,
K K K.

L L L is Long Pants,
L L L,
L is Long Pants,
L L L.

M M M is a Mitten,
M M M,
M is a Mitten,
M M M.

N N N is a Necklace,
N N N,
N is a Necklace,
N N N.

O O O is an Observatory,
O O O,
O is an Observatory,
O O O.

P P P is Pajamas,
P P P,
P is Pajamas,
P P P.

Q Q Q is a Queen Dress,
Q Q Q,
Q is a Queen Dress,
Q Q Q.

R R R is a Raincoat,
R R R,
R is a Raincoat,
R R R.

S S S is Shoes,
S S S,
S is Shoes,
S S S.

T T T is a T-shirt,
T T T,
T is a T-shirt,
T T T.

U U U is a Uniform,
U U U,
U is a Uniform,
U U U.

V V V is a Vest,
V V V,
V is a Vest,
V V V.

W W W is a Winter Coat,
W W W,
W is a Winter Coat,
W W W.

X X X is an Xmas Sweater,
X X X,
X is an Xmas Sweater,
X X X.

Y Y Y is Yoga Pants,
Y Y Y,
Y is Yoga Pants,
Y Y Y.

Z Z Z is a Zipper,
Z Z Z,
Z is a Zipper,
Z Z Z.
```

---

## 20. Workflow sản xuất hoàn chỉnh — Theme First / Mapping First

Pipeline chuẩn của project phải theo dependency một chiều:

```text
THEME
-> A-Z OBJECT MAPPING
-> MAPPING LOCK
-> LEARNING BLOCKS
-> LYRICS + SUNO PROMPT
-> OBJECT IMAGE PROMPTS
-> HUMAN SUNO / IMAGE GENERATION
-> SONG FOLDER HANDOFF
-> PREPARE-ASSETS / SEGMENTATION
-> TRANSCRIBE + ALIGN
-> ANALYZE
-> BUILD CONFIG
-> REMOTION RENDER
```

### STEP 1 — Theme Brief

Agent xác định:

```text
theme
theme_scope: strict / guided / open
mapping_authority: user-locked / project-locked / generated
age band
language/locale
LETTER_NAME / PHONICS
educational goal
```

### STEP 2 — Generate A-Z Object Mapping ONLY

Agent tạo `LETTER -> OBJECT` phù hợp theme và chạy Mapping Quality Gate theo context.

Ở bước này **chưa viết full lyric và chưa viết 26 image prompts**.

### GATE G1 — Mapping Lock

Mapping state:

```text
PROPOSED -> REVIEWED -> LOCKED
```

Chỉ mapping `LOCKED` mới trở thành `authoring/mapping.json` và source-of-truth cho mọi downstream artifact.

Nếu đổi object sau lock:

```text
reopen G1
-> update mapping
-> mark dependent lyric/image prompts/manifests stale
-> regenerate/re-audit affected artifacts
```

Không được để lyric hoặc image generator tự thay object chỉ vì từ khác dễ rhyme/dễ vẽ hơn.

### STEP 3 — Learning Design từ locked mapping

Agent tạo/cập nhật:

```text
Learning Block Manifest
Section Manifest
Lexical Novelty Tier
Letter Difficulty Profile
congruent action
visual hint
retrieval plan
pronunciation/stress notes
```

### STEP 4 — Lyric + Music Package

Chỉ dùng locked mapping để tạo:

```text
authoring/generation-lyrics.txt
authoring/display-lyrics.txt
authoring/style-prompt.txt
authoring/exclude-styles.txt (optional)
```

Sau đó chạy rhyme/prosody/pronunciation/density/hook/retrieval QC theo các section rules của tài liệu này.

`generation-lyrics.txt` dành cho AI music provider.
`display-lyrics.txt` là canonical sung lines; khi handoff vào visualizer, normalize/copy thành `assets/original-lyrics.txt`.

### STEP 5 — Object Image Prompt Package

Agent sinh 26 prompt A-Z từ **locked mapping + Learning Block visual metadata**.

Canonical authoring artifact:

```text
authoring/object-prompts.json
```

Prompt có thể đổi style/composition/action nhưng không được đổi canonical object identity.

### GATE G2 — Human Generation Handoff

Human thực hiện provider-facing generation:

```text
Suno:
  generation-lyrics.txt + style-prompt.txt
  -> chọn audio tốt
  -> copy assets/audio.mp3|wav

Image generator:
  object-prompts.json
  -> chọn 26 raw images
  -> copy assets/source-images/A.* ... Z.*
```

Không cần copy lyric thủ công lần nữa nếu agent package đã có `authoring/display-lyrics.txt`: folder importer preserve authoring package và tự bridge file này thành `assets/original-lyrics.txt` khi runtime lyric asset chưa tồn tại.

Human vẫn giữ quyền chọn generation cuối vì quality/taste/provider behavior chưa phải deterministic step.

### STEP 6 — Import Folder

Backend hỗ trợ hai mode:

```text
LEGACY
-> audio/bg/logos + 26 processed letter assets

THEME-FIRST
-> audio/bg/logos + authoring/mapping.json
-> và mỗi A-Z có either:
   processed letter + processed object
   OR raw source image cho prepare-assets
```

### GATE G3 — Prepare Assets / Segmentation

Job:

```text
prepare-assets
```

Nếu processed assets đã có:

```text
assets/letters/A.*
assets/objects/A.*
```

thì target được skip.

Nếu chưa có, worker lấy:

```text
assets/source-images/A.*
```

và gọi segmentation adapter qua `ABC_SEGMENTER_COMMAND` để chuẩn hóa output thành:

```text
assets/letters/A.png
assets/objects/A.png
```

Adapter model/provider không nằm trong renderer contract; có thể thay SAM/SAM2/YOLO-seg/custom script mà không sửa Remotion.

### STEP 7 — Transcribe + Align

Job `transcribe` tạo:

```text
artifacts/whisperx.json
artifacts/lyrics.json
artifacts/lyrics.srt
```

Nếu `authoring/mapping.json` tồn tại, mỗi learning line có explicit semantic identity:

```json
{
  "letter": "A",
  "object": "Apple"
}
```

`object` đến từ mapping, không reverse-parse lyric.

Production ABC handoff rule:

- `AI Music Generation Lyrics` có thể chứa section/performance tags cho provider;
- `assets/original-lyrics.*` chỉ chứa sung display/alignment lines;
- worker MVP vẫn pair original lines với transcription segments theo order, nên sau Transcribe phải verify target occurrence count/timing;
- two-round A-Z thường có 52 learning-target timeline occurrences nhưng vẫn chỉ 26 canonical mapping/object identities;
- nếu cần timing production tuyệt đối, dùng/repair `artifacts/lyrics.json` đã align/verify thay vì coi positional MVP là bằng chứng hoàn hảo.

### STEP 8 — Audio Analyze

Job `analyze` tạo `artifacts/audio-analysis.json` cho beat/RMS/bass/band-driven animation.

### GATE G4 — Audio/Alignment QC

Kiểm tra:

```text
pronunciation
prosody
letter boundaries
target object identity
target occurrence count
section skip/rush
retrieval gap
word/line timing
```

Local repair trước; không đổi mapping nếu failure chỉ là pronunciation/mix/alignment.

### STEP 9 — Build Config

Legacy project yêu cầu 26 processed letters.

Theme-first project có mapping yêu cầu:

```text
26 processed letters
26 processed objects
```

ConfigBuilder resolve extension thực tế (SVG/PNG/WebP) và đưa object asset map vào `project-config.json`.

### GATE G5 — Render Readiness

Không render nếu thiếu required processed asset/artifact.

### STEP 10 — Remotion Render

Mỗi frame:

```text
current time
-> active lyrics.json line
-> explicit letter/object
-> config.assets.letters[letter]
-> config.assets.objects[letter]
-> render letter + object + timed lyric
```

Project cũ không có `object` vẫn dùng legacy fallback parser.

### STEP 11 — Final Video QC

Kiểm tra:

- đúng letter/object mapping;
- object image đúng target;
- chữ rõ, không biến dạng;
- sync phrase đúng audio;
- lyric/karaoke đúng;
- không watermark/text rác;
- animation không che learning target;
- intro/refrain/chorus không bị gán nhầm learning asset.

Chi tiết folder, job order và responsibility matrix: `docs/ABC_SONG_PIPELINE.md`.

---

## 21. Checklist QC bắt buộc

### Audio

- [ ] Letters được phát âm riêng: `A ... A ... A`.
- [ ] Không hát `AAA` quá nhanh.
- [ ] Vocal rõ hơn nhạc nền.
- [ ] Không thêm lyric lạ.
- [ ] Không rap/chạy chữ.
- [ ] Mỗi letter phrase hoàn chỉnh, có cadence và không phải rush.
- [ ] Transition không nuốt mất chữ cuối.

### Lyric

- [ ] Đúng target letter.
- [ ] Đúng object.
- [ ] Không có từ `repeat` trong lyric.
- [ ] a/an/plural hợp lý.
- [ ] Không có câu dài gây phá nhịp.

### Image

- [ ] Target letter cực lớn và dễ đọc.
- [ ] Chỉ có target letter.
- [ ] Không có text phụ.
- [ ] Object lớn và rõ.
- [ ] Không clutter.
- [ ] Cartoon child-safe.

### Video

- [ ] Clip duration khớp aligned audio phrase.
- [ ] Chữ ổn định xuyên cảnh.
- [ ] Không thêm chữ ngẫu nhiên.
- [ ] Không logo/watermark.
- [ ] Chuyển động vui nhưng chậm.
- [ ] Object có một hành động đơn giản.
- [ ] Camera không rung.
- [ ] Clip dễ ghép nối.

---

## 22. Nguyên tắc ưu tiên khi có xung đột

Thứ tự ưu tiên:

```text
1. Chữ cái phải đúng và dễ đọc.
2. Từ vựng/đồ vật phải đúng.
3. Phát âm phải rõ.
4. Natural prosody phải đúng.
5. Letter phrase phải hoàn chỉnh và không bị rush.
6. Breathing space / section density phải hợp lý.
7. Hình ảnh phải đơn giản, dễ hiểu.
8. Style phải đồng nhất.
9. Duration symmetry và cinematic đứng sau khả năng học.
```

Nếu cinematic animation làm giảm khả năng đọc chữ thì giảm animation.

Nếu melody làm các chữ bị hát quá nhanh thì đơn giản hóa melody.

Nếu background đẹp nhưng tạo thêm ký hiệu/chữ rác thì đơn giản hóa background.

---

## 23. Master rule

Toàn bộ pipeline tuân theo một nguyên tắc:

> **ONE LETTER + ONE OBJECT + ONE COMPLETE SINGABLE PHRASE + ONE CLEAR VISUAL IDEA PER LEARNING BLOCK.**

Và đối với audio:

> **LETTER CLARITY AND PAUSES ARE MORE IMPORTANT THAN MUSICAL COMPLEXITY.**

Đối với hình/video:

> **THE TARGET LETTER MUST ALWAYS BE THE MOST READABLE ELEMENT AND NO OTHER LETTER OR TEXT MAY APPEAR.**

---

## 24. Kiến trúc AI composer: viết theo nhiều pass, không viết một lần rồi xuất ngay

Đối với AI viết nhạc, không dùng tư duy:

```text
INPUT -> viết lyric -> xong
```

Dùng pipeline nội bộ:

```text
INPUT LOCK
  -> EDUCATIONAL DRAFT
  -> PROSODY PASS
  -> PRONUNCIATION PASS
  -> DENSITY / PACING PASS
  -> MUSIC STYLE PASS
  -> FINAL QC GATE
  -> OUTPUT
```

### 24.1. Pass 0 — Input Lock

Trước khi sáng tác, AI phải khóa các dữ liệu mà user đã cung cấp:

- theme;
- target age;
- target letters;
- `LETTER -> WORD` mapping;
- lyric template;
- target duration;
- language/locale;
- requested vocal style;
- requested music style.

**Không được âm thầm sửa input.**

Ví dụ user đưa:

```text
O -> Observatory
```

AI có thể cảnh báo rằng `Observatory` không đồng nhất với clothing theme và đề xuất `Overalls`, nhưng output mặc định vẫn phải giữ `Observatory` cho đến khi user chấp nhận thay đổi.

### 24.2. Pass 1 — Educational Draft

Sinh lyric theo rule giáo dục trước, chưa ép rhyme/hook.

Ưu tiên:

1. đúng target letter;
2. đúng target word;
3. câu ngắn và concrete;
4. dễ bắt chước;
5. repetition có mục đích;
6. một action/gesture đơn giản khi phù hợp;
7. không thêm vocabulary cạnh tranh với target.

### 24.2.1. Pass 1B — Hook & Participation Architecture

Trước khi polish rhyme, xác định ba lớp memorability:

```text
MACRO HOOK  = chorus/refrain ngắn, lặp nguyên văn
MICRO HOOK  = pattern dự đoán được cho từng letter/object
MOTION CUE  = một action/gesture đơn giản có thể làm theo
```

Full preschool song phải có ít nhất **macro hook + micro hook**. Movement cue rất nên có nếu object/action cho phép.

Ví dụ micro-hook:

```text
A ... A ... apple — crunch, crunch!
B ... B ... book — turn the page!
```

Không bắt buộc dùng đúng wording này; bắt buộc là pattern phải **predictable, short, repeatable**.

### 24.3. Pass 2 — Prosody

Kiểm tra trọng âm, số âm tiết tương đối, vị trí target word và khả năng hát tự nhiên.

Nếu rhyme hay melody làm sai trọng âm, **bỏ rhyme hoặc đơn giản hóa melody**.

### 24.4. Pass 3 — Pronunciation

Kiểm tra:

- letter name;
- target word;
- từ nhiều âm tiết;
- acronym;
- số;
- homograph;
- từ không phải tiếng Anh;
- cách đọc theo locale.

Mọi từ có nguy cơ đọc sai phải được ghi vào Pronunciation Notes trước khi generation.

### 24.5. Pass 4 — Density / Pacing

Đọc toàn bộ lyric theo tốc độ dự kiến.

Nếu phải đọc nhanh để nhét đủ chữ thì lyric quá dày.

Rule:

> **Spread, do not cram.**

Với preschool, khoảng trống giữa các âm quan trọng hơn mật độ từ.

### 24.5.1. Pass 4B — Rhyme & Memorability

Với full-song, rhyme không còn là bước ngẫu nhiên. Chọn scheme trước và kiểm tra từng pair bằng read-aloud.

Ưu tiên:

```text
4-line section -> AABB hoặc ABAB
6-line section -> AABBCC
2-line refrain -> AA
```

Sau rhyme check, chạy **Child Repeatability Test**:

- trẻ có thể echo 2–5 từ cuối của hook sau 1–2 lượt nghe không;
- syntax giữa các letter có đủ predictable để trẻ đoán phần kế tiếp không;
- có một rhythmic cell/signature phrase lặp lại không;
- rhyme có nghe ra khi nói thành tiếng không;
- có action word dễ làm theo không;
- có filler chỉ để kiếm rhyme không.

Nếu rhyme đúng nhưng câu vẫn giống prose, **rewrite thành hook-driven lyric**.

### 24.6. Pass 5 — Music Style

Sau khi lyric đã ổn định mới tạo Style Prompt.

Style Prompt phải mô tả ngắn gọn:

```text
VOCAL IDENTITY
+ MUSIC FAMILY
+ TEMPO / FEEL
+ 2–4 KEY INSTRUMENTS
+ DELIVERY / PROSODY
+ MIX PRIORITY
```

Không dùng một danh sách dài các tính từ đồng nghĩa.

### 24.7. Pass 6 — Final QC Gate

Không xuất trạng thái `READY` nếu còn lỗi Critical.

AI phải tự review output trước khi đưa cho user.

---

## 25. Prosody và ngữ điệu cho nhạc thiếu nhi

Prosody là việc **trọng âm tự nhiên của lời nói khớp với trọng âm âm nhạc**.

Đây là một trong những rule quan trọng nhất khi AI viết melody/lyric.

### 25.1. Natural stress must survive the melody

Ví dụ nguyên tắc:

```text
HAP-py
```

không được biến thành:

```text
hap-PY
```

Với target word nhiều âm tiết, AI phải xác định âm tiết được nhấn tự nhiên trước khi quyết định melody.

Nếu không chắc cách đọc một từ, **không đoán**. Đánh dấu pronunciation risk.

### 25.1.1. Stress Verification Gate

Với target word nhiều âm tiết, **không suy stress từ spelling**.

Nếu chưa chắc:

1. verify pronunciation/stress bằng nguồn từ điển đáng tin cậy;
2. ghi stress vào Pronunciation Notes;
3. chỉ sau đó mới chọn motif/rhythm.

Ví dụ đúng:

```text
AP-ple
um-BREL-la
e-RA-ser
HIGH-light-er
XY-lo-phone
```

Một prosody example sai trong rule có thể làm sai toàn bộ melody family, vì vậy lexical stress là dữ liệu cần verify chứ không phải creative guess.

### 25.2. Strong beat cho learning target

Trong 4/4 đơn giản, ưu tiên target letter hoặc âm tiết chính của target word rơi vào beat mạnh, đặc biệt beat 1 hoặc 3.

Ví dụ tư duy:

```text
BEAT 1        BEAT 2        BEAT 3        BEAT 4
A             ...           A             ...
```

Không bắt buộc máy móc từng block, nhưng không để learning target liên tục rơi vào vị trí yếu và bị nuốt.

### 25.3. High note = semantic emphasis

Nếu melody có một nốt nổi bật/cao hơn, ưu tiên dành cho:

- target letter;
- target word;
- từ khóa giáo dục.

Không dành melodic peak cho từ chức năng như:

```text
is
a
an
the
```

### 25.4. One syllable, one clear event

Đối với learning target, ưu tiên **một âm tiết = một note/event rõ ràng**.

Tránh melisma kiểu:

```text
Aaaaa-a-a-a-a
```

nếu nó làm trẻ khó nhận diện chữ `A`.

Với chữ cái lặp:

```text
A ... A ... A
```

ba lần `A` là **ba learning events độc lập**, không phải một vocal run.

### 25.5. Read-aloud test bắt buộc

Trước khi chốt lyric, AI phải giả lập việc nói lyric như speech bình thường.

Hỏi:

```text
Does this sound natural when spoken slowly?
Is any word stressed on the wrong syllable?
Would a child know where one letter ends and the next begins?
Does the sentence require rushing?
```

Nếu nói đã khó thì hát sẽ khó hơn.

### 25.6. Punctuation hỗ trợ phrasing

Có thể dùng:

```text
comma       -> phrase break nhẹ
period      -> kết câu rõ
ellipsis    -> gợi ý kéo khoảng nghỉ
line break  -> tách phrase
```

Nhưng punctuation chỉ là **prompting cue**, không phải cam kết timing chính xác của model.

---

## 26. Letter pronunciation, phonics và locale

ABC song phải xác định rõ đang dạy:

```text
LETTER NAME MODE
```

hay:

```text
PHONICS MODE
```

### 26.1. Default của project

Nếu user không nói khác:

```text
mode = LETTER NAME
language = English
locale = en-US
```

Ví dụ:

```text
A -> “ay”
B -> “bee”
C -> “see”
Z -> “zee”
```

Không tự chuyển sang phonics sound `/æ/`, `/b/`, `/k/` nếu bài đang ở Letter Name Mode.

### 26.2. Không trộn letter name và phonics vô tình

Sai nếu một số block đọc tên chữ còn một số block đọc âm phonics mà không có chủ đích.

Nếu làm phonics song, phải đổi toàn bộ lesson contract và ghi rõ:

```text
A says /æ/
B says /b/
...
```

### 26.3. Regional pronunciation

Nếu dùng locale khác như `en-GB`, phải xử lý khác biệt có ý nghĩa, ví dụ `Z = zed`.

Locale phải nhất quán trong cả bài.

---

## 27. Hai lớp lyric: Canonical Lyrics và Generation Lyrics

Không nên ép một phiên bản lyric phục vụ đồng thời cả người đọc và AI music engine.

Dùng hai lớp:

### 27.1. Canonical Lyrics

Là lời chuẩn để:

- user đọc;
- subtitle;
- metadata;
- lyric display;
- lưu source of truth.

Ví dụ:

```text
A A A is an Apron,
A A A,
A is an Apron,
A A A.
```

### 27.2. Generation Lyrics

Là phiên bản tối ưu riêng cho AI music engine.

Có thể dùng:

- phonetic spelling;
- punctuation để cue pause;
- section tags;
- line break khác;
- spelling workaround nếu model đọc sai.

Ví dụ:

```text
A ... A ... A ... is an Apron,
A ... A ... A,
A is an Apron,
A ... A ... A.
```

### 27.3. Rule quan trọng

```text
Canonical Lyrics = semantic source of truth
Generation Lyrics = rendering layer
```

Không sửa Canonical Lyrics chỉ để workaround lỗi của một model.

### 27.4. Pronunciation Notes

Mỗi bài có thể duy trì bảng:

```text
| Word/Phrase | Intended pronunciation | Generation spelling | Reason |
|-------------|------------------------|---------------------|--------|
| Z           | zee                    | zee / Z              | en-US letter name |
```

Chỉ áp dụng phonetic workaround trong Generation Lyrics.

---

## 28. Melody rules cho preschool educational music

### 28.1. Narrow melodic range

Melody nên nằm trong range hẹp, dễ nhớ và dễ bắt chước.

Ưu tiên:

- repeated notes;
- stepwise motion;
- small intervals;
- predictable cadence;
- motif lặp lại giữa các block.

Hạn chế:

- octave jumps;
- nhiều leap lớn;
- vocal runs;
- key changes liên tục;
- melody quá theatrical.

### 28.2. Stable motif, flexible wording

A–Z nên có một **melodic grammar chung**, nhưng grammar đó phải co giãn theo số syllables.

Adaptive Phrase Mode có thể dùng:

```text
LETTER + TARGET WORD   -> motif A
DESCRIPTION            -> motif B
CONTEXT / ACTION       -> motif C or cadence
```

Nếu có repeated-letter cue:

```text
LETTER x2/x3           -> short stable motif
TARGET WORD            -> emphasized landing
DESCRIPTION/ACTION     -> resolving phrase
```

Legacy Chant Mode có thể giữ motif lặp kiểu `LETTER x3 -> WORD -> LETTER x3`.

Không cần 26 melody hoàn toàn khác nhau. Consistency giúp trẻ dự đoán phần tiếp theo, nhưng **melodic symmetry không được ép mọi target word vào cùng một syllable grid**.

### 28.3. Không ép từ vào melody

Nếu target word dài hơn bình thường:

```text
DO NOT speed up the word to preserve the melody.
ADAPT the note lengths or simplify the phrase.
```

Pronunciation > melodic symmetry.

### 28.4. Cadence phải để lại không gian chuyển block

Cuối mỗi block nên có cảm giác settle nhẹ để block tiếp theo bắt đầu sạch.

Không để note cuối kéo quá dài và nuốt target letter kế tiếp.

---

## 29. Rhythm, groove và lyric density

### 29.1. Default groove

Khuyến nghị mặc định:

```text
80–100 BPM broad starting envelope
simple 4/4
steady pulse
light subdivision
```

Đây là vùng khởi đầu, không phải giới hạn tuyệt đối.

### 29.2. Không dùng tốc độ để giải quyết lyric quá dài

Nếu block không vừa:

Sai:

```text
increase vocal speed
add rapid sixteenth-note phrasing
compress all words together
```

Đúng:

```text
simplify wording
lengthen block slightly during generation
reduce ornamentation
use post-edit to align exact video timing
```

### 29.3. Avoid syncopation on the core learning target

Syncopation có thể dùng nhẹ trong accompaniment, nhưng target letter/word nên có rhythmic placement đơn giản và predictable.

### 29.4. Silence is instructional space

Khoảng nghỉ không phải phần bị thiếu của bài hát.

Trong preschool music:

> **Silence can function as teaching time.**

Khoảng nghỉ giúp trẻ:

- nhận diện âm vừa nghe;
- bắt chước;
- chuẩn bị chữ tiếp theo;
- tránh auditory overload.

### 29.5. Letter phrase density profile

Default heuristic cho Adaptive Phrase Mode:

```text
6–12 sung words preferred per physical letter line
roughly 8–14 sung syllables preferred
up to ~16 only with a strong natural pause
1–2 internal phraselets typical; 3 when clearly needed
2–4 bars typical
more bars allowed when needed
low density
clear breathing points
```

Không PASS/FAIL chỉ bằng word count. Đánh giá theo tổng hợp:

```text
syllables + stress + bars + breath + cadence + clarity
```

Một line ngoài vùng 6–12 words vẫn có thể PASS nếu prosody, pause và pacing thực sự tốt; một line nằm trong vùng vẫn FAIL nếu tongue-twister, stress sai hoặc buộc phải rush. Word count là heuristic, không phải quality substitute.

### 29.6. Local density quan trọng hơn global word count — nhưng global length vẫn là risk signal

Một ABC educational song có thể dài hơn một pop song thông thường vì phải đi đủ A–Z, thậm chí hai vòng.

Không dùng một global word cap máy móc để loại bài. Tuy nhiên, tổng lyric vẫn phải được dùng như **generation-risk signal**, đặc biệt khi gửi toàn bộ bài vào một lần generate.

Kiểm tra trước hết:

- từng letter phrase có hát được không;
- từng musical section có ngắn vừa phải không;
- model có bắt đầu rush/compress/skip ở cuối section không;
- có breathing section giữa các nhóm chữ không.

Sau đó kiểm tra tổng lyric:

```text
< ~700 sung words  -> generally manageable if local density is low
~700–800 words      -> caution; review section density carefully
> ~800 words         -> HIGH GENERATION RISK for a single Suno-style generation
```

Các ngưỡng này là **risk heuristic**, không phải pedagogical hard fail. Nếu bài trên ~800 words nhưng nội dung giáo dục vẫn cần thiết:

- rút ngắn Round 2 trước khi cắt Round 1;
- rút chorus/bridge/filler;
- giảm số lần chorus lặp;
- hoặc generate theo parts/rounds rồi stitch nếu workflow/provider cho phép.

Không được giải quyết global length bằng cách tăng vocal speed.

Rule:

> **A long educational song is acceptable; a dense local section is not. Global length warns about generator capacity, not educational quality.**

### 29.7. Không tạo mega-verse 26 dòng

Không đặt toàn bộ A–Z vào một `[Verse]` duy nhất.

Trong broad preschool envelope khoảng **80–100 BPM**, default an toàn vẫn là **4–6 letter lines per section**. Không dùng 8-line section làm mặc định ở tempo dưới 100 BPM; nếu tempo cao hơn, vẫn phải pass density/audio audit thay vì tự động cho phép section dài.

Với **Round 2 retrieval/action-heavy** trong bài hai vòng, dùng **4 letter lines/section** làm starting point bảo thủ. `5–6` vẫn hợp lệ nếu local density thấp và generation test trước đó chứng minh target clarity + response gap vẫn ổn. Nếu block cuối `U–Z` sáu dòng bắt đầu mờ/merge, ưu tiên split `U–X` + `Y–Z` thay vì tăng BPM.

Nếu rhyme không phải mục tiêu chính, có thể dùng chunk 4–6 lines linh hoạt.

Nếu **rhyme/memorability là mục tiêu chính**, `4+4+4+4+4+6` vẫn là một rhyme-forward option, nhưng khi provider có dấu hiệu degrade ở block sáu dòng, dùng `4+4+4+4+4+4+2` để giữ pair rhyme mà tăng generation reliability.

Các chunk 4–6 letter lines khác đều hợp lệ nếu musical phrasing tốt hơn và không tạo orphan rhyme line.

`7–8 lines` chỉ dùng khi:

- từng letter line rất ngắn;
- tempo/arrangement cho phép;
- generation test thực tế không rush/compress/skip.

Giữa chunk có thể dùng:

- short musical breath;
- 1–2 bar turnaround;
- short refrain, **2 lines preferred** khi dùng làm memory reset;
- very short transition.

Chorus/hook mặc định nên **4 lines trong hook-driven mode**, tối đa khoảng 4–6 lines. Nếu chorus dài hơn, ưu tiên tách hoặc rút trước khi tăng density.

Nguyên tắc kế thừa từ density control:

> **Add more sections, not longer sections.**

### 29.8. Kiến trúc hai vòng A–Z đầy đủ

Hai vòng đều có thể chứa đủ 26 chữ mà không fail structure nếu mỗi vòng có **chức năng giáo dục khác nhau** và được chunk thành các section ngắn.

#### ROUND 1 — TEACH / IDENTIFY / DESCRIBE

Mục tiêu:

- giới thiệu `LETTER -> WORD`;
- mô tả vật thể bằng một chi tiết cụ thể;
- dùng phrase đầy đủ hơn.

Guideline:

```text
6–12 sung words per letter line preferred
1–2 phraselets typical
```

Ví dụ:

```text
A is for apple, red and sweet,
packed beside my morning snack.
```

#### ROUND 2 — REINFORCE / ACTION / RECALL

Không paraphrase Round 1 đơn thuần.

Mục tiêu có thể là:

- action;
- sensory reinforcement;
- recall;
- call-and-response;
- shorter repeated letter cue.

Guideline:

```text
short repeated-letter/target cue + about 2–6 action or recall words
1–2 phraselets
```

Ví dụ:

```text
A, A, apple — take a bite!
```

hoặc:

```text
A is for apple, take a bite,
crunch it gently, fresh and bright.
```

Hai round phải thỏa:

```text
learning_target(round1) = learning_target(round2)
function(round1) != function(round2)
```

Điều này giữ repetition có mục đích và tránh `twin verse`.

### 29.9. Recommended two-round section map

Khi **rhyme/memorability là mục tiêu chính**, ưu tiên chunk chẵn để không có orphan line. Tempo không khóa ở một narrow band; dùng khoảng **80–100 BPM** như broad starting envelope rồi calibrate theo age band, lyric density và learning objective. Lexical-heavy material thường hợp vùng calmer hơn; sparse retrieval/action có thể dùng energy cao hơn nếu vẫn rõ.

```text
A–D  = 4 lines -> AABB
E–H  = 4 lines -> AABB
I–L  = 4 lines -> AABB
M–P  = 4 lines -> AABB
Q–T  = 4 lines -> AABB
U–Z  = 6 lines -> AABBCC
```

Recommended map:

```text
[Intro - 4 lines]

ROUND 1 — TEACH / DESCRIBE
[Verse 1] A–D
[Verse 2] E–H
[Refrain - 2 lines]
[Verse 3] I–L
[Verse 4] M–P
[Refrain - 2 lines]
[Verse 5] Q–T
[Verse 6] U–Z
[Chorus - 4 lines preferred]

ROUND 2 — ACTION / RECALL
[Verse 7] A–D
[Verse 8] E–H
[Refrain - same 2 lines]
[Verse 9] I–L
[Verse 10] M–P
[Refrain - same 2 lines]
[Verse 11] Q–T
[Verse 12] U–Z
[Final Chorus - same 4 lines]

[Outro - 4 lines]
[End]
```

Refrain và chorus nên **lặp nguyên văn**, không rewrite mỗi lần. Predictability là một phần của memorability.

Không bắt buộc tên tag chính xác như trên; mục tiêu là giữ mỗi actual section ngắn, có rhyme partner rõ, và phù hợp tempo.

### 29.10. Bar count chỉ là guidance

Bar count hữu ích để composer hình dung phrase, nhưng không phải timing contract.

Nếu phrase cần thêm bars để giữ natural stress hoặc breathing space, **thêm bars**.

Không tăng BPM hay vocal speed để ép câu vào một bar count đã chọn trước.

Video luôn sync theo audio thực sau generation.

### 29.11. Hook-driven preschool architecture

Các format preschool hiệu quả hiện nay thường tạo participation bằng repetition + movement + predictable cue, không chỉ bằng end rhyme.

Rule ba lớp:

```text
1. MACRO HOOK
   chorus 4 lines preferred
   same words every time
   title/ABC cue in line 1 or line 4

2. MICRO HOOK
   repeated syntax for each learning item
   e.g. LETTER ... LETTER ... WORD -> ACTION

3. MOTION CUE
   one simple verb/gesture when natural
   clap / tap / turn / color / rub / press / zip / spin
```

### 29.12. Child Repeatability Test

Một hook preschool tốt phải cho phép trẻ tham gia **trước khi thuộc toàn bộ lyric**.

PASS khi:

- sau 1–2 lượt nghe, trẻ có thể echo một fragment khoảng 2–5 từ;
- trẻ có thể đoán syntax của letter kế tiếp;
- có một action/gesture có thể bắt chước;
- phrase cuối/rhyme word đủ rõ để anticipate;
- repeated hook không thay wording giữa các lần xuất hiện.

WARN khi lyric đúng nhưng giống câu giải thích của giáo viên hơn câu hát.

Ví dụ prose-like:

```text
H is for highlighter, making important words shine bright.
```

Hook-driven hơn:

```text
H is for highlighter, yellow and bright,
mark a little word just right.
```

Không copy công thức máy móc; mục tiêu là **concrete + rhythmic + repeatable**.

### 29.13. Accent-stable rhyme

Rhyme phải hoạt động trong locale đã chọn, không chỉ nhìn giống nhau trên chữ viết.

Với default `en-US`, tránh dựa vào rhyme pair có pronunciation biến thiên theo accent, ví dụ `rain / again`.

Rule:

```text
READ RHYME PAIRS ALOUD IN TARGET LOCALE
```

Nếu rhyme không ổn định, đổi wording trước khi generation.

### 29.14. Paired-line rhythmic pocket

Hai line ghép vần nên có syllable count và stress pattern tương đối gần nhau để dùng cùng melodic grammar.

Default heuristic:

```text
paired lines: usually within ~2 sung syllables
similar major stress positions
same approximate rhythmic cell
```

Có thể lệch hơn nếu có held note/rest rõ ràng, nhưng không được cram một line chỉ để giữ rhyme.

### 29.15. Hook repetition budget

Với macro chorus 4 dòng, nếu tự nhiên, đặt signature/title hook ở cả **line 1 và line 4**.

Preferred shape:

```text
SIGNATURE HOOK
participation / movement cue
learning summary
SIGNATURE HOOK
```

Hook lặp phải verbatim hoặc gần như verbatim để tăng recall.

### 29.16. Action quality

Motion cue phải:

- concrete;
- safe;
- dễ bắt chước ngay;
- gắn trực tiếp với object;
- chỉ có một hành động chính.

Round 2 micro-hook kết thúc bằng action thật thường mạnh hơn description thuần túy.

Ví dụ:

```text
Q ... Q ... quill -> dip and write
Y ... Y ... yoyo -> spin it down
Z ... Z ... zipper -> zip it up
```

### 29.17. Energy contrast để tránh mệt tai

Không làm toàn bài ở mức hyperactive.

Recommended:

```text
Round 1 = calm, clear, descriptive
Round 2 = more rhythmic, action/recall
Chorus  = participation peak
Refrain = short reset / cue
```

Điều này vừa tăng engagement vừa giữ parent-listenability và pronunciation clarity.

### 29.18. Melodic Motif Contract

Preschool melody cần **predictable hơn decorative**. Trẻ nhỏ thường tái tạo melodic contour tốt hơn pitch interval chính xác, nên composer phải khóa ba musical cells trước generation:

```text
MACRO HOOK MOTIF
= 1–2 bars
= title / signature phrase
= contour đơn giản nhất bài
= gần như không đổi giữa các lần chorus

ROUND 1 LETTER MOTIF
= melodic grammar chung cho các letter lines
= repeated notes + stepwise motion là nền tảng
= strong stress của target word rơi vào vị trí nhạc mạnh tương tự nhau

ROUND 2 ACTION / RESPONSE MOTIF
= ngắn hơn Round 1
= rhythmic, predictable
= có khoảng trống để trẻ echo target word / action / clap
```

Default melodic guidance:

- primarily diatonic;
- range tổng thường nằm trong khoảng một octave hoặc hẹp hơn;
- macro hook nên dùng range hẹp hơn verse nếu có thể;
- stepwise motion và repeated notes ưu tiên hơn leap;
- cadence nên settle rõ, thường gently descending hoặc returning to a stable tone;
- tránh nhiều leap lớn trong một child-repeatable fragment;
- target letter và target word ưu tiên stable/strong tones.

### 29.18.1. Prosodic Motif Variants

Không dùng `one rigid melody grid fits all`.

Trước khi map target word vào melody, phân loại theo syllable/stress shape:

```text
1 syllable          -> BOOK
2 syllables S-w     -> AP-ple
3 syllables w-S-w   -> um-BREL-la / e-RA-ser
3 syllables S-w-w   -> HIGH-light-er / XY-lo-phone
```

Composer có thể duy trì một motif family nhưng dùng **2–4 prosodic variants**.

Các variant phải giữ:

- recognizable entry contour;
- same major beat anchors;
- similar cadence;
- same educational emphasis hierarchy.

Các variant được phép đổi:

- note duration quanh target word;
- pickup length;
- số note cho unstressed syllables;
- small internal rhythm.

Không được đổi lexical stress để giữ symmetry.

### 29.19. Response-Space Rule

Call-and-response chỉ có tác dụng khi có **musical space để response**.

Sau một call kiểu:

```text
A ... A ... apple!
```

cho phép một trong các dạng:

- short rest;
- held note;
- 1-beat / 2-beat response cell;
- percussion-only gap;
- group echo ngắn.

Không lấp kín mọi beat bằng lead vocal.

Master test:

> **A child can participate with only the target word, action or clap before knowing the full lyric.**

### 29.20. Melody Simplicity / Contour Test

Trước khi READY, kiểm tra:

```text
macro_hook_range <= about one octave, preferably narrower
hook_contour = easy to trace after one or two listens
large_leaps = rare
rhythmic_subdivision = simple by default
cadence = predictable
```

Nếu melody description cần nhiều leap, chromatic turn, syncopation hoặc ornament để nghe thú vị, đó thường là dấu hiệu melody đang phục vụ người lớn hơn learning target.

### 29.21. Hook Simulation Test

Không chỉ đọc lyric. Composer phải **speak/clap simulation** ít nhất:

1. main chorus;
2. một AABB pair của Round 1;
3. một micro-hook pair của Round 2.

PASS khi:

- paired lines có stress placement gần nhau;
- rhyme rơi vào predictable beat/cadence;
- hook có thể clap bằng một rhythmic cell ngắn;
- có response space thực;
- child có thể join ở fragment 2–5 từ mà không thuộc nguyên câu.

### 29.22. Four-Beat Participation Frame

Preschool call-and-response nên có turn boundary rõ. Default heuristic:

```text
1 bar call
1 bar response/action
```

hoặc một call ngắn kết thúc bằng khoảng nghỉ/pickup rõ trước response.

Không cần mọi response chính xác 4 beats, nhưng **response window phải predictable và lặp cùng grammar** giữa các letter. Tránh letter A cho trẻ 1 beat để đáp, letter B 3 beats, letter C không có gap nếu không có lý do âm nhạc rõ.

### 29.23. Novelty Budget / One-Variable Variation

Mỗi letter mới đã là một thay đổi semantic lớn. Vì vậy không đổi đồng thời quá nhiều thành phần âm nhạc.

Default:

```text
NEW = letter + target word
STABLE = core motif + rhythmic pocket + singer identity
OPTIONAL = một small variation tại một thời điểm
```

Trong một chunk 4–6 chữ:

- giữ melodic grammar ổn định;
- giữ groove ổn định;
- giữ response frame ổn định;
- nếu cần refresh, đổi nhẹ instrumentation/energy ở **section boundary**, không đổi random từng letter.

Rule:

> **NOVELTY REFRESHES ATTENTION; REPETITION BUILDS MEMORY.**

### 29.24. Mixed-Age Dual-Layer Test

Với audience 2–6, kiểm tra riêng hai lớp:

```text
ADULT LEAD LAYER
= đủ meaning, correct grammar, richer descriptor

CHILD PARTICIPATION LAYER
= 1–6 words tùy age band
= target word / short hook / action
= rhythm predictable
= có response space
```

FAIL nếu toàn bộ giá trị bài hát chỉ tồn tại khi trẻ hát được nguyên câu adult lead.

### 29.25. Sequence Boundary Clarity

Khi hát nhiều letter names liên tiếp, **mỗi chữ phải nghe như một event riêng**.

Hard rule:

```text
LETTER SEQUENCE != COMPRESSED SYLLABLE STREAM
```

Không tạo kiểu `LMNOP` bị dính thành một cụm. Nếu một sequence có nguy cơ blur:

- tách note attack;
- thêm micro-pause;
- giữ spacing đều;
- giảm tempo tại phrase nếu cần;
- chia sequence thành group nhỏ;
- đồng bộ visual highlight/pointing từng letter nếu video có sequence.

PASS khi người nghe có thể chỉ ra ranh giới từng letter bằng tai mà không cần đoán từ thứ tự alphabet.

Với chorus chỉ có `A-B-C`, vẫn phát âm ba chữ thành ba event rõ. Với full alphabet run, đây là **hard educational gate**.

### 29.26. Retrieval Beat trong Round 2

Round 2 không chỉ repeat; nó có thể tạo một **retrieval opportunity** trước khi confirm target word.

Default recall shape:

```text
LETTER ... LETTER ...
[brief predictable gap]
TARGET WORD!
[action / confirmation]
```

Theo age band:

```text
2–3   -> gap rất ngắn, adult confirm nhanh
4–6   -> có thể dùng khoảng ~1 beat rõ hơn
mixed -> brief predictable gap + positive confirmation
```

Không dùng wording kiểu `wrong`, `try again`, `you forgot`. Đây không phải quiz áp lực; retrieval gap chỉ tạo cơ hội cho trẻ tự gọi từ trước khi bài hát đưa đáp án.

### 29.27. Visual Retrieval Alignment

Nếu Round 2 có retrieval beat, visual có thể hỗ trợ theo mode:

- **2–3 / support-first:** object vẫn có thể hiện sớm để giảm tải;
- **4–6 / recall-first:** ưu tiên letter cue trước, object reveal/emphasis ở target-word response;
- **mixed:** letter nổi bật trước, object motion/emphasis xảy ra tại response thay vì spoil toàn bộ cue quá sớm.

Không làm visual game quá khó; mục tiêu là tăng recall, không tạo frustration.

### 29.27.1. Multimodal Congruence Rule

Audio, visual và gesture phải reinforce **cùng một concept**:

```text
TARGET WORD audio
+ matching object visual
+ semantically congruent action
```

Generic clap/tap phù hợp macro hook; object teaching nên dùng action gắn nghĩa như `zip -> zipper`, `spin -> yoyo`, `turn page -> book`.

Movement hỗ trợ chứ không thay thế auditory model. Retrieval mode không được visual-spoil answer trước cue gap đã thiết kế.

### 29.28. Target-Word Sustain Rule

Nếu target word được kéo note hoặc nhấn melody:

- sustain **natural stressed vowel**;
- consonant onset rõ và ngắn;
- không kéo schwa/unstressed ending chỉ để đủ bar;
- không melisma trên learning target;
- không đổi lexical stress.

Ví dụ principle:

```text
AP-ple -> emphasis ở AP
um-BREL-la -> emphasis ở BREL
HIGH-light-er -> emphasis ở HIGH
```

Target word phải vẫn nhận ra được nếu chỉ nghe audio, không nhìn subtitle.

### 29.29. Lexical-Novelty Melodic Rule

Không dùng large leap hoặc decorative pitch peak như default để dạy từ mới khó.

```text
Tier A familiar -> normal motif treatment
Tier B          -> stable tone / small step + clear repetition
Tier C          -> repeated-note / speech-like / chant-like first exposure
                  rồi mới melodic hóa hơn sau khi word đã được establish
```

High note có thể làm hook quen nổi bật, nhưng low-familiarity target ưu tiên clarity hơn pitch spectacle.

### 29.30. Child-Echo Tessitura

Child-facing response motif nên có pitch span **hẹp hơn adult-lead descriptive line**, chủ yếu repeated-note/stepwise và tránh extreme register.

Không hard-code note name nếu chưa test voice/age band. Mục tiêu là contour trẻ bắt chước được.

### 29.31. Early Hook Exposure

Không giấu signature hook đến sau một chuỗi A–Z dài. Full song nên expose title/macro-hook trong intro hoặc đủ sớm để trẻ biết participation grammar trước phần học dài.

Early hook có thể ngắn hơn full chorus nhưng melodic/rhythmic identity phải khớp.

### 29.32. Target-Word Mix Window

Quanh onset của target letter/word:

- thin arrangement ngắn;
- tránh clap/bell/snare mạnh đúng onset;
- backing vocal không chồng initial consonant/vowel attack;
- decorative percussion nên answer sau target thay vì mask target.

Đặc biệt quan trọng với one-syllable target và consonant mềm.

### 29.33. Repetition Function Test

Refrain/chorus repetition chỉ có giá trị khi nó phục vụ:

- orientation;
- participation;
- retrieval;
- memory.

Không auto-add refrain sau mọi chunk. Nếu bỏ một repetition mà learning/anticipation/participation không giảm, cân nhắc bỏ.

### 29.34. Sequence Identity vs Serial Memory

ABC song có thể dạy **sequence memory** mà chưa chứng minh child nhận ra từng letter độc lập.

Rule:

- canonical teaching song vẫn giữ A–Z order nếu đó là scope;
- L2/L3 phải sample một số `LETTER -> WORD` **out of sequence**;
- child hát tiếp chuỗi ABC không tự động được chấm là independent letter recognition;
- sau khi target đã được establish, có thể tạo short shuffled-recall derivative/episode;
- không tự randomize user-locked A–Z teaching song.

Series-level spaced retrieval có thể dùng mixed-order recall ở session sau để kiểm tra identity thay vì chỉ chain memory.

### 29.35. Tonal / Harmonic Stability

Core learning section nên giữ tonal center rõ và harmonic grammar đơn giản:

- diatonic harmony;
- cadence predictable;
- harmonic change không quá dày dưới target word;
- tránh modulation/chromatic detour thường xuyên;
- harmonic contrast ưu tiên ở section boundary thay vì mỗi letter.

Harmonic novelty cũng tính vào **Novelty Budget**. Nếu melody motif giống nhau nhưng chord/background đổi quá mạnh mỗi chữ, predictability vẫn bị phá.

---

## 30. Vocal identity và delivery

### 30.1. Vocal mặc định

Khuyến nghị:

```text
warm clear adult female lead
friendly teacher/caregiver quality
crisp consonants
stable vowels
minimal vibrato
almost no melisma
medium-light energy
```

Không cần cố tạo giọng em bé.

Mục tiêu là **một giọng người lớn thân thiện mà trẻ dễ nghe và bắt chước**.

### 30.1.1. Adult-Model Accuracy Gate

Adult lead là pronunciation/prosody model. Không dùng intentional baby-talk, cute mispronunciation, sai lexical stress, swallow consonant hoặc stylized vowel trên learning target.

Nếu generation phát âm sai một từ quen thuộc, coi đó là **critical modeling error** và repair/regenerate trước release.

```text
CORRECT MODEL > CUTE DELIVERY
```

Child/group response không được reinforce lỗi phát âm của lead.

### 30.2. Vocal upfront

Lead vocal phải là phần rõ nhất của mix.

Nhạc cụ không được che:

- initial consonant;
- target letter;
- target word;
- pause giữa repeated letters.

### 30.3. Backing vocals

Backing/choir chỉ dùng nếu thật sự có ích.

Nếu dùng:

- volume thấp hơn lead;
- không hát khác lyric;
- không chồng lên target letter khiến âm bị mờ;
- không biến thành crowd/gang vocal.

### 30.4. Call-and-response

Call-and-response là **preferred participation tool** cho chorus, refrain hoặc Round 2 khi nó không làm pronunciation rối.

Ví dụ concept:

```text
Lead: A ... A ...
Response: Apple!
```

Hoặc giữ một lead vocal duy nhất nhưng viết syntax như call-and-response để trẻ ngoài màn hình có thể tự đáp.

Không bắt buộc choir/group vocal trong generation; **participation design quan trọng hơn việc AI thật sự tạo nhiều singer**.

### 30.5. Voice consistency xuyên cả series

Nếu provider hỗ trợ saved voice profile hoặc một cơ chế giữ vocal identity, nên reuse cùng một adult lead identity cho toàn bộ series. Với Suno hiện tại, **Voices** là entry point mới trong Create; Style Personas vẫn có thể nằm trong Voices, nên workflow không nên hard-code UI cũ chỉ gọi là Persona.

Mục tiêu:

- A–Z không đổi singer ngẫu nhiên;
- pronunciation character ổn định;
- timbre quen thuộc với trẻ;
- intro/outro và các episode khác nghe như cùng một brand.

Khi đã dùng một voice/persona profile có identity rõ, giảm bớt descriptor trùng lặp trong Style Prompt; dành prompt budget cho tempo, instrumentation và delivery của bài hiện tại.

Ưu tiên **adult caregiver/teacher-like voice identity** cho educational series; không cần giả lập giọng trẻ em để bài hát phù hợp trẻ.

---

## 31. Suno / AI music Style Prompt architecture

Khi provider dùng một Style Box tương tự Suno, ưu tiên cấu trúc:

```text
[VOCAL IDENTITY].
[GENRE + TEMPO/FEEL].
[KEY INSTRUMENTS].
[PROSODY / DELIVERY].
[MIX PRIORITY].
```

### 31.1. Vocal identity đặt sớm

Ví dụ:

```text
Warm clear adult female lead, teacher-like delivery, crisp consonants, minimal vibrato.
```

Sau đó mới mô tả genre/instrument.

### 31.2. Mỗi descriptor phải có nhiệm vụ riêng

Tốt:

```text
warm female lead
nursery rhyme
80 BPM
xylophone
ukulele
light percussion
vocals upfront
```

Không tốt:

```text
warm, sweet, lovely, adorable, cute, friendly, charming, delightful...
```

Đó là synonym-pile và làm prompt loãng.

### 31.3. Genre không cần quá nhiều

Thông thường chỉ cần một music family chính và tối đa một vài modifier:

```text
preschool nursery rhyme
light acoustic children's music
educational sing-along
```

Không trộn 5–8 genre chỉ để prompt trông chi tiết.

### 31.4. Instrumentation chọn ít nhưng rõ

Ưu tiên 2–4 instrument chính:

```text
piano
xylophone
soft bells
ukulele
```

Percussion là support, không phải feature chính.

### 31.5. Intro phải ngắn

Long intro làm chậm lesson và có thể khiến vocal vào muộn.

Ưu tiên:

```text
very short intro
vocals enter quickly
```

hoặc bắt đầu gần như ngay bằng learning target.

### 31.6. Exclude Styles / negative guidance

Nếu provider hỗ trợ negative/exclude field, chỉ dùng khi thật sự cần.

Khuyến nghị preschool ABC:

```text
no rap
no heavy drums
no aggressive bass
no vocal runs
```

Nếu vấn đề là group vocal ngoài ý muốn, có thể thử:

```text
no crowd vocals
no gang vocals
```

Không viết danh sách 15–20 thứ bị cấm; negative prompting cũng có thể bị loãng.

### 31.7. Không dùng tên artist/band thật trong Style Prompt

Mô tả âm thanh thay vì viết:

```text
“in the style of [artist]”
```

Ví dụ dùng:

```text
bright preschool nursery rhyme, warm acoustic arrangement, clear teacher-like female vocal
```

thay vì tên một nghệ sĩ cụ thể.

---

## 32. Section tags và performance cues

Nếu AI music engine hỗ trợ structure tags, có thể dùng để ổn định cấu trúc.

Ví dụ:

```text
[Short Instrumental Intro]

[Verse 1 - clear playful]
...

[Verse 2 - clear playful]
...

[Outro - gentle]

[End]
```

### 32.1. Structure tag và lyric là hai loại khác nhau

Lyrics Box chỉ nên chứa:

- text thật sự cần hát;
- structure tags mà engine hiểu.

Không đặt prose production note trong Lyrics Box nếu engine có nguy cơ hát luôn nó.

### 32.2. Performance cue phải ngắn

Dùng:

```text
[Verse - clear gentle]
```

Không dùng:

```text
[Verse - very sweet warm adorable playful slow clear emotional educational teacher voice with bells]
```

Một hoặc hai ý delivery là đủ.

### 32.3. Không bắt buộc tag cho từng chữ nếu gây prompt fatigue

Nếu 26 block A–Z được generate cùng một lần, không cần nhồi 26 cue phức tạp.

Có thể:

- chia thành group;
- giữ cùng performance cue;
- hoặc generate theo block rồi ghép.

Rule:

> **Structure should clarify the song, not become another source of noise.**

### 32.4. Ending rõ

Nếu provider hỗ trợ `[End]`, nên dùng khi cần tránh model tiếp tục tự thêm verse/lyric sau Z.

---

## 33. Refinement passes dành riêng cho children's lyrics

Sau draft đầu tiên, AI chạy tối đa ba refinement pass.

### Pass 1 — Tighten

Mục tiêu:

```text
remove filler
remove redundant words
shorten awkward phrases
keep one learning idea per line
```

Không thêm nội dung mới nếu không cần.

### Pass 2 — Educational Clarity

Kiểm tra:

- target letter có nổi bật không;
- target word có đúng không;
- có vocabulary phụ gây nhiễu không;
- grammar có tự nhiên không;
- repetition có đang dạy hay chỉ đang kéo thời lượng;
- có vô tình đổi mapping không.

### Pass 3 — Flow & Ear

Kiểm tra bằng read-aloud/singability test:

- natural stress;
- phrase length;
- consonant clarity;
- pause;
- transition;
- target BPM;
- khả năng trẻ bắt chước.

### Early exit

Nếu một pass không tìm thấy thay đổi hữu ích, không ép phải sửa tiếp.

> **Do not refine a simple children's lyric into a complicated adult song.**

---

## 34. AI-writing anti-patterns trong nhạc thiếu nhi

Nhạc thiếu nhi vẫn có thể nghe rất “AI” nếu AI tự động thêm các câu chung chung.

Hạn chế:

```text
Come on everyone, let's sing today!
Learning is fun in every way!
Shine so bright!
Reach for the sky!
Let's go on a magical journey!
```

Không phải các câu này luôn sai, nhưng nếu chúng không phục vụ learning target thì đó là filler.

### 34.1. Không thêm motivational cliché để “làm bài hát hay hơn”

ABC song không cần một emotional arc kiểu:

```text
struggle -> believe -> triumph
```

Mục tiêu là recognition + repetition + enjoyment.

### 34.2. Không over-write

Nếu lyric hiện tại đã làm đúng nhiệm vụ bằng 4 dòng, không biến thành 8–12 dòng chỉ để nghe “creative”.

### 34.3. Full-song rhyme phải được planned, nhưng không được forced

Với một **full preschool song** cần catchy/memorable, rhyme không nên xuất hiện ngẫu nhiên. AI phải chọn rhyme scheme theo section và kiểm tra consistency.

Default rhyme-forward:

```text
4 lines -> AABB
6 lines -> AABBCC
2-line refrain -> AA
```

Có thể dùng ABAB hoặc near-rhyme nếu tự nhiên hơn.

Thứ tự ưu tiên vẫn là:

```text
correct word
> pronunciation
> prosody
> child repeatability
> hook clarity
> purposeful repetition
> natural rhyme
> perfect rhyme
```

Không đổi target vocabulary, bẻ grammar, thêm filler hoặc dùng vocabulary khó chỉ để kiếm perfect rhyme.

**Rhyme is a memory tool, not the learning target.**

---

## 35. Pre-generation gates cho AI composer

Trước khi gửi sang music generator, chạy các gate sau.

### Gate 1 — Mapping Integrity

PASS khi:

- mọi target letter đúng;
- mọi target word đúng mapping đã khóa;
- không tự thay word.

### Gate 2 — Lyric Integrity

PASS khi:

- không có placeholder;
- không có instruction bị lẫn vào lyric;
- không có lyric ngoài lesson không được yêu cầu;
- template đúng mode hiện tại.

### Gate 3 — Prosody

PASS khi:

- không có obvious wrong stress;
- không cần hát quá nhanh;
- target letter/word có vị trí nhấn rõ.

### Gate 4 — Pronunciation

PASS khi:

- letter-name/phonics mode nhất quán;
- locale nhất quán;
- pronunciation risks đã resolve;
- Generation Lyrics đã áp dụng workaround cần thiết.

### Gate 5 — Pacing

PASS khi:

- letter phrase có cadence hoàn chỉnh;
- repeated letters, nếu dùng, có không gian tách nhau;
- line có thể chia thành phraselets tự nhiên;
- section không quá dài/dày khiến AI buộc phải rush, compress hoặc skip;
- không có fixed-duration requirement.

### Gate 6 — Style Prompt

PASS khi:

- vocal identity rõ;
- music family rõ;
- tempo/feel rõ;
- key instruments rõ;
- vocal priority rõ;
- không synonym-pile;
- không có tên artist/band thật.

### Gate 7 — Child Suitability

PASS khi:

- language phù hợp 2–6 tuổi;
- không có chủ đề nguy hiểm/người lớn;
- không có hình ảnh hoặc wording gây sợ không cần thiết;
- không có slang khó hiểu;
- không có instruction khuyến khích hành vi nguy hiểm.

### Gate 8 — Output Completeness

PASS khi có đủ output bắt buộc:

- Canonical Lyrics;
- Generation Lyrics;
- Style Prompt;
- Pronunciation Notes nếu cần;
- QC result.

Nếu bất kỳ gate Critical nào FAIL:

```text
STATUS = NOT READY
```

Không được tự tuyên bố ready.

---

## 36. Severity model

Dùng ba mức:

### CRITICAL

Phải sửa trước generation.

Ví dụ:

- sai letter;
- sai target word;
- tự đổi mapping;
- pronunciation sai/rủi ro chưa resolve;
- repeated letters bị nối thành một cụm;
- instruction bị hát như lyric;
- nội dung không phù hợp trẻ;
- real artist name trong Suno style prompt;
- letter-name/phonics mode bị trộn;
- section structure buộc singer/model phải rush, compress hoặc skip;
- mega-verse A–Z chưa được chunk trước generation.

### WARNING

Ảnh hưởng chất lượng nhưng có thể test generation.

Ví dụ:

- phrase hơi dày hoặc thiếu breathing space nhưng vẫn có thể sửa bằng phrasing;
- tổng lyric ~700–800 words cần caution;
- tổng lyric >~800 words nếu vẫn định single-generation;
- Round 2 còn quá giống/paraphrase Round 1;
- instrument hơi nhiều;
- prompt hơi dày descriptor;
- rhyme hơi gượng;
- transition chưa mượt.

### INFO

Gợi ý tùy chọn.

Ví dụ:

- alternative word;
- alternate instrument;
- creative variation;
- optional call-and-response.

---

## 37. Output contract cho AI songwriting skill

Output mặc định là **staged theo dependency**, không phải một giant response.

### Phase A — trước Mapping Lock

```text
# THEME PLAN
Theme:
Theme Scope: strict / guided / open
Mapping Authority: user-locked / project-locked / generated
Audience / Age Band:
Language / Locale:
Mode: Letter Name / Phonics
Educational Goal:

# PROPOSED A-Z MAPPING
A -> ...
...
Z -> ...

# MAPPING QC / WARNINGS
...

Mapping State: PROPOSED / REVIEWED / LOCKED
```

Nếu generated mapping vẫn `PROPOSED`, dừng ở đây. Không sinh full lyric hay A-Z image prompts trước khi lock.

### Phase B — chỉ sau Mapping Lock

```text
# SONG PLAN
Theme Scope: strict / guided / open
Mapping Authority: user-locked / project-locked / generated
Theme:
Audience:
Age Band: 2–3 / 4–6 / mixed 2–6
Participation Layer: adult-lead / child-response split
Curriculum Stage: 1 / 2 / 3 / 4 / 5 / custom
Learning Objective Map: Lexical-Semantic / Verbatim-Sequence / Retrieval-Action / Phonics
Lexical Novelty Tiers: A / B / C by target
Language/Locale:
Mode: Letter Name / Phonics
Phrase Profile: sung words / syllables / phraselets / bars (guideline)
Section Chunking:
Round Structure: one-round / two-round
Tempo/Feel:
Macro Hook Motif:
Round 1 Letter Motif:
Prosodic Motif Variants:
Round 2 Action/Response Motif:
Rhythmic Pocket:
Response Space:
Text-Tune Binding:
Lexical-Novelty Melodic Treatment:
Child-Echo Tessitura:
Early Hook Exposure:
Target-Word Mix Window:
Semantic vs Mnemonic Rhyme Budget:
Four-Beat Participation Frame:
Novelty Budget:
Sequence Boundary Plan:
Retrieval Beat Plan:
Target-Word Sustain Plan:

# LEARNING BLOCK MANIFEST
canonical per-letter metadata

# SECTION MANIFEST
section objective / letters / rhyme / motif / response frame

# LOCKED MAPPING
A -> ...
B -> ...
...

# MAPPING QUALITY / WARNINGS
...

# OBJECT IMAGE PROMPT PACK
A -> prompt for locked A object
...
Z -> prompt for locked Z object

# CANONICAL LYRICS
...

# GENERATION LYRICS
...

# PRONUNCIATION NOTES
...

# STYLE PROMPT
...

# EXCLUDE STYLES
...

# QC REPORT
Mapping: PASS/FAIL
Mapping Quality: PASS/WARN
Learning Block Manifest Integrity: PASS/FAIL
Section Manifest Integrity: PASS/FAIL
Prosody: PASS/FAIL
Pronunciation: PASS/FAIL
Structure/Density: PASS/WARN/FAIL
Pacing: PASS/WARN/FAIL
Round Differentiation: PASS/WARN/N/A
Mixed-Age Layering: PASS/WARN/N/A
Four-Beat Participation Frame: PASS/WARN/N/A
Novelty Budget: PASS/WARN/FAIL
Stress Verification: PASS/FAIL
Prosodic Motif Variants: PASS/WARN/FAIL
Sequence Boundary Clarity: PASS/FAIL
Retrieval Beat: PASS/WARN/N/A
Target-Word Sustain: PASS/FAIL
Generation Length Risk: LOW / CAUTION / HIGH
Child suitability: PASS/FAIL
Prompt quality: PASS/WARN/FAIL
Learning Objective Fit: PASS/WARN/FAIL
Lexical Novelty Handling: PASS/WARN/FAIL
Curriculum Load/Progression: PASS/WARN/FAIL
Adaptive Retrieval Plan: PASS/WARN/N/A
Letter Difficulty Handling: PASS/WARN/FAIL
Primary/Secondary Cue Budget: PASS/WARN/FAIL
Out-of-Sequence Identity Readiness: PASS/WARN/N/A
Semantic Clarity vs Rhyme: PASS/WARN/FAIL
Text-Tune Binding: PASS/WARN/FAIL
Lexical-Novelty Melodic Treatment: PASS/WARN/FAIL
Child-Echo Tessitura: PASS/WARN/FAIL
Early Hook Exposure: PASS/WARN/FAIL
Target-Word Mix Window: PASS/WARN/FAIL
Adult-Model Accuracy: PASS/FAIL
Multimodal Congruence: PASS/WARN/FAIL
Repetition Function: PASS/WARN/FAIL
Tonal / Harmonic Stability: PASS/WARN/FAIL
Internal Design Readiness Score: __ / 100
Validation Level: L0 / L1 / L2 / L3
Design Status: REWORK / READY_FOR_GENERATION_TEST
Audio Status: PENDING_AUDIO / PASS / FAIL
Release Status: NOT_VALIDATED / READY / NOT_READY
```

### 37.1. Internal Design Readiness Score

Dùng score nội bộ như **production heuristic**, không phải thang đo khoa học đã validate:

```text
15  Educational correctness + objective-mode fit
15  Pronunciation + lexical stress + prosody
10  Mapping quality + lexical novelty handling
10  Semantic clarity / target-word intelligibility
10  Hook memorability + child repeatability
10  Rhythmic pocket + motif stability + text-tune binding
10  Retrieval/action/response-space quality
10  Section density + generation reliability
 5  Visual-semantic/action alignment
 5  Series/voice/brand consistency
---
100
```

Hard fail override score.

```text
<85   REWORK
85–89 PROMISING, NOT READY
90–94 READY FOR GENERATION TEST
95–100 HIGH-CONFIDENCE DESIGN DRAFT
```

Text/design score không đồng nghĩa release-ready.

Status taxonomy:

```text
DESIGN STATUS  = REWORK / READY_FOR_GENERATION_TEST
AUDIO STATUS   = PENDING_AUDIO / PASS / FAIL
RELEASE STATUS = NOT_VALIDATED / READY / NOT_READY
```

Ở L0, mọi check chỉ có thể biết sau khi nghe audio phải ghi `PENDING AUDIO`, không được tự chấm PASS.

### L1 Generated-Audio Audit

Nghe generation **không nhìn lyric sheet ở lượt đầu** và kiểm tra:

```text
TARGET INTELLIGIBILITY  target word nghe ra ngay không?
LETTER BOUNDARIES       repeated/sequential letters có tách rõ không?
PROSODY                 lexical stress có sống sót trong melody thật không?
HOOK STABILITY          hook lặp có giữ identity không?
RESPONSE SPACE          gap/retrieval beat có thật sự nghe được không?
DENSITY                 có rush/compress/skip không?
MIX WINDOW              onset target có bị clap/bell/backing vocal che không?
```

Nếu chỉ đọc lyric mới hiểu target word thì L0 PASS chưa đủ.

Validation levels:

```text
L0 = text/spec audit
L1 = generated-audio audit
L2 = naive listener / parent proxy
L3 = intended-age child observation/test when available
```

### 37.2. Controlled A/B Generation

Khi chưa chắc một design decision, giữ **same locked lyric** và đổi một biến chính giữa A/B:

- tempo;
- hook contour;
- response gap;
- arrangement density;
- vocal delivery.

Không đổi nhiều biến cùng lúc rồi kết luận nguyên nhân. So sánh target intelligibility, hook recall, echoability, boundary clarity, pacing và parent-listenability.

### 37.3. Series-Level Spaced Retrieval

Không nhồi toàn bộ repetition vào một track. Với series, tái cue target ở episode/session sau:

```text
TEACH
-> RETRIEVE LATER
-> RETRIEVE AGAIN IN A LATER SESSION
```

Không dùng một con số repetition cố định như luật; successful retrieval qua nhiều session quan trọng hơn massed repetition trong một lần.

### 37.4. Rule Regression Test Suite

Sau thay đổi lớn vào method/skill, chạy mental regression suite này:

```text
BOOK           -> 1-syllable motif variant
APPLE          -> initial-stress 2-syllable variant
ERASER         -> middle-stress variant: e-RA-ser
UMBRELLA       -> middle-stress variant: um-BREL-la
HIGHLIGHTER    -> initial-stress 3-syllable variant
XYLOPHONE      -> Letter-Name mode OK; X phonics caveat required
QUILL          -> likely lower-familiarity tier for younger preschoolers
RAIN / AGAIN   -> không assume perfect en-US rhyme
READ / TEAR / CLOSE -> pronunciation/homograph handling required
L-M-N-O-P      -> từng letter boundary phải nghe riêng
26-line verse  -> FAIL / split
Two A–Z rounds -> teaching then retrieval/action, không twin paraphrase
Two A–Z visual rounds -> 26 canonical assets có thể tạo 52 letter instances
Same chorus text -> same macro-hook motif
```

Rule change làm các expected result này fail phải được review lại.

### 37.5. Post-Generation Repair Protocol

Nếu provider hỗ trợ section-level editing/replacement, ưu tiên sửa cục bộ sau khi đã xác định đúng failure.

Rule:

```text
DIAGNOSE FIRST
CHANGE ONE PRIMARY VARIABLE
REGENERATE LOCALLY WHEN POSSIBLE
RE-AUDIT
```

Không sửa đồng thời lyric + BPM + instrumentation + vocal identity + section structure nếu chưa biết nguyên nhân. Làm vậy mất khả năng biết thay đổi nào thực sự cải thiện output.

Giữ các section đã đạt pronunciation, hook và prosody tốt. Chỉ thay phần lỗi khi workflow cho phép.

### 37.6. Không cần luôn hiển thị tất cả debug detail

AI có thể giữ các pass trung gian nội bộ và chỉ trả:

- final song package;
- warnings thực sự cần user quyết định;
- final QC status.

Không cần làm user đọc toàn bộ chain-of-thought hoặc reasoning nội bộ.

### 37.7. Evidence Calibration Loop

Pre-generation phải dùng `.claude/skills/abc-kids-music-composer/LINT_SPEC.md` để tách deterministic/heuristic/audio-only checks. Khi thay rule, dùng `RULE_GOVERNANCE.md` + `EVIDENCE_MAP.md` để giữ provenance/scope. Khi đã có nhiều generation/test result, dùng `.claude/skills/abc-kids-music-composer/EVALUATION_PROTOCOL.md` để log và aggregate:

- mispronunciation theo stress class;
- rush/skip theo section density;
- clarity theo Lexical Novelty Tier;
- retrieval-gap success theo age band;
- hook fatigue theo repetition count;
- mix masking theo arrangement type.

Rule update policy:

```text
1 generation bất thường -> local repair
pattern lặp lại nhiều bài -> xem xét heuristic
hard educational gate     -> không đổi chỉ vì model generation thích khác
```

Sau khi thay heuristic, chạy `REGRESSION_CASES.md` trước khi coi rule mới stable.

---

## 38. Master composer instruction

Khi AI phải tự quyết giữa hai lựa chọn, dùng hierarchy sau:

```text
EDUCATIONAL CORRECTNESS + LEARNING-OBJECTIVE FIT
> VERIFIED PRONUNCIATION / LEXICAL STRESS
> SEMANTIC CLARITY / TARGET-WORD INTELLIGIBILITY
> NATURAL PROSODY
> AGE-APPROPRIATE PARTICIPATION
> CHILD REPEATABILITY
> TARGET / LETTER BOUNDARY CLARITY
> PHRASE SINGABILITY / BREATHING SPACE
> RHYTHMIC PREDICTABILITY / TEXT-TUNE BINDING
> RETRIEVAL OPPORTUNITY / RESPONSE SPACE
> SECTION DENSITY / GENERATION RELIABILITY
> PREDICTABLE TURN-TAKING
> NOVELTY CONTROL
> NATURAL RHYME
> MELODY
> DURATION SYMMETRY
> PRODUCTION COMPLEXITY
```

Master instruction bằng tiếng Anh để dùng trực tiếp cho AI composer:

```text
Write for a preschool learner, not for an adult music critic. For theme-first projects, define the theme and lock the A-Z object mapping before writing full lyrics or image prompts; downstream artifacts must never silently substitute a different object. After mapping lock, classify each section by learning objective: lexical-semantic teaching, verbatim/sequence memory, retrieval/action, or phonics. Apply different rhyme and melody priorities to each objective instead of optimizing every section the same way. Classify target words by lexical familiarity and use teach-then-sing, narrow-contour treatment for low-familiarity words. Preserve the supplied learning targets exactly. Make every target letter and vocabulary word easy to hear, imitate and remember. Natural pronunciation and word stress must survive the melody. Treat one letter as one complete singable phrase, not as a fixed number of seconds. Use low lyric density, natural internal phraselets, breathing space, a narrow memorable melody and a steady gentle groove. If a phrase does not fit, add bars or simplify wording instead of rushing the vocal. Never place all 26 letter lines in one mega-verse; chunk A–Z into short musical sections. If using two complete A–Z rounds, make Round 1 lexical-semantic teaching, keep refrain/chorus as stable verbatim/sequence memory, and make Round 2 retrieval/action with a brief cue gap before confirmation so the repetition has a different learning function rather than becoming a twin verse. Prefer local singability over arbitrary global word-count caps, but treat very long drafts (especially >~800 sung words in a single Suno-style generation) as a generator-capacity risk that must be handled. Prefer clarity over rhyme and a simple vocal-forward arrangement over production complexity. Define a reusable melodic motif contract, keep paired rhyme lines in the same rhythmic pocket, validate rhyme in the declared locale, and leave real response space after calls so a child can participate before knowing the full lyric. For mixed ages 2–6, separate the adult information layer from the child participation layer. Use predictable turn-taking, preferably a stable four-beat call/response grammar where appropriate, and control novelty so each new letter does not also trigger unnecessary melodic, rhythmic, vocal, and instrumentation changes. Never silently change the user's mapping or add unrelated lyrics. Before finalizing, review educational correctness, prosody, pronunciation, hook memorability, rhythmic predictability, response space, section density, pacing, child suitability and generation-prompt quality. If a critical issue remains, mark the song NOT READY rather than hiding the problem.
```

---

## 39. Rule cuối cùng cho AI music generation

> **A good preschool song is not the one with the most ideas. It is the one where the child can clearly hear, understand, repeat and remember the intended idea.**

Với ABC series:

> **ONE LETTER = ONE COMPLETE SINGABLE PHRASE.**

> **SPREAD, DO NOT COMPRESS.**

> **ADD MORE SECTIONS, NOT LONGER SECTIONS.**

> **THE MUSIC SERVES THE LETTER. THE LETTER DOES NOT SERVE THE MUSIC.**
