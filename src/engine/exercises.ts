import { ALL_SQUARES, squareColor } from "../lib/chessBoard";
import { clamp, pickRandom, shuffle } from "../lib/random";
import type { ExerciseItem, ExerciseStage } from "../types";
import type { MatePuzzleSeed } from "../services/puzzleProvider";

const STAGE_TAGS: Record<ExerciseStage, string[]> = {
  square_color: ["board-fundamentals"],
  mate_in_1: ["tactics", "mateIn1"],
  mate_in_2: ["tactics", "mateIn2"]
};

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function squareColorItem(difficulty: number): ExerciseItem {
  const square = pickRandom(ALL_SQUARES);
  const answer = squareColor(square);
  return {
    id: createId("sq-color"),
    stage: "square_color",
    difficulty,
    prompt: { square },
    solution: answer,
    choices: ["black", "white"],
    tags: STAGE_TAGS.square_color
  };
}

export function createMateExercise(
  stage: Extract<ExerciseStage, "mate_in_1" | "mate_in_2">,
  difficulty: number,
  puzzle: MatePuzzleSeed
): ExerciseItem {
  return {
    id: `${createId(stage)}-${puzzle.id}`,
    stage,
    difficulty,
    prompt: {
      fen: puzzle.fen,
      theme: puzzle.theme,
      source: puzzle.source,
      rating: puzzle.rating
    },
    solution: puzzle.solution,
    choices: shuffle(puzzle.choices),
    tags: [...STAGE_TAGS[stage], puzzle.theme]
  };
}

export function generateExercise(stage: ExerciseStage, difficulty: number): ExerciseItem {
  const normalizedDifficulty = clamp(difficulty, 1, 10);
  if (stage === "square_color") {
    return squareColorItem(normalizedDifficulty);
  }
  throw new Error(`Use createMateExercise for stage ${stage}`);
}

function normalizeMoveText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[+#]+$/g, "");
}

export function evaluateAnswer(item: ExerciseItem, answer: string): { correct: boolean; expected: string } {
  const normalizedAnswer = normalizeMoveText(answer);
  const expected = normalizeMoveText(item.solution);
  return {
    correct: normalizedAnswer === expected,
    expected: item.solution
  };
}

export function stagePromptText(item: ExerciseItem): string {
  if (item.stage === "square_color") {
    const square = (item.prompt as { square: string }).square;
    return `What color is square ${square}?`;
  }
  if (item.stage === "mate_in_1") {
    return "Find the best move (mate in 1).";
  }
  return "Find the best move (mate in 2).";
}

export function stageDisplayName(stage: ExerciseStage): string {
  const names: Record<ExerciseStage, string> = {
    square_color: "Square Color",
    mate_in_1: "Mate In 1",
    mate_in_2: "Mate In 2"
  };
  return names[stage];
}
