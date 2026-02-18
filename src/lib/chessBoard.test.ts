import { describe, expect, it } from "vitest";
import { squareColor } from "./chessBoard";

describe("squareColor", () => {
  it("matches standard board colors", () => {
    expect(squareColor("a1")).toBe("black");
    expect(squareColor("h8")).toBe("black");
    expect(squareColor("h5")).toBe("white");
    expect(squareColor("a2")).toBe("white");
    expect(squareColor("b1")).toBe("white");
  });
});

