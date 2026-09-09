# Graph Report - poosta  (2026-09-08)

## Corpus Check
- 123 files · ~487,895 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 683 nodes · 1475 edges · 49 communities (41 shown, 8 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.65)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `57c42868`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useAppStore
- server.js
- skin_ai_server.py
- scripts
- Poosta Pharmacy V1 — Design Spec
- useAppStore.ts
- devDependencies
- compilerOptions
- types/index.ts
- MultiFolderDataset
- Button.tsx
- merge_condition_datasets.py
- recommendationEngine.ts
- Local Skin AI setup
- ingredientService.ts
- File map
- skinAnalysisService.ts
- compilerOptions
- productService.ts
- skin.ts
- services/index.ts
- LocalStorageDriver
- deviceLicenseService.ts
- main
- useAppStore
- MetricBar.tsx
- TopBar.tsx
- Poosta — Local Skin AI
- smoke-v1.mjs
- vite-env.d.ts
- FEATURES_11_14_20.md
- IMPLEMENTED_10_ITEMS.md
- skin/README.md
- PRODUCT_CATALOG_INTEGRATION.md
- import-products-local.mjs
- ai/code.py
- code.py
- productService.ts
- AppState
- Profile.tsx
- DailyCheckIn

## God Nodes (most connected - your core abstractions)
1. `useAppStore` - 55 edges
2. `getDb()` - 43 edges
3. `Button()` - 26 edges
4. `TopBar()` - 24 edges
5. `analyze()` - 23 edges
6. `Card()` - 21 edges
7. `newId()` - 19 edges
8. `nowIso()` - 19 edges
9. `AppState` - 17 edges
10. `compilerOptions` - 17 edges

## Surprising Connections (you probably didn't know these)
- `analyzeWithPremiumProvider()` --calls--> `analyzeSkinWithGemini()`  [EXTRACTED]
  server.js → gemini-skin-analysis.js
- `analyzeWithPremiumProvider()` --calls--> `analyzeSkinWithOpenRouter()`  [EXTRACTED]
  server.js → openrouter-skin-analysis.js
- `main()` --calls--> `getDb()`  [EXTRACTED]
  scripts/seed-license.mjs → server/db.mjs
- `main()` --calls--> `hashPin()`  [EXTRACTED]
  scripts/seed-license.mjs → server/db.mjs
- `main()` --calls--> `newId()`  [EXTRACTED]
  scripts/seed-license.mjs → server/db.mjs

## Import Cycles
- None detected.

## Communities (49 total, 8 thin omitted)

### Community 0 - "useAppStore"
Cohesion: 0.22
Nodes (8): Customer identity, Goal, Kiosk reset, Live updates, Non-goals, Poosta Pharmacy Ops V1.1 — Design Spec, Print, Staff & admin auth

### Community 1 - "server.js"
Cohesion: 0.05
Nodes (89): analyzeSkinWithGemini(), GEMINI_URL(), METRIC_KEYS, RESPONSE_SCHEMA, analyzeSkinWithOpenRouter(), METRIC_KEYS, FEATURES, main() (+81 more)

### Community 2 - "skin_ai_server.py"
Cohesion: 0.06
Nodes (58): _box_ok(), _clip_roi(), detect_conditions(), _is_lesion_label(), list_condition_boxes(), ndarray, Optional real multi-class lesion detector (models/skin/conditions/best.onnx).  P, Pixel boxes {label,x,y,w,h,conf,source} or None if model missing. (+50 more)

### Community 3 - "scripts"
Cohesion: 0.06
Nodes (31): better-sqlite3, lucide-react, dependencies, better-sqlite3, lucide-react, react, react-dom, react-router-dom (+23 more)

### Community 4 - "Poosta Pharmacy V1 — Design Spec"
Cohesion: 0.08
Nodes (25): 10. Seed & ops, 11. Module layout (server), 12. Failure handling, 13. Testing (V1), 14. Decisions log (from product conversation), 15. Success criteria, 1. Goal, 2. Non-goals (explicit) (+17 more)

