import { modeDisplayName } from "../engine/exercises";
import type { ExerciseItem, RunMetrics, SessionRecord } from "../types";
import { ExerciseCard } from "./ExerciseCard";
import { SessionMomentum } from "./SessionMomentum";

function formatPuzzleSettings(settings: SessionRecord["settings_payload"]): string {
  if (!settings) {
    return "";
  }
  return `${settings.pieceCount} pieces @ ${settings.ratingBucket}`;
}

interface FocusedTrainingOverlayProps {
  visible: boolean;
  isLoadingItem: boolean;
  isDeleting: boolean;
  isSyncing: boolean;
  isOffline: boolean;
  currentItem: ExerciseItem | null;
  activeSession: SessionRecord | null;
  metrics: RunMetrics;
  onStop: () => void;
  onSquareSubmit: (answer: "black" | "white", latencyMs: number, evaluation: { correct: boolean; expected: string }) => void;
  onPuzzleSubmit: (correct: boolean, latencyMs: number) => void;
}

export function FocusedTrainingOverlay({
  visible,
  isLoadingItem,
  isDeleting,
  isSyncing,
  isOffline,
  currentItem,
  activeSession,
  metrics,
  onStop,
  onSquareSubmit,
  onPuzzleSubmit
}: FocusedTrainingOverlayProps) {
  if (!visible) {
    return null;
  }

  return (
    <section className="focus-overlay" data-testid="focused-overlay" aria-label="Focused training">
      <div className="focus-shell">
        <div className="focus-top">
          <div>
            <p className="kicker">Focused mode</p>
            <div className="focus-status-strip">
              {isSyncing ? <span className="status-badge default">Syncing</span> : null}
              {isOffline ? <span className="status-badge warning">Offline</span> : null}
            </div>
          </div>
          <button type="button" className="btn secondary" data-testid="stop-session-btn" onClick={onStop} disabled={!activeSession || isDeleting}>
            Stop
          </button>
        </div>

        {isLoadingItem || !currentItem ? (
          <section className="panel">
            <p className="muted">Loading next exercise...</p>
          </section>
        ) : (
          <>
            {activeSession ? (
              <SessionMomentum
                modeLabel={modeDisplayName(activeSession.mode)}
                settingsLabel={activeSession.settings_payload ? formatPuzzleSettings(activeSession.settings_payload) : null}
                attempts={metrics.attempts}
                accuracyPercent={metrics.accuracyPercent}
                streak={metrics.streak}
                avgLatencyMs={metrics.avgLatencyMs}
                focused
              />
            ) : null}
            <ExerciseCard
              item={currentItem}
              attemptsInSession={metrics.attempts}
              disabled={isLoadingItem || isDeleting}
              focused
              onSquareSubmit={onSquareSubmit}
              onPuzzleSubmit={onPuzzleSubmit}
            />
          </>
        )}
      </div>
    </section>
  );
}
