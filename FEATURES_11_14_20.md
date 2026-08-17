# Poosta — Features 11, 14–20

Implemented on top of `poosta-app-10-items-complete.zip`.

11. Product Detail — enriched product detail with safety metadata and Patch Test entry point.
14. Weekly Routine — new `/routine/weekly` page; scheduled strong actives appear only on their configured weekdays.
15. Patch Test — new `/patch-test` page with 3-day tracking and reaction states.
16. Product Expiration — My Products now stores opened/expiry dates and shows a warning when fewer than 14 days remain.
17. Real Notifications — browser Notification permission + real OS/browser notifications using the Notification API; reminder times are scheduled while the app is running.
18. Better Progress — progress page now includes scan history plus daily check-in/diary activity counters and quick links.
19. Daily Check-in — new `/check-in` page and `daily_checkins` Supabase table.
20. Skin Diary — new `/diary` page and `skin_diary` Supabase table.

Supabase additions:
- `user_products.opened_at`
- `user_products.expires_at`
- `user_products.added_via`
- `daily_checkins`
- `skin_diary`
- `patch_tests`
- RLS policies for the new user-owned tables

Important:
- Browser notifications require HTTPS/localhost and user permission.
- Scheduled reminders use browser timers; true background push scheduling would require Web Push + a server/cron layer.
- `npm run build` could not be executed in the sandbox because the project's npm dependencies were not installed and network installation was unavailable. All 67 TS/TSX source files were syntax-transpiled successfully with the globally installed TypeScript parser.
