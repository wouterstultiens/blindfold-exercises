import { Chess } from "chess.js";
import { CALCULATION_PUZZLES, MEMORY_PUZZLES } from "../data/puzzles";
import { ALL_SQUARES, sameDiagonal, sameFile, sameRank, squareColor } from "../lib/chessBoard";
import { clamp, pickRandom, randomInt, shuffle } from "../lib/random";
import type { ExerciseItem, ExerciseStage } from "../types";

const RELATIONS = ["same_color", "same_file", "same_rank", "same_diagonal"] as const;
type RelationType = (typeof RELATIONS)[number];

const STAGE_TAGS: Record<ExerciseStage, string[]> = {
  square_color: ["board-fundamentals"],
  square_relation: ["board-geometry"],
  blindfold_sequence: ["piece-tracking"],
  memory_puzzle: ["pattern-memory"],
  calc_depth: ["calculation"]
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

function squareRelationItem(difficulty: number): ExerciseItem {
  const squareA = pickRandom(ALL_SQUARES);
  const squareB = pickRandom(ALL_SQUARES.filter((square) => square !== squareA));
  const relation = pickRandom(RELATIONS);
  let truthValue = false;

  if (relation === "same_color") {
    truthValue = squareColor(squareA) === squareColor(squareB);
  } else if (relation === "same_file") {
    truthValue = sameFile(squareA, squareB);
  } else if (relation === "same_rank") {
    truthValue = sameRank(squareA, squareB);
  } else if (relation === "same_diagonal") {
    truthValue = sameDiagonal(squareA, squareB);
  }

  return {
    id: createId("sq-relation"),
    stage: "square_relation",
    difficulty,
    prompt: { squareA, squareB, relation },
    solution: truthValue ? "yes" : "no",
    choices: ["yes", "no"],
    tags: STAGE_TAGS.square_relation
  };
}

function randomLegalMove(chess: Chess): string {
  const legalMoves = chess.moves();
  if (legalMoves.length === 0) {
    throw new Error("Position has no legal moves.");
  }
  return pickRandom(legalMoves);
}

function blindfoldSequenceItem(difficulty: number): ExerciseItem {
  const chess = new Chess();
  const trackOptions: Array<{ color: "w" | "b"; piece: "n" | "b"; from: string }> = [
    { color: "w", piece: "n", from: "g1" },
    { color: "w", piece: "n", from: "b1" },
    { color: "w", piece: "b", from: "c1" },
    { color: "w", piece: "b", from: "f1" },
    { color: "b", piece: "n", from: "g8" },
    { color: "b", piece: "n", from: "b8" },
    { color: "b", piece: "b", from: "c8" },
    { color: "b", piece: "b", from: "f8" }
  ];

  const tracked = pickRandom(trackOptions);
  let trackedSquare = tracked.from;
  const moveCount = clamp(difficulty + 1, 2, 8);
  const sanMoves: string[] = [];

  for (let ply = 0; ply < moveCount; ply += 1) {
    const moveSan = randomLegalMove(chess);
    const verboseMove = chess.move(moveSan);
    sanMoves.push(moveSan);

    if (!verboseMove || trackedSquare === "captured") {
      continue;
    }

    if (
      verboseMove.from === trackedSquare &&
      verboseMove.color === tracked.color &&
      verboseMove.piece === tracked.piece
    ) {
      trackedSquare = verboseMove.to;
      continue;
    }

    if (verboseMove.to === trackedSquare && Boolean(verboseMove.captured)) {
      trackedSquare = "captured";
    }
  }

  const decoySquares = shuffle(
    ALL_SQUARES.filter((square) => square !== trackedSquare && square !== tracked.from)
  ).slice(0, 3);
  const choices = trackedSquare === "captured" ? ["captured", ...decoySquares] : [trackedSquare, ...decoySquares, "captured"];

  const pieceName = tracked.piece === "n" ? "knight" : "bishop";
  const colorName = tracked.color === "w" ? "white" : "black";

  return {
    id: createId("sequence"),
    stage: "blindfold_sequence",
    difficulty,
    prompt: {
      startFen: "start",
      moves: sanMoves,
      question: `Starting from the initial position: where is the ${colorName} ${pieceName} from ${tracked.from} now?`,
      targetPiece: pieceName
    },
    solution: trackedSquare,
    choices: shuffle(choices),
    tags: STAGE_TAGS.blindfold_sequence
  };
}

function memoryPuzzleItem(difficulty: number): ExerciseItem {
  const puzzle = MEMORY_PUZZLES[difficulty % MEMORY_PUZZLES.length] ?? MEMORY_PUZZLES[0];
  if (!puzzle) {
    throw new Error("MEMORY_PUZZLES cannot be empty.");
  }
  return {
    id: createId("memory"),
    stage: "memory_puzzle",
    difficulty,
    prompt: {
      fen: puzzle.fen,
      theme: puzzle.theme,
      lineHint: puzzle.lineHint,
      displayMs: clamp(5000 - difficulty * 250, 2200, 5000)
    },
    solution: puzzle.bestMove,
    choices: shuffle(puzzle.choices),
    tags: [...STAGE_TAGS.memory_puzzle, puzzle.theme]
  };
}

function calcDepthItem(difficulty: number): ExerciseItem {
  const puzzle = CALCULATION_PUZZLES[difficulty % CALCULATION_PUZZLES.length] ?? CALCULATION_PUZZLES[0];
  if (!puzzle) {
    throw new Error("CALCULATION_PUZZLES cannot be empty.");
  }
  const depth = clamp(2 + Math.floor(difficulty / 2), 2, 5);
  return {
    id: createId("calc-depth"),
    stage: "calc_depth",
    difficulty,
    prompt: {
      fen: puzzle.fen,
      theme: puzzle.theme,
      lineHint: puzzle.lineHint,
      question: `Calculate ${depth} plies deep and choose the best move.`,
      displayMs: clamp(4200 - difficulty * 200, 1800, 4200),
      targetDepth: depth
    },
    solution: puzzle.bestMove,
    choices: shuffle(puzzle.choices),
    tags: [...STAGE_TAGS.calc_depth, puzzle.theme]
  };
}

export function generateExercise(stage: ExerciseStage, difficulty: number): ExerciseItem {
  const normalizedDifficulty = clamp(difficulty, 1, 10);
  if (stage === "square_color") {
    return squareColorItem(normalizedDifficulty);
  }
  if (stage === "square_relation") {
    return squareRelationItem(normalizedDifficulty);
  }
  if (stage === "blindfold_sequence") {
    return blindfoldSequenceItem(normalizedDifficulty);
  }
  if (stage === "memory_puzzle") {
    return memoryPuzzleItem(normalizedDifficulty);
  }
  return calcDepthItem(normalizedDifficulty);
}

export function evaluateAnswer(item: ExerciseItem, answer: string): { correct: boolean; expected: string } {
  const normalizedAnswer = answer.trim().toLowerCase();
  const expected = item.solution.toLowerCase();
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
  if (item.stage === "square_relation") {
    const { squareA, squareB, relation } = item.prompt as { squareA: string; squareB: string; relation: RelationType };
    const relationText: Record<RelationType, string> = {
      same_color: "same color",
      same_file: "on the same file",
      same_rank: "on the same rank",
      same_diagonal: "on the same diagonal"
    };
    return `Are ${squareA} and ${squareB} ${relationText[relation]}?`;
  }
  if (item.stage === "blindfold_sequence") {
    const prompt = item.prompt as { question: string; moves: string[] };
    return `${prompt.question} Moves: ${prompt.moves.map((move, index) => `${index + 1}. ${move}`).join("  ")}`;
  }
  if (item.stage === "memory_puzzle") {
    const prompt = item.prompt as { theme: string };
    return `Memory puzzle (${prompt.theme}). Memorize the board, then pick the best move.`;
  }
  const prompt = item.prompt as { question: string; theme: string };
  return `Calculation drill (${prompt.theme}). ${prompt.question}`;
}

export function stageDisplayName(stage: ExerciseStage): string {
  const names: Record<ExerciseStage, string> = {
    square_color: "Square Color",
    square_relation: "Square Relation",
    blindfold_sequence: "Blindfold Sequence",
    memory_puzzle: "Memory Puzzle",
    calc_depth: "Calculation Depth"
  };
  return names[stage];
}

export function quickWarmupSet(): ExerciseItem[] {
  return [
    generateExercise("square_color", randomInt(1, 3)),
    generateExercise("square_relation", randomInt(1, 3)),
    generateExercise("blindfold_sequence", randomInt(1, 4))
  ];
}
