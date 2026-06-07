// Unit tests for recordRoundResult (FMT-03 / SCORE-01 transactional recording).
// Run: npx tsx src/lib/services/round-result.test.ts
// (No test framework — self-contained assertion script with a hand-written fake prisma
// mirroring admin.test.ts. $transaction(fn) runs fn with the same fake acting as tx.
// Exits non-zero on failure.)
import assert from "node:assert/strict";
import { recordRoundResult, RoundResultError } from "./round-result";

let passed = 0;
async function checkAsync(name: string, fn: () => Promise<void>) {
  await fn();
  passed++;
  console.log(`  ok - ${name}`);
}

type RM = {
  id: string;
  roundId: string;
  courtNumber: number;
  teamA1Id: string | null;
  teamA2Id: string | null;
  teamB1Id: string | null;
  teamB2Id: string | null;
  pointsA: number | null;
  pointsB: number | null;
};
type RoundRow = { id: string; roundNumber: number; tournamentId: string };

// A configurable fake DB. `rounds`/`matches` model the round-based schedule; `tournament`
// carries format/scoring config. Records mutations for assertions.
function fakeDb(opts: {
  tournament: {
    id: string;
    format: string;
    scoringMode: string;
    gamesPerSet?: number;
    setsPerMatch?: number;
    targetPoints?: number | null;
    totalRounds?: number | null;
    status?: string;
  };
  rounds: RoundRow[];
  matches: RM[];
}) {
  const t = {
    gamesPerSet: 6,
    setsPerMatch: 3,
    targetPoints: null as number | null,
    totalRounds: null as number | null,
    status: "in_progress",
    ...opts.tournament,
  };
  const matches = opts.matches.map((m) => ({ ...m }));
  const rounds = opts.rounds.map((r) => ({ ...r }));
  const calls = {
    pmsDeleted: [] as string[],
    pmsCreated: [] as { roundMatchId: string; userId: string; teamSlot: string; pointsFor: number; pointsAgainst: number }[],
    rmUpdated: [] as { id: string; pointsA: number; pointsB: number }[],
    materializeCreated: [] as number[], // round numbers created via the materialize path
    transition: null as null | { from: string; to: string },
  };

  const findRound = (id: string) => rounds.find((r) => r.id === id)!;

  const prisma = {
    roundMatch: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const m = matches.find((x) => x.id === where.id);
        if (!m) return null;
        const r = findRound(m.roundId);
        return {
          id: m.id,
          courtNumber: m.courtNumber,
          teamA1Id: m.teamA1Id,
          teamA2Id: m.teamA2Id,
          teamB1Id: m.teamB1Id,
          teamB2Id: m.teamB2Id,
          round: { id: r.id, roundNumber: r.roundNumber, tournamentId: r.tournamentId },
        };
      },
      update: async ({ where, data }: { where: { id: string }; data: { pointsA: number; pointsB: number } }) => {
        const m = matches.find((x) => x.id === where.id)!;
        m.pointsA = data.pointsA;
        m.pointsB = data.pointsB;
        calls.rmUpdated.push({ id: where.id, pointsA: data.pointsA, pointsB: data.pointsB });
        return m;
      },
      count: async ({ where }: { where: { roundId?: string; round?: { tournamentId: string } } }) => {
        // Both call shapes: per-round (mexicano finish/materialize gate) and per-tournament
        // (round_robin/americano auto-finish). Counts unrecorded (pointsA|pointsB null).
        let pool = matches;
        if (where.roundId) pool = pool.filter((m) => m.roundId === where.roundId);
        if (where.round?.tournamentId) {
          const ids = rounds.filter((r) => r.tournamentId === where.round!.tournamentId).map((r) => r.id);
          pool = pool.filter((m) => ids.includes(m.roundId));
        }
        return pool.filter((m) => m.pointsA == null || m.pointsB == null).length;
      },
    },
    playerMatchScore: {
      deleteMany: async ({ where }: { where: { roundMatchId: string } }) => {
        calls.pmsDeleted.push(where.roundMatchId);
        return { count: 0 };
      },
      create: async ({ data }: { data: { roundMatchId: string; userId: string; teamSlot: string; pointsFor: number; pointsAgainst: number } }) => {
        calls.pmsCreated.push({ ...data });
        return data;
      },
    },
    tournament: {
      findUniqueOrThrow: async () => ({ ...t }),
      // transitionTournament reads status then updates.
      update: async ({ data }: { data: { status: string } }) => {
        t.status = data.status;
        return { id: t.id, status: data.status };
      },
    },
    // --- methods used by materializeNextMexicanoRound when format=mexicano ---
    round: {
      findUnique: async ({ where }: { where: { tournamentId_roundNumber: { tournamentId: string; roundNumber: number } } }) => {
        const r = rounds.find(
          (x) => x.tournamentId === where.tournamentId_roundNumber.tournamentId && x.roundNumber === where.tournamentId_roundNumber.roundNumber,
        );
        return r ? { id: r.id } : null;
      },
      count: async ({ where }: { where: { tournamentId: string; roundNumber?: number | { gt: number } } }) =>
        rounds.filter((r) => {
          if (r.tournamentId !== where.tournamentId) return false;
          if (where.roundNumber == null) return true;
          if (typeof where.roundNumber === "object") return r.roundNumber > where.roundNumber.gt;
          return r.roundNumber === where.roundNumber;
        }).length,
      findMany: async () => {
        // materialize re-aggregates standings from playerScores; supply empty (the
        // materialize-gate / already-next tests don't need real ranking, only the gate).
        return rounds.map(() => ({ matches: [] as { playerScores: unknown[] }[] }));
      },
      create: async ({ data }: { data: { tournamentId: string; roundNumber: number } }) => {
        const newRound: RoundRow = { id: `r${data.roundNumber}`, roundNumber: data.roundNumber, tournamentId: data.tournamentId };
        rounds.push(newRound);
        calls.materializeCreated.push(data.roundNumber);
        return { id: newRound.id };
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  return { prisma, calls, matches, rounds, t };
}

async function main() {
  // --- points round_robin: record 15:9 → match scored + 4 PlayerMatchScore (both partners equal) ---
  await checkAsync("points round_robin 15:9 records score + fan-out (both partners share team pointsFor)", async () => {
    const { prisma, calls } = fakeDb({
      tournament: { id: "t1", format: "round_robin", scoringMode: "points" },
      rounds: [{ id: "r1", roundNumber: 1, tournamentId: "t1" }],
      matches: [{ id: "m1", roundId: "r1", courtNumber: 0, teamA1Id: "a1", teamA2Id: "a2", teamB1Id: "b1", teamB2Id: "b2", pointsA: null, pointsB: null }],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await recordRoundResult(prisma as any, "m1", { pointsA: 15, pointsB: 9 });
    assert.equal(res.winner, "A");
    assert.equal(res.pointsA, 15);
    assert.deepEqual(calls.rmUpdated, [{ id: "m1", pointsA: 15, pointsB: 9 }]);
    assert.deepEqual(calls.pmsDeleted, ["m1"]);
    assert.equal(calls.pmsCreated.length, 4);
    const a = calls.pmsCreated.filter((p) => p.teamSlot === "A");
    assert.equal(a.length, 2);
    assert.ok(a.every((p) => p.pointsFor === 15 && p.pointsAgainst === 9));
    const b = calls.pmsCreated.filter((p) => p.teamSlot === "B");
    assert.ok(b.every((p) => p.pointsFor === 9 && p.pointsAgainst === 15));
    assert.equal(res.finished, true); // only match → all recorded → finished
  });

  // --- free-form: round_robin points with no target — 11:7 (any sum) records ---
  await checkAsync("points round_robin 11:7 records (no target sum)", async () => {
    const { prisma, calls } = fakeDb({
      tournament: { id: "t1", format: "round_robin", scoringMode: "points" },
      rounds: [{ id: "r1", roundNumber: 1, tournamentId: "t1" }],
      matches: [{ id: "m1", roundId: "r1", courtNumber: 0, teamA1Id: "a1", teamA2Id: "a2", teamB1Id: "b1", teamB2Id: "b2", pointsA: null, pointsB: null }],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await recordRoundResult(prisma as any, "m1", { pointsA: 11, pointsB: 7 });
    assert.equal(res.winner, "A");
    assert.deepEqual(calls.rmUpdated, [{ id: "m1", pointsA: 11, pointsB: 7 }]);
    assert.equal(res.finished, true);
  });

  // --- free-form: americano 11:7 (any sum, no target) records ---
  await checkAsync("points americano 11:7 records (no target enforced)", async () => {
    const { prisma, calls } = fakeDb({
      tournament: { id: "t1", format: "americano", scoringMode: "points" },
      rounds: [{ id: "r1", roundNumber: 1, tournamentId: "t1" }],
      matches: [{ id: "m1", roundId: "r1", courtNumber: 0, teamA1Id: "a1", teamA2Id: "a2", teamB1Id: "b1", teamB2Id: "b2", pointsA: null, pointsB: null }],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await recordRoundResult(prisma as any, "m1", { pointsA: 11, pointsB: 7 });
    assert.equal(res.winner, "A");
    assert.deepEqual(calls.rmUpdated, [{ id: "m1", pointsA: 11, pointsB: 7 }]);
  });

  // --- free-form: round_robin draw now allowed (winner null, recorded) ---
  await checkAsync("points round_robin 12:12 records winner null (draw allowed everywhere)", async () => {
    const { prisma, calls } = fakeDb({
      tournament: { id: "t1", format: "round_robin", scoringMode: "points" },
      rounds: [{ id: "r1", roundNumber: 1, tournamentId: "t1" }],
      matches: [{ id: "m1", roundId: "r1", courtNumber: 0, teamA1Id: "a1", teamA2Id: "a2", teamB1Id: "b1", teamB2Id: "b2", pointsA: null, pointsB: null }],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await recordRoundResult(prisma as any, "m1", { pointsA: 12, pointsB: 12 });
    assert.equal(res.winner, null);
    assert.deepEqual(calls.rmUpdated, [{ id: "m1", pointsA: 12, pointsB: 12 }]);
  });

  // --- americano draw → winner null, recorded ---
  await checkAsync("americano 12:12 records winner null (draw allowed)", async () => {
    const { prisma } = fakeDb({
      tournament: { id: "t1", format: "americano", scoringMode: "points" },
      rounds: [{ id: "r1", roundNumber: 1, tournamentId: "t1" }],
      matches: [
        { id: "m1", roundId: "r1", courtNumber: 0, teamA1Id: "a1", teamA2Id: "a2", teamB1Id: "b1", teamB2Id: "b2", pointsA: null, pointsB: null },
        { id: "m2", roundId: "r1", courtNumber: 1, teamA1Id: "c1", teamA2Id: "c2", teamB1Id: "d1", teamB2Id: "d2", pointsA: null, pointsB: null },
      ],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await recordRoundResult(prisma as any, "m1", { pointsA: 12, pointsB: 12 });
    assert.equal(res.winner, null);
    assert.equal(res.finished, false); // m2 still unrecorded
  });

  // --- americano partially recorded → NOT finished ---
  await checkAsync("americano partial schedule not finished", async () => {
    const { prisma, t } = fakeDb({
      tournament: { id: "t1", format: "americano", scoringMode: "points" },
      rounds: [{ id: "r1", roundNumber: 1, tournamentId: "t1" }],
      matches: [
        { id: "m1", roundId: "r1", courtNumber: 0, teamA1Id: "a1", teamA2Id: "a2", teamB1Id: "b1", teamB2Id: "b2", pointsA: null, pointsB: null },
        { id: "m2", roundId: "r1", courtNumber: 1, teamA1Id: "c1", teamA2Id: "c2", teamB1Id: "d1", teamB2Id: "d2", pointsA: null, pointsB: null },
      ],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await recordRoundResult(prisma as any, "m1", { pointsA: 15, pointsB: 9 });
    assert.equal(res.finished, false);
    assert.equal(t.status, "in_progress");
  });

  // --- round_robin all matches recorded → finished (transition fired) ---
  await checkAsync("round_robin all recorded → finished", async () => {
    const { prisma, t } = fakeDb({
      tournament: { id: "t1", format: "round_robin", scoringMode: "points" },
      rounds: [{ id: "r1", roundNumber: 1, tournamentId: "t1" }],
      matches: [
        { id: "m1", roundId: "r1", courtNumber: 0, teamA1Id: "a1", teamA2Id: "a2", teamB1Id: "b1", teamB2Id: "b2", pointsA: 15, pointsB: 9 },
        { id: "m2", roundId: "r1", courtNumber: 1, teamA1Id: "c1", teamA2Id: "c2", teamB1Id: "d1", teamB2Id: "d2", pointsA: null, pointsB: null },
      ],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await recordRoundResult(prisma as any, "m2", { pointsA: 11, pointsB: 7 });
    assert.equal(res.finished, true);
    assert.equal(t.status, "finished");
  });

  // --- sets mode: 6:4,6:3 → pointsA=2 sets-won ---
  await checkAsync("sets mode 6:4,6:3 → pointsA=2 (sets-won)", async () => {
    const { prisma, calls } = fakeDb({
      tournament: { id: "t1", format: "round_robin", scoringMode: "sets", gamesPerSet: 6, setsPerMatch: 3 },
      rounds: [{ id: "r1", roundNumber: 1, tournamentId: "t1" }],
      matches: [{ id: "m1", roundId: "r1", courtNumber: 0, teamA1Id: "a1", teamA2Id: "a2", teamB1Id: "b1", teamB2Id: "b2", pointsA: null, pointsB: null }],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await recordRoundResult(prisma as any, "m1", { sets: [{ gamesPair1: 6, gamesPair2: 4 }, { gamesPair1: 6, gamesPair2: 3 }] });
    assert.equal(res.pointsA, 2);
    assert.equal(res.pointsB, 0);
    assert.equal(res.winner, "A");
    assert.deepEqual(calls.rmUpdated, [{ id: "m1", pointsA: 2, pointsB: 0 }]);
  });

  // --- free-form: sets mode accepts ANY number of sets (no cap) ---
  await checkAsync("sets mode accepts 4 arbitrary sets (no cap) → 3:1 winner A", async () => {
    const { prisma, calls } = fakeDb({
      tournament: { id: "t1", format: "round_robin", scoringMode: "sets" },
      rounds: [{ id: "r1", roundNumber: 1, tournamentId: "t1" }],
      matches: [{ id: "m1", roundId: "r1", courtNumber: 0, teamA1Id: "a1", teamA2Id: "a2", teamB1Id: "b1", teamB2Id: "b2", pointsA: null, pointsB: null }],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await recordRoundResult(prisma as any, "m1", {
      sets: [
        { gamesPair1: 4, gamesPair2: 5 },
        { gamesPair1: 6, gamesPair2: 3 },
        { gamesPair1: 10, gamesPair2: 2 },
        { gamesPair1: 6, gamesPair2: 6 }, // tied set → counts for neither
      ],
    });
    assert.equal(res.pointsA, 2);
    assert.equal(res.pointsB, 1);
    assert.equal(res.winner, "A");
    assert.deepEqual(calls.rmUpdated, [{ id: "m1", pointsA: 2, pointsB: 1 }]);
  });

  // --- re-record: deleteMany before create (no @@unique dupes) ---
  await checkAsync("re-record deletes PlayerMatchScore before create", async () => {
    const { prisma, calls } = fakeDb({
      tournament: { id: "t1", format: "americano", scoringMode: "points" },
      rounds: [{ id: "r1", roundNumber: 1, tournamentId: "t1" }],
      matches: [
        { id: "m1", roundId: "r1", courtNumber: 0, teamA1Id: "a1", teamA2Id: "a2", teamB1Id: "b1", teamB2Id: "b2", pointsA: 15, pointsB: 9 },
        { id: "m2", roundId: "r1", courtNumber: 1, teamA1Id: "c1", teamA2Id: "c2", teamB1Id: "d1", teamB2Id: "d2", pointsA: null, pointsB: null },
      ],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await recordRoundResult(prisma as any, "m1", { pointsA: 10, pointsB: 12 });
    assert.deepEqual(calls.pmsDeleted, ["m1"]);
    assert.equal(calls.pmsCreated.length, 4);
  });

  // --- mexicano: round full && roundNumber < totalRounds → next round materialized ---
  await checkAsync("mexicano round complete & not last → materializes next round", async () => {
    const { prisma, calls } = fakeDb({
      tournament: { id: "t1", format: "mexicano", scoringMode: "points", totalRounds: 3 },
      rounds: [{ id: "r1", roundNumber: 1, tournamentId: "t1" }],
      matches: [
        // 8 players = 2 quads; record both so round 1 is fully recorded after this call.
        { id: "m1", roundId: "r1", courtNumber: 0, teamA1Id: "a1", teamA2Id: "a2", teamB1Id: "b1", teamB2Id: "b2", pointsA: 15, pointsB: 9 },
        { id: "m2", roundId: "r1", courtNumber: 1, teamA1Id: "c1", teamA2Id: "c2", teamB1Id: "d1", teamB2Id: "d2", pointsA: null, pointsB: null },
      ],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await recordRoundResult(prisma as any, "m2", { pointsA: 11, pointsB: 7 });
    assert.equal(res.nextRoundCreated, true);
    assert.deepEqual(calls.materializeCreated, [2]);
    assert.equal(res.finished, false);
  });

  // --- WR-02: mexicano re-record of an earlier round whose successor exists → stale_pairings ---
  await checkAsync("mexicano re-record round 1 after round 2 exists → stale_pairings", async () => {
    const { prisma, calls } = fakeDb({
      tournament: { id: "t1", format: "mexicano", scoringMode: "points", totalRounds: 3 },
      rounds: [
        { id: "r1", roundNumber: 1, tournamentId: "t1" },
        { id: "r2", roundNumber: 2, tournamentId: "t1" }, // successor already materialized
      ],
      matches: [
        { id: "m1", roundId: "r1", courtNumber: 0, teamA1Id: "a1", teamA2Id: "a2", teamB1Id: "b1", teamB2Id: "b2", pointsA: 15, pointsB: 9 },
        { id: "m2", roundId: "r2", courtNumber: 0, teamA1Id: "a1", teamA2Id: "b1", teamB1Id: "a2", teamB2Id: "b2", pointsA: null, pointsB: null },
      ],
    });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => recordRoundResult(prisma as any, "m1", { pointsA: 11, pointsB: 13 }),
      (e: unknown) => e instanceof RoundResultError && e.code === "stale_pairings",
    );
    assert.equal(calls.rmUpdated.length, 0); // rolled back, nothing persisted
  });

  // --- WR-02 boundary: recording the LATEST round (no successor) is still allowed ---
  await checkAsync("mexicano record latest round (no successor) allowed", async () => {
    const { prisma, calls } = fakeDb({
      tournament: { id: "t1", format: "mexicano", scoringMode: "points", totalRounds: 3 },
      rounds: [
        { id: "r1", roundNumber: 1, tournamentId: "t1" },
        { id: "r2", roundNumber: 2, tournamentId: "t1" },
      ],
      matches: [
        { id: "m1", roundId: "r1", courtNumber: 0, teamA1Id: "a1", teamA2Id: "a2", teamB1Id: "b1", teamB2Id: "b2", pointsA: 15, pointsB: 9 },
        { id: "m2", roundId: "r2", courtNumber: 0, teamA1Id: "a1", teamA2Id: "b1", teamB1Id: "a2", teamB2Id: "b2", pointsA: null, pointsB: null },
      ],
    });
    // recording m2 (round 2, the latest) → no successor → allowed, materializes round 3.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await recordRoundResult(prisma as any, "m2", { pointsA: 12, pointsB: 10 });
    assert.deepEqual(calls.rmUpdated, [{ id: "m2", pointsA: 12, pointsB: 10 }]);
    assert.equal(res.nextRoundCreated, true);
  });

  // --- mexicano: roundNumber == totalRounds && full → finished (no new round) ---
  await checkAsync("mexicano last round complete → finished", async () => {
    const { prisma, t, calls } = fakeDb({
      tournament: { id: "t1", format: "mexicano", scoringMode: "points", totalRounds: 2 },
      rounds: [
        { id: "r1", roundNumber: 1, tournamentId: "t1" },
        { id: "r2", roundNumber: 2, tournamentId: "t1" },
      ],
      matches: [
        { id: "m1", roundId: "r1", courtNumber: 0, teamA1Id: "a1", teamA2Id: "a2", teamB1Id: "b1", teamB2Id: "b2", pointsA: 15, pointsB: 9 },
        { id: "m2", roundId: "r2", courtNumber: 0, teamA1Id: "a1", teamA2Id: "b1", teamB1Id: "a2", teamB2Id: "b2", pointsA: null, pointsB: null },
      ],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await recordRoundResult(prisma as any, "m2", { pointsA: 12, pointsB: 10 });
    assert.equal(res.finished, true);
    assert.equal(t.status, "finished");
    // materialize-once: round 3 must NOT be created (totalRounds=2).
    assert.deepEqual(calls.materializeCreated, []);
  });

  // --- playoff format → not_round_based (separation guard) ---
  await checkAsync("playoff format rejected with not_round_based", async () => {
    const { prisma, calls } = fakeDb({
      tournament: { id: "t1", format: "playoff", scoringMode: "sets" },
      rounds: [{ id: "r1", roundNumber: 1, tournamentId: "t1" }],
      matches: [{ id: "m1", roundId: "r1", courtNumber: 0, teamA1Id: "a1", teamA2Id: "a2", teamB1Id: "b1", teamB2Id: "b2", pointsA: null, pointsB: null }],
    });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => recordRoundResult(prisma as any, "m1", { sets: [{ gamesPair1: 6, gamesPair2: 4 }] }),
      (e: unknown) => e instanceof RoundResultError && e.code === "not_round_based",
    );
    assert.equal(calls.rmUpdated.length, 0);
  });

  // --- match not found ---
  await checkAsync("unknown roundMatchId → match_not_found", async () => {
    const { prisma } = fakeDb({
      tournament: { id: "t1", format: "round_robin", scoringMode: "points" },
      rounds: [{ id: "r1", roundNumber: 1, tournamentId: "t1" }],
      matches: [],
    });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => recordRoundResult(prisma as any, "nope", { pointsA: 15, pointsB: 9 }),
      (e: unknown) => e instanceof RoundResultError && e.code === "match_not_found",
    );
  });

  console.log(`\n${passed} recordRoundResult assertions passed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
