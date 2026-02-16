import type { AttemptRecord, ProgressSnapshot, SessionRecord, UserProfile } from "../types";

export function xpForAttempt(attempt: Pick<AttemptRecord, "correct" | "difficulty" | "confidence">, streak: number): number {
  if (!attempt.correct) {
    return 2;
  }
  const confidenceBonus = Math.max(0, attempt.confidence - 2);
  return 10 + attempt.difficulty * 2 + Math.min(8, streak) + confidenceBonus;
}

export function calculateLevel(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(xp / 120)) + 1);
}

function isConsecutiveDay(previousISO: string, currentISO: string): boolean {
  const previousDate = new Date(previousISO);
  const currentDate = new Date(currentISO);
  previousDate.setHours(0, 0, 0, 0);
  currentDate.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;
  return (currentDate.getTime() - previousDate.getTime()) / dayMs === 1;
}

export function updateProfileAfterSession(
  profile: UserProfile,
  session: SessionRecord,
  sessionAttempts: AttemptRecord[],
  snapshots: ProgressSnapshot[]
): UserProfile {
  const addedXp = sessionAttempts.reduce((acc, attempt) => acc + xpForAttempt(attempt, profile.streak), 0);
  const newXp = profile.xp + addedXp;
  const todayIso = session.ended_at;

  let streak = 1;
  if (profile.last_session_date) {
    const sameDay = profile.last_session_date.slice(0, 10) === todayIso.slice(0, 10);
    if (sameDay) {
      streak = profile.streak;
    } else if (isConsecutiveDay(profile.last_session_date, todayIso)) {
      streak = profile.streak + 1;
    }
  }

  const badgeSet = new Set(profile.badges);
  if (newXp >= 150) badgeSet.add("xp-150");
  if (newXp >= 500) badgeSet.add("xp-500");
  if (streak >= 3) badgeSet.add("streak-3");
  if (streak >= 7) badgeSet.add("streak-7");

  for (const snapshot of snapshots) {
    if (snapshot.rolling_accuracy >= 0.85) {
      badgeSet.add(`stage-master-${snapshot.stage}`);
    }
  }

  return {
    ...profile,
    xp: newXp,
    level: calculateLevel(newXp),
    streak,
    last_session_date: todayIso,
    badges: [...badgeSet].sort()
  };
}

export function sessionAccuracy(attempts: AttemptRecord[]): number {
  if (attempts.length === 0) {
    return 0;
  }
  const correct = attempts.filter((attempt) => attempt.correct).length;
  return correct / attempts.length;
}
