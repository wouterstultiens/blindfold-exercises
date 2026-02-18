## [2026-02-18]
- Done: Migrated Puzzle Recall from Syzygy/tablebase to static Lichess shards (`public/puzzles/lichess/p{piece}/r{bucket}.json`) with manifest v6.
- Done: Added offline data pipeline (`scripts/download_lichess_db.py`, `scripts/build_lichess_puzzles.py`) and updated npm scripts.
- Done: Switched runtime settings to exact `pieceCount (3..8)` + `ratingBucket (200-step)` and updated combo progress stats.
- Done: Tightened Lichess build filters for simple/obvious puzzles (simple tactical themes, popularity/play-count minimums, short full lines only) and improved per-combo motif diversity balancing.
- Done: Added fast iteration mode via `--max-rows` plus `npm run puzzles:build:tiny` and refreshed static shards with a bounded subset run (`--max-rows 80000`, 92 puzzles).
- Done: Fixed puzzle phase alignment by advancing one setup move before storing the seed position; continuation now starts at the tactical response and uses cleaner move text formatting.
- Done: Rebuilt dense static shards after the alignment fix (`3541` puzzles, 38 combo shards).
- Done: Redesigned UI to a dark, smoother, lower-distraction layout.
- Done: Removed obsolete Syzygy scripts/assets and Supabase `puzzle_bank` / edge puzzle-fetch path.
- Next: Browser smoke test Puzzle Recall across 4+ `(pieceCount, ratingBucket)` combos and verify first shown move is always the tactic side to move.

## [2026-02-17]
- Done: Reduced app scope to two drills (`square_color`, `puzzle_recall`) and kept local-first + Supabase sync flow.
- Next: Improve puzzle diversity and simplify pipeline.
