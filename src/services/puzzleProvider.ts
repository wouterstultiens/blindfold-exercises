import { pickRandom } from "../lib/random";
import type { PuzzleSettings, PuzzleSource } from "../types";

export interface PuzzleRecallSeed {
  puzzleId: string;
  fen: string;
  sideToMove: "w" | "b";
  rating: number;
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
  files: Array<{
    bucket: number;
    file: string;
    count: number;
  }>;
}

interface RawPuzzleSeed {
  puzzleId: unknown;
  fen: unknown;
  sideToMove: unknown;
  rating: unknown;
  pieceCount: unknown;
  whitePieces: unknown;
  blackPieces: unknown;
  continuationSan: unknown;
  continuationText: unknown;
  themes?: unknown;
  source?: unknown;
}

const RECENT_PUZZLES_KEY = "blindfold.puzzle-recent.v1";
const RECENT_IDS_SIZE = 40;
const RATING_BUCKET_SIZE = 100;
const MANIFEST_FILE = "manifest.json";
const MISSING_DB_HINT = "Puzzle DB not found. Run `npm run puzzles:build` to generate `public/puzzles/*`.";
const MAX_CLEAR_CONTINUATION_PLIES = 4;
const LOW_PIECE_ENDGAME_THRESHOLD = 10;
const ENDGAME_THEMES = new Set([
  "endgame",
  "pawnEndgame",
  "rookEndgame",
  "bishopEndgame",
  "knightEndgame",
  "queenEndgame",
  "queenRookEndgame"
]);
const EXCLUDED_THEMES = new Set([
  ...ENDGAME_THEMES,
  "veryLong"
]);
const TACTICAL_THEMES = new Set([
  "oneMove",
  "short",
  "fork",
  "pin",
  "skewer",
  "discoveredAttack",
  "doubleCheck",
  "hangingPiece",
  "trappedPiece",
  "sacrifice",
  "deflection",
  "attraction",
  "interference",
  "clearance",
  "capturingDefender",
  "xRayAttack",
  "backRankMate",
  "smotheredMate",
  "arabianMate",
  "anastasiaMate",
  "bodenMate",
  "dovetailMate",
  "hookMate",
  "doubleBishopMate"
]);

let manifestPromise: Promise<PuzzleManifest> | null = null;
const shardCache = new Map<number, Promise<PuzzleRecallSeed[]>>();

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
  const source = raw.source === "tablebase_api" ? "tablebase_api" : "local_db";

  if (
    typeof raw.puzzleId !== "string" ||
    typeof raw.fen !== "string" ||
    (raw.sideToMove !== "w" && raw.sideToMove !== "b") ||
    typeof raw.rating !== "number" ||
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
    rating: raw.rating,
    pieceCount: raw.pieceCount,
    whitePieces: raw.whitePieces,
    blackPieces: raw.blackPieces,
    continuationSan: raw.continuationSan,
    continuationText: raw.continuationText,
    themes: parsedThemes,
    source
  };
}

function hasClearTacticalTheme(themes: string[], pieceCount: number): boolean {
  if (themes.length === 0) {
    return false;
  }

  if (themes.includes("veryLong")) {
    return false;
  }

  const hasEndgameTheme = themes.some((theme) => ENDGAME_THEMES.has(theme));
  const hasTacticalOrMateTheme = themes.some((theme) => theme.startsWith("mate") || TACTICAL_THEMES.has(theme));

  if (hasEndgameTheme) {
    return pieceCount <= LOW_PIECE_ENDGAME_THRESHOLD || hasTacticalOrMateTheme;
  }

  if (themes.some((theme) => EXCLUDED_THEMES.has(theme))) {
    return false;
  }

  return hasTacticalOrMateTheme;
}

