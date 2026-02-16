import { create } from "zustand";
import type { AttemptRecord, ExerciseItem, SessionRecord, SessionSummary } from "../types";

interface SessionRuntime {
  id: string;
  startedAt: string;
  items: ExerciseItem[];
  currentIndex: number;
  attempts: AttemptRecord[];
}

interface AppState {
  runtime: SessionRuntime | null;
  summary: SessionSummary | null;
  startSession: (sessionId: string, items: ExerciseItem[]) => void;
  addAttempt: (attempt: AttemptRecord) => void;
  nextItem: () => void;
  finishSession: (session: SessionRecord) => SessionSummary;
  resetSummary: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  runtime: null,
  summary: null,
  startSession: (sessionId, items) =>
    set({
      runtime: {
        id: sessionId,
        startedAt: new Date().toISOString(),
        items,
        currentIndex: 0,
        attempts: []
      },
      summary: null
    }),
  addAttempt: (attempt) =>
    set((state) => {
      if (!state.runtime) return state;
      return {
        runtime: {
          ...state.runtime,
          attempts: [...state.runtime.attempts, attempt]
        }
      };
    }),
  nextItem: () =>
    set((state) => {
      if (!state.runtime) return state;
      return {
        runtime: {
          ...state.runtime,
          currentIndex: state.runtime.currentIndex + 1
        }
      };
    }),
  finishSession: (session) => {
    const runtime = get().runtime;
    if (!runtime) {
      const emptySummary: SessionSummary = {
        attempts: [],
        correctCount: 0,
        totalCount: 0,
        accuracy: 0,
        xp: session.xp_earned,
        durationS: session.duration_s
      };
      set({ summary: emptySummary, runtime: null });
      return emptySummary;
    }

    const correctCount = runtime.attempts.filter((attempt) => attempt.correct).length;
    const totalCount = runtime.attempts.length;
    const summary: SessionSummary = {
      attempts: runtime.attempts,
      correctCount,
      totalCount,
      accuracy: totalCount > 0 ? correctCount / totalCount : 0,
      xp: session.xp_earned,
      durationS: session.duration_s
    };
    set({ summary, runtime: null });
    return summary;
  },
  resetSummary: () => set({ summary: null })
}));