### Community 5 - "useAppStore.ts"
Cohesion: 0.16
Nodes (12): authService, deviceLicenseService, getKioskPhone(), getLastServerScanId(), kioskHandoffService, setKioskPhone(), setLastServerScanId(), notificationService (+4 more)

### Community 6 - "devDependencies"
Cohesion: 0.08
Nodes (25): autoprefixer, eslint, eslint-plugin-react-hooks, devDependencies, autoprefixer, eslint, eslint-plugin-react-hooks, postcss (+17 more)

### Community 7 - "compilerOptions"
Cohesion: 0.08
Nodes (23): DOM, DOM.Iterable, ES2020, src, compilerOptions, baseUrl, isolatedModules, jsx (+15 more)

### Community 8 - "types/index.ts"
Cohesion: 0.15
Nodes (15): Chip(), Props, Coach(), Msg, SUGGESTIONS, Onboarding(), StepDef, STEPS (+7 more)

### Community 9 - "MultiFolderDataset"
Cohesion: 0.17
Nodes (13): build_model(), discover(), main(), masked_bce_or_mse(), MultiFolderDataset, Path, Train a multi-task severity/condition classifier from one or more Roboflow CLASS, Finds every _classes.csv under data_dir. Returns (folder, df, label_cols). (+5 more)

### Community 10 - "Button.tsx"
Cohesion: 0.15
Nodes (11): Button(), Props, Variant, VARIANT_CLASSES, useAuth(), Auth(), Consent(), POINTS (+3 more)

### Community 11 - "merge_condition_datasets.py"
Cohesion: 0.23
Nodes (15): _area(), drop_region_sized_boxes(), _iou(), _load_names(), main(), merge_lesions(), nms_same_class(), normalize() (+7 more)

### Community 12 - "recommendationEngine.ts"
Cohesion: 0.21
Nodes (11): BUDGET_MAX, GOAL_TO_METRIC, PREGNANCY_UNSAFE_ACTIVES, recommendationEngine, RECOVERY_WEEKDAYS, RoutineOptions, SKIN_TYPE_LABELS_FA, STRONG_ACTIVE_WEEKDAYS (+3 more)

### Community 13 - "Local Skin AI setup"
Cohesion: 0.18
Nodes (10): ⚠️ Fitzpatrick17k — نیمه‌واقعی, Local Skin AI setup, ✅ SCIN — برای diversity/robustness (نه یک مدل مستقیم), ✅ Wrinkles — FFHQ-Wrinkle (واقعی و استفاده‌شدنی), آکنه (بدون تغییر), اجرا, نتیجه, هر شاخص از کجا میاد (+2 more)

### Community 14 - "ingredientService.ts"
Cohesion: 0.18
Nodes (9): ALIASES, IngredientMatch, IngredientMatchStatus, IngredientScanResult, ingredientService, interactionChecker, privacyService, Ingredient (+1 more)

### Community 15 - "File map"
Cohesion: 0.20
Nodes (9): Execution note, File map, Global Constraints, Pharmacy V1 Implementation Plan, Task 1: DB + storage + seed, Task 2: License module + API routes, Task 3: Sessions, scans, annotate pipeline, Task 4: Frontend activation + analysis headers (+1 more)

### Community 16 - "skinAnalysisService.ts"
Cohesion: 0.15
Nodes (15): analyzePixels(), loadImage(), PixelStats, KEYS, skinAnalysisService, validateProviderResult(), AIImageQuality, Gender (+7 more)

### Community 17 - "compilerOptions"
Cohesion: 0.22
Nodes (8): vite.config.ts, compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 18 - "productService.ts"
Cohesion: 0.13
Nodes (13): App(), isPublicPath(), MAIN_ROUTES, OPEN_WHEN_LOCKED, BottomNav(), ITEMS, Activate(), Analyzing() (+5 more)

