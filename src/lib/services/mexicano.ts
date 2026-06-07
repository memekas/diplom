import type { PrismaClient } from "@prisma/client";
import { transitionTournament } from "./tournament-status";
import { rankPlayers } from "./standings";

// --- FMT-02 mexicano core ---
// Mexicano is the ONLY format that materializes rounds ONE AT A TIME (FORMATS.md §0):
// Round 1 is a random baseline (shuffle → consecutive quads), and each later round is
// derived from the CUMULATIVE standings of the previous round (re-sort by points → cut
// into consecutive quads by rank → cross-pair "1+4 vs 2+3"). The cut/cross-pair math is
// kept as pure Prisma-free functions (the established advance()/setWinner() discipline)
// so determinism is unit-tested without a DB — load-bearing because equal-points players
// must produce a reproducible quad cut (Pitfall / T-09-14).

// Typed error so the Server Action (Plan 06) maps each reject to a friendly RU message
// without string-matching, never forwarding raw Prisma/internal text. Declared locally
// (NOT cross-imported from americano.ts) so the services stay decoupled. Adds
// "round_incomplete" for the materialize gate.
export class FormatError extends Error {
  constructor(
    public code:
      | "not_open"
      | "wrong_format"
      | "already_generated"
      | "no_units"
      | "round_incomplete",
    message: string,
  ) {
    super(message);
    this.name = "FormatError";
  }
}

// Prisma unique-constraint violation guard (P2002) — concurrency backstop for
// materialize-once: a second concurrent materialization that slipped past the
// existing-Round check fails at create time on @@unique([tournamentId, roundNumber]).
function isUniqueViolation(e: unknown): boolean {
  return !!e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002";
}

// Fisher–Yates in-place shuffle on a copy. Math.random is acceptable — this is a runtime
// service, the Round-1 draw is meant to be random. Copied from bracket.ts / americano.ts.
function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface QuadAssignment {
  courtNumber: number;
  teamA: [string, string];
  teamB: [string, string];
}

// Cut an ordered id list into CONSECUTIVE quads: group g = ids[4g..4g+3] (FORMATS.md §3
// step 3). courtNumber = g (0-based, court g+1 in the UI). A remainder of <4 ids does NOT
// form a court — those players sit out this round (mexicano sizes are multiples of 4 by
// design, but the remainder is dropped cleanly for robustness). Prisma-free, deterministic.
export function quadCut(ids: string[]): { courtNumber: number; quad: [string, string, string, string] }[] {
  const out: { courtNumber: number; quad: [string, string, string, string] }[] = [];
  const fullQuads = Math.floor(ids.length / 4);
  for (let g = 0; g < fullQuads; g++) {
    const base = g * 4;
    out.push({
      courtNumber: g,
      quad: [ids[base], ids[base + 1], ids[base + 2], ids[base + 3]],
    });
  }
  return out;
}

// Cross-pair WITHIN a rank-ordered quad (s0<s1<s2<s3 by rating) — LOCKED D1 "1+4 vs 2+3":
//   teamA = (s0, s3), teamB = (s1, s2)   → rank sums 1+4 = 2+3 = 5, EVEN teams.
// (The alternative "1+3 vs 2+4" is documented but NOT chosen — D1 in FORMATS.md.)
export function crossPairQuad(quad: [string, string, string, string]): {
  teamA: [string, string];
  teamB: [string, string];
} {
  return {
    teamA: [quad[0], quad[3]],
    teamB: [quad[1], quad[2]],
  };
}

// Round-1 baseline cut: NO cross-pair. Each consecutive quad [q0,q1,q2,q3] →
// teamA = (q0, q1), teamB = (q2, q3); court = quad index (FORMATS.md §3 Round 1).
export function round1Cut(ids: string[]): QuadAssignment[] {
  return quadCut(ids).map(({ courtNumber, quad }) => ({
    courtNumber,
    teamA: [quad[0], quad[1]],
    teamB: [quad[2], quad[3]],
  }));
}

// Apply rank-driven cross-pairing to an ordered id list: cut into consecutive quads then
// cross-pair "1+4 vs 2+3" within each. Used for rounds 2..R (FORMATS.md §3 steps 3-4).
export function crossPairCut(rankedIds: string[]): QuadAssignment[] {
  return quadCut(rankedIds).map(({ courtNumber, quad }) => {
    const { teamA, teamB } = crossPairQuad(quad);
    return { courtNumber, teamA, teamB };
  });
}

