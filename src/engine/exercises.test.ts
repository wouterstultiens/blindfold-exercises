import { describe, expect, it } from "vitest";
import { createMateExercise, evaluateAnswer, generateExercise } from "./exercises";
import type { ExerciseStage } from "../types";

const STAGES: ExerciseStage[] = ["square_color"];

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

  it("creates a playable mate exercise", () => {
    const item = createMateExercise("mate_in_1", 2, {
      id: "seed-1",
      fen: "2kr4/ppp1Q2p/6p1/8/8/3r1qnP/PP6/1KR1R3 w - - 2 29",
      solution: "Qxc7#",
      choices: ["Qxc7#", "Rxd3", "Qe8+", "Rb8+"],
      theme: "mateIn1",
      source: "fallback"
    });
    expect(item.stage).toBe("mate_in_1");
    expect(item.choices).toContain(item.solution);
  });
});