### Community 19 - "skin.ts"
Cohesion: 0.18
Nodes (12): CATEGORY_ICON, ProductCard(), Barcode(), CATEGORIES, Products(), barcodeService, CATEGORY_LABELS_FA, CompatibilityResult (+4 more)

### Community 20 - "services/index.ts"
Cohesion: 0.31
Nodes (5): Props, ScoreRing(), TOOLS, weatherService, WeatherInfo

### Community 22 - "deviceLicenseService.ts"
Cohesion: 0.22
Nodes (5): authHeaders(), getDeviceToken(), LicenseStatus, routineShareService, ShareRoutineResult

### Community 23 - "main"
Cohesion: 0.14
Nodes (16): _try_load(), _latest_best_pt(), main(), Path, Export a trained Ultralytics checkpoint to ONNX for deployment.  imgsz must matc, resolve_weights(), main(), Fine-tune a pretrained Ultralytics YOLO model for acne/skin-lesion detection. Da (+8 more)

### Community 24 - "useAppStore"
Cohesion: 0.17
Nodes (13): useRoutineTracker(), DailyCheckIn(), feelings, fields, Home(), IngredientScanner(), PatchTest(), Result() (+5 more)

### Community 25 - "MetricBar.tsx"
Cohesion: 0.19
Nodes (11): KioskVisitActions(), SendRoutineSms(), Card(), Props, bandFor(), BANDS, MetricBar(), Props (+3 more)

### Community 26 - "TopBar.tsx"
Cohesion: 0.23
Nodes (9): Props, TopBar(), MedicalDisclaimer(), useSkinScan(), ProductDetail(), GUIDES, resizeThumb(), Scan() (+1 more)

### Community 27 - "Poosta — Local Skin AI"
Cohesion: 0.50
Nodes (3): AI architecture, Poosta — Local Skin AI, Run

### Community 28 - "smoke-v1.mjs"
Cohesion: 0.83
Nodes (3): assert(), main(), req()

### Community 35 - "ai/code.py"
Cohesion: 0.33
Nodes (8): beep(), PharmacyDashboard(), PharmacyLogin(), PrintScanSlip(), clearStaffAuth(), getStaffToken(), pharmacyStaffService, staffHeaders()

### Community 37 - "code.py"
Cohesion: 0.22
Nodes (9): routineTrackerService, todayKey(), Importance, RoutineLog, RoutineLogDay, RoutinePeriod, RoutineSource, RoutineStep (+1 more)

### Community 43 - "productService.ts"
Cohesion: 0.33
Nodes (6): CATEGORY_SET, LOCAL_CATALOG, mapDbProduct(), normalizeCategory(), normalizeProduct(), SKIN_TYPES

### Community 44 - "AppState"
Cohesion: 0.29
Nodes (5): EmptyState(), Props, METHODS, MyProducts(), productService

### Community 47 - "DailyCheckIn"
Cohesion: 0.21
Nodes (7): patchTestService, AppState, DailyCheckIn, PatchTest, SkinDiaryEntry, Budget, ScanComparison

## Knowledge Gaps
- **180 isolated node(s):** `METRIC_KEYS`, `RESPONSE_SCHEMA`, `METRIC_KEYS`, `name`, `private` (+175 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useAppStore` connect `useAppStore` to `useAppStore.ts`, `types/index.ts`, `Button.tsx`, `AppState`, `Profile.tsx`, `skinAnalysisService.ts`, `productService.ts`, `skin.ts`, `services/index.ts`, `MetricBar.tsx`, `TopBar.tsx`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `scripts`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **What connects `METRIC_KEYS`, `RESPONSE_SCHEMA`, `METRIC_KEYS` to the rest of the system?**
  _180 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `server.js` be split into smaller, more focused modules?**
  _Cohesion score 0.054664080409098925 - nodes in this community are weakly interconnected._
- **Should `skin_ai_server.py` be split into smaller, more focused modules?**
  _Cohesion score 0.06189640035118525 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `Poosta Pharmacy V1 — Design Spec` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._