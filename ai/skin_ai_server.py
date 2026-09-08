"""Local AI HTTP server. No cloud/API key required.

POST /analyze with JSON: {"imageDataUrl": "data:image/jpeg;base64,..."}

Metrics pipeline:
  - acne: trained YOLO detector (models/skin/acne/best.onnx) -- needs a dataset.
  - darkSpots, redness, texture, pores, fineLines, oiliness: classical
    computer-vision heuristics (color-space + edge/variance analysis) that
    need NO training dataset. They are self-referential: each face is
    compared to its OWN median skin tone/texture, not a fixed "ideal" skin
    color, specifically to avoid bias across skin tones.
  - hydration: intentionally left unmeasured (see SKIN_AI_SETUP.md) -- there
    is no reliable way to estimate skin hydration from an RGB photo; real
    products use a corneometer. Faking this would be worse than omitting it.

These CV heuristics are directional wellness signals, not clinical/diagnostic
measurements. See SKIN_AI_SETUP.md for what would be needed to replace each
with a trained model, and whether that's actually worth doing.
"""
from __future__ import annotations
import base64
import io
import json
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

# Local scratch files named code.py used to shadow the stdlib `code` module.
# MediaPipe -> TensorFlow -> pdb -> import code, then FaceMesh never loads.
_ROOT_EARLY = Path(__file__).resolve().parents[1]
sys.path = [
    p for p in sys.path
    if p not in ("", ".") and Path(p).resolve() not in (_ROOT_EARLY, Path(__file__).resolve().parent)
]
sys.path.insert(0, str(Path(__file__).resolve().parent))

import cv2
import numpy as np
from PIL import Image
from ultralytics import YOLO

from wrinkle_model import wrinkle_coverage_ratio  # optional real model, see ai/wrinkle_model.py
from conditions_model import list_condition_boxes, PREDICT_CONF, PREDICT_IMGSZ, _box_ok
from pores_model import pore_coverage_ratio  # optional real model, see ai/pores_model.py
from region_model import predict_region_probs, region_probs_to_metrics

try:
    import mediapipe as mp
    if not hasattr(mp, "solutions"):
        raise AttributeError(
            f"mediapipe {getattr(mp, '__version__', '?')} has no mp.solutions "
            "(v1 removed FaceMesh). Haar cascade will be used. "
            "Optional: pip install 'mediapipe>=0.10.14,<1'"
        )
    _MP_FACE = mp.solutions.face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1, refine_landmarks=False)
except Exception as e:
    _MP_FACE = None
    print(f"[startup] MediaPipe FaceMesh failed to load, falling back to Haar cascade. Reason: {type(e).__name__}: {e}")

ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = Path(os.getenv("POOSTA_ACNE_MODEL", ROOT / "models/skin/acne/best.onnx"))
HOST = os.getenv("POOSTA_AI_HOST", "127.0.0.1")
PORT = int(os.getenv("POOSTA_AI_PORT", "8788"))

_model = None
_face_cascade = None
_mp_lock = threading.Lock()
_predict_lock = threading.Lock()

# Metric weights mirror the frontend's METRIC_WEIGHTS (kept in sync manually).
# hydration is a constant 50 (not measured from RGB) so it must not move overallScore.
WEIGHTS = {"acne": 0.17, "oiliness": 0.10, "hydration": 0.0, "redness": 0.11,
           "pores": 0.10, "darkSpots": 0.12, "texture": 0.13, "fineLines": 0.11}

_ALLOWED_ANALYZE_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})


def get_model() -> YOLO:
    global _model
    if _model is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Custom acne model not found: {MODEL_PATH}. Train/export it first.")
        _model = YOLO(str(MODEL_PATH))
    return _model


_face_cascade_broken = False  # set True after first failure so we stop retrying every request


