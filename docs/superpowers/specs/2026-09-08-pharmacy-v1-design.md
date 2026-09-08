# Poosta Pharmacy V1 — Design Spec

**Date:** 2026-09-08  
**Status:** Approved in conversation; awaiting final file review before implementation plan  
**Approach:** Extend current Node `server.js` monolith with modules (not a new API package)

---

## 1. Goal

Turn the current single-device Poosta web app into a **thin B2B kiosk backend** that:

1. Locks usage to **activated devices** under an **annual subscription** (Basic / Pro feature flags).
2. Stores each scan’s **original image**, **annotations JSON**, and **overlay image** privately for **later manual model training** (never auto-retrain; the operator trains offline when ready).
3. Returns **customer-safe results only** (metrics / text / routine) — never overlay URLs or storage keys.
4. Keeps **Gemini / OpenRouter** as premium vision providers (no Chat Plus / OpenAI in V1).
5. Does **not** include pharmacy dashboard UI, admin UI, Redis/queues, or object-storage deployment.
6. **SMS “Send Routine”** is included: customer enters phone → server creates share link → Kavenegar (or console stub) → public `/r/:token` daily/weekly viewer (no face images).

---

## 2. Non-goals (explicit)

- Pharmacy staff dashboard / print agent  
- Full admin panel (seed/CLI only)  
- Managed Postgres / S3 in production (local SQLite + local files; S3 driver stub only)  
- Android Keystore device crypto, OTA staged rollouts  
- Online payment  
- Automatic model retraining from collected scans  

---

## 3. Architecture

```text
Browser / Tablet (Poosta React)
        │ HTTPS (Vite proxy /api → :8787)
        ▼
Node API (server.js + server/*.mjs modules)
  ├── Device auth + license middleware
  ├── Sessions / scans
  ├── Skin analysis (existing Gemini → OpenRouter → local Python)
  ├── Annotation builder (JSON + overlay)
  └── Feature flags from plan
        │
   ┌────┼────────────┐
   ▼    ▼            ▼
SQLite  Storage     AI (Python :8788)
        (local dir;
         S3 interface stub)
```

**License enforcement is server-side.** The client may cache a short-lived device token; the API is the source of truth.

**Dev escape hatch:** `POOSTA_LICENSE_REQUIRED=false` (default in `.env.example`) allows `/api/skin-analysis` without a device token so local development keeps working. Production sets `true`.

---

## 4. Data model (SQLite)

Path: `{POOSTA_DATA_DIR}/poosta.sqlite` (default `data/poosta.sqlite`).

### Tables

| Table | Columns (V1) |
|-------|----------------|
| `pharmacies` | id, name, city, status, created_at |
| `plans` | id, name (`basic` \| `pro`), max_devices |
| `plan_features` | plan_id, feature_key, enabled |
| `subscriptions` | id, pharmacy_id, plan_id, started_at, expires_at, status |
| `devices` | id, pharmacy_id, device_code, activation_code, status, last_seen, app_version, registered_at |
| `device_tokens` | id, device_id, token_hash, expires_at |
| `sessions` | id, pharmacy_id, device_id, status, created_at, ended_at |
| `scans` | id, session_id, pharmacy_id, device_id, mode, status, provider, customer_result_json, original_key, overlay_key, annotations_key, created_at |

### Plan features (V1 keys)

| Key | Basic | Pro |
|-----|-------|-----|
| `skin_analysis` | on | on |
| `accurate_analysis` | on | on |
| `product_recommendation` | on | on |
| `advanced_analysis` | off | on |
| `multi_device` | off | on |

Pro also gets higher `max_devices` (e.g. 3 vs 1). Feature flags are returned to the app; unfinished Pro UI may stay hidden until later releases.

### Subscription status

- `active` while `now < expires_at`  
- Soft messaging can be client-side later; V1 API rejects when `status != active` or `now > expires_at` (optional grace: **3 days** after expiry still allowed — implement as `expires_at + grace`).

---

## 5. Storage

**Interface:** `StorageDriver` with `put(key, buffer|string)`, `get(key)`, `exists(key)`.

**V1 driver:** `LocalStorageDriver` under `{POOSTA_DATA_DIR}/scans/...`.

