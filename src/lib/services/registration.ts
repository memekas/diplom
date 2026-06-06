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
      | "partner_not_found",
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
      select: { id: true, status: true, size: true },
    });
    if (tournament.status !== "registration") {
      throw new RegistrationError("not_open", "Регистрация на турнир закрыта");
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

    // (5) Insert — only reached when every gate passed.
    return tx.pair.create({
      data: { tournamentId, player1Id, player2Id },
      select: pairSelect,
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
