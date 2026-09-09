# Poosta — Local Skin AI

React + TypeScript + Vite + Zustand + local Python AI. این نسخه برای اجرای مستقل از Supabase و Gemini آماده شده است.

## Run

```bash
npm install
npm run dev
npm run api
```

برای AI:

```bash
npm run ai:install
```

سپس یک دیتاست YOLO برای آکنه در `datasets/skin/acne` قرار دهید، مدل را fine-tune کنید و ONNX را در `models/skin/acne/best.onnx` بگذارید.

## AI architecture

```text
React/Vite
   ↓
/api/skin-analysis
   ↓
server.js
   ↓
Python + Ultralytics
   ↓
models/skin/acne/best.onnx
```

## OpenAI cloud analysis

`تحلیل ابری` is processed by the backend. Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` in `.env`; the key is never sent to the tablet. OpenAI is tried first, with Gemini and OpenRouter kept as fallbacks. ChatGPT Plus and OpenAI API billing are separate products, so a ChatGPT Plus subscription alone is not an API credential.

The server stores private scan assets under `data/scans/<date>/scan_<id>/`:

- `original.jpg`
- `annotations.json` containing scores, observations, bounding boxes, provider/model metadata, and review status
- `overlay.jpg` when boxes are available

Export the accumulated samples without starting training:

```bash
npm run dataset:export
```

Use `npm run dataset:export -- --reviewed-only` after human review. AI-generated annotations are pseudo-labels and should not be used as ground truth without review.

وزن‌های مدل را داخل bundle فرانت‌اند قرار ندهید.
