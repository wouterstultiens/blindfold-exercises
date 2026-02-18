import type { AttemptRecord, ExerciseMode, PuzzleComboStat, SessionRecord } from "../types";

export interface ModeStats {
  mode: ExerciseMode;
  attempts: number;
  accuracy: number;
  avgLatencyMs: number;
}

const MODE_ORDER: ExerciseMode[] = ["square_color", "puzzle_recall"];

export function summarizeModeStats(attempts: AttemptRecord[]): ModeStats[] {
  return MODE_ORDER.map((mode) => {
    const rows = attempts.filter((attempt) => attempt.mode === mode);
    if (rows.length === 0) {
      return { mode, attempts: 0, accuracy: 0, avgLatencyMs: 0 };
    }

    const correctCount = rows.filter((row) => row.correct).length;
    const totalLatency = rows.reduce((sum, row) => sum + row.latency_ms, 0);
    return {
      mode,
      attempts: rows.length,
      accuracy: correctCount / rows.length,
      avgLatencyMs: Math.round(totalLatency / rows.length)
    };
  });
}

export interface SessionSummaryRow {
  session: SessionRecord;
  accuracy: number;
}

export function summarizeSessions(sessions: SessionRecord[], attempts: AttemptRecord[]): SessionSummaryRow[] {
  const attemptsBySession = new Map<string, AttemptRecord[]>();
  for (const attempt of attempts) {
    const rows = attemptsBySession.get(attempt.session_id) ?? [];
    rows.push(attempt);
    attemptsBySession.set(attempt.session_id, rows);
  }

  return sessions
    .filter((session) => session.status === "completed")
    .map((session) => {
      const rows = attemptsBySession.get(session.id) ?? [];
      const correct = rows.filter((row) => row.correct).length;
      const accuracy = rows.length === 0 ? 0 : correct / rows.length;
      return { session: { ...session, attempt_count: rows.length, correct_count: correct }, accuracy };
    })
    .sort((a, b) => Date.parse(b.session.ended_at) - Date.parse(a.session.ended_at));
}

export function puzzleComboStats(attempts: AttemptRecord[]): PuzzleComboStat[] {
  const buckets = new Map<string, { attempts: number; correct: number; pieceCount: number; ratingBucket: number }>();

  for (const attempt of attempts) {
    if (attempt.mode !== "puzzle_recall" || !attempt.settings_payload) {
      continue;
    }
    const { pieceCount, ratingBucket } = attempt.settings_payload;
    const key = `${pieceCount}-${ratingBucket}`;
    const bucket = buckets.get(key) ?? { attempts: 0, correct: 0, pieceCount, ratingBucket };
    bucket.attempts += 1;
    if (attempt.correct) {
      bucket.correct += 1;
    }
    buckets.set(key, bucket);
  }

  return [...buckets.values()]
    .map((bucket) => ({
      pieceCount: bucket.pieceCount,
      ratingBucket: bucket.ratingBucket,
      attempts: bucket.attempts,
      correctPercent: bucket.attempts === 0 ? 0 : (bucket.correct / bucket.attempts) * 100
    }))
    .sort((a, b) => b.attempts - a.attempts || a.pieceCount - b.pieceCount || a.ratingBucket - b.ratingBucket);
}
