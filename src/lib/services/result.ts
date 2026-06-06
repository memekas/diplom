// --- MATCH-01 / MATCH-02 scoring core ---
// Pure, Prisma-free tennis-scoring functions. Isolated so they are exhaustively
// unit-testable before any transaction (Plan 02 recordResult) or UI (Plan 03) leans on
// them — exactly the bracket.ts pattern. The set-validation rule (win-by-2 or 7:6) and
// the match-winner-derivation rule (first to a majority of sets) live ONCE here, never
// re-derived per call site.

export type Side = "A" | "B";

// Typed error so Plan 02/03 map each reject to a friendly RU message without
// string-matching, and never forward raw internal text. `code` is the discriminant.
// Codes slots_unfilled / no_winner / empty are reserved for Plan 02's recordResult;
// invalid_set is the only code thrown by this module.
export class ResultError extends Error {
  constructor(
    public code: "invalid_set" | "slots_unfilled" | "no_winner" | "empty",
    message: string,
  ) {
    super(message);
    this.name = "ResultError";
  }
}

// A set is valid+won when the winner reaches its score with a legal margin:
//   (a) winner === gamesPerSet AND margin >= 2          — e.g. 6:0 … 6:4 (gps 6);
//   (b) winner === gamesPerSet+1 AND loser === gamesPerSet-1 (margin 2) — e.g. 7:5;
//   (c) tiebreak: winner === gamesPerSet+1 AND loser === gamesPerSet    — e.g. 7:6.
// Everything else (6:5 margin<2, 8:6 overshoot, 7:7 tie, negatives, non-integers) is invalid.
function isValidSet(hi: number, lo: number, gamesPerSet: number): boolean {
  const cleanWin = hi === gamesPerSet && hi - lo >= 2;
  const extendedWin = hi === gamesPerSet + 1 && lo === gamesPerSet - 1;
  const tiebreak = hi === gamesPerSet + 1 && lo === gamesPerSet;
  return cleanWin || extendedWin || tiebreak;
}

/**
 * Decide a single set. Returns "A" if gamesA is the winning side, "B" if gamesB is.
 * Throws ResultError("invalid_set", ...) for any score that is not a valid won set
 * (margin < 2 at gamesPerSet, overshoot, tie, negatives, non-integers). MATCH-01.
 */
export function setWinner(gamesA: number, gamesB: number, gamesPerSet: number): Side {
  if (
    !Number.isInteger(gamesA) ||
    !Number.isInteger(gamesB) ||
    gamesA < 0 ||
    gamesB < 0
  ) {
    throw new ResultError("invalid_set", `Недопустимый счёт сета: ${gamesA}:${gamesB}`);
  }
  if (gamesA > gamesB && isValidSet(gamesA, gamesB, gamesPerSet)) return "A";
  if (gamesB > gamesA && isValidSet(gamesB, gamesA, gamesPerSet)) return "B";
  throw new ResultError("invalid_set", `Недопустимый счёт сета: ${gamesA}:${gamesB}`);
}

/**
 * Decide the match: the first side to reach ceil(setsPerMatch/2) set wins. Returns null
 * when neither side has a majority yet (undecided — recordResult decides if null rejects).
 * Trailing sets beyond a decided match are tolerated by simple counting. MATCH-02.
 */
export function matchWinnerFromSets(setWins: Side[], setsPerMatch: number): Side | null {
  const needed = Math.ceil(setsPerMatch / 2);
  let a = 0;
  let b = 0;
  for (const w of setWins) {
    if (w === "A") a++;
    else b++;
  }
  if (a >= needed) return "A";
  if (b >= needed) return "B";
  return null;
}
