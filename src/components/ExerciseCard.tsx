import { useEffect, useMemo, useRef, useState } from "react";
import { stageDisplayName, stagePromptText } from "../engine/exercises";
import type { ExerciseItem } from "../types";
import { BoardView } from "./BoardView";

interface ExerciseCardProps {
  item: ExerciseItem;
  index: number;
  total: number;
  audioEnabled: boolean;
  onSubmit: (answer: string, confidence: 1 | 2 | 3 | 4 | 5, latencyMs: number) => void;
}

function confidenceOptions(): Array<1 | 2 | 3 | 4 | 5> {
  return [1, 2, 3, 4, 5];
}

export function ExerciseCard({ item, index, total, audioEnabled, onSubmit }: ExerciseCardProps) {
  const [confidence, setConfidence] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [now, setNow] = useState<number>(() => Date.now());
  const startedAtRef = useRef<number>(Date.now());
  const promptText = useMemo(() => stagePromptText(item), [item]);

  const memoryLike = item.stage === "memory_puzzle" || item.stage === "calc_depth";
  const displayMs = memoryLike ? ((item.prompt as { displayMs?: number }).displayMs ?? 2800) : 0;
  const revealUntilRef = useRef<number>(Date.now() + displayMs);
  const boardHidden = memoryLike ? now >= revealUntilRef.current : false;

  useEffect(() => {
    startedAtRef.current = Date.now();
    revealUntilRef.current = Date.now() + displayMs;
    setNow(Date.now());
    setConfidence(3);
  }, [item, displayMs]);

  useEffect(() => {
    if (!memoryLike) return;
    const interval = window.setInterval(() => setNow(Date.now()), 120);
    return () => window.clearInterval(interval);
  }, [memoryLike, item.id]);

  useEffect(() => {
    if (!audioEnabled) return;
    if (!("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(promptText);
    utterance.rate = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return () => window.speechSynthesis.cancel();
  }, [audioEnabled, promptText, item.id]);

  const showBoard = item.stage === "memory_puzzle" || item.stage === "calc_depth";
  const fen = showBoard ? ((item.prompt as { fen: string }).fen ?? "") : "";

  return (
    <section className="exercise-card">
      <div className="exercise-header">
        <p className="kicker">{stageDisplayName(item.stage)}</p>
        <p className="muted">
          Item {index + 1} / {total} - Difficulty {item.difficulty}
        </p>
      </div>
      <p className="prompt">{promptText}</p>

      {showBoard ? (
        <div className="board-wrap">
          <BoardView fen={fen} hidden={boardHidden} />
          {!boardHidden ? <p className="muted">Memorize the board, it will hide automatically.</p> : null}
        </div>
      ) : null}

      <div className="choices">
        {item.choices.map((choice) => (
          <button
            key={choice}
            className="choice-btn"
            type="button"
            disabled={memoryLike && !boardHidden}
            onClick={() => onSubmit(choice, confidence, Date.now() - startedAtRef.current)}
          >
            {choice}
          </button>
        ))}
      </div>

      <div className="confidence">
        <span>Confidence:</span>
        {confidenceOptions().map((value) => (
          <button
            key={value}
            type="button"
            className={value === confidence ? "confidence-btn active" : "confidence-btn"}
            onClick={() => setConfidence(value)}
          >
            {value}
          </button>
        ))}
      </div>
    </section>
  );
}
