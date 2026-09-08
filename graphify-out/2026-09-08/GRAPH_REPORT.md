# Graph Report - poosta  (2026-09-08)

## Corpus Check
- 110 files · ~480,177 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 618 nodes · 1249 edges · 50 communities (40 shown, 10 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.66)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ac97ed62`
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
- Coach.tsx
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
- _absolute_dataset_yaml
- MetricBar.tsx
- notificationService.ts
- Poosta — Local Skin AI
- smoke-v1.mjs
- vite-env.d.ts
- FEATURES_11_14_20.md
- IMPLEMENTED_10_ITEMS.md
- skin/README.md
- PRODUCT_CATALOG_INTEGRATION.md
- import-products-local.mjs
- ProductDetail.tsx
- AppState
- TopBar.tsx
- Result.tsx
- DailyCheckIn
- WeeklyRoutine.tsx
- useAuth.ts

## God Nodes (most connected - your core abstractions)
1. `useAppStore` - 51 edges
2. `getDb()` - 23 edges
3. `TopBar()` - 21 edges
4. `Button()` - 20 edges
5. `analyze()` - 19 edges
6. `Card()` - 17 edges
7. `AppState` - 17 edges
8. `compilerOptions` - 17 edges
9. `Poosta Pharmacy V1 — Design Spec` - 16 edges
10. `scripts` - 12 edges

## Surprising Connections (you probably didn't know these)
- `analyzeWithPremiumProvider()` --calls--> `analyzeSkinWithGemini()`  [EXTRACTED]
  server.js → gemini-skin-analysis.js
- `analyzeWithPremiumProvider()` --calls--> `analyzeSkinWithOpenRouter()`  [EXTRACTED]
  server.js → openrouter-skin-analysis.js
- `main()` --calls--> `getDb()`  [EXTRACTED]
  scripts/seed-license.mjs → server/db.mjs
- `main()` --calls--> `newId()`  [EXTRACTED]
  scripts/seed-license.mjs → server/db.mjs
- `main()` --calls--> `nowIso()`  [EXTRACTED]
  scripts/seed-license.mjs → server/db.mjs

## Import Cycles
- None detected.

## Communities (50 total, 10 thin omitted)

### Community 0 - "useAppStore"
Cohesion: 0.16
Nodes (10): Button(), Props, Variant, VARIANT_CLASSES, DailyCheckIn(), feelings, fields, Privacy() (+2 more)

### Community 1 - "server.js"
Cohesion: 0.06
Nodes (68): analyzeSkinWithGemini(), GEMINI_URL(), METRIC_KEYS, RESPONSE_SCHEMA, analyzeSkinWithOpenRouter(), METRIC_KEYS, FEATURES, main() (+60 more)

### Community 2 - "skin_ai_server.py"
Cohesion: 0.06
Nodes (54): _box_center_in_roi(), detect_conditions(), list_condition_boxes(), ndarray, Optional real multi-class lesion detector (models/skin/conditions/best.onnx).  C, Pixel boxes {label,x,y,w,h,conf,source} or None if model missing., Returns {class_name: {count, avg_conf}} or None if the model is missing.      ro, _try_load() (+46 more)

### Community 3 - "scripts"
Cohesion: 0.06
Nodes (31): better-sqlite3, lucide-react, dependencies, better-sqlite3, lucide-react, react, react-dom, react-router-dom (+23 more)

### Community 4 - "Poosta Pharmacy V1 — Design Spec"
Cohesion: 0.08
Nodes (25): 10. Seed & ops, 11. Module layout (server), 12. Failure handling, 13. Testing (V1), 14. Decisions log (from product conversation), 15. Success criteria, 1. Goal, 2. Non-goals (explicit) (+17 more)

### Community 5 - "useAppStore.ts"
Cohesion: 0.29
Nodes (8): BUDGETS, IMPORTANCE_LABEL, VARIANTS, routineTrackerService, emptyProfile, RoutineLog, RoutinePeriod, Budget

### Community 6 - "devDependencies"
Cohesion: 0.08
Nodes (25): autoprefixer, eslint, eslint-plugin-react-hooks, devDependencies, autoprefixer, eslint, eslint-plugin-react-hooks, postcss (+17 more)

### Community 7 - "compilerOptions"
Cohesion: 0.08
Nodes (23): DOM, DOM.Iterable, ES2020, src, compilerOptions, baseUrl, isolatedModules, jsx (+15 more)

### Community 8 - "types/index.ts"
Cohesion: 0.12
Nodes (15): CATEGORY_ICON, ProductCard(), EmptyState(), Barcode(), CATEGORIES, Products(), barcodeService, CATEGORY_SET (+7 more)

### Community 9 - "MultiFolderDataset"
Cohesion: 0.17
Nodes (13): build_model(), discover(), main(), masked_bce_or_mse(), MultiFolderDataset, Path, Train a multi-task severity/condition classifier from one or more Roboflow CLASS, Finds every _classes.csv under data_dir. Returns (folder, df, label_cols). (+5 more)

### Community 10 - "Coach.tsx"
Cohesion: 0.18
Nodes (10): Chip(), Props, Coach(), Msg, SUGGESTIONS, Onboarding(), StepDef, STEPS (+2 more)

### Community 11 - "merge_condition_datasets.py"
Cohesion: 0.26
Nodes (13): _area(), _iou(), _load_names(), main(), merge_lesions(), nms_same_class(), normalize(), Path (+5 more)

### Community 12 - "recommendationEngine.ts"
Cohesion: 0.14
Nodes (14): BUDGET_MAX, GOAL_TO_METRIC, PREGNANCY_UNSAFE_ACTIVES, recommendationEngine, RECOVERY_WEEKDAYS, RoutineOptions, SKIN_TYPE_LABELS_FA, STRONG_ACTIVE_WEEKDAYS (+6 more)

### Community 13 - "Local Skin AI setup"
Cohesion: 0.18
Nodes (10): ⚠️ Fitzpatrick17k — نیمه‌واقعی, Local Skin AI setup, ✅ SCIN — برای diversity/robustness (نه یک مدل مستقیم), ✅ Wrinkles — FFHQ-Wrinkle (واقعی و استفاده‌شدنی), آکنه (بدون تغییر), اجرا, نتیجه, هر شاخص از کجا میاد (+2 more)

### Community 14 - "ingredientService.ts"
Cohesion: 0.22
Nodes (9): IngredientScanner(), ALIASES, IngredientMatch, IngredientMatchStatus, IngredientScanResult, ingredientService, interactionChecker, Ingredient (+1 more)

### Community 15 - "File map"
Cohesion: 0.20
Nodes (9): Execution note, File map, Global Constraints, Pharmacy V1 Implementation Plan, Task 1: DB + storage + seed, Task 2: License module + API routes, Task 3: Sessions, scans, annotate pipeline, Task 4: Frontend activation + analysis headers (+1 more)

### Community 16 - "skinAnalysisService.ts"
Cohesion: 0.29
Nodes (7): analyzePixels(), loadImage(), PixelStats, KEYS, skinAnalysisService, validateProviderResult(), ImageQualityResult

### Community 17 - "compilerOptions"
Cohesion: 0.22
Nodes (8): vite.config.ts, compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 18 - "productService.ts"
Cohesion: 0.21
Nodes (8): App(), isPublicPath(), MAIN_ROUTES, OPEN_WHEN_LOCKED, BottomNav(), ITEMS, Profile(), SKIN_TYPE_FA

### Community 19 - "skin.ts"
Cohesion: 0.17
Nodes (13): CompatibilityResult, Product, ProductConcern, ScoredProduct, AIImageQuality, Gender, Goal, ImageQualityIssue (+5 more)

### Community 20 - "services/index.ts"
Cohesion: 0.22
Nodes (10): useRoutineTracker(), Analyzing(), PHRASES, Home(), TOOLS, Routine(), todayKey(), weatherService (+2 more)

### Community 22 - "deviceLicenseService.ts"
Cohesion: 0.17
Nodes (8): SendRoutineSms(), Activate(), authHeaders(), deviceLicenseService, getDeviceToken(), LicenseStatus, routineShareService, ShareRoutineResult

### Community 23 - "main"
Cohesion: 0.15
Nodes (15): _latest_best_pt(), main(), Path, Export a trained Ultralytics checkpoint to ONNX for deployment.  imgsz must matc, resolve_weights(), main(), Fine-tune a pretrained Ultralytics YOLO model for acne/skin-lesion detection. Da, _absolute_dataset_yaml() (+7 more)

### Community 24 - "_absolute_dataset_yaml"
Cohesion: 0.22
Nodes (7): Card(), Props, Props, METHODS, MyProducts(), PatchTest(), patchTestService

### Community 25 - "MetricBar.tsx"
Cohesion: 0.60
Nodes (4): bandFor(), BANDS, MetricBar(), Props

### Community 27 - "Poosta — Local Skin AI"
Cohesion: 0.50
Nodes (3): AI architecture, Poosta — Local Skin AI, Run

### Community 28 - "smoke-v1.mjs"
Cohesion: 0.83
Nodes (3): assert(), main(), req()

### Community 43 - "ProductDetail.tsx"
Cohesion: 0.22
Nodes (8): MedicalDisclaimer(), useSkinScan(), ProductDetail(), GUIDES, resizeThumb(), Scan(), SharedPayload, SharedRoutine()

### Community 44 - "AppState"
Cohesion: 0.29
Nodes (11): CoachContext, CoachReply, AppState, ProductCategory, Routine, SkinProfile, AppUser, ChatMessage (+3 more)

### Community 45 - "TopBar.tsx"
Cohesion: 0.23
Nodes (7): Props, TopBar(), useAuth(), Auth(), Consent(), POINTS, SkinDiary()

### Community 46 - "Result.tsx"
Cohesion: 0.28
Nodes (6): Props, ScoreRing(), Progress(), Result(), METRIC_LABELS_FA, SkinMetricKey

### Community 47 - "DailyCheckIn"
Cohesion: 0.33
Nodes (3): DailyCheckIn, PatchTest, SkinDiaryEntry

## Knowledge Gaps
- **173 isolated node(s):** `METRIC_KEYS`, `RESPONSE_SCHEMA`, `METRIC_KEYS`, `name`, `private` (+168 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useAppStore` connect `services/index.ts` to `useAppStore`, `useAppStore.ts`, `types/index.ts`, `Coach.tsx`, `ProductDetail.tsx`, `TopBar.tsx`, `ingredientService.ts`, `Result.tsx`, `skinAnalysisService.ts`, `useAuth.ts`, `productService.ts`, `WeeklyRoutine.tsx`, `deviceLicenseService.ts`, `_absolute_dataset_yaml`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `scripts`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Why does `get_model()` connect `skin_ai_server.py` to `main`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **What connects `METRIC_KEYS`, `RESPONSE_SCHEMA`, `METRIC_KEYS` to the rest of the system?**
  _173 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `server.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06142728093947606 - nodes in this community are weakly interconnected._
- **Should `skin_ai_server.py` be split into smaller, more focused modules?**
  _Cohesion score 0.059027777777777776 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._