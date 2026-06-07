import type { PrismaClient } from "@prisma/client";
import { transitionTournament } from "./tournament-status";

// --- FMT-01 round-robin core ---
// The schedule is a single pure function (circle / polygon method, FORMATS.md §1):
// the off-by-one rotation math is solved ONCE here and tested without a DB, never
// re-derived per call site. generateRoundRobin mirrors generateBracket: one
// transaction, generate-once, status-flip via transitionTournament.

// Typed error so the Server Action (Plan 06) maps each reject to a friendly RU
// message without string-matching, and never forwards raw Prisma/internal text
// (T-09-03). Mirror of BracketError. Every reject throws this; nothing is persisted
// on any reject (the transaction rolls back).
export class FormatError extends Error {
  constructor(
    public code: "not_open" | "wrong_format" | "already_generated" | "no_units",
    message: string,
  ) {
    super(message);
    this.name = "FormatError";
  }
}

// Fisher–Yates in-place shuffle on a copy. Math.random is acceptable here — this is a
// runtime service (not a deterministic workflow script); the draw is meant to be
// random. Copied from bracket.ts (same semantics). circleMethodSchedule does NOT
// shuffle — the caller shuffles ONCE and passes the fixed order in (determinism).
function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface ScheduledMatch<T> {
  courtNumber: number;
  unitA: T;
  unitB: T;
}

export interface ScheduledRound<T> {
  roundNumber: number;
  matches: ScheduledMatch<T>[];
}

// Circle / polygon method (FORMATS.md §1). Prisma-free, generic, deterministic for a
// fixed input (no internal shuffle). Each unit meets every other exactly once; total
// matches = n0*(n0-1)/2.
//
//   - n0 even  → n0-1 rounds, no byes.
//   - n0 odd   → a BYE sentinel (null) is appended → n rounds, each unit sits exactly
//                one round; a BYE side produces NO match (⚠️ FORMATS §1 error 3).
//   - arr[0] is FIXED forever; only the tail [1..n-1] rotates (⚠️ FORMATS §1 error 1).
//   - courtNumber is re-indexed 0-based over the matches ACTUALLY created in a round
//     (so a skipped BYE leaves no hole in court numbering).
export function circleMethodSchedule<T>(units: T[]): ScheduledRound<T>[] {
  // ⚠️ FORMATS §1 error 2: an odd count needs a BYE or the round count is wrong.
  const padded: (T | null)[] = units.slice();
  if (padded.length % 2 !== 0) {
    padded.push(null); // BYE sentinel
  }

  const n = padded.length;
  const rounds = n - 1;
  const half = n / 2;
  const schedule: ScheduledRound<T>[] = [];

  let arr = padded.slice();
  for (let r = 0; r < rounds; r++) {
    const matches: ScheduledMatch<T>[] = [];
    for (let i = 0; i < half; i++) {
      const home = arr[i];
      const away = arr[n - 1 - i];
      // A BYE side sits out — no match is created (no garbage in the table).
      if (home === null || away === null) continue;
      // courtNumber re-indexed over really-created matches (no holes after a BYE skip).
      matches.push({ courtNumber: matches.length, unitA: home, unitB: away });
    }
    schedule.push({ roundNumber: r + 1, matches });

    // Rotate: arr[0] stays put; the tail rotates by one (last element to the front).
    const fixed = arr[0];
    const tail = arr.slice(1);
    tail.unshift(tail.pop() as T | null);
    arr = [fixed, ...tail];
  }

  return schedule;
}

// Discriminated unit shape fed into the schedule. A pairs RR plays Pair-vs-Pair
// (4 player FKs reused); a singles RR plays player-vs-player 1v1 (only teamA1/teamB1).
type Unit =
  | { kind: "pair"; pairId: string; player1Id: string; player2Id: string }
  | { kind: "user"; userId: string };

// FMT-01: generate the full round-robin schedule (all Round + RoundMatch) in ONE
// transaction. The DB is the source of truth — status, format, participantMode, and
// the generate-once guard are re-read inside the transaction so the caller (Server
// Action, Plan 06) cannot bypass them. Any throw rolls back the whole transaction:
// no partial schedule. Mirror of generateBracket.
export async function generateRoundRobin(prisma: PrismaClient, tournamentId: string) {
  return prisma.$transaction(async (tx) => {
    // (1) Re-read tournament — must be open for registration AND be a round_robin.
    const tournament = await tx.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
      select: { id: true, status: true, format: true, participantMode: true },
    });
    if (tournament.status !== "registration") {
      throw new FormatError("not_open", `Нельзя сгенерировать расписание: турнир в статусе "${tournament.status}"`);
    }
    if (tournament.format !== "round_robin") {
      throw new FormatError("wrong_format", `Формат турнира не round-robin: "${tournament.format}"`);
    }

    // (2) Generate-once: refuse if any round already exists. @@unique([tournamentId,
    // roundNumber]) on Round backstops this against a concurrent double-Старт.
    const existing = await tx.round.count({ where: { tournamentId } });
    if (existing > 0) {
      throw new FormatError("already_generated", "Расписание уже сгенерировано — повторная генерация запрещена");
    }

    // (3) Load units by participantMode (the generator reads the SAME source as
    // registration.ts — Pair for pairs, TournamentPlayer for singles).
    let units: Unit[];
    if (tournament.participantMode === "pairs") {
      const pairs = await tx.pair.findMany({
        where: { tournamentId },
        select: { id: true, player1Id: true, player2Id: true },
      });
      units = pairs.map((p) => ({
        kind: "pair" as const,
        pairId: p.id,
        player1Id: p.player1Id,
        player2Id: p.player2Id,
      }));
    } else {
      const players = await tx.tournamentPlayer.findMany({
        where: { tournamentId },
        select: { userId: true },
      });
      units = players.map((p) => ({ kind: "user" as const, userId: p.userId }));
    }
    if (units.length < 2) {
      throw new FormatError("no_units", "Недостаточно участников для старта (нужно минимум 2)");
    }

    // (4) Shuffle ONCE, then build the deterministic circle-method schedule.
    const schedule = circleMethodSchedule(shuffle(units));

    // (5) Persist: one Round per scheduled round, one RoundMatch per scheduled match.
    let roundsCreated = 0;
    let matchesCreated = 0;
    for (const round of schedule) {
      const created = await tx.round.create({
        data: { tournamentId, roundNumber: round.roundNumber },
        select: { id: true },
      });
      roundsCreated++;
      for (const m of round.matches) {
        // Pattern 2 (schema.prisma:273-277): pairs reuse all 4 FKs; singles 1v1
        // fills only teamA1/teamB1 and leaves teamA2/teamB2 null.
        const data =
          m.unitA.kind === "pair" && m.unitB.kind === "pair"
            ? {
                roundId: created.id,
                courtNumber: m.courtNumber,
                teamA1Id: m.unitA.player1Id,
                teamA2Id: m.unitA.player2Id,
                teamB1Id: m.unitB.player1Id,
                teamB2Id: m.unitB.player2Id,
              }
            : {
                roundId: created.id,
                courtNumber: m.courtNumber,
                teamA1Id: m.unitA.kind === "user" ? m.unitA.userId : null,
                teamA2Id: null,
                teamB1Id: m.unitB.kind === "user" ? m.unitB.userId : null,
                teamB2Id: null,
              };
        await tx.roundMatch.create({ data });
        matchesCreated++;
      }
    }

    // (6) Flip status registration → in_progress via the single status machine.
    await transitionTournament(tx as unknown as PrismaClient, tournamentId, "registration", "in_progress");

    return { tournamentId, roundsCreated, matchesCreated };
  });
}
