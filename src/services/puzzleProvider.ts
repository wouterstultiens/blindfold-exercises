import { pickRandom } from "../lib/random";
import type { PuzzleSettings, PuzzleSource } from "../types";

export interface PuzzleRecallSeed {
  puzzleId: string;
  fen: string;
  sideToMove: "w" | "b";
  pieceCount: number;
  whitePieces: string[];
  blackPieces: string[];
  continuationSan: string[];
  continuationText: string;
  themes?: string[];
  source: PuzzleSource;
}

interface PuzzleManifest {
  version: number;
  generatedAt: string;
  source: string;
  maxPieces: number;
  maxContinuationPlies: number;
  sourcesUsed: string[];
  count: number;
  puzzlesFile: string;
}

interface RawPuzzleSeed {
  puzzleId: unknown;
  fen: unknown;
  sideToMove: unknown;
  pieceCount: unknown;
  whitePieces: unknown;
  blackPieces: unknown;
  continuationSan: unknown;
  continuationText: unknown;
  themes?: unknown;
  source?: unknown;
}

const RECENT_PUZZLES_KEY = "blindfold.puzzle-recent.v2";
const RECENT_IDS_SIZE = 40;
const MANIFEST_FILE = "manifest.json";
const MISSING_DB_HINT = "Puzzle DB not found. Run `npm run puzzles:build` to generate `public/puzzles/*`.";
const MAX_CLEAR_CONTINUATION_PLIES = 4;

let manifestPromise: Promise<PuzzleManifest> | null = null;
let puzzlesPromise: Promise<PuzzleRecallSeed[]> | null = null;

function baseAssetPath(): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return base.endsWith("/") ? base : `${base}/`;
}

function puzzleAssetUrl(file: string): string {
  return `${baseAssetPath()}puzzles/${file}`;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseSeed(raw: RawPuzzleSeed): PuzzleRecallSeed | null {
  const themes = raw.themes;
  const parsedThemes = isStringArray(themes) ? themes : undefined;
  const source: PuzzleSource = raw.source === "tablebase_syzygy" ? "tablebase_syzygy" : "tablebase_syzygy";

  if (
    typeof raw.puzzleId !== "string" ||
    typeof raw.fen !== "string" ||
    (raw.sideToMove !== "w" && raw.sideToMove !== "b") ||
    typeof raw.pieceCount !== "number" ||
    !isStringArray(raw.whitePieces) ||
    !isStringArray(raw.blackPieces) ||
    !isStringArray(raw.continuationSan) ||
    raw.continuationSan.length === 0 ||
    typeof raw.continuationText !== "string"
  ) {
    return null;
  }

  return {
    puzzleId: raw.puzzleId,
    fen: raw.fen,
    sideToMove: raw.sideToMove,
    pieceCount: raw.pieceCount,
    whitePieces: raw.whitePieces,
    blackPieces: raw.blackPieces,
    continuationSan: raw.continuationSan,
    continuationText: raw.continuationText,
    themes: parsedThemes,
    source
  };
}

function isClearShortPuzzle(seed: PuzzleRecallSeed): boolean {
  return seed.continuationSan.length <= MAX_CLEAR_CONTINUATION_PLIES;
}

function matchesSettings(seed: PuzzleRecallSeed, settings: PuzzleSettings): boolean {
  return seed.pieceCount <= settings.maxPieces && isClearShortPuzzle(seed);
}

function readRecentPuzzleIds(): string[] {
  const raw = localStorage.getItem(RECENT_PUZZLES_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === "string").slice(-RECENT_IDS_SIZE);
  } catch {
    return [];
  }
}

function markRecentPuzzleId(puzzleId: string): void {
  const next = readRecentPuzzleIds().filter((id) => id !== puzzleId);
  next.push(puzzleId);
  localStorage.setItem(RECENT_PUZZLES_KEY, JSON.stringify(next.slice(-RECENT_IDS_SIZE)));
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(MISSING_DB_HINT);
    }
    throw new Error(`Failed to load puzzle asset (${response.status}): ${url}`);
  }
  return response.json();
}

