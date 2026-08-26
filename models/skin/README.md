# Skin AI models

`models/skin/acne/best.onnx` — trained YOLO acne model (see SKIN_AI_SETUP.md).

`models/skin/wrinkles/stage2_unet.pth` — OPTIONAL real pretrained wrinkle
segmentation checkpoint (FFHQ-Wrinkle, CC BY-NC-SA 4.0 / non-commercial).
Download from the Google Drive link in `datasets/skin/wrinkles/ffhq-wrinkle/README.md`.
If absent, the server automatically falls back to a classical CV heuristic —
nothing breaks either way.

Dark spots, redness, texture, pores, oiliness stay classical CV (no model
file needed here — see SKIN_AI_SETUP.md for why no good public dataset
exists for these yet).
