import type { PrismaClient } from "@prisma/client";

// Typed error so the action (Plan 02) can map each integrity violation to a RU
// message without string-matching. Every reject throws this; no pair is written
// on any reject path.
export class RegistrationError extends Error {
  constructor(
    public code:
      | "self_partner"
      | "already_registered"
      | "tournament_full"
      | "not_open"
      | "partner_not_found"
      | "level_mismatch"
      | "wrong_mode",
    message: string,
  ) {
    super(message);
    this.name = "RegistrationError";
  }
}

// Explicit safe select (profile.ts convention) — the created pair's shape returned
// to the caller. seed is filled only in Phase 4, so it is not selected here.
const pairSelect = {
  id: true,
  tournamentId: true,
  player1Id: true,
  player2Id: true,
  createdAt: true,
} as const;

export interface RegisterPairArgs {
  tournamentId: string;
  player1Id: string;
  player2Id: string;
}

// REG-04 partner-by-nickname resolution. Exact, case-sensitive lookup (SQLite TEXT
// UNIQUE is BINARY by default — matches the locked exact-match decision). Resolves a
// nickname to its userId BEFORE registerPair so the transactional integrity gate
// stays untouched. On miss, throws the typed RegistrationError — the action's
// existing `instanceof RegistrationError` branch surfaces the RU message. Self-pairing
// (own nick) is NOT special-cased here: own nick → own id → registerPair's existing
// player1Id===player2Id guard catches it (self_partner).
export async function findUserIdByNickname(
  prisma: PrismaClient,
  nickname: string,
): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { nickname },
    select: { id: true },
  });
  if (!user) {
    throw new RegistrationError("partner_not_found", "Игрок с таким ником не найден");
  }
  return user.id;
}

// REG-01/REG-02/REG-03 atomic registration gate. The DB is the source of truth:
// status re-read, capacity count, cross-slot duplicate check, and the insert ALL
// run inside ONE prisma.$transaction so count+insert cannot race (Pitfall 7) and
// over-capacity / double-register cannot slip through concurrently. The service
// takes prisma in (actions stay thin), mirroring tournament-status.ts.
export async function registerPair(
  prisma: PrismaClient,
  { tournamentId, player1Id, player2Id }: RegisterPairArgs,
) {
  return prisma.$transaction(async (tx) => {
    // (1) Re-read status — registration must be open (REG-03). Client-claimed
    // state is never trusted; the DB row is authoritative.
    const tournament = await tx.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
      select: { id: true, status: true, size: true, level: true, participantMode: true },
    });
    if (tournament.status !== "registration") {
      throw new RegistrationError("not_open", "Регистрация на турнир закрыта");
    }

    // (1b) Mode guard (Pitfall 5) — pair path requires a pairs tournament. The
    // form-claimed mode is never trusted; the DB row is authoritative.
    if (tournament.participantMode !== "pairs") {
      throw new RegistrationError("wrong_mode", "На этот турнир регистрация только одиночная");
    }

    // (2) Self-partner guard (Pitfall 6) — unique constraints cannot catch this.
    if (player1Id === player2Id) {
      throw new RegistrationError("self_partner", "Нельзя зарегистрироваться в паре с самим собой");
    }

    // (3) Capacity lock (REG-03) — reject at or over size.
    const count = await tx.pair.count({ where: { tournamentId } });
    if (count >= tournament.size) {
      throw new RegistrationError("tournament_full", "Турнир заполнен");
    }

    // (4) Cross-slot duplicate (REG-02) — either player already appearing as
    // player1 OR player2 in any pair of this tournament. This is what catches a
    // player who is player1 in one pair and player2 in another; the per-slot
    // @@unique constraints (Task 3) are defense-in-depth, not a substitute.
    const existing = await tx.pair.findFirst({
      where: {
        tournamentId,
        OR: [
          { player1Id: { in: [player1Id, player2Id] } },
          { player2Id: { in: [player1Id, player2Id] } },
        ],
      },
      select: { id: true },
    });
    if (existing) {
      throw new RegistrationError("already_registered", "Один из игроков уже участвует в этом турнире");
    }

    // (4b) Level match (REG-05, Pitfall 6) — strict equality for BOTH players.
    // Read both skillLevels inside the same transaction; if either differs from
    // the tournament level, reject. No partial-level pairs allowed.
    const players = await tx.user.findMany({
      where: { id: { in: [player1Id, player2Id] } },
      select: { id: true, skillLevel: true },
    });
    if (players.some((p) => p.skillLevel !== tournament.level)) {
      throw new RegistrationError("level_mismatch", "Уровень игрока не совпадает с уровнем турнира");
    }

    // (5) Insert — only reached when every gate passed.
    return tx.pair.create({
      data: { tournamentId, player1Id, player2Id },
      select: pairSelect,
    });
  });
}

