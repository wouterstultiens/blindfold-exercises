## [2026-02-17]
- Done: Reworked puzzle DB generation to blindfold-focused hybrid mode (`lichess` + `tablebase`) with new builder flags (`--max-plies`, `--sources`, `--tablebase-budget`, low-piece endgame toggle) and manifest metadata (`sourcesUsed`, histograms, profile).
- Done: Updated runtime puzzle filtering to 4-ply clarity, allowed low-piece endgame themes, added `tablebase_api` source type, and kept short-line fallback for <=7 pieces.
- Done: Updated puzzle recall UI defaults to 2..7 pieces (including kings), refreshed docs, and expanded provider tests (low-piece endgame, tablebase seed acceptance, >4-ply rejection).
- Next: Run `npm run puzzles:build:blindfold` to regenerate `public/puzzles/*`, then do a browser smoke test for `Puzzle Recall` at `2..7 pieces` and confirm instant load.

## [2026-02-17]
- Done: Added puzzle DB builder piece-cap filter (`--max-pieces` / `PUZZLES_MAX_PIECES`) with persisted state+manifest metadata and resume mismatch guard.
- Done: Added piece-cap skip metrics in run totals (`skippedPieceCap`) to track low-piece filtering impact.
- Decisions: Piece-cap changes now require `--reset` to avoid mixing shard populations across different max-piece policies.
- Done: Ran `npm run puzzles:build -- --reset --rows 50000 --max-pieces 6` (`rowsProcessed: 50000`, `rowsKept: 0`, `skippedPieceCap: 47137`).
- Next: Continue with `npm run puzzles:build -- --rows 50000 --max-pieces 6`; if keeps remain near zero, relax tactical/endgame exclusions while keeping short continuation.

## [2026-02-17]
- Done: Tightened puzzle selection to short tactical/checkmate lines only (runtime filter + builder filter).
- Done: Updated puzzle DB builder to parse `Themes`, exclude endgame/very-long themes, cap continuation at 6 plies, and persist theme tags.
- Done: Updated puzzle provider tests for new tactical/checkmate gating behavior and added themed-tactics coverage.
- Done: Started regeneration with `npm run puzzles:build -- --reset --rows 50000` (`rowsProcessed: 50000`, `rowsKept: 20341`).
- Next: Continue with `npm run puzzles:build -- --rows 50000` until desired shard depth, then commit updated `public/puzzles/*`.

## [2026-02-17]
- Done: Converted puzzle DB builder to incremental/resumable mode with `public/puzzles/build-state.json` so each run processes a chunk and resumes later.
- Done: Added build flags `--rows`, `--full`, `--reset` and increased default per-bucket cap for gradual population over multiple days.
- Done: Verified resume behavior with two consecutive chunk runs (rowsProcessed advanced `50000 -> 100000` and shard counts increased).
- Decisions: Keep GH Pages deploy simple by serving committed `public/puzzles/*` assets instead of rebuilding puzzle DB in CI.
- Next: Continue running `npm run puzzles:build -- --rows 50000` until desired dataset size, then commit updated `public/puzzles/*`.

## [2026-02-17]
- Done: Replaced puzzle recall runtime loading with static local puzzle DB shards (`public/puzzles/*`) and removed live Lichess + bank fallback flow from client provider.
- Done: Added on-demand puzzle DB builder (`scripts/build-puzzle-db.mjs`, `npm run puzzles:build`) that reads `lichess_db_puzzle.csv.zst` via `zstd` and emits manifest + rating shard JSON files.
- Done: Updated tests/docs and simplified Vite config by removing the dev Lichess proxy path.
- Decisions: Keep puzzle ingestion fully separated from gameplay; runtime puzzle loading is static-file only.
- Next: Run `npm run puzzles:build` on a machine with `zstd`, then do one browser smoke test for `Puzzle Recall` (`3 pieces @ 750` and `12 pieces @ 1500`) and verify instant loading.

## [2026-02-17]
- Done: Hardened puzzle live loading so edge function `401/403/404` is treated as unavailable and direct Lichess fetch is still attempted cleanly.
- Done: Added direct Lichess retry/backoff on `429/5xx` in the client puzzle provider.
- Done: Added fallback tests for edge-function-missing + direct retry path; full suite/build pass (`npm test`, `npm run build`).
- Next: Run one signed-in browser check on `Puzzle Recall` (`3 pieces @ 750` and `12 pieces @ 1500`) to confirm no combined function+Lichess error message and verify practical availability for strict settings.

## [2026-02-17]
- Done: Reworked puzzle loading to be live-first with fallback bank (`puzzle_bank`) and local recent-ID anti-repeat memory.
- Done: Added Supabase Edge Function `puzzle-fetch` with exponential backoff for Lichess `429/5xx`, puzzle normalization, and trusted DB upsert.
- Done: Added puzzle bank client service + tests for cache-hit and bank-fallback flows.
- Decisions: Keep direct browser Lichess fetch as a last-resort fallback when edge function/config is unavailable.
- Next: Deploy `puzzle-fetch`, apply updated `supabase/schema.sql`, then verify in production that `puzzle_bank` fills while puzzle loads stay reliable during Lichess throttling.

## [2026-02-17]
- Done: Fixed square color parity so standard colors are correct (`a1/h8` black, `h5` white).
- Done: Changed training flow to require explicit `Start`; exercises no longer preload and timer starts only when exercise is visible.
- Done: Added local dev Lichess request proxy logging in Vite (`logs/lichess-dev.log` + terminal lines with request id/status/duration).
- Decisions: Mode/settings changes end the current run and require pressing `Start` again.
- Next: Run `npm run dev`, solve 2-3 puzzles, and confirm request lines appear in `logs/lichess-dev.log` for every puzzle fetch.

## [2026-02-17]
- Done: Reduced app to 2 exercises only (`square_color`, `puzzle_recall`) and removed mate/adaptive/XP/badges/review flows.
- Done: Added puzzle recall flow with max-pieces + target-rating filters (`+-100`), side-to-move + piece-list prompt, reveal continuation notation, and reveal board.
- Done: Kept Supabase GitHub auth/sync and reworked progress views to session history over time + puzzle combo stats (attempts, correct%).
- Decisions: Session auto-starts on first answer and auto-splits on mode/settings change; puzzle board is reveal-only.
- Next: Run one real cross-device sync test (laptop and phone) with the same GitHub account and verify combo stats/session history match.

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
