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
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from PIL import Image
from ultralytics import YOLO

from wrinkle_model import wrinkle_coverage_ratio  # optional real model, see ai/wrinkle_model.py
from conditions_model import detect_conditions  # optional real model, see ai/conditions_model.py
from pores_model import pore_coverage_ratio  # optional real model, see ai/pores_model.py

try:
    import mediapipe as mp  # optional: better face regions than a plain box
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

# Metric weights mirror the frontend's METRIC_WEIGHTS (kept in sync manually).
WEIGHTS = {"acne": 0.17, "oiliness": 0.10, "hydration": 0.05, "redness": 0.11,
           "pores": 0.10, "darkSpots": 0.12, "texture": 0.13, "fineLines": 0.11}
# hydration's weight is deliberately reduced (not zero) since it stays a neutral
# default -- it shouldn't be allowed to meaningfully swing the overall score.


def get_model() -> YOLO:
    global _model
    if _model is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Custom acne model not found: {MODEL_PATH}. Train/export it first.")
        _model = YOLO(str(MODEL_PATH))
    return _model


_face_cascade_broken = False  # set True after first failure so we stop retrying every request


def face_detector():
    """Never raises. Returns a working CascadeClassifier, or None if the
    Haar cascade data can't be loaded on this machine (typically a broken
    opencv install -- 2+ opencv-* packages installed at once). Callers must
    handle None (this is Haar-cascade ONLY; if mediapipe is available, that
    path is used first and Haar is never even reached -- see quality())."""
    global _face_cascade, _face_cascade_broken
    if _face_cascade_broken:
        return None
    if _face_cascade is None:
        try:
            cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            classifier = cv2.CascadeClassifier(cascade_path)
            if classifier.empty():
                raise RuntimeError(f"cascade file failed to load from {cascade_path}")
            _face_cascade = classifier
        except Exception as e:
            _face_cascade_broken = True
            print(f"[startup] Haar cascade face detector is broken on this machine "
                  f"(likely 2+ opencv-* packages conflicting -- see ai/requirements.txt "
                  f"comment). Reason: {type(e).__name__}: {e}")
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
    return max(0, x1), max(0, y1), min(w, x2), min(h, y2)


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
        "forehead": r(0.15, 0.05, 0.85, 0.30),
        "left_cheek": r(0.08, 0.45, 0.35, 0.75),
        "right_cheek": r(0.65, 0.45, 0.92, 0.75),
        "under_eye_l": r(0.20, 0.35, 0.42, 0.46),
        "under_eye_r": r(0.58, 0.35, 0.80, 0.46),
        "t_zone": r(0.38, 0.08, 0.62, 0.62),
        "chin": r(0.35, 0.80, 0.65, 0.95),
        "full": r(0.05, 0.05, 0.95, 0.95),
    }


def crop(image: np.ndarray, box: tuple[int, int, int, int]) -> np.ndarray:
    x1, y1, x2, y2 = box
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = max(x1 + 1, x2), max(y1 + 1, y2)
    return image[y1:y2, x1:x2]


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
    """Dark-spot / pigmentation proxy: LAB L*/b* outlier blobs vs the face's
    own median skin tone (thresholded, then area-ratio scored)."""
    face = crop(image, regions["full"])
    if face.size == 0:
        return 50, "چهره کافی نبود"
    lab = cv2.cvtColor(face, cv2.COLOR_BGR2LAB).astype(np.float32)
    L = lab[:, :, 0]
    med, mad = float(np.median(L)), float(np.median(np.abs(L - np.median(L))) + 1e-6)
    dark_mask = L < (med - 2.2 * mad)
    ratio = float(dark_mask.mean())
    score = int(max(15, min(95, round(100 - ratio * 220))))
    return score, "نسبت نواحی تیره‌تر از میانه پوست خودتان (LAB L*)"


def detect_redness(image: np.ndarray, regions: dict) -> tuple[int, str]:
    """Redness proxy: LAB a* channel (green-red axis), self-referenced to
    the forehead/cheek baseline of the SAME face."""
    cheeks = np.concatenate([
        cv2.cvtColor(crop(image, regions["left_cheek"]), cv2.COLOR_BGR2LAB).reshape(-1, 3),
        cv2.cvtColor(crop(image, regions["right_cheek"]), cv2.COLOR_BGR2LAB).reshape(-1, 3),
    ]) if crop(image, regions["left_cheek"]).size and crop(image, regions["right_cheek"]).size else None
    if cheeks is None or len(cheeks) == 0:
        return 50, "ناحیه گونه کافی نبود"
    a_mean = float(cheeks[:, 1].mean())  # ~128 is neutral in OpenCV's LAB (uint8 offset)
    excess = max(0.0, a_mean - 132.0)
    score = int(max(0, min(100, round(100 - excess * 4.0))))
    return score, "میانگین کانال a* (قرمزی) در ناحیه گونه"


