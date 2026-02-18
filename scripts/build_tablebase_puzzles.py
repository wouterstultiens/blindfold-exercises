#!/usr/bin/env python3
"""Generate 3-5 piece tablebase puzzles using local Syzygy files."""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional, Sequence, Tuple

import chess
import chess.syzygy

PIECE_VALUES = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9
}
MIN_CAPTURE_VALUE = 3
MAX_ATTEMPTS_DEFAULT = 50000

BASE_TEMPLATES: Sequence[str] = (
    "KQ|K",
    "KR|K",
    "KQ|KR",
    "KQ|KN",
    "KQ|KB",
    "KR|KB",
    "KR|KN",
    "KQ|KP",
    "KR|KP",
    "KQR|K",
    "KQB|K",
    "KQN|K",
    "KQP|K",
    "KRP|K"
)

PIECE_SYMBOL_MAP = {
    "K": chess.KING,
    "Q": chess.QUEEN,
    "R": chess.ROOK,
    "B": chess.BISHOP,
    "N": chess.KNIGHT,
    "P": chess.PAWN
}


@dataclass(frozen=True)
class MaterialTemplate:
    attacker_color: chess.Color
    attacker_pieces: Tuple[str, ...]
    defender_pieces: Tuple[str, ...]


def build_templates() -> List[MaterialTemplate]:
    templates: List[MaterialTemplate] = []
    for spec in BASE_TEMPLATES:
        attacker_raw, defender_raw = spec.split("|")
        attacker_tuple = tuple(attacker_raw)
        defender_tuple = tuple(defender_raw)
        templates.append(MaterialTemplate(chess.WHITE, attacker_tuple, defender_tuple))
        templates.append(MaterialTemplate(chess.BLACK, attacker_tuple, defender_tuple))
    return templates


TEMPLATES = build_templates()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build tablebase puzzles from local Syzygy files")
    parser.add_argument(
        "--tablebase-path",
        default="tablebases/syzygy",
        help="Directory containing Syzygy tablebase files (default: tablebases/syzygy)"
    )
    parser.add_argument(
        "--output",
        default="public/puzzles",
        help="Directory where manifest and puzzle JSON should be written"
    )
    parser.add_argument(
        "--target-count",
        type=int,
        default=500,
        help="Desired number of puzzles to generate (default: 500)"
    )
    parser.add_argument(
        "--max-plies",
        type=int,
        default=4,
        help="Maximum continuation length in plies (default: 4)"
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Optional RNG seed for deterministic output"
    )
    parser.add_argument(
        "--max-attempts",
        type=int,
        default=MAX_ATTEMPTS_DEFAULT,
        help=f"Maximum candidate positions to sample before giving up (default: {MAX_ATTEMPTS_DEFAULT})"
    )
    parser.add_argument(
        "--subset-count",
        type=int,
        default=None,
        help="Optional limit for quick runs; if provided, only this many puzzles are emitted"
    )
    return parser.parse_args()


def king_distance(square_a: chess.Square, square_b: chess.Square) -> int:
    return max(abs(chess.square_file(square_a) - chess.square_file(square_b)), abs(chess.square_rank(square_a) - chess.square_rank(square_b)))


def random_square(rng: random.Random) -> chess.Square:
    return chess.SQUARES[rng.randrange(64)]


def place_pieces(template: MaterialTemplate, rng: random.Random) -> Optional[chess.Board]:
    board = chess.Board(None)
    occupied: set[int] = set()
    king_squares = {chess.WHITE: None, chess.BLACK: None}

    def place_piece(piece_symbol: str, color: chess.Color) -> bool:
        piece_type = PIECE_SYMBOL_MAP[piece_symbol.upper()]
        for _ in range(100):
            square = random_square(rng)
            if square in occupied:
                continue
            rank = chess.square_rank(square)
            if piece_type == chess.PAWN and rank in (0, 7):
                continue
            other_king_square = king_squares[chess.WHITE if color == chess.BLACK else chess.BLACK]
            if piece_type == chess.KING and other_king_square is not None:
                if king_distance(square, other_king_square) <= 1:
                    continue
            board.set_piece_at(square, chess.Piece(piece_type, color))
            occupied.add(square)
            if piece_type == chess.KING:
                king_squares[color] = square
            return True
        return False

    for piece_symbol in template.attacker_pieces:
        if not place_piece(piece_symbol, template.attacker_color):
            return None

    defender_color = chess.BLACK if template.attacker_color == chess.WHITE else chess.WHITE
    for piece_symbol in template.defender_pieces:
        if not place_piece(piece_symbol, defender_color):
            return None

    board.turn = template.attacker_color
    board.clear_stack()
    board.halfmove_clock = 0
    board.fullmove_number = 1

    if not board.is_valid():
        return None
    return board


