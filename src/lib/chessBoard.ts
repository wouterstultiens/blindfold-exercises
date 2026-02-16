const files = "abcdefgh".split("");

export const ALL_SQUARES = files.flatMap((file) =>
  Array.from({ length: 8 }, (_, index) => `${file}${index + 1}`)
);

export function squareColor(square: string): "black" | "white" {
  const file = square.charAt(0);
  const rank = Number(square[1]);
  const fileIndex = files.indexOf(file);
  if (fileIndex < 0 || rank < 1 || rank > 8) {
    throw new Error(`Invalid square: ${square}`);
  }
  return (fileIndex + rank) % 2 === 0 ? "black" : "white";
}

export function sameFile(squareA: string, squareB: string): boolean {
  return squareA[0] === squareB[0];
}

export function sameRank(squareA: string, squareB: string): boolean {
  return squareA[1] === squareB[1];
}

export function sameDiagonal(squareA: string, squareB: string): boolean {
  const [ax, ay] = toCartesian(squareA);
  const [bx, by] = toCartesian(squareB);
  return Math.abs(ax - bx) === Math.abs(ay - by);
}

export function toCartesian(square: string): [number, number] {
  const file = square.charAt(0);
  const rank = Number(square[1]);
  const fileIndex = files.indexOf(file);
  if (fileIndex < 0 || rank < 1 || rank > 8) {
    throw new Error(`Invalid square: ${square}`);
  }
  return [fileIndex, rank - 1];
}