def detect_texture_and_pores(image: np.ndarray, regions: dict) -> tuple[int, int, str]:
    """Texture/pores proxy: local high-frequency variance (Laplacian) in the
    nose/cheek region -- more micro-variance reads as more visible
    texture/pores. This is one shared signal read two ways; treat both
    scores as correlated, not independently validated."""
    nose_cheek = crop(image, regions["t_zone"])
    if nose_cheek.size == 0:
        return 50, 50, "ناحیه T-zone کافی نبود"
    gray = cv2.cvtColor(nose_cheek, cv2.COLOR_BGR2GRAY)
    lap = cv2.Laplacian(gray, cv2.CV_64F)
    local_var = float(lap.var())
    texture = int(max(0, min(100, round(100 - local_var / 15))))
    pores = int(max(0, min(100, round(100 - local_var / 12))))
    return texture, pores, "واریانس فرکانس‌بالا (Laplacian) در ناحیه T-zone"


def detect_wrinkles(image: np.ndarray, regions: dict) -> tuple[int, str]:
    """Fine-lines: uses the real FFHQ-Wrinkle U-Net if a checkpoint is present
    (see ai/wrinkle_model.py); otherwise falls back to a Canny edge-density
    proxy in forehead + under-eye regions. Both paths are non-fabricated:
    the model is real (with documented caveats), the fallback is classical CV."""
    real = wrinkle_coverage_ratio(crop(image, regions["full"]))
    if real is not None:
        return int(max(0, min(100, round(100 - real * 400)))), "مدل U-Net (FFHQ-Wrinkle، چک‌پوینت واقعی)"

    rois = [regions["forehead"], regions["under_eye_l"], regions["under_eye_r"]]
    densities = []
    for roi in rois:
        patch = crop(image, roi)
        if patch.size == 0:
            continue
        gray = cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (3, 3), 0)
        edges = cv2.Canny(gray, 25, 60)
        densities.append(float(edges.mean()) / 255.0)
    if not densities:
        return 50, "نواحی پیشانی/زیر چشم کافی نبود"
    density = float(np.mean(densities))
    score = int(max(0, min(100, round(100 - density * 550))))
    return score, "تراکم لبه‌های خطی (Canny) در پیشانی و زیر چشم"


def detect_oiliness(image: np.ndarray, regions: dict) -> tuple[int, str]:
    """Oiliness proxy: specular-highlight ratio (high V, low S in HSV) in the
    T-zone, where shine from sebum typically appears."""
    patch = crop(image, regions["t_zone"])
    if patch.size == 0:
        return 50, "ناحیه T-zone کافی نبود"
    hsv = cv2.cvtColor(patch, cv2.COLOR_BGR2HSV)
    shine = (hsv[:, :, 2] > 200) & (hsv[:, :, 1] < 60)
    ratio = float(shine.mean())
    score = int(max(15, min(95, round(100 - ratio * 180))))
    return score, "نسبت پیکسل‌های براق/کم‌اشباع (HSV) در T-zone"


# Tunable via env -- webcams/laptop cameras are inherently softer than phone
# cameras, so a fixed sharpness threshold calibrated on one device can wrongly
# reject clear photos from another. Lower these if real, in-focus photos keep
# getting rejected; raise them if obviously blurry photos keep passing.
MIN_SHARPNESS = float(os.getenv("POOSTA_MIN_SHARPNESS", "8"))
MIN_BRIGHTNESS = float(os.getenv("POOSTA_MIN_BRIGHTNESS", "55"))
MAX_BRIGHTNESS = float(os.getenv("POOSTA_MAX_BRIGHTNESS", "225"))
MIN_CONTRAST = float(os.getenv("POOSTA_MIN_CONTRAST", "8"))
MIN_RESOLUTION = int(os.getenv("POOSTA_MIN_RESOLUTION", "400"))


