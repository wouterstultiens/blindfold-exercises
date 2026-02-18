# Blindfold Chess Trainer

Blindfold trainer with exactly 2 exercises: square color and puzzle recall.

## Quick Start

Prerequisite: install `zstd` (CLI) so the local puzzle DB can be generated from `lichess_db_puzzle.csv.zst`.

```bash
npm install
cp .env.example .env
npm run puzzles:build:blindfold
npm run dev
```

Open `http://localhost:5173`.

Optional checks:

```bash
npm test
npm run build
```

## Puzzle DB (Local + GitHub Pages)

Puzzle recall reads a static local puzzle database generated into `public/puzzles/`.

- Source inputs: `lichess_db_puzzle.csv.zst` + Lichess tablebase API (`https://tablebase.lichess.ovh/standard`)
- Generator: `scripts/build-puzzle-db.mjs`
- Command: `npm run puzzles:build`
- Output: `public/puzzles/manifest.json` + rating shard files (`r1400.json`, `r1500.json`, ...)
- Build state: `public/puzzles/build-state.json` (resume progress between runs)

The generator is incremental by default:

- Each run processes a chunk of rows and saves progress.
- Run it again later to continue where it stopped.
- Useful commands:
  - `npm run puzzles:build` (resume, default chunk)
  - `npm run puzzles:build:blindfold` (reset + rebuild for 2..7-piece blindfold pool)
  - `npm run puzzles:build -- --rows 100000` (custom chunk size)
  - `npm run puzzles:build -- --max-pieces 7 --max-plies 4` (blindfold-focused short lines)
  - `npm run puzzles:build -- --sources lichess` (Lichess only)
  - `npm run puzzles:build -- --sources tablebase --tablebase-budget 500` (tablebase-derived only)
  - `npm run puzzles:build -- --full` (process until EOF in one run)
  - `npm run puzzles:build -- --reset` (start over from scratch)
  - `npm run puzzles:build -- --reset --rows 50000 --max-pieces 7 --max-plies 4` (restart strict blindfold pool)

After changing puzzle filter rules, run one `--reset` build to regenerate shards with the new policy.
If you change filter knobs (`--max-pieces`, `--max-plies`, `--sources`, endgame policy, or tablebase budget), use `--reset` so state and shards stay consistent.

Runtime does not call Lichess or Supabase for puzzle loading. It only loads static files and filters by:

- `pieceCount <= maxPieces`
- `rating in [targetRating - 100, targetRating + 100]`
- short, clear continuation (`<= 4` plies by default)
- low-piece endgames are allowed for blindfold-friendly pools

If puzzle assets are missing, the app shows an actionable error telling you to run `npm run puzzles:build`.

## Exercises

- `Square Color`: app shows one square (`a4`, `g8`, etc.), you answer `white` or `black`.
- `Puzzle Recall`: pick `max pieces` (2..7, including kings) and `target rating`; app serves short blindfold-friendly puzzles from the generated local DB shards.
- You must click `Start` before an exercise is shown. Timer starts only once the exercise is visible.

## Shared Progress (Laptop + Phone)

Progress is local-first and synced when signed in:

- Sign in with GitHub (Supabase auth).
- Attempts and session history sync across devices for the same account.
- Session history tracks progress over time.
- Puzzle scores are tracked per settings combo (`max pieces`, `target rating`) as attempts + correct %.

## Supabase Setup (Auth + Sync)

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Enable GitHub OAuth in Supabase Auth.
4. Set `.env` values:

```bash
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_BASE_PATH=/
```

For GitHub Pages deployment, set `VITE_BASE_PATH=/blindfold-exercises/`.
Commit generated `public/puzzles/*` files so GitHub Pages serves your latest built puzzle DB.

## Tech Stack

- React 18 + TypeScript
- Vite 6 + `vite-plugin-pwa`
- `chess.js` + `react-chessboard`
- Supabase (GitHub auth + progress sync)
- Static puzzle DB generated from Lichess CSV (`.zst`) + tablebase-derived seeds
