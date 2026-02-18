import { useEffect, useMemo, useRef, useState } from "react";
import { evaluateSquareColorAnswer, modeDisplayName, puzzleSideLabel } from "../engine/exercises";
import type { ExerciseItem, PuzzleRecallItem, SquareColorItem } from "../types";
import { BoardView } from "./BoardView";

interface ExerciseCardProps {
  item: ExerciseItem;
  attemptsInSession: number;
  disabled?: boolean;
  onSquareSubmit: (answer: "black" | "white", latencyMs: number, evaluation: { correct: boolean; expected: string }) => void;
  onPuzzleSubmit: (correct: boolean, latencyMs: number) => void;
}

function PieceLines({ item }: { item: PuzzleRecallItem }) {
  const lines = useMemo(() => [
    `White: ${item.whitePieces.join(", ")}`,
    `Black: ${item.blackPieces.join(", ")}`
  ], [item.blackPieces, item.whitePieces]);

  return (
    <div className="piece-lines">
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

export function ExerciseCard({ item, attemptsInSession, disabled = false, onSquareSubmit, onPuzzleSubmit }: ExerciseCardProps) {
  const startedAtRef = useRef<number>(Date.now());
  const [revealed, setRevealed] = useState<boolean>(false);

  useEffect(() => {
    startedAtRef.current = Date.now();
    setRevealed(false);
  }, [item.id]);

  if (item.mode === "square_color") {
    const squareItem = item as SquareColorItem;
    return (
      <section className="exercise-card">
        <div className="exercise-header">
          <p className="kicker">{modeDisplayName(item.mode)}</p>
          <p className="muted">Attempts in session: {attemptsInSession}</p>
        </div>
        <p className="prompt">What color is square {squareItem.square}?</p>
        <div className="choices">
          {(["black", "white"] as const).map((choice) => (
            <button
              key={choice}
              className="choice-btn"
              type="button"
              disabled={disabled}
              onClick={() =>
                onSquareSubmit(choice, Date.now() - startedAtRef.current, evaluateSquareColorAnswer(squareItem, choice))
              }
            >
              {choice}
            </button>
          ))}
        </div>
      </section>
    );
  }

  const puzzleItem = item as PuzzleRecallItem;
  return (
    <section className="exercise-card">
      <div className="exercise-header">
        <p className="kicker">{modeDisplayName(item.mode)}</p>
        <p className="muted">Attempts in session: {attemptsInSession}</p>
      </div>

      <p className="prompt">{puzzleSideLabel(puzzleItem.sideToMove)}</p>
      <p className="muted">
        {puzzleItem.pieceCount} pieces | bucket {puzzleItem.ratingBucket}
      </p>
      <PieceLines item={puzzleItem} />

      {!revealed ? (
        <button className="btn primary" type="button" disabled={disabled} onClick={() => setRevealed(true)}>
          View Answer
        </button>
      ) : (
        <>
          <article className="answer-box">
            <h3>Continuation</h3>
            <p>{puzzleItem.continuationText}</p>
          </article>
          <div className="board-wrap">
            <BoardView fen={puzzleItem.fen} orientation={puzzleItem.sideToMove === "b" ? "black" : "white"} />
          </div>
          <div className="choices">
            <button
              className="choice-btn good"
              type="button"
              disabled={disabled}
              onClick={() => onPuzzleSubmit(true, Date.now() - startedAtRef.current)}
            >
              I got it right
            </button>
            <button
              className="choice-btn bad"
              type="button"
              disabled={disabled}
              onClick={() => onPuzzleSubmit(false, Date.now() - startedAtRef.current)}
            >
              I got it wrong
            </button>
          </div>
        </>
      )}
    </section>
  );
}
