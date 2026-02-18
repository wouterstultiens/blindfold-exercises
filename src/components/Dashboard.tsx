import { modeDisplayName } from "../engine/exercises";
import { puzzleComboStats, summarizeModeStats, summarizeSessions } from "../engine/session";
import type { AttemptRecord, SessionRecord } from "../types";

interface DashboardProps {
  attempts: AttemptRecord[];
  sessions: SessionRecord[];
}

function settingsLabel(session: SessionRecord): string {
  if (session.mode !== "puzzle_recall" || !session.settings_payload) {
    return "-";
  }
  return `${session.settings_payload.pieceCount} pieces @ ${session.settings_payload.ratingBucket}`;
}

function sessionDateLabel(isoDate: string): string {
  const date = new Date(isoDate);
  const datePart = date.toLocaleDateString();
  const timePart = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${datePart} ${timePart}`;
}

export function Dashboard({ attempts, sessions }: DashboardProps) {
  const modeStats = summarizeModeStats(attempts);
  const sessionRows = summarizeSessions(sessions, attempts);
  const comboRows = puzzleComboStats(attempts);

  return (
    <section className="dashboard">
      <article className="panel">
        <h3>Mode Progress</h3>
        <div className="table-scroll">
          <div className="table table-row-4">
            <div className="row row-4 header">
              <span>Mode</span>
              <span>Attempts</span>
              <span>Accuracy</span>
              <span>Avg Time</span>
            </div>
            {modeStats.map((row) => (
              <div className="row row-4" key={row.mode}>
                <span>{modeDisplayName(row.mode)}</span>
                <span>{row.attempts}</span>
                <span>{Math.round(row.accuracy * 100)}%</span>
                <span>{row.avgLatencyMs ? `${(row.avgLatencyMs / 1000).toFixed(1)}s` : "-"}</span>
              </div>
            ))}
          </div>
        </div>
      </article>

      <article className="panel">
        <h3>Puzzle Combo Scores</h3>
        <div className="table-scroll">
          <div className="table table-row-3">
            <div className="row row-3 header">
              <span>Settings</span>
              <span>Attempts</span>
              <span>Correct %</span>
            </div>
            {comboRows.length === 0 ? (
              <div className="row row-3">
                <span>No puzzle attempts yet.</span>
                <span>-</span>
                <span>-</span>
              </div>
            ) : (
              comboRows.map((row) => (
                <div className="row row-3" key={`${row.pieceCount}-${row.ratingBucket}`}>
                  <span>
                    {row.pieceCount} pieces @ {row.ratingBucket}
                  </span>
                  <span>{row.attempts}</span>
                  <span>{Math.round(row.correctPercent)}%</span>
                </div>
              ))
            )}
          </div>
        </div>
      </article>

      <article className="panel">
        <h3>Session History</h3>
        <div className="table-scroll">
          <div className="table table-row-5">
            <div className="row row-5 header">
              <span>Date</span>
              <span>Mode</span>
              <span>Settings</span>
              <span>Attempts</span>
              <span>Accuracy</span>
            </div>
            {sessionRows.length === 0 ? (
              <div className="row row-5">
                <span>No completed sessions yet.</span>
                <span>-</span>
                <span>-</span>
                <span>-</span>
                <span>-</span>
              </div>
            ) : (
              sessionRows.map(({ session, accuracy }) => (
                <div className="row row-5" key={session.id}>
                  <span>{sessionDateLabel(session.ended_at)}</span>
                  <span>{modeDisplayName(session.mode)}</span>
                  <span>{settingsLabel(session)}</span>
                  <span>{session.attempt_count}</span>
                  <span>{Math.round(accuracy * 100)}%</span>
                </div>
              ))
            )}
          </div>
        </div>
      </article>
    </section>
  );
}
