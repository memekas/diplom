import type { PrismaClient } from "@prisma/client";
import {
  type Side,
  type SetInput,
  setWinner,
  matchWinnerFromSets,
  ResultError,
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
      | "draw_not_allowed"
      | "bad_sum"
      | "invalid_set"
      | "no_winner"
      | "not_round_based"
      | "already_finished"
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

// POINTS mode (FORMATS.md §1/§2): two arbitrary non-negative integers. A draw is legal
// for americano/mexicano (winner = null) but rejected for round_robin (D2). The optional
// targetPoints check is ADVISORY (A5) — only enforced when the caller passes targetPoints.
export function scorePointsMode(
  pointsA: number,
  pointsB: number,
  format: string,
  targetPoints?: number | null,
): ScoreResult {
  if (
    !Number.isInteger(pointsA) ||
    !Number.isInteger(pointsB) ||
    pointsA < 0 ||
    pointsB < 0
  ) {
    throw new RoundResultError("invalid_points", `Недопустимый счёт: ${pointsA}:${pointsB}`);
  }
  if (format === "round_robin" && pointsA === pointsB) {
    throw new RoundResultError("draw_not_allowed", "Ничья в round-robin не допускается");
  }
  if (targetPoints != null && pointsA + pointsB !== targetPoints) {
    throw new RoundResultError("bad_sum", `Сумма очков должна быть ${targetPoints}`);
  }
  const winner: Side | null = pointsA === pointsB ? null : pointsA > pointsB ? "A" : "B";
  return { pointsA, pointsB, winner };
}

// SETS mode (FORMATS.md §1, 09-RESEARCH Code Examples): validate every per-set games pair
// via the shared setWinner, tally sets-won, derive the match winner via the shared
// matchWinnerFromSets. The result collapses to two sets-won integers stored in
// pointsA/pointsB (NO per-set rows for round-based — A1). Re-throws the pure core's
// ResultError("invalid_set") as RoundResultError("invalid_set"); a null winner (not enough
// decisive sets) becomes RoundResultError("no_winner").
export function scoreSetsMode(
  sets: SetInput[],
  gamesPerSet: number,
  setsPerMatch: number,
): ScoreResult {
  const perSet: Side[] = [];
  let setsWonA = 0;
  let setsWonB = 0;
  for (const s of sets) {
    let side: Side;
    try {
      side = setWinner(s.gamesPair1, s.gamesPair2, gamesPerSet);
    } catch (e) {
      if (e instanceof ResultError && e.code === "invalid_set") {
        throw new RoundResultError("invalid_set", e.message);
      }
      throw e;
    }
    perSet.push(side);
    if (side === "A") setsWonA++;
    else setsWonB++;
  }
  const winner = matchWinnerFromSets(perSet, setsPerMatch);
  if (winner === null) {
    throw new RoundResultError(
      "no_winner",
      "Недостаточно сыгранных сетов для определения победителя матча",
    );
  }
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
        gamesPerSet: true,
        setsPerMatch: true,
        targetPoints: true,
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

    // (2) Derive { pointsA, pointsB, winner } server-side by scoringMode.
    let scored: ScoreResult;
    if (tournament.scoringMode === "points") {
      if (!("pointsA" in input)) {
        throw new RoundResultError("invalid_points", "Ожидался счёт в очках");
      }
      scored = scorePointsMode(
        input.pointsA,
        input.pointsB,
        tournament.format,
        tournament.targetPoints,
      );
    } else {
      if (!("sets" in input)) {
        throw new RoundResultError("invalid_set", "Ожидался счёт по сетам");
      }
      scored = scoreSetsMode(input.sets, tournament.gamesPerSet, tournament.setsPerMatch);
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
      // Mexicano materializes ONE round at a time from cumulative standings. After
      // recording, try to materialize the next round (the helper gates on this round
      // being fully recorded and materialize-once). If we are on the last round and it is
      // fully recorded → finish.
      const created = await materializeNextMexicanoRound(
        tx as unknown as PrismaClient,
        tournamentId,
        match.round.roundNumber,
      );
      nextRoundCreated = created !== null;

      if (
        tournament.totalRounds != null &&
        match.round.roundNumber >= tournament.totalRounds
      ) {
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
