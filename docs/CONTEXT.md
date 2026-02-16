# Blindfold Chess Trainer - Session Context

## Tech Details

- Runtime: Node.js 20+
- Frontend: React 18, TypeScript 5, Vite 6
- State: Zustand
- Async/sync flow: TanStack Query
- Chess logic: `chess.js`
- Charts: Recharts
- PWA: `vite-plugin-pwa`
- Cloud sync/auth: Supabase + GitHub OAuth

## Strict Constraints

- Keep app friction low: default one-click session start.
- Mobile and desktop both supported (responsive + PWA installable).
- Local-first behavior must work without Supabase config.
- No secrets in repo docs or code.

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
|   |   |-- supabase.ts
|   |   `-- sync.ts
|   |-- store/
|   |   `-- useAppStore.ts
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
- Keep all stage names in `ExerciseStage` union.
- Tests live beside domain modules as `*.test.ts`.
