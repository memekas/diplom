import type { PrismaClient } from "@prisma/client";

// Dashboard domain read. READ-ONLY over EXISTING models (Pair / TournamentPlayer
// / Round) — no schema, no writes, no business-logic change. Per ARCHITECTURE the
// service takes the prisma client in and uses explicit safe `select`s (never
// credential columns). The `userId` is supplied by the requireUser() guard at the
// call site — every query here is scoped to it (authz boundary T-13-08): the
// participation read can only ever surface the session user's own tournaments.

// Shared safe projection for a tournament card. Only public display columns.
const tournamentCardSelect = {
  id: true,
  name: true,
  status: true,
  format: true,
  participantMode: true,
  level: true,
  date: true,
  location: true,
  size: true,
  totalRounds: true,
} as const;

type StatusGroup = "active" | "upcoming" | "finished";

// in_progress → active, registration → upcoming, finished → finished. Any
// unexpected status degrades to "upcoming" (visible, non-terminal) rather than
// being dropped.
function statusGroup(status: string): StatusGroup {
  if (status === "in_progress") return "active";
  if (status === "finished") return "finished";
  return "upcoming";
}

const ROUND_FORMATS = new Set(["round_robin", "americano", "mexicano"]);

export type DashboardTournament = {
  id: string;
  name: string;
  status: string;
  format: string;
  participantMode: string;
  level: string;
  location: string | null;
  date: Date | null;
  size: number;
  // Configured round count (americano/mexicano). Null for playoff/round_robin.
  totalRounds: number | null;
  role: "pair" | "solo";
  partnerName?: string;
  // Best-effort round progress for round-based formats. Omitted for playoff (no
  // Round rows) — degrade gracefully, never fabricate.
  round?: { done: number; total: number };
};

export type MyTournaments = {
  active: DashboardTournament[];
  upcoming: DashboardTournament[];
  finished: DashboardTournament[];
};

export async function getMyTournaments(
  prisma: PrismaClient,
  userId: string,
): Promise<MyTournaments> {
  // (1) Pairs the user belongs to (playoff / round_robin pairs mode). Partner is
  // whichever player is NOT the session user.
  const pairs = await prisma.pair.findMany({
    where: { OR: [{ player1Id: userId }, { player2Id: userId }] },
    select: {
      player1: { select: { id: true, name: true } },
      player2: { select: { id: true, name: true } },
      tournament: { select: tournamentCardSelect },
    },
  });

  // (2) Singles registrations (americano / mexicano / singles round_robin).
  const solos = await prisma.tournamentPlayer.findMany({
    where: { userId },
    select: { tournament: { select: tournamentCardSelect } },
  });

  // Merge into card view-models, de-duplicating by tournament id (a user can only
  // be in a tournament once, but a pair row + a stray TournamentPlayer row for the
  // same tournament should not double-render — pair wins, it carries the partner).
  const byId = new Map<string, DashboardTournament>();

  for (const p of pairs) {
    const t = p.tournament;
    const partner = p.player1.id === userId ? p.player2 : p.player1;
    byId.set(t.id, {
      id: t.id,
      name: t.name,
      status: t.status,
      format: t.format,
      participantMode: t.participantMode,
      level: t.level,
      location: t.location,
      date: t.date,
      size: t.size,
      totalRounds: t.totalRounds,
      role: "pair",
      partnerName: partner.name,
    });
  }

  for (const s of solos) {
    const t = s.tournament;
    if (byId.has(t.id)) continue; // pair entry already carries the partner
    byId.set(t.id, {
      id: t.id,
      name: t.name,
      status: t.status,
      format: t.format,
      participantMode: t.participantMode,
      level: t.level,
      location: t.location,
      date: t.date,
      size: t.size,
      totalRounds: t.totalRounds,
      role: "solo",
    });
  }

  const cards = [...byId.values()];

  // Best-effort round progress for round-based formats only. One grouped read of
  // Round rows for the relevant tournaments; playoff is excluded (no Round rows →
  // round block omitted). done = finished rounds, total = totalRounds ?? roundCount.
  const roundTournamentIds = cards
    .filter((c) => ROUND_FORMATS.has(c.format))
    .map((c) => c.id);

  if (roundTournamentIds.length > 0) {
    const rounds = await prisma.round.findMany({
      where: { tournamentId: { in: roundTournamentIds } },
      select: { tournamentId: true, status: true },
    });
    const agg = new Map<string, { done: number; count: number }>();
    for (const r of rounds) {
      const e = agg.get(r.tournamentId) ?? { done: 0, count: 0 };
      e.count += 1;
      if (r.status === "finished") e.done += 1;
      agg.set(r.tournamentId, e);
    }
    for (const c of cards) {
      if (!ROUND_FORMATS.has(c.format)) continue;
      const e = agg.get(c.id);
      const roundCount = e?.count ?? 0;
      // total = configured round count when set (americano/mexicano), else the
      // number of materialized Round rows. Omit the block when neither is > 0.
      const total = c.totalRounds ?? roundCount;
      if (total > 0) {
        c.round = { done: e?.done ?? 0, total };
      }
    }
  }

  const result: MyTournaments = { active: [], upcoming: [], finished: [] };
  for (const c of cards) {
    result[statusGroup(c.status)].push(c);
  }
  return result;
}
