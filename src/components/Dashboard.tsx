import { recentAccuracy, summarizeCategoryStats } from "../engine/session";
import { stageDisplayName } from "../engine/exercises";
import type { AttemptRecord, SessionRecord, UserProfile } from "../types";

interface DashboardProps {
  profile: UserProfile;
  attempts: AttemptRecord[];
  sessions: SessionRecord[];
}

export function Dashboard({ profile, attempts, sessions }: DashboardProps) {
  const categoryStats = summarizeCategoryStats(attempts);

  return (
    <section className="dashboard">
      <div className="stats-grid">
        <article className="stat-card">
          <h3>Level</h3>
          <p className="value">{profile.level}</p>
        </article>
        <article className="stat-card">
          <h3>XP</h3>
          <p className="value">{profile.xp}</p>
        </article>
        <article className="stat-card">
          <h3>Streak</h3>
          <p className="value">{profile.streak} days</p>
        </article>
        <article className="stat-card">
          <h3>Sessions</h3>
          <p className="value">{sessions.filter((session) => session.status === "completed").length}</p>
        </article>
      </div>

      <article className="panel">
        <h3>Category Progress</h3>
        <div className="table">
          <div className="row row-5 header">
            <span>Category</span>
            <span>Accuracy</span>
            <span>Attempts</span>
            <span>Avg Time</span>
            <span>Recent</span>
          </div>
          {categoryStats.map((row) => (
            <div className="row row-5" key={row.stage}>
              <span>{stageDisplayName(row.stage)}</span>
              <span>{Math.round(row.accuracy * 100)}%</span>
              <span>{row.attempts}</span>
              <span>{row.avgLatencyMs > 0 ? `${(row.avgLatencyMs / 1000).toFixed(1)}s` : "-"}</span>
              <span>{Math.round(recentAccuracy(attempts, row.stage) * 100)}%</span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
