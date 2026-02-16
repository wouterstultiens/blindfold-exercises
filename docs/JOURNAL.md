## [2026-02-16]
- Done: Built v1 Blindfold Chess Trainer (React + TS + Vite PWA) with 5 adaptive exercise stages, local-first persistence, Supabase GitHub auth/sync hooks, progress dashboard, badges/streaks, review queue, tests, and GitHub Pages workflow.
- Decisions: Chosen architecture is static PWA on GitHub Pages + Supabase for secure cross-device sync; audio prompts optional by default.
- Next: Wire real Supabase project keys, apply `supabase/schema.sql`, and run first end-to-end sync test across laptop/phone.