def _haar_cascade_paths() -> list[Path]:
    bundled = Path(__file__).resolve().parent / "data" / "haarcascade_frontalface_default.xml"
    paths = [bundled]
    try:
        data_dir = getattr(cv2, "data", None)
        if data_dir is not None:
            paths.append(Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml")
    except Exception:
        pass
    return paths


def face_detector():
    """Never raises. Returns a working CascadeClassifier, or None if Haar
    cascade XML cannot be loaded. OpenCV 5 no longer ships the XML next to
    cv2.data, so we vendor it under ai/data/.
    """
    global _face_cascade, _face_cascade_broken
    if _face_cascade_broken:
        return None
    if _face_cascade is None:
        last_err = "no cascade path tried"
        for cascade_path in _haar_cascade_paths():
            try:
                if not cascade_path.is_file():
                    continue
                classifier = cv2.CascadeClassifier(str(cascade_path))
                if classifier.empty():
                    last_err = f"empty classifier from {cascade_path}"
                    continue
                _face_cascade = classifier
                print(f"[startup] Haar cascade loaded from {cascade_path}")
                return _face_cascade
            except Exception as e:
                last_err = f"{type(e).__name__}: {e}"
        _face_cascade_broken = True
        print(f"[startup] Haar cascade face detector is broken. Last error: {last_err}")
        return None
    return _face_cascade


def decode_image(data_url: str) -> np.ndarray:
    if "," not in data_url:
        raise ValueError("Invalid image data URL")
    raw = base64.b64decode(data_url.split(",", 1)[1])
    pil = Image.open(io.BytesIO(raw)).convert("RGB")
    return cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)


# ---------------------------------------------------------------------------
# Face box + region-of-interest helpers
# ---------------------------------------------------------------------------

def _mp_face_box(image: np.ndarray) -> tuple[int, int, int, int] | None:
    """Anchor a face box from a handful of well-known, low-risk MediaPipe
    FaceMesh landmark indices (10=forehead top, 152=chin, 234/454=cheeks)."""
    if _MP_FACE is None:
        return None
    h, w = image.shape[:2]
    try:
        with _mp_lock:
            res = _MP_FACE.process(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
    except Exception as e:
        print(f"[mediapipe] .process() failed at runtime, falling back to Haar cascade this frame. Reason: {type(e).__name__}: {e}")
        return None
    if not res.multi_face_landmarks:
        return None
    lm = res.multi_face_landmarks[0].landmark
    xs = [lm[234].x * w, lm[454].x * w]
    ys = [lm[10].y * h, lm[152].y * h]
    x1, x2 = int(min(xs)), int(max(xs))
    y1, y2 = int(min(ys)), int(max(ys))
    # Landmarks 234/454/10/152 are tight; expand so cheeks/jaw/hairline stay in-frame
    # (training images are closer to a full-face crop than a mesh hull).
    bw, bh = max(1, x2 - x1), max(1, y2 - y1)
    pad_x, pad_y = int(bw * 0.22), int(bh * 0.18)
    return max(0, x1 - pad_x), max(0, y1 - pad_y), min(w, x2 + pad_x), min(h, y2 + pad_y)


def regions_for_face(image: np.ndarray, box: tuple[int, int, int, int]) -> dict[str, tuple[int, int, int, int]]:
    """Proportional sub-regions of the face box. Approximate by design -- good
    enough for area-level heuristics, not precise enough for per-wrinkle
    localization. With MediaPipe available the box itself is landmark-anchored
    (more robust to head tilt); without it, it's the Haar cascade box."""
    x1, y1, x2, y2 = box
    w, h = x2 - x1, y2 - y1
    def r(fx1, fy1, fx2, fy2):
        return (x1 + int(fx1 * w), y1 + int(fy1 * h), x1 + int(fx2 * w), y1 + int(fy2 * h))
    return {
        "forehead": r(0.18, 0.12, 0.82, 0.28),
        "left_cheek": r(0.12, 0.46, 0.36, 0.72),
        "right_cheek": r(0.64, 0.46, 0.88, 0.72),
        "under_eye_l": r(0.22, 0.34, 0.40, 0.44),
        "under_eye_r": r(0.60, 0.34, 0.78, 0.44),
        "t_zone": r(0.40, 0.14, 0.60, 0.55),
        "chin": r(0.36, 0.78, 0.64, 0.92),
        "full": r(0.08, 0.08, 0.92, 0.92),
    }


def crop(image: np.ndarray, box: tuple[int, int, int, int]) -> np.ndarray:
    x1, y1, x2, y2 = box
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = max(x1 + 1, x2), max(y1 + 1, y2)
    return image[y1:y2, x1:x2]


def skin_mask_bgr(bgr: np.ndarray) -> np.ndarray:
    """Self-referenced skin mask: ellipse of the face crop, pixels near the
    inner-face median LAB color. Drops hair, clothes, bottles, and studio bg
    without a fixed 'ideal' skin tone."""
    h, w = bgr.shape[:2]
    if h < 8 or w < 8:
        return np.zeros((h, w), dtype=bool)
    yy, xx = np.ogrid[:h, :w]
    cy, cx = h * 0.50, w * 0.50
    ellipse = ((xx - cx) / max(1.0, 0.36 * w)) ** 2 + ((yy - cy) / max(1.0, 0.46 * h)) ** 2 <= 1.0
    seed = ellipse.copy()
    seed[: max(1, int(h * 0.14)), :] = False  # hairline
    seed[int(h * 0.88) :, :] = False
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    L, a, b = lab[:, :, 0], lab[:, :, 1], lab[:, :, 2]
    if int(seed.sum()) < 30:
        seed = ellipse
    med_l, med_a, med_b = float(np.median(L[seed])), float(np.median(a[seed])), float(np.median(b[seed]))
    dist = np.sqrt((L - med_l) ** 2 + (a - med_a) ** 2 + (b - med_b) ** 2)
    skin = ellipse & (dist < 32.0) & (L > med_l - 28.0)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    skin_u8 = cv2.morphologyEx(skin.astype(np.uint8) * 255, cv2.MORPH_OPEN, k)
    return skin_u8 > 0


def fill_nonskin(bgr: np.ndarray, skin: np.ndarray) -> np.ndarray:
    """Replace non-skin with the median skin color so classifiers/segmenters
    don't treat hair/background as oil, pores, or wrinkles."""
    out = bgr.copy()
    if not skin.any():
        return out
    med = np.median(bgr[skin], axis=0)
    out[~skin] = med.astype(out.dtype)
    return out


def normalize_exposure(face_bgr: np.ndarray) -> np.ndarray:
    """Equalizes only the LIGHTNESS channel (LAB L*) with CLAHE, leaving the
    a*/b* color channels untouched. Two photos of the same face taken
    moments apart can differ a lot in webcam auto-exposure/white-balance,
    which was swinging brightness-derived scores (oiliness/darkSpots/pores)
    between otherwise-identical captures. This does NOT fix pose/crop
    differences (that needs mediapipe -- see the diagnostics above), but it
    removes most of the exposure-driven score jitter."""
    lab = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    return cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)


