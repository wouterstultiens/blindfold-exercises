import { clamp } from "../lib/random";
import type { AttemptRecord, ExerciseStage, ProgressSnapshot } from "../types";

export const TARGET_ACCURACY = 0.78;
export const INITIAL_RATING = 1200;

export function difficultyFromRating(rating: number): number {
  return clamp(Math.round((rating - 800) / 100), 1, 10);
}

export function ratingFromDifficulty(difficulty: number): number {
  return 800 + difficulty * 100;
}

export function calculateRollingAccuracy(attempts: AttemptRecord[]): number {
  if (attempts.length === 0) {
    return TARGET_ACCURACY;
  }
  const correct = attempts.filter((attempt) => attempt.correct).length;
  return correct / attempts.length;
}

export function calculateRollingLatencyMs(attempts: AttemptRecord[]): number {
  if (attempts.length === 0) {
    return 5000;
  }
  const total = attempts.reduce((acc, attempt) => acc + attempt.latency_ms, 0);
  return Math.round(total / attempts.length);
}

export function updateStageSnapshot(
  stage: ExerciseStage,
  userId: string,
  previous: ProgressSnapshot | undefined,
  recentAttempts: AttemptRecord[]
): ProgressSnapshot {
  const latest = recentAttempts[recentAttempts.length - 1];
  const prevRating = previous?.rating ?? INITIAL_RATING;
  const accuracy = calculateRollingAccuracy(recentAttempts.slice(-20));
  const latency = calculateRollingLatencyMs(recentAttempts.slice(-20));

  let delta = 0;
  if (latest) {
    delta += latest.correct ? 14 : -18;
    if (latest.latency_ms < 4000 && latest.correct) {
      delta += 6;
    }
    if (latest.latency_ms > 12000 && latest.correct) {
      delta -= 3;
    }
    delta += clamp((latest.confidence - 3) * (latest.correct ? 1 : -1), -2, 2);
  }
  delta += Math.round((accuracy - TARGET_ACCURACY) * 10);

  return {
    user_id: userId,
    stage,
    rating: clamp(prevRating + delta, 700, 2200),
    rolling_accuracy: Number(accuracy.toFixed(3)),
    rolling_latency_ms: latency,
    updated_at: new Date().toISOString(),
    synced: false
  };
}

export function chooseNextDifficulty(snapshot: ProgressSnapshot | undefined, recentAttempts: AttemptRecord[]): number {
  const baseDifficulty = snapshot ? difficultyFromRating(snapshot.rating) : 2;
  const recent = recentAttempts.slice(-8);
  const accuracy = calculateRollingAccuracy(recent);

  if (accuracy > 0.85) {
    return clamp(baseDifficulty + 1, 1, 10);
  }
  if (accuracy < 0.65) {
    return clamp(baseDifficulty - 1, 1, 10);
  }
  return baseDifficulty;
}