**Stub:** `S3StorageDriver` not configured; same interface for a later switch.

**Key layout:**

```text
scans/YYYY/MM/DD/scan_<id>/
  original.jpg
  overlay.jpg
  annotations.json
```

- Directory is **not** exposed via static HTTP.  
- Customer APIs never return these keys or file URLs.

---

## 6. Device activation & tokens

1. Seed creates pharmacy + Basic subscription + device row with `activation_code` (e.g. `PST-XXXX-XXXX`).  
2. App shows Activation screen; user enters code.  
3. `POST /api/device/activate` → validates code, marks device active, returns opaque device token (~24h) + pharmacy/plan/features.  
4. App stores token in `localStorage` (`poosta:deviceToken`).  
5. `POST /api/device/heartbeat` refreshes token and updates `last_seen` / `app_version`.  
6. Max devices: refuse activation if pharmacy already at `plans.max_devices` active devices.  
7. Revoke: set `devices.status = revoked` (via SQL/seed helper); subsequent API calls fail.

Token storage: store **hash only** in DB; return raw token once to client.

---

## 7. Scan & annotation flow

```text
Consent → (optional) ensure device token
  → POST /api/sessions
  → Capture / upload image
  → POST /api/scans  (stores original)
  → Run analysis (standard | accurate) via existing pipeline
  → Build annotations.json + overlay.jpg (best-effort)
  → Update scan row; return customer payload only
  → Client runs recommendationEngine as today
```

### Customer payload

Existing `SkinAnalysisResult` shape (metrics, concerns, observations, etc.). No `overlay`, no storage keys, no training labels beyond what is already shown as UX text.

### annotations.json (private)

- scan_id, pharmacy_id, device_id, mode, provider, created_at  
- metrics, concerns, observations, confidence  
- `boxes`: array of `{ label, x, y, w, h, source }` when available  
  - Prefer local YOLO / face-region detections from Python when present  
  - Premium providers: optional regions if schema extended; otherwise face box / empty boxes + full metrics still saved  
- raw provider notes as needed for training export  

### overlay.jpg

Server draws boxes + short labels on a copy of the original (Node `sharp` or small Python helper). If no boxes exist, overlay may be a copy of original with a corner watermark `poosta-train` — still useful as paired file; prefer skip watermark-only and only write overlay when ≥1 box (document choice: **write overlay whenever we have ≥1 box; if none, omit overlay_key**).

### Analysis modes (unchanged providers)

| Mode | Behavior |
|------|----------|
| `standard` | Local Python only; use detections for boxes |
| `accurate` | Gemini then OpenRouter; persist structured result; boxes from premium if any, else best-effort from local face pass if we run a cheap local detect for boxes only |

**V1 decision for accurate + boxes:** After premium metrics succeed, optionally call local `/analyze` **or** a lightweight face-box endpoint solely to obtain boxes for overlay/training — do not replace premium metrics with local metrics. If local box pass fails, save JSON without boxes and skip overlay.

### Consent

Update Consent page copy: accurate mode may send the image to configured cloud providers; originals and private annotations may be retained to improve service quality / models; data is not shown publicly.

---

