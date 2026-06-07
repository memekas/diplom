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
    // Scope the delete to tournamentId so the status guard and the target are
    // the SAME row — deleting by pairId alone lets a pair from another, already
    // -started tournament be removed past its no-deletion gate (WR-02). count===0
    // means the pair does not belong to this registration-open tournament.
    const res = await tx.pair.deleteMany({ where: { id: pairId, tournamentId } });
    if (res.count === 0) {
      throw new AdminError("not_open", "Регистрация не найдена");
    }
    return res;
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
    // Scope to tournamentId (mirror of removePair, WR-02): guard and target must
    // be the same row. count===0 ⇒ player not in this registration-open tournament.
    const res = await tx.tournamentPlayer.deleteMany({ where: { id: playerId, tournamentId } });
    if (res.count === 0) {
      throw new AdminError("not_open", "Регистрация не найдена");
    }
    return res;
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
