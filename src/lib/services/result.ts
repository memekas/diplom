import type { PrismaClient } from "@prisma/client";
import { transitionTournament } from "./tournament-status";

// --- MATCH-01 / MATCH-02 free-form scoring core ---
// Pure, Prisma-free scoring functions. Scores are FULLY FREE-FORM: any two non-negative
// integers per set, any number of sets, no tennis set-validity (no win-by-2 / 7:5 / 7:6),
// no target. The set-winner rule (more games) and the match-winner rule (more sets, then
// total games) live ONCE here.

export type Side = "A" | "B";

// Typed error so Plan 02/03 map each reject to a friendly RU message without
// string-matching, and never forward raw internal text. `code` is the discriminant.
export class ResultError extends Error {
  constructor(
    public code: "invalid_set" | "slots_unfilled" | "no_winner" | "empty" | "draw",
    message: string,
  ) {
    super(message);
    this.name = "ResultError";
  }
}

/**
 * Decide a single set by games: more games wins. Returns "A" / "B", or null on a tie
 * (equal games → no set winner). Throws ResultError("invalid_set") only for non-integer
 * or negative input — any non-negative integer pair (4:5, 6:6, 10:3) is accepted.
 */
export function setWinner(gamesA: number, gamesB: number): Side | null {
  if (
    !Number.isInteger(gamesA) ||
    !Number.isInteger(gamesB) ||
    gamesA < 0 ||
    gamesB < 0
  ) {
    throw new ResultError("invalid_set", `Недопустимый счёт сета: ${gamesA}:${gamesB}`);
  }
  if (gamesA > gamesB) return "A";
  if (gamesB > gamesA) return "B";
  return null; // tied set
}

/**
 * Decide the match from per-set scores (free-form): more sets won wins; a tie in sets won
 * is broken by total games across all sets; still equal → null (draw). MATCH-02.
 */
export function matchWinnerFromSets(sets: { gamesPair1: number; gamesPair2: number }[]): Side | null {
  let setsA = 0;
  let setsB = 0;
  let gamesA = 0;
  let gamesB = 0;
  for (const s of sets) {
    const w = setWinner(s.gamesPair1, s.gamesPair2);
    if (w === "A") setsA++;
    else if (w === "B") setsB++;
    gamesA += s.gamesPair1;
    gamesB += s.gamesPair2;
  }
  if (setsA > setsB) return "A";
  if (setsB > setsA) return "B";
  // Tie in sets won → decide by total games.
  if (gamesA > gamesB) return "A";
  if (gamesB > gamesA) return "B";
  return null; // draw
}

/** Count sets won by each side (free-form: more games wins a set; ties count for neither). */
export function tallySetsWon(sets: { gamesPair1: number; gamesPair2: number }[]): {
  setsWonA: number;
  setsWonB: number;
} {
  let setsWonA = 0;
  let setsWonB = 0;
  for (const s of sets) {
    const w = setWinner(s.gamesPair1, s.gamesPair2);
    if (w === "A") setsWonA++;
    else if (w === "B") setsWonB++;
  }
  return { setsWonA, setsWonB };
}

// --- MATCH-02/03/04/05 transactional result recording + advancement ---
// recordResult records (or re-records) a match result in ONE transaction: load the
// match + its tournament's setsPerMatch/gamesPerSet (DB-authoritative), validate every
// set via setWinner, derive the match winner via matchWinnerFromSets, persist the
// SetScores + cached setsWonA/B + winnerId, advance the winner into the pre-existing
// parent slot (an UPDATE — Phase 4 already wired nextMatchId/nextSlot), and finish the
// tournament on the final. Any throw rolls back the whole transaction — no orphan
// SetScores, no half-advanced parent (mirrors generateBracket; T-05-03).
//
// winnerId is derived server-side and constrained ∈ {pairAId, pairBId} — never accepted
// from a caller (T-05-01). Auth-free by design (like bracket.ts); requireAdmin is the
// Plan 03 action boundary (T-05-04).
export interface SetInput {
  gamesPair1: number;
  gamesPair2: number;
}
export interface RecordResultSummary {
  matchId: string;
  winnerId: string;
  setsWonA: number;
  setsWonB: number;
  finished: boolean;
}

