"""Optional real multi-class condition detector (models/skin/conditions/best.onnx,
trained by ai/train_conditions.py on your merged ardayemc + face_skin_problems
data). Class names come from the model itself (whatever merge_condition_datasets.py
produced) -- never hardcoded here, since Roboflow class spelling varies.

detect_conditions(image) -> {class_name: {"count": int, "avg_conf": float}} or
None if the model file isn't present yet. Never raises.
"""
from __future__ import annotations
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "models/skin/conditions/best.onnx"

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


def detect_conditions(image: np.ndarray, conf: float = 0.25) -> dict[str, dict] | None:
    if not _load_attempted:
        _try_load()
    if _model is None:
        return None
    try:
        result = _model.predict(source=image, imgsz=640, conf=conf, verbose=False)[0]
        boxes = result.boxes
        if boxes is None or len(boxes) == 0:
            return {}
        names = result.names
        cls_ids = boxes.cls.detach().cpu().numpy().astype(int).tolist()
        confs = boxes.conf.detach().cpu().numpy().tolist()
        out: dict[str, dict] = {}
        for cid, c in zip(cls_ids, confs):
            name = names.get(cid, str(cid)) if isinstance(names, dict) else names[cid]
            entry = out.setdefault(name, {"count": 0, "confs": []})
            entry["count"] += 1
            entry["confs"].append(c)
        for v in out.values():
            v["avg_conf"] = float(np.mean(v.pop("confs")))
        return out
    except Exception:
        return None
