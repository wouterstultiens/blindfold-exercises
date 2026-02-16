import { describe, expect, it } from "vitest";
import { MATE_IN_1_FALLBACK } from "../data/puzzles";
import { fallbackSeedFromDefinition, lichessToMateSeed } from "./puzzleProvider";

describe("puzzle provider", () => {
  it("maps lichess payload to a playable seed", () => {
    const payload = {
      game: {
        pgn: "d4 d5"
      },
      puzzle: {
        id: "TEST1",
        rating: 1200,
        themes: ["short", "endgame", "mateIn2"],
        solution: ["c2c4"],
        initialPly: 2
      }
    };

    const seed = lichessToMateSeed(payload, "mate_in_2");
    expect(seed.solution).toBe("c4");
    expect(seed.choices).toContain(seed.solution);
    expect(seed.source).toBe("lichess");
  });

  it("builds fallback seed with valid choices", () => {
    const seed = fallbackSeedFromDefinition(MATE_IN_1_FALLBACK[0], "mate_in_1");
    expect(seed.choices).toContain(seed.solution);
    expect(seed.source).toBe("fallback");
  });
});
