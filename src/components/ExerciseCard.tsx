import { useEffect, useMemo, useRef } from "react";
import { stageDisplayName, stagePromptText } from "../engine/exercises";
import type { ExerciseItem } from "../types";
import { BoardView } from "./BoardView";

interface ExerciseCardProps {
  item: ExerciseItem;
  attemptsInSession: number;
  disabled?: boolean;
  onSubmit: (answer: string, latencyMs: number) => void;
}

export function ExerciseCard({ item, attemptsInSession, disabled = false, onSubmit }: ExerciseCardProps) {
  const promptText = useMemo(() => stagePromptText(item), [item]);
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    startedAtRef.current = Date.now();
  }, [item.id]);

  const showBoard = item.stage === "mate_in_1" || item.stage === "mate_in_2";
  const fen = showBoard ? ((item.prompt as { fen: string }).fen ?? "") : "";

  return (
    <section className="exercise-card">
      <div className="exercise-header">
        <p className="kicker">{stageDisplayName(item.stage)}</p>
        <p className="muted">Solved this session: {attemptsInSession}</p>
      </div>
      <p className="prompt">{promptText}</p>

      {showBoard ? (
        <div className="board-wrap">
          <BoardView fen={fen} />
        </div>
      ) : null}

      <div className="choices">
        {item.choices.map((choice) => (
          <button
            key={choice}
            className="choice-btn"
            type="button"
            disabled={disabled}
            onClick={() => onSubmit(choice, Date.now() - startedAtRef.current)}
          >
            {choice}
          </button>
        ))}
      </div>
    </section>
  );
}
