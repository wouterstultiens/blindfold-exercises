import { Chess } from "chess.js";

const PIECES: Record<string, string> = {
  wp: "♙",
  wn: "♘",
  wb: "♗",
  wr: "♖",
  wq: "♕",
  wk: "♔",
  bp: "♟",
  bn: "♞",
  bb: "♝",
  br: "♜",
  bq: "♛",
  bk: "♚"
};

interface BoardViewProps {
  fen: string;
  hidden?: boolean;
}

export function BoardView({ fen, hidden = false }: BoardViewProps) {
  if (hidden) {
    return <div className="board-hidden">Board hidden. Visualize the position.</div>;
  }

  const chess = new Chess(fen);
  const rows = chess.board();

  return (
    <div className="board">
      {rows.map((row, rowIndex) =>
        row.map((piece, fileIndex) => {
          const isLight = (rowIndex + fileIndex) % 2 === 0;
          const key = `${rowIndex}-${fileIndex}`;
          const squareClass = isLight ? "square light" : "square dark";
          const pieceKey = piece ? `${piece.color}${piece.type}` : "";
          return (
            <div key={key} className={squareClass}>
              <span>{pieceKey ? PIECES[pieceKey] : ""}</span>
            </div>
          );
        })
      )}
    </div>
  );
}
