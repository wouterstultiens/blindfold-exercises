import { useEffect, useMemo, useRef, useState } from "react";
import { ExerciseCard } from "./components/ExerciseCard";
import { ProgressView } from "./components/ProgressView";
import { createSquareColorItem, modeDisplayName } from "./engine/exercises";
import {
  appendAttempt,
  getAttempts,
  getSessions,
  replaceUserProgress,
  resetAllBlindfoldData,
  saveSessions,
  upsertSession
} from "./services/localDb";
import { getNextPuzzle, getPuzzleCatalog, type PuzzleCatalog } from "./services/puzzleProvider";
import { getSupabaseClient, hasSupabaseConfig, signInWithGitHub, signOut } from "./services/supabase";
import { deleteAllProgressEverywhere, syncLocalProgress } from "./services/sync";
import type { AttemptRecord, ExerciseItem, ExerciseMode, PuzzleSettings, SessionRecord } from "./types";

const GUEST_ID = "guest-local";
const FALLBACK_CATALOG: PuzzleCatalog = {
  pieceCounts: [3, 4, 5, 6, 7, 8],
  ratingBuckets: [1200],
  countsByCombo: {
    "p3-r1200": 1,
    "p4-r1200": 1,
    "p5-r1200": 1,
    "p6-r1200": 1,
    "p7-r1200": 1,
    "p8-r1200": 1
  }
};
const DEFAULT_PUZZLE_SETTINGS: PuzzleSettings = {
  pieceCount: 5,
  ratingBucket: 1200
};
type AppTab = "training" | "progress";

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

function sameSettings(a: PuzzleSettings | null, b: PuzzleSettings | null): boolean {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return a.pieceCount === b.pieceCount && a.ratingBucket === b.ratingBucket;
}

function sessionContextMatches(session: SessionRecord, mode: ExerciseMode, settings: PuzzleSettings | null): boolean {
  return session.mode === mode && sameSettings(session.settings_payload, settings);
}

function settingsForMode(mode: ExerciseMode, settings: PuzzleSettings): PuzzleSettings | null {
  return mode === "puzzle_recall" ? settings : null;
}

function hydrateSessionSettings(sessions: SessionRecord[], attempts: AttemptRecord[]): SessionRecord[] {
  const bySession = new Map<string, PuzzleSettings>();
  for (const attempt of attempts) {
    if (attempt.settings_payload) {
      bySession.set(attempt.session_id, attempt.settings_payload);
    }
  }
  return sessions.map((session) => {
    if (session.mode !== "puzzle_recall" || session.settings_payload) {
      return session;
    }
    const settings = bySession.get(session.id);
    return settings ? { ...session, settings_payload: settings } : session;
  });
}

function formatPuzzleSettings(settings: PuzzleSettings | null): string {
  if (!settings) {
    return "";
  }
  return `${settings.pieceCount} pieces @ ${settings.ratingBucket}`;
}

function hasCombo(catalog: PuzzleCatalog, pieceCount: number, ratingBucket: number): boolean {
  const key = `p${pieceCount}-r${ratingBucket}`;
  return Number(catalog.countsByCombo[key] ?? 0) > 0;
}

function normalizeSettings(settings: PuzzleSettings, catalog: PuzzleCatalog): PuzzleSettings {
  const sortedPieces = [...catalog.pieceCounts].sort((a, b) => a - b);
  const sortedBuckets = [...catalog.ratingBuckets].sort((a, b) => a - b);
  const pieceCount = sortedPieces.find((piece) =>
    sortedBuckets.some((bucket) => hasCombo(catalog, piece, bucket))
  ) ?? 3;

  const preferredPiece = sortedPieces.includes(settings.pieceCount) ? settings.pieceCount : pieceCount;
  const ratingsForPiece = sortedBuckets.filter((bucket) => hasCombo(catalog, preferredPiece, bucket));
  const normalizedPiece = ratingsForPiece.length > 0 ? preferredPiece : pieceCount;
  const normalizedRatings = sortedBuckets.filter((bucket) => hasCombo(catalog, normalizedPiece, bucket));
  const ratingBucket = normalizedRatings.includes(settings.ratingBucket)
    ? settings.ratingBucket
    : normalizedRatings[Math.floor(normalizedRatings.length / 2)] ?? 1200;

  return {
    pieceCount: normalizedPiece,
    ratingBucket
  };
}

