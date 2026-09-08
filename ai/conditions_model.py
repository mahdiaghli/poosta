"""Optional real multi-class lesion detector (models/skin/conditions/best.onnx).

Predict on the face crop (not the full frame) so hair, clothes, and studio
background cannot be scored as acne. Also drop huge boxes (cheek-sized
"acne" labels) and require most of each box to sit inside the face ROI.
"""
from __future__ import annotations

from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "models/skin/conditions/best.onnx"
PREDICT_IMGSZ = 960
# Val P-curve: acne FPs dominate below ~0.5; precision only reaches 1.0 near 0.93.
# 0.55 is the product floor so background texture is not shown as lesions.
PREDICT_CONF = 0.55
PREDICT_IOU = 0.55
MAX_DET = 30
# Fraction of the face box a lesion may cover. Larger = region/redness, not a lesion.
MAX_LESION_FACE_FRAC = 0.10
MAX_EYEBAG_FACE_FRAC = 0.28
MIN_BOX_INSIDE_FACE = 0.80

_LESION_NAMES = frozenset({
    "acne", "blackheads", "whiteheads", "dark-spots", "dark-spot",
    "pimple", "blackhead", "whitehead",
})

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


def _clip_roi(image: np.ndarray, roi: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    h, w = image.shape[:2]
    x1, y1, x2, y2 = roi
    x1, y1 = max(0, int(x1)), max(0, int(y1))
    x2, y2 = min(w, int(x2)), min(h, int(y2))
    if x2 <= x1 + 8 or y2 <= y1 + 8:
        return 0, 0, w, h
    return x1, y1, x2, y2


def _is_lesion_label(name: str) -> bool:
    key = name.strip().lower().replace("_", "-").replace(" ", "-")
    return any(k in key for k in _LESION_NAMES) or key in _LESION_NAMES


def _box_ok(
    x1: float, y1: float, x2: float, y2: float,
    face: tuple[int, int, int, int],
    label: str,
) -> bool:
    fx1, fy1, fx2, fy2 = face
    bw, bh = max(0.0, x2 - x1), max(0.0, y2 - y1)
    box_area = bw * bh
    if box_area < 16:
        return False
    ix1, iy1 = max(x1, fx1), max(y1, fy1)
    ix2, iy2 = min(x2, fx2), min(y2, fy2)
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    if inter / box_area < MIN_BOX_INSIDE_FACE:
        return False
    face_area = max(1.0, (fx2 - fx1) * (fy2 - fy1))
    frac = box_area / face_area
    if "eyebag" in label.lower().replace(" ", "-"):
        return frac <= MAX_EYEBAG_FACE_FRAC
    if _is_lesion_label(label):
        return frac <= MAX_LESION_FACE_FRAC
    return frac <= MAX_LESION_FACE_FRAC


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
        ox = oy = 0
        infer = image
        face_xyxy = None
        if roi is not None:
            x1, y1, x2, y2 = _clip_roi(image, roi)
            infer = image[y1:y2, x1:x2]
            ox, oy = x1, y1
            face_xyxy = (x1, y1, x2, y2)
            if infer.size == 0:
                return []
        result = _model.predict(
            source=infer, imgsz=imgsz, conf=conf, iou=PREDICT_IOU,
            max_det=MAX_DET, verbose=False,
        )[0]
        boxes = result.boxes
        if boxes is None or len(boxes) == 0:
            return []
        names = result.names
        cls_ids = boxes.cls.detach().cpu().numpy().astype(int).tolist()
        confs = boxes.conf.detach().cpu().numpy().tolist()
        xyxys = boxes.xyxy.detach().cpu().numpy().tolist()
        face_for_frac = face_xyxy or (0, 0, image.shape[1], image.shape[0])
        out: list[dict] = []
        for cid, c, xyxy in zip(cls_ids, confs, xyxys):
            if c < conf:
                continue
            name = names.get(cid, str(cid)) if isinstance(names, dict) else names[cid]
            px1, py1, px2, py2 = xyxy[0] + ox, xyxy[1] + oy, xyxy[2] + ox, xyxy[3] + oy
            if not _box_ok(px1, py1, px2, py2, face_for_frac, str(name)):
                continue
            out.append({
                "label": str(name),
                "x": int(round(px1)),
                "y": int(round(py1)),
                "w": int(round(max(1, px2 - px1))),
                "h": int(round(max(1, py2 - py1))),
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
