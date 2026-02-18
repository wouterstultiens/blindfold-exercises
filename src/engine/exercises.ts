import { ALL_SQUARES, squareColor } from "../lib/chessBoard";
import { pickRandom } from "../lib/random";
import type { ExerciseMode, SquareColorItem } from "../types";

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createSquareColorItem(): SquareColorItem {
  const square = pickRandom(ALL_SQUARES);
  return {
    id: createId("sq"),
    mode: "square_color",
    square,
    expectedAnswer: squareColor(square)
  };
}

export function evaluateSquareColorAnswer(item: SquareColorItem, answer: string): { correct: boolean; expected: string } {
  const normalized = answer.trim().toLowerCase();
  return {
    correct: normalized === item.expectedAnswer,
    expected: item.expectedAnswer
  };
}

export function modeDisplayName(mode: ExerciseMode): string {
  return mode === "square_color" ? "Square Color" : "Puzzle Recall";
}

export function puzzleSideLabel(sideToMove: "w" | "b"): string {
  return sideToMove === "w" ? "White to move" : "Black to move";
}