function parseManifest(raw: unknown): PuzzleManifest {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Invalid puzzle manifest. ${MISSING_DB_HINT}`);
  }

  const candidate = raw as Record<string, unknown>;
  const version = candidate.version;
  const generatedAt = candidate.generatedAt;
  const source = candidate.source;
  const maxPieces = candidate.maxPieces;
  const maxContinuationPlies = candidate.maxContinuationPlies;
  const sourcesUsed = candidate.sourcesUsed;
  const count = candidate.count;
  const puzzlesFile = candidate.puzzlesFile;

  if (
    typeof version !== "number" ||
    typeof generatedAt !== "string" ||
    typeof source !== "string" ||
    typeof maxPieces !== "number" ||
    typeof maxContinuationPlies !== "number" ||
    !Array.isArray(sourcesUsed) ||
    typeof count !== "number" ||
    typeof puzzlesFile !== "string"
  ) {
    throw new Error(`Invalid puzzle manifest shape. ${MISSING_DB_HINT}`);
  }

  if (!sourcesUsed.every((entry) => typeof entry === "string")) {
    throw new Error(`Invalid puzzle manifest sources. ${MISSING_DB_HINT}`);
  }

  return {
    version,
    generatedAt,
    source,
    maxPieces,
    maxContinuationPlies,
    sourcesUsed: sourcesUsed as string[],
    count,
    puzzlesFile
  };
}

async function loadManifest(): Promise<PuzzleManifest> {
  if (!manifestPromise) {
    manifestPromise = fetchJson(puzzleAssetUrl(MANIFEST_FILE))
      .then(parseManifest)
      .catch((error) => {
        manifestPromise = null;
        throw error;
      });
  }
  return manifestPromise;
}

async function loadPuzzles(manifest: PuzzleManifest): Promise<PuzzleRecallSeed[]> {
  if (!puzzlesPromise) {
    puzzlesPromise = fetchJson(puzzleAssetUrl(manifest.puzzlesFile))
      .then((raw) => {
        if (!Array.isArray(raw)) {
          throw new Error(`Invalid puzzle shard format: ${manifest.puzzlesFile}`);
        }
        return raw
          .map((item) => parseSeed(item as RawPuzzleSeed))
          .filter((item): item is PuzzleRecallSeed => item !== null);
      })
      .catch((error) => {
        puzzlesPromise = null;
        throw error;
      });
  }
  return puzzlesPromise;
}

function dedupeSeeds(items: PuzzleRecallSeed[]): PuzzleRecallSeed[] {
  return [...new Map(items.map((item) => [item.puzzleId, item])).values()];
}

export async function getNextPuzzle(settings: PuzzleSettings): Promise<PuzzleRecallSeed> {
  const manifest = await loadManifest();
  if (manifest.version !== 5) {
    throw new Error(`Unsupported puzzle manifest version ${manifest.version}. Regenerate puzzle DB.`);
  }

  const puzzles = await loadPuzzles(manifest);
  if (puzzles.length === 0) {
    throw new Error("Puzzle DB is empty. Regenerate puzzle DB.");
  }

  const matches = dedupeSeeds(puzzles).filter((seed) => matchesSettings(seed, settings));
  const pool = matches.length > 0 ? matches : puzzles.filter((seed) => seed.pieceCount <= settings.maxPieces);
  if (pool.length === 0) {
    throw new Error("No puzzle matched this max piece setting. Regenerate puzzle DB with broader criteria.");
  }

  const recentIds = new Set(readRecentPuzzleIds());
  const fresh = pool.filter((seed) => !recentIds.has(seed.puzzleId));
  const selected = pickRandom(fresh.length > 0 ? fresh : pool);
  markRecentPuzzleId(selected.puzzleId);
  return selected;
}

export function toPieceLines(seed: Pick<PuzzleRecallSeed, "whitePieces" | "blackPieces">): string[] {
  return [`White: ${seed.whitePieces.join(", ")}`, `Black: ${seed.blackPieces.join(", ")}`];
}

export function __resetPuzzleDbCacheForTests(): void {
  manifestPromise = null;
  puzzlesPromise = null;
}
