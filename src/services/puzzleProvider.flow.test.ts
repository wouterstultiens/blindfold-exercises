import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetPuzzleDbCacheForTests, getNextPuzzle } from "./puzzleProvider";

const SETTINGS = { maxPieces: 4, targetRating: 1500 };

const MANIFEST = {
  version: 1,
  generatedAt: "2026-02-17T00:00:00.000Z",
  files: [
    { bucket: 1400, file: "r1400.json", count: 1 },
    { bucket: 1500, file: "r1500.json", count: 2 },
    { bucket: 1600, file: "r1600.json", count: 0 }
  ]
};

const SHARD_1400 = [
  {
    puzzleId: "too-many-pieces",
    fen: "8/8/8/8/8/8/8/K6k w - - 0 1",
    sideToMove: "w",
    rating: 1450,
    pieceCount: 10,
    whitePieces: ["Ka1"],
    blackPieces: ["Kh1"],
    continuationSan: ["Qh7#"],
    continuationText: "1. Qh7#"
  }
];

const SHARD_1500 = [
  {
    puzzleId: "p-1",
    fen: "8/8/8/8/8/8/8/K6k w - - 0 1",
    sideToMove: "w",
    rating: 1500,
    pieceCount: 2,
    whitePieces: ["Ka1"],
    blackPieces: ["Kh1"],
    continuationSan: ["Qh7#"],
    continuationText: "1. Qh7#"
  },
  {
    puzzleId: "p-2",
    fen: "8/8/8/8/8/8/8/K6k w - - 0 1",
    sideToMove: "w",
    rating: 1520,
    pieceCount: 3,
    whitePieces: ["Ka1"],
    blackPieces: ["Kh1"],
    continuationSan: ["Qh7#"],
    continuationText: "1. Qh7#"
  }
];

function mockStaticDb(): void {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/puzzles/manifest.json")) {
      return new Response(JSON.stringify(MANIFEST), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    if (url.endsWith("/puzzles/r1400.json")) {
      return new Response(JSON.stringify(SHARD_1400), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    if (url.endsWith("/puzzles/r1500.json")) {
      return new Response(JSON.stringify(SHARD_1500), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    if (url.endsWith("/puzzles/r1600.json")) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    return new Response("not found", { status: 404 });
  });
}

describe("getNextPuzzle static-db flow", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    __resetPuzzleDbCacheForTests();
  });

  it("loads matching puzzles from static shards", async () => {
    mockStaticDb();
    vi.spyOn(Math, "random").mockReturnValue(0);

    const seed = await getNextPuzzle(SETTINGS);

    expect(seed.puzzleId).toBe("p-1");
    expect(seed.source).toBe("local_db");
  });

  it("avoids immediate repeats using recent-id memory", async () => {
    mockStaticDb();
    vi.spyOn(Math, "random").mockReturnValue(0);

    const first = await getNextPuzzle(SETTINGS);
    const second = await getNextPuzzle(SETTINGS);

    expect(first.puzzleId).toBe("p-1");
    expect(second.puzzleId).toBe("p-2");
  });

  it("reuses in-memory shard cache between calls", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/puzzles/manifest.json")) {
        return new Response(JSON.stringify(MANIFEST), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (url.endsWith("/puzzles/r1400.json")) {
        return new Response(JSON.stringify(SHARD_1400), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (url.endsWith("/puzzles/r1500.json")) {
        return new Response(JSON.stringify(SHARD_1500), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (url.endsWith("/puzzles/r1600.json")) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      return new Response("not found", { status: 404 });
    });

    await getNextPuzzle(SETTINGS);
    await getNextPuzzle(SETTINGS);

    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it("accepts tactical themed puzzles without requiring mate marker", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/puzzles/manifest.json")) {
        return new Response(
          JSON.stringify({
            version: 2,
            generatedAt: "2026-02-17T00:00:00.000Z",
            files: [{ bucket: 1500, file: "r1500.json", count: 1 }]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (url.endsWith("/puzzles/r1500.json")) {
        return new Response(
          JSON.stringify([
            {
              puzzleId: "tactical-themed",
              fen: "8/8/8/8/8/8/8/K6k w - - 0 1",
              sideToMove: "w",
              rating: 1500,
              pieceCount: 4,
              whitePieces: ["Ka1"],
              blackPieces: ["Kh1"],
              continuationSan: ["Qxd5"],
              continuationText: "1. Qxd5",
              themes: ["fork", "middlegame"]
            }
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response("not found", { status: 404 });
    });

    const seed = await getNextPuzzle(SETTINGS);
    expect(seed.puzzleId).toBe("tactical-themed");
  });

  it("accepts low-piece endgame themed puzzles", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/puzzles/manifest.json")) {
        return new Response(
          JSON.stringify({
            version: 4,
            generatedAt: "2026-02-17T00:00:00.000Z",
            files: [{ bucket: 1500, file: "r1500.json", count: 1 }]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (url.endsWith("/puzzles/r1500.json")) {
        return new Response(
          JSON.stringify([
            {
              puzzleId: "endgame-short",
              fen: "8/8/8/8/8/8/8/K6k w - - 0 1",
              sideToMove: "w",
              rating: 1500,
              pieceCount: 2,
              whitePieces: ["Ka1"],
              blackPieces: ["Kh1"],
              continuationSan: ["Kb2"],
              continuationText: "1. Kb2",
              themes: ["endgame", "short"],
              source: "local_db"
            }
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response("not found", { status: 404 });
    });

    const seed = await getNextPuzzle(SETTINGS);
    expect(seed.puzzleId).toBe("endgame-short");
  });

  it("accepts tablebase seeds without mate markers", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/puzzles/manifest.json")) {
        return new Response(
          JSON.stringify({
            version: 4,
            generatedAt: "2026-02-17T00:00:00.000Z",
            files: [{ bucket: 1500, file: "r1500.json", count: 1 }]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (url.endsWith("/puzzles/r1500.json")) {
        return new Response(
          JSON.stringify([
            {
              puzzleId: "tb-1",
              fen: "8/8/8/8/8/8/8/K6k w - - 0 1",
              sideToMove: "w",
              rating: 1500,
              pieceCount: 2,
              whitePieces: ["Ka1"],
              blackPieces: ["Kh1"],
              continuationSan: ["Kb2", "Kh2"],
              continuationText: "1. Kb2 1... Kh2",
              source: "tablebase_api"
            }
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response("not found", { status: 404 });
    });

    const seed = await getNextPuzzle(SETTINGS);
    expect(seed.puzzleId).toBe("tb-1");
    expect(seed.source).toBe("tablebase_api");
  });
});