function hasFallbackMateSignal(continuationSan: string[]): boolean {
  return continuationSan.some((san) => /#/.test(san));
}

function isClearShortPuzzle(seed: PuzzleRecallSeed): boolean {
  if (seed.continuationSan.length > MAX_CLEAR_CONTINUATION_PLIES) {
    return false;
  }

  if (seed.source === "tablebase_api") {
    return true;
  }

  if (seed.themes && seed.themes.length > 0) {
    return hasClearTacticalTheme(seed.themes, seed.pieceCount);
  }

  return hasFallbackMateSignal(seed.continuationSan);
}

function matchesSettings(seed: PuzzleRecallSeed, settings: PuzzleSettings): boolean {
  return (
    seed.pieceCount <= settings.maxPieces &&
    Math.abs(seed.rating - settings.targetRating) <= 100 &&
    isClearShortPuzzle(seed)
  );
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

  const candidate = raw as {
    version?: unknown;
    generatedAt?: unknown;
    files?: unknown;
  };

  if (typeof candidate.version !== "number" || typeof candidate.generatedAt !== "string" || !Array.isArray(candidate.files)) {
    throw new Error(`Invalid puzzle manifest shape. ${MISSING_DB_HINT}`);
  }

  const files = candidate.files
    .map((entry) => {
      const fileEntry = entry as { bucket?: unknown; file?: unknown; count?: unknown };
      if (
        typeof fileEntry?.bucket !== "number" ||
        typeof fileEntry?.file !== "string" ||
        typeof fileEntry?.count !== "number"
      ) {
        return null;
      }
      return {
        bucket: fileEntry.bucket,
        file: fileEntry.file,
        count: fileEntry.count
      };
    })
    .filter((entry): entry is { bucket: number; file: string; count: number } => entry !== null);

  if (files.length === 0) {
    throw new Error(`Puzzle manifest has no shard files. ${MISSING_DB_HINT}`);
  }

  return {
    version: candidate.version,
    generatedAt: candidate.generatedAt,
    files
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

async function loadShard(bucket: number): Promise<PuzzleRecallSeed[]> {
  const cached = shardCache.get(bucket);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const manifest = await loadManifest();
    const fileEntry = manifest.files.find((file) => file.bucket === bucket);
    if (!fileEntry) {
      return [];
    }

    const raw = await fetchJson(puzzleAssetUrl(fileEntry.file));
    if (!Array.isArray(raw)) {
      throw new Error(`Invalid puzzle shard format: ${fileEntry.file}`);
    }

    return raw
      .map((item) => parseSeed(item as RawPuzzleSeed))
      .filter((item): item is PuzzleRecallSeed => item !== null);
  })();

  shardCache.set(
    bucket,
    promise.catch((error) => {
      shardCache.delete(bucket);
      throw error;
    })
  );
  return shardCache.get(bucket) as Promise<PuzzleRecallSeed[]>;
}

function bucketsForSettings(manifest: PuzzleManifest, settings: PuzzleSettings): number[] {
  const minBucket = Math.floor((settings.targetRating - 100) / RATING_BUCKET_SIZE) * RATING_BUCKET_SIZE;
  const maxBucket = Math.floor((settings.targetRating + 100) / RATING_BUCKET_SIZE) * RATING_BUCKET_SIZE;

  return manifest.files
    .map((file) => file.bucket)
    .filter((bucket) => bucket >= minBucket && bucket <= maxBucket);
}

function dedupeSeeds(items: PuzzleRecallSeed[]): PuzzleRecallSeed[] {
  return [...new Map(items.map((item) => [item.puzzleId, item])).values()];
}

export async function getNextPuzzle(settings: PuzzleSettings): Promise<PuzzleRecallSeed> {
  const manifest = await loadManifest();
  const buckets = bucketsForSettings(manifest, settings);

  if (buckets.length === 0) {
    throw new Error("No puzzle shard found for this rating range. Regenerate puzzle DB.");
  }

  const shardItems = await Promise.all(buckets.map((bucket) => loadShard(bucket)));
  const matches = dedupeSeeds(shardItems.flat()).filter((seed) => matchesSettings(seed, settings));

  if (matches.length === 0 && settings.maxPieces <= 7) {
    const allBuckets = manifest.files.map((file) => file.bucket);
    const allShardItems = await Promise.all(allBuckets.map((bucket) => loadShard(bucket)));
    const tablebaseFallback = dedupeSeeds(allShardItems.flat()).filter(
      (seed) => seed.source === "tablebase_api" && seed.pieceCount <= settings.maxPieces && isClearShortPuzzle(seed)
    );
    if (tablebaseFallback.length > 0) {
      const fallbackChoice = pickRandom(tablebaseFallback);
      markRecentPuzzleId(fallbackChoice.puzzleId);
      return fallbackChoice;
    }
  }

  if (matches.length === 0) {
    throw new Error("No puzzle matched this max pieces and rating range. Try another setting.");
  }

  const recentIds = new Set(readRecentPuzzleIds());
  const fresh = matches.filter((seed) => !recentIds.has(seed.puzzleId));
  const selected = pickRandom(fresh.length > 0 ? fresh : matches);
  markRecentPuzzleId(selected.puzzleId);
  return selected;
}

export function toPieceLines(seed: Pick<PuzzleRecallSeed, "whitePieces" | "blackPieces">): string[] {
  return [`White: ${seed.whitePieces.join(", ")}`, `Black: ${seed.blackPieces.join(", ")}`];
}

export function __resetPuzzleDbCacheForTests(): void {
  manifestPromise = null;
  shardCache.clear();
}