# ---------------------------------------------------------------------------
# Classical-CV metric detectors -- no training/dataset required.
# Each is self-referential (compares regions to the SAME face's own median),
# not to a fixed "ideal" skin tone, to reduce bias across skin tones.
# ---------------------------------------------------------------------------

def detect_pigmentation(image: np.ndarray, regions: dict) -> tuple[int, str]:
    """Dark-spot / pigmentation proxy: LAB L* outliers on *skin pixels only*."""
    face = crop(image, regions["full"])
    if face.size == 0:
        return 50, "چهره کافی نبود"
    skin = skin_mask_bgr(face)
    lab = cv2.cvtColor(face, cv2.COLOR_BGR2LAB).astype(np.float32)
    L = lab[:, :, 0]
    if int(skin.sum()) < 80:
        return 50, "پیکسل پوست کافی نبود"
    vals = L[skin]
    med, mad = float(np.median(vals)), float(np.median(np.abs(vals - np.median(vals))) + 1e-6)
    dark = skin & (L < (med - 2.4 * mad))
    ratio = float(dark.sum()) / float(skin.sum())
    score = int(max(15, min(95, round(100 - ratio * 220))))
    return score, "نسبت نواحی تیره‌تر از میانه پوست (فقط پیکسل پوست)"


def detect_redness(image: np.ndarray, regions: dict) -> tuple[int, str]:
    patches = []
    for key in ("left_cheek", "right_cheek"):
        patch = crop(image, regions[key])
        if patch.size == 0:
            continue
        skin = skin_mask_bgr(patch)
        lab = cv2.cvtColor(patch, cv2.COLOR_BGR2LAB).reshape(-1, 3)
        m = skin.reshape(-1)
        if int(m.sum()) > 20:
            patches.append(lab[m])
    if not patches:
        return 50, "ناحیه گونه کافی نبود"
    cheeks = np.concatenate(patches, axis=0)
    a_mean = float(cheeks[:, 1].mean())
    excess = max(0.0, a_mean - 132.0)
    score = int(max(0, min(100, round(100 - excess * 4.0))))
    return score, "میانگین کانال a* روی پوست گونه"


def detect_texture_and_pores(image: np.ndarray, regions: dict) -> tuple[int, int, str]:
    nose_cheek = crop(image, regions["t_zone"])
    if nose_cheek.size == 0:
        return 50, 50, "ناحیه T-zone کافی نبود"
    skin = skin_mask_bgr(nose_cheek)
    gray = cv2.cvtColor(nose_cheek, cv2.COLOR_BGR2GRAY)
    lap = cv2.Laplacian(gray, cv2.CV_64F)
    if int(skin.sum()) < 40:
        return 50, 50, "پیکسل پوست کافی نبود"
    local_var = float(lap[skin].var())
    texture = int(max(0, min(100, round(100 - local_var / 15))))
    pores = int(max(0, min(100, round(100 - local_var / 12))))
    return texture, pores, "واریانس فرکانس‌بالا روی پوست T-zone"


