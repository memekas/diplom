// --- BRKT-01 bracket core ---
// The slot-arithmetic is a single pure function (Pitfall 1: off-by-one slot math is
// solved ONCE here and tested exhaustively, never re-derived per call site). Counts
// are table-driven (Pitfall 2: NO log2 — float/off-by-one risk on power-of-two sizes).

export type Slot = "A" | "B";

// Given a match at (round, position), where does its winner go? The parent match is
// in round+1 at floor(position/2); even positions feed slot A, odd feed slot B.
// Prisma-free — the math is framework-agnostic so the test imports it without a DB.
export function advance(
  round: number,
  position: number,
): { round: number; position: number; slot: Slot } {
  return {
    round: round + 1,
    position: Math.floor(position / 2),
    slot: position % 2 === 0 ? "A" : "B",
  };
}

// Matches per round, round-1 first. size is always a power of two (4/8/16 — no byes).
// Derived as a fixed table, NOT computed via log2 (Pitfall 2).
export const ROUNDS: Record<number, number[]> = {
  4: [2, 1],
  8: [4, 2, 1],
  16: [8, 4, 2, 1],
};

// A single-elimination bracket of `size` pairs has size-1 matches total.
export function matchCount(size: number): number {
  return size - 1;
}
