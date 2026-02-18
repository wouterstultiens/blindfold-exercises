import type { AttemptRecord, SessionRecord } from "../types";
import { getSupabaseClient } from "./supabase";

interface AttemptDbRow {
  id: string;
  session_id: string;
  user_id: string;
  item_id: string;
  stage: string;
  prompt_payload: Record<string, unknown>;
  answer_payload: Record<string, unknown>;
  expected_answer: string;
  correct: boolean;
  latency_ms: number;
  difficulty: number;
  confidence: number;
  created_at: string;
}

interface SessionDbRow {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string;
  duration_s: number;
  xp_earned: number;
  streak_after: number;
  focus_stage: string;
  status: "active" | "completed";
  attempt_count: number;
}

export interface SyncPayload {
  userId: string;
  displayName: string;
  attempts: AttemptRecord[];
  sessions: SessionRecord[];
}

export interface SyncResult {
  synced: boolean;
  message: string;
  attempts: AttemptRecord[];
  sessions: SessionRecord[];
}

function parseSettings(payload: Record<string, unknown>): { maxPieces: number; targetRating: number } | null {
  const raw = payload.settings;
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const maxPieces = Number((raw as { maxPieces?: unknown }).maxPieces);
  const targetRating = Number((raw as { targetRating?: unknown }).targetRating);
  if (!Number.isFinite(maxPieces) || !Number.isFinite(targetRating)) {
    return null;
  }
  return { maxPieces, targetRating };
}

function toDbAttempt(attempt: AttemptRecord): AttemptDbRow {
  return {
    id: attempt.id,
    session_id: attempt.session_id,
    user_id: attempt.user_id,
    item_id: attempt.item_id,
    stage: attempt.mode,
    prompt_payload: attempt.prompt_payload,
    answer_payload: attempt.answer_payload,
    expected_answer: attempt.expected_answer,
    correct: attempt.correct,
    latency_ms: attempt.latency_ms,
    difficulty: 1,
    confidence: 3,
    created_at: attempt.created_at
  };
}

function fromDbAttempt(row: AttemptDbRow): AttemptRecord {
  return {
    id: row.id,
    session_id: row.session_id,
    user_id: row.user_id,
    item_id: row.item_id,
    mode: row.stage === "puzzle_recall" ? "puzzle_recall" : "square_color",
    prompt_payload: row.prompt_payload,
    answer_payload: row.answer_payload,
    expected_answer: row.expected_answer,
    correct: row.correct,
    latency_ms: row.latency_ms,
    created_at: row.created_at,
    settings_payload: parseSettings(row.prompt_payload),
    synced: true
  };
}

function toDbSession(session: SessionRecord): SessionDbRow {
  return {
    id: session.id,
    user_id: session.user_id,
    started_at: session.started_at,
    ended_at: session.ended_at,
    duration_s: session.duration_s,
    xp_earned: 0,
    streak_after: 0,
    focus_stage: session.mode,
    status: session.status,
    attempt_count: session.attempt_count
  };
}

function fromDbSession(row: SessionDbRow): SessionRecord {
  return {
    id: row.id,
    user_id: row.user_id,
    started_at: row.started_at,
    ended_at: row.ended_at,
    duration_s: row.duration_s,
    mode: row.focus_stage === "puzzle_recall" ? "puzzle_recall" : "square_color",
    settings_payload: null,
    status: row.status,
    attempt_count: row.attempt_count,
    correct_count: 0,
    synced: true
  };
}

export async function syncLocalProgress(payload: SyncPayload): Promise<SyncResult> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      synced: false,
      message: "Supabase config missing, running local-only mode.",
      attempts: payload.attempts,
      sessions: payload.sessions
    };
  }

  if (payload.userId.startsWith("guest-")) {
    return {
      synced: false,
      message: "Guest profile cannot sync. Sign in with GitHub first.",
      attempts: payload.attempts,
      sessions: payload.sessions
    };
  }

  const { error: profileError } = await client.from("profiles").upsert(
    {
      user_id: payload.userId,
      display_name: payload.displayName
    },
    {
      onConflict: "user_id"
    }
  );

  if (profileError) {
    return {
      synced: false,
      message: `Failed to sync profile: ${profileError.message}`,
      attempts: payload.attempts,
      sessions: payload.sessions
    };
  }

  const unsyncedAttempts = payload.attempts.filter((attempt) => !attempt.synced);
  if (unsyncedAttempts.length > 0) {
    const { error } = await client.from("attempts").upsert(unsyncedAttempts.map(toDbAttempt), {
      onConflict: "id"
    });
    if (error) {
      return {
        synced: false,
        message: `Failed to sync attempts: ${error.message}`,
        attempts: payload.attempts,
        sessions: payload.sessions
      };
    }
  }

  const unsyncedSessions = payload.sessions.filter((session) => !session.synced);
  if (unsyncedSessions.length > 0) {
    const { error } = await client.from("sessions").upsert(unsyncedSessions.map(toDbSession), {
      onConflict: "id"
    });
    if (error) {
      return {
        synced: false,
        message: `Failed to sync sessions: ${error.message}`,
        attempts: payload.attempts,
        sessions: payload.sessions
      };
    }
  }

  const [{ data: remoteAttempts, error: attemptsError }, { data: remoteSessions, error: sessionsError }] =
    await Promise.all([
      client.from("attempts").select("*", { count: "exact" }).eq("user_id", payload.userId),
      client.from("sessions").select("*", { count: "exact" }).eq("user_id", payload.userId)
    ]);

  if (attemptsError) {
    return {
      synced: false,
      message: `Failed to load attempts: ${attemptsError.message}`,
      attempts: payload.attempts,
      sessions: payload.sessions
    };
  }

  if (sessionsError) {
    return {
      synced: false,
      message: `Failed to load sessions: ${sessionsError.message}`,
      attempts: payload.attempts,
      sessions: payload.sessions
    };
  }

  return {
    synced: true,
    message: "Synced successfully.",
    attempts: (remoteAttempts ?? []).map((row) => fromDbAttempt(row as AttemptDbRow)),
    sessions: (remoteSessions ?? []).map((row) => fromDbSession(row as SessionDbRow))
  };
}