def detect_wrinkles(image: np.ndarray, regions: dict) -> tuple[int, str]:
    face = crop(image, regions["full"])
    skin_face = skin_mask_bgr(face) if face.size else None
    real = wrinkle_coverage_ratio(fill_nonskin(face, skin_face) if skin_face is not None else face)
    if real is not None:
        return int(max(0, min(100, round(100 - real * 400)))), "مدل U-Net (فقط ناحیه پوست)"

    rois = [regions["forehead"], regions["under_eye_l"], regions["under_eye_r"]]
    densities = []
    for roi in rois:
        patch = crop(image, roi)
        if patch.size == 0:
            continue
        skin = skin_mask_bgr(patch)
        gray = cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (3, 3), 0)
        edges = cv2.Canny(gray, 25, 60)
        if int(skin.sum()) < 20:
            continue
        densities.append(float(edges[skin].mean()) / 255.0)
    if not densities:
        return 50, "نواحی پیشانی/زیر چشم کافی نبود"
    density = float(np.mean(densities))
    score = int(max(0, min(100, round(100 - density * 550))))
    return score, "تراکم لبه روی پوست پیشانی و زیر چشم"


def detect_oiliness(image: np.ndarray, regions: dict) -> tuple[int, str]:
    patch = crop(image, regions["t_zone"])
    if patch.size == 0:
        return 50, "ناحیه T-zone کافی نبود"
    skin = skin_mask_bgr(patch)
    hsv = cv2.cvtColor(patch, cv2.COLOR_BGR2HSV)
    shine = (hsv[:, :, 2] > 200) & (hsv[:, :, 1] < 60) & skin
    denom = max(1, int(skin.sum()))
    ratio = float(shine.sum()) / denom
    score = int(max(15, min(95, round(100 - ratio * 180))))
    return score, "نسبت پیکسل براق روی پوست T-zone"


# Tunable via env -- webcams/laptop cameras are inherently softer than phone
# cameras. The Scan page uses a different sharpness metric with threshold ~2;
# this Laplacian-variance floor used to be 8 and rejected in-focus laptop photos
# after the client had already said the image was OK.
MIN_SHARPNESS = float(os.getenv("POOSTA_MIN_SHARPNESS", "4"))
MIN_BRIGHTNESS = float(os.getenv("POOSTA_MIN_BRIGHTNESS", "55"))
MAX_BRIGHTNESS = float(os.getenv("POOSTA_MAX_BRIGHTNESS", "225"))
MIN_CONTRAST = float(os.getenv("POOSTA_MIN_CONTRAST", "8"))
MIN_RESOLUTION = int(os.getenv("POOSTA_MIN_RESOLUTION", "400"))


