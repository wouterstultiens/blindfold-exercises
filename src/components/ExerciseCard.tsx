import { useEffect, useMemo, useRef, useState } from "react";
import { evaluateSquareColorAnswer, modeDisplayName, puzzleSideLabel } from "../engine/exercises";
import type { ExerciseItem, PuzzleRecallItem, SquareColorItem } from "../types";
import { BoardView } from "./BoardView";

interface ExerciseCardProps {
  item: ExerciseItem;
  attemptsInSession: number;
  disabled?: boolean;
  focused?: boolean;
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

export function ExerciseCard({
  item,
  attemptsInSession,
  disabled = false,
  focused = false,
  onSquareSubmit,
  onPuzzleSubmit
}: ExerciseCardProps) {
  const startedAtRef = useRef<number>(Date.now());
  const [revealed, setRevealed] = useState<boolean>(false);

  useEffect(() => {
    startedAtRef.current = Date.now();
    setRevealed(false);
  }, [item.id]);

  if (item.mode === "square_color") {
    const squareItem = item as SquareColorItem;
    return (
      <section className={`exercise-card${focused ? " focused" : ""}`} data-testid="exercise-card-square-color">
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
              data-testid={`square-answer-${choice}`}
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
  const compactReveal = focused && revealed;
  return (
    <section className={`exercise-card${focused ? " focused" : ""}`} data-testid="exercise-card-puzzle-recall">
      {!compactReveal ? (
        <>
          <div className="exercise-header">
            <p className="kicker">{modeDisplayName(item.mode)}</p>
            <p className="muted">Attempts in session: {attemptsInSession}</p>
          </div>

          <p className="prompt">{puzzleSideLabel(puzzleItem.sideToMove)}</p>
          <p className="muted">
            {puzzleItem.pieceCount} pieces | bucket {puzzleItem.ratingBucket}
          </p>
          <PieceLines item={puzzleItem} />
        </>
      ) : null}
      {!revealed ? (
        <button
          className={`btn primary${focused ? " focus-cta" : ""}`}
          type="button"
          data-testid="view-answer-btn"
          disabled={disabled}
          onClick={() => setRevealed(true)}
        >
          View Answer
        </button>
      ) : (
        <>
          <article className={`answer-box${compactReveal ? " compact" : ""}`} data-testid="puzzle-continuation">
            <h3>{compactReveal ? "Line" : "Continuation"}</h3>
            <p>{puzzleItem.continuationText}</p>
          </article>
          <div className={`board-wrap${compactReveal ? " compact" : ""}`}>
            <BoardView
              fen={puzzleItem.fen}
              orientation={puzzleItem.sideToMove === "b" ? "black" : "white"}
              variant={compactReveal ? "compact" : "default"}
            />
          </div>
          <div className={`choices${compactReveal ? " focus-actions" : ""}`}>
            <button
              className="choice-btn good"
              type="button"
              data-testid="grade-right-btn"
              disabled={disabled}
              onClick={() => onPuzzleSubmit(true, Date.now() - startedAtRef.current)}
            >
              {compactReveal ? "Right" : "I got it right"}
            </button>
            <button
              className="choice-btn bad"
              type="button"
              data-testid="grade-wrong-btn"
              disabled={disabled}
              onClick={() => onPuzzleSubmit(false, Date.now() - startedAtRef.current)}
            >
              {compactReveal ? "Wrong" : "I got it wrong"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
