"""Local AI HTTP server. No cloud/API key required.

POST /analyze with JSON: {"imageDataUrl": "data:image/jpeg;base64,..."}
The service requires models/skin/acne/best.onnx for real acne detection.
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

ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = Path(os.getenv("POOSTA_ACNE_MODEL", ROOT / "models/skin/acne/best.onnx"))
HOST = os.getenv("POOSTA_AI_HOST", "127.0.0.1")
PORT = int(os.getenv("POOSTA_AI_PORT", "8788"))

_model = None
_face_cascade = None


def get_model() -> YOLO:
    global _model
    if _model is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                f"Custom acne model not found: {MODEL_PATH}. "
                "Train/export it first."
            )
        _model = YOLO(str(MODEL_PATH))
    return _model


def face_detector():
    global _face_cascade
    if _face_cascade is None:
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        _face_cascade = cv2.CascadeClassifier(cascade_path)
    return _face_cascade


def decode_image(data_url: str) -> np.ndarray:
    if "," not in data_url:
        raise ValueError("Invalid image data URL")
    raw = base64.b64decode(data_url.split(",", 1)[1])
    pil = Image.open(io.BytesIO(raw)).convert("RGB")
    return cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)


def quality(image: np.ndarray) -> dict[str, Any]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    brightness = float(gray.mean())
    contrast = float(gray.std())
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    faces = face_detector().detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(100, 100))
    issues: list[str] = []
    if min(image.shape[:2]) < 400:
        issues.append("رزولوشن تصویر پایین است.")
    if brightness < 55:
        issues.append("نور تصویر کم است.")
    if brightness > 225:
        issues.append("نور تصویر بیش از حد زیاد است.")
    if contrast < 8:
        issues.append("کنتراست تصویر پایین است.")
    if sharpness < 30:
        issues.append("تصویر ممکن است تار باشد.")
    if len(faces) != 1:
        issues.append("دقیقاً یک چهره روبه‌رو باید در تصویر باشد.")
    face = None
    if len(faces) == 1:
        x, y, w, h = [int(v) for v in faces[0]]
        face = {"x": x, "y": y, "w": w, "h": h}
    score = 1.0 - min(0.7, 0.12 * len(issues))
    return {
        "suitable": not issues,
        "faceDetected": len(faces) == 1,
        "faceCount": int(len(faces)),
        "frontal": len(faces) == 1,
        "faceVisibility": "clear" if len(faces) == 1 else "poor",
        "qualityScore": round(max(0.0, score), 2),
        "issues": issues,
        "faceBox": face,
    }


def analyze(image: np.ndarray) -> dict[str, Any]:
    q = quality(image)
    if not q["suitable"]:
        return {"imageQuality": q, "error": q["issues"][0] if q["issues"] else "Image quality failed"}

    model = get_model()
    result = model.predict(source=image, imgsz=640, conf=0.25, verbose=False)[0]
    boxes = result.boxes
    count = int(len(boxes)) if boxes is not None else 0
    confs = boxes.conf.detach().cpu().numpy().tolist() if boxes is not None and boxes.conf is not None else []
    conf = float(np.mean(confs)) if confs else 0.0
    # This score is intentionally tied only to the trained detector output.
    acne_score = int(max(0, min(100, round(100 - min(70, count * 7) - conf * 10))))
    observations = [f"{count} ضایعه مشکوک به آکنه توسط مدل شناسایی شد."]
    limitations = [
        "این مدل برای تشخیص ضایعات آکنه آموزش داده شده و تشخیص پزشکی انجام نمی‌دهد.",
        "شاخص‌های چربی، رطوبت، منافذ، لک، بافت و خطوط ریز تا زمان اضافه شدن مدل اختصاصی جداگانه اندازه‌گیری نمی‌شوند.",
    ]
    metrics = {
        "acne": acne_score,
        "oiliness": 50,
        "hydration": 50,
        "redness": 50,
        "pores": 50,
        "darkSpots": 50,
        "texture": 50,
        "fineLines": 50,
    }
    weighted = round(acne_score * 0.34 + 50 * 0.66)
    return {
        "overallScore": weighted,
        "metrics": metrics,
        "concerns": ["acne"] if acne_score < 50 else [],
        "topOpportunities": ["acne"] if acne_score < 65 else [],
        "confidence": round(max(0.35, min(0.98, 0.45 + conf * 0.5 + q["qualityScore"] * 0.05)), 2),
        "provider": "local-yolo-acne",
        "createdAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "imageQuality": q,
        "observations": observations,
        "limitations": limitations,
        "recommendedNextStep": "برای کامل شدن تحلیل، مدل‌های redness/pigmentation/texture و ... را جداگانه آموزش دهید.",
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
            self._send(200, {"ok": True, "model": str(MODEL_PATH), "modelReady": MODEL_PATH.exists()})
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
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
