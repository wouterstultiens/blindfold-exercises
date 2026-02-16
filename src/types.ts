export type ExerciseStage =
  | "square_color"
  | "square_relation"
  | "blindfold_sequence"
  | "memory_puzzle"
  | "calc_depth";

export interface ExerciseItem<TPrompt = Record<string, unknown>, TSolution = string> {
  id: string;
  stage: ExerciseStage;
  difficulty: number;
  prompt: TPrompt;
  solution: TSolution;
  choices: string[];
  tags: string[];
  reviewOfId?: string;
}

export interface AttemptRecord {
  id: string;
  session_id: string;
  user_id: string;
  item_id: string;
  stage: ExerciseStage;
  prompt_payload: Record<string, unknown>;
  answer_payload: { answer: string };
  expected_answer: string;
  correct: boolean;
  latency_ms: number;
  difficulty: number;
  confidence: 1 | 2 | 3 | 4 | 5;
  created_at: string;
  synced?: boolean;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string;
  duration_s: number;
  xp_earned: number;
  streak_after: number;
  synced?: boolean;
}

export interface ProgressSnapshot {
  user_id: string;
  stage: ExerciseStage;
  rating: number;
  rolling_accuracy: number;
  rolling_latency_ms: number;
  updated_at: string;
  synced?: boolean;
}

export interface UserProfile {
  user_id: string;
  display_name: string;
  xp: number;
  level: number;
  streak: number;
  last_session_date?: string;
  badges: string[];
}

export interface SessionSummary {
  attempts: AttemptRecord[];
  correctCount: number;
  totalCount: number;
  accuracy: number;
  xp: number;
  durationS: number;
}

export interface ReviewItem {
  due_at: string;
  item: ExerciseItem;
}
