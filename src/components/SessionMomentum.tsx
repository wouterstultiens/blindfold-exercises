import type { RunMetrics } from "../types";

interface SessionMomentumProps extends RunMetrics {
  modeLabel: string;
  settingsLabel: string | null;
  focused?: boolean;
}

export function SessionMomentum({
  modeLabel,
  settingsLabel,
  attempts,
  accuracyPercent,
  streak,
  avgLatencyMs,
  focused = false
}: SessionMomentumProps) {
  const momentumProgress = Math.min(100, Math.max(8, Math.round((attempts / 24) * 100)));

  return (
    <aside className={`session-momentum${focused ? " focused" : ""}`} data-testid="session-momentum">
      <div className="session-momentum-head">
        <p className="kicker">Run Momentum</p>
        <p className="muted">
          {modeLabel}
          {settingsLabel ? ` | ${settingsLabel}` : ""}
        </p>
      </div>
      <div className="momentum-metrics">
        <div className="momentum-metric">
          <span className="label">Attempts</span>
          <span className="value">{attempts}</span>
        </div>
        <div className="momentum-metric">
          <span className="label">Accuracy</span>
          <span className="value">{attempts > 0 ? `${accuracyPercent}%` : "-"}</span>
        </div>
        <div className="momentum-metric streak">
          <span className="label">Streak</span>
          <span className="value">{streak}</span>
        </div>
        <div className="momentum-metric">
          <span className="label">Avg Time</span>
          <span className="value">{attempts > 0 ? `${(avgLatencyMs / 1000).toFixed(1)}s` : "-"}</span>
        </div>
      </div>
      <div className="momentum-track" aria-hidden="true">
        <span style={{ width: `${momentumProgress}%` }} />
      </div>
    </aside>
  );
}
