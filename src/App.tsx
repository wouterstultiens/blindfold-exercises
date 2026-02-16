import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { updateStageSnapshot } from "./engine/adaptive";
import { evaluateAnswer } from "./engine/exercises";
import { buildAdaptiveSession } from "./engine/session";
import { updateProfileAfterSession, xpForAttempt } from "./engine/scoring";
import { Dashboard } from "./components/Dashboard";
import { ExerciseCard } from "./components/ExerciseCard";
import {
  addReviewItem,
  appendAttempt,
  appendSession,
  getAttempts,
  getProfile,
  getSessions,
  getSnapshots,
  popDueReviewItems,
  saveAttempts,
  saveProfile,
  saveSessions,
  saveSnapshots,
  upsertSnapshot
} from "./services/localDb";
import { getSupabaseClient, hasSupabaseConfig, signInWithGitHub, signOut } from "./services/supabase";
import { syncLocalProgress } from "./services/sync";
import { useAppStore } from "./store/useAppStore";
import type { AttemptRecord, ExerciseItem, ProgressSnapshot, SessionRecord, UserProfile } from "./types";

const GUEST_ID = "guest-local";

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function dueInMinutes(minutes: number): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

export default function App() {
  const [userId, setUserId] = useState<string>(GUEST_ID);
  const [displayName, setDisplayName] = useState<string>("Guest");
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const [allAttempts, setAllAttempts] = useState<AttemptRecord[]>([]);
  const [allSessions, setAllSessions] = useState<SessionRecord[]>([]);
  const [allSnapshots, setAllSnapshots] = useState<ProgressSnapshot[]>([]);
  const [profile, setProfile] = useState<UserProfile>(() => getProfile(GUEST_ID, "Guest"));
  const [syncMessage, setSyncMessage] = useState<string>("Local mode active.");
  const [feedback, setFeedback] = useState<string>("");
  const [isBootstrapped, setIsBootstrapped] = useState<boolean>(false);

  const runtime = useAppStore((state) => state.runtime);
  const summary = useAppStore((state) => state.summary);
  const startSession = useAppStore((state) => state.startSession);
  const addAttemptToRuntime = useAppStore((state) => state.addAttempt);
  const nextItem = useAppStore((state) => state.nextItem);
  const finishRuntimeSession = useAppStore((state) => state.finishSession);
  const resetSummary = useAppStore((state) => state.resetSummary);

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

  const currentItem: ExerciseItem | null = runtime ? runtime.items[runtime.currentIndex] ?? null : null;

  const beginSession = () => {
    resetSummary();
    setFeedback("");
    const reviewItems = popDueReviewItems(4);
    const items = buildAdaptiveSession(attempts, snapshots, reviewItems, 16);
    startSession(createId("session"), items);
  };

  const finalizeSession = (finalAttempts: AttemptRecord[]) => {
    if (!runtime) return;
    const started = new Date(runtime.startedAt).getTime();
    const ended = Date.now();
    const durationS = Math.max(1, Math.round((ended - started) / 1000));
    const xpEarned = finalAttempts.reduce((sum, attempt) => sum + xpForAttempt(attempt, profile.streak), 0);

    const sessionRecord: SessionRecord = {
      id: runtime.id,
      user_id: userId,
      started_at: runtime.startedAt,
      ended_at: new Date().toISOString(),
      duration_s: durationS,
      xp_earned: xpEarned,
      streak_after: profile.streak,
      synced: false
    };

    const nextProfile = updateProfileAfterSession(profile, sessionRecord, finalAttempts, snapshots);
    const finalizedSession = { ...sessionRecord, streak_after: nextProfile.streak };
    setProfile(nextProfile);
    saveProfile(nextProfile);

    appendSession(finalizedSession);
    setAllSessions((previous) => [...previous, finalizedSession]);
    finishRuntimeSession(finalizedSession);
  };

  const handleSubmit = (answer: string, confidence: 1 | 2 | 3 | 4 | 5, latencyMs: number) => {
    if (!runtime || !currentItem) return;
    const evaluation = evaluateAnswer(currentItem, answer);
    const attempt: AttemptRecord = {
      id: createId("attempt"),
      session_id: runtime.id,
      user_id: userId,
      item_id: currentItem.id,
      stage: currentItem.stage,
      prompt_payload: currentItem.prompt as Record<string, unknown>,
      answer_payload: { answer },
      expected_answer: evaluation.expected,
      correct: evaluation.correct,
      latency_ms: latencyMs,
      difficulty: currentItem.difficulty,
      confidence,
      created_at: new Date().toISOString(),
      synced: false
    };

    appendAttempt(attempt);
    setAllAttempts((previous) => [...previous, attempt]);
    addAttemptToRuntime(attempt);

    if (!attempt.correct) {
      addReviewItem(currentItem, dueInMinutes(2));
    }

    const stageAttempts = [...attempts.filter((row) => row.stage === attempt.stage), attempt];
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

    setFeedback(
      evaluation.correct ? `Correct (+${xpForAttempt(attempt, profile.streak)} XP)` : `Incorrect. Expected ${evaluation.expected}`
    );

    const reachedEnd = runtime.currentIndex >= runtime.items.length - 1;
    if (reachedEnd) {
      const finalAttempts = [...runtime.attempts, attempt];
      finalizeSession(finalAttempts);
      return;
    }
    nextItem();
  };

  if (!isBootstrapped) {
    return <div className="app-shell">Loading...</div>;
  }

  const signedIn = userId !== GUEST_ID;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Blindfold Chess Trainer</h1>
          <p className="muted">Adaptive training for visualization and calculation depth</p>
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
          <p className="muted">Default session length: 10-20 minutes with adaptive difficulty.</p>
          <div className="controls">
            <button type="button" className="btn primary" onClick={beginSession} disabled={Boolean(runtime)}>
              Start Today&apos;s Session
            </button>
            <label className="switch">
              <input
                type="checkbox"
                checked={audioEnabled}
                onChange={(event) => setAudioEnabled(event.target.checked)}
              />
              <span>Audio prompts</span>
            </label>
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

          {currentItem ? (
            <ExerciseCard
              item={currentItem}
              index={runtime?.currentIndex ?? 0}
              total={runtime?.items.length ?? 0}
              audioEnabled={audioEnabled}
              onSubmit={handleSubmit}
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

        <Dashboard profile={profile} attempts={attempts} sessions={sessions} snapshots={snapshots} />
      </main>
    </div>
  );
}
