import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetPuzzleDbCacheForTests, getNextPuzzle } from "./puzzleProvider";

const SETTINGS = { pieceCount: 4, ratingBucket: 1200 };

const MANIFEST = {
  version: 6,
  generatedAt: "2026-02-18T00:00:00.000Z",
  source: "lichess_db",
  maxContinuationPlies: 4,
  pieceCounts: [4],
  ratingBuckets: [1200],
  countsByCombo: {
    "p4-r1200": 1
  },
  shardPattern: "lichess/p{pieceCount}/r{ratingBucket}.json",
  totalCount: 1
};

function createMockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    }
  } as Storage;
}

describe("puzzle provider static-db errors", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    const storage = createMockLocalStorage();
    vi.stubGlobal("localStorage", storage);
    storage.clear();
    __resetPuzzleDbCacheForTests();
  });

  it("shows actionable error when manifest is missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("not found", { status: 404 }));

    await expect(getNextPuzzle(SETTINGS)).rejects.toThrow("npm run puzzles:build");
  });

  it("fails clearly when selected settings are not available", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/puzzles/manifest.json")) {
        return new Response(
          JSON.stringify({
            ...MANIFEST,
            pieceCounts: [3],
            ratingBuckets: [1000],
            countsByCombo: { "p3-r1000": 1 },
            totalCount: 1
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response("not found", { status: 404 });
    });

    await expect(getNextPuzzle(SETTINGS)).rejects.toThrow("not available");
  });

  it("filters out puzzles longer than 4 plies", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/puzzles/manifest.json")) {
        return new Response(JSON.stringify(MANIFEST), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (url.endsWith("/puzzles/lichess/p4/r1200.json")) {
        return new Response(
          JSON.stringify([
            {
              puzzleId: "x-long",
              fen: "6k1/8/6K1/8/8/8/5Q1r/8 w - - 0 1",
              sideToMove: "w",
              pieceCount: 4,
              ratingBucket: 1200,
              whitePieces: ["Kg6", "Qf2"],
              blackPieces: ["Kg8", "Rh2"],
              continuationSan: ["Qxh2", "Kf8", "Qh8+", "Ke7", "Qe8+"],
              continuationText: "1. Qxh2 1... Kf8 2. Qh8+ 2... Ke7 3. Qe8+",
              source: "lichess_static"
            }
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response("not found", { status: 404 });
    });

    await expect(getNextPuzzle(SETTINGS)).rejects.toThrow("No puzzle matched");
  });
});
