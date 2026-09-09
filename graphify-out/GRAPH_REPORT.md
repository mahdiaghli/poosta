# Graph Report - poosta  (2026-09-08)

## Corpus Check
- 125 files · ~488,753 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 691 nodes · 1509 edges · 49 communities (41 shown, 8 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.64)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ea3cea22`
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
1. `useAppStore` - 59 edges
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
Cohesion: 0.07
Nodes (50): pore_coverage_ratio(), ndarray, Optional real pore segmentation model (models/skin/pores/best.onnx)., _try_load(), predict_region_probs(), ndarray, Optional image-level classifier for oily / dry / enlarged-pores / redness / wrin, Map class probabilities to (score, note). Presence of a concern lowers the score (+42 more)

### Community 3 - "scripts"
Cohesion: 0.06
Nodes (31): better-sqlite3, lucide-react, dependencies, better-sqlite3, lucide-react, react, react-dom, react-router-dom (+23 more)

### Community 4 - "Poosta Pharmacy V1 — Design Spec"
Cohesion: 0.08
Nodes (25): 10. Seed & ops, 11. Module layout (server), 12. Failure handling, 13. Testing (V1), 14. Decisions log (from product conversation), 15. Success criteria, 1. Goal, 2. Non-goals (explicit) (+17 more)

### Community 5 - "useAppStore.ts"
Cohesion: 0.22
Nodes (9): getKioskPhone(), kioskHandoffService, setKioskPhone(), setLastServerScanId(), notificationService, timers, emptyProfile, ScoredProduct (+1 more)

### Community 6 - "devDependencies"
Cohesion: 0.08
Nodes (25): autoprefixer, eslint, eslint-plugin-react-hooks, devDependencies, autoprefixer, eslint, eslint-plugin-react-hooks, postcss (+17 more)

### Community 7 - "compilerOptions"
Cohesion: 0.08
Nodes (23): DOM, DOM.Iterable, ES2020, src, compilerOptions, baseUrl, isolatedModules, jsx (+15 more)

### Community 8 - "types/index.ts"
Cohesion: 0.21
Nodes (13): Coach(), Msg, SUGGESTIONS, CoachContext, CoachReply, coachService, AppState, ProductCategory (+5 more)

### Community 9 - "MultiFolderDataset"
Cohesion: 0.17
Nodes (13): build_model(), discover(), main(), masked_bce_or_mse(), MultiFolderDataset, Path, Train a multi-task severity/condition classifier from one or more Roboflow CLASS, Finds every _classes.csv under data_dir. Returns (folder, df, label_cols). (+5 more)

### Community 10 - "Button.tsx"
Cohesion: 0.17
Nodes (14): Props, TopBar(), Button(), Props, Variant, VARIANT_CLASSES, Card(), Props (+6 more)

### Community 11 - "merge_condition_datasets.py"
Cohesion: 0.23
Nodes (15): _area(), drop_region_sized_boxes(), _iou(), _load_names(), main(), merge_lesions(), nms_same_class(), normalize() (+7 more)

### Community 12 - "recommendationEngine.ts"
Cohesion: 0.15
Nodes (14): Onboarding(), StepDef, STEPS, StepType, BUDGET_MAX, GOAL_TO_METRIC, PREGNANCY_UNSAFE_ACTIVES, recommendationEngine (+6 more)

### Community 13 - "Local Skin AI setup"
Cohesion: 0.18
Nodes (10): ⚠️ Fitzpatrick17k — نیمه‌واقعی, Local Skin AI setup, ✅ SCIN — برای diversity/robustness (نه یک مدل مستقیم), ✅ Wrinkles — FFHQ-Wrinkle (واقعی و استفاده‌شدنی), آکنه (بدون تغییر), اجرا, نتیجه, هر شاخص از کجا میاد (+2 more)

### Community 14 - "ingredientService.ts"
Cohesion: 0.14
Nodes (11): IngredientScanner(), authService, ALIASES, IngredientMatch, IngredientMatchStatus, IngredientScanResult, ingredientService, interactionChecker (+3 more)

### Community 15 - "File map"
Cohesion: 0.20
Nodes (9): Execution note, File map, Global Constraints, Pharmacy V1 Implementation Plan, Task 1: DB + storage + seed, Task 2: License module + API routes, Task 3: Sessions, scans, annotate pipeline, Task 4: Frontend activation + analysis headers (+1 more)

### Community 16 - "skinAnalysisService.ts"
Cohesion: 0.31
Nodes (7): analyzePixels(), loadImage(), PixelStats, KEYS, skinAnalysisService, validateProviderResult(), ImageQualityResult

### Community 17 - "compilerOptions"
Cohesion: 0.22
Nodes (8): vite.config.ts, compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 18 - "productService.ts"
Cohesion: 0.12
Nodes (22): App(), isPublicPath(), KIOSK_NAV_ROUTES, MAIN_ROUTES, OPEN_WHEN_LOCKED, useAuth(), useKioskIdle(), Activate() (+14 more)

### Community 19 - "skin.ts"
Cohesion: 0.17
Nodes (12): CATEGORY_ICON, ProductCard(), Chip(), Props, EmptyState(), METHODS, CATEGORIES, Products() (+4 more)

### Community 20 - "services/index.ts"
Cohesion: 0.31
Nodes (5): Props, ScoreRing(), TOOLS, weatherService, WeatherInfo

### Community 22 - "deviceLicenseService.ts"
Cohesion: 0.17
Nodes (8): SendRoutineSms(), SharedPayload, SharedRoutine(), deviceLicenseService, LicenseStatus, getLastServerScanId(), routineShareService, ShareRoutineResult

### Community 23 - "main"
Cohesion: 0.10
Nodes (24): _box_ok(), _clip_roi(), detect_conditions(), _is_lesion_label(), list_condition_boxes(), ndarray, Optional real multi-class lesion detector (models/skin/conditions/best.onnx).  P, Pixel boxes {label,x,y,w,h,conf,source} or None if model missing. (+16 more)

### Community 24 - "useAppStore"
Cohesion: 0.18
Nodes (11): CompatibilityResult, ProductConcern, AIImageQuality, Gender, Goal, ImageQualityIssue, Sensitivity, SkinAnalysisImageEvidence (+3 more)

### Community 25 - "MetricBar.tsx"
Cohesion: 0.27
Nodes (6): KioskVisitActions(), Props, MedicalDisclaimer(), Progress(), METRIC_LABELS_FA, SkinMetricKey

### Community 26 - "TopBar.tsx"
Cohesion: 0.19
Nodes (13): BottomNav(), CONSUMER, KIOSK, isKioskUi(), useKioskMode(), useSkinScan(), Result(), GUIDES (+5 more)

### Community 27 - "Poosta — Local Skin AI"
Cohesion: 0.50
Nodes (3): AI architecture, Poosta — Local Skin AI, Run

### Community 28 - "smoke-v1.mjs"
Cohesion: 0.83
Nodes (3): assert(), main(), req()

### Community 35 - "ai/code.py"
Cohesion: 0.42
Nodes (7): beep(), PharmacyDashboard(), PrintScanSlip(), clearStaffAuth(), getStaffToken(), pharmacyStaffService, staffHeaders()

### Community 37 - "code.py"
Cohesion: 0.14
Nodes (16): useRoutineTracker(), Home(), BUDGETS, IMPORTANCE_LABEL, Routine(), VARIANTS, routineTrackerService, todayKey() (+8 more)

### Community 43 - "productService.ts"
Cohesion: 0.33
Nodes (6): CATEGORY_SET, LOCAL_CATALOG, mapDbProduct(), normalizeCategory(), normalizeProduct(), SKIN_TYPES

### Community 44 - "AppState"
Cohesion: 0.60
Nodes (4): bandFor(), BANDS, MetricBar(), Props

### Community 47 - "DailyCheckIn"
Cohesion: 0.25
Nodes (4): patchTestService, DailyCheckIn, PatchTest, SkinDiaryEntry

## Knowledge Gaps
- **182 isolated node(s):** `METRIC_KEYS`, `RESPONSE_SCHEMA`, `METRIC_KEYS`, `name`, `private` (+177 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useAppStore` connect `productService.ts` to `code.py`, `useAppStore.ts`, `types/index.ts`, `Button.tsx`, `recommendationEngine.ts`, `Profile.tsx`, `ingredientService.ts`, `skinAnalysisService.ts`, `skin.ts`, `services/index.ts`, `deviceLicenseService.ts`, `MetricBar.tsx`, `TopBar.tsx`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `scripts`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **What connects `METRIC_KEYS`, `RESPONSE_SCHEMA`, `METRIC_KEYS` to the rest of the system?**
  _182 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `server.js` be split into smaller, more focused modules?**
  _Cohesion score 0.054664080409098925 - nodes in this community are weakly interconnected._
- **Should `skin_ai_server.py` be split into smaller, more focused modules?**
  _Cohesion score 0.07130333138515488 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `Poosta Pharmacy V1 — Design Spec` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._