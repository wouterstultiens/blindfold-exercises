import { useEffect, useRef, useState } from "react";
import { Chessboard } from "react-chessboard";

interface BoardViewProps {
  fen: string;
  orientation?: "white" | "black";
}

export function BoardView({ fen, orientation = "white" }: BoardViewProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [boardWidth, setBoardWidth] = useState<number>(320);

  useEffect(() => {
    if (!shellRef.current) {
      return;
    }

    const node = shellRef.current;
    const resize = () => {
      const width = Math.max(220, Math.min(420, Math.floor(node.clientWidth)));
      setBoardWidth(width);
    };

    resize();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="board-shell" ref={shellRef}>
      <Chessboard
        id={`board-${fen}`}
        position={fen}
        arePiecesDraggable={false}
        boardWidth={boardWidth}
        boardOrientation={orientation}
        customDarkSquareStyle={{ backgroundColor: "#2f4f6f" }}
        customLightSquareStyle={{ backgroundColor: "#c6d4df" }}
        customBoardStyle={{ borderRadius: "14px", boxShadow: "0 14px 34px rgba(4, 8, 16, 0.52)" }}
      />
    </div>
  );
}
