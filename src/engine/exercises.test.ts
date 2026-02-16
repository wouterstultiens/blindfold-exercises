import { describe, expect, it } from "vitest";
import { evaluateAnswer, generateExercise } from "./exercises";
import type { ExerciseStage } from "../types";

const STAGES: ExerciseStage[] = [
  "square_color",
  "square_relation",
  "blindfold_sequence",
  "memory_puzzle",
  "calc_depth"
];

describe("exercise generation", () => {
  it.each(STAGES)("creates a playable item for %s", (stage) => {
    const item = generateExercise(stage, 3);
    expect(item.stage).toBe(stage);
    expect(item.choices.length).toBeGreaterThan(1);
    expect(item.solution.length).toBeGreaterThan(0);
  });

  it("marks correct answers correctly", () => {
    const item = generateExercise("square_color", 1);
    const result = evaluateAnswer(item, item.solution);
    expect(result.correct).toBe(true);
  });
});
