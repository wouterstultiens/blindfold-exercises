import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { stageDisplayName } from "../engine/exercises";
import { summarizeWeaknesses } from "../engine/session";
import type { AttemptRecord, ExerciseStage, ProgressSnapshot, SessionRecord, UserProfile } from "../types";

interface DashboardProps {
  profile: UserProfile;
  attempts: AttemptRecord[];
  sessions: SessionRecord[];
  snapshots: ProgressSnapshot[];
}

function toSessionTrend(sessions: SessionRecord[]) {
  return sessions.slice(-14).map((session) => ({
    date: session.ended_at.slice(5, 10),
    xp: session.xp_earned,
    duration: session.duration_s
  }));
}

function stageStats(attempts: AttemptRecord[]) {
  const grouped = new Map<ExerciseStage, AttemptRecord[]>();
  for (const attempt of attempts) {
    const array = grouped.get(attempt.stage) ?? [];
    array.push(attempt);
    grouped.set(attempt.stage, array);
  }
  return [...grouped.entries()].map(([stage, rows]) => {
    const accuracy = rows.filter((row) => row.correct).length / rows.length;
    const avgLatency = rows.reduce((sum, row) => sum + row.latency_ms, 0) / rows.length;
    return {
      stage,
      accuracy,
      avgLatency
    };
  });
}

export function Dashboard({ profile, attempts, sessions, snapshots }: DashboardProps) {
  const trend = toSessionTrend(sessions);
  const stats = stageStats(attempts);
  const weaknesses = summarizeWeaknesses(attempts);
  const depthSnapshot = snapshots.find((snapshot) => snapshot.stage === "calc_depth");

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
          <h3>Calc Rating</h3>
          <p className="value">{Math.round(depthSnapshot?.rating ?? 1200)}</p>
        </article>
      </div>

      <article className="panel">
        <h3>Last 14 Sessions</h3>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="xp" stroke="#f4a261" strokeWidth={2} />
              <Line type="monotone" dataKey="duration" stroke="#2a9d8f" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="panel">
        <h3>Stage Performance</h3>
        <div className="table">
          <div className="row header">
            <span>Stage</span>
            <span>Accuracy</span>
            <span>Avg Time</span>
          </div>
          {stats.map((row) => (
            <div className="row" key={row.stage}>
              <span>{stageDisplayName(row.stage)}</span>
              <span>{Math.round(row.accuracy * 100)}%</span>
              <span>{(row.avgLatency / 1000).toFixed(1)}s</span>
            </div>
          ))}
        </div>
      </article>

      <article className="panel">
        <h3>Weakness Radar (Top 3)</h3>
        <ul className="weakness-list">
          {weaknesses.length === 0 ? <li>No data yet. Play one session first.</li> : null}
          {weaknesses.map((entry) => (
            <li key={entry.stage}>
              {stageDisplayName(entry.stage)}: {Math.round(entry.accuracy * 100)}% accuracy
            </li>
          ))}
        </ul>
      </article>

      <article className="panel">
        <h3>Badges</h3>
        <div className="badges">
          {profile.badges.length === 0 ? <span className="badge">No badges yet</span> : null}
          {profile.badges.map((badge) => (
            <span className="badge" key={badge}>
              {badge}
            </span>
          ))}
        </div>
      </article>
    </section>
  );
}
