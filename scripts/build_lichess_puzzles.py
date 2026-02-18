#!/usr/bin/env python3
"""Build static 3-8 piece puzzle shards from lichess_db_puzzle.csv.zst."""

from __future__ import annotations

import argparse
import csv
import io
import json
import math
import random
import shutil
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Sequence

import chess
try:
    import zstandard
except ModuleNotFoundError:
    print("Missing dependency: zstandard", file=sys.stderr)
    print("Install it with: python -m pip install -r requirements.txt", file=sys.stderr)
    sys.exit(1)

MANIFEST_VERSION = 6
SOURCE_NAME = "lichess_db"
PUZZLE_SOURCE = "lichess_static"

TACTICAL_THEMES = {
    "mate",
    "mateIn1",
    "mateIn2",
    "mateIn3",
    "oneMove",
    "fork",
    "pin",
    "skewer",
    "hangingPiece",
    "doubleCheck",
    "discoveredAttack",
    "deflection",
    "attraction",
    "clearance",
    "interference",
    "trappedPiece",
    "sacrifice",
    "xRayAttack",
    "exposedKing",
    "kingsideAttack",
    "queensideAttack"
}

SIMPLE_THEMES = {
    "mate",
    "mateIn1",
    "mateIn2",
    "mateIn3",
    "oneMove",
    "fork",
    "pin",
    "skewer",
    "hangingPiece",
    "backRankMate",
    "doubleCheck",
    "discoveredAttack",
    "deflection",
    "attraction",
    "interference",
    "clearance",
    "trappedPiece"
}

EXCLUDED_THEMES = {
    "long",
    "veryLong",
    "master",
    "study"
}

ADVANCED_THEMES = {
    "defensiveMove",
    "quietMove",
    "zugzwang",
    "intermezzo",
    "underPromotion"
}

MOTIF_PRIORITY = (
    "backrank",
    "mate",
    "fork",
    "pin",
    "skewer",
    "hanging",
    "discovered",
    "deflection",
    "sacrifice",
    "other"
)


@dataclass(frozen=True)
class BuilderConfig:
    input_path: Path
    output_dir: Path
    min_piece_count: int
    max_piece_count: int
    min_rating: int
    max_rating: int
    bucket_size: int
    max_plies: int
    target_per_combo: int
    candidate_multiplier: int
    min_popularity: int
    min_nb_plays: int
    backrank_max_share: float
    max_single_motif_share: float
    max_rows: Optional[int]
    seed: Optional[int]


@dataclass
class PuzzleSeed:
    puzzle_id: str
    fen: str
    side_to_move: str
    piece_count: int
    rating_bucket: int
    white_pieces: List[str]
    black_pieces: List[str]
    continuation_san: List[str]
    continuation_text: str
    themes: List[str]
    motif: str
    simplicity_score: float


