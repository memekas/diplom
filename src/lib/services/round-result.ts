import type { PrismaClient } from "@prisma/client";
import {
  type Side,
  type SetInput,
  setWinner,
  matchWinnerFromSets,
  tallySetsWon,
} from "./result";
import { materializeNextMexicanoRound } from "./mexicano";
import { transitionTournament } from "./tournament-status";

// --- FMT-03 / SCORE-01 round-based result recording ---
// recordRoundResult records a RoundMatch result for the round-based formats
// (round_robin / americano / mexicano). It is DELIBERATELY SEPARATE from the playoff
// `recordResult` (result.ts): playoff's step-9 auto-finish on nextMatchId==null and its
// SetScore/advancement model would misfire for round-based play (FORMATS.md §5). The two
// share ONLY the pure scoring core (setWinner / matchWinnerFromSets) via import.
//
// Mode dispatch (SCORE-01):
//   points → two arbitrary non-negative ints; round_robin forbids a draw (D2),
//            americano/mexicano allow a draw (winner = null);
//   sets   → per-set games validated by setWinner, collapsed to two sets-won integers
//            stored in pointsA/pointsB (per-set granularity is playoff-only).
//
// winner / sets-won are derived server-side from validated input — never accepted from
// the caller (T-09-16, mirrors recordResult T-05-01). Auth-free by design like result.ts;
// requireAdmin is the Plan 06 action boundary (T-09-21).

// Typed error so the Plan 06 action maps each reject to a friendly RU message without
// string-matching, never forwarding raw Prisma/internal text (T-09-19). `code` is the
// discriminant.
export class RoundResultError extends Error {
  constructor(
    public code:
      | "invalid_points"
      | "invalid_set"
      | "not_round_based"
      | "already_finished"
      | "stale_pairings"
      | "match_not_found",
    message: string,
  ) {
    super(message);
    this.name = "RoundResultError";
  }
}

export interface ScoreResult {
  pointsA: number;
  pointsB: number;
  winner: Side | null;
}

// POINTS mode (free-form): two arbitrary non-negative integers, NO target sum. A draw is
// legal for ALL round-based formats (winner = null) — draws are decided by format rules,
// not forbidden. More points wins; equal points → draw.
export function scorePointsMode(pointsA: number, pointsB: number): ScoreResult {
  if (
    !Number.isInteger(pointsA) ||
    !Number.isInteger(pointsB) ||
    pointsA < 0 ||
    pointsB < 0
  ) {
    throw new RoundResultError("invalid_points", `Недопустимый счёт: ${pointsA}:${pointsB}`);
  }
  const winner: Side | null = pointsA === pointsB ? null : pointsA > pointsB ? "A" : "B";
  return { pointsA, pointsB, winner };
}

// SETS mode (free-form): any number of sets, any non-negative integer games per set. Tally
// sets-won (more games wins a set) and derive the match winner (more sets, then total
// games). The result collapses to two sets-won integers stored in pointsA/pointsB (NO
// per-set rows for round-based — A1). A draw is allowed (winner = null) for round-based
// formats. Re-validates integers via setWinner (throws RoundResultError on bad input).
export function scoreSetsMode(sets: SetInput[]): ScoreResult {
  // Validate each set is a non-negative integer pair (setWinner throws otherwise).
  for (const s of sets) {
    try {
      setWinner(s.gamesPair1, s.gamesPair2);
    } catch {
      throw new RoundResultError(
        "invalid_set",
        `Недопустимый счёт сета: ${s.gamesPair1}:${s.gamesPair2}`,
      );
    }
  }
  const { setsWonA, setsWonB } = tallySetsWon(sets);
  const winner = matchWinnerFromSets(sets);
  return { pointsA: setsWonA, pointsB: setsWonB, winner };
}

// --- FMT-03 transactional recording (Task 2) ---
export type RecordRoundResultInput =
  | { pointsA: number; pointsB: number }
  | { sets: SetInput[] };

export interface RecordRoundResultSummary {
  roundMatchId: string;
  pointsA: number;
  pointsB: number;
  winner: Side | null;
  finished: boolean;
  nextRoundCreated: boolean;
}

