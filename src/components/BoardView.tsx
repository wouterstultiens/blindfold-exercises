import { Chessboard } from "react-chessboard";

interface BoardViewProps {
  fen: string;
  orientation?: "white" | "black";
}

export function BoardView({ fen, orientation = "white" }: BoardViewProps) {
  return (
    <div className="board-shell">
      <Chessboard
        id={`board-${fen}`}
        position={fen}
        arePiecesDraggable={false}
        boardWidth={320}
        boardOrientation={orientation}
        customBoardStyle={{ borderRadius: "10px", boxShadow: "0 8px 22px rgba(0, 0, 0, 0.2)" }}
      />
    </div>
  );
}
