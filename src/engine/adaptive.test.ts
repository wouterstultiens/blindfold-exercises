import { describe, expect, it } from "vitest";
import { chooseNextDifficulty, difficultyFromRating, updateStageSnapshot } from "./adaptive";
import type { AttemptRecord } from "../types";

function mockAttempt(partial: Partial<AttemptRecord>): AttemptRecord {
  return {
    id: "a1",
    session_id: "s1",
    user_id: "u1",
    item_id: "i1",
    stage: "square_color",
    prompt_payload: {},
    answer_payload: { answer: "black" },
    expected_answer: "black",
    correct: true,
    latency_ms: 4000,
    difficulty: 2,
    confidence: 3,
    created_at: new Date().toISOString(),
    ...partial
  };
}

describe("adaptive engine", () => {
  it("increases difficulty with high accuracy", () => {
    const attempts = Array.from({ length: 8 }, () => mockAttempt({ correct: true }));
    const difficulty = chooseNextDifficulty(
      {
        user_id: "u1",
        stage: "square_color",
        rating: 1300,
        rolling_accuracy: 0.8,
        rolling_latency_ms: 3000,
        updated_at: new Date().toISOString()
      },
      attempts
    );
    expect(difficulty).toBeGreaterThanOrEqual(difficultyFromRating(1300));
  });

  it("decreases rating on incorrect answers", () => {
    const previous = {
      user_id: "u1",
      stage: "square_color" as const,
      rating: 1200,
      rolling_accuracy: 0.8,
      rolling_latency_ms: 3300,
      updated_at: new Date().toISOString()
    };
    const attempts = [mockAttempt({ correct: false, confidence: 5, latency_ms: 2000 })];
    const next = updateStageSnapshot("square_color", "u1", previous, attempts);
    expect(next.rating).toBeLessThan(previous.rating);
  });
});
