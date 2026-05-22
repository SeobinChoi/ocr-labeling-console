# OCR Labeling Console

GitHub Pages로 배포하는 **OCR 검수 + SCM 라벨링 프론트엔드 prototype**입니다.

> Privacy rule: 이 저장소에는 UI 코드와 더미 샘플만 둡니다. 학생 시험지 이미지, 실제 학생 이름/점수/라벨 데이터는 public repo에 커밋하지 마세요.

## What it does now

- JSON/JSONL import
- OCR 후보 3개 비교: Apple/baseline, Qwen VLM, Qwen LoRA
- corrected text 편집
- teacher SCM 라벨 입력
- confidence / review reason 표시
- keyboard shortcuts
- localStorage autosave
- labels JSONL export
- GitHub Pages deploy workflow

## Local development

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

## GitHub Pages deployment

1. GitHub에 새 repo `ocr-labeling-console` 생성
2. 이 코드를 `main`에 push
3. Repo settings → Pages → Source: **GitHub Actions**
4. `.github/workflows/pages.yml`가 Vite build 결과를 Pages에 배포

예상 URL:

```text
https://<github-user>.github.io/ocr-labeling-console/
```

## Import JSONL schema

최소 필드 예시:

```json
{
  "id": "Haru_p02_l020",
  "exam_id": "WEP26SP4W4-F",
  "student_name": "Haru",
  "grade": "G1",
  "page_num": 2,
  "line_num": 20,
  "task_type": "F",
  "image_url": "https://signed-url-or-local-path",
  "apple_ocr": "do bore mark So you will fell bad",
  "qwen_ocr": "do home work So you will feel bad.",
  "qwen_lora_ocr": "do home work So you will fell bad.",
  "chosen_text": "do home work So you will fell bad.",
  "confidence": 0.58,
  "review_required": true,
  "reasons": ["engine_disagreement"]
}
```

The app also accepts common aliases such as `studentName`, `baseline_ocr`, `prediction`, `corrected_text`, and `ocr_confidence`.

## Export JSONL schema

Exported rows contain:

```json
{
  "id": "...",
  "exam_id": "...",
  "student_name": "...",
  "corrected_text": "...",
  "status": "verified",
  "teacher_structure": 3,
  "teacher_content": 3,
  "teacher_mechanics": 2,
  "reviewer_notes": "...",
  "reviewed_at": "..."
}
```

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| A | accept Apple/baseline OCR |
| Q | accept Qwen VLM OCR |
| L | accept Qwen LoRA OCR |
| S | save verified and move next |
| U | mark uncertain and move next |
| N / → | next item |
| P / ← | previous item |

## Recommended production architecture

```text
GitHub Pages frontend
  ↓
Supabase Auth
  ↓
Supabase DB: work queue, labels, reviewer progress
  ↓
Private object storage: images via signed URLs
  ↓
OCR backend on camel: Qwen/vLLM/LoRA execution
  ↓
Export scripts: golden OCR dataset + teacher-aligned SCM dataset
```

## Next implementation steps

- [ ] Supabase auth + table schema
- [ ] signed image URL support
- [ ] page-level view with line merge/split
- [ ] reviewer assignment/progress dashboard
- [ ] acceptance export: CER/WER, review ratio, SCM agreement
- [ ] backend connector for OCR job import
