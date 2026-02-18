#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import readline from "node:readline";
import { Chess } from "chess.js";

const INPUT_PATH = path.resolve(process.cwd(), "lichess_db_puzzle.csv.zst");
const OUTPUT_DIR = path.resolve(process.cwd(), "public", "puzzles");
const MANIFEST_PATH = path.join(OUTPUT_DIR, "manifest.json");
const STATE_PATH = path.join(OUTPUT_DIR, "build-state.json");

const RATING_MIN = 600;
const RATING_MAX = 2800;
const RATING_BUCKET_SIZE = 100;
const DEFAULT_MAX_PER_BUCKET = Number.parseInt(process.env.PUZZLES_MAX_PER_BUCKET ?? "10000", 10);
const DEFAULT_ROWS_PER_RUN = Number.parseInt(process.env.PUZZLES_ROWS_PER_RUN ?? "250000", 10);
const DEFAULT_MAX_PIECES = Number.parseInt(process.env.PUZZLES_MAX_PIECES ?? "7", 10);
const DEFAULT_MAX_PLIES = Number.parseInt(process.env.PUZZLES_MAX_CONTINUATION_PLIES ?? "4", 10);
const DEFAULT_TABLEBASE_BUDGET = Number.parseInt(process.env.PUZZLES_TABLEBASE_BUDGET ?? "250", 10);
const LOW_PIECE_ENDGAME_THRESHOLD = 10;
const TABLEBASE_MAX_PIECES = 7;
const TABLEBASE_URL = "https://tablebase.lichess.ovh/standard";
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);

const ENDGAME_THEMES = new Set([
  "endgame",
  "pawnEndgame",
  "rookEndgame",
  "bishopEndgame",
  "knightEndgame",
  "queenEndgame",
  "queenRookEndgame"
]);
const EXCLUDED_THEMES = new Set([...ENDGAME_THEMES, "veryLong"]);
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

function parseSources(raw) {
  const result = { lichess: false, tablebase: false };
  const tokens = String(raw)
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  for (const token of tokens) {
    if (token === "lichess") {
      result.lichess = true;
      continue;
    }
    if (token === "tablebase") {
      result.tablebase = true;
      continue;
    }
    throw new Error(`Unknown source '${token}'. Allowed: lichess,tablebase`);
  }

  if (!result.lichess && !result.tablebase) {
    throw new Error("At least one source must be enabled. Allowed: lichess,tablebase");
  }

  return result;
}

const DEFAULT_SOURCES = parseSources(process.env.PUZZLES_SOURCES ?? "lichess,tablebase");

function sourcesKey(sources) {
  const parts = [];
  if (sources.lichess) parts.push("lichess");
  if (sources.tablebase) parts.push("tablebase");
  return parts.join(",");
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let reset = false;
  let full = false;
  let rows = DEFAULT_ROWS_PER_RUN;
  let maxPieces = DEFAULT_MAX_PIECES;
  let maxPlies = DEFAULT_MAX_PLIES;
  let tablebaseBudget = DEFAULT_TABLEBASE_BUDGET;
  let sources = DEFAULT_SOURCES;
  let includeEndgamesLowPiece = null;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--reset") {
      reset = true;
      continue;
    }
    if (arg === "--full") {
      full = true;
      continue;
    }
    if (arg === "--rows") {
      const value = Number.parseInt(args[i + 1] ?? "", 10);
      if (!Number.isFinite(value) || value <= 0) throw new Error("--rows must be a positive integer");
      rows = value;
      i += 1;
      continue;
    }
    if (arg === "--max-pieces") {
      const value = Number.parseInt(args[i + 1] ?? "", 10);
      if (!Number.isFinite(value) || value < 2 || value > 32) throw new Error("--max-pieces must be 2..32");
      maxPieces = value;
      i += 1;
      continue;
    }
    if (arg === "--max-plies") {
      const value = Number.parseInt(args[i + 1] ?? "", 10);
      if (!Number.isFinite(value) || value < 1 || value > 12) throw new Error("--max-plies must be 1..12");
      maxPlies = value;
      i += 1;
      continue;
    }
    if (arg === "--tablebase-budget") {
      const value = Number.parseInt(args[i + 1] ?? "", 10);
      if (!Number.isFinite(value) || value < 0) throw new Error("--tablebase-budget must be >= 0");
      tablebaseBudget = value;
      i += 1;
      continue;
    }
    if (arg === "--sources") {
      sources = parseSources(args[i + 1] ?? "");
      i += 1;
      continue;
    }
    if (arg === "--include-endgames-low-piece") {
      includeEndgamesLowPiece = true;
      continue;
    }
    if (arg === "--exclude-endgames-low-piece") {
      includeEndgamesLowPiece = false;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (full) rows = Number.MAX_SAFE_INTEGER;
  if (includeEndgamesLowPiece === null) includeEndgamesLowPiece = maxPieces <= LOW_PIECE_ENDGAME_THRESHOLD;

  return {
    reset,
    full,
    rows,
    maxPieces,
    maxPlies,
    tablebaseBudget,
    sources,
    includeEndgamesLowPiece
  };
}
function isUsableZstd(candidate) {
  if (!candidate) return false;
  const probe = spawnSync(candidate, ["--version"], { stdio: "ignore" });
  return probe.status === 0;
}

