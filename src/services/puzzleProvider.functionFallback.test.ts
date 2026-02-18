import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetPuzzleDbCacheForTests, getNextPuzzle } from "./puzzleProvider";

const SETTINGS = { maxPieces: 12, targetRating: 1500 };

describe("puzzle provider static-db errors", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    __resetPuzzleDbCacheForTests();
  });

  it("shows actionable error when manifest is missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("not found", { status: 404 }));

    await expect(getNextPuzzle(SETTINGS)).rejects.toThrow("npm run puzzles:build");
  });

  it("fails clearly when no puzzle matches selected settings", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/puzzles/manifest.json")) {
        return new Response(
          JSON.stringify({
            version: 1,
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
              puzzleId: "x-1",
              fen: "8/8/8/8/8/8/8/K6k w - - 0 1",
              sideToMove: "w",
              rating: 1500,
              pieceCount: 20,
              whitePieces: ["Ka1"],
              blackPieces: ["Kh1"],
              continuationSan: ["Kb1"],
              continuationText: "1. Kb1"
            }
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response("not found", { status: 404 });
    });

    await expect(getNextPuzzle(SETTINGS)).rejects.toThrow("No puzzle matched");
  });

  it("filters out puzzles longer than 4 plies", async () => {
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
              puzzleId: "x-long",
              fen: "8/8/8/8/8/8/8/K6k w - - 0 1",
              sideToMove: "w",
              rating: 1500,
              pieceCount: 2,
              whitePieces: ["Ka1"],
              blackPieces: ["Kh1"],
              continuationSan: ["Kb2", "Kh2", "Kb3", "Kh3", "Kb4"],
              continuationText: "1. Kb2 1... Kh2 2. Kb3 2... Kh3 3. Kb4"
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