export async function recordRoundResult(
  prisma: PrismaClient,
  roundMatchId: string,
  input: RecordRoundResultInput,
): Promise<RecordRoundResultSummary> {
  return prisma.$transaction(async (tx) => {
    // (1) Load the RoundMatch + its round + the tournament's format/scoring config
    // (DB-authoritative — the caller's claimed format/score is never trusted, T-09-17).
    const match = await tx.roundMatch.findUnique({
      where: { id: roundMatchId },
      select: {
        id: true,
        courtNumber: true,
        teamA1Id: true,
        teamA2Id: true,
        teamB1Id: true,
        teamB2Id: true,
        round: { select: { id: true, roundNumber: true, tournamentId: true } },
      },
    });
    if (!match) {
      throw new RoundResultError("match_not_found", "Матч раунда не найден");
    }
    const tournamentId = match.round.tournamentId;
    const tournament = await tx.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
      select: {
        format: true,
        scoringMode: true,
        totalRounds: true,
        status: true,
      },
    });

    // Playoff matches go through recordResult (result.ts), NEVER here — guarding against
    // a tampered roundMatchId pointing at a playoff context (T-09-17). round-based only.
    if (tournament.format === "playoff") {
      throw new RoundResultError(
        "not_round_based",
        "Этот матч не относится к round-based формату",
      );
    }

    // WR-02: mexicano materializes the NEXT round from the CUMULATIVE standings of the
    // round being recorded. Editing a score in round r after round r+1 already exists
    // would NOT re-derive round r+1's quad cut / cross-pairing (materialize-once guard),
    // leaving downstream pairings silently inconsistent with the corrected scores. Reject
    // such an edit so the inconsistency is a conscious, surfaced error rather than latent.
    if (tournament.format === "mexicano") {
      const successorExists = await tx.round.count({
        where: { tournamentId, roundNumber: { gt: match.round.roundNumber } },
      });
      if (successorExists > 0) {
        throw new RoundResultError(
          "stale_pairings",
          "Нельзя изменить результат раунда: следующий раунд уже сформирован",
        );
      }
    }

    // (2) Derive { pointsA, pointsB, winner } server-side by scoringMode.
    let scored: ScoreResult;
    if (tournament.scoringMode === "points") {
      if (!("pointsA" in input)) {
        throw new RoundResultError("invalid_points", "Ожидался счёт в очках");
      }
      scored = scorePointsMode(input.pointsA, input.pointsB);
    } else {
      if (!("sets" in input)) {
        throw new RoundResultError("invalid_set", "Ожидался счёт по сетам");
      }
      scored = scoreSetsMode(input.sets);
    }

    // (3) Persist the team scores on the RoundMatch.
    await tx.roundMatch.update({
      where: { id: roundMatchId },
      data: { pointsA: scored.pointsA, pointsB: scored.pointsB },
    });

    // (4) PlayerMatchScore fan-out (deleteMany → create, idempotent re-record; Pitfall 6 /
    // T-09-20). One row per non-null team FK: both partners of a team share the SAME team
    // pointsFor (=their team score), pointsAgainst = the opponent score.
    await tx.playerMatchScore.deleteMany({ where: { roundMatchId } });
    const fanout: { userId: string; teamSlot: "A" | "B"; pointsFor: number; pointsAgainst: number }[] = [];
    for (const uid of [match.teamA1Id, match.teamA2Id]) {
      if (uid) fanout.push({ userId: uid, teamSlot: "A", pointsFor: scored.pointsA, pointsAgainst: scored.pointsB });
    }
    for (const uid of [match.teamB1Id, match.teamB2Id]) {
      if (uid) fanout.push({ userId: uid, teamSlot: "B", pointsFor: scored.pointsB, pointsAgainst: scored.pointsA });
    }
    for (const row of fanout) {
      await tx.playerMatchScore.create({ data: { roundMatchId, ...row } });
    }

    // (5) Finish / materialization gate by format (FORMATS.md §5).
    let finished = false;
    let nextRoundCreated = false;

    if (tournament.format === "mexicano") {
      // Mexicano materializes ONE round at a time from cumulative standings. The
      // materialize helper does NOT know about totalRounds (it owns only the
      // round-complete + materialize-once gate), so recordRoundResult must NOT call it on
      // the last round — otherwise it would materialize a spurious round totalRounds+1.
      const isLastRound =
        tournament.totalRounds != null &&
        match.round.roundNumber >= tournament.totalRounds;

      if (!isLastRound) {
        const created = await materializeNextMexicanoRound(
          tx as unknown as PrismaClient,
          tournamentId,
          match.round.roundNumber,
        );
        nextRoundCreated = created !== null;
      } else {
        // Last round → finish when this round is fully recorded.
        const unrecordedThisRound = await tx.roundMatch.count({
          where: { roundId: match.round.id, OR: [{ pointsA: null }, { pointsB: null }] },
        });
        if (unrecordedThisRound === 0) {
          finished = await finishIfNotAlready(tx, tournamentId, tournament.status);
        }
      }
    } else {
      // round_robin / americano: all rounds are materialized up front. Auto-finish when
      // EVERY RoundMatch of EVERY round of the tournament is recorded.
      const unrecorded = await tx.roundMatch.count({
        where: {
          round: { tournamentId },
          OR: [{ pointsA: null }, { pointsB: null }],
        },
      });
      if (unrecorded === 0) {
        finished = await finishIfNotAlready(tx, tournamentId, tournament.status);
      }
    }

    return {
      roundMatchId,
      pointsA: scored.pointsA,
      pointsB: scored.pointsB,
      winner: scored.winner,
      finished,
      nextRoundCreated,
    };
  });
}

// Finish the tournament via the status machine, treating an already-"finished" tournament
// (re-record after the tournament closed) as a no-op (mirrors result.ts step 9 guard).
async function finishIfNotAlready(
  tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
  tournamentId: string,
  knownStatus: string,
): Promise<boolean> {
  if (knownStatus === "finished") return true;
  await transitionTournament(
    tx as unknown as PrismaClient,
    tournamentId,
    "in_progress",
    "finished",
  );
  return true;
}