function findWingetZstdCandidates() {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return [];
  const root = path.join(localAppData, "Microsoft", "WinGet", "Packages");
  if (!fs.existsSync(root)) return [];

  const packageDirs = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("Meta.Zstandard_"))
    .map((entry) => path.join(root, entry.name));

  const candidates = [];
  for (const packageDir of packageDirs) {
    const direct = path.join(packageDir, "zstd.exe");
    if (fs.existsSync(direct)) candidates.push(direct);
    const children = fs.readdirSync(packageDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
    for (const child of children) {
      const nested = path.join(packageDir, child.name, "zstd.exe");
      if (fs.existsSync(nested)) candidates.push(nested);
    }
  }

  return candidates;
}

function resolveZstdBinary() {
  const explicit = process.env.ZSTD_BIN;
  if (explicit && fs.existsSync(explicit) && isUsableZstd(explicit)) return explicit;
  if (isUsableZstd("zstd")) return "zstd";

  const windowsProgramFiles = "C:\\Program Files\\zstd\\zstd.exe";
  if (process.platform === "win32" && fs.existsSync(windowsProgramFiles) && isUsableZstd(windowsProgramFiles)) {
    return windowsProgramFiles;
  }

  if (process.platform === "win32") {
    for (const candidate of findWingetZstdCandidates()) {
      if (isUsableZstd(candidate)) return candidate;
    }
  }

  throw new Error("zstd CLI is not installed or not discoverable. Install zstd and rerun `npm run puzzles:build`.");
}

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(cell);
      cell = "";
      continue;
    }

    cell += char;
  }

  cells.push(cell);
  return cells;
}

function parseThemes(rawThemes) {
  if (!rawThemes) return [];
  return rawThemes.trim().split(/\s+/).filter(Boolean);
}

function hasClearTheme(themes, pieceCount, includeEndgamesLowPiece) {
  if (themes.length === 0 || themes.includes("veryLong")) return false;

  const hasEndgameTheme = themes.some((theme) => ENDGAME_THEMES.has(theme));
  const hasTacticalOrMate = themes.some((theme) => theme.startsWith("mate") || TACTICAL_THEMES.has(theme));

  if (hasEndgameTheme && includeEndgamesLowPiece && pieceCount <= LOW_PIECE_ENDGAME_THRESHOLD) {
    return true;
  }

  if (themes.some((theme) => EXCLUDED_THEMES.has(theme))) return false;
  return hasTacticalOrMate;
}

function shouldKeepLichessPuzzle(themes, uciLine, pieceCount, maxPlies, includeEndgamesLowPiece) {
  if (uciLine.length === 0 || uciLine.length > maxPlies) return false;
  return hasClearTheme(themes, pieceCount, includeEndgamesLowPiece);
}

function uciToMovePayload(uci) {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci[4] : undefined;
  return { from, to, promotion };
}

