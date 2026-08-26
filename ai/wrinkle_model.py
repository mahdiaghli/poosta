"""Optional real wrinkle-segmentation model (FFHQ-Wrinkle U-Net).

This is a genuine, verified pretrained model, not fabricated:
  repo:   https://github.com/labhai/ffhq-wrinkle-dataset  (cloned into
          datasets/skin/wrinkles/ffhq-wrinkle/ -- code only, ~2MB)
  weights: download stage2_unet.pth from the repo's Google Drive link
           (https://drive.google.com/drive/folders/1Z4EagkkhdIGxDjYrxM7Gkr6sfpvXUUTs)
           and place at models/skin/wrinkles/stage2_unet.pth
  license: CC BY-NC-SA 4.0 (NON-COMMERCIAL). Do not ship in a paid product
           without contacting the authors for a commercial license.

CAVEAT (read before trusting this in production): the model expects a
4-channel input (RGB + a "texture map" the authors generate with their own
CV method for FFHQ images). That exact texture-map generator isn't published
for arbitrary new photos, so here we substitute our own Canny/Laplacian edge
map as the 4th channel -- a reasonable approximation of "high-frequency
texture", not a guaranteed match to their training distribution. Treat this
integration as an unverified best-effort upgrade, not a validated pipeline.
If it fails or the checkpoint is missing, callers must fall back to the
classical heuristic in skin_ai_server.py -- this module never raises.
"""
from __future__ import annotations
import sys
from pathlib import Path
import numpy as np
import cv2

ROOT = Path(__file__).resolve().parents[1]
REPO_DIR = ROOT / "datasets/skin/wrinkles/ffhq-wrinkle"
CKPT_PATH = ROOT / "models/skin/wrinkles/stage2_unet.pth"

_model = None
_load_attempted = False


def _try_load():
    global _model, _load_attempted
    _load_attempted = True
    if not CKPT_PATH.exists() or not REPO_DIR.exists():
        return None
    try:
        import torch
        sys.path.insert(0, str(REPO_DIR))
        from unet.unet_model import UNet  # type: ignore
        net = UNet(n_channels=4, n_classes=2)
        state = torch.load(str(CKPT_PATH), map_location="cpu")
        net.load_state_dict(state.get("state_dict", state))
        net.eval()
        _model = net
        return net
    except Exception:
        _model = None
        return None


def wrinkle_coverage_ratio(face_bgr: np.ndarray) -> float | None:
    """Returns fraction of face pixels the model marks as wrinkle, or None
    if the optional model isn't available (caller should use the classical
    heuristic instead)."""
    if not _load_attempted:
        _try_load()
    if _model is None:
        return None
    try:
        import torch
        size = 1024
        rgb = cv2.cvtColor(cv2.resize(face_bgr, (size, size)), cv2.COLOR_BGR2RGB)
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        texture = cv2.Canny(cv2.GaussianBlur(gray, (3, 3), 0), 25, 60)  # substitute texture channel, see module docstring
        x = np.concatenate([rgb.astype(np.float32) / 255.0, texture[:, :, None].astype(np.float32) / 255.0], axis=2)
        x = torch.from_numpy(x.transpose(2, 0, 1)).unsqueeze(0)
        with torch.no_grad():
            out = _model(x)
            pred = out.argmax(dim=1).squeeze(0).numpy()
        return float((pred == 1).mean())
    except Exception:
        return None
