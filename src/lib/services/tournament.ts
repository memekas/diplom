import type { PrismaClient } from "@prisma/client";
import type { CreateTournamentInput, TournamentStatus } from "@/lib/validation/tournament";

// Tournament domain logic over Prisma. Service takes the prisma client in (actions
// stay thin), like profile.ts. All Tournament columns are public (no credential
// leak concern) but we keep an explicit `select` for consistency + stability.
const tournamentSelect = {
  id: true,
  name: true,
  size: true,
  status: true,
  date: true,
  location: true,
  format: true,
  participantMode: true,
  level: true,
  price: true,
  scoringMode: true,
  targetPoints: true,
  totalRounds: true,
  setsPerMatch: true,
  gamesPerSet: true,
  createdAt: true,
} as const;

export async function createTournament(prisma: PrismaClient, data: CreateTournamentInput) {
  // status is hard-set to "registration" server-side — NEVER taken from input
  // (Pitfall 4 / threat T-02-02).
  return prisma.tournament.create({
    data: {
      name: data.name,
      size: data.size,
      status: "registration",
      date: data.date ?? null,
      location: data.location ?? null,
      format: data.format,
      participantMode: data.participantMode,
      level: data.level,
      price: data.price ?? null,
      scoringMode: data.scoringMode,
      // targetPoints is the points-to-target rule of americano/mexicano ONLY
      // (FORMATS §2/§3). Default to 24 for those formats when omitted; round_robin
      // points have NO target sum (FORMATS §1) so it stays null there (CR-01).
      targetPoints:
        data.targetPoints ??
        (data.scoringMode === "points" &&
        (data.format === "americano" || data.format === "mexicano")
          ? 24
          : null),
      totalRounds: data.totalRounds ?? null,
      // setsPerMatch/gamesPerSet: write only if supplied, else fall to schema defaults.
      ...(data.setsPerMatch !== undefined ? { setsPerMatch: data.setsPerMatch } : {}),
      ...(data.gamesPerSet !== undefined ? { gamesPerSet: data.gamesPerSet } : {}),
    },
    select: tournamentSelect,
  });
}

export async function listTournaments(
  prisma: PrismaClient,
  opts?: { status?: TournamentStatus },
) {
  // Newest first (CONTEXT: list shows all tournaments, createdAt desc). Optional
  // status filter (home shows only "registration"; plan-03 header «Прошедшие»
  // uses "finished"). No status → no `where` (all tournaments, backward compat).
  return prisma.tournament.findMany({
    ...(opts?.status ? { where: { status: opts.status } } : {}),
    orderBy: { createdAt: "desc" },
    select: tournamentSelect,
  });
}

export async function getTournament(prisma: PrismaClient, id: string) {
  // Returns null for a missing id so the detail page can render a not-found state.
  return prisma.tournament.findUnique({
    where: { id },
    select: tournamentSelect,
  });
}
