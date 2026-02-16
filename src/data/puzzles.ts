export interface PuzzleDefinition {
  id: string;
  fen: string;
  bestMove: string;
  choices: string[];
  theme: string;
  lineHint: string;
}

export const MEMORY_PUZZLES: PuzzleDefinition[] = [
  {
    id: "puzzle-001",
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 3",
    bestMove: "Bxf7+",
    choices: ["Bxf7+", "Nc3", "O-O", "d4"],
    theme: "Italian tactical shot",
    lineHint: "Sacrifice to gain king activity."
  },
  {
    id: "puzzle-002",
    fen: "r1bq1rk1/ppp2ppp/2n2n2/2bp4/2B5/2N1PN2/PPQ2PPP/R1B2RK1 w - - 0 8",
    bestMove: "Nxd5",
    choices: ["Nxd5", "Rd1", "a3", "b3"],
    theme: "Center tactic",
    lineHint: "Exploit pinned piece and overloaded defender."
  },
  {
    id: "puzzle-003",
    fen: "2r2rk1/pp2qppp/2n1pn2/2bp4/4P3/2NP1N2/PPQ2PPP/2R2RK1 w - - 4 12",
    bestMove: "Nxd5",
    choices: ["Nxd5", "e5", "Qa4", "Rfd1"],
    theme: "Static weakness conversion",
    lineHint: "Use a tactical trade to improve piece placement."
  },
  {
    id: "puzzle-004",
    fen: "4r1k1/1pp2ppp/p1n5/3N4/1b1P4/1B3N2/PP3PPP/3R2K1 w - - 0 20",
    bestMove: "Nxb4",
    choices: ["Nxb4", "Nf6+", "Bd2", "a3"],
    theme: "Loose piece pickup",
    lineHint: "Find the undefended piece before calculating checks."
  },
  {
    id: "puzzle-005",
    fen: "2r2rk1/pp1n1ppp/2pbpn2/q2p4/3P4/2NBPN2/PPQ2PPP/2RR2K1 w - - 2 11",
    bestMove: "e4",
    choices: ["e4", "a3", "Ne5", "Qe2"],
    theme: "Space gain and tactical threat",
    lineHint: "Push with tempo and open tactical lines."
  }
];

export const CALCULATION_PUZZLES: PuzzleDefinition[] = [
  {
    id: "calc-001",
    fen: "r2q1rk1/ppp2ppp/2n2n2/2bp4/2B5/2N2N2/PPQ2PPP/R1B2RK1 w - - 2 9",
    bestMove: "Nxd5",
    choices: ["Nxd5", "Rd1", "a3", "Bd2"],
    theme: "Intermediate exchange sequence",
    lineHint: "Calculate captures and recaptures to depth 3."
  },
  {
    id: "calc-002",
    fen: "2r2rk1/pp3ppp/2n1pn2/2bp4/3P4/2NBPN2/PP3PPP/2RR2K1 w - - 0 13",
    bestMove: "Nxd5",
    choices: ["Nxd5", "dxc5", "a3", "Qe2"],
    theme: "Central break timing",
    lineHint: "Visualize whether the center resolves favorably."
  },
  {
    id: "calc-003",
    fen: "r1b2rk1/pp3ppp/2n1pn2/2bp4/2P5/2N1PN2/PP2BPPP/R1BQ1RK1 w - - 0 9",
    bestMove: "cxd5",
    choices: ["cxd5", "a3", "b3", "Qa4"],
    theme: "Structural conversion",
    lineHint: "Compute forcing line before committing."
  }
];