// FMT-02: generate ONLY Round 1 of a mexicano tournament in ONE transaction (mexicano
// materializes later rounds one at a time — Round 1 is the random baseline). The DB is
// the source of truth — status, format, and the generate-once guard are re-read inside
// the transaction so the caller (Server Action, Plan 06) cannot bypass them. Any throw
// rolls back: no partial state. Mexicano is ALWAYS singles (read TournamentPlayer).
export async function generateMexicanoRound1(prisma: PrismaClient, tournamentId: string) {
  return prisma.$transaction(async (tx) => {
    // (1) Re-read tournament — must be open for registration AND be mexicano.
    const tournament = await tx.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
      select: { id: true, status: true, format: true },
    });
    if (tournament.status !== "registration") {
      throw new FormatError("not_open", `Нельзя сгенерировать расписание: турнир в статусе "${tournament.status}"`);
    }
    if (tournament.format !== "mexicano") {
      throw new FormatError("wrong_format", `Формат турнира не мексикано: "${tournament.format}"`);
    }

    // (2) Generate-once: refuse if any round already exists. @@unique([tournamentId,
    // roundNumber]) on Round backstops this against a concurrent double-Старт.
    const existing = await tx.round.count({ where: { tournamentId } });
    if (existing > 0) {
      throw new FormatError("already_generated", "Расписание уже сгенерировано — повторная генерация запрещена");
    }

    // (3) Load players (mexicano = singles; read TournamentPlayer, never Pair).
    // Mexicano minimum is 8 (FORMATS.md §3 size: N≥8) — needs ≥2 quads to be meaningful.
    const players = await tx.tournamentPlayer.findMany({
      where: { tournamentId },
      select: { userId: true },
    });
    if (players.length < 8) {
      throw new FormatError("no_units", "Недостаточно игроков для старта мексикано (нужно минимум 8)");
    }

    // (4) Shuffle ONCE, then cut the baseline Round-1 quads (no cross-pair).
    const courts = round1Cut(shuffle(players.map((p) => p.userId)));

    // (5) Persist ONLY Round 1 + its RoundMatch (one per court).
    const round = await tx.round.create({
      data: { tournamentId, roundNumber: 1 },
      select: { id: true },
    });
    let matchesCreated = 0;
    for (const c of courts) {
      await tx.roundMatch.create({
        data: {
          roundId: round.id,
          courtNumber: c.courtNumber,
          teamA1Id: c.teamA[0],
          teamA2Id: c.teamA[1],
          teamB1Id: c.teamB[0],
          teamB2Id: c.teamB[1],
        },
      });
      matchesCreated++;
    }

    // (6) Flip status registration → in_progress via the single status machine.
    await transitionTournament(tx as unknown as PrismaClient, tournamentId, "registration", "in_progress");

    return { tournamentId, roundsCreated: 1, matchesCreated };
  });
}

// FMT-02: materialize the NEXT mexicano round (completedRoundNumber + 1) from cumulative
// standings. Called from INSIDE recordRoundResult's transaction (Plan 05) — accepts a
// PrismaClient-compatible tx and does NOT open its own $transaction (mirrors
// transitionTournament). Returns the created round number, or null when nothing was
// materialized (gate not satisfied, or already materialized).
//
// ⚠️ This does NOT handle "finish on the last round" — recordRoundResult (Plan 05) owns
// that by comparing completedRoundNumber+1 against totalRounds.
export async function materializeNextMexicanoRound(
  tx: PrismaClient,
  tournamentId: string,
  completedRoundNumber: number,
): Promise<{ createdRoundNumber: number } | null> {
  const nextRoundNumber = completedRoundNumber + 1;

  // (1) GATE — the just-completed round must be FULLY recorded. Count its RoundMatch with
  // a null score; if any are unrecorded, do not materialize (return null — caller decides).
  const completedRound = await tx.round.findUnique({
    where: { tournamentId_roundNumber: { tournamentId, roundNumber: completedRoundNumber } },
    select: { id: true },
  });
  if (!completedRound) return null; // nothing to materialize from
  const unrecorded = await tx.roundMatch.count({
    where: {
      roundId: completedRound.id,
      OR: [{ pointsA: null }, { pointsB: null }],
    },
  });
  if (unrecorded > 0) return null; // round not complete → gate closed

  // (2) MATERIALIZE-ONCE — if the next round already exists, do nothing.
  const alreadyNext = await tx.round.count({
    where: { tournamentId, roundNumber: nextRoundNumber },
  });
  if (alreadyNext > 0) return null;

  // (3) Re-compute the deterministic player ranking from cumulative individual scores.
  // Aggregate PlayerMatchScore exactly as computeStandings does, then rankPlayers (the
  // shared sort whose final userId-asc tiebreak makes the cut reproducible — T-09-14).
  const rounds = await tx.round.findMany({
    where: { tournamentId },
    select: {
      matches: {
        select: {
          playerScores: {
            select: { userId: true, pointsFor: true, pointsAgainst: true },
          },
        },
      },
    },
  });
  const acc = new Map<
    string,
    { userId: string; sumFor: number; sumAgainst: number; wins: number; played: number }
  >();
  for (const round of rounds) {
    for (const m of round.matches) {
      for (const ps of m.playerScores) {
        const row =
          acc.get(ps.userId) ??
          { userId: ps.userId, sumFor: 0, sumAgainst: 0, wins: 0, played: 0 };
        row.sumFor += ps.pointsFor;
        row.sumAgainst += ps.pointsAgainst;
        row.played += 1;
        if (ps.pointsFor > ps.pointsAgainst) row.wins += 1;
        acc.set(ps.userId, row);
      }
    }
  }
  const ranked = rankPlayers([...acc.values()]).map((p) => p.userId);

  // (4) Cut into consecutive quads by rank, cross-pair "1+4 vs 2+3" (LOCKED D1).
  const courts = crossPairCut(ranked);

  // (5) Persist the next Round + its RoundMatch. P2002 backstops the materialize-once
  // race (a concurrent materialization created the same roundNumber first → return null).
  try {
    const round = await tx.round.create({
      data: { tournamentId, roundNumber: nextRoundNumber },
      select: { id: true },
    });
    for (const c of courts) {
      await tx.roundMatch.create({
        data: {
          roundId: round.id,
          courtNumber: c.courtNumber,
          teamA1Id: c.teamA[0],
          teamA2Id: c.teamA[1],
          teamB1Id: c.teamB[0],
          teamB2Id: c.teamB[1],
        },
      });
    }
  } catch (e) {
    if (isUniqueViolation(e)) return null;
    throw e;
  }

  return { createdRoundNumber: nextRoundNumber };
}
