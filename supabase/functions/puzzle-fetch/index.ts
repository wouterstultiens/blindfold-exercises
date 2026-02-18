import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { Chess, type Piece, type PieceSymbol } from "npm:chess.js@1.4.0";

interface LichessPuzzleResponse {
  game: {
    pgn: string;
  };
  puzzle: {
    id: string;
    rating: number;
    themes: string[];
    solution: string[];
    initialPly: number;
  };
}

interface PuzzleSeed {
  puzzleId: string;
  fen: string;
  sideToMove: "w" | "b";
  rating: number;
  pieceCount: number;
  whitePieces: string[];
  blackPieces: string[];
  continuationSan: string[];
  continuationText: string;
  source: "lichess_live";
}

const BACKOFF_MS = [300, 700, 1500, 3000];
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uciToMovePayload(uci: string): { from: string; to: string; promotion?: PieceSymbol } {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? (uci[4] as PieceSymbol) : undefined;
  return { from, to, promotion };
}

function isUciLegal(chess: Chess, uci: string): boolean {
  const { from, to, promotion } = uciToMovePayload(uci);
  return chess
    .moves({ verbose: true })
    .some((move) => move.from === from && move.to === to && (!promotion || move.promotion === promotion));
}

function isUciLineLegal(chess: Chess, uciLine: string[]): boolean {
  const copy = new Chess(chess.fen());
  for (const uci of uciLine) {
    if (!isUciLegal(copy, uci)) {
      return false;
    }
    copy.move(uciToMovePayload(uci));
  }
  return true;
}

function buildFenAtPuzzleStart(pgn: string, initialPly: number, solutionLine: string[]): string {
  const firstMoveUci = solutionLine[0];
  if (!firstMoveUci) {
    throw new Error("Puzzle has no solution move.");
  }
  const fullGame = new Chess();
  fullGame.loadPgn(pgn);
  const history = fullGame.history();
  const candidateOffsets = [-2, -1, 0, 1, 2];
  const validationLine = solutionLine.slice(0, 3);

  for (const offset of candidateOffsets) {
    const ply = initialPly + offset;
    if (ply < 0) {
      continue;
    }
    const chess = new Chess();
    for (let index = 0; index < Math.min(ply, history.length); index += 1) {
      chess.move(history[index] as string);
    }
    if (isUciLegal(chess, firstMoveUci) && isUciLineLegal(chess, validationLine)) {
      return chess.fen();
    }
  }

  const fallback = new Chess();
  for (let index = 0; index < Math.min(initialPly, history.length); index += 1) {
    fallback.move(history[index] as string);
  }
  return fallback.fen();
}

function sanLineFromUci(fen: string, uciLine: string[]): string[] {
  const chess = new Chess(fen);
  const sanMoves: string[] = [];

  for (const uci of uciLine) {
    const move = chess.move(uciToMovePayload(uci));
    if (!move) {
      break;
    }
    sanMoves.push(move.san);
  }

  return sanMoves;
}

function continuationTextFromSan(fen: string, sanLine: string[]): string {
  const parts = fen.split(" ");
  let turn: "w" | "b" = parts[1] === "b" ? "b" : "w";
  let moveNumber = Number.parseInt(parts[5] ?? "1", 10);
  if (Number.isNaN(moveNumber) || moveNumber < 1) {
    moveNumber = 1;
  }

  const tokens: string[] = [];
  for (const san of sanLine) {
    if (turn === "w") {
      tokens.push(`${moveNumber}. ${san}`);
      turn = "b";
    } else {
      tokens.push(`${moveNumber}... ${san}`);
      turn = "w";
      moveNumber += 1;
    }
  }

  return tokens.join(" ");
}

function pieceToken(square: string, piece: Piece): string {
  return `${piece.type.toUpperCase()}${square}`;
}

function pieceSortIndex(token: string): number {
  const order = "KQRBNP";
  const piece = token.charAt(0);
  const index = order.indexOf(piece);
  return index < 0 ? order.length : index;
}