def quality(image: np.ndarray) -> dict[str, Any]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    brightness = float(gray.mean())
    contrast = float(gray.std())

    mp_box = _mp_face_box(image)
    cascade = None if mp_box else face_detector()
    faces = []
    if mp_box is None and cascade is not None:
        try:
            faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(80, 80))
            if len(faces) == 0:
                faces = cascade.detectMultiScale(gray, scaleFactor=1.05, minNeighbors=3, minSize=(48, 48))
        except Exception as e:
            print(f"[quality] Haar detectMultiScale failed at runtime: {type(e).__name__}: {e}")
            faces = []

    no_detector_available = mp_box is None and cascade is None
    face_count = 1 if mp_box is not None else len(faces)
    box = mp_box
    if box is None and len(faces) == 1:
        x, y, w, h = [int(v) for v in faces[0]]
        box = (x, y, x + w, y + h)

    issues: list[str] = []
    # Refuse to invent a face crop — models only run after a real face is found.
    allow_no_detector = os.getenv("POOSTA_ALLOW_NO_FACE_DETECTOR", "").lower() in ("1", "true", "yes")
    if no_detector_available:
        if allow_no_detector:
            h, w = image.shape[:2]
            box = (int(w * 0.12), int(h * 0.08), int(w * 0.88), int(h * 0.95))
            face_count = 1
            print("[quality] MediaPipe/Haar unavailable -- centered crop allowed via POOSTA_ALLOW_NO_FACE_DETECTOR")
        else:
            issues.append("تشخیص چهره در دسترس نیست. لطفاً MediaPipe را نصب کنید یا بعداً دوباره تلاش کنید.")
            face_count = 0
            box = None
    elif face_count == 0:
        issues.append("چهره‌ای در تصویر پیدا نشد. صورت را روبه‌دوربین و در قاب قرار دهید.")
    elif face_count > 1:
        issues.append("دقیقاً یک چهره روبه‌رو باید در تصویر باشد.")

    sharp_src = crop(image, box) if box else image
    if sharp_src.size == 0:
        sharp_src = image
    sharp_gray = cv2.cvtColor(sharp_src, cv2.COLOR_BGR2GRAY) if sharp_src.ndim == 3 else sharp_src
    sharpness = float(cv2.Laplacian(sharp_gray, cv2.CV_64F).var())

    if min(image.shape[:2]) < MIN_RESOLUTION:
        issues.append("رزولوشن تصویر پایین است.")
    if brightness < MIN_BRIGHTNESS:
        issues.append("نور تصویر کم است.")
    if brightness > MAX_BRIGHTNESS:
        issues.append("نور تصویر بیش از حد زیاد است.")
    if contrast < MIN_CONTRAST:
        issues.append("کنتراست تصویر پایین است.")
    if sharpness < MIN_SHARPNESS:
        issues.append("تصویر ممکن است تار باشد.")

    face = {"x": box[0], "y": box[1], "w": box[2] - box[0], "h": box[3] - box[1]} if box else None
    score = 1.0 - min(0.7, 0.12 * len(issues))
    if no_detector_available and not allow_no_detector:
        score = 0.0
    return {
        "suitable": len(issues) == 0 and box is not None,
        "faceDetected": face_count == 1 and box is not None,
        "faceCount": int(face_count),
        "frontal": face_count == 1 and box is not None,
        "faceVisibility": "clear" if face_count == 1 and box is not None else "poor",
        "qualityScore": round(max(0.0, score), 2),
        "issues": issues,
        "faceBox": face,
        "_box": box,
        "faceMethod": (
            "none-fallback-centered-box" if no_detector_available and allow_no_detector
            else ("mediapipe" if mp_box else ("haar_cascade" if cascade is not None else "unavailable"))
        ),
    }


# Fuzzy substring map: normalized class name fragment -> our metric key.
# Comedones (blackhead/whitehead) are acne, not pores. Longer fragments first.
CLASS_TO_METRIC = [
    ("enlarged-pore", "pores"), ("whitehead", "acne"), ("blackhead", "acne"),
    ("acne", "acne"), ("pimple", "acne"), ("pore", "pores"),
    ("dark-spot", "darkSpots"), ("darkspot", "darkSpots"), ("pigmentation", "darkSpots"),
    ("melasma", "darkSpots"), ("freckle", "darkSpots"),
    ("wrinkle", "fineLines"), ("fine-line", "fineLines"), ("eyebag", "fineLines"),
    ("redness", "redness"), ("erythema", "redness"), ("rosacea", "redness"),
    ("oily", "oiliness"),
]


def normalize_class(name: str) -> str:
    return name.strip().lower().replace("_", "-").replace(" ", "-")


def conditions_to_metric_scores(detections: dict[str, dict]) -> dict[str, tuple[int, float]]:
    """Aggregates high-confidence class detections into {metric: (score, avg_conf)}.

    Does not subtract confidence from the score (that double-penalizes) and caps
    the count penalty so a handful of FPs cannot tank the metric to 0.
    """
    buckets: dict[str, list[dict]] = {}
    for cls_name, info in detections.items():
        if float(info.get("avg_conf", 0)) < PREDICT_CONF:
            continue
        key = normalize_class(cls_name)
        metric = next((m for frag, m in CLASS_TO_METRIC if frag in key), None)
        # YOLO conditions is a lesion detector. Region labels (oily/redness/pores/wrinkles)
        # were trained as cheek-sized boxes and read as background FPs — ignore them here.
        if metric in ("acne", "darkSpots"):
            buckets.setdefault(metric, []).append(info)

    out: dict[str, tuple[int, float]] = {}
    for metric, entries in buckets.items():
        total_count = sum(e["count"] for e in entries)
        avg_conf = float(np.mean([e["avg_conf"] for e in entries]))
        score = int(max(0, min(100, round(100 - min(40, total_count * 4)))))
        out[metric] = (score, avg_conf)
    return out


