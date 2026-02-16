import type { AttemptRecord, ExerciseStage } from "../types";

export interface CategoryStats {
  stage: ExerciseStage;
  attempts: number;
  accuracy: number;
  avgLatencyMs: number;
}

export const CATEGORY_ORDER: ExerciseStage[] = ["square_color", "mate_in_1", "mate_in_2"];

export function summarizeCategoryStats(attempts: AttemptRecord[]): CategoryStats[] {
  return CATEGORY_ORDER.map((stage) => {
    const rows = attempts.filter((attempt) => attempt.stage === stage);
    if (rows.length === 0) {
      return {
        stage,
        attempts: 0,
        accuracy: 0,
        avgLatencyMs: 0
      };
    }
    const correct = rows.filter((row) => row.correct).length;
    const totalLatency = rows.reduce((sum, row) => sum + row.latency_ms, 0);
    return {
      stage,
      attempts: rows.length,
      accuracy: correct / rows.length,
      avgLatencyMs: Math.round(totalLatency / rows.length)
    };
  });
}

export function recentAccuracy(attempts: AttemptRecord[], stage: ExerciseStage, sample = 7): number {
  const recent = attempts.filter((attempt) => attempt.stage === stage).slice(-sample);
  if (recent.length === 0) {
    return 0;
  }
  return recent.filter((attempt) => attempt.correct).length / recent.length;
}
