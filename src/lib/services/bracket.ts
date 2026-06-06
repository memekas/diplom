import type { PrismaClient } from "@prisma/client";
import { transitionTournament } from "./tournament-status";

// --- BRKT-01 bracket core ---
// The slot-arithmetic is a single pure function (Pitfall 1: off-by-one slot math is
// solved ONCE here and tested exhaustively, never re-derived per call site). Counts
// are table-driven (Pitfall 2: NO log2 — float/off-by-one risk on power-of-two sizes).

export type Slot = "A" | "B";

// Typed error so the Server Action maps each reject to a friendly RU message without
// string-matching, and never forwards raw Prisma/internal error text (WR-02). Every
// generation reject throws this; nothing is persisted on any reject (transaction rolls back).
export class BracketError extends Error {
  constructor(
    public code: "not_open" | "bad_size" | "wrong_count" | "already_generated",
    message: string,
  ) {
    super(message);
    this.name = "BracketError";
  }
}

// Prisma unique-constraint violation guard (P2002) — used as the concurrency backstop
// for generate-once (WR-01): the @@unique([tournamentId, round, position]) on Match means
// a second concurrent Старт that slipped past the count===0 guard fails at create time.
function isUniqueViolation(e: unknown): boolean {
  return !!e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002";
}

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

// Fisher–Yates in-place shuffle on a copy. Math.random is acceptable here — this is a
// runtime service (not a deterministic workflow script); the draw is meant to be random.
function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// BRKT-01 / BRKT-03: generate the full single-elimination tree in ONE transaction.
// The DB is the source of truth — status, pair count, and existing-match guards are
// re-read inside the transaction so the caller (Server Action, Plan 02) cannot bypass
// them. Any throw rolls back the whole transaction: no partial bracket, no seeds
// without matches (Pitfall 1/2/3). Generate-once is enforced at the data layer.
export async function generateBracket(prisma: PrismaClient, tournamentId: string) {
  return prisma.$transaction(async (tx) => {
    // (1) Re-read tournament — must be open for registration.
    const tournament = await tx.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
      select: { id: true, status: true, size: true },
    });
    if (tournament.status !== "registration") {
      throw new BracketError("not_open", `Нельзя сгенерировать сетку: турнир в статусе "${tournament.status}"`);
    }

    const size = tournament.size;
    const rounds = ROUNDS[size];
    // (2) size must be a supported power of two AND pair count must match exactly.
    if (!rounds) {
      throw new BracketError("bad_size", `Недопустимый размер турнира: ${size} (ожидается 4, 8 или 16)`);
    }
    const pairCount = await tx.pair.count({ where: { tournamentId } });
    if (pairCount !== size) {
      throw new BracketError("wrong_count", `Нужно ровно ${size} пар для старта (зарегистрировано ${pairCount})`);
    }

    // (3) Immutability (BRKT-03): refuse if any match already exists — no re-shuffle,
    // no re-generation once the bracket has been drawn. The @@unique([tournamentId,
    // round, position]) constraint backstops this against a concurrent double-Старт.
    const existing = await tx.match.count({ where: { tournamentId } });
    if (existing > 0) {
      throw new BracketError("already_generated", "Сетка уже сгенерирована — повторная генерация запрещена");
    }

    // (4) Load pairs, Fisher–Yates shuffle, assign seed 1..size in shuffled order.
    const pairs = await tx.pair.findMany({
      where: { tournamentId },
      select: { id: true },
    });
    const shuffled = shuffle(pairs);
    for (let i = 0; i < shuffled.length; i++) {
      await tx.pair.update({
        where: { id: shuffled[i].id },
        data: { seed: i + 1 },
      });
    }

    // (5) Create matches FINAL-FIRST (round high → low) so each child links to an
    // already-created parent id. matchIdsByRound[round][position] = match id.
    const matchIdsByRound: Record<number, Record<number, string>> = {};
    const finalRound = rounds.length;
    for (let round = finalRound; round >= 1; round--) {
      const countInRound = rounds[round - 1];
      matchIdsByRound[round] = {};
      for (let position = 0; position < countInRound; position++) {
        let nextMatchId: string | null = null;
        let nextSlot: string | null = null;
        if (round < finalRound) {
          const parent = advance(round, position);
          nextMatchId = matchIdsByRound[parent.round][parent.position];
          nextSlot = parent.slot;
        }
        // (6) Round-1 matches get two distinct shuffled pairs; later rounds null (TBD).
        let pairAId: string | null = null;
        let pairBId: string | null = null;
        if (round === 1) {
          pairAId = shuffled[position * 2].id;
          pairBId = shuffled[position * 2 + 1].id;
        }
        let created;
        try {
          created = await tx.match.create({
            data: {
              tournamentId,
              round,
              position,
              pairAId,
              pairBId,
              nextMatchId,
              nextSlot,
            },
            select: { id: true },
          });
        } catch (e) {
          // Concurrency backstop (WR-01): a parallel Старт already created this slot.
          if (isUniqueViolation(e)) {
            throw new BracketError("already_generated", "Сетка уже сгенерирована — повторная генерация запрещена");
          }
          throw e;
        }
        matchIdsByRound[round][position] = created.id;
      }
    }

    // (7) Flip status registration → in_progress via the single status machine
    // (BRKT-01). transitionTournament re-reads + guards the edge inside this same tx.
    await transitionTournament(tx as unknown as PrismaClient, tournamentId, "registration", "in_progress");

    return { tournamentId, matchesCreated: matchCount(size) };
  });
}

// BRKT-02 public read path. ONE findMany ordered round→position, selecting only pair
// player display names (no PII — mirrors listTournamentPairs' safe select, T-04-06).
// Returns the flattened shape BracketView consumes: pair names joined "name1 / name2"
// or null for unfilled (TBD) slots. Anon-viewable — no auth guard (BRKT-02).
export async function listBracket(prisma: PrismaClient, tournamentId: string) {
  const matches = await prisma.match.findMany({
    where: { tournamentId },
    orderBy: [{ round: "asc" }, { position: "asc" }],
    select: {
      id: true,
      round: true,
      position: true,
      pairAId: true,
      pairBId: true,
      winnerId: true,
      pairA: {
        select: { player1: { select: { name: true } }, player2: { select: { name: true } } },
      },
      pairB: {
        select: { player1: { select: { name: true } }, player2: { select: { name: true } } },
      },
    },
  });

  const pairName = (
    pair: { player1: { name: string }; player2: { name: string } } | null,
  ): string | null => (pair ? `${pair.player1.name} / ${pair.player2.name}` : null);

  return matches.map((m) => ({
    id: m.id,
    round: m.round,
    position: m.position,
    pairAId: m.pairAId,
    pairBId: m.pairBId,
    pairAName: pairName(m.pairA),
    pairBName: pairName(m.pairB),
    winnerId: m.winnerId,
  }));
}
