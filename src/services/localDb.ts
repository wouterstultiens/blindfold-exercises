import type { AttemptRecord, ExerciseItem, ProgressSnapshot, ReviewItem, SessionRecord, UserProfile } from "../types";

const ATTEMPTS_KEY = "blindfold.attempts.v1";
const SESSIONS_KEY = "blindfold.sessions.v1";
const SNAPSHOTS_KEY = "blindfold.snapshots.v1";
const PROFILE_KEY_PREFIX = "blindfold.profile.v1";
const REVIEW_KEY = "blindfold.review.v1";

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

function normalizeSession(raw: Partial<SessionRecord>): SessionRecord {
  const startedAt = raw.started_at ?? new Date().toISOString();
  return {
    id: raw.id ?? `session-${Date.now()}`,
    user_id: raw.user_id ?? "guest-local",
    started_at: startedAt,
    ended_at: raw.ended_at ?? startedAt,
    duration_s: raw.duration_s ?? 0,
    xp_earned: raw.xp_earned ?? 0,
    streak_after: raw.streak_after ?? 0,
    focus_stage: raw.focus_stage ?? "square_color",
    status: raw.status ?? "completed",
    attempt_count: raw.attempt_count ?? 0,
    synced: raw.synced
  };
}

export function getAttempts(): AttemptRecord[] {
  return loadFromStorage(ATTEMPTS_KEY, []);
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

export function appendSession(session: SessionRecord): void {
  upsertSession(session);
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

export function activeSessionsForUser(userId: string): SessionRecord[] {
  return getSessions().filter((session) => session.user_id === userId && session.status === "active");
}

export function getSnapshots(): ProgressSnapshot[] {
  return loadFromStorage(SNAPSHOTS_KEY, []);
}

export function saveSnapshots(snapshots: ProgressSnapshot[]): void {
  saveToStorage(SNAPSHOTS_KEY, snapshots);
}

export function upsertSnapshot(nextSnapshot: ProgressSnapshot): void {
  const snapshots = getSnapshots();
  const index = snapshots.findIndex(
    (snapshot) => snapshot.stage === nextSnapshot.stage && snapshot.user_id === nextSnapshot.user_id
  );
  if (index >= 0) {
    snapshots[index] = nextSnapshot;
  } else {
    snapshots.push(nextSnapshot);
  }
  saveSnapshots(snapshots);
}

export function getProfile(userId: string, displayName = "Guest"): UserProfile {
  const profileKey = `${PROFILE_KEY_PREFIX}.${userId}`;
  const profile = loadFromStorage<UserProfile | null>(profileKey, null);
  if (!profile) {
    return {
      user_id: userId,
      display_name: displayName,
      xp: 0,
      level: 1,
      streak: 0,
      badges: []
    };
  }
  return profile;
}

export function saveProfile(profile: UserProfile): void {
  const profileKey = `${PROFILE_KEY_PREFIX}.${profile.user_id}`;
  saveToStorage(profileKey, profile);
}

export function addReviewItem(item: ExerciseItem, dueAtIso: string): void {
  const queue = loadFromStorage<ReviewItem[]>(REVIEW_KEY, []);
  queue.push({ item, due_at: dueAtIso });
  saveToStorage(REVIEW_KEY, queue);
}

export function popDueReviewItems(maxItems: number): ExerciseItem[] {
  const queue = loadFromStorage<ReviewItem[]>(REVIEW_KEY, []);
  const now = new Date();
  const due = queue.filter((entry) => new Date(entry.due_at).getTime() <= now.getTime()).slice(0, maxItems);
  const remaining = queue.filter((entry) => !due.includes(entry));
  saveToStorage(REVIEW_KEY, remaining);
  return due.map((entry) => entry.item);
}

export function clearLocalData(): void {
  localStorage.removeItem(ATTEMPTS_KEY);
  localStorage.removeItem(SESSIONS_KEY);
  localStorage.removeItem(SNAPSHOTS_KEY);
  localStorage.removeItem(REVIEW_KEY);
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
