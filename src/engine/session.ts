import { chooseNextDifficulty } from "./adaptive";
import { generateExercise, quickWarmupSet } from "./exercises";
import { shuffle } from "../lib/random";
import type { AttemptRecord, ExerciseItem, ExerciseStage, ProgressSnapshot } from "../types";

const SESSION_STAGE_ORDER: ExerciseStage[] = [
  "square_color",
  "square_relation",
  "blindfold_sequence",
  "memory_puzzle",
  "calc_depth"
];

export function buildAdaptiveSession(
  attempts: AttemptRecord[],
  snapshots: ProgressSnapshot[],
  reviewItems: ExerciseItem[],
  totalItems = 16
): ExerciseItem[] {
  const exercises: ExerciseItem[] = [];
  const snapshotByStage = new Map(snapshots.map((snapshot) => [snapshot.stage, snapshot]));

  const cappedReviews = reviewItems.slice(0, 4).map((item, index) => ({
    ...item,
    id: `${item.id}-review-${index}`,
    reviewOfId: item.id
  }));

  exercises.push(...quickWarmupSet());
  exercises.push(...cappedReviews);

  while (exercises.length < totalItems) {
    const stage = SESSION_STAGE_ORDER[exercises.length % SESSION_STAGE_ORDER.length] as ExerciseStage;
    const stageAttempts = attempts.filter((attempt) => attempt.stage === stage).slice(-25);
    const difficulty = chooseNextDifficulty(snapshotByStage.get(stage), stageAttempts);
    exercises.push(generateExercise(stage, difficulty));
  }

  const warmup = exercises.slice(0, 3);
  const rest = shuffle(exercises.slice(3));
  return [...warmup, ...rest].slice(0, totalItems);
}

export function summarizeWeaknesses(attempts: AttemptRecord[]): Array<{ stage: ExerciseStage; accuracy: number }> {
  const grouped = new Map<ExerciseStage, AttemptRecord[]>();
  for (const attempt of attempts) {
    const existing = grouped.get(attempt.stage) ?? [];
    existing.push(attempt);
    grouped.set(attempt.stage, existing);
  }

  return [...grouped.entries()]
    .map(([stage, stageAttempts]) => {
      const correct = stageAttempts.filter((attempt) => attempt.correct).length;
      return {
        stage,
        accuracy: stageAttempts.length === 0 ? 0 : correct / stageAttempts.length
      };
    })
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);
}
