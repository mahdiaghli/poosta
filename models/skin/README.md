# Local skin model

مدل خودت را اینجا قرار بده.

پیشنهاد:
- `model.onnx` برای مدل ONNX
- یا `model.pt` / `model.pth` برای PyTorch
- `labels.json` برای برچسب‌ها

نقطه اتصال فعلی:
`src/services/skinAnalysisService.ts` -> `heuristicAnalyze()`

برای مدل واقعی، inference را در همین سرویس یا یک runner سمت سرور جایگزین کن. وزن مدل را داخل `src/` یا `public/` نگذار.
