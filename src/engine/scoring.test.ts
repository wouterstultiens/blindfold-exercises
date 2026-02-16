import { describe, expect, it } from "vitest";
import { calculateLevel, sessionAccuracy, updateProfileAfterSession, xpForAttempt } from "./scoring";
import type { AttemptRecord, SessionRecord, UserProfile } from "../types";

const baseAttempt: AttemptRecord = {
  id: "a1",
  session_id: "s1",
  user_id: "u1",
  item_id: "i1",
  stage: "square_color",
  prompt_payload: {},
  answer_payload: { answer: "black" },
  expected_answer: "black",
  correct: true,
  latency_ms: 3000,
  difficulty: 3,
  confidence: 4,
  created_at: "2026-02-16T10:00:00.000Z"
};

describe("scoring", () => {
  it("awards more xp for correct answers", () => {
    const gain = xpForAttempt(baseAttempt, 2);
    const miss = xpForAttempt({ ...baseAttempt, correct: false }, 2);
    expect(gain).toBeGreaterThan(miss);
  });

  it("computes level from xp", () => {
    expect(calculateLevel(0)).toBe(1);
    expect(calculateLevel(1000)).toBeGreaterThan(1);
  });

  it("updates profile after session", () => {
    const profile: UserProfile = {
      user_id: "u1",
      display_name: "Test",
      xp: 0,
      level: 1,
      streak: 0,
      badges: []
    };
    const session: SessionRecord = {
      id: "s1",
      user_id: "u1",
      started_at: "2026-02-15T10:00:00.000Z",
      ended_at: "2026-02-16T10:00:00.000Z",
      duration_s: 600,
      xp_earned: 0,
      streak_after: 0
    };
    const next = updateProfileAfterSession(profile, session, [baseAttempt], []);
    expect(next.xp).toBeGreaterThan(0);
    expect(next.level).toBeGreaterThanOrEqual(1);
  });

  it("computes session accuracy", () => {
    const value = sessionAccuracy([baseAttempt, { ...baseAttempt, id: "a2", correct: false }]);
    expect(value).toBe(0.5);
  });
});