def probe_wdl_safe(tablebase: chess.syzygy.Tablebase, board: chess.Board) -> Optional[int]:
    try:
        return tablebase.probe_wdl(board)
    except chess.syzygy.MissingTableError:
        return None


def probe_dtz_safe(tablebase: chess.syzygy.Tablebase, board: chess.Board) -> Optional[int]:
    try:
        return tablebase.probe_dtz(board)
    except chess.syzygy.MissingTableError:
        return None


def unique_winning_move(board: chess.Board, tablebase: chess.syzygy.Tablebase) -> Optional[chess.Move]:
    winning: List[chess.Move] = []
    for move in board.legal_moves:
        board.push(move)
        wdl = probe_wdl_safe(tablebase, board)
        board.pop()
        if wdl == 2:
            winning.append(move)
            if len(winning) > 1:
                return None
    return winning[0] if winning else None


def first_move_obvious(board: chess.Board, move: chess.Move) -> bool:
    captured = board.piece_at(move.to_square)
    board.push(move)
    is_mate = board.is_checkmate()
    board.pop()
    if is_mate:
        return True
    if captured is None:
        return False
    piece_value = PIECE_VALUES.get(captured.piece_type, 0)
    return piece_value >= MIN_CAPTURE_VALUE


def select_defensive_reply(board: chess.Board, tablebase: chess.syzygy.Tablebase) -> Optional[chess.Move]:
    best_move: Optional[chess.Move] = None
    best_wdl = None
    best_dtz = None
    for move in board.legal_moves:
        board.push(move)
        wdl = probe_wdl_safe(tablebase, board)
        dtz = probe_dtz_safe(tablebase, board)
        board.pop()
        if wdl is None:
            continue
        if best_move is None or wdl < best_wdl or (wdl == best_wdl and (dtz or -999) > (best_dtz or -999)):
            best_move = move
            best_wdl = wdl
            best_dtz = dtz
    return best_move


def build_continuation(
    board: chess.Board,
    first_move: chess.Move,
    tablebase: chess.syzygy.Tablebase,
    max_plies: int,
    attacker_color: chess.Color
) -> Optional[List[str]]:
    working = board.copy()
    san_line: List[str] = []

    moves_to_play: List[chess.Move] = []
    moves_to_play.append(first_move)

    while moves_to_play:
        move = moves_to_play.pop(0)
        san_line.append(working.san(move))
        working.push(move)
        if working.is_checkmate():
            return san_line if len(san_line) <= max_plies else None
        if len(san_line) >= max_plies:
            return None
        if working.turn == attacker_color:
            next_move = unique_winning_move(working, tablebase)
            if next_move is None:
                return None
            moves_to_play.append(next_move)
        else:
            reply = select_defensive_reply(working, tablebase)
            if reply is None:
                return None
            moves_to_play.append(reply)
    return None


def tokenise_pieces(board: chess.Board) -> Tuple[List[str], List[str]]:
    white_tokens: List[str] = []
    black_tokens: List[str] = []
    files = "abcdefgh"
    for square, piece in board.piece_map().items():
        token = f"{piece.symbol().upper()}{files[chess.square_file(square)]}{chess.square_rank(square) + 1}"
        if piece.color == chess.WHITE:
            white_tokens.append(token)
        else:
            black_tokens.append(token)
    def sort_key(token: str) -> Tuple[int, str]:
        order = "KQRBNP"
        return (order.index(token[0]), token)
    white_tokens.sort(key=sort_key)
    black_tokens.sort(key=sort_key)
    return white_tokens, black_tokens


def continuation_text(fen: str, san_line: Sequence[str]) -> str:
    board = chess.Board(fen)
    tokens: List[str] = []
    move_number = board.fullmove_number
    turn = board.turn
    for san in san_line:
        if turn == chess.WHITE:
            tokens.append(f"{move_number}. {san}")
            turn = chess.BLACK
        else:
            tokens.append(f"{move_number}... {san}")
            turn = chess.WHITE
            move_number += 1
    return " ".join(tokens)


