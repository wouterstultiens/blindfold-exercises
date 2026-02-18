# Blindfold Chess Trainer

Blindfold trainer with exactly two drills: square color and static Lichess puzzle recall.

## Quick Start

```bash
npm install
python -m pip install -r requirements.txt
npm run dev
```

Open `http://localhost:5173`.

Validation:

```bash
npm test
npm run build
```

## Puzzle Data (Static, No Per-Puzzle API Calls)

Puzzle Recall only reads committed static files under `public/puzzles/`.

Build/update puzzle shards from Lichess CSV:

```bash
npm run puzzles:download
npm run puzzles:build
```

Quick iteration build (tiny sample, fast):

```bash
npm run puzzles:build:tiny
```

Small subset build:

```bash
npm run puzzles:build:subset
```

Build filters bias toward simple, obvious lines:

- only 3..8-piece positions
- seed position is stored after the initial setup ply from Lichess
- short solutions (<= 4 plies, full line)
- simple tactical themes (mate/fork/pin/skewer/hanging, etc.)
- popularity and play-count minimums
- motif balancing per `(pieceCount, ratingBucket)` shard

Runtime puzzle settings:

- Piece count: `3..8` (exact)
- Rating bucket: fixed `200`-point buckets (e.g. `1000`, `1200`, `1400`)
- Continuation clarity: max `4` plies
- Progress tracked per `(pieceCount, ratingBucket)` combo

## Exercises

- `Square Color`: answer black/white for a shown square.
- `Puzzle Recall`: memorize side to move + piece list, reveal line/board, self-grade.

## Shared Progress (Supabase)

- Local-first persistence in `localStorage`
- Optional GitHub auth via Supabase
- Attempts/sessions sync across devices when signed in

## Tech Stack

- React 18 + TypeScript + Vite
- `chess.js` + `react-chessboard`
- Python (`python-chess`, `zstandard`) for offline puzzle DB build
- Supabase (GitHub auth + sync)
