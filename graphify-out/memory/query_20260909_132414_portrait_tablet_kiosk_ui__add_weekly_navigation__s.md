---
type: "query"
date: "2026-09-09T13:24:14.273275+00:00"
question: "Portrait tablet kiosk UI: add weekly navigation, stronger weekly routine CTA, remove consent, add staff utilities, enforce first-run license, show cloud analysis directly, and fix /onboarding route"
contributor: "graphify"
outcome: "useful"
source_nodes: ["App()", "Onboarding()", "Activate()", "Scan()", "WeeklyRoutine()", "BottomNav()", "staffLogin()"]
---

# Q: Portrait tablet kiosk UI: add weekly navigation, stronger weekly routine CTA, remove consent, add staff utilities, enforce first-run license, show cloud analysis directly, and fix /onboarding route

## Answer

Expanded from original query via graph vocab: [onboarding, license, weekly, routine, staff, consent, analyzing, cloud, scan, kiosk, nav, activate]. Implemented a 640px portrait shell, app-wide license gate, onboarding and consent redirect routes, direct scan flow without consent state, visible cloud analysis action, stronger weekly routine CTA, staff metrics and distinct operational shortcuts, and inventory deep-linking. Vite production bundle passed.

## Outcome

- Signal: useful

## Source Nodes

- App()
- Onboarding()
- Activate()
- Scan()
- WeeklyRoutine()
- BottomNav()
- staffLogin()