function sanLineFromUci(fen, uciLine, maxPlies) {
  const chess = new Chess(fen);
  const san = [];
  for (let index = 0; index < Math.min(uciLine.length, maxPlies); index += 1) {
    const move = chess.move(uciToMovePayload(uciLine[index]));
    if (!move) return [];
    san.push(move.san);
  }
  return san;
}

function continuationTextFromSan(fen, sanLine) {
  const parts = fen.split(" ");
  let turn = parts[1] === "b" ? "b" : "w";
  let moveNumber = Number.parseInt(parts[5] ?? "1", 10);
  if (!Number.isFinite(moveNumber) || moveNumber < 1) moveNumber = 1;

  const tokens = [];
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

function pieceSortIndex(token) {
  const order = "KQRBNP";
  const piece = token.charAt(0);
  const index = order.indexOf(piece);
  return index < 0 ? order.length : index;
}

function extractPieces(fen) {
  const chess = new Chess(fen);
  const board = chess.board();
  const whitePieces = [];
  const blackPieces = [];
  const files = "abcdefgh";

  for (let rankIndex = 0; rankIndex < board.length; rankIndex += 1) {
    const rank = board[rankIndex];
    if (!rank) continue;
    for (let fileIndex = 0; fileIndex < rank.length; fileIndex += 1) {
      const piece = rank[fileIndex];
      if (!piece) continue;
      const square = `${files[fileIndex]}${8 - rankIndex}`;
      const token = `${piece.type.toUpperCase()}${square}`;
      if (piece.color === "w") whitePieces.push(token);
      else blackPieces.push(token);
    }
  }

  whitePieces.sort((a, b) => pieceSortIndex(a) - pieceSortIndex(b) || a.localeCompare(b));
  blackPieces.sort((a, b) => pieceSortIndex(a) - pieceSortIndex(b) || a.localeCompare(b));

  return {
    sideToMove: fen.split(" ")[1] === "b" ? "b" : "w",
    whitePieces,
    blackPieces,
    pieceCount: whitePieces.length + blackPieces.length
  };
}

function toBucket(rating) {
  if (rating < RATING_MIN || rating > RATING_MAX) return null;
  return Math.floor(rating / RATING_BUCKET_SIZE) * RATING_BUCKET_SIZE;
}

function loadJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function categoryScore(category) {
  switch (category) {
    case "win":
      return 5;
    case "cursed-win":
      return 4;
    case "draw":
      return 3;
    case "blessed-loss":
      return 2;
    case "loss":
      return 1;
    default:
      return 0;
  }
}
async function fetchTablebasePosition(fen, cache) {
  const cached = cache.get(fen);
  if (cached) return cached;

  const promise = (async () => {
    const url = `${TABLEBASE_URL}?fen=${encodeURIComponent(fen)}`;

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      let response;
      try {
        response = await fetch(url);
      } catch {
        if (attempt === 4) return null;
        await delay(150 * Math.pow(2, attempt));
        continue;
      }

      if (response.ok) {
        try {
          return await response.json();
        } catch {
          return null;
        }
      }

      if (!RETRY_STATUSES.has(response.status) || attempt === 4) return null;
      await delay(200 * Math.pow(2, attempt));
    }

    return null;
  })();

  cache.set(
    fen,
    promise.catch(() => {
      cache.delete(fen);
      return null;
    })
  );

  return cache.get(fen);
}

function selectClearBestMove(moves) {
  if (!Array.isArray(moves) || moves.length === 0) return null;

  const scored = moves
    .filter((move) => typeof move?.uci === "string")
    .map((move) => {
      const score = categoryScore(typeof move?.category === "string" ? move.category : "");
      const dtm = Number.parseInt(String(move?.dtm ?? ""), 10);
      return {
        move,
        score,
        dtm: Number.isFinite(dtm) ? Math.abs(dtm) : Number.POSITIVE_INFINITY
      };
    })
    .sort((a, b) => b.score - a.score || a.dtm - b.dtm);

  if (scored.length === 0) return null;

  const best = scored[0];
  if (scored.length === 1) return best.move;

  const second = scored[1];
  if (best.score > second.score) return best.move;
  if (best.score >= 4 && Number.isFinite(best.dtm) && Number.isFinite(second.dtm) && best.dtm + 1 < second.dtm) {
    return best.move;
  }

  return null;
}

