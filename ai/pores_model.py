"""Optional real pore segmentation model (models/skin/pores/best.onnx)."""
from __future__ import annotations

from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "models/skin/pores/best.onnx"
PREDICT_IMGSZ = 960
PREDICT_CONF = 0.45

_model = None
_load_attempted = False


def _try_load():
    global _model, _load_attempted
    _load_attempted = True
    if not MODEL_PATH.exists():
        return None
    try:
        from ultralytics import YOLO
        _model = YOLO(str(MODEL_PATH))
    except Exception as e:
        print(f"[pores_model] failed to load {MODEL_PATH}: {type(e).__name__}: {e}")
        _model = None
    return _model


def pore_coverage_ratio(face_bgr: np.ndarray) -> float | None:
    if not _load_attempted:
        _try_load()
    if _model is None:
        return None
    try:
        result = _model.predict(source=face_bgr, imgsz=PREDICT_IMGSZ, conf=PREDICT_CONF, verbose=False)[0]
        if result.masks is None or len(result.masks.data) == 0:
            return 0.0
        masks = result.masks.data.detach().cpu().numpy()
        union = np.clip(masks.sum(axis=0), 0, 1)
        return float(union.mean())
    except Exception as e:
        print(f"[pores_model] predict failed: {type(e).__name__}: {e}")
        return None
