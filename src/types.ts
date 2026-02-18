export type ExerciseMode = "square_color" | "puzzle_recall";

export interface PuzzleSettings {
  maxPieces: number;
  targetRating: number;
}

export type PuzzleSource = "local_db" | "tablebase_api";

export interface SquareColorItem {
  id: string;
  mode: "square_color";
  square: string;
  expectedAnswer: "black" | "white";
}

export interface PuzzleRecallItem {
  id: string;
  mode: "puzzle_recall";
  puzzleId: string;
  fen: string;
  sideToMove: "w" | "b";
  rating: number;
  pieceCount: number;
  whitePieces: string[];
  blackPieces: string[];
  continuationSan: string[];
  continuationText: string;
  source?: PuzzleSource;
}

export type ExerciseItem = SquareColorItem | PuzzleRecallItem;

export interface AttemptRecord {
  id: string;
  session_id: string;
  user_id: string;
  item_id: string;
  mode: ExerciseMode;
  prompt_payload: Record<string, unknown>;
  answer_payload: Record<string, unknown>;
  expected_answer: string;
  correct: boolean;
  latency_ms: number;
  created_at: string;
  settings_payload: PuzzleSettings | null;
  synced?: boolean;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string;
  duration_s: number;
  mode: ExerciseMode;
  settings_payload: PuzzleSettings | null;
  status: "active" | "completed";
  attempt_count: number;
  correct_count: number;
  synced?: boolean;
}

export interface PuzzleComboStat {
  maxPieces: number;
  targetRating: number;
  attempts: number;
  correctPercent: number;
}