def estimate_apparent_skin_age(metrics: dict[str, int], chronological_age: int | None = None) -> dict[str, Any]:
    """Cosmetic 'how old does the skin look' estimate from skin metrics (not medical age).

    Higher metric scores = healthier/younger-looking skin. Anchored near mid-20s–30s
    for average scores; worsens with fine lines, texture, spots, pores.
    """
    aging_keys = ("fineLines", "texture", "darkSpots", "pores", "acne")
    vals = [float(metrics.get(k, 50)) for k in aging_keys]
    youth = sum(vals) / len(vals)  # 100 = youthful
    # Map youth 100→~22, 50→~35, 20→~48
    apparent = int(round(55 - youth * 0.33))
    if chronological_age and 12 <= chronological_age <= 90:
        # Soft blend toward chronological age so result stays plausible
        apparent = int(round(0.65 * apparent + 0.35 * chronological_age))
    apparent = max(18, min(70, apparent))
    note = (
        f"بر اساس ظاهر پوست در عکس، پوست شما حدوداً {apparent} ساله به نظر می‌رسد. "
        "این یک برآورد ظاهری/کازمتیک است، نه سن واقعی یا تشخیص پزشکی."
    )
    return {"apparentSkinAge": apparent, "apparentSkinAgeNote": note}


