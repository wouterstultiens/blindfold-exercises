import { describe, expect, it } from "vitest";
import { puzzleComboStats, summarizeModeStats, summarizeSessions } from "./session";
import type { AttemptRecord, SessionRecord } from "../types";

const baseAttempt: AttemptRecord = {
  id: "a1",
  session_id: "s1",
  user_id: "u1",
  item_id: "i1",
  mode: "puzzle_recall",
  prompt_payload: {},
  answer_payload: {},
  expected_answer: "1. Qh5#",
  correct: true,
  latency_ms: 3500,
  created_at: new Date().toISOString(),
  settings_payload: {
    pieceCount: 5,
    ratingBucket: 1200
  }
};

const baseSession: SessionRecord = {
  id: "s1",
  user_id: "u1",
  started_at: "2026-02-17T10:00:00.000Z",
  ended_at: "2026-02-17T10:05:00.000Z",
  duration_s: 300,
  mode: "puzzle_recall",
  settings_payload: {
    pieceCount: 5,
    ratingBucket: 1200
  },
  status: "completed",
  attempt_count: 1,
  correct_count: 1
};

describe("session summaries", () => {
  it("summarizes mode stats", () => {
    const rows = summarizeModeStats([baseAttempt]);
    const puzzle = rows.find((row) => row.mode === "puzzle_recall");
    expect(puzzle?.attempts).toBe(1);
    expect(puzzle?.accuracy).toBe(1);
  });

  it("summarizes sessions from attempts", () => {
    const rows = summarizeSessions([baseSession], [baseAttempt]);
    expect(rows[0]?.session.attempt_count).toBe(1);
    expect(rows[0]?.accuracy).toBe(1);
  });

  it("aggregates puzzle combo stats", () => {
    const rows = puzzleComboStats([baseAttempt, { ...baseAttempt, id: "a2", correct: false }]);
    expect(rows[0]?.attempts).toBe(2);
    expect(rows[0]?.pieceCount).toBe(5);
    expect(rows[0]?.ratingBucket).toBe(1200);
    expect(Math.round(rows[0]?.correctPercent ?? 0)).toBe(50);
  });
});
