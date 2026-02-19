export type ExerciseMode = "square_color" | "puzzle_recall";
export type AppTab = "training" | "progress";

export interface PuzzleSettings {
  pieceCount: number;
  ratingBucket: number;
}

export type PuzzleSource = "lichess_static";

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
  pieceCount: number;
  ratingBucket: number;
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
  pieceCount: number;
  ratingBucket: number;
  attempts: number;
  correctPercent: number;
}

export interface RunMetrics {
  attempts: number;
  accuracyPercent: number;
  streak: number;
  avgLatencyMs: number;
}

export interface TrainingUiStateSurface {
  isBootstrapped: boolean;
  isCatalogLoading: boolean;
  isLoadingItem: boolean;
  isSyncing: boolean;
  isDeleting: boolean;
  isFocusedRun: boolean;
  isExerciseRunning: boolean;
  hasActiveSession: boolean;
  isOffline: boolean;
}