async function enterBrowserFullscreen(): Promise<void> {
  const target = document.documentElement as HTMLElement & { requestFullscreen?: () => Promise<void> };
  if (document.fullscreenElement || !target.requestFullscreen) {
    return;
  }
  try {
    await target.requestFullscreen();
  } catch {
    // Ignore: browsers can deny fullscreen requests.
  }
}

async function exitBrowserFullscreen(): Promise<void> {
  if (!document.fullscreenElement) {
    return;
  }
  try {
    await document.exitFullscreen();
  } catch {
    // Ignore: exit failures should not block UI.
  }
}

export default function App() {
  const [userId, setUserId] = useState<string>(GUEST_ID);
  const [displayName, setDisplayName] = useState<string>("Guest");
  const [activeTab, setActiveTab] = useState<AppTab>("training");
  const [selectedMode, setSelectedMode] = useState<ExerciseMode>("square_color");
  const [puzzleCatalog, setPuzzleCatalog] = useState<PuzzleCatalog>(FALLBACK_CATALOG);
  const [puzzleSettings, setPuzzleSettings] = useState<PuzzleSettings>(DEFAULT_PUZZLE_SETTINGS);
  const [allAttempts, setAllAttempts] = useState<AttemptRecord[]>([]);
  const [allSessions, setAllSessions] = useState<SessionRecord[]>([]);
  const [activeSession, setActiveSession] = useState<SessionRecord | null>(null);
  const [isExerciseRunning, setIsExerciseRunning] = useState<boolean>(false);
  const [currentItem, setCurrentItem] = useState<ExerciseItem | null>(null);
  const [feedback, setFeedback] = useState<string>("");
  const [syncMessage, setSyncMessage] = useState<string>("Local mode active.");
  const [isLoadingItem, setIsLoadingItem] = useState<boolean>(false);
  const [isBootstrapped, setIsBootstrapped] = useState<boolean>(false);
  const [isCatalogLoading, setIsCatalogLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  const cleanupBootRef = useRef<{ userId: string | null; startedAtMs: number }>({
    userId: null,
    startedAtMs: Date.now()
  });
  const syncingRef = useRef<boolean>(false);
  const deletingRef = useRef<boolean>(false);

  useEffect(() => {
    setAllAttempts(getAttempts());
    setAllSessions(getSessions());
  }, []);

  useEffect(() => {
    let mounted = true;
    setIsCatalogLoading(true);
    getPuzzleCatalog()
      .then((catalog) => {
        if (!mounted) {
          return;
        }
        setPuzzleCatalog(catalog);
        setPuzzleSettings((previous) => normalizeSettings(previous, catalog));
      })
      .catch((error) => {
        if (!mounted) {
          return;
        }
        setPuzzleCatalog(FALLBACK_CATALOG);
        setPuzzleSettings((previous) => normalizeSettings(previous, FALLBACK_CATALOG));
        setFeedback(error instanceof Error ? error.message : "Unable to load puzzle catalog.");
      })
      .finally(() => {
        if (mounted) {
          setIsCatalogLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
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

  const attempts = useMemo(() => allAttempts.filter((attempt) => attempt.user_id === userId), [allAttempts, userId]);
  const sessions = useMemo(() => allSessions.filter((session) => session.user_id === userId), [allSessions, userId]);
  const availablePieceCounts = useMemo(
    () =>
      puzzleCatalog.pieceCounts.filter((pieceCount) =>
        puzzleCatalog.ratingBuckets.some((ratingBucket) => hasCombo(puzzleCatalog, pieceCount, ratingBucket))
      ),
    [puzzleCatalog]
  );
  const availableRatingBuckets = useMemo(
    () =>
      puzzleCatalog.ratingBuckets.filter((ratingBucket) =>
        hasCombo(puzzleCatalog, puzzleSettings.pieceCount, ratingBucket)
      ),
    [puzzleCatalog, puzzleSettings.pieceCount]
  );

  useEffect(() => {
    if (!isBootstrapped) {
      return;
    }
    const currentActive = sessions.find((session) => session.status === "active") ?? null;
    setActiveSession(currentActive);
  }, [sessions, isBootstrapped]);

  function persistSession(nextSession: SessionRecord): void {
    upsertSession(nextSession);
    setAllSessions((previous) => appendOrReplaceSession(previous, nextSession));
    if (nextSession.status === "active") {
      setActiveSession(nextSession);
    } else if (activeSession?.id === nextSession.id) {
      setActiveSession(null);
    }
  }

  function stopExerciseRun(): void {
    setIsExerciseRunning(false);
    setCurrentItem(null);
    setIsFocusMode(false);
    void exitBrowserFullscreen();
  }

  function completeSession(session: SessionRecord): SessionRecord {
    if (session.status === "completed") {
      return session;
    }
    const endedAt = new Date().toISOString();
    const sessionAttempts = getAttempts().filter((attempt) => attempt.session_id === session.id && attempt.user_id === session.user_id);
    const completed: SessionRecord = {
      ...session,
      ended_at: endedAt,
      duration_s: Math.max(1, Math.round((Date.parse(endedAt) - Date.parse(session.started_at)) / 1000)),
      status: "completed",
      attempt_count: sessionAttempts.length,
      correct_count: sessionAttempts.filter((attempt) => attempt.correct).length,
      synced: false
    };
    persistSession(completed);
    return completed;
  }

  function startSession(mode: ExerciseMode, settings: PuzzleSettings | null): SessionRecord {
    const now = new Date().toISOString();
    const session: SessionRecord = {
      id: createId("session"),
      user_id: userId,
      started_at: now,
      ended_at: now,
      duration_s: 0,
      mode,
      settings_payload: settings,
      status: "active",
      attempt_count: 0,
      correct_count: 0,
      synced: false
    };
    persistSession(session);
    return session;
  }

  function ensureSession(mode: ExerciseMode, settings: PuzzleSettings | null): SessionRecord {
    if (!activeSession) {
      return startSession(mode, settings);
    }
    if (!sessionContextMatches(activeSession, mode, settings)) {
      completeSession(activeSession);
      return startSession(mode, settings);
    }
    return activeSession;
  }

  function updateSessionAfterAttempt(session: SessionRecord, correct: boolean): SessionRecord {
    const updated: SessionRecord = {
      ...session,
      ended_at: new Date().toISOString(),
      attempt_count: session.attempt_count + 1,
      correct_count: session.correct_count + (correct ? 1 : 0),
      synced: false
    };
    persistSession(updated);
    return updated;
  }

  async function syncNow(): Promise<void> {
    if (syncingRef.current || deletingRef.current) {
      return;
    }
    const freshAttempts = getAttempts().filter((attempt) => attempt.user_id === userId);
    const freshSessions = getSessions().filter((session) => session.user_id === userId);

    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const result = await syncLocalProgress({
        userId,
        displayName,
        attempts: freshAttempts,
        sessions: freshSessions
      });
      setSyncMessage(result.message);
      if (!result.synced) {
        return;
      }
      const hydratedSessions = hydrateSessionSettings(result.sessions, result.attempts);
      replaceUserProgress(userId, result.attempts, hydratedSessions);
      setAllAttempts(getAttempts());
      setAllSessions(getSessions());
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }

  async function loadNextItem(mode: ExerciseMode, settings: PuzzleSettings): Promise<void> {
    setIsLoadingItem(true);
    try {
      if (mode === "square_color") {
        setCurrentItem(createSquareColorItem());
      } else {
        const seed = await getNextPuzzle(settings);
        setCurrentItem({
          id: `puzzle-${seed.puzzleId}-${Date.now()}`,
          mode: "puzzle_recall",
          puzzleId: seed.puzzleId,
          fen: seed.fen,
          sideToMove: seed.sideToMove,
          pieceCount: seed.pieceCount,
          ratingBucket: seed.ratingBucket,
          whitePieces: seed.whitePieces,
          blackPieces: seed.blackPieces,
          continuationSan: seed.continuationSan,
          continuationText: seed.continuationText,
          source: seed.source
        });
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Failed to load puzzle.");
      stopExerciseRun();
    } finally {
      setIsLoadingItem(false);
    }
  }

  useEffect(() => {
    if (!isBootstrapped) {
      return;
    }
    if (cleanupBootRef.current.userId === userId) {
      return;
    }
    cleanupBootRef.current.userId = userId;

    const stale = getSessions().filter(
      (session) =>
        session.user_id === userId &&
        session.status === "active" &&
        Date.parse(session.started_at) < cleanupBootRef.current.startedAtMs
    );

    if (stale.length === 0) {
      return;
    }

    const storedAttempts = getAttempts();
    const nextSessions = getSessions().map((session) => {
      if (!stale.some((item) => item.id === session.id)) {
        return session;
      }
      const endedAt = new Date().toISOString();
      const sessionAttempts = storedAttempts.filter((attempt) => attempt.session_id === session.id && attempt.user_id === session.user_id);
      return {
        ...session,
        ended_at: endedAt,
        duration_s: Math.max(1, Math.round((Date.parse(endedAt) - Date.parse(session.started_at)) / 1000)),
        status: "completed" as const,
        attempt_count: sessionAttempts.length,
        correct_count: sessionAttempts.filter((attempt) => attempt.correct).length,
        synced: false
      };
    });

    saveSessions(nextSessions);
    setAllSessions(nextSessions);
    setFeedback("Previous unfinished session was closed and saved.");
  }, [isBootstrapped, userId]);

  useEffect(() => {
    if (!hasSupabaseConfig()) {
      return;
    }
    const onOnline = () => {
      if (userId !== GUEST_ID) {
        void syncNow();
      }
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [userId, displayName]);

  useEffect(() => {
    if (!isBootstrapped) {
      return;
    }
    if (userId !== GUEST_ID) {
      void syncNow();
    }
  }, [userId, isBootstrapped]);

  function rotateSessionForContext(mode: ExerciseMode, settings: PuzzleSettings | null): void {
    if (!activeSession) {
      return;
    }
    if (sessionContextMatches(activeSession, mode, settings)) {
      return;
    }
    completeSession(activeSession);
  }

  async function handleSquareSubmit(
    answer: "black" | "white",
    latencyMs: number,
    evaluation: { correct: boolean; expected: string }
  ): Promise<void> {
    if (!isExerciseRunning || !currentItem || currentItem.mode !== "square_color") {
      return;
    }

    const session = ensureSession("square_color", null);
    const now = new Date().toISOString();
    const attempt: AttemptRecord = {
      id: createId("attempt"),
      session_id: session.id,
      user_id: userId,
      item_id: currentItem.id,
      mode: "square_color",
      prompt_payload: { square: currentItem.square },
      answer_payload: { answer },
      expected_answer: evaluation.expected,
      correct: evaluation.correct,
      latency_ms: latencyMs,
      created_at: now,
      settings_payload: null,
      synced: false
    };

    appendAttempt(attempt);
    setAllAttempts((previous) => [...previous, attempt]);
    updateSessionAfterAttempt(session, evaluation.correct);
    setFeedback(evaluation.correct ? "Correct" : `Incorrect. Expected ${evaluation.expected}`);

    await loadNextItem("square_color", puzzleSettings);
    if (userId !== GUEST_ID && navigator.onLine) {
      void syncNow();
    }
  }

  async function handlePuzzleSubmit(correct: boolean, latencyMs: number): Promise<void> {
    if (!isExerciseRunning || !currentItem || currentItem.mode !== "puzzle_recall") {
      return;
    }

    const settings = settingsForMode("puzzle_recall", puzzleSettings);
    const session = ensureSession("puzzle_recall", settings);
    const now = new Date().toISOString();
    const attempt: AttemptRecord = {
      id: createId("attempt"),
      session_id: session.id,
      user_id: userId,
      item_id: currentItem.id,
      mode: "puzzle_recall",
      prompt_payload: {
        puzzleId: currentItem.puzzleId,
        fen: currentItem.fen,
        sideToMove: currentItem.sideToMove,
        pieceCount: currentItem.pieceCount,
        ratingBucket: currentItem.ratingBucket,
        source: currentItem.source ?? "unknown",
        settings
      },
      answer_payload: { selfGrade: correct ? "right" : "wrong" },
      expected_answer: currentItem.continuationText,
      correct,
      latency_ms: latencyMs,
      created_at: now,
      settings_payload: settings,
      synced: false
    };

    appendAttempt(attempt);
    setAllAttempts((previous) => [...previous, attempt]);
    updateSessionAfterAttempt(session, correct);
    setFeedback(correct ? "Marked as correct." : "Marked as incorrect.");

    await loadNextItem("puzzle_recall", puzzleSettings);
    if (userId !== GUEST_ID && navigator.onLine) {
      void syncNow();
    }
  }

  function endSession(): void {
    if (!activeSession) {
      return;
    }
    completeSession(activeSession);
    stopExerciseRun();
    setActiveTab("training");
    setFeedback("Session ended.");
    if (userId !== GUEST_ID && navigator.onLine) {
      void syncNow();
    }
  }

  async function startExercise(): Promise<void> {
    const settings = settingsForMode(selectedMode, puzzleSettings);
    ensureSession(selectedMode, settings);
    setActiveTab("training");
    setFeedback("");
    setIsExerciseRunning(true);
    setIsFocusMode(true);
    void enterBrowserFullscreen();
    await loadNextItem(selectedMode, puzzleSettings);
  }

  function handleModeChange(nextMode: ExerciseMode): void {
    setSelectedMode(nextMode);
    setFeedback("");
    const nextSettings = settingsForMode(nextMode, puzzleSettings);
    rotateSessionForContext(nextMode, nextSettings);
    stopExerciseRun();
  }

  function handlePieceCountChange(value: number): void {
    const ratingsForPiece = puzzleCatalog.ratingBuckets.filter((ratingBucket) => hasCombo(puzzleCatalog, value, ratingBucket));
    const next = normalizeSettings(
      {
        pieceCount: value,
        ratingBucket: ratingsForPiece.includes(puzzleSettings.ratingBucket) ? puzzleSettings.ratingBucket : ratingsForPiece[0] ?? 1200
      },
      puzzleCatalog
    );
    setPuzzleSettings(next);
    if (selectedMode === "puzzle_recall") {
      rotateSessionForContext("puzzle_recall", next);
      stopExerciseRun();
    }
  }

  function handleRatingBucketChange(value: number): void {
    const next = normalizeSettings({ ...puzzleSettings, ratingBucket: value }, puzzleCatalog);
    setPuzzleSettings(next);
    if (selectedMode === "puzzle_recall") {
      rotateSessionForContext("puzzle_recall", next);
      stopExerciseRun();
    }
  }

  async function resetProgress(): Promise<void> {
    if (deletingRef.current) {
      return;
    }

    const confirmReset = window.confirm(
      userId === GUEST_ID
        ? "Reset all local progress and cached puzzles on this browser?"
        : "Permanently delete all progress everywhere (cloud + this browser)? This cannot be undone."
    );
    if (!confirmReset) {
      return;
    }

    deletingRef.current = true;
    setIsDeleting(true);

    try {
      if (userId !== GUEST_ID) {
        const result = await deleteAllProgressEverywhere(userId);
        setSyncMessage(result.message);
        if (!result.deletedRemote) {
          setFeedback(result.message);
          return;
        }
      }

      resetAllBlindfoldData();
      setAllAttempts([]);
      setAllSessions([]);
      setActiveSession(null);
      stopExerciseRun();
      setActiveTab("training");
      setFeedback(userId === GUEST_ID ? "All local progress has been reset." : "All cloud and local progress has been deleted.");
      if (userId === GUEST_ID) {
        setSyncMessage("Local data reset.");
      }
    } finally {
      deletingRef.current = false;
      setIsDeleting(false);
    }
  }

  if (!isBootstrapped) {
    return <div className="app-shell">Loading...</div>;
  }

  const signedIn = userId !== GUEST_ID;
  const canStart =
    !isExerciseRunning &&
    !isLoadingItem &&
    !isDeleting &&
    (selectedMode !== "puzzle_recall" || (!isCatalogLoading && availablePieceCounts.length > 0 && availableRatingBuckets.length > 0));

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Blindfold Chess Trainer</h1>
          <p className="muted">Minimal distraction drills: Square Color and static Lichess Puzzle Recall.</p>
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

      <nav className="tabbar" aria-label="App sections">
        <button type="button" className={`tab-btn ${activeTab === "training" ? "active" : ""}`} onClick={() => setActiveTab("training")}>
          Training
        </button>
        <button type="button" className={`tab-btn ${activeTab === "progress" ? "active" : ""}`} onClick={() => setActiveTab("progress")}>
          Progress
        </button>
      </nav>

      {activeTab === "training" ? (
        <main className="main-training">
          <section className="panel panel-training">
            <h2>Training</h2>
            <p className="muted">
              Click Start to begin. Changing mode, piece count, or rating bucket ends the current run and requires Start again.
            </p>

            <div className="controls">
              <label className="field">
                <span>Mode</span>
                <select value={selectedMode} onChange={(event) => handleModeChange(event.target.value as ExerciseMode)}>
                  <option value="square_color">{modeDisplayName("square_color")}</option>
                  <option value="puzzle_recall">{modeDisplayName("puzzle_recall")}</option>
                </select>
              </label>

              {selectedMode === "puzzle_recall" ? (
                <>
                  <label className="field">
                    <span>Piece Count</span>
                    <select
                      value={puzzleSettings.pieceCount}
                      onChange={(event) => handlePieceCountChange(Number(event.target.value))}
                      disabled={isCatalogLoading}
                    >
                      {availablePieceCounts.map((pieceCount) => (
                        <option key={pieceCount} value={pieceCount}>
                          {pieceCount}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Rating Bucket</span>
                    <select
                      value={puzzleSettings.ratingBucket}
                      onChange={(event) => handleRatingBucketChange(Number(event.target.value))}
                      disabled={isCatalogLoading}
                    >
                      {availableRatingBuckets.map((bucket) => (
                        <option key={bucket} value={bucket}>
                          {bucket}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}

              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  void startExercise();
                }}
                disabled={!canStart}
              >
                Start
              </button>
              <button type="button" className="btn secondary" onClick={endSession} disabled={!activeSession || isDeleting}>
                End Session
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  void syncNow();
                }}
                disabled={isSyncing || isDeleting}
              >
                {isSyncing ? "Syncing..." : "Sync Now"}
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  void resetProgress();
                }}
                disabled={isDeleting || isSyncing}
              >
                {isDeleting ? "Deleting..." : signedIn ? "Delete Data Everywhere" : "Reset Local Data"}
              </button>
            </div>

            <p className="muted">{syncMessage}</p>
            {activeSession ? (
              <p className="muted">
                Active session: {modeDisplayName(activeSession.mode)}
                {activeSession.settings_payload ? ` | ${formatPuzzleSettings(activeSession.settings_payload)}` : ""}
              </p>
            ) : (
              <p className="muted">No active session right now.</p>
            )}
            {feedback ? <p className="feedback">{feedback}</p> : null}

            {isCatalogLoading && selectedMode === "puzzle_recall" ? <p className="muted">Loading puzzle catalog...</p> : null}
            {isLoadingItem && isExerciseRunning ? <p className="muted">Loading next exercise...</p> : null}
            {!isFocusMode && isExerciseRunning && currentItem ? (
              <ExerciseCard
                item={currentItem}
                attemptsInSession={activeSession?.attempt_count ?? 0}
                disabled={isLoadingItem || isDeleting}
                onSquareSubmit={(answer, latencyMs, evaluation) => {
                  void handleSquareSubmit(answer, latencyMs, evaluation);
                }}
                onPuzzleSubmit={(correct, latencyMs) => {
                  void handlePuzzleSubmit(correct, latencyMs);
                }}
              />
            ) : null}
            {!isExerciseRunning ? <p className="muted">Press Start to begin.</p> : null}
          </section>
        </main>
      ) : (
        <main className="main-progress">
          <ProgressView attempts={attempts} sessions={sessions} />
        </main>
      )}

      {isFocusMode && isExerciseRunning ? (
        <section className="focus-overlay" aria-label="Focused training">
          <div className="focus-shell">
            <div className="focus-top">
              <p className="muted">Focused mode</p>
              <button type="button" className="btn secondary" onClick={endSession} disabled={!activeSession || isDeleting}>
                Stop
              </button>
            </div>

            {isLoadingItem || !currentItem ? (
              <p className="muted">Loading next exercise...</p>
            ) : (
              <ExerciseCard
                item={currentItem}
                attemptsInSession={activeSession?.attempt_count ?? 0}
                disabled={isLoadingItem || isDeleting}
                focused
                onSquareSubmit={(answer, latencyMs, evaluation) => {
                  void handleSquareSubmit(answer, latencyMs, evaluation);
                }}
                onPuzzleSubmit={(correct, latencyMs) => {
                  void handlePuzzleSubmit(correct, latencyMs);
                }}
              />
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
