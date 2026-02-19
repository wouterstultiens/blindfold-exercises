import { modeDisplayName } from "../engine/exercises";
import type { ExerciseMode, PuzzleSettings, TrainingUiStateSurface } from "../types";

interface TrainingSetupPanelProps {
  selectedMode: ExerciseMode;
  puzzleSettings: PuzzleSettings;
  availablePieceCounts: number[];
  availableRatingBuckets: number[];
  canStart: boolean;
  signedIn: boolean;
  syncMessage: string;
  feedback: string;
  activeSessionSummary: string | null;
  uiState: TrainingUiStateSurface;
  onModeChange: (mode: ExerciseMode) => void;
  onPieceCountChange: (pieceCount: number) => void;
  onRatingBucketChange: (bucket: number) => void;
  onStart: () => void;
  onEndSession: () => void;
  onSyncNow: () => void;
  onReset: () => void;
}

interface SetupStatusBadge {
  id: string;
  label: string;
  tone: "default" | "warning" | "danger" | "success";
}

function buildSetupBadges(selectedMode: ExerciseMode, uiState: TrainingUiStateSurface): SetupStatusBadge[] {
  const badges: SetupStatusBadge[] = [];
  if (selectedMode === "puzzle_recall" && uiState.isCatalogLoading) {
    badges.push({ id: "catalog-loading", label: "Catalog loading", tone: "warning" });
  }
  if (uiState.isSyncing) {
    badges.push({ id: "syncing", label: "Sync in progress", tone: "default" });
  }
  if (uiState.isDeleting) {
    badges.push({ id: "deleting", label: "Delete in progress", tone: "danger" });
  }
  if (uiState.isOffline) {
    badges.push({ id: "offline", label: "Offline fallback", tone: "warning" });
  }
  if (uiState.isExerciseRunning && uiState.isLoadingItem) {
    badges.push({ id: "loading-item", label: "Loading next exercise", tone: "default" });
  }
  if (uiState.isFocusedRun) {
    badges.push({ id: "focused-run", label: "Focused run active", tone: "default" });
  }
  if (!uiState.hasActiveSession) {
    badges.push({ id: "no-session", label: "No active session", tone: "default" });
  } else {
    badges.push({ id: "session-active", label: "Active session", tone: "success" });
  }
  return badges;
}

export function TrainingSetupPanel({
  selectedMode,
  puzzleSettings,
  availablePieceCounts,
  availableRatingBuckets,
  canStart,
  signedIn,
  syncMessage,
  feedback,
  activeSessionSummary,
  uiState,
  onModeChange,
  onPieceCountChange,
  onRatingBucketChange,
  onStart,
  onEndSession,
  onSyncNow,
  onReset
}: TrainingSetupPanelProps) {
  const badges = buildSetupBadges(selectedMode, uiState);

  return (
    <section className="panel setup-panel">
      <div className="setup-rail-head">
        <h2>Setup Rail</h2>
        <p className="muted">Start quickly. Changing mode or puzzle settings ends the current run and requires Start again.</p>
      </div>

      <div className="setup-grid">
        <label className="field">
          <span>Mode</span>
          <select value={selectedMode} onChange={(event) => onModeChange(event.target.value as ExerciseMode)}>
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
                onChange={(event) => onPieceCountChange(Number(event.target.value))}
                disabled={uiState.isCatalogLoading}
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
                onChange={(event) => onRatingBucketChange(Number(event.target.value))}
                disabled={uiState.isCatalogLoading}
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
      </div>

      <div className="setup-actions">
        <div className="setup-actions-primary">
          <button type="button" className="btn primary" data-testid="start-session-btn" onClick={onStart} disabled={!canStart}>
            Start
          </button>
          <button
            type="button"
            className="btn secondary"
            data-testid="end-session-btn"
            onClick={onEndSession}
            disabled={!uiState.hasActiveSession || uiState.isDeleting}
          >
            End Session
          </button>
        </div>
        <div className="setup-actions-secondary">
          <button type="button" className="btn secondary" onClick={onSyncNow} disabled={uiState.isSyncing || uiState.isDeleting}>
            {uiState.isSyncing ? "Syncing..." : "Sync Now"}
          </button>
          <button type="button" className="btn danger" onClick={onReset} disabled={uiState.isDeleting || uiState.isSyncing}>
            {uiState.isDeleting ? "Deleting..." : signedIn ? "Delete Data Everywhere" : "Reset Local Data"}
          </button>
        </div>
      </div>

      <div className="status-strip" data-testid="training-state-strip">
        {badges.map((badge) => (
          <span key={badge.id} className={`status-badge ${badge.tone}`}>
            {badge.label}
          </span>
        ))}
      </div>

      <div className="message-stack">
        <p className="muted">{syncMessage}</p>
        <p className="muted">{activeSessionSummary ? `Active session: ${activeSessionSummary}` : "No active session right now."}</p>
        {feedback ? <p className="feedback">{feedback}</p> : null}
      </div>
    </section>
  );
}
