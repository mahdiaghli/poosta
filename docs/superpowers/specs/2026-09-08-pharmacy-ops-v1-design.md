# Poosta Pharmacy Ops V1.1 — Design Spec

**Date:** 2026-09-08  
**Status:** Approved in conversation  
**Extends:** `2026-09-08-pharmacy-v1-design.md`

## Goal

Add pharmacy staff operations on top of licensing + scans + SMS:

1. Pharmacy dashboard (today’s scans, recommended products)
2. Live notify + sound when a kiosk scan completes
3. Kiosk session reset after customer finishes
4. `pharmacy_products` (price / stock / availability)
5. Tiny admin UI (create pharmacy, revoke device, renew subscription)
6. Print product/routine slip via browser print (shop printer)
7. Returning customer **progress by phone** (same pharmacy + phone)

## Customer identity

- Optional phone on kiosk (and when sending SMS routine)
- `customers(pharmacy_id, phone)` unique
- Scans / shares / product snapshots link to `customer_id` when phone known
- Progress = compare latest scan metrics/overallScore vs previous for that customer

## Staff & admin auth

- Staff: `POST /api/pharmacy/login` with `pharmacy_code` + `pin` → staff token
- Admin: header `X-Poosta-Admin-Key` matching `POOSTA_ADMIN_KEY`

## Print

- Server stores recommended products JSON on scan finalize (from client or recomputed stub)
- Printable page `/print/scan/:id` and `/print/share/:token` — browser Print dialog
- No Windows print agent in this version

## Live updates

- Dashboard polls `GET /api/pharmacy/scans/today?since=` every few seconds
- Play short beep when new scan ids appear

## Kiosk reset

- Button clears local Zustand customer scan/routine UI state (keep device token) and navigates home/welcome

## Non-goals

Network printer agent, online payment, auto-retrain, S3, full CRM
