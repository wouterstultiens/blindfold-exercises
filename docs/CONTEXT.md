# Blindfold Chess Trainer - Session Context

## Tech Details

- Runtime: Node.js 20+
- Frontend: React 18, TypeScript 5, Vite 6
- E2E/browser tooling: Playwright (`@playwright/test`) + Playwright MCP
- Chess logic: `chess.js`
- Board UI: `react-chessboard`
- Puzzle build tooling: Python 3, `python-chess`, `zstandard`
- Puzzle source: offline Lichess DB (`lichess_db_puzzle.csv.zst`) -> static shards in `public/puzzles/`
- Auth/sync: Supabase + GitHub OAuth

## Strict Constraints

- App scope is exactly 2 exercises:
  - `square_color`
  - `puzzle_recall`
- Puzzle Recall is static-file only at runtime:
  - no per-puzzle Lichess API calls
  - no live edge-function puzzle fetching
- Puzzle settings:
  - exact `pieceCount` in `3..8`
  - fixed `ratingBucket` in 200-point steps
- Puzzle selection rules:
  - must match exact `(pieceCount, ratingBucket)` combo
  - puzzle seed starts after the first Lichess move (opponent setup ply)
  - continuation length `<= 4` plies
  - avoid immediate repeats with local recent-ID memory (combo-scoped)
- Puzzle build filters (offline):
  - keep only simple tactical themes and exclude advanced/noisy motifs
  - enforce minimum `Popularity` + `NbPlays` from Lichess DB
  - balance motifs per combo (limit over-dominant motifs)
  - support `--max-rows` for tiny fast iteration runs
- Progress reporting includes combo stats per `(pieceCount, ratingBucket)`.
- UI layout:
  - separate `Training` and `Progress` tabs
  - `Progress` tab includes trailing 20-exercise moving-average graphs (accuracy + avg response time), capped to latest 1000 points
  - Progress trends can be filtered per exercise/category (`square_color` and puzzle `(pieceCount, ratingBucket)` categories)
- Session lifecycle:
  - starts only when user clicks `Start`
  - enters focused fullscreen-style exercise view while running
  - closes on explicit end/stop or when mode/settings change
- Data reset behavior:
  - guest: local-only reset
  - signed-in: delete attempts/sessions in Supabase first, then clear local
- No secrets in `docs/`.
- Browser smoke checks target desktop Chromium + iPhone + small Android viewports.
- Keep stable `data-testid` hooks for core controls used by agent/E2E flows.
- Repo-level `AGENTS.md` defines an automatic UI/design audit loop (`npm run audit:design`) for Codex.
- Redesign research docs live in `docs/design/` and are the source of truth for target UX decisions:
  - `docs/design/RESEARCH_METHOD.md`
  - `docs/design/UX_RESEARCH_CORPUS.md`
  - `docs/design/DESIGN_PRINCIPLES.md`
  - `docs/design/TARGET_EXPERIENCE_SPEC.md`
  - `docs/design/VISUAL_SYSTEM_SPEC.md`
  - `docs/design/COMPETITOR_TEARDOWN.md`
  - `docs/design/DECISION_MATRIX.md`

## Project Structure

```text
.
|-- README.md
|-- docs/
|   |-- CONTEXT.md
|   |-- design/
|   |   |-- RESEARCH_METHOD.md
|   |   |-- UX_RESEARCH_CORPUS.md
|   |   |-- DESIGN_PRINCIPLES.md
|   |   |-- TARGET_EXPERIENCE_SPEC.md
|   |   |-- VISUAL_SYSTEM_SPEC.md
|   |   |-- COMPETITOR_TEARDOWN.md
|   |   `-- DECISION_MATRIX.md
|   `-- JOURNAL.md
|-- scripts/
|   |-- build_lichess_puzzles.py
|   `-- download_lichess_db.py
|-- e2e/
|   |-- design/
|   `-- smoke/
|-- AGENTS.md
|-- playwright.config.ts
|-- .codex/config.toml
|-- src/
|   |-- App.tsx
|   |-- styles.css
|   |-- types.ts
|   |-- components/
|   |   |-- BoardView.tsx
|   |   |-- Dashboard.tsx
|   |   |-- ExerciseCard.tsx
|   |   |-- FocusedTrainingOverlay.tsx
|   |   |-- ProgressView.tsx
|   |   |-- RunStatusPanel.tsx
|   |   |-- SessionMomentum.tsx
|   |   |-- TabNav.tsx
|   |   |-- TopBar.tsx
|   |   `-- TrainingSetupPanel.tsx
|   |-- engine/
|   |   |-- exercises.ts
|   |   `-- session.ts
|   `-- services/
|       |-- localDb.ts
|       |-- puzzleProvider.ts
|       |-- supabase.ts
|       `-- sync.ts
|-- public/puzzles/
|   |-- manifest.json
|   `-- lichess/
`-- supabase/schema.sql
```

## Conventions

- Keep module boundaries strongly typed.
- Keep exercise logic pure where practical.
- Persist locally first, then sync.
- Keep tests beside domain modules as `*.test.ts`.
- Keep browser smoke flows under `e2e/smoke/*.spec.ts`.
- Keep design capture flows under `e2e/design/*.spec.ts`.
- Commit docs updates with code changes whenever rules/workflow change.
- For redesign work, treat `docs/design/TARGET_EXPERIENCE_SPEC.md` + `docs/design/VISUAL_SYSTEM_SPEC.md` as canonical "what" specs before implementation changes.
