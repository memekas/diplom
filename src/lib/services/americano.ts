import type { PrismaClient } from "@prisma/client";
import { transitionTournament } from "./tournament-status";

// --- FMT-02 americano core ---
// Americano is a SOCIAL format: registration is singles, the PARTNER rotates every
// round (goal: each player partners every other exactly once). The schedule math is a
// single pure function (circle method on PLAYERS, FORMATS.md §2): the partner-once
// rotation is solved ONCE here and tested without a DB. generateAmericano mirrors
// generateRoundRobin / generateBracket: one transaction, generate-once, status-flip
// via transitionTournament.

// Typed error so the Server Action (Plan 06) maps each reject to a friendly RU message
// without string-matching, never forwarding raw Prisma/internal text (T-09-07).
// Declared locally (NOT cross-imported from round-robin.ts) so the two services stay
// decoupled; Plan 06 dispatch handles both error types. Same code union as round-robin.
export class FormatError extends Error {
  constructor(
    public code: "not_open" | "wrong_format" | "already_generated" | "no_units",
    message: string,
  ) {
    super(message);
    this.name = "FormatError";
  }
}

// Fisher–Yates in-place shuffle on a copy. Math.random is acceptable — this is a runtime
// service, the draw is meant to be random. Copied from bracket.ts / round-robin.ts (same
// semantics). americanoSchedule does NOT shuffle — the caller shuffles ONCE and passes
// the fixed order in (determinism).
function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface AmericanoCourt<T> {
  courtNumber: number;
  teamA: [T, T];
  teamB: [T, T];
}

export interface AmericanoRound<T> {
  roundNumber: number;
  courts: AmericanoCourt<T>[];
}

// Circle method on PLAYERS (FORMATS.md §2). Prisma-free, generic, deterministic for a
// fixed input (no internal shuffle). Guarantees PARTNER-ONCE: over N-1 rounds each player
// partners every other exactly once (proven N=4/8/12/16 → 0 duplicate partnerships).
// ⚠️ Opponent uniqueness is NOT guaranteed simultaneously — that's normal, not a bug.
//
//   - Even N → N-1 rounds. arr = [fixed, ...ring]; partnerships = positions (i, N-1-i);
//     court k = partnership(2k) vs partnership(2k+1); ring rotates by one each round,
//     arr[0] is FIXED forever (⚠️ FORMATS §2).
//   - Odd N → a BYE sentinel (null) is appended → one player sits each round.
//   - N≡2 mod4 → an odd number of valid partnerships → the last unpaired partnership
//     sits this round (no court created for it) → 2 players sit.
//   - courtNumber is 0-based over courts ACTUALLY created (no holes after a sit-out).
export function americanoSchedule<T>(players: T[]): AmericanoRound<T>[] {
  const padded: (T | null)[] = players.slice();
  if (padded.length % 2 !== 0) {
    padded.push(null); // BYE sentinel — odd N → one player sits each round
  }

  const n = padded.length;
  const rounds = n - 1;
  const half = n / 2;
  const schedule: AmericanoRound<T>[] = [];

  const fixed = padded[0];
  let ring = padded.slice(1); // the rotating part; arr[0] never rotates
  for (let r = 0; r < rounds; r++) {
    const arr = [fixed, ...ring];

    // Partnerships from positions (i, N-1-i): (arr[0],arr[N-1]),(arr[1],arr[N-2]),...
    const partnerships: [T, T][] = [];
    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      // A partnership containing BYE sits — it produces no team.
      if (a === null || b === null) continue;
      partnerships.push([a, b]);
    }

    // Courts: partnership(2k) vs partnership(2k+1). If the count of valid partnerships
    // is odd (N≡2 mod4), the last unpaired partnership sits — no court for it.
    const courts: AmericanoCourt<T>[] = [];
    for (let k = 0; 2 * k + 1 < partnerships.length; k++) {
      courts.push({
        courtNumber: courts.length,
        teamA: partnerships[2 * k],
        teamB: partnerships[2 * k + 1],
      });
    }
    schedule.push({ roundNumber: r + 1, courts });

    // Rotate the ring by one (last element to the front); arr[0]/fixed stays put.
    ring = [ring[ring.length - 1], ...ring.slice(0, ring.length - 1)];
  }

  return schedule;
}

// FMT-02: generate the full americano schedule (all Round + RoundMatch) in ONE
// transaction. Americano is ALWAYS singles (Pitfall 3 — read TournamentPlayer, never
// Pair). The DB is the source of truth — status, format, and the generate-once guard are
// re-read inside the transaction so the caller (Server Action, Plan 06) cannot bypass
// them. Any throw rolls back the whole transaction: no partial schedule. Mirror of
// generateRoundRobin / generateBracket.
export async function generateAmericano(prisma: PrismaClient, tournamentId: string) {
  return prisma.$transaction(async (tx) => {
    // (1) Re-read tournament — must be open for registration AND be americano.
    const tournament = await tx.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
      select: { id: true, status: true, format: true, participantMode: true },
    });
    if (tournament.status !== "registration") {
      throw new FormatError("not_open", `Нельзя сгенерировать расписание: турнир в статусе "${tournament.status}"`);
    }
    if (tournament.format !== "americano") {
      throw new FormatError("wrong_format", `Формат турнира не американо: "${tournament.format}"`);
    }

    // (2) Generate-once: refuse if any round already exists. @@unique([tournamentId,
    // roundNumber]) on Round backstops this against a concurrent double-Старт.
    const existing = await tx.round.count({ where: { tournamentId } });
    if (existing > 0) {
      throw new FormatError("already_generated", "Расписание уже сгенерировано — повторная генерация запрещена");
    }

    // (3) Load players (americano = singles; read TournamentPlayer, never Pair).
    const players = await tx.tournamentPlayer.findMany({
      where: { tournamentId },
      select: { userId: true },
    });
    if (players.length < 4) {
      throw new FormatError("no_units", "Недостаточно игроков для старта американо (нужно минимум 4)");
    }

    // (4) Shuffle ONCE, then build the deterministic partner-once schedule.
    const schedule = americanoSchedule(shuffle(players.map((p) => p.userId)));

    // (5) Persist: one Round per scheduled round, one RoundMatch per court. Partnership
    // variant (Pattern 2): teamA1/A2 = partnership A, teamB1/B2 = partnership B.
    let roundsCreated = 0;
    let matchesCreated = 0;
    for (const round of schedule) {
      const created = await tx.round.create({
        data: { tournamentId, roundNumber: round.roundNumber },
        select: { id: true },
      });
      roundsCreated++;
      for (const c of round.courts) {
        await tx.roundMatch.create({
          data: {
            roundId: created.id,
            courtNumber: c.courtNumber,
            teamA1Id: c.teamA[0],
            teamA2Id: c.teamA[1],
            teamB1Id: c.teamB[0],
            teamB2Id: c.teamB[1],
          },
        });
        matchesCreated++;
      }
    }

    // (6) Flip status registration → in_progress via the single status machine.
    await transitionTournament(tx as unknown as PrismaClient, tournamentId, "registration", "in_progress");

    return { tournamentId, roundsCreated, matchesCreated };
  });
}
