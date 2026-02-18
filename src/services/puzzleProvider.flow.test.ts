import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetPuzzleDbCacheForTests, getNextPuzzle, getPuzzleCatalog } from "./puzzleProvider";

const SETTINGS = { pieceCount: 4, ratingBucket: 1200 };

const MANIFEST = {
  version: 6,
  generatedAt: "2026-02-18T00:00:00.000Z",
  source: "lichess_db",
  maxContinuationPlies: 4,
  pieceCounts: [3, 4],
  ratingBuckets: [1200, 1400],
  countsByCombo: {
    "p4-r1200": 2,
    "p3-r1200": 1,
    "p4-r1400": 1
  },
  shardPattern: "lichess/p{pieceCount}/r{ratingBucket}.json",
  totalCount: 4
};

const SHARD_P4_R1200 = [
  {
    puzzleId: "p-1",
    fen: "6k1/8/6K1/8/8/8/6Q1/8 w - - 0 1",
    sideToMove: "w",
    pieceCount: 4,
    ratingBucket: 1200,
    whitePieces: ["Kg6", "Qg2"],
    blackPieces: ["Kg8", "Rh8"],
    continuationSan: ["Qh7+", "Kf8", "Qh8#"],
    continuationText: "1. Qh7+ 1... Kf8 2. Qh8#",
    source: "lichess_static"
  },
  {
    puzzleId: "p-2",
    fen: "6k1/8/5QK1/8/8/8/8/7r w - - 0 1",
    sideToMove: "w",
    pieceCount: 4,
    ratingBucket: 1200,
    whitePieces: ["Kg6", "Qf6"],
    blackPieces: ["Kg8", "Rh1"],
    continuationSan: ["Qd8+", "Kh7", "Qh8+"],
    continuationText: "1. Qd8+ 1... Kh7 2. Qh8+",
    source: "lichess_static"
  }
];

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

function mockStaticDb(): void {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/puzzles/manifest.json")) {
      return new Response(JSON.stringify(MANIFEST), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    if (url.endsWith("/puzzles/lichess/p4/r1200.json")) {
      return new Response(JSON.stringify(SHARD_P4_R1200), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    return new Response("not found", { status: 404 });
  });
}

describe("getNextPuzzle static-db flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    const storage = createMockLocalStorage();
    vi.stubGlobal("localStorage", storage);
    storage.clear();
    __resetPuzzleDbCacheForTests();
  });

  it("loads matching puzzles from selected combo shard", async () => {
    mockStaticDb();
    vi.spyOn(Math, "random").mockReturnValue(0);

    const seed = await getNextPuzzle(SETTINGS);

    expect(seed.puzzleId).toBe("p-1");
    expect(seed.source).toBe("lichess_static");
  });

  it("avoids immediate repeats using combo-scoped recent-id memory", async () => {
    mockStaticDb();
    vi.spyOn(Math, "random").mockReturnValue(0);

    const first = await getNextPuzzle(SETTINGS);
    const second = await getNextPuzzle(SETTINGS);

    expect(first.puzzleId).toBe("p-1");
    expect(second.puzzleId).toBe("p-2");
  });

  it("reuses in-memory cache between calls", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/puzzles/manifest.json")) {
        return new Response(JSON.stringify(MANIFEST), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (url.endsWith("/puzzles/lichess/p4/r1200.json")) {
        return new Response(JSON.stringify(SHARD_P4_R1200), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      return new Response("not found", { status: 404 });
    });

    await getNextPuzzle(SETTINGS);
    await getNextPuzzle(SETTINGS);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("exposes piece-count and rating buckets from manifest", async () => {
    mockStaticDb();

    const catalog = await getPuzzleCatalog();
    expect(catalog.pieceCounts).toEqual([3, 4]);
    expect(catalog.ratingBuckets).toEqual([1200, 1400]);
  });
});