function tablebaseRating(bestMove) {
  const parsed = Number.parseInt(String(bestMove?.dtm ?? ""), 10);
  if (!Number.isFinite(parsed)) return 1300;

  const absDtm = Math.min(18, Math.abs(parsed));
  const raw = 1900 - absDtm * 70;
  const clamped = Math.max(700, Math.min(2000, raw));
  return Math.round(clamped / 50) * 50;
}

function hasVisualizationCue(sanLine) {
  return sanLine.some((san) => /[+#x]/.test(san));
}

function tablebasePuzzleId(fen) {
  const hash = crypto.createHash("sha1").update(fen).digest("hex").slice(0, 16);
  return `tb:${hash}`;
}

async function tryBuildTablebaseSeed(fen, pieces, maxPlies, cache) {
  const initial = await fetchTablebasePosition(fen, cache);
  if (!initial || !Array.isArray(initial.moves) || initial.moves.length === 0) return null;

  const firstMove = selectClearBestMove(initial.moves);
  if (!firstMove || typeof firstMove.uci !== "string") return null;
  if (categoryScore(typeof firstMove.category === "string" ? firstMove.category : "") < 4) return null;

  const chess = new Chess(fen);
  const sanLine = [];

  for (let ply = 0; ply < maxPlies; ply += 1) {
    const data = ply === 0 ? initial : await fetchTablebasePosition(chess.fen(), cache);
    if (!data || !Array.isArray(data.moves) || data.moves.length === 0) break;

    const selected = ply === 0 ? firstMove : data.moves[0];
    if (!selected || typeof selected.uci !== "string") break;

    const move = chess.move(uciToMovePayload(selected.uci));
    if (!move) return null;
    sanLine.push(move.san);
    if (move.san.includes("#")) break;
  }

  if (sanLine.length === 0) return null;
  if (!hasVisualizationCue(sanLine) && sanLine.length > 2) return null;

  return {
    puzzleId: tablebasePuzzleId(fen),
    fen,
    sideToMove: pieces.sideToMove,
    rating: tablebaseRating(firstMove),
    pieceCount: pieces.pieceCount,
    whitePieces: pieces.whitePieces,
    blackPieces: pieces.blackPieces,
    continuationSan: sanLine,
    continuationText: continuationTextFromSan(fen, sanLine),
    themes: ["tablebase", "endgame", "short"],
    source: "tablebase_api"
  };
}

function initialState(config) {
  return {
    version: 4,
    source: path.basename(INPUT_PATH),
    rowsProcessed: 0,
    complete: false,
    runs: 0,
    totalKept: 0,
    totalSkippedInvalid: 0,
    totalSkippedOutOfRange: 0,
    totalSkippedPieceCap: 0,
    totalSkippedNotClear: 0,
    totalSkippedCap: 0,
    totalDuplicates: 0,
    totalTablebaseCandidates: 0,
    totalTablebaseKept: 0,
    totalTablebaseSkipped: 0,
    rowsPerRun: config.rowsPerRun,
    maxPerBucket: config.maxPerBucket,
    maxPieces: config.maxPieces,
    maxContinuationPlies: config.maxContinuationPlies,
    includeEndgamesLowPiece: config.includeEndgamesLowPiece,
    sources: config.sources,
    sourcesKey: sourcesKey(config.sources),
    tablebaseBudget: config.tablebaseBudget,
    lastRunAt: null
  };
}

function loadState(config, reset) {
  if (reset) return initialState(config);

  const raw = loadJson(STATE_PATH, null);
  if (!raw || typeof raw !== "object") return initialState(config);
  if (raw.version !== 4) {
    throw new Error(`Existing build state version is ${raw.version}. Run with --reset to rebuild with the current generator.`);
  }

  const state = { ...initialState(config), ...raw };

  if (state.maxPieces !== config.maxPieces) {
    throw new Error(`Existing build state uses maxPieces=${state.maxPieces}. Requested maxPieces=${config.maxPieces}. Run with --reset to change this filter.`);
  }
  if (state.maxContinuationPlies !== config.maxContinuationPlies) {
    throw new Error(`Existing build state uses maxContinuationPlies=${state.maxContinuationPlies}. Requested maxContinuationPlies=${config.maxContinuationPlies}. Run with --reset to change this filter.`);
  }
  if (Boolean(state.includeEndgamesLowPiece) !== Boolean(config.includeEndgamesLowPiece)) {
    throw new Error(`Existing build state uses includeEndgamesLowPiece=${Boolean(state.includeEndgamesLowPiece)}. Requested includeEndgamesLowPiece=${Boolean(config.includeEndgamesLowPiece)}. Run with --reset to change this filter.`);
  }
  if (state.sourcesKey !== sourcesKey(config.sources)) {
    throw new Error(`Existing build state uses sources=${state.sourcesKey}. Requested sources=${sourcesKey(config.sources)}. Run with --reset to change this filter.`);
  }
  if (state.tablebaseBudget !== config.tablebaseBudget) {
    throw new Error(`Existing build state uses tablebaseBudget=${state.tablebaseBudget}. Requested tablebaseBudget=${config.tablebaseBudget}. Run with --reset to change this filter.`);
  }

  state.rowsPerRun = config.rowsPerRun;
  state.maxPerBucket = config.maxPerBucket;
  return state;
}
function ensureInputFile() {
  if (!fs.existsSync(INPUT_PATH)) throw new Error(`Missing input file: ${INPUT_PATH}`);
}

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function clearGeneratedFiles() {
  for (const file of fs.readdirSync(OUTPUT_DIR)) {
    if (file.endsWith(".json")) fs.rmSync(path.join(OUTPUT_DIR, file));
  }
}

function loadExistingBuckets(maxPerBucket) {
  const bucketMap = new Map();
  const seenPuzzleIds = new Set();
  const seenTablebaseFens = new Set();

  for (const file of fs.readdirSync(OUTPUT_DIR)) {
    const match = /^r(\d+)\.json$/u.exec(file);
    if (!match) continue;

    const bucket = Number.parseInt(match[1], 10);
    if (!Number.isFinite(bucket)) continue;

    const fullPath = path.join(OUTPUT_DIR, file);
    const raw = loadJson(fullPath, []);
    if (!Array.isArray(raw)) continue;

    const items = [];
    for (const item of raw) {
      const puzzleId = item?.puzzleId;
      if (typeof puzzleId !== "string" || seenPuzzleIds.has(puzzleId)) continue;
      seenPuzzleIds.add(puzzleId);

      if (item?.source === "tablebase_api" && typeof item?.fen === "string") {
        seenTablebaseFens.add(item.fen);
      }

      items.push(item);
      if (items.length >= maxPerBucket) break;
    }

    if (items.length > 0) bucketMap.set(bucket, items);
  }

  return { bucketMap, seenPuzzleIds, seenTablebaseFens };
}

function addSeedToBucket(seed, bucketMap, seenPuzzleIds, maxPerBucket) {
  const bucket = toBucket(seed.rating);
  if (bucket === null) return "out-of-range";
  if (seenPuzzleIds.has(seed.puzzleId)) return "duplicate";

  const bucketItems = bucketMap.get(bucket) ?? [];
  if (bucketItems.length >= maxPerBucket) return "cap";

  bucketItems.push(seed);
  bucketMap.set(bucket, bucketItems);
  seenPuzzleIds.add(seed.puzzleId);
  return "added";
}

function computePieceHistogram(bucketMap) {
  const histogram = new Map();
  for (const items of bucketMap.values()) {
    for (const item of items) {
      if (!Number.isFinite(item?.pieceCount)) continue;
      const key = String(item.pieceCount);
      histogram.set(key, (histogram.get(key) ?? 0) + 1);
    }
  }

  return Object.fromEntries([...histogram.entries()].sort((a, b) => Number(a[0]) - Number(b[0])));
}

function computeSourceHistogram(bucketMap) {
  let localDb = 0;
  let tablebaseApi = 0;

  for (const items of bucketMap.values()) {
    for (const item of items) {
      if (item?.source === "tablebase_api") tablebaseApi += 1;
      else localDb += 1;
    }
  }

  return { local_db: localDb, tablebase_api: tablebaseApi };
}

function writeShardsAndManifest(bucketMap, state, runStats) {
  const files = [];
  const buckets = [...bucketMap.keys()].sort((a, b) => a - b);

  for (const bucket of buckets) {
    const items = bucketMap.get(bucket) ?? [];
    const file = `r${bucket}.json`;
    fs.writeFileSync(path.join(OUTPUT_DIR, file), JSON.stringify(items), "utf8");
    files.push({ bucket, file, count: items.length });
  }

  const sourcesUsed = [];
  if (state.sources.lichess) sourcesUsed.push("lichess");
  if (state.sources.tablebase) sourcesUsed.push("tablebase_api");

  const manifest = {
    version: 4,
    generatedAt: new Date().toISOString(),
    source: path.basename(INPUT_PATH),
    ratingMin: RATING_MIN,
    ratingMax: RATING_MAX,
    ratingBucketSize: RATING_BUCKET_SIZE,
    maxPerBucket: state.maxPerBucket,
    maxPieces: state.maxPieces,
    maxContinuationPlies: state.maxContinuationPlies,
    includeEndgamesLowPiece: state.includeEndgamesLowPiece,
    filterProfile: "blindfold-short-forcing-v1",
    selectionProfile: "blindfold-short-forcing-v1",
    sourcesUsed,
    tablebaseBudget: state.tablebaseBudget,
    pieceHistogram: computePieceHistogram(bucketMap),
    sourceHistogram: computeSourceHistogram(bucketMap),
    rowsScanned: state.rowsProcessed,
    rowsKept: state.totalKept,
    rowsSkipped:
      state.totalSkippedInvalid +
      state.totalSkippedOutOfRange +
      state.totalSkippedPieceCap +
      state.totalSkippedNotClear +
      state.totalSkippedCap +
      state.totalDuplicates,
    complete: state.complete,
    files,
    lastRun: {
      rowsAdvanced: runStats.rowsAdvanced,
      kept: runStats.kept,
      skippedInvalid: runStats.skippedInvalid,
      skippedOutOfRange: runStats.skippedOutOfRange,
      skippedPieceCap: runStats.skippedPieceCap,
      skippedNotClear: runStats.skippedNotClear,
      skippedCap: runStats.skippedCap,
      duplicates: runStats.duplicates,
      tablebaseCandidates: runStats.tablebaseCandidates,
      tablebaseKept: runStats.tablebaseKept,
      tablebaseSkipped: runStats.tablebaseSkipped
    }
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest), "utf8");
  fs.writeFileSync(STATE_PATH, JSON.stringify(state), "utf8");
}

async function main() {
  const args = parseArgs(process.argv);
  ensureInputFile();
  ensureOutputDir();

  if (args.reset) clearGeneratedFiles();

  const zstdBinary = resolveZstdBinary();
  const state = loadState(
    {
      rowsPerRun: args.rows,
      maxPerBucket: DEFAULT_MAX_PER_BUCKET,
      maxPieces: args.maxPieces,
      maxContinuationPlies: args.maxPlies,
      includeEndgamesLowPiece: args.includeEndgamesLowPiece,
      sources: args.sources,
      tablebaseBudget: args.tablebaseBudget
    },
    args.reset
  );

  const { bucketMap, seenPuzzleIds, seenTablebaseFens } = loadExistingBuckets(state.maxPerBucket);
  const tablebaseCache = new Map();

  if (state.complete && !args.full) {
    writeShardsAndManifest(bucketMap, state, {
      rowsAdvanced: 0,
      kept: 0,
      skippedInvalid: 0,
      skippedOutOfRange: 0,
      skippedPieceCap: 0,
      skippedNotClear: 0,
      skippedCap: 0,
      duplicates: 0,
      tablebaseCandidates: 0,
      tablebaseKept: 0,
      tablebaseSkipped: 0
    });
    console.log("Puzzle DB is already complete. Use --reset to restart or --full to reprocess.");
    return;
  }

  let headerParsed = false;
  let indexMap = null;
  let rowsSeen = 0;
  let stopDueToLimit = false;

  const runStats = {
    rowsAdvanced: 0,
    kept: 0,
    skippedInvalid: 0,
    skippedOutOfRange: 0,
    skippedPieceCap: 0,
    skippedNotClear: 0,
    skippedCap: 0,
    duplicates: 0,
    tablebaseCandidates: 0,
    tablebaseKept: 0,
    tablebaseSkipped: 0
  };

  const zstd = spawn(zstdBinary, ["-dc", INPUT_PATH], { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  zstd.stderr.setEncoding("utf8");
  zstd.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const rl = readline.createInterface({ input: zstd.stdout, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line) continue;

    if (!headerParsed) {
      const header = parseCsvLine(line);
      const puzzleId = header.indexOf("PuzzleId");
      const fen = header.indexOf("FEN");
      const moves = header.indexOf("Moves");
      const rating = header.indexOf("Rating");
      const themes = header.indexOf("Themes");
      if (puzzleId < 0 || fen < 0 || moves < 0 || rating < 0 || themes < 0) {
        throw new Error("Unexpected lichess puzzle CSV header.");
      }
      indexMap = { puzzleId, fen, moves, rating, themes };
      headerParsed = true;
      continue;
    }

    rowsSeen += 1;
    if (rowsSeen <= state.rowsProcessed) continue;
    runStats.rowsAdvanced += 1;

    const cells = parseCsvLine(line);
    const puzzleIdValue = cells[indexMap.puzzleId];
    const fenValue = cells[indexMap.fen];
    const movesValue = cells[indexMap.moves];
    const ratingValue = Number.parseInt(cells[indexMap.rating] ?? "", 10);
    const themesValue = cells[indexMap.themes];

    if (!puzzleIdValue || !fenValue || !movesValue || !Number.isFinite(ratingValue)) {
      runStats.skippedInvalid += 1;
    } else {
      let pieces;
      try {
        pieces = extractPieces(fenValue);
      } catch {
        runStats.skippedInvalid += 1;
        pieces = null;
      }

      if (!pieces) {
        // no-op
      } else if (pieces.pieceCount > state.maxPieces) {
        runStats.skippedPieceCap += 1;
      } else {
        if (
          state.sources.tablebase &&
          runStats.tablebaseKept < state.tablebaseBudget &&
          pieces.pieceCount <= TABLEBASE_MAX_PIECES &&
          !seenTablebaseFens.has(fenValue)
        ) {
          runStats.tablebaseCandidates += 1;
          const tablebaseSeed = await tryBuildTablebaseSeed(fenValue, pieces, state.maxContinuationPlies, tablebaseCache);
          if (!tablebaseSeed) {
            runStats.tablebaseSkipped += 1;
          } else {
            const outcome = addSeedToBucket(tablebaseSeed, bucketMap, seenPuzzleIds, state.maxPerBucket);
            if (outcome === "added") {
              seenTablebaseFens.add(fenValue);
              runStats.tablebaseKept += 1;
              runStats.kept += 1;
            } else if (outcome === "duplicate") {
              runStats.duplicates += 1;
            } else if (outcome === "cap") {
              runStats.skippedCap += 1;
              runStats.tablebaseSkipped += 1;
            } else if (outcome === "out-of-range") {
              runStats.skippedOutOfRange += 1;
              runStats.tablebaseSkipped += 1;
            }
          }
        }

        if (state.sources.lichess) {
          const bucket = toBucket(ratingValue);
          if (bucket === null) {
            runStats.skippedOutOfRange += 1;
          } else if (seenPuzzleIds.has(puzzleIdValue)) {
            runStats.duplicates += 1;
          } else {
            const bucketItems = bucketMap.get(bucket) ?? [];
            if (bucketItems.length >= state.maxPerBucket) {
              runStats.skippedCap += 1;
            } else {
              const uciLine = movesValue.trim().split(/\s+/).filter(Boolean);
              const themes = parseThemes(themesValue);
              if (!shouldKeepLichessPuzzle(themes, uciLine, pieces.pieceCount, state.maxContinuationPlies, state.includeEndgamesLowPiece)) {
                runStats.skippedNotClear += 1;
              } else {
                const continuationSan = sanLineFromUci(fenValue, uciLine, state.maxContinuationPlies);
                if (continuationSan.length === 0) {
                  runStats.skippedInvalid += 1;
                } else {
                  bucketItems.push({
                    puzzleId: puzzleIdValue,
                    fen: fenValue,
                    sideToMove: pieces.sideToMove,
                    rating: ratingValue,
                    pieceCount: pieces.pieceCount,
                    whitePieces: pieces.whitePieces,
                    blackPieces: pieces.blackPieces,
                    continuationSan,
                    continuationText: continuationTextFromSan(fenValue, continuationSan),
                    themes,
                    source: "local_db"
                  });
                  bucketMap.set(bucket, bucketItems);
                  seenPuzzleIds.add(puzzleIdValue);
                  runStats.kept += 1;
                }
              }
            }
          }
        }
      }
    }

    if (runStats.rowsAdvanced >= state.rowsPerRun) {
      stopDueToLimit = true;
      rl.close();
      zstd.kill();
      break;
    }
  }

  const zstdExitCode = await new Promise((resolve) => {
    zstd.on("close", resolve);
  });

  if (!stopDueToLimit && zstdExitCode !== 0) {
    throw new Error(`zstd failed with exit code ${zstdExitCode}. ${stderr.trim()}`.trim());
  }

  state.rowsProcessed += runStats.rowsAdvanced;
  state.runs += 1;
  state.totalKept += runStats.kept;
  state.totalSkippedInvalid += runStats.skippedInvalid;
  state.totalSkippedOutOfRange += runStats.skippedOutOfRange;
  state.totalSkippedPieceCap += runStats.skippedPieceCap;
  state.totalSkippedNotClear += runStats.skippedNotClear;
  state.totalSkippedCap += runStats.skippedCap;
  state.totalDuplicates += runStats.duplicates;
  state.totalTablebaseCandidates += runStats.tablebaseCandidates;
  state.totalTablebaseKept += runStats.tablebaseKept;
  state.totalTablebaseSkipped += runStats.tablebaseSkipped;
  state.complete = !stopDueToLimit;
  state.lastRunAt = new Date().toISOString();

  writeShardsAndManifest(bucketMap, state, runStats);

  console.log(`Puzzle DB updated at ${OUTPUT_DIR}`);
  console.log(`Run rows advanced: ${runStats.rowsAdvanced}`);
  console.log(`Run kept: ${runStats.kept}`);
  console.log(`Run skipped (invalid): ${runStats.skippedInvalid}`);
  console.log(`Run skipped (out-of-range): ${runStats.skippedOutOfRange}`);
  console.log(`Run skipped (piece cap > ${state.maxPieces}): ${runStats.skippedPieceCap}`);
  console.log(`Run skipped (not clear/short): ${runStats.skippedNotClear}`);
  console.log(`Run skipped (cap): ${runStats.skippedCap}`);
  console.log(`Run duplicates: ${runStats.duplicates}`);
  console.log(`Run tablebase candidates: ${runStats.tablebaseCandidates}`);
  console.log(`Run tablebase kept: ${runStats.tablebaseKept}`);
  console.log(`Run tablebase skipped: ${runStats.tablebaseSkipped}`);
  console.log(`Total rows processed: ${state.rowsProcessed}`);
  console.log(`Total kept: ${state.totalKept}`);
  console.log(`Filter max pieces: ${state.maxPieces}`);
  console.log(`Filter max plies: ${state.maxContinuationPlies}`);
  console.log(`Include low-piece endgames: ${state.includeEndgamesLowPiece ? "yes" : "no"}`);
  console.log(`Sources: ${sourcesKey(state.sources)}`);
  console.log(`Tablebase budget: ${state.tablebaseBudget}`);
  console.log(`Complete: ${state.complete ? "yes" : "no (resume with next run)"}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
