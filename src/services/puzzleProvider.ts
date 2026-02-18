import { pickRandom } from "../lib/random";
import type { PuzzleSettings, PuzzleSource } from "../types";

export interface PuzzleRecallSeed {
  puzzleId: string;
  fen: string;
  sideToMove: "w" | "b";
  pieceCount: number;
  ratingBucket: number;
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
  maxContinuationPlies: number;
  pieceCounts: number[];
  ratingBuckets: number[];
  countsByCombo: Record<string, number>;
  shardPattern: string;
  totalCount: number;
}

interface RawPuzzleSeed {
  puzzleId: unknown;
  fen: unknown;
  sideToMove: unknown;
  pieceCount: unknown;
  ratingBucket: unknown;
  whitePieces: unknown;
  blackPieces: unknown;
  continuationSan: unknown;
  continuationText: unknown;
  themes?: unknown;
  source?: unknown;
}

export interface PuzzleCatalog {
  pieceCounts: number[];
  ratingBuckets: number[];
  countsByCombo: Record<string, number>;
}

const RECENT_PUZZLES_KEY_PREFIX = "blindfold.puzzle-recent.v3";
const RECENT_IDS_SIZE = 50;
const MANIFEST_FILE = "manifest.json";
const MISSING_DB_HINT = "Puzzle DB not found. Run `npm run puzzles:build` to generate `public/puzzles/*`.";
const MANIFEST_VERSION = 6;
const MAX_CLEAR_CONTINUATION_PLIES = 4;

let manifestPromise: Promise<PuzzleManifest> | null = null;
const shardPromises = new Map<string, Promise<PuzzleRecallSeed[]>>();

function baseAssetPath(): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return base.endsWith("/") ? base : `${base}/`;
}

function puzzleAssetUrl(file: string): string {
  return `${baseAssetPath()}puzzles/${file}`;
}

function comboKey(settings: Pick<PuzzleSettings, "pieceCount" | "ratingBucket">): string {
  return `p${settings.pieceCount}-r${settings.ratingBucket}`;
}