export async function recordResult(
  prisma: PrismaClient,
  matchId: string,
  sets: SetInput[],
): Promise<RecordResultSummary> {
  return prisma.$transaction(async (tx) => {
    // (1) Load the match (DB-authoritative). No set/game config is read — scoring is free-form.
    const match = await tx.match.findUniqueOrThrow({
      where: { id: matchId },
      select: {
        id: true,
        tournamentId: true,
        pairAId: true,
        pairBId: true,
        nextMatchId: true,
        nextSlot: true,
      },
    });

    // (2) Reject if either opponent slot is unfilled — cannot record before the
    // opponents are decided (Pitfall 5, out-of-order; T-05-02).
    if (!match.pairAId || !match.pairBId) {
      throw new ResultError(
        "slots_unfilled",
        "Нельзя ввести результат: соперники ещё не определены",
      );
    }

    // (3) Reject empty input. Any number of sets is accepted — no upper cap.
    if (sets.length === 0) {
      throw new ResultError("empty", "Не указано ни одного сета");
    }

    // (4) Tally sets won (free-form: more games wins a set; ties count for neither).
    const { setsWonA, setsWonB } = tallySetsWon(sets);

    // (5) Derive the match winner (more sets, then total games). PLAYOFF requires a
    // decisive winner — a draw cannot advance, so reject it.
    const winnerSide = matchWinnerFromSets(sets);
    if (winnerSide === null) {
      throw new ResultError(
        "draw",
        "Ничья недопустима в playoff — введите решающий счёт",
      );
    }
    const winnerId = winnerSide === "A" ? match.pairAId : match.pairBId;
    // Defensive: winnerId is ∈ {pairAId, pairBId} by construction (T-05-01).
    if (winnerId !== match.pairAId && winnerId !== match.pairBId) {
      throw new ResultError("no_winner", "Внутренняя ошибка: победитель не из пары матча");
    }

    // (6) Replace all SetScores (free edit — MATCH-04): delete then insert 1..n.
    await tx.setScore.deleteMany({ where: { matchId } });
    for (let i = 0; i < sets.length; i++) {
      await tx.setScore.create({
        data: {
          matchId,
          setNumber: i + 1,
          gamesPair1: sets[i].gamesPair1,
          gamesPair2: sets[i].gamesPair2,
        },
      });
    }

    // (7) Persist cached counts + winnerId on this match.
    await tx.match.update({
      where: { id: matchId },
      data: { setsWonA, setsWonB, winnerId },
    });

    // (8) Advancement (MATCH-02): write the winner into the pre-existing parent slot.
    // An UPDATE (Phase 4 created the parent). On a re-record this overwrites the slot
    // with the (possibly new) winner — re-propagation to the IMMEDIATE parent only;
    // downstream cascade cleanup is OUT OF SCOPE (accepted).
    if (match.nextMatchId) {
      await tx.match.update({
        where: { id: match.nextMatchId },
        data: match.nextSlot === "A" ? { pairAId: winnerId } : { pairBId: winnerId },
      });
    }

    // (9) Final (MATCH-03): no parent → finish the tournament. On a re-record of an
    // already-finished tournament, transitionTournament would reject the stale `from`
    // — guard by re-reading status and treating already-"finished" as a no-op.
    let finished = false;
    if (!match.nextMatchId) {
      const trn = await tx.tournament.findUniqueOrThrow({
        where: { id: match.tournamentId },
        select: { status: true },
      });
      if (trn.status === "finished") {
        finished = true; // already finished (re-record of the final) — no-op transition.
      } else {
        await transitionTournament(
          tx as unknown as PrismaClient,
          match.tournamentId,
          "in_progress",
          "finished",
        );
        finished = true;
      }
    }

    return { matchId, winnerId, setsWonA, setsWonB, finished };
  });
}
