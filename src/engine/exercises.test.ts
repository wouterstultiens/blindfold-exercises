import { describe, expect, it } from "vitest";
import { createSquareColorItem, evaluateSquareColorAnswer, modeDisplayName, puzzleSideLabel } from "./exercises";

describe("exercise generation", () => {
  it("creates a square color item", () => {
    const item = createSquareColorItem();
    expect(item.mode).toBe("square_color");
    expect(item.square).toMatch(/^[a-h][1-8]$/);
    expect(["black", "white"]).toContain(item.expectedAnswer);
  });

  it("evaluates square color answers", () => {
    const item = createSquareColorItem();
    const result = evaluateSquareColorAnswer(item, item.expectedAnswer);
    expect(result.correct).toBe(true);
    expect(result.expected).toBe(item.expectedAnswer);
  });

  it("returns display labels", () => {
    expect(modeDisplayName("square_color")).toBe("Square Color");
    expect(modeDisplayName("puzzle_recall")).toBe("Puzzle Recall");
    expect(puzzleSideLabel("w")).toBe("White to move");
    expect(puzzleSideLabel("b")).toBe("Black to move");
  });
});
