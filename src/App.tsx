import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { chooseNextDifficulty, updateStageSnapshot } from "./engine/adaptive";
import { createMateExercise, evaluateAnswer, generateExercise, stageDisplayName } from "./engine/exercises";
import { updateProfileAfterSession, xpForAttempt } from "./engine/scoring";
import { Dashboard } from "./components/Dashboard";
import { ExerciseCard } from "./components/ExerciseCard";
import {
  appendAttempt,
  appendSession,
  getAttempts,
  getProfile,
  getSessions,
  getSnapshots,
  saveAttempts,
  saveProfile,
  saveSessions,
  saveSnapshots,
  upsertSession,
  upsertSnapshot
} from "./services/localDb";
import { getNextMatePuzzle } from "./services/puzzleProvider";
import { getSupabaseClient, hasSupabaseConfig, signInWithGitHub, signOut } from "./services/supabase";
import { syncLocalProgress } from "./services/sync";
import type {
  AttemptRecord,
  ExerciseItem,
  ExerciseStage,
  ProgressSnapshot,
  SessionRecord,
  SessionSummary,
  UserProfile
} from "./types";

const GUEST_ID = "guest-local";
const CATEGORY_OPTIONS: ExerciseStage[] = ["square_color", "mate_in_1", "mate_in_2"];

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function appendOrReplaceSession(allSessions: SessionRecord[], nextSession: SessionRecord): SessionRecord[] {
  const index = allSessions.findIndex((session) => session.id === nextSession.id);
  if (index < 0) {
    return [...allSessions, nextSession];
  }
  const copy = [...allSessions];
  copy[index] = nextSession;
  return copy;
}