def analyze(image: np.ndarray, chronological_age: int | None = None) -> dict[str, Any]:
    q = quality(image)
    if not q["suitable"]:
        return {"imageQuality": {k: v for k, v in q.items() if k != "_box"}, "error": q["issues"][0] if q["issues"] else "Image quality failed"}

    regions = regions_for_face(image, q["_box"])
    face_crop = crop(image, regions["full"])
    skin_face = skin_mask_bgr(face_crop) if face_crop.size else np.zeros((1, 1), dtype=bool)
    face_for_models = fill_nonskin(face_crop, skin_face) if face_crop.size else face_crop

    normalized = normalize_exposure(image)

    # 1) classical CV baseline for every metric (always available, no model needed)
    dark_spots, spots_note = detect_pigmentation(normalized, regions)
    redness, redness_note = detect_redness(normalized, regions)
    texture, pores, tex_note = detect_texture_and_pores(normalized, regions)
    fine_lines, wrinkle_note = detect_wrinkles(normalized, regions)
    oiliness, oil_note = detect_oiliness(normalized, regions)
    metrics = {
        "acne": 70, "oiliness": oiliness, "hydration": 50, "redness": redness,
        "pores": pores, "darkSpots": dark_spots, "texture": texture, "fineLines": fine_lines,
    }
    notes = {"darkSpots": spots_note, "redness": redness_note, "texture/pores": tex_note,
             "fineLines": wrinkle_note, "oiliness": oil_note}
    metrics_source = {k: "heuristic" for k in metrics}  # overwritten to "model" below when a real model produced it
    conf = 0.0

    annotation_boxes: list[dict] = []
    if q.get("faceBox"):
        annotation_boxes.append({**q["faceBox"], "label": "face", "source": q.get("faceMethod") or "face"})

    # Conditions model: run on the full frame (same geometry as Roboflow train)
    # and keep boxes whose center is inside the (padded) face box.
    with _predict_lock:
        bx = q.get("_box")
        infer_src = image
        infer_roi = bx
        if bx is not None:
            ix1, iy1, ix2, iy2 = [int(v) for v in bx]
            raw = image[iy1:iy2, ix1:ix2]
            if raw.size:
                infer_src = fill_nonskin(raw, skin_mask_bgr(raw))
                infer_roi = None
        condition_boxes = list_condition_boxes(infer_src, roi=infer_roi)
        if condition_boxes is not None and bx is not None and infer_roi is None:
            ox, oy = int(bx[0]), int(bx[1])
            for b in condition_boxes:
                b["x"] += ox
                b["y"] += oy
    detections = None
    if condition_boxes is not None:
        annotation_boxes.extend(condition_boxes)
        detections = {}
        for b in condition_boxes:
            entry = detections.setdefault(b["label"], {"count": 0, "confs": []})
            entry["count"] += 1
            entry["confs"].append(b.get("conf") or 0.0)
        for v in detections.values():
            confs = v.pop("confs")
            v["avg_conf"] = float(np.mean(confs)) if confs else 0.0
    if detections is not None:
        scored = conditions_to_metric_scores(detections)
        for metric, (score, m_conf) in scored.items():
            metrics[metric] = score
            metrics_source[metric] = "model"
            conf = max(conf, m_conf)
            notes[metric] = f"مدل ترکیبی conditions (کلاس‌های مرتبط با {metric}) — {score}"
        if "acne" not in scored:
            notes["acne"] = "مدل conditions ضایعه آکنه با اطمینان کافی پیدا نکرد."
    else:
        try:
            acne_model = get_model()
            src = face_for_models if face_for_models.size else image
            fx1, fy1, fx2, fy2 = regions["full"]
            ox, oy = int(fx1), int(fy1)
            face_xyxy = q.get("_box") or regions["full"]
            with _predict_lock:
                result = acne_model.predict(
                    source=src, imgsz=PREDICT_IMGSZ, conf=PREDICT_CONF, iou=0.55, max_det=30, verbose=False,
                )[0]
            boxes = result.boxes
            kept = 0
            confs_kept: list[float] = []
            if boxes is not None and len(boxes):
                xyxys = boxes.xyxy.detach().cpu().numpy().tolist()
                raw_confs = boxes.conf.detach().cpu().numpy().tolist() if boxes.conf is not None else [0.0] * len(xyxys)
                face_for_frac = face_xyxy or (0, 0, image.shape[1], image.shape[0])
                for xyxy, c in zip(xyxys, raw_confs):
                    px1, py1 = xyxy[0] + ox, xyxy[1] + oy
                    px2, py2 = xyxy[2] + ox, xyxy[3] + oy
                    if c < PREDICT_CONF or not _box_ok(px1, py1, px2, py2, face_for_frac, "acne"):
                        continue
                    kept += 1
                    confs_kept.append(float(c))
                    annotation_boxes.append({
                        "label": "acne",
                        "x": int(round(px1)),
                        "y": int(round(py1)),
                        "w": int(round(max(1, px2 - px1))),
                        "h": int(round(max(1, py2 - py1))),
                        "conf": float(c),
                        "source": "acne",
                    })
            conf = float(np.mean(confs_kept)) if confs_kept else 0.0
            metrics["acne"] = int(max(0, min(100, round(100 - min(40, kept * 4)))))
            metrics_source["acne"] = "model"
            notes["acne"] = f"{kept} ضایعه مشکوک به آکنه توسط مدل YOLO اختصاصی acne شناسایی شد."
        except FileNotFoundError:
            notes["acne"] = "مدل acne اختصاصی هنوز آموزش داده نشده."

    # Pore-segmentation model, if you ran ai/train_pores.py
    with _predict_lock:
        pore_ratio = pore_coverage_ratio(face_for_models)
    if pore_ratio is not None and pore_ratio > 0.001:
        metrics["pores"] = int(max(0, min(100, round(100 - pore_ratio * 300))))
        metrics_source["pores"] = "model"
        notes["texture/pores"] = f"مدل واقعی segmentation منافذ (پوشش: {pore_ratio:.1%})"
    elif pore_ratio is not None:
        notes["texture/pores"] = tex_note + " (مدل منافذ چیزی تشخیص نداد -- به heuristic کلاسیک برگشتیم؛ این مدل را با عکس‌های بیشتر/بازبینی دقت validate کنید)"

    region_probs = predict_region_probs(face_for_models)
    if region_probs is not None:
        for metric, (score, note) in region_probs_to_metrics(region_probs).items():
            if metric == "pores" and metrics_source.get("pores") == "model":
                continue
            if metric == "fineLines" and metrics_source.get("fineLines") == "model":
                continue
            metrics[metric] = score
            metrics_source[metric] = "model"
            notes[metric if metric != "pores" else "texture/pores"] = note
            if metric == "hydration":
                notes["hydration"] = note

    overall = round(sum(metrics[k] * WEIGHTS[k] for k in metrics) / sum(WEIGHTS.values()))
    age_est = estimate_apparent_skin_age(metrics, chronological_age)

    observations = [
        notes.get("acne", ""),
        f"لک/پیگمانتاسیون: {notes.get('darkSpots', spots_note)}",
        f"قرمزی: {notes.get('redness', redness_note)}",
        f"بافت/منافذ: {notes.get('texture/pores', tex_note)}",
        f"خطوط ریز: {notes.get('fineLines', wrinkle_note)}",
        f"چربی: {notes.get('oiliness', oil_note)}",
        age_est["apparentSkinAgeNote"],
        f"روش تشخیص چهره: {q['faceMethod']}",
        f"مدل ترکیبی conditions: {'فعال' if detections is not None else 'هنوز آموزش داده نشده (classical fallback فعال است)'}",
        f"مدل منافذ اختصاصی: {'فعال' if pore_ratio is not None else 'هنوز آموزش داده نشده (classical fallback فعال است)'}",
        f"مدل ناحیه (چربی/خشکی/قرمزی/منافذ/چروک): {'فعال' if region_probs is not None else 'هنوز آموزش داده نشده'}",
    ]
    limitations = [
        "هر شاخص یا از یک مدل آموزش‌دیده (acne/conditions/pores/wrinkles، هرکدام که آموزش داده شده باشد) یا از پردازش تصویر کلاسیک به‌دست می‌آید (به observations بالا نگاه کنید که کدام است)؛ در هر دو حالت تخمین جهت‌دار است، نه اندازه‌گیری بالینی.",
        "رطوبت پوست از روی یک عکس RGB به‌طور قابل‌اعتماد قابل تخمین نیست (نیاز به سنسور/دستگاه دارد)، بنابراین عمداً اندازه‌گیری نشده و مقدار خنثی نمایش داده می‌شود.",
        "سن ظاهری پوست یک برآورد کازمتیک از روی بافت/خطوط/لک است و سن تقویمی یا تشخیص پزشکی نیست.",
        "این ابزار برای مراقبت روزمره پوست است، نه تشخیص پزشکی.",
    ]
    return {
        "overallScore": overall, "metrics": metrics, "metricsSource": metrics_source,
        "concerns": [k for k, v in metrics.items() if v < 50 and k != "hydration"],
        "topOpportunities": sorted((k for k in metrics if k != "hydration"), key=lambda k: metrics[k])[:2],
        "confidence": round(max(0.35, min(0.95, 0.45 + conf * 0.35 + q["qualityScore"] * 0.15)), 2),
        "provider": "local-cv+yolo-acne+conditions+pores (auto-detected which are trained)",
        "createdAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "imageQuality": {k: v for k, v in q.items() if k != "_box"},
        "observations": observations, "limitations": limitations,
        "recommendedNextStep": "برای دقت بالینی، هر شاخص (لک، چروک، منافذ...) به یک مدل آموزش‌دیده اختصاصی با دیتاست معتبر نیاز دارد؛ فعلاً از heuristicهای کلاسیک استفاده می‌شود.",
        "annotationBoxes": annotation_boxes,
        "apparentSkinAge": age_est["apparentSkinAge"],
        "apparentSkinAgeNote": age_est["apparentSkinAgeNote"],
    }


