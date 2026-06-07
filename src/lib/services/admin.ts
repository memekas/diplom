import type { PrismaClient } from "@prisma/client";
import { transitionTournament } from "./tournament-status";

// Typed error so the action (Plan 05) can map each violation to a RU message
// without string-matching — mirror of RegistrationError. The only admin-side
// integrity code is "not_open": delete is allowed ONLY while registration is open.
export class AdminError extends Error {
  constructor(
    public code: "not_open",
    message: string,
  ) {
    super(message);
    this.name = "AdminError";
  }
}

export interface RemovePairArgs {
  tournamentId: string;
  pairId: string;
}

// ADMN-01 status-guarded pair removal. The DB is the source of truth: status is
// re-read inside the transaction and the delete only runs while registration is
// open (T-08-08). tournamentId gates the status check, pairId is what we delete.
export async function removePair(
  prisma: PrismaClient,
  { tournamentId, pairId }: RemovePairArgs,
) {
  return prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
      select: { status: true },
    });
    if (tournament.status !== "registration") {
      throw new AdminError("not_open", "Удаление возможно только до старта турнира");
    }
    return tx.pair.delete({ where: { id: pairId } });
  });
}

export interface RemoveParticipantArgs {
  tournamentId: string;
  playerId: string;
}

// ADMN-01 status-guarded single-participant removal — mirror of removePair on
// TournamentPlayer. Same registration-only guard inside the transaction.
export async function removeParticipant(
  prisma: PrismaClient,
  { tournamentId, playerId }: RemoveParticipantArgs,
) {
  return prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
      select: { status: true },
    });
    if (tournament.status !== "registration") {
      throw new AdminError("not_open", "Удаление возможно только до старта турнира");
    }
    return tx.tournamentPlayer.delete({ where: { id: playerId } });
  });
}

// ADMN-02 manual finish. Idempotent (Pitfall 8): a repeat finish on an already
// -finished tournament is a no-op, never an error — so a duplicate POST cannot
// corrupt state or throw. Otherwise delegates to the existing forward-only
// machine (in_progress→finished), which re-reads DB status and rejects illegal
// transitions (T-08-09). The status machine is NOT re-implemented here, and the
// playoff auto-finish in result.ts is untouched — manual finish is just another
// path to the same terminal state.
export async function finishTournament(prisma: PrismaClient, tournamentId: string) {
  const current = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: { status: true },
  });
  if (current.status === "finished") return;
  return transitionTournament(prisma, tournamentId, "in_progress", "finished");
}
