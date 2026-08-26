"""Optional real pore segmentation model (models/skin/pores/best.onnx,
trained by ai/train_pores.py). Returns coverage ratio like wrinkle_model.py,
or None if unavailable -- caller falls back to the classical heuristic."""
from __future__ import annotations
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "models/skin/pores/best.onnx"

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
    except Exception:
        _model = None
    return _model


def pore_coverage_ratio(face_bgr: np.ndarray) -> float | None:
    if not _load_attempted:
        _try_load()
    if _model is None:
        return None
    try:
        result = _model.predict(source=face_bgr, imgsz=640, conf=0.25, verbose=False)[0]
        if result.masks is None or len(result.masks.data) == 0:
            return 0.0
        masks = result.masks.data.detach().cpu().numpy()  # (N, H, W) in [0,1]
        union = np.clip(masks.sum(axis=0), 0, 1)
        return float(union.mean())
    except Exception:
        return None
