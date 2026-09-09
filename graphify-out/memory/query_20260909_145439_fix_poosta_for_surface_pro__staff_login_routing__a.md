---
type: "query"
date: "2026-09-09T14:54:39.106946+00:00"
question: "Fix Poosta for Surface Pro, staff login routing, and no-HTTPS tablet camera capture"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Welcome()", "Scan()", "useKioskMode()", "PharmacyLogin()", "PharmacyDashboard()"]
---

# Q: Fix Poosta for Surface Pro, staff login routing, and no-HTTPS tablet camera capture

## Answer

Expanded Surface Pro responsive shell widths, corrected ورود کارکنان to the pharmacy login and dashboard, and added a native capture-file fallback when getUserMedia is unavailable on LAN HTTP. Production build and smoke suite pass.

## Outcome

- Signal: useful

## Source Nodes

- Welcome()
- Scan()
- useKioskMode()
- PharmacyLogin()
- PharmacyDashboard()