// Explicit safe select for the created TournamentPlayer row returned to the caller.
const tournamentPlayerSelect = {
  id: true,
  tournamentId: true,
  userId: true,
  createdAt: true,
} as const;

export interface RegisterSingleArgs {
  tournamentId: string;
  userId: string;
}

// REG-06 single-player registration — mirror of registerPair on TournamentPlayer.
// Same transactional gate (status / mode / level / capacity / duplicate / insert)
// inside ONE prisma.$transaction so count+insert cannot race (Pitfall 7). Capacity
// is measured by TournamentPlayer count vs tournament.size (NOT Pair count, Pitfall 7).
export async function registerSingle(
  prisma: PrismaClient,
  { tournamentId, userId }: RegisterSingleArgs,
) {
  return prisma.$transaction(async (tx) => {
    // (1) Re-read status — registration must be open (REG-03).
    const tournament = await tx.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
      select: { id: true, status: true, size: true, level: true, participantMode: true },
    });
    if (tournament.status !== "registration") {
      throw new RegistrationError("not_open", "Регистрация на турнир закрыта");
    }

    // (2) Mode guard (Pitfall 5) — singles path requires a singles tournament.
    if (tournament.participantMode !== "singles") {
      throw new RegistrationError("wrong_mode", "На этот турнир регистрация только парой");
    }

    // (3) Level match (REG-05) — strict equality.
    const me = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { skillLevel: true },
    });
    if (me.skillLevel !== tournament.level) {
      throw new RegistrationError("level_mismatch", "Уровень игрока не совпадает с уровнем турнира");
    }

    // (4) Capacity lock (Pitfall 7) — count TournamentPlayer, not Pair.
    const count = await tx.tournamentPlayer.count({ where: { tournamentId } });
    if (count >= tournament.size) {
      throw new RegistrationError("tournament_full", "Турнир заполнен");
    }

    // (5) Duplicate guard — composite unique (tournamentId, userId).
    const dup = await tx.tournamentPlayer.findUnique({
      where: { tournamentId_userId: { tournamentId, userId } },
      select: { id: true },
    });
    if (dup) {
      throw new RegistrationError("already_registered", "Вы уже зарегистрированы в этом турнире");
    }

    // (6) Insert — only reached when every gate passed.
    return tx.tournamentPlayer.create({
      data: { tournamentId, userId },
      select: tournamentPlayerSelect,
    });
  });
}

// Display-only player projection for the participant list (PLAYER-02). Explicit
// safe select — never email/credential columns (Pitfall 12 / T-03-06).
const playerSelect = {
  id: true,
  name: true,
  courtSide: true,
  skillLevel: true,
} as const;

// Read helper: all pairs of a tournament with both players' display fields, oldest
// first. Used by the detail page to render the participant list + counter.
export async function listTournamentPairs(prisma: PrismaClient, tournamentId: string) {
  return prisma.pair.findMany({
    where: { tournamentId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      player1: { select: playerSelect },
      player2: { select: playerSelect },
    },
  });
}
