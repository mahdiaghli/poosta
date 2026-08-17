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

وزن‌های مدل را داخل bundle فرانت‌اند قرار ندهید.
