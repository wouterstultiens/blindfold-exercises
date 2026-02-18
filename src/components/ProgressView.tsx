import { useEffect, useMemo, useState } from "react";
import { buildAttemptMovingAverageTrend } from "../engine/session";
import type { AttemptRecord, ExerciseMode, SessionRecord } from "../types";
import { Dashboard } from "./Dashboard";

interface ProgressViewProps {
  attempts: AttemptRecord[];
  sessions: SessionRecord[];
}

interface TrendLineChartProps {
  title: string;
  subtitle: string;
  values: number[];
  valueFormatter: (value: number) => string;
  minY: number;
  maxY: number;
  lineClassName: string;
  firstExerciseNumber: number;
  emptyMessage: string;
}

interface PlotPoint {
  x: number;
  y: number;
  value: number;
  index: number;
}

interface PuzzleCategoryOption {
  key: string;
  label: string;
  attempts: number;
}

const ALL_PUZZLE_CATEGORIES = "all";

function puzzleCategoryKey(pieceCount: number, ratingBucket: number): string {
  return `p${pieceCount}-r${ratingBucket}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildPath(points: PlotPoint[]): string {
  const first = points[0];
  if (!first) {
    return "";
  }
  if (points.length === 1) {
    return `M ${first.x} ${first.y}`;
  }
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function TrendLineChart({
  title,
  subtitle,
  values,
  valueFormatter,
  minY,
  maxY,
  lineClassName,
  firstExerciseNumber,
  emptyMessage
}: TrendLineChartProps) {
  const width = 640;
  const height = 220;
  const paddingLeft = 42;
  const paddingRight = 16;
  const paddingTop = 14;
  const paddingBottom = 30;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;
  const safeRange = Math.max(1, maxY - minY);

  const points = useMemo<PlotPoint[]>(() => {
    if (values.length === 0) {
      return [];
    }
    const denominator = Math.max(1, values.length - 1);
    return values.map((value, index) => {
      const normalized = clamp((value - minY) / safeRange, 0, 1);
      const x = paddingLeft + (index / denominator) * plotWidth;
      const y = paddingTop + (1 - normalized) * plotHeight;
      return { x, y, value, index };
    });
  }, [values, minY, safeRange, paddingLeft, plotWidth, paddingTop, plotHeight]);

  const yTicks = useMemo(() => {
    const steps = 4;
    return Array.from({ length: steps + 1 }, (_, tick) => {
      const ratio = tick / steps;
      const value = maxY - ratio * safeRange;
      const y = paddingTop + ratio * plotHeight;
      return {
        label: valueFormatter(value),
        y
      };
    });
  }, [maxY, safeRange, valueFormatter, paddingTop, plotHeight]);

  if (values.length < 2) {
    return (
      <article className="panel chart-card">
        <h3>{title}</h3>
        <p className="muted">{subtitle}</p>
        <p className="muted">{emptyMessage}</p>
      </article>
    );
  }

  const path = buildPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  const firstLabel = `E${first ? firstExerciseNumber + first.index : firstExerciseNumber}`;
  const lastLabel = `E${last ? firstExerciseNumber + last.index : firstExerciseNumber}`;

  return (
    <article className="panel chart-card">
      <h3>{title}</h3>
      <p className="muted">{subtitle}</p>
      <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <line className="axis-line" x1={paddingLeft} y1={paddingTop + plotHeight} x2={width - paddingRight} y2={paddingTop + plotHeight} />
        <line className="axis-line" x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={paddingTop + plotHeight} />
        {yTicks.map((tick) => (
          <g key={`${title}-tick-${tick.y}`}>
            <line className="grid-line" x1={paddingLeft} y1={tick.y} x2={width - paddingRight} y2={tick.y} />
            <text className="tick-label" x={8} y={tick.y + 4}>
              {tick.label}
            </text>
          </g>
        ))}
        <path className={`trend-path ${lineClassName}`} d={path} />
        {points.map((point) => (
          <g key={`${title}-point-${point.index}`}>
            <circle className={`trend-dot ${lineClassName}`} cx={point.x} cy={point.y} r={4} />
            <title>{`Exercise ${firstExerciseNumber + point.index}: ${valueFormatter(point.value)}`}</title>
          </g>
        ))}
        <text className="tick-label" x={paddingLeft - 6} y={height - 8}>
          {firstLabel}
        </text>
        <text className="tick-label" x={width - paddingRight - 26} y={height - 8}>
          {lastLabel}
        </text>
      </svg>
    </article>
  );
}

export function ProgressView({ attempts, sessions }: ProgressViewProps) {
  const movingAverageWindow = 20;
  const maxVisiblePoints = 1000;
  const [selectedExercise, setSelectedExercise] = useState<ExerciseMode>("square_color");
  const [selectedPuzzleCategory, setSelectedPuzzleCategory] = useState<string>(ALL_PUZZLE_CATEGORIES);

  const puzzleCategories = useMemo<PuzzleCategoryOption[]>(() => {
    const buckets = new Map<string, { pieceCount: number; ratingBucket: number; attempts: number }>();
    for (const attempt of attempts) {
      if (attempt.mode !== "puzzle_recall" || !attempt.settings_payload) {
        continue;
      }
      const key = puzzleCategoryKey(attempt.settings_payload.pieceCount, attempt.settings_payload.ratingBucket);
      const current = buckets.get(key) ?? {
        pieceCount: attempt.settings_payload.pieceCount,
        ratingBucket: attempt.settings_payload.ratingBucket,
        attempts: 0
      };
      current.attempts += 1;
      buckets.set(key, current);
    }

    return [...buckets.values()]
      .sort((a, b) => a.pieceCount - b.pieceCount || a.ratingBucket - b.ratingBucket)
      .map((category) => ({
        key: puzzleCategoryKey(category.pieceCount, category.ratingBucket),
        label: `${category.pieceCount} pieces @ ${category.ratingBucket}`,
        attempts: category.attempts
      }));
  }, [attempts]);

  useEffect(() => {
    if (selectedPuzzleCategory === ALL_PUZZLE_CATEGORIES) {
      return;
    }
    if (puzzleCategories.some((category) => category.key === selectedPuzzleCategory)) {
      return;
    }
    setSelectedPuzzleCategory(ALL_PUZZLE_CATEGORIES);
  }, [puzzleCategories, selectedPuzzleCategory]);

  const filteredAttempts = useMemo(() => {
    if (selectedExercise === "square_color") {
      return attempts.filter((attempt) => attempt.mode === "square_color");
    }

    return attempts.filter((attempt) => {
      if (attempt.mode !== "puzzle_recall") {
        return false;
      }
      if (selectedPuzzleCategory === ALL_PUZZLE_CATEGORIES) {
        return true;
      }
      if (!attempt.settings_payload) {
        return false;
      }
      return (
        puzzleCategoryKey(attempt.settings_payload.pieceCount, attempt.settings_payload.ratingBucket) ===
        selectedPuzzleCategory
      );
    });
  }, [attempts, selectedExercise, selectedPuzzleCategory]);

  const trend = useMemo(
    () => buildAttemptMovingAverageTrend(filteredAttempts, movingAverageWindow, maxVisiblePoints),
    [filteredAttempts]
  );
  const accuracyValues = trend.map((point) => point.accuracyPercent);
  const speedValues = trend.map((point) => point.avgLatencySeconds);
  const maxSpeed = speedValues.reduce((max, value) => Math.max(max, value), 0);
  const firstExerciseNumber = trend[0]?.attemptNumber ?? movingAverageWindow;
  const emptyMessage = `Complete at least ${movingAverageWindow} exercises in this category to render this trend.`;
  const selectedCategoryLabel =
    selectedExercise === "square_color"
      ? "Square Color"
      : selectedPuzzleCategory === ALL_PUZZLE_CATEGORIES
        ? "Puzzle Recall: All Categories"
        : `Puzzle Recall: ${puzzleCategories.find((category) => category.key === selectedPuzzleCategory)?.label ?? "Category"}`;
  const shownPoints = trend.length;
  const totalPoints = Math.max(0, filteredAttempts.length - movingAverageWindow + 1);

  return (
    <section className="progress-view">
      <article className="panel progress-filter-panel">
        <div className="progress-filter-top">
          <h3>Trend Filters</h3>
          <p className="muted">MA(20), showing latest up to 1000 exercises for the selected category.</p>
        </div>
        <div className="exercise-pill-group" role="tablist" aria-label="Exercise type">
          <button
            type="button"
            className={`exercise-pill ${selectedExercise === "square_color" ? "active" : ""}`}
            onClick={() => setSelectedExercise("square_color")}
          >
            Square Color
          </button>
          <button
            type="button"
            className={`exercise-pill ${selectedExercise === "puzzle_recall" ? "active" : ""}`}
            onClick={() => setSelectedExercise("puzzle_recall")}
          >
            Puzzle Recall
          </button>
        </div>
        {selectedExercise === "puzzle_recall" ? (
          <label className="field progress-category-field">
            <span>Puzzle Category</span>
            <select value={selectedPuzzleCategory} onChange={(event) => setSelectedPuzzleCategory(event.target.value)}>
              <option value={ALL_PUZZLE_CATEGORIES}>All categories</option>
              {puzzleCategories.map((category) => (
                <option key={category.key} value={category.key}>
                  {category.label} ({category.attempts})
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="progress-summary-strip">
          <span className="pill">{selectedCategoryLabel}</span>
          <span className="pill">
            Trend points: {shownPoints}
            {totalPoints > maxVisiblePoints ? ` / ${totalPoints} (capped)` : ` / ${totalPoints}`}
          </span>
        </div>
      </article>

      <section className="progress-charts">
        <TrendLineChart
          title="Accuracy Trend"
          subtitle={`Trailing 20-exercise moving average of accuracy (${selectedCategoryLabel}).`}
          values={accuracyValues}
          valueFormatter={(value) => `${Math.round(value)}%`}
          minY={0}
          maxY={100}
          lineClassName="accuracy"
          firstExerciseNumber={firstExerciseNumber}
          emptyMessage={emptyMessage}
        />
        <TrendLineChart
          title="Speed Trend"
          subtitle={`Trailing 20-exercise moving average of response time (${selectedCategoryLabel}).`}
          values={speedValues}
          valueFormatter={(value) => `${value.toFixed(1)}s`}
          minY={0}
          maxY={Math.max(5, Math.ceil(maxSpeed))}
          lineClassName="speed"
          firstExerciseNumber={firstExerciseNumber}
          emptyMessage={emptyMessage}
        />
      </section>
      <Dashboard attempts={attempts} sessions={sessions} />
    </section>
  );
}
