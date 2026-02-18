import type { AttemptRecord, PuzzleSettings, SessionRecord } from "../types";

const ATTEMPTS_KEY = "blindfold.attempts.v2";
const SESSIONS_KEY = "blindfold.sessions.v2";

function loadFromStorage<T>(key: string, fallback: T): T {
  const value = localStorage.getItem(key);
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeSettings(raw: unknown): PuzzleSettings | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const pieceCount = Number((raw as { pieceCount?: unknown }).pieceCount);
  const ratingBucket = Number((raw as { ratingBucket?: unknown }).ratingBucket);
  if (Number.isFinite(pieceCount) && Number.isFinite(ratingBucket)) {
    return { pieceCount, ratingBucket };
  }

  const maxPieces = Number((raw as { maxPieces?: unknown }).maxPieces);
  if (!Number.isFinite(maxPieces)) {
    return null;
  }
  return { pieceCount: maxPieces, ratingBucket: 1200 };
}

function normalizeAttempt(raw: Partial<AttemptRecord>): AttemptRecord | null {
  if (
    typeof raw.id !== "string" ||
    typeof raw.session_id !== "string" ||
    typeof raw.user_id !== "string" ||
    typeof raw.item_id !== "string" ||
    (raw.mode !== "square_color" && raw.mode !== "puzzle_recall") ||
    typeof raw.expected_answer !== "string" ||
    typeof raw.correct !== "boolean" ||
    typeof raw.latency_ms !== "number" ||
    typeof raw.created_at !== "string"
  ) {
    return null;
  }

  return {
    id: raw.id,
    session_id: raw.session_id,
    user_id: raw.user_id,
    item_id: raw.item_id,
    mode: raw.mode,
    prompt_payload: raw.prompt_payload ?? {},
    answer_payload: raw.answer_payload ?? {},
    expected_answer: raw.expected_answer,
    correct: raw.correct,
    latency_ms: raw.latency_ms,
    created_at: raw.created_at,
    settings_payload: normalizeSettings(raw.settings_payload),
    synced: raw.synced
  };
}

function normalizeSession(raw: Partial<SessionRecord>): SessionRecord {
  const now = new Date().toISOString();
  return {
    id: raw.id ?? `session-${Date.now()}`,
    user_id: raw.user_id ?? "guest-local",
    started_at: raw.started_at ?? now,
    ended_at: raw.ended_at ?? raw.started_at ?? now,
    duration_s: raw.duration_s ?? 0,
    mode: raw.mode ?? "square_color",
    settings_payload: normalizeSettings(raw.settings_payload),
    status: raw.status ?? "completed",
    attempt_count: raw.attempt_count ?? 0,
    correct_count: raw.correct_count ?? 0,
    synced: raw.synced
  };
}

export function getAttempts(): AttemptRecord[] {
  const raw = loadFromStorage<Partial<AttemptRecord>[]>(ATTEMPTS_KEY, []);
  return raw.map(normalizeAttempt).filter((attempt): attempt is AttemptRecord => attempt !== null);
}

export function saveAttempts(attempts: AttemptRecord[]): void {
  saveToStorage(ATTEMPTS_KEY, attempts);
}

export function appendAttempt(attempt: AttemptRecord): void {
  const attempts = getAttempts();
  attempts.push(attempt);
  saveAttempts(attempts);
}

export function getSessions(): SessionRecord[] {
  const raw = loadFromStorage<Partial<SessionRecord>[]>(SESSIONS_KEY, []);
  return raw.map(normalizeSession);
}

export function saveSessions(sessions: SessionRecord[]): void {
  saveToStorage(SESSIONS_KEY, sessions);
}

export function upsertSession(nextSession: SessionRecord): void {
  const sessions = getSessions();
  const index = sessions.findIndex((session) => session.id === nextSession.id);
  if (index >= 0) {
    sessions[index] = nextSession;
  } else {
    sessions.push(nextSession);
  }
  saveSessions(sessions);
}

export function replaceUserProgress(userId: string, attempts: AttemptRecord[], sessions: SessionRecord[]): void {
  const existingAttempts = getAttempts().filter((attempt) => attempt.user_id !== userId);
  const existingSessions = getSessions().filter((session) => session.user_id !== userId);

  saveAttempts([...existingAttempts, ...attempts]);
  saveSessions([...existingSessions, ...sessions]);
}

export function resetAllBlindfoldData(): void {
  const keysToDelete: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && key.startsWith("blindfold.")) {
      keysToDelete.push(key);
    }
  }
  for (const key of keysToDelete) {
    localStorage.removeItem(key);
  }
}
