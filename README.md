# Blindfold Chess Trainer

Train blindfold visualization with simple focused sessions: square color, mate-in-1, and mate-in-2.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`.

Session flow:
- Pick one category.
- Start session.
- Solve continuously (auto-saves after every answer).
- End session manually or just close the app; unfinished sessions are closed automatically on next open.

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
- TanStack Query (sync mutation handling)
- `chess.js` (position/move logic)
- `react-chessboard` (board UI)
- Supabase (GitHub auth + cloud sync)
- Lichess Puzzle API (mate puzzle import)
