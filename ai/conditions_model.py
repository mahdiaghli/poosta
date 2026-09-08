"""Optional real multi-class lesion detector (models/skin/conditions/best.onnx).

Class names come from the model. Predict at the same imgsz used in training
(default 960) and a higher confidence floor than Ultralytics' 0.25 default —
val F1 peaked near 0.12 but precision at that threshold is unusable in product.
"""
from __future__ import annotations

from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "models/skin/conditions/best.onnx"
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
        print(f"[conditions_model] failed to load {MODEL_PATH}: {type(e).__name__}: {e}")
        _model = None
    return _model


def _box_center_in_roi(xyxy, roi: tuple[int, int, int, int]) -> bool:
    x1, y1, x2, y2 = xyxy
    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
    rx1, ry1, rx2, ry2 = roi
    return rx1 <= cx <= rx2 and ry1 <= cy <= ry2


def list_condition_boxes(
    image: np.ndarray,
    conf: float = PREDICT_CONF,
    imgsz: int = PREDICT_IMGSZ,
    roi: tuple[int, int, int, int] | None = None,
) -> list[dict] | None:
    """Pixel boxes {label,x,y,w,h,conf,source} or None if model missing."""
    if not _load_attempted:
        _try_load()
    if _model is None:
        return None
    try:
        result = _model.predict(source=image, imgsz=imgsz, conf=conf, verbose=False)[0]
        boxes = result.boxes
        if boxes is None or len(boxes) == 0:
            return []
        names = result.names
        cls_ids = boxes.cls.detach().cpu().numpy().astype(int).tolist()
        confs = boxes.conf.detach().cpu().numpy().tolist()
        xyxys = boxes.xyxy.detach().cpu().numpy().tolist()
        out: list[dict] = []
        for cid, c, xyxy in zip(cls_ids, confs, xyxys):
            if roi is not None and not _box_center_in_roi(xyxy, roi):
                continue
            name = names.get(cid, str(cid)) if isinstance(names, dict) else names[cid]
            x1, y1, x2, y2 = xyxy
            out.append({
                "label": str(name),
                "x": int(round(x1)),
                "y": int(round(y1)),
                "w": int(round(max(1, x2 - x1))),
                "h": int(round(max(1, y2 - y1))),
                "conf": float(c),
                "source": "conditions",
            })
        return out
    except Exception as e:
        print(f"[conditions_model] list boxes failed: {type(e).__name__}: {e}")
        return None


def detect_conditions(
    image: np.ndarray,
    conf: float = PREDICT_CONF,
    imgsz: int = PREDICT_IMGSZ,
    roi: tuple[int, int, int, int] | None = None,
) -> dict[str, dict] | None:
    """Returns {class_name: {count, avg_conf}} or None if the model is missing.

    roi: if set, keep boxes whose center falls inside (x1,y1,x2,y2) in image pixels.
    """
    listed = list_condition_boxes(image, conf=conf, imgsz=imgsz, roi=roi)
    if listed is None:
        return None
    out: dict[str, dict] = {}
    for b in listed:
        entry = out.setdefault(b["label"], {"count": 0, "confs": []})
        entry["count"] += 1
        entry["confs"].append(b["conf"])
    for v in out.values():
        v["avg_conf"] = float(np.mean(v.pop("confs"))) if v["confs"] else 0.0
    return out
