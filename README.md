# Poosta

Poosta is a local-first skincare and skin-condition analysis platform built around a browser app, a Node.js backend, and a Python AI inference service. The project combines a React + TypeScript frontend with OpenCV-based image analysis, YOLO-based detection, and cloud-provider fallback analysis for skin assessments.

This repository contains the full workflow for:
- face image capture and quality validation
- local skin scoring and condition analysis
- model training and export pipelines
- scan storage, sessions, and pharmacy/admin workflows
- optional cloud-based analysis fallback via OpenAI, Gemini, and OpenRouter

---

## Highlights

- Frontend: React, TypeScript, Vite, Tailwind
- Backend/API: Node.js + SQLite + HTTP server
- AI inference: Python + OpenCV + Ultralytics YOLO + MediaPipe/Haar fallback
- Cloud fallback: OpenAI, Gemini, and OpenRouter providers
- Local-first architecture: keeps scan and inference processing on-device/local server when possible
- Training pipeline: dataset export and model export utilities for skin models

---

## Architecture

```text
Browser / React UI
        ↓
   Node.js server
        ↓
  Quality + image checks
        ↓
  Local Python AI service
        ↓
   OpenCV heuristics + YOLO models
        ↓
   Cloud fallback (OpenAI / Gemini / OpenRouter)
```

The main runtime flow is defined in:
- frontend app under `src/`
- API orchestration in `server.js`
- Python analysis in `ai/skin_ai_server.py`
- model logic in `ai/conditions_model.py`, `ai/pores_model.py`, `ai/wrinkle_model.py`, and `ai/region_model.py`

---

## Project Structure

```text
poosta/
├── src/                     # React + TypeScript frontend
├── server/                  # backend modules for sessions, products, staff, licensing, etc.
├── ai/                      # Python AI pipeline and training scripts
│   ├── skin_ai_server.py    # local inference service for skin metrics
│   ├── train_acne.py        # acne YOLO training
│   ├── train_conditions.py  # condition dataset training
│   ├── conditions_model.py  # condition model wrapper
│   ├── pores_model.py       # pore detection model wrapper
│   ├── region_model.py      # region scoring model
│   ├── wrinkle_model.py     # wrinkle model/fallback logic
│   └── requirements.txt     # Python dependencies
├── data/                   # application data, SQLite database, scans
├── datasets/               # training datasets and metadata
├── models/                 # trained model outputs
├── scripts/                # export, backup, seed, smoke-test utilities
├── server.js               # main Node.js server entrypoint
├── package.json            # npm scripts and dependencies
├── vite.config.ts         # Vite setup
├── tailwind.config.ts     # Tailwind setup
├── index.html             # app entry
├── README.md              # project documentation
└── .env.example / local config values (if present in your environment)
```

---

## Features

### Skin analysis workflow
- face detection and image quality validation before scoring
- ROI-based analysis for cheek, T-zone, forehead, and under-eye regions
- skin segmentation based on LAB color distances and face-region masking
- color, roughness, and edge-based metrics for:
  - redness
  - dark spots / pigmentation
  - pores
  - texture
  - fine lines / wrinkles
  - oiliness

### Model-backed detection
- YOLO-based acne and condition detection
- trained model export flow for local analysis
- optional trained wrinkle and pore models when available

### Cloud fallback
When local models are unavailable or the analysis path requires broader inference, the backend can fallback to:
- OpenAI
- Google Gemini
- OpenRouter

These providers are handled in `server.js` and the provider-specific analysis scripts under the root (`gemini-skin-analysis.js`, `openrouter-skin-analysis.js`, `openai-skin-analysis.js`).

### Business + operations layer
The project also includes pharmacy and operations modules for:
- scan sessions and customer linking
- product catalogs and recommendations
- staff/pharmacy access
- audits, licensing, rate limiting, and admin management

---

## Quick Start

### 1) Install frontend and backend dependencies

```bash
npm install
```

### 2) Install Python AI dependencies

```bash
npm run ai:install
```

This installs the requirements from `ai/requirements.txt`.

### 3) Start the app

```bash
npm run dev
```

### 4) Start the Node API server

```bash
npm run api
```

The app starts the API server locally and can auto-start the Python AI service depending on environment settings.

---

## Local AI Service

The local inference service is implemented in `ai/skin_ai_server.py` and runs on a local port (default `8788`).

It exposes endpoints for:
- `/health`
- `/quality`
- `/analyze`

### Run the AI service directly

```bash
python ai/skin_ai_server.py
```

---

## Model Training and Export

### Train the acne YOLO model

```bash
npm run ai:train
```

This calls:

```bash
python ai/train_acne.py
```

### Export model artifacts

```bash
npm run ai:export
```

This points to the export workflow under `ai/export_model.py`.

### Dataset export

```bash
npm run dataset:export
```

This exports stored scan data into a training-friendly dataset format, and supports review filtering when needed:

```bash
npm run dataset:export -- --reviewed-only
```

---

## Important Notes About Metrics

The project intentionally distinguishes between:
- trained model outputs with measurable validation metrics such as `mAP50` and `mAP50-95`
- handcrafted heuristic image metrics for features like redness, dark spots, pores, texture, and wrinkles

These heuristic metrics are directional wellness signals and are not clinical diagnostic measurements. The code explicitly documents this in `ai/skin_ai_server.py` and the setup notes in `SKIN_AI_SETUP.md`.

This is important for interpretation:
- trained YOLO-based detectors are the strongest machine-learning components in the repository
- classical OpenCV metrics are useful for consumer-facing scoring and trend tracking, but are not validated clinical-grade measurements

---

## Data and Privacy

The project stores scan assets in the local data directory. For example:

```text
data/scans/<date>/scan_<id>/
  original.jpg
  annotations.json
  overlay.jpg
```



## Summary

Poosta is a practical, local-first AI skin-analysis project that blends traditional computer vision with modern deep-learning inference. The combination of a React frontend, Node.js backend, Python AI service, and vendor/provider fallback system gives it a strong end-to-end architecture for experimentation, product prototyping, and further model validation.
