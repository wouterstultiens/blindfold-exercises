# Blindfold Chess Trainer - Session Context

## Tech Details

- Runtime: Node.js 20+
- Frontend: React 18, TypeScript 5, Vite 6
- Chess logic: `chess.js`
- Board UI: `react-chessboard`
- PWA: `vite-plugin-pwa`
- Auth + cloud sync: Supabase + GitHub OAuth
- Puzzle source at runtime: generated static files in `public/puzzles/*`
- Puzzle DB builder: `scripts/build-puzzle-db.mjs` (Node + `zstd` CLI, incremental/resumable, hybrid Lichess + tablebase)
- Input dataset: `lichess_db_puzzle.csv.zst`

## Strict Constraints

- Scope is fixed to exactly 2 exercises:
  - `square_color`
  - `puzzle_recall`
- Puzzle filter rules:
  - `pieceCount <= maxPieces`
  - `rating in [targetRating - 100, targetRating + 100]`
  - continuation must be short and clear (`<= 4` plies by default)
  - low-piece endgames are allowed for blindfold-friendly pools
- Puzzle loading for `puzzle_recall`:
  - load static `manifest.json`
  - load needed rating shard(s)
  - avoid immediate repeats with local recent-ID memory
- Puzzle DB generation:
  - `npm run puzzles:build` resumes from `public/puzzles/build-state.json`
  - optional flags: `--rows N`, `--max-pieces N`, `--max-plies N`, `--sources lichess,tablebase`, `--tablebase-budget N`, `--full`, `--reset`
  - default blindfold profile uses 2..7 pieces (including kings), 4 plies max, hybrid sources
  - changing any filter/source knob requires `--reset` (state consistency guard)
- Puzzle review must show continuation notation and board only after `View Answer`.
- Training must require explicit `Start` before showing an exercise.
- Timer starts only when an exercise is visible.
- Session tracking must show progress over time.
- Progress must sync across devices when signed in.
- No secrets in docs/ or committed code.

## Project Structure

```text
.
|-- README.md
|-- docs/
|   |-- CONTEXT.md
|   `-- JOURNAL.md
|-- scripts/
|   `-- build-puzzle-db.mjs
|-- src/
|   |-- App.tsx
|   |-- main.tsx
|   |-- styles.css
|   |-- types.ts
|   |-- components/
|   |   |-- BoardView.tsx
|   |   |-- Dashboard.tsx
|   |   `-- ExerciseCard.tsx
|   |-- engine/
|   |   |-- exercises.ts
|   |   `-- session.ts
|   |-- services/
|   |   |-- localDb.ts
|   |   |-- puzzleProvider.ts
|   |   |-- supabase.ts
|   |   `-- sync.ts
|   `-- lib/
|       |-- chessBoard.ts
|       `-- random.ts
|-- public/
|   |-- icon.svg
|   `-- puzzles/ (generated)
|-- supabase/
|   `-- schema.sql
`-- .github/workflows/deploy.yml
```

## Conventions

- Keep types strict at module boundaries.
- Keep exercise generation/evaluation pure where possible.
- Persist locally first (`localStorage`), then sync to Supabase.
- Session changes:
  - open only when user clicks `Start`
  - close on explicit end or when mode/settings change
- Keep tests beside domain modules as `*.test.ts`.
- Puzzle DB is generated on demand with `npm run puzzles:build`; runtime only reads static shard files.