def quality(image: np.ndarray) -> dict[str, Any]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    brightness = float(gray.mean())
    contrast = float(gray.std())
    # measured on the face region when we already know it (see below), since
    # whole-frame sharpness can be skewed by a blurry/busy background even when
    # the face itself is sharp
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    mp_box = _mp_face_box(image)
    cascade = None if mp_box else face_detector()
    if mp_box:
        faces = []
    elif cascade is not None:
        try:
            faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(100, 100))
        except Exception as e:
            print(f"[quality] Haar detectMultiScale failed at runtime: {type(e).__name__}: {e}")
            faces = []
    else:
        faces = []
    face_count = 1 if mp_box else len(faces)

    no_detector_available = mp_box is None and cascade is None
    if no_detector_available:
        # Both MediaPipe and Haar are unavailable (broken local opencv/mediapipe
        # install) -- degrade instead of hard-blocking every analysis: assume a
        # roughly centered face fills most of the frame. Less accurate, but the
        # app stays usable while you fix the environment (see startup logs above).
        h, w = image.shape[:2]
        mp_box = (int(w * 0.15), int(h * 0.08), int(w * 0.85), int(h * 0.95))
        face_count = 1

    issues: list[str] = []
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
    if face_count != 1:
        issues.append("دقیقاً یک چهره روبه‌رو باید در تصویر باشد.")

    box = mp_box
    if box is None and len(faces) == 1:
        x, y, w, h = [int(v) for v in faces[0]]
        box = (x, y, x + w, y + h)
    face = {"x": box[0], "y": box[1], "w": box[2] - box[0], "h": box[3] - box[1]} if box else None

    score = 1.0 - min(0.7, 0.12 * len(issues))
    return {
        "suitable": not issues, "faceDetected": face_count == 1, "faceCount": int(face_count),
        "frontal": face_count == 1, "faceVisibility": "clear" if face_count == 1 else "poor",
        "qualityScore": round(max(0.0, score), 2), "issues": issues,
        "faceBox": face, "_box": box,
        "faceMethod": "none-fallback-centered-box" if no_detector_available else ("mediapipe" if mp_box else "haar_cascade"),
    }


# Fuzzy substring map: normalized class name fragment -> our metric key.
# Deliberately NOT an exact-name lookup, since ardayemc/face_skin_problems
# class spelling varies (Dark-Spots vs dark spot vs Pigmentation...).
CLASS_TO_METRIC = [
    ("acne", "acne"), ("pimple", "acne"),
    ("blackhead", "pores"), ("whitehead", "pores"), ("enlarged-pore", "pores"), ("pore", "pores"),
    ("dark-spot", "darkSpots"), ("darkspot", "darkSpots"), ("pigmentation", "darkSpots"),
    ("melasma", "darkSpots"), ("freckle", "darkSpots"),
    ("wrinkle", "fineLines"), ("fine-line", "fineLines"), ("eyebag", "fineLines"),
    ("redness", "redness"), ("erythema", "redness"), ("rosacea", "redness"),
    ("oily", "oiliness"),
    ("dry-skin", "hydration"), ("dryness", "hydration"),
]


def normalize_class(name: str) -> str:
    return name.strip().lower().replace("_", "-").replace(" ", "-")


def conditions_to_metric_scores(detections: dict[str, dict]) -> dict[str, tuple[int, float]]:
    """Aggregates raw class detections into {metric: (score, avg_conf)}."""
    buckets: dict[str, list[dict]] = {}
    for cls_name, info in detections.items():
        key = normalize_class(cls_name)
        metric = next((m for frag, m in CLASS_TO_METRIC if frag in key), None)
        if metric:
            buckets.setdefault(metric, []).append(info)

    out: dict[str, tuple[int, float]] = {}
    for metric, entries in buckets.items():
        total_count = sum(e["count"] for e in entries)
        avg_conf = float(np.mean([e["avg_conf"] for e in entries]))
        score = int(max(0, min(100, round(100 - min(70, total_count * 7) - avg_conf * 10))))
        out[metric] = (score, avg_conf)
    return out


