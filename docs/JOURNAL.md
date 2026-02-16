## [2026-02-16]
- Done: Simplified app to 3 focused categories (`square_color`, `mate_in_1`, `mate_in_2`) with open-ended sessions, autosave per answer, explicit end-session control, and stale active-session auto-close on next app open.
- Done: Removed disappearing-board exercise flow and switched board rendering to `react-chessboard`.
- Done: Added Lichess puzzle import service with local cache + fallback puzzle set for mate-in-1 and mate-in-2.
- Done: Reworked dashboard to compact per-category progress cards and updated tests/build.
- Decisions: Keep manual "End Session" available, but session safety does not depend on it.
- Next: Run one end-to-end manual check in browser for start/answer/close/reopen/sync with real Supabase credentials.

## [2026-02-16]
- Done: Built v1 Blindfold Chess Trainer (React + TS + Vite PWA) with 5 adaptive exercise stages, local-first persistence, Supabase GitHub auth/sync hooks, progress dashboard, badges/streaks, review queue, tests, and GitHub Pages workflow.
- Decisions: Chosen architecture is static PWA on GitHub Pages + Supabase for secure cross-device sync; audio prompts optional by default.
- Next: Wire real Supabase project keys, apply `supabase/schema.sql`, and run first end-to-end sync test across laptop/phone.