function comboRecentKey(settings: Pick<PuzzleSettings, "pieceCount" | "ratingBucket">): string {
  return `${RECENT_PUZZLES_KEY_PREFIX}.${comboKey(settings)}`;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseSeed(raw: RawPuzzleSeed): PuzzleRecallSeed | null {
  const themes = raw.themes;
  const parsedThemes = isStringArray(themes) ? themes : undefined;

  if (
    typeof raw.puzzleId !== "string" ||
    typeof raw.fen !== "string" ||
    (raw.sideToMove !== "w" && raw.sideToMove !== "b") ||
    typeof raw.pieceCount !== "number" ||
    typeof raw.ratingBucket !== "number" ||
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
    ratingBucket: raw.ratingBucket,
    whitePieces: raw.whitePieces,
    blackPieces: raw.blackPieces,
    continuationSan: raw.continuationSan,
    continuationText: raw.continuationText,
    themes: parsedThemes,
    source: "lichess_static"
  };
}

function isClearShortPuzzle(seed: PuzzleRecallSeed): boolean {
  return seed.continuationSan.length <= MAX_CLEAR_CONTINUATION_PLIES;
}

function matchesSettings(seed: PuzzleRecallSeed, settings: PuzzleSettings): boolean {
  return seed.pieceCount === settings.pieceCount && seed.ratingBucket === settings.ratingBucket && isClearShortPuzzle(seed);
}

function readRecentPuzzleIds(settings: PuzzleSettings): string[] {
  const raw = localStorage.getItem(comboRecentKey(settings));
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

function markRecentPuzzleId(settings: PuzzleSettings, puzzleId: string): void {
  const next = readRecentPuzzleIds(settings).filter((id) => id !== puzzleId);
  next.push(puzzleId);
  localStorage.setItem(comboRecentKey(settings), JSON.stringify(next.slice(-RECENT_IDS_SIZE)));
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
  const maxContinuationPlies = candidate.maxContinuationPlies;
  const pieceCounts = candidate.pieceCounts;
  const ratingBuckets = candidate.ratingBuckets;
  const countsByCombo = candidate.countsByCombo;
  const shardPattern = candidate.shardPattern;
  const totalCount = candidate.totalCount;

  if (
    typeof version !== "number" ||
    typeof generatedAt !== "string" ||
    typeof source !== "string" ||
    typeof maxContinuationPlies !== "number" ||
    !Array.isArray(pieceCounts) ||
    !Array.isArray(ratingBuckets) ||
    !countsByCombo ||
    typeof countsByCombo !== "object" ||
    typeof shardPattern !== "string" ||
    typeof totalCount !== "number"
  ) {
    throw new Error(`Invalid puzzle manifest shape. ${MISSING_DB_HINT}`);
  }

  const parsedPieceCounts = pieceCounts.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  const parsedRatingBuckets = ratingBuckets.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (parsedPieceCounts.length === 0 || parsedRatingBuckets.length === 0) {
    throw new Error(`Invalid puzzle manifest lists. ${MISSING_DB_HINT}`);
  }

  return {
    version,
    generatedAt,
    source,
    maxContinuationPlies,
    pieceCounts: parsedPieceCounts,
    ratingBuckets: parsedRatingBuckets,
    countsByCombo: countsByCombo as Record<string, number>,
    shardPattern,
    totalCount
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

function shardPathFor(manifest: PuzzleManifest, settings: PuzzleSettings): string {
  if (manifest.shardPattern.includes("{pieceCount}") && manifest.shardPattern.includes("{ratingBucket}")) {
    return manifest.shardPattern
      .replaceAll("{pieceCount}", String(settings.pieceCount))
      .replaceAll("{ratingBucket}", String(settings.ratingBucket));
  }

  return `lichess/p${settings.pieceCount}/r${settings.ratingBucket}.json`;
}

async function loadShard(manifest: PuzzleManifest, settings: PuzzleSettings): Promise<PuzzleRecallSeed[]> {
  const key = comboKey(settings);
  if (!shardPromises.has(key)) {
    const file = shardPathFor(manifest, settings);
    const promise = fetchJson(puzzleAssetUrl(file))
      .then((raw) => {
        if (!Array.isArray(raw)) {
          throw new Error(`Invalid puzzle shard format: ${file}`);
        }
        return raw
          .map((item) => parseSeed(item as RawPuzzleSeed))
          .filter((item): item is PuzzleRecallSeed => item !== null);
      })
      .catch((error) => {
        shardPromises.delete(key);
        throw error;
      });

    shardPromises.set(key, promise);
  }

  return shardPromises.get(key)!;
}

function dedupeSeeds(items: PuzzleRecallSeed[]): PuzzleRecallSeed[] {
  return [...new Map(items.map((item) => [item.puzzleId, item])).values()];
}

export async function getPuzzleCatalog(): Promise<PuzzleCatalog> {
  const manifest = await loadManifest();
  if (manifest.version !== MANIFEST_VERSION) {
    throw new Error(`Unsupported puzzle manifest version ${manifest.version}. Regenerate puzzle DB.`);
  }

  return {
    pieceCounts: [...manifest.pieceCounts].sort((a, b) => a - b),
    ratingBuckets: [...manifest.ratingBuckets].sort((a, b) => a - b),
    countsByCombo: manifest.countsByCombo
  };
}

export async function getNextPuzzle(settings: PuzzleSettings): Promise<PuzzleRecallSeed> {
  const manifest = await loadManifest();
  if (manifest.version !== MANIFEST_VERSION) {
    throw new Error(`Unsupported puzzle manifest version ${manifest.version}. Regenerate puzzle DB.`);
  }

  if (!manifest.pieceCounts.includes(settings.pieceCount) || !manifest.ratingBuckets.includes(settings.ratingBucket)) {
    throw new Error("Selected puzzle settings are not available in this puzzle DB.");
  }
  const combo = comboKey(settings);
  if (!Object.hasOwn(manifest.countsByCombo, combo) || Number(manifest.countsByCombo[combo]) <= 0) {
    throw new Error(`No puzzle matched ${settings.pieceCount} pieces @ ${settings.ratingBucket}.`);
  }

  const puzzles = await loadShard(manifest, settings);
  if (puzzles.length === 0) {
    throw new Error("Puzzle DB combo shard is empty. Regenerate puzzle DB.");
  }

  const pool = dedupeSeeds(puzzles).filter((seed) => matchesSettings(seed, settings));
  if (pool.length === 0) {
    throw new Error(`No puzzle matched ${settings.pieceCount} pieces @ ${settings.ratingBucket}. Regenerate puzzle DB.`);
  }

  const recentIds = new Set(readRecentPuzzleIds(settings));
  const fresh = pool.filter((seed) => !recentIds.has(seed.puzzleId));
  const selected = pickRandom(fresh.length > 0 ? fresh : pool);
  markRecentPuzzleId(settings, selected.puzzleId);
  return selected;
}

export function toPieceLines(seed: Pick<PuzzleRecallSeed, "whitePieces" | "blackPieces">): string[] {
  return [`White: ${seed.whitePieces.join(", ")}`, `Black: ${seed.blackPieces.join(", ")}`];
}

export function __resetPuzzleDbCacheForTests(): void {
  manifestPromise = null;
  shardPromises.clear();
}
