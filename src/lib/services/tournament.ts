import type { PrismaClient } from "@prisma/client";
import type { CreateTournamentInput } from "@/lib/validation/tournament";

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
  setsPerMatch: true,
  gamesPerSet: true,
  createdAt: true,
} as const;

export async function createTournament(prisma: PrismaClient, data: CreateTournamentInput) {
  // status is hard-set to "registration" server-side — NEVER taken from input
  // (Pitfall 4 / threat T-02-02). setsPerMatch/gamesPerSet fall to schema defaults.
  return prisma.tournament.create({
    data: {
      name: data.name,
      size: data.size,
      status: "registration",
      date: data.date ?? null,
      location: data.location ?? null,
    },
    select: tournamentSelect,
  });
}

export async function listTournaments(prisma: PrismaClient) {
  // Newest first (CONTEXT: list shows all tournaments, createdAt desc).
  return prisma.tournament.findMany({
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