def parse_args() -> BuilderConfig:
    parser = argparse.ArgumentParser(description="Build static puzzle shards from lichess_db_puzzle.csv.zst")
    parser.add_argument("--input", default="lichess_db_puzzle.csv.zst", help="Path to lichess_db_puzzle.csv.zst")
    parser.add_argument("--output", default="public/puzzles", help="Output directory for static puzzle assets")
    parser.add_argument("--min-piece-count", type=int, default=3, help="Minimum total pieces (incl. kings)")
    parser.add_argument("--max-piece-count", type=int, default=8, help="Maximum total pieces (incl. kings)")
    parser.add_argument("--min-rating", type=int, default=800, help="Minimum puzzle rating")
    parser.add_argument("--max-rating", type=int, default=2200, help="Maximum puzzle rating")
    parser.add_argument("--bucket-size", type=int, default=200, help="Rating bucket step")
    parser.add_argument("--max-plies", type=int, default=4, help="Maximum continuation plies")
    parser.add_argument("--target-per-combo", type=int, default=80, help="Desired puzzles per (pieceCount, ratingBucket)")
    parser.add_argument("--candidate-multiplier", type=int, default=6, help="Candidate pool multiplier per combo")
    parser.add_argument("--min-popularity", type=int, default=65, help="Minimum Lichess popularity score")
    parser.add_argument("--min-nb-plays", type=int, default=250, help="Minimum Lichess number of plays")
    parser.add_argument("--backrank-max-share", type=float, default=0.2, help="Max back-rank motif share per combo")
    parser.add_argument("--max-single-motif-share", type=float, default=0.45, help="Max share for any non-backrank motif per combo")
    parser.add_argument("--max-rows", type=int, default=None, help="Optional cap on CSV rows scanned (for quick iteration)")
    parser.add_argument("--seed", type=int, default=None, help="Optional random seed")
    args = parser.parse_args()

    return BuilderConfig(
        input_path=Path(args.input).expanduser(),
        output_dir=Path(args.output).expanduser(),
        min_piece_count=args.min_piece_count,
        max_piece_count=args.max_piece_count,
        min_rating=args.min_rating,
        max_rating=args.max_rating,
        bucket_size=args.bucket_size,
        max_plies=args.max_plies,
        target_per_combo=args.target_per_combo,
        candidate_multiplier=args.candidate_multiplier,
        min_popularity=args.min_popularity,
        min_nb_plays=args.min_nb_plays,
        backrank_max_share=args.backrank_max_share,
        max_single_motif_share=args.max_single_motif_share,
        max_rows=args.max_rows,
        seed=args.seed
    )


