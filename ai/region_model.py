"""Optional image-level classifier for oily / dry / enlarged-pores / redness / wrinkles
(models/skin/regions/best.pth from train_severity.py on the region_attributes CSV).

Returns {label: probability} or None if the checkpoint is missing. Never raises.
"""
from __future__ import annotations

from pathlib import Path
import numpy as np
import cv2

ROOT = Path(__file__).resolve().parents[1]
CKPT_PATH = ROOT / "models/skin/regions/best.pth"

_model = None
_cols: list[str] = []
_binary = True
_load_attempted = False

COL_TO_METRIC = {
    "Oily-Skin": "oiliness",
    "Dry-Skin": "hydration",
    "Enlarged-Pores": "pores",
    "Skin-Redness": "redness",
    "Wrinkles": "fineLines",
}


def _try_load():
    global _model, _cols, _binary, _load_attempted
    _load_attempted = True
    if not CKPT_PATH.exists():
        return None
    try:
        import torch
        from torch import nn
        from torchvision import models as tv_models
        ckpt = torch.load(str(CKPT_PATH), map_location="cpu", weights_only=False)
        _cols = list(ckpt["label_cols"])
        _binary = bool(ckpt.get("binary", True))
        net = tv_models.resnet18(weights=None)
        net.fc = nn.Linear(net.fc.in_features, len(_cols))
        net.load_state_dict(ckpt["state_dict"])
        net.eval()
        _model = net
        return net
    except Exception as e:
        print(f"[region_model] failed to load {CKPT_PATH}: {type(e).__name__}: {e}")
        _model = None
        return None


def predict_region_probs(face_bgr: np.ndarray) -> dict[str, float] | None:
    if not _load_attempted:
        _try_load()
    if _model is None:
        return None
    try:
        import torch
        from torchvision import transforms
        from PIL import Image
        tf = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        rgb = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2RGB)
        x = tf(Image.fromarray(rgb)).unsqueeze(0)
        with torch.no_grad():
            logits = _model(x)
            probs = torch.sigmoid(logits) if _binary else logits.clamp(0, 1)
        vals = probs.squeeze(0).cpu().numpy().tolist()
        return {name: float(p) for name, p in zip(_cols, vals)}
    except Exception as e:
        print(f"[region_model] infer failed: {type(e).__name__}: {e}")
        return None


def region_probs_to_metrics(probs: dict[str, float]) -> dict[str, tuple[int, str]]:
    """Map class probabilities to (score, note). Presence of a concern lowers the score."""
    out: dict[str, tuple[int, str]] = {}
    for col, p in probs.items():
        metric = COL_TO_METRIC.get(col)
        if not metric:
            continue
        if metric == "hydration":
            continue  # RGB cannot measure water content; keep the neutral 50
        if p < 0.55:
            continue
        score = int(max(0, min(100, round(100 - p * 55))))
        out[metric] = (score, f"طبقه‌بند ناحیه ({col}, p={p:.2f})")
    return out
