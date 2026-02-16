import { Chess, type PieceSymbol } from "chess.js";
import { MATE_IN_1_FALLBACK, MATE_IN_2_FALLBACK, type FallbackPuzzle } from "../data/puzzles";
import { pickRandom, shuffle } from "../lib/random";
import type { ExerciseStage } from "../types";

type PuzzleAngle = "mateIn1" | "mateIn2";
type MateStage = Extract<ExerciseStage, "mate_in_1" | "mate_in_2">;

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

interface CacheBucket {
  updatedAt: string;
  items: MatePuzzleSeed[];
}

interface PuzzleCache {
  mateIn1: CacheBucket;
  mateIn2: CacheBucket;
}

export interface MatePuzzleSeed {
  id: string;
  fen: string;
  solution: string;
  choices: string[];
  theme: string;
  source: "lichess" | "fallback";
  rating?: number;
}

const PUZZLE_CACHE_KEY = "blindfold.lichess.cache.v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_BATCH_SIZE = 6;
const MIN_CACHE_ITEMS = 2;

function emptyCache(): PuzzleCache {
  return {
    mateIn1: { updatedAt: new Date(0).toISOString(), items: [] },
    mateIn2: { updatedAt: new Date(0).toISOString(), items: [] }
  };
}

function readCache(): PuzzleCache {
  const raw = localStorage.getItem(PUZZLE_CACHE_KEY);
  if (!raw) {
    return emptyCache();
  }
  try {
    const parsed = JSON.parse(raw) as PuzzleCache;
    if (!parsed?.mateIn1 || !parsed?.mateIn2) {
      return emptyCache();
    }
    return parsed;
  } catch {
    return emptyCache();
  }
}

function writeCache(cache: PuzzleCache): void {
  localStorage.setItem(PUZZLE_CACHE_KEY, JSON.stringify(cache));
}

function stageToAngle(stage: MateStage): PuzzleAngle {
  return stage === "mate_in_1" ? "mateIn1" : "mateIn2";
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

function buildFenAtPuzzleStart(pgn: string, initialPly: number, firstMoveUci: string): string {
  const fullGame = new Chess();
  fullGame.loadPgn(pgn);
  const history = fullGame.history();
  const candidateOffsets = [-2, -1, 0, 1, 2];

  for (const offset of candidateOffsets) {
    const ply = initialPly + offset;
    if (ply < 0) {
      continue;
    }
    const chess = new Chess();
    for (let index = 0; index < Math.min(ply, history.length); index += 1) {
      chess.move(history[index] as string);
    }
    if (isUciLegal(chess, firstMoveUci)) {
      return chess.fen();
    }
  }

  const fallback = new Chess();
  for (let index = 0; index < Math.min(initialPly, history.length); index += 1) {
    fallback.move(history[index] as string);
  }
  return fallback.fen();
}

function sanFromUci(fen: string, uci: string): string {
  const chess = new Chess(fen);
  const move = chess.move(uciToMovePayload(uci));
  if (!move) {
    throw new Error(`Could not map UCI move ${uci} from fen ${fen}`);
  }
  return move.san;
}

function buildChoices(fen: string, solutionSan: string): string[] {
  const legalSanMoves = new Chess(fen).moves();
  const decoys = shuffle(legalSanMoves.filter((move) => move !== solutionSan)).slice(0, 3);
  return shuffle([solutionSan, ...decoys]);
}

export function lichessToMateSeed(payload: LichessPuzzleResponse, stage: MateStage): MatePuzzleSeed {
  const firstMove = payload.puzzle.solution[0];
  if (!firstMove) {
    throw new Error("Puzzle has no solution line.");
  }
  const fen = buildFenAtPuzzleStart(payload.game.pgn, payload.puzzle.initialPly, firstMove);
  const solution = sanFromUci(fen, firstMove);
  const mateTheme = stage === "mate_in_1" ? "mateIn1" : "mateIn2";

  return {
    id: `lichess-${payload.puzzle.id}`,
    fen,
    solution,
    choices: buildChoices(fen, solution),
    theme: payload.puzzle.themes.find((theme) => theme === mateTheme) ?? mateTheme,
    source: "lichess",
    rating: payload.puzzle.rating
  };
}

function fallbackForStage(stage: MateStage): MatePuzzleSeed {
  const pool = stage === "mate_in_1" ? MATE_IN_1_FALLBACK : MATE_IN_2_FALLBACK;
  const puzzle = pickRandom(pool);
  const solution = sanFromUci(puzzle.fen, puzzle.solutionUci);
  return {
    id: puzzle.id,
    fen: puzzle.fen,
    solution,
    choices: buildChoices(puzzle.fen, solution),
    theme: puzzle.theme,
    source: "fallback"
  };
}

async function fetchLichessPuzzle(angle: PuzzleAngle): Promise<LichessPuzzleResponse> {
  const response = await fetch(`https://lichess.org/api/puzzle/next?angle=${angle}`, {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(`Lichess puzzle fetch failed (${response.status})`);
  }
  return (await response.json()) as LichessPuzzleResponse;
}

function isFresh(bucket: CacheBucket): boolean {
  return Date.now() - new Date(bucket.updatedAt).getTime() <= CACHE_TTL_MS;
}

async function refillBucket(stage: MateStage): Promise<MatePuzzleSeed[]> {
  const angle = stageToAngle(stage);
  const settled = await Promise.allSettled(
    Array.from({ length: FETCH_BATCH_SIZE }, async () => {
      const payload = await fetchLichessPuzzle(angle);
      return lichessToMateSeed(payload, stage);
    })
  );

  const fetched = settled
    .filter((result): result is PromiseFulfilledResult<MatePuzzleSeed> => result.status === "fulfilled")
    .map((result) => result.value);
  const deduped = new Map(fetched.map((item) => [item.id, item]));
  return [...deduped.values()];
}

export async function getNextMatePuzzle(stage: MateStage): Promise<MatePuzzleSeed> {
  const angle = stageToAngle(stage);
  const cache = readCache();
  const bucket = cache[angle];

  if (bucket.items.length === 0 || !isFresh(bucket)) {
    try {
      const fetched = await refillBucket(stage);
      cache[angle] = {
        updatedAt: new Date().toISOString(),
        items: fetched
      };
      writeCache(cache);
    } catch {
      if (bucket.items.length === 0) {
        return fallbackForStage(stage);
      }
    }
  }

  const next = cache[angle].items.shift();
  writeCache(cache);

  if (!next) {
    return fallbackForStage(stage);
  }

  if (cache[angle].items.length < MIN_CACHE_ITEMS) {
    void refillBucket(stage)
      .then((items) => {
        const latest = readCache();
        latest[angle] = {
          updatedAt: new Date().toISOString(),
          items: [...latest[angle].items, ...items].slice(-FETCH_BATCH_SIZE * 2)
        };
        writeCache(latest);
      })
      .catch(() => undefined);
  }

  return next;
}

export function fallbackSeedFromDefinition(puzzle: FallbackPuzzle, stage: MateStage): MatePuzzleSeed {
  const solution = sanFromUci(puzzle.fen, puzzle.solutionUci);
  return {
    id: puzzle.id,
    fen: puzzle.fen,
    solution,
    choices: buildChoices(puzzle.fen, solution),
    theme: puzzle.theme,
    source: "fallback"
  };
}