class Handler(BaseHTTPRequestHandler):
    def _allow_origin(self) -> str | None:
        origin = self.headers.get("Origin", "")
        if not origin:
            return None
        try:
            host = urlparse(origin).hostname or ""
        except Exception:
            return None
        if host in _ALLOWED_ANALYZE_HOSTS:
            return origin
        return None

    def _send(self, status: int, body: dict[str, Any]) -> None:
        raw = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        allowed = self._allow_origin()
        if allowed:
            self.send_header("Access-Control-Allow-Origin", allowed)
            self.send_header("Vary", "Origin")
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self) -> None:
        allowed = self._allow_origin()
        self.send_response(204 if allowed else 403)
        if allowed:
            self.send_header("Access-Control-Allow-Origin", allowed)
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Vary", "Origin")
        self.end_headers()

    def do_GET(self) -> None:
        if self.path == "/health":
            self._send(200, {"ok": True, "model": str(MODEL_PATH), "modelReady": MODEL_PATH.exists(),
                              "mediapipe": _MP_FACE is not None})
        else:
            self._send(404, {"error": "Not found"})

    def do_POST(self) -> None:
        if self.path not in ("/analyze", "/quality"):
            self._send(404, {"error": "Not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            data = json.loads(self.rfile.read(length).decode("utf-8"))
            image = decode_image(data["imageDataUrl"])
            if self.path == "/quality":
                q = quality(image)
                public = {k: v for k, v in q.items() if k != "_box"}
                status = 200 if q["suitable"] else 400
                self._send(status, {"imageQuality": public, "ok": q["suitable"],
                                    "error": None if q["suitable"] else (q["issues"][0] if q["issues"] else "کیفیت تصویر مناسب نیست.")})
                return
            age = data.get("chronologicalAge") or data.get("age")
            chronological = int(age) if age is not None and str(age).isdigit() else None
            result = analyze(image, chronological_age=chronological)
            if "error" in result:
                self._send(400, result)
                return
            self._send(200, result)
        except FileNotFoundError as e:
            self._send(503, {"error": str(e)})
        except Exception as e:
            self._send(500, {"error": str(e)})


if __name__ == "__main__":
    print(f"Poosta AI server: http://{HOST}:{PORT}")
    print(f"Model: {MODEL_PATH}")
    print(f"MediaPipe face landmarks: {'available' if _MP_FACE is not None else 'not installed (using Haar cascade fallback)'}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
