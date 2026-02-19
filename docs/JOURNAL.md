## [2026-02-19]
- Done: Implemented `docs/design/IMPLEMENTATION_PLAN.md` with a full UI-shell refactor (`TopBar`, `TabNav`, `TrainingSetupPanel`, `RunStatusPanel`, `FocusedTrainingOverlay`) while preserving existing exercise/session domain logic.
- Done: Added explicit typed UI state surface in `src/types.ts` and surfaced required runtime states (catalog/sync/delete/loading/offline/no-active/focused) near affected controls.
- Done: Rebuilt `src/styles.css` around semantic design tokens (typography, spacing, colors, motion), improved focused-mode ergonomics, and fixed mobile reveal reachability regression found in design audit.
- Done: Updated progress filter defaults to follow current training context and improved trend empty-state messaging.
- Done: Passed full validation (`npm run test`, `npm run build`, `npm run e2e:smoke`, `npm run e2e:design`).
- Decisions: Keep the premium-dark direction and compact focused-mode metrics, with mobile-first board sizing to keep grading controls in-viewport.
- Next: Review design screenshots/traces in `test-results/` and run one manual Playwright MCP polish pass on typography density and tablet spacing.

## [2026-02-19]
- Done: Completed comprehensive redesign research pack with source-traceable UX decisions (`RESEARCH_METHOD`, `UX_RESEARCH_CORPUS`, `DESIGN_PRINCIPLES`, `TARGET_EXPERIENCE_SPEC`, `VISUAL_SYSTEM_SPEC`, `COMPETITOR_TEARDOWN`, `DECISION_MATRIX`).
- Done: Updated `docs/CONTEXT.md` to include redesign knowledge base links and canon for future implementation sessions.
- Decisions: Locked target design posture to premium minimal training-lab UX for serious improvers (5-60 min/day), while keeping current 2-drill scope and future drill extensibility.
- Next: Implement the redesigned UI against `docs/TARGET_EXPERIENCE_SPEC.md` and `docs/VISUAL_SYSTEM_SPEC.md`, then run `npm run audit:design` and fix the highest-severity findings first.

## [2026-02-18]
- Done: Made Codex web profile default in `.codex/config.toml` and required Playwright MCP startup, so browser tooling is auto-enabled when launching Codex in-repo.
- Done: Added one-shot `npm run audit:design` pipeline (unit tests + build + smoke + design-capture Playwright runs).
- Done: Added `AGENTS.md` rule to auto-run critical design audits when requested, then iterate fixes with evidence from screenshots/traces.
- Done: Added visual capture spec (`e2e/design/critical-views.spec.ts`) for training/focused/progress design snapshots across desktop+iPhone+Pixel emulation.
- Next: Ask Codex for a critical design review and let it execute the full audit loop, then implement the top severity UI findings.

## [2026-02-18]
- Done: Added Codex browser automation setup with `.codex/config.toml` Playwright MCP server (`--isolated`, traces, artifact output).
- Done: Added Playwright smoke infrastructure (`playwright.config.ts`, `e2e/smoke/*`) for desktop + iPhone + Pixel viewport checks.
- Done: Added stable `data-testid` hooks for training/progress tabs, start/stop controls, focused overlay, board, and grading actions.
- Done: Updated scripts/docs for local agent visual loop (`dev:host`, `e2e`, `e2e:smoke`, `e2e:ui`) and artifact handling.
- Next: Run a Codex-guided visual polish pass in focused mode and fix any layout/ergonomic regressions found in screenshots/traces.

## [2026-02-18]
- Done: Reworked focused mode for mobile real estate: overlay is now scrollable with safe-area padding (`dvh` + `env()`), compact board sizing, and sticky/reachable grading controls.
- Done: Added focused-card variant with larger touch targets (44px+ baseline, 56px in focused mode) and compact reveal state showing only small continuation text + board + right/wrong actions.
- Done: Added compact `BoardView` variant to cap board size in focused answer view for shorter screens.
- Done: Built and tested after UI changes (`npm run build`, `npm test -- --run`).
- Done: Added signed-in "Delete Data Everywhere" flow that deletes remote Supabase `attempts/sessions` before local reset, preventing sync repopulation after reset.
- Done: Added `Training` / `Progress` tabs and a new `ProgressView` with session trend graphs (accuracy and average response time) plus existing summary tables.
- Done: Added focused exercise mode overlay with fullscreen request on start and automatic return to main app on stop/end.
- Done: Added tests for remote deletion flow (`src/services/sync.test.ts`) and session trend generation (`src/engine/session.test.ts`).
- Done: Updated progress charts to use exercise-indexed trailing 20-attempt moving averages for accuracy and speed.
- Done: Added progress trend filters per exercise/category and capped chart history to latest 1000 MA points per selected category.
- Done: Migrated Puzzle Recall from Syzygy/tablebase to static Lichess shards (`public/puzzles/lichess/p{piece}/r{bucket}.json`) with manifest v6.
- Done: Added offline data pipeline (`scripts/download_lichess_db.py`, `scripts/build_lichess_puzzles.py`) and updated npm scripts.
- Done: Switched runtime settings to exact `pieceCount (3..8)` + `ratingBucket (200-step)` and updated combo progress stats.
- Done: Tightened Lichess build filters for simple/obvious puzzles (simple tactical themes, popularity/play-count minimums, short full lines only) and improved per-combo motif diversity balancing.
- Done: Added fast iteration mode via `--max-rows` plus `npm run puzzles:build:tiny` and refreshed static shards with a bounded subset run (`--max-rows 80000`, 92 puzzles).
- Done: Fixed puzzle phase alignment by advancing one setup move before storing the seed position; continuation now starts at the tactical response and uses cleaner move text formatting.
- Done: Rebuilt dense static shards after the alignment fix (`3541` puzzles, 38 combo shards).
- Done: Redesigned UI to a dark, smoother, lower-distraction layout.
- Done: Removed obsolete Syzygy scripts/assets and Supabase `puzzle_bank` / edge puzzle-fetch path.
- Next: Mobile browser smoke test on at least 2 viewport sizes (small Android + iPhone) for focused-mode scroll reachability, board visibility, and right/wrong button ergonomics.

## [2026-02-17]
- Done: Reduced app scope to two drills (`square_color`, `puzzle_recall`) and kept local-first + Supabase sync flow.
- Next: Improve puzzle diversity and simplify pipeline.
