# Blindfold Chess Trainer - Session Context

## Tech Details

- Runtime: Node.js 20+
- Frontend: React 18, TypeScript 5, Vite 6
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

## Project Structure

```text
.
|-- README.md
|-- docs/
|   |-- CONTEXT.md
|   `-- JOURNAL.md
|-- scripts/
|   |-- build_lichess_puzzles.py
|   `-- download_lichess_db.py
|-- src/
|   |-- App.tsx
|   |-- styles.css
|   |-- types.ts
|   |-- components/
|   |   |-- BoardView.tsx
|   |   |-- Dashboard.tsx
|   |   |-- ExerciseCard.tsx
|   |   `-- ProgressView.tsx
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
- Commit docs updates with code changes whenever rules/workflow change.
