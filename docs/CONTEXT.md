# Blindfold Chess Trainer - Session Context

## Tech Details

- Runtime: Node.js 20+
- Frontend: React 18, TypeScript 5, Vite 6
- Async/sync flow: TanStack Query
- Chess logic: `chess.js`
- Board UI: `react-chessboard`
- PWA: `vite-plugin-pwa`
- Cloud sync/auth: Supabase + GitHub OAuth
- Puzzle import: Lichess Puzzle API (`/api/puzzle/next`)

## Strict Constraints

- Keep app friction low: single-category sessions, auto-save after each answer.
- Mobile and desktop both supported (responsive + PWA installable).
- Local-first behavior must work without Supabase config.
- No secrets in repo docs or code.
- Keep scope minimal: only `square_color`, `mate_in_1`, `mate_in_2`.

## Project Structure

```text
.
|-- README.md
|-- docs/
|   |-- CONTEXT.md
|   `-- JOURNAL.md
|-- src/
|   |-- App.tsx
|   |-- main.tsx
|   |-- styles.css
|   |-- components/
|   |   |-- BoardView.tsx
|   |   |-- Dashboard.tsx
|   |   `-- ExerciseCard.tsx
|   |-- engine/
|   |   |-- adaptive.ts
|   |   |-- exercises.ts
|   |   |-- scoring.ts
|   |   `-- session.ts
|   |-- services/
|   |   |-- localDb.ts
|   |   |-- puzzleProvider.ts
|   |   |-- supabase.ts
|   |   `-- sync.ts
|   `-- data/
|       `-- puzzles.ts
|-- supabase/
|   `-- schema.sql
`-- .github/workflows/deploy.yml
```

## Conventions

- Prefer strict TypeScript types at module boundaries.
- Keep exercise generation pure and testable.
- Persist user/session state in `localStorage` first, then sync.
- Keep all category names in `ExerciseStage` union:
  - `square_color`
  - `mate_in_1`
  - `mate_in_2`
- Tests live beside domain modules as `*.test.ts`.
