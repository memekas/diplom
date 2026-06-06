import type { PrismaClient } from "@prisma/client";
import { transitionTournament } from "./tournament-status";

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
    // (1) Load the match + its tournament's set/game config (DB-authoritative).
    const match = await tx.match.findUniqueOrThrow({
      where: { id: matchId },
      select: {
        id: true,
        tournamentId: true,
        pairAId: true,
        pairBId: true,
        nextMatchId: true,
        nextSlot: true,
        tournament: { select: { setsPerMatch: true, gamesPerSet: true } },
      },
    });
    const { setsPerMatch, gamesPerSet } = match.tournament;

    // (2) Reject if either opponent slot is unfilled — cannot record before the
    // opponents are decided (Pitfall 5, out-of-order; T-05-02).
    if (!match.pairAId || !match.pairBId) {
      throw new ResultError(
        "slots_unfilled",
        "Нельзя ввести результат: соперники ещё не определены",
      );
    }

    // (3) Reject empty input or more sets than the format allows.
    if (sets.length === 0) {
      throw new ResultError("empty", "Не указано ни одного сета");
    }
    if (sets.length > setsPerMatch) {
      throw new ResultError(
        "empty",
        `Слишком много сетов: максимум ${setsPerMatch}`,
      );
    }

    // (4) Validate each set via setWinner (re-throws invalid_set) and tally.
    const perSetWinners: Side[] = [];
    let setsWonA = 0;
    let setsWonB = 0;
    for (const s of sets) {
      const side = setWinner(s.gamesPair1, s.gamesPair2, gamesPerSet);
      perSetWinners.push(side);
      if (side === "A") setsWonA++;
      else setsWonB++;
    }

    // (5) Derive the match winner; reject if not enough decisive sets.
    const winnerSide = matchWinnerFromSets(perSetWinners, setsPerMatch);
    if (winnerSide === null) {
      throw new ResultError(
        "no_winner",
        "Недостаточно сыгранных сетов для определения победителя матча",
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
