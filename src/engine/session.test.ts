import { describe, expect, it } from "vitest";
import { buildAttemptMovingAverageTrend, buildSessionTrend, puzzleComboStats, summarizeModeStats, summarizeSessions } from "./session";
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

  it("builds completed-session trend rows in chronological order", () => {
    const sessions: SessionRecord[] = [
      { ...baseSession, id: "s2", ended_at: "2026-02-17T10:10:00.000Z" },
      { ...baseSession, id: "s1", ended_at: "2026-02-17T10:05:00.000Z" }
    ];
    const attempts: AttemptRecord[] = [
      { ...baseAttempt, session_id: "s1", id: "a1", latency_ms: 2000, correct: true },
      { ...baseAttempt, session_id: "s1", id: "a2", latency_ms: 4000, correct: false },
      { ...baseAttempt, session_id: "s2", id: "a3", latency_ms: 3000, correct: true }
    ];

    const rows = buildSessionTrend(sessions, attempts);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.sessionId).toBe("s1");
    expect(rows[0]?.sessionIndex).toBe(1);
    expect(Math.round(rows[0]?.accuracyPercent ?? 0)).toBe(50);
    expect(rows[0]?.avgLatencySeconds).toBe(3);
    expect(rows[1]?.sessionId).toBe("s2");
    expect(rows[1]?.sessionIndex).toBe(2);
    expect(Math.round(rows[1]?.accuracyPercent ?? 0)).toBe(100);
  });

  it("builds trailing attempt moving averages with a fixed window", () => {
    const attempts: AttemptRecord[] = [
      { ...baseAttempt, id: "a3", created_at: "2026-02-17T10:00:03.000Z", correct: false, latency_ms: 5000 },
      { ...baseAttempt, id: "a1", created_at: "2026-02-17T10:00:01.000Z", correct: true, latency_ms: 1000 },
      { ...baseAttempt, id: "a4", created_at: "2026-02-17T10:00:04.000Z", correct: true, latency_ms: 7000 },
      { ...baseAttempt, id: "a2", created_at: "2026-02-17T10:00:02.000Z", correct: true, latency_ms: 3000 }
    ];

    const rows = buildAttemptMovingAverageTrend(attempts, 3);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.attemptNumber).toBe(3);
    expect(Math.round(rows[0]?.accuracyPercent ?? 0)).toBe(67);
    expect(rows[0]?.avgLatencySeconds).toBe(3);
    expect(rows[1]?.attemptNumber).toBe(4);
    expect(Math.round(rows[1]?.accuracyPercent ?? 0)).toBe(67);
    expect(rows[1]?.avgLatencySeconds).toBe(5);
  });

  it("caps moving-average points to the latest maxPoints", () => {
    const attempts: AttemptRecord[] = Array.from({ length: 8 }, (_, index) => ({
      ...baseAttempt,
      id: `a${index + 1}`,
      created_at: `2026-02-17T10:00:0${index + 1}.000Z`,
      correct: index % 2 === 0,
      latency_ms: 1000 + index * 200
    }));

    const rows = buildAttemptMovingAverageTrend(attempts, 3, 2);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.attemptNumber).toBe(7);
    expect(rows[1]?.attemptNumber).toBe(8);
  });
});
