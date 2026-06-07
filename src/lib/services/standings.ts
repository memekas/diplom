import type { PrismaClient } from "@prisma/client";

// computeStandings (FMT-02/FMT-03) — DERIVED standings, never materialized. For
// americano/mexicano it ranks INDIVIDUAL players (sum of personal points); for
// round_robin it builds a UNIT table (pair or player). Everything is computed from
// RoundMatch + PlayerMatchScore on every call (CONTEXT: standings computed, not
// stored — recomputing avoids drift and is what the mexicano quad cut reads).
//
// Determinism is load-bearing: the rankPlayers tiebreak chain MUST terminate in a
// stable userId comparison so the mexicano next-round cut (Plan 04) is reproducible
// (Pitfall 2 / threat T-09-11).

export type PlayerStanding = {
  userId: string;
  rank: number; // 1-based
  played: number;
  wins: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
};

export type UnitStanding = {
  unitId: string; // Pair.id (pairs) or userId (singles)
  kind: "pair" | "user";
  rank: number; // 1-based
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
};

// Pure rating sort for americano/mexicano. Tiebreak chain (CONTEXT / 09-RESEARCH):
//   sumFor desc → pointDiff (sumFor−sumAgainst) desc → wins desc → userId asc.
// The final userId-asc key is the stable deterministic fallback the mexicano cut
// relies on. Does NOT mutate the input (sorts a copy).
export function rankPlayers(
  rows: { userId: string; sumFor: number; sumAgainst: number; wins: number; played: number }[],
): PlayerStanding[] {
  return [...rows]
    .sort((a, b) => {
      if (b.sumFor !== a.sumFor) return b.sumFor - a.sumFor;
      const da = a.sumFor - a.sumAgainst;
      const db = b.sumFor - b.sumAgainst;
      if (db !== da) return db - da;
      if (b.wins !== a.wins) return b.wins - a.wins;
      // Stable deterministic fallback — string compare on userId (ascending).
      return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
    })
    .map((r, i) => ({
      userId: r.userId,
      rank: i + 1,
      played: r.played,
      wins: r.wins,
      pointsFor: r.sumFor,
      pointsAgainst: r.sumAgainst,
      pointDiff: r.sumFor - r.sumAgainst,
    }));
}

// Pure unit-table sort for round_robin. Chain (CONTEXT / 09-RESEARCH):
//   matchWins desc → pointDiff desc → pointsFor desc → unitId asc.
// (Per-game / head-to-head tiebreakers are unavailable under the no-migration
// design — sets store only sets-won; documented degradation, A1.) Stable unitId-asc
// final key keeps the table deterministic. Does NOT mutate the input.
function rankUnits(units: Omit<UnitStanding, "rank">[]): UnitStanding[] {
  return [...units]
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
      if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
      return a.unitId < b.unitId ? -1 : a.unitId > b.unitId ? 1 : 0;
    })
    .map((u, i) => ({ ...u, rank: i + 1 }));
}

const roundsSelect = {
  roundNumber: true,
  matches: {
    select: {
      id: true,
      courtNumber: true,
      teamA1Id: true,
      teamA2Id: true,
      teamB1Id: true,
      teamB2Id: true,
      pointsA: true,
      pointsB: true,
      playerScores: {
        select: { userId: true, teamSlot: true, pointsFor: true, pointsAgainst: true },
      },
    },
  },
} as const;

export async function computeStandings(
  prisma: PrismaClient,
  tournamentId: string,
): Promise<
  | { kind: "players"; format: string; players: PlayerStanding[] }
  | { kind: "units"; format: string; units: UnitStanding[] }
> {
  const t = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: { format: true, participantMode: true, scoringMode: true },
  });

  const rounds = await prisma.round.findMany({
    where: { tournamentId },
    select: roundsSelect,
  });

  // ── americano / mexicano: PLAYER rating from PlayerMatchScore ──────────────
  // Aggregate per-player from the individual score rows (both partners of a team
  // share the team pointsFor). Only recorded matches carry playerScores, so an
  // unrecorded match (empty playerScores) naturally contributes nothing.
  if (t.format === "americano" || t.format === "mexicano") {
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
    return { kind: "players", format: t.format, players: rankPlayers([...acc.values()]) };
  }

  // ── round_robin (and any other unit-based format): UNIT table ──────────────
  // Unit = Pair (pairs) or player (singles). For pairs, recover the Pair identity
  // from (tournamentId, player1Id): the RoundMatch only stores the 4 User FKs, so
  // map teamA1Id/teamB1Id → Pair.id via the pair's player1Id (A2). In sets mode
  // pointsA/pointsB hold sets-won (the per-player contribution metric, A1).
  const isPairs = t.participantMode === "pairs";
  let p1ToPair: Map<string, string> | null = null;
  if (isPairs) {
    const pairs = await prisma.pair.findMany({
      where: { tournamentId },
      select: { id: true, player1Id: true },
    });
    p1ToPair = new Map(pairs.map((p) => [p.player1Id, p.id]));
  }

  const acc = new Map<string, Omit<UnitStanding, "rank">>();
  const unitFor = (slot: "A" | "B", m: (typeof rounds)[number]["matches"][number]): { id: string; kind: "pair" | "user" } | null => {
    const lead = slot === "A" ? m.teamA1Id : m.teamB1Id;
    if (lead == null) return null;
    if (isPairs) {
      const pid = p1ToPair!.get(lead);
      return pid ? { id: pid, kind: "pair" } : null;
    }
    return { id: lead, kind: "user" };
  };
  const ensure = (id: string, kind: "pair" | "user") => {
    let row = acc.get(id);
    if (!row) {
      row = { unitId: id, kind, played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0 };
      acc.set(id, row);
    }
    return row;
  };

  for (const round of rounds) {
    for (const m of round.matches) {
      // Only recorded matches count (pointsA/pointsB both non-null).
      if (m.pointsA == null || m.pointsB == null) continue;
      const ua = unitFor("A", m);
      const ub = unitFor("B", m);
      if (!ua || !ub) continue; // BYE or unmapped slot
      const rowA = ensure(ua.id, ua.kind);
      const rowB = ensure(ub.id, ub.kind);
      rowA.played += 1;
      rowB.played += 1;
      rowA.pointsFor += m.pointsA;
      rowA.pointsAgainst += m.pointsB;
      rowB.pointsFor += m.pointsB;
      rowB.pointsAgainst += m.pointsA;
      // round_robin draws are rejected at record time (Plan 05); guard anyway.
      if (m.pointsA > m.pointsB) {
        rowA.wins += 1;
        rowB.losses += 1;
      } else if (m.pointsB > m.pointsA) {
        rowB.wins += 1;
        rowA.losses += 1;
      }
    }
  }
  for (const row of acc.values()) row.pointDiff = row.pointsFor - row.pointsAgainst;

  return { kind: "units", format: t.format, units: rankUnits([...acc.values()]) };
}
