import type { Prisma, PrismaClient } from "@prisma/client";

// Thin READ-ONLY helpers for round-based formats (VIS-01). No engine logic, no
// writes, no transactions — the round generators / recordRoundResult / computeStandings
// already own that. These exist only because computeStandings returns ids (not names),
// so the views need a display-name source. The detail page (Plan 04) consumes them.
//
// Security (T-11-08): both helpers use explicit safe `select` — team-member slots are
// projected to { id, name } and players to { id, name, skillLevel, courtSide }. NEVER
// email/birthDate/credential columns (mirrors registration.playerSelect; Pitfall 12 /
// Security Domain constraint).

// Display-only team-member projection used for the 4 RoundMatch User FK relations.
const teamMemberSelect = { id: true, name: true } as const;

// Explicit select reused for listRounds — declared once so the exported row type stays
// in lock-step with the actual query (Prisma payload inference).
const roundsReadSelect = {
  roundNumber: true,
  matches: {
    orderBy: { courtNumber: "asc" },
    select: {
      id: true,
      courtNumber: true,
      pointsA: true,
      pointsB: true,
      teamA1: { select: teamMemberSelect },
      teamA2: { select: teamMemberSelect },
      teamB1: { select: teamMemberSelect },
      teamB2: { select: teamMemberSelect },
    },
  },
} satisfies Prisma.RoundSelect;

// Exported row shapes — Plan 04 + the view components share these. Derived from the
// select via Prisma payload inference so they cannot drift from the query.
export type RoundRead = Prisma.RoundGetPayload<{ select: typeof roundsReadSelect }>;
export type RoundReadMatch = RoundRead["matches"][number];

// All rounds of a tournament with their matches + the 4 team-member display names and
// points, ordered roundNumber asc then courtNumber asc. Unused slots (singles 1v1) are
// null. Pure read.
export async function listRounds(
  prisma: PrismaClient,
  tournamentId: string,
): Promise<RoundRead[]> {
  return prisma.round.findMany({
    where: { tournamentId },
    orderBy: { roundNumber: "asc" },
    select: roundsReadSelect,
  });
}

// Display-only player projection for the singles participant list (no email/birthDate).
const tpPlayerSelect = { id: true, name: true, skillLevel: true, courtSide: true } as const;

const tournamentPlayersReadSelect = {
  id: true,
  user: { select: tpPlayerSelect },
} satisfies Prisma.TournamentPlayerSelect;

export type TournamentPlayerRead = Prisma.TournamentPlayerGetPayload<{
  select: typeof tournamentPlayersReadSelect;
}>;

// Singles registrants (TournamentPlayer) with safe display fields, oldest first. Pure read.
export async function listTournamentPlayers(
  prisma: PrismaClient,
  tournamentId: string,
): Promise<TournamentPlayerRead[]> {
  return prisma.tournamentPlayer.findMany({
    where: { tournamentId },
    orderBy: { createdAt: "asc" },
    select: tournamentPlayersReadSelect,
  });
}