def rating_bucket_for(rating: int, bucket_size: int) -> int:
    return (rating // bucket_size) * bucket_size


def tokenise_pieces(board: chess.Board) -> tuple[List[str], List[str]]:
    white_tokens: List[str] = []
    black_tokens: List[str] = []
    files = "abcdefgh"
    for square, piece in board.piece_map().items():
        token = f"{piece.symbol().upper()}{files[chess.square_file(square)]}{chess.square_rank(square) + 1}"
        if piece.color == chess.WHITE:
            white_tokens.append(token)
        else:
            black_tokens.append(token)

    def sort_key(token: str) -> tuple[int, str]:
        order = "KQRBNP"
        return (order.index(token[0]), token)

    white_tokens.sort(key=sort_key)
    black_tokens.sort(key=sort_key)
    return white_tokens, black_tokens


def continuation_text(fen: str, san_line: Sequence[str]) -> str:
    board = chess.Board(fen)
    move_number = board.fullmove_number
    turn = board.turn
    tokens: List[str] = []
    for index, san in enumerate(san_line):
        if turn == chess.WHITE:
            tokens.append(f"{move_number}. {san}")
            turn = chess.BLACK
        else:
            if index == 0:
                tokens.append(f"{move_number}... {san}")
            else:
                tokens.append(san)
            turn = chess.WHITE
            move_number += 1
    return " ".join(tokens)


def parse_themes(raw_themes: str) -> List[str]:
    return [theme.strip() for theme in raw_themes.split(" ") if theme.strip()]


def accepts_themes(themes: Sequence[str]) -> bool:
    theme_set = set(themes)
    if theme_set.intersection(EXCLUDED_THEMES):
        return False
    if theme_set.intersection(ADVANCED_THEMES):
        return False
    if not theme_set.intersection(TACTICAL_THEMES):
        return False
    return bool(theme_set.intersection(SIMPLE_THEMES))


def parse_int_field(row: Dict[str, str], key: str, default: int = 0) -> int:
    raw = row.get(key)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def motif_for(themes: Sequence[str]) -> str:
    theme_set = set(themes)
    if "backRankMate" in theme_set:
        return "backrank"
    if {"mate", "mateIn1", "mateIn2", "mateIn3"}.intersection(theme_set):
        return "mate"
    if "fork" in theme_set:
        return "fork"
    if "pin" in theme_set:
        return "pin"
    if "skewer" in theme_set:
        return "skewer"
    if "hangingPiece" in theme_set:
        return "hanging"
    if "discoveredAttack" in theme_set:
        return "discovered"
    if {"deflection", "attraction", "interference", "clearance"}.intersection(theme_set):
        return "deflection"
    if "sacrifice" in theme_set:
        return "sacrifice"
    return "other"


def simplicity_score_for(
    themes: Sequence[str],
    rating: int,
    popularity: int,
    nb_plays: int,
    line_plies: int,
    first_move_forcing: bool,
    config: BuilderConfig
) -> float:
    theme_set = set(themes)
    rating_span = max(1, config.max_rating - config.min_rating)
    bounded_rating = max(config.min_rating, min(config.max_rating, rating))
    lower_rating_bonus = (config.max_rating - bounded_rating) / rating_span
    short_line_bonus = (config.max_plies - max(1, line_plies) + 1) / max(1, config.max_plies)
    popularity_bonus = max(0.0, min(1.0, popularity / 100.0))
    plays_bonus = max(0.0, min(1.0, math.log10(max(1, nb_plays)) / 5))

    score = 0.0
    score += 1.5 * lower_rating_bonus
    score += 1.3 * short_line_bonus
    score += 0.8 * popularity_bonus
    score += 0.6 * plays_bonus
    if first_move_forcing:
        score += 0.8
    if {"oneMove", "mateIn1"}.intersection(theme_set):
        score += 0.9
    elif "mateIn2" in theme_set:
        score += 0.7
    elif "mateIn3" in theme_set:
        score += 0.4
    if {"fork", "skewer", "hangingPiece"}.intersection(theme_set):
        score += 0.3
    return score


def parse_puzzle_seed(row: Dict[str, str], config: BuilderConfig) -> Optional[PuzzleSeed]:
    try:
        puzzle_id = row["PuzzleId"]
        fen = row["FEN"]
        rating = int(row["Rating"])
        moves_uci = [move for move in row["Moves"].split(" ") if move]
    except (KeyError, ValueError):
        return None

    if not puzzle_id or not fen or len(moves_uci) < 2:
        return None

    rating_bucket = rating_bucket_for(rating, config.bucket_size)
    if rating_bucket < config.min_rating or rating_bucket > config.max_rating:
        return None

    popularity = parse_int_field(row, "Popularity", default=0)
    nb_plays = parse_int_field(row, "NbPlays", default=0)
    if popularity < config.min_popularity or nb_plays < config.min_nb_plays:
        return None

    themes = parse_themes(row.get("Themes", ""))
    if not accepts_themes(themes):
        return None

    try:
        board = chess.Board(fen)
    except ValueError:
        return None

    working = board.copy(stack=False)
    try:
        setup_move = chess.Move.from_uci(moves_uci[0])
    except ValueError:
        return None
    if setup_move not in working.legal_moves:
        return None
    working.push(setup_move)

    puzzle_board = working.copy(stack=False)
    piece_count = len(puzzle_board.piece_map())
    if piece_count < config.min_piece_count or piece_count > config.max_piece_count:
        return None

    side_to_move = "w" if puzzle_board.turn == chess.WHITE else "b"
    white_tokens, black_tokens = tokenise_pieces(puzzle_board)

    continuation_uci = moves_uci[1:]
    if len(continuation_uci) == 0 or len(continuation_uci) > config.max_plies:
        return None

    san_line: List[str] = []
    first_move_forcing = False
    for index, uci in enumerate(continuation_uci):
        try:
            move = chess.Move.from_uci(uci)
        except ValueError:
            return None
        if move not in working.legal_moves:
            return None
        if index == 0:
            first_move_forcing = working.is_capture(move) or working.gives_check(move)
        san_line.append(working.san(move))
        working.push(move)

    if not san_line or len(san_line) > config.max_plies:
        return None

    return PuzzleSeed(
        puzzle_id=puzzle_id,
        fen=puzzle_board.fen(),
        side_to_move=side_to_move,
        piece_count=piece_count,
        rating_bucket=rating_bucket,
        white_pieces=white_tokens,
        black_pieces=black_tokens,
        continuation_san=san_line,
        continuation_text=continuation_text(puzzle_board.fen(), san_line),
        themes=themes,
        motif=motif_for(themes),
        simplicity_score=simplicity_score_for(
            themes=themes,
            rating=rating,
            popularity=popularity,
            nb_plays=nb_plays,
            line_plies=len(san_line),
            first_move_forcing=first_move_forcing,
            config=config
        )
    )


def combo_key(seed: PuzzleSeed) -> str:
    return f"p{seed.piece_count}-r{seed.rating_bucket}"


def choose_balanced(
    seeds_by_motif: Dict[str, List[PuzzleSeed]],
    target: int,
    backrank_max_share: float,
    max_single_motif_share: float,
    rng: random.Random
) -> List[PuzzleSeed]:
    motif_buckets: Dict[str, List[PuzzleSeed]] = {}
    for motif, seeds in seeds_by_motif.items():
        copy = list(seeds)
        copy.sort(key=lambda seed: (seed.simplicity_score, rng.random()), reverse=True)
        motif_buckets[motif] = copy

    selected: List[PuzzleSeed] = []
    backrank_limit = max(1, math.floor(target * backrank_max_share)) if target > 0 else 0
    motif_limit = max(1, math.floor(target * max_single_motif_share)) if target > 0 else 0
    motif_counts: Dict[str, int] = defaultdict(int)

    while len(selected) < target:
        progressed = False
        for motif in MOTIF_PRIORITY:
            bucket = motif_buckets.get(motif)
            if not bucket:
                continue
            current = motif_counts[motif]
            if motif == "backrank":
                if current >= backrank_limit:
                    continue
            elif current >= motif_limit:
                continue
            selected.append(bucket.pop(0))
            motif_counts[motif] += 1
            progressed = True
            if len(selected) >= target:
                break
        if not progressed:
            break

    if len(selected) < target:
        leftovers: List[PuzzleSeed] = []
        for bucket in motif_buckets.values():
            leftovers.extend(bucket)
        leftovers.sort(key=lambda seed: (seed.simplicity_score, rng.random()), reverse=True)
        for seed in leftovers:
            if len(selected) >= target:
                break
            current = motif_counts[seed.motif]
            if seed.motif == "backrank":
                if current >= backrank_limit:
                    continue
            elif current >= motif_limit:
                continue
            selected.append(seed)
            motif_counts[seed.motif] += 1

    if len(selected) < target:
        leftovers: List[PuzzleSeed] = []
        for bucket in motif_buckets.values():
            leftovers.extend(bucket)
        leftovers.sort(key=lambda seed: (seed.simplicity_score, rng.random()), reverse=True)
        for seed in leftovers:
            if len(selected) >= target:
                break
            selected.append(seed)

    return selected


def as_output(seed: PuzzleSeed) -> Dict[str, object]:
    return {
        "puzzleId": seed.puzzle_id,
        "fen": seed.fen,
        "sideToMove": seed.side_to_move,
        "pieceCount": seed.piece_count,
        "ratingBucket": seed.rating_bucket,
        "whitePieces": seed.white_pieces,
        "blackPieces": seed.black_pieces,
        "continuationSan": seed.continuation_san,
        "continuationText": seed.continuation_text,
        "themes": seed.themes,
        "source": PUZZLE_SOURCE
    }


def build_dataset(config: BuilderConfig) -> tuple[Dict[str, List[PuzzleSeed]], int]:
    if not config.input_path.exists():
        print(f"Input file not found: {config.input_path}", file=sys.stderr)
        print("Run `npm run puzzles:download` first.", file=sys.stderr)
        sys.exit(1)

    candidates_by_combo: Dict[str, Dict[str, List[PuzzleSeed]]] = defaultdict(lambda: defaultdict(list))
    seen_ids: set[str] = set()
    accepted = 0
    scanned = 0

    dctx = zstandard.ZstdDecompressor()
    with open(config.input_path, "rb") as compressed:
        with dctx.stream_reader(compressed) as reader:
            text_stream = io.TextIOWrapper(reader, encoding="utf-8")
            csv_reader = csv.DictReader(text_stream)
            for row in csv_reader:
                if config.max_rows is not None and scanned >= config.max_rows:
                    break
                scanned += 1
                seed = parse_puzzle_seed(row, config)
                if seed is None or seed.puzzle_id in seen_ids:
                    continue

                key = combo_key(seed)
                motif_bucket = candidates_by_combo[key][seed.motif]
                combo_total = sum(len(items) for items in candidates_by_combo[key].values())
                combo_cap = config.target_per_combo * config.candidate_multiplier
                if combo_total >= combo_cap:
                    continue

                motif_bucket.append(seed)
                seen_ids.add(seed.puzzle_id)
                accepted += 1

    if accepted == 0:
        print("No candidate puzzles survived filters. Relax constraints and retry.", file=sys.stderr)
        sys.exit(1)

    print(f"Scanned rows: {scanned}")
    if config.max_rows is not None and scanned == config.max_rows:
        print(f"Stopped early at row cap: {config.max_rows}")
    print(f"Accepted candidates: {accepted}")

    rng = random.Random(config.seed)
    selected_by_combo: Dict[str, List[PuzzleSeed]] = {}
    for key, seeds_by_motif in sorted(candidates_by_combo.items()):
        target = min(config.target_per_combo, sum(len(items) for items in seeds_by_motif.values()))
        if target <= 0:
            continue
        selected = choose_balanced(
            seeds_by_motif,
            target,
            config.backrank_max_share,
            config.max_single_motif_share,
            rng
        )
        if selected:
            selected_by_combo[key] = selected

    return selected_by_combo, scanned


def write_outputs(config: BuilderConfig, selected_by_combo: Dict[str, List[PuzzleSeed]]) -> None:
    output_dir = config.output_dir
    lichess_dir = output_dir / "lichess"

    if lichess_dir.exists():
        try:
            shutil.rmtree(lichess_dir)
        except PermissionError:
            # On some Windows/OneDrive setups, removing folder trees can fail with
            # transient permission errors; stale shards are harmless because
            # manifest/countsByCombo controls which combos are selectable.
            pass
    output_dir.mkdir(parents=True, exist_ok=True)

    counts_by_combo: Dict[str, int] = {}
    piece_counts: set[int] = set()
    rating_buckets: set[int] = set()
    total_count = 0

    for key, seeds in sorted(selected_by_combo.items()):
        if not seeds:
            continue
        piece_count = seeds[0].piece_count
        rating_bucket = seeds[0].rating_bucket
        shard_path = lichess_dir / f"p{piece_count}" / f"r{rating_bucket}.json"
        shard_path.parent.mkdir(parents=True, exist_ok=True)

        payload = [as_output(seed) for seed in seeds]
        with open(shard_path, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False)

        counts_by_combo[key] = len(seeds)
        piece_counts.add(piece_count)
        rating_buckets.add(rating_bucket)
        total_count += len(seeds)

    manifest = {
        "version": MANIFEST_VERSION,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": SOURCE_NAME,
        "maxContinuationPlies": config.max_plies,
        "pieceCounts": sorted(piece_counts),
        "ratingBuckets": sorted(rating_buckets),
        "countsByCombo": counts_by_combo,
        "shardPattern": "lichess/p{pieceCount}/r{ratingBucket}.json",
        "totalCount": total_count
    }

    with open(output_dir / "manifest.json", "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, ensure_ascii=False)

    print(f"Wrote {total_count} puzzles across {len(counts_by_combo)} combo shards")
    expected_piece_counts = set(range(config.min_piece_count, config.max_piece_count + 1))
    missing_piece_counts = sorted(expected_piece_counts.difference(piece_counts))
    if missing_piece_counts:
        print(f"Warning: no puzzles found for piece counts: {missing_piece_counts}")

    expected_buckets = set(range(config.min_rating, config.max_rating + 1, config.bucket_size))
    missing_rating_buckets = sorted(expected_buckets.difference(rating_buckets))
    if missing_rating_buckets:
        print(f"Warning: no puzzles found for rating buckets: {missing_rating_buckets}")


def main() -> None:
    config = parse_args()
    selected_by_combo, _ = build_dataset(config)
    write_outputs(config, selected_by_combo)


if __name__ == "__main__":
    main()
