import { modeDisplayName } from "../engine/exercises";
import type { RunMetrics, SessionRecord } from "../types";
import { SessionMomentum } from "./SessionMomentum";

function formatPuzzleSettings(settings: SessionRecord["settings_payload"]): string {
  if (!settings) {
    return "";
  }
  return `${settings.pieceCount} pieces @ ${settings.ratingBucket}`;
}

interface RunStatusPanelProps {
  activeSession: SessionRecord | null;
  metrics: RunMetrics;
}

export function RunStatusPanel({ activeSession, metrics }: RunStatusPanelProps) {
  return (
    <section className="panel run-status-panel">
      <div className="run-status-head">
        <h2>Active Run Status</h2>
        <p className="muted">Attempts, accuracy, streak, and response time update during your session.</p>
      </div>
      {activeSession ? (
        <SessionMomentum
          modeLabel={modeDisplayName(activeSession.mode)}
          settingsLabel={activeSession.settings_payload ? formatPuzzleSettings(activeSession.settings_payload) : null}
          attempts={metrics.attempts}
          accuracyPercent={metrics.accuracyPercent}
          streak={metrics.streak}
          avgLatencyMs={metrics.avgLatencyMs}
        />
      ) : (
        <p className="muted">No active session right now. Press Start to begin.</p>
      )}
    </section>
  );
}