function extractPieces(fen: string): { sideToMove: "w" | "b"; whitePieces: string[]; blackPieces: string[]; pieceCount: number } {
  const chess = new Chess(fen);
  const board = chess.board();
  const whitePieces: string[] = [];
  const blackPieces: string[] = [];
  const files = "abcdefgh";

  for (let rankIndex = 0; rankIndex < board.length; rankIndex += 1) {
    const rank = board[rankIndex];
    if (!rank) {
      continue;
    }
    for (let fileIndex = 0; fileIndex < rank.length; fileIndex += 1) {
      const piece = rank[fileIndex];
      if (!piece) {
        continue;
      }
      const square = `${files[fileIndex]}${8 - rankIndex}`;
      const token = pieceToken(square, piece);
      if (piece.color === "w") {
        whitePieces.push(token);
      } else {
        blackPieces.push(token);
      }
    }
  }

  whitePieces.sort((a, b) => pieceSortIndex(a) - pieceSortIndex(b) || a.localeCompare(b));
  blackPieces.sort((a, b) => pieceSortIndex(a) - pieceSortIndex(b) || a.localeCompare(b));

  const sideToMove: "w" | "b" = fen.split(" ")[1] === "b" ? "b" : "w";
  return {
    sideToMove,
    whitePieces,
    blackPieces,
    pieceCount: whitePieces.length + blackPieces.length
  };
}

function puzzleSeedFromPayload(payload: LichessPuzzleResponse): PuzzleSeed {
  const firstMove = payload.puzzle.solution[0];
  if (!firstMove) {
    throw new Error("Puzzle has no solution move.");
  }

  const fen = buildFenAtPuzzleStart(payload.game.pgn, payload.puzzle.initialPly, payload.puzzle.solution);
  const continuationSan = sanLineFromUci(fen, payload.puzzle.solution);
  if (continuationSan.length === 0) {
    throw new Error("Could not derive SAN continuation.");
  }

  const pieces = extractPieces(fen);

  return {
    puzzleId: payload.puzzle.id,
    fen,
    sideToMove: pieces.sideToMove,
    rating: payload.puzzle.rating,
    pieceCount: pieces.pieceCount,
    whitePieces: pieces.whitePieces,
    blackPieces: pieces.blackPieces,
    continuationSan,
    continuationText: continuationTextFromSan(fen, continuationSan),
    source: "lichess_live"
  };
}

async function fetchLichessWithBackoff(): Promise<{ payload: LichessPuzzleResponse; status: number } | { error: string; status: number }> {
  for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt += 1) {
    let response: Response;
    try {
      response = await fetch("https://lichess.org/api/puzzle/next", {
        headers: {
          Accept: "application/json"
        }
      });
    } catch (error) {
      if (attempt < BACKOFF_MS.length) {
        await sleep(BACKOFF_MS[attempt] as number);
        continue;
      }
      return {
        error: error instanceof Error ? error.message : "Network error",
        status: 502
      };
    }

    if (response.ok) {
      const payload = (await response.json()) as LichessPuzzleResponse;
      return { payload, status: response.status };
    }

    if ((response.status === 429 || response.status >= 500) && attempt < BACKOFF_MS.length) {
      await sleep(BACKOFF_MS[attempt] as number);
      continue;
    }

    return {
      error: `Lichess returned ${response.status}`,
      status: response.status
    };
  }

  return {
    error: "Failed to fetch puzzle from Lichess after retries",
    status: 502
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { code: "method_not_allowed", message: "Use POST." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return jsonResponse(500, { code: "server_misconfigured", message: "Supabase env vars missing." });
  }

  if (!authHeader) {
    return jsonResponse(401, { code: "unauthorized", message: "Missing authorization header." });
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader
      }
    }
  });

  const {
    data: { user },
    error: authError
  } = await authClient.auth.getUser();

  if (authError || !user) {
    return jsonResponse(401, { code: "unauthorized", message: "Invalid user session." });
  }

  const fetched = await fetchLichessWithBackoff();
  if ("error" in fetched) {
    return jsonResponse(fetched.status, {
      code: "lichess_unavailable",
      message: fetched.error,
      upstreamStatus: fetched.status
    });
  }

  let seed: PuzzleSeed;
  try {
    seed = puzzleSeedFromPayload(fetched.payload);
  } catch (error) {
    return jsonResponse(502, {
      code: "invalid_lichess_payload",
      message: error instanceof Error ? error.message : "Invalid puzzle payload"
    });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey);
  const { error: upsertError } = await adminClient.from("puzzle_bank").upsert(
    {
      puzzle_id: seed.puzzleId,
      fen: seed.fen,
      side_to_move: seed.sideToMove,
      rating: seed.rating,
      piece_count: seed.pieceCount,
      white_pieces: seed.whitePieces,
      black_pieces: seed.blackPieces,
      continuation_san: seed.continuationSan,
      continuation_text: seed.continuationText,
      source: "lichess",
      last_seen_at: new Date().toISOString()
    },
    {
      onConflict: "puzzle_id"
    }
  );

  if (upsertError) {
    return jsonResponse(500, {
      code: "db_upsert_failed",
      message: upsertError.message
    });
  }

  return jsonResponse(200, seed);
});