def puzzle_id_for(fen: str, san_line: Sequence[str]) -> str:
    digest = hashlib.sha1(f"{fen}|{' '.join(san_line)}".encode("utf8")).hexdigest()
    return f"tb_{digest[:12]}"


def build_manifest(output_path: Path, count: int) -> dict:
    return {
        "version": 5,
        "generatedAt": chess.SYZYGY_VERSION if hasattr(chess, "SYZYGY_VERSION") else None,
        "source": "syzygy_3-5",
        "maxPieces": 5,
        "maxContinuationPlies": 4,
        "sourcesUsed": ["tablebase_syzygy"],
        "count": count,
        "puzzlesFile": output_path.name
    }


def generate_puzzles(
    tablebase: chess.syzygy.Tablebase,
    rng: random.Random,
    target_count: int,
    max_attempts: int,
    max_plies: int
) -> List[dict]:
    puzzles: List[dict] = []
    seen_ids: set[str] = set()
    attempts = 0
    while len(puzzles) < target_count and attempts < max_attempts:
        attempts += 1
        template = rng.choice(TEMPLATES)
        board = place_pieces(template, rng)
        if board is None:
            continue
        wdl = probe_wdl_safe(tablebase, board)
        if wdl != 2:
            continue
        first_move = unique_winning_move(board, tablebase)
        if first_move is None:
            continue
        if not first_move_obvious(board, first_move):
            continue
        san_line = build_continuation(board, first_move, tablebase, max_plies, template.attacker_color)
        if not san_line:
            continue
        fen = board.fen()
        pid = puzzle_id_for(fen, san_line)
        if pid in seen_ids:
            continue
        white_tokens, black_tokens = tokenise_pieces(board)
        puzzles.append(
            {
                "puzzleId": pid,
                "fen": fen,
                "sideToMove": "w" if template.attacker_color == chess.WHITE else "b",
                "pieceCount": len(white_tokens) + len(black_tokens),
                "whitePieces": white_tokens,
                "blackPieces": black_tokens,
                "continuationSan": san_line,
                "continuationText": continuation_text(fen, san_line),
                "themes": ["tablebase", "mate"] if san_line[-1].endswith("#") else ["tablebase", "material"],
                "source": "tablebase_syzygy"
            }
        )
        seen_ids.add(pid)
    return puzzles


def main() -> None:
    args = parse_args()
    if args.target_count <= 0:
        print("target-count must be positive", file=sys.stderr)
        sys.exit(1)
    desired = args.subset_count if args.subset_count is not None else args.target_count
    if desired <= 0:
        print("subset-count must be positive", file=sys.stderr)
        sys.exit(1)

    rng = random.Random(args.seed)
    tablebase_path = Path(args.tablebase_path).expanduser()
    if not tablebase_path.exists():
        print(f"Tablebase path not found: {tablebase_path}", file=sys.stderr)
        sys.exit(1)

    output_dir = Path(args.output).expanduser()
    output_dir.mkdir(parents=True, exist_ok=True)

    with chess.syzygy.open_tablebase(str(tablebase_path)) as tablebase:
        puzzles = generate_puzzles(tablebase, rng, desired, args.max_attempts, args.max_plies)

    if len(puzzles) < desired:
        print(f"Only generated {len(puzzles)} puzzles after {args.max_attempts} attempts", file=sys.stderr)
        sys.exit(1)

    # Clean existing puzzle artifacts
    for existing in output_dir.glob("*.json"):
        existing.unlink()

    puzzles_path = output_dir / "tablebase.json"
    with open(puzzles_path, "w", encoding="utf8") as handle:
        json.dump(puzzles, handle, ensure_ascii=False)

    from datetime import datetime, timezone

    manifest = {
        "version": 5,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "syzygy_3-5",
        "maxPieces": 5,
        "maxContinuationPlies": args.max_plies,
        "sourcesUsed": ["tablebase_syzygy"],
        "count": len(puzzles),
        "puzzlesFile": puzzles_path.name
    }

    manifest_path = output_dir / "manifest.json"
    with open(manifest_path, "w", encoding="utf8") as handle:
        json.dump(manifest, handle, ensure_ascii=False)

    print(f"Generated {len(puzzles)} puzzles at {puzzles_path}")


if __name__ == "__main__":
    main()
