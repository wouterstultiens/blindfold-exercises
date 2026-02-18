import { describe, expect, it } from "vitest";
import { toPieceLines } from "./puzzleProvider";

describe("puzzle provider", () => {
  it("renders piece lines", () => {
    const lines = toPieceLines({
      whitePieces: ["Ke1", "Qd1"],
      blackPieces: ["Ke8", "Qd8"]
    });

    expect(lines).toEqual(["White: Ke1, Qd1", "Black: Ke8, Qd8"]);
  });
});