## 8. API contracts

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/health` | none | ok, db, storage, ai flags |
| POST | `/api/device/activate` | none | `{ activation_code, app_version? }` → token + license |
| POST | `/api/device/heartbeat` | device token | refresh token |
| GET | `/api/license/status` | device token | plan, expiry, features |
| POST | `/api/sessions` | device token* | create session |
| POST | `/api/scans` | device token* | body: session_id + image (data URL or multipart); stores original |
| POST | `/api/skin-analysis` | device token* | existing; also persists annotations when scan_id provided |
| GET | `/api/scans/:id` | device token* | customer-safe result only |

\* When `POOSTA_LICENSE_REQUIRED=false`, session/scan/analysis may run in **legacy mode** (no pharmacy binding; optional anonymous scan storage under pharmacy_id `local-dev`).

### Error codes (JSON `error` + `code`)

- `DEVICE_NOT_ACTIVATED`  
- `SUBSCRIPTION_EXPIRED`  
- `LICENSE_REVOKED`  
- `DEVICE_LIMIT_REACHED`  
- `FEATURE_DISABLED`  
- `INVALID_TOKEN`  

Persian `error` string for UI; machine `code` for branching.

---

## 9. Frontend changes (minimal)

1. **Activation page** (`/activate`): enter code; call activate; save token; redirect home/scan.  
2. **Boot gate:** if `licenseRequired` (from `/health` or env-injected Vite flag) and no valid token → `/activate`. Heartbeat on interval / focus.  
3. **`skinAnalysisService`:** send `Authorization: Bearer …`; pass `sessionId` / `scanId` when available.  
4. **`useAppStore.runScan`:** create session+scan when API supports it; keep local Zustand history for UX.  
5. **Consent** copy update.  
6. **Results UI:** unchanged — no overlay.

Vite: proxy `/api` unchanged. Optional `VITE_LICENSE_REQUIRED` mirroring server for UX gate (server still enforces).

---

## 10. Seed & ops

Script: `npm run seed:license` → `scripts/seed-license.mjs`

- Upserts Basic + Pro plans and features  
- Creates demo pharmacy  
- Creates 1-year Basic subscription  
- Creates device with fresh activation code; prints code to console  

Env (`.env.example`):

```text
POOSTA_DATA_DIR=data
POOSTA_LICENSE_REQUIRED=false
POOSTA_SUBSCRIPTION_GRACE_DAYS=3
# existing GEMINI_* / OPENROUTER_* unchanged
```

Add `data/` to `.gitignore` if not already (scans + sqlite must not be committed).

---

## 11. Module layout (server)

```text
server.js                 # HTTP router, wires modules
server/db.mjs             # SQLite open + migrations
server/storage.mjs        # LocalStorageDriver + interface
server/license.mjs        # activate, heartbeat, middleware
server/sessions.mjs       # sessions + scans CRUD
server/annotate.mjs       # build JSON + draw overlay
server/auth-middleware.mjs
scripts/seed-license.mjs
```

Dependencies to add: `better-sqlite3` (or `sql.js` if native build is painful on Windows — prefer `better-sqlite3`; fallback `sql.js` if install fails), and `sharp` for overlay (or Python OpenCV helper called once). Prefer **sharp** for Node-side overlay to avoid extra Python IPC; if sharp install fails on Windows, fall back to writing annotations JSON only and log overlay skip.

---

## 12. Failure handling

| Failure | Behavior |
|---------|----------|
| Analysis OK, storage/annotate fails | Return customer metrics; log server error; scan status `completed_partial` |
| Invalid/expired token | 401 + code; app → Activation / renew message |
| Subscription expired (+ past grace) | 403 `SUBSCRIPTION_EXPIRED` |
| Premium unavailable in accurate mode | Keep current 503 Persian message |
| License required off | Legacy analysis path works |

---

## 13. Testing (V1)

- Seed → activate → heartbeat → create session → scan with fixture image → assert files on disk + customer JSON has no storage keys  
- Expired subscription → analysis rejected  
- Second device activation against Basic max_devices=1 → `DEVICE_LIMIT_REACHED`  
- `POOSTA_LICENSE_REQUIRED=false` → analysis without token still works  

---

## 14. Decisions log (from product conversation)

| Topic | Decision |
|-------|----------|
| Vision provider | Keep Gemini / OpenRouter (not Chat Plus) |
| Annotations | Both JSON labels + overlay image |
| Storage | Local private folder + swappable driver interface |
| Licensing depth | Thin spine + seed; no admin UI |
| SMS | Out of V1 |
| Monolith vs new API | Extend `server.js` |
| Auto-retrain from new scans | **No** — V1 only collects assets under `data/scans/`; training stays a manual operator step (`ai:train` etc.) |

---

## 15. Success criteria

- First pharmacy can activate one tablet with a printed code and run scans.  
- Expired or copied-APK devices without activation cannot call analysis when license required.  
- Each successful scan leaves private training assets (at least `original` + `annotations.json`; overlay when boxes exist).  
- Customer UI never shows annotations/overlay.  
- Existing standard/accurate analysis behavior preserved for local dev with license flag off.