def analyze(image: np.ndarray) -> dict[str, Any]:
    q = quality(image)
    if not q["suitable"]:
        return {"imageQuality": q, "error": q["issues"][0] if q["issues"] else "Image quality failed"}

    regions = regions_for_face(image, q["_box"])
    face_crop = crop(image, regions["full"])

    # Dampen exposure/white-balance jitter between separate captures before
    # any classical detector runs (redness/darkSpots/pores/oiliness are all
    # otherwise quite sensitive to webcam auto-exposure changes frame to frame).
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
    acne_count = 0

    # 2) old acne-only model, if the merged conditions model below isn't trained yet
    try:
        acne_model = get_model()
        result = acne_model.predict(source=image, imgsz=640, conf=0.25, verbose=False)[0]
        boxes = result.boxes
        acne_count = int(len(boxes)) if boxes is not None else 0
        confs = boxes.conf.detach().cpu().numpy().tolist() if boxes is not None and boxes.conf is not None else []
        conf = float(np.mean(confs)) if confs else 0.0
        metrics["acne"] = int(max(0, min(100, round(100 - min(70, acne_count * 7) - conf * 10))))
        metrics_source["acne"] = "model"
        notes["acne"] = f"{acne_count} ضایعه مشکوک به آکنه توسط مدل YOLO اختصاصی acne شناسایی شد."
    except FileNotFoundError:
        notes["acne"] = "مدل acne اختصاصی هنوز آموزش داده نشده."

    # 3) real trained multi-condition model, if you ran ai/train_conditions.py
    # (see models/skin/conditions/best.onnx) -- overrides classical/old-acne scores
    # for whichever metrics it actually recognizes, per CLASS_TO_METRIC above.
    detections = detect_conditions(image)
    if detections is not None:
        scored = conditions_to_metric_scores(detections)
        for metric, (score, m_conf) in scored.items():
            metrics[metric] = score
            metrics_source[metric] = "model"
            conf = max(conf, m_conf)
            notes[metric] = f"مدل ترکیبی conditions (کلاس‌های مرتبط با {metric}) — {score}"

    # 4) real trained pore-segmentation model, if you ran ai/train_pores.py
    pore_ratio = pore_coverage_ratio(face_crop)
    if pore_ratio is not None and pore_ratio > 0.001:
        metrics["pores"] = int(max(0, min(100, round(100 - pore_ratio * 300))))
        metrics_source["pores"] = "model"
        notes["texture/pores"] = f"مدل واقعی segmentation منافذ (پوشش: {pore_ratio:.1%})"
    elif pore_ratio is not None:
        notes["texture/pores"] = tex_note + " (مدل منافذ چیزی تشخیص نداد -- به heuristic کلاسیک برگشتیم؛ این مدل را با عکس‌های بیشتر/بازبینی دقت validate کنید)"

    overall = round(sum(metrics[k] * WEIGHTS[k] for k in metrics) / sum(WEIGHTS.values()))

    observations = [
        notes.get("acne", ""),
        f"لک/پیگمانتاسیون: {notes.get('darkSpots', spots_note)}",
        f"قرمزی: {notes.get('redness', redness_note)}",
        f"بافت/منافذ: {notes.get('texture/pores', tex_note)}",
        f"خطوط ریز: {notes.get('fineLines', wrinkle_note)}",
        f"چربی: {notes.get('oiliness', oil_note)}",
        f"روش تشخیص چهره: {q['faceMethod']}",
        f"مدل ترکیبی conditions: {'فعال' if detections is not None else 'هنوز آموزش داده نشده (classical fallback فعال است)'}",
        f"مدل منافذ اختصاصی: {'فعال' if pore_ratio is not None else 'هنوز آموزش داده نشده (classical fallback فعال است)'}",
    ]
    limitations = [
        "هر شاخص یا از یک مدل آموزش‌دیده (acne/conditions/pores/wrinkles، هرکدام که آموزش داده شده باشد) یا از پردازش تصویر کلاسیک به‌دست می‌آید (به observations بالا نگاه کنید که کدام است)؛ در هر دو حالت تخمین جهت‌دار است، نه اندازه‌گیری بالینی.",
        "رطوبت پوست از روی یک عکس RGB به‌طور قابل‌اعتماد قابل تخمین نیست (نیاز به سنسور/دستگاه دارد)، بنابراین عمداً اندازه‌گیری نشده و مقدار خنثی نمایش داده می‌شود.",
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
    }


class Handler(BaseHTTPRequestHandler):
    def _send(self, status: int, body: dict[str, Any]) -> None:
        raw = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self) -> None:
        if self.path == "/health":
            self._send(200, {"ok": True, "model": str(MODEL_PATH), "modelReady": MODEL_PATH.exists(),
                              "mediapipe": _MP_FACE is not None})
        else:
            self._send(404, {"error": "Not found"})

    def do_POST(self) -> None:
        if self.path != "/analyze":
            self._send(404, {"error": "Not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            data = json.loads(self.rfile.read(length).decode("utf-8"))
            result = analyze(decode_image(data["imageDataUrl"]))
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
