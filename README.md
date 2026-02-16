# Blindfold Chess Trainer

Train blindfold chess visualization with adaptive exercises, streaks, and progress analytics in an installable web app.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`.

To run tests and build:

```bash
npm test
npm run build
```

## Supabase Setup (GitHub Login + Sync)

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Enable GitHub OAuth in Supabase Auth.
4. Add to `.env`:

```bash
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_BASE_PATH=/
```

For GitHub Pages deployment, set `VITE_BASE_PATH=/blindfold-exercises/`.

## Tech Stack

- React 18 + TypeScript
- Vite 6 + `vite-plugin-pwa`
- Zustand (runtime state)
- TanStack Query (sync mutation handling)
- `chess.js` (position/move logic)
- Recharts (progress dashboard)
- Supabase (GitHub auth + cloud sync)
