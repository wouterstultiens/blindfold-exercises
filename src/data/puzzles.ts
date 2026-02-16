export interface FallbackPuzzle {
  id: string;
  fen: string;
  solutionUci: string;
  theme: string;
}

export const MATE_IN_1_FALLBACK: FallbackPuzzle[] = [
  {
    id: "fallback-m1-1",
    fen: "r4q1r/p3b1pk/1n2p2p/4n3/3PN3/3Q4/PPP2PPP/R1B2RK1 w - - 0 17",
    solutionUci: "e4f6",
    theme: "Knight jump mate"
  },
  {
    id: "fallback-m1-2",
    fen: "2kr4/ppp1Q2p/6p1/8/8/3r1qnP/PP6/1KR1R3 w - - 2 29",
    solutionUci: "e7c7",
    theme: "Back-rank break"
  }
];

export const MATE_IN_2_FALLBACK: FallbackPuzzle[] = [
  {
    id: "fallback-m2-1",
    fen: "6k1/pR2Qp1p/2p3p1/8/4K3/4P1PP/P7/3q4 b - - 6 31",
    solutionUci: "d1d5",
    theme: "Queen ladder finish"
  },
  {
    id: "fallback-m2-2",
    fen: "6k1/2p5/2Q1pK2/3pPp2/1p1P2q1/7N/PPP3PP/8 b - - 10 35",
    solutionUci: "g4g7",
    theme: "Queen chase"
  }
];