export default function App() {
  const [userId, setUserId] = useState<string>(GUEST_ID);
  const [displayName, setDisplayName] = useState<string>("Guest");
  const [selectedStage, setSelectedStage] = useState<ExerciseStage>("square_color");
  const [allAttempts, setAllAttempts] = useState<AttemptRecord[]>([]);
  const [allSessions, setAllSessions] = useState<SessionRecord[]>([]);
  const [allSnapshots, setAllSnapshots] = useState<ProgressSnapshot[]>([]);
  const [profile, setProfile] = useState<UserProfile>(() => getProfile(GUEST_ID, "Guest"));
  const [activeSession, setActiveSession] = useState<SessionRecord | null>(null);
  const [currentItem, setCurrentItem] = useState<ExerciseItem | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [feedback, setFeedback] = useState<string>("");
  const [syncMessage, setSyncMessage] = useState<string>("Local mode active.");
  const [isLoadingItem, setIsLoadingItem] = useState<boolean>(false);
  const [isBootstrapped, setIsBootstrapped] = useState<boolean>(false);

  useEffect(() => {
    setAllAttempts(getAttempts());
    setAllSessions(getSessions());
    setAllSnapshots(getSnapshots());
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setUserId(GUEST_ID);
      setDisplayName("Guest");
      setIsBootstrapped(true);
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const user = data.session?.user;
      if (!user) {
        setUserId(GUEST_ID);
        setDisplayName("Guest");
      } else {
        setUserId(user.id);
        setDisplayName(user.user_metadata.user_name ?? user.user_metadata.name ?? "Player");
      }
      setIsBootstrapped(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      if (!user) {
        setUserId(GUEST_ID);
        setDisplayName("Guest");
      } else {
        setUserId(user.id);
        setDisplayName(user.user_metadata.user_name ?? user.user_metadata.name ?? "Player");
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setProfile(getProfile(userId, displayName));
    setSummary(null);
    setFeedback("");
    setCurrentItem(null);
    setActiveSession(null);
  }, [userId, displayName]);

  const attempts = useMemo(() => allAttempts.filter((attempt) => attempt.user_id === userId), [allAttempts, userId]);
  const sessions = useMemo(() => allSessions.filter((session) => session.user_id === userId), [allSessions, userId]);
  const snapshots = useMemo(
    () => allSnapshots.filter((snapshot) => snapshot.user_id === userId),
    [allSnapshots, userId]
  );

  const syncMutation = useMutation({
    mutationFn: async () =>
      syncLocalProgress({
        attempts,
        sessions,
        snapshots,
        profile
      }),
    onSuccess: (result) => {
      setSyncMessage(result.message);
      if (!result.synced) return;

      const attemptsMarked = allAttempts.map((attempt) =>
        attempt.user_id === userId ? { ...attempt, synced: true } : attempt
      );
      const sessionsMarked = allSessions.map((session) =>
        session.user_id === userId ? { ...session, synced: true } : session
      );
      const snapshotsMarked = allSnapshots.map((snapshot) =>
        snapshot.user_id === userId ? { ...snapshot, synced: true } : snapshot
      );

      setAllAttempts(attemptsMarked);
      setAllSessions(sessionsMarked);
      setAllSnapshots(snapshotsMarked);
      saveAttempts(attemptsMarked);
      saveSessions(sessionsMarked);
      saveSnapshots(snapshotsMarked);
    },
    onError: (error: Error) => {
      setSyncMessage(error.message);
    }
  });

  useEffect(() => {
    if (!hasSupabaseConfig()) return;
    const onOnline = () => {
      if (!syncMutation.isPending) {
        syncMutation.mutate();
      }
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [syncMutation]);

  useEffect(() => {
    if (!isBootstrapped) return;
    const staleActive = sessions.filter((session) => session.status === "active");
    if (staleActive.length === 0) return;

    let nextProfile = getProfile(userId, displayName);
    let nextSessions = [...allSessions];

    for (const stale of staleActive) {
      const sessionAttempts = getAttempts().filter(
        (attempt) => attempt.session_id === stale.id && attempt.user_id === stale.user_id
      );
      const closedAt = new Date().toISOString();
      const durationS = Math.max(1, Math.round((Date.parse(closedAt) - Date.parse(stale.started_at)) / 1000));
      const xpEarned = sessionAttempts.reduce((sum, attempt) => sum + xpForAttempt(attempt, nextProfile.streak), 0);
      const baseCompleted: SessionRecord = {
        ...stale,
        ended_at: closedAt,
        duration_s: durationS,
        xp_earned: xpEarned,
        status: "completed",
        synced: false
      };
      if (sessionAttempts.length > 0) {
        const profiled = updateProfileAfterSession(nextProfile, baseCompleted, sessionAttempts, snapshots);
        nextProfile = profiled;
        nextSessions = appendOrReplaceSession(nextSessions, { ...baseCompleted, streak_after: profiled.streak });
      } else {
        nextSessions = appendOrReplaceSession(nextSessions, baseCompleted);
      }
    }

    setProfile(nextProfile);
    saveProfile(nextProfile);
    setAllSessions(nextSessions);
    saveSessions(nextSessions);
    setActiveSession(null);
    setCurrentItem(null);
    setFeedback("Previous unfinished session was closed and saved.");
  }, [isBootstrapped, userId, displayName, sessions, allSessions, allAttempts, snapshots]);

  function persistSession(nextSession: SessionRecord): void {
    upsertSession(nextSession);
    setAllSessions((previous) => appendOrReplaceSession(previous, nextSession));
    setActiveSession((previous) => (previous?.id === nextSession.id ? nextSession : previous));
  }

  function difficultyForStage(stage: ExerciseStage): number {
    const snapshot = snapshots.find((row) => row.stage === stage);
    const stageAttempts = attempts.filter((attempt) => attempt.stage === stage).slice(-25);
    return chooseNextDifficulty(snapshot, stageAttempts);
  }

  async function loadNextItem(stage: ExerciseStage): Promise<void> {
    setIsLoadingItem(true);
    try {
      const difficulty = difficultyForStage(stage);
      const next =
        stage === "square_color"
          ? generateExercise("square_color", difficulty)
          : createMateExercise(stage, difficulty, await getNextMatePuzzle(stage));
      setCurrentItem(next);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Failed to load puzzle.");
    } finally {
      setIsLoadingItem(false);
    }
  }

  function startSession(): void {
    if (activeSession) {
      return;
    }
    setSummary(null);
    setFeedback("");
    const now = new Date().toISOString();
    const session: SessionRecord = {
      id: createId("session"),
      user_id: userId,
      started_at: now,
      ended_at: now,
      duration_s: 0,
      xp_earned: 0,
      streak_after: profile.streak,
      focus_stage: selectedStage,
      status: "active",
      attempt_count: 0,
      synced: false
    };
    appendSession(session);
    setAllSessions((previous) => [...previous, session]);
    setActiveSession(session);
    void loadNextItem(selectedStage);
  }

  function finishSession(session: SessionRecord): void {
    const endedAt = new Date().toISOString();
    const sessionAttempts = getAttempts().filter(
      (attempt) => attempt.session_id === session.id && attempt.user_id === session.user_id
    );
    const durationS = Math.max(1, Math.round((Date.parse(endedAt) - Date.parse(session.started_at)) / 1000));
    const xpEarned = sessionAttempts.reduce((sum, attempt) => sum + xpForAttempt(attempt, profile.streak), 0);
    const completedBase: SessionRecord = {
      ...session,
      ended_at: endedAt,
      duration_s: durationS,
      xp_earned: xpEarned,
      status: "completed",
      synced: false
    };
    const nextProfile =
      sessionAttempts.length > 0 ? updateProfileAfterSession(profile, completedBase, sessionAttempts, snapshots) : profile;
    const completed = { ...completedBase, streak_after: nextProfile.streak };

    setProfile(nextProfile);
    saveProfile(nextProfile);
    persistSession(completed);
    setActiveSession(null);
    setCurrentItem(null);
    setSummary({
      attempts: sessionAttempts,
      correctCount: sessionAttempts.filter((attempt) => attempt.correct).length,
      totalCount: sessionAttempts.length,
      accuracy:
        sessionAttempts.length === 0
          ? 0
          : sessionAttempts.filter((attempt) => attempt.correct).length / sessionAttempts.length,
      xp: xpEarned,
      durationS
    });
  }

  async function handleSubmit(answer: string, latencyMs: number): Promise<void> {
    if (!activeSession || !currentItem) return;
    const evaluation = evaluateAnswer(currentItem, answer);
    const attempt: AttemptRecord = {
      id: createId("attempt"),
      session_id: activeSession.id,
      user_id: userId,
      item_id: currentItem.id,
      stage: currentItem.stage,
      prompt_payload: currentItem.prompt as Record<string, unknown>,
      answer_payload: { answer },
      expected_answer: evaluation.expected,
      correct: evaluation.correct,
      latency_ms: latencyMs,
      difficulty: currentItem.difficulty,
      confidence: 3,
      created_at: new Date().toISOString(),
      synced: false
    };

    appendAttempt(attempt);
    setAllAttempts((previous) => [...previous, attempt]);

    const stageAttempts = getAttempts()
      .filter((row) => row.user_id === userId && row.stage === attempt.stage)
      .slice(-25);
    const previousSnapshot = snapshots.find((snapshot) => snapshot.stage === attempt.stage);
    const nextSnapshot = updateStageSnapshot(attempt.stage, userId, previousSnapshot, stageAttempts);
    upsertSnapshot(nextSnapshot);
    setAllSnapshots((previous) => {
      const index = previous.findIndex(
        (snapshot) => snapshot.stage === nextSnapshot.stage && snapshot.user_id === userId
      );
      if (index < 0) return [...previous, nextSnapshot];
      const copy = [...previous];
      copy[index] = nextSnapshot;
      return copy;
    });

    const updatedSession: SessionRecord = {
      ...activeSession,
      attempt_count: activeSession.attempt_count + 1,
      synced: false
    };
    persistSession(updatedSession);

    const gained = xpForAttempt(attempt, profile.streak);
    setFeedback(evaluation.correct ? `Correct (+${gained} XP)` : `Incorrect. Expected ${evaluation.expected}`);
    await loadNextItem(updatedSession.focus_stage);
  }

  if (!isBootstrapped) {
    return <div className="app-shell">Loading...</div>;
  }

  const signedIn = userId !== GUEST_ID;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Blindfold Chess Trainer</h1>
          <p className="muted">Simple focused practice: square color, mate in 1, mate in 2</p>
        </div>
        <div className="top-actions">
          <span className="pill">{signedIn ? `Signed in as ${displayName}` : "Guest mode"}</span>
          {signedIn ? (
            <button type="button" className="btn secondary" onClick={() => signOut()}>
              Sign out
            </button>
          ) : (
            <button type="button" className="btn secondary" disabled={!hasSupabaseConfig()} onClick={() => signInWithGitHub()}>
              Sign in with GitHub
            </button>
          )}
        </div>
      </header>

      <main className="main-grid">
        <section className="panel">
          <h2>Training</h2>
          <p className="muted">Choose one category and train continuously. Progress saves after every answer.</p>
          <div className="controls">
            <label className="field">
              <span>Category</span>
              <select
                value={selectedStage}
                onChange={(event) => setSelectedStage(event.target.value as ExerciseStage)}
                disabled={Boolean(activeSession)}
              >
                {CATEGORY_OPTIONS.map((stage) => (
                  <option key={stage} value={stage}>
                    {stageDisplayName(stage)}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn primary" onClick={startSession} disabled={Boolean(activeSession)}>
              Start Session
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => (activeSession ? finishSession(activeSession) : undefined)}
              disabled={!activeSession}
            >
              End Session
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? "Syncing..." : "Sync Now"}
            </button>
          </div>
          <p className="muted">{syncMessage}</p>
          {feedback ? <p className="feedback">{feedback}</p> : null}

          {currentItem && activeSession ? (
            <ExerciseCard
              item={currentItem}
              attemptsInSession={activeSession.attempt_count}
              disabled={isLoadingItem}
              onSubmit={(answer, latencyMs) => {
                void handleSubmit(answer, latencyMs);
              }}
            />
          ) : summary ? (
            <article className="session-summary">
              <h3>Session Complete</h3>
              <p>
                Accuracy: {Math.round(summary.accuracy * 100)}% ({summary.correctCount}/{summary.totalCount})
              </p>
              <p>XP earned: {summary.xp}</p>
              <p>Duration: {Math.round(summary.durationS / 60)} min</p>
            </article>
          ) : (
            <p className="muted">No active session. Start one to train.</p>
          )}
        </section>

        <Dashboard profile={profile} attempts={attempts} sessions={sessions} />
      </main>
    </div>
  );
}
