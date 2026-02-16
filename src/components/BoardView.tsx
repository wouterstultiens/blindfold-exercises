import { Chessboard } from "react-chessboard";

interface BoardViewProps {
  fen: string;
}

export function BoardView({ fen }: BoardViewProps) {
  return (
    <div className="board-shell">
      <Chessboard
        id={`board-${fen}`}
        position={fen}
        arePiecesDraggable={false}
        boardWidth={320}
        customBoardStyle={{ borderRadius: "10px", boxShadow: "0 8px 22px rgba(0, 0, 0, 0.2)" }}
      />
    </div>
  );
}
