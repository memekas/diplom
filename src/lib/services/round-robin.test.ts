// Unit tests for the round-robin format engine (FMT-01).
// Run: npx tsx src/lib/services/round-robin.test.ts
// (No test framework — self-contained assertion script mirroring result.test.ts /
// admin.test.ts. Pure-function cases are synchronous; generateRoundRobin cases use a
// hand-written fake prisma. Exits non-zero on failure.)
import assert from "node:assert/strict";
import { circleMethodSchedule, generateRoundRobin, FormatError } from "./round-robin";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok - ${name}`);
}
async function checkAsync(name: string, fn: () => Promise<void>) {
  await fn();
  passed++;
  console.log(`  ok - ${name}`);
}

// --- Helpers over circleMethodSchedule output ---
function countMatches<T>(rounds: { matches: { unitA: T; unitB: T }[] }[]): number {
  return rounds.reduce((acc, r) => acc + r.matches.length, 0);
}
// Set of unordered meetings as "min|max" strings.
function meetings(rounds: { matches: { unitA: string; unitB: string }[] }[]): Set<string> {
  const s = new Set<string>();
  for (const r of rounds) {
    for (const m of r.matches) {
      const key = [m.unitA, m.unitB].sort().join("|");
      s.add(key);
    }
  }
  return s;
}
const ids = (n: number) => Array.from({ length: n }, (_, i) => `u${i}`);
const combos = (n: number) => (n * (n - 1)) / 2;

// === circleMethodSchedule: even N=4 ===
check("N=4 → 3 rounds", () => assert.equal(circleMethodSchedule(ids(4)).length, 3));
check("N=4 → 6 matches total (C(4,2))", () =>
  assert.equal(countMatches(circleMethodSchedule(ids(4))), combos(4)));
check("N=4 → 2 matches per round", () =>
  circleMethodSchedule(ids(4)).forEach((r) => assert.equal(r.matches.length, 2)));
check("N=4 → each pair meets exactly once", () => {
  const sched = circleMethodSchedule(ids(4));
  const m = meetings(sched);
  assert.equal(m.size, combos(4));
  assert.equal(countMatches(sched), m.size); // no duplicate meetings
});

// === circleMethodSchedule: even N=6 ===
check("N=6 → 5 rounds", () => assert.equal(circleMethodSchedule(ids(6)).length, 5));
check("N=6 → 15 matches total (C(6,2))", () =>
  assert.equal(countMatches(circleMethodSchedule(ids(6))), combos(6)));
check("N=6 → each pair meets exactly once, no dupes", () => {
  const sched = circleMethodSchedule(ids(6));
  assert.equal(meetings(sched).size, combos(6));
  assert.equal(countMatches(sched), combos(6));
});

// === circleMethodSchedule: odd N=3 (one BYE → 3 rounds, each sits once) ===
check("N=3 → 3 rounds (odd → BYE added)", () =>
  assert.equal(circleMethodSchedule(ids(3)).length, 3));
check("N=3 → 1 match per round (one unit sits)", () =>
  circleMethodSchedule(ids(3)).forEach((r) => assert.equal(r.matches.length, 1)));
check("N=3 → 3 matches total (C(3,2)), no BYE match created", () =>
  assert.equal(countMatches(circleMethodSchedule(ids(3))), combos(3)));
check("N=3 → each pair meets exactly once", () =>
  assert.equal(meetings(circleMethodSchedule(ids(3))).size, combos(3)));
check("N=3 → each unit sits out exactly one round", () => {
  const sched = circleMethodSchedule(ids(3));
  const sitCount: Record<string, number> = Object.fromEntries(ids(3).map((u) => [u, 0]));
  for (const r of sched) {
    const playing = new Set(r.matches.flatMap((m) => [m.unitA, m.unitB]));
    for (const u of ids(3)) if (!playing.has(u)) sitCount[u]++;
  }
  ids(3).forEach((u) => assert.equal(sitCount[u], 1));
});

// === circleMethodSchedule: odd N=5 (one BYE → 5 rounds, each sits once) ===
check("N=5 → 5 rounds", () => assert.equal(circleMethodSchedule(ids(5)).length, 5));
check("N=5 → 10 matches total (C(5,2))", () =>
  assert.equal(countMatches(circleMethodSchedule(ids(5))), combos(5)));
check("N=5 → 2 matches per round (one sits)", () =>
  circleMethodSchedule(ids(5)).forEach((r) => assert.equal(r.matches.length, 2)));
check("N=5 → each pair meets exactly once", () =>
  assert.equal(meetings(circleMethodSchedule(ids(5))).size, combos(5)));
check("N=5 → each unit sits out exactly one round", () => {
  const sched = circleMethodSchedule(ids(5));
  const sitCount: Record<string, number> = Object.fromEntries(ids(5).map((u) => [u, 0]));
  for (const r of sched) {
    const playing = new Set(r.matches.flatMap((m) => [m.unitA, m.unitB]));
    for (const u of ids(5)) if (!playing.has(u)) sitCount[u]++;
  }
  ids(5).forEach((u) => assert.equal(sitCount[u], 1));
});

// === arr[0] fixed: units[0] plays in EVERY round (even N, no sit-outs) ===
check("N=4 → units[0] participates in every round", () => {
  const sched = circleMethodSchedule(ids(4));
  for (const r of sched) {
    const playing = new Set(r.matches.flatMap((m) => [m.unitA, m.unitB]));
    assert.ok(playing.has("u0"), `u0 missing in round ${r.roundNumber}`);
  }
});
check("N=6 → units[0] participates in every round", () => {
  const sched = circleMethodSchedule(ids(6));
  for (const r of sched) {
    const playing = new Set(r.matches.flatMap((m) => [m.unitA, m.unitB]));
    assert.ok(playing.has("u0"), `u0 missing in round ${r.roundNumber}`);
  }
});

// === Determinism: same input → identical schedule (no internal shuffle) ===
check("deterministic for fixed input", () =>
  assert.deepEqual(circleMethodSchedule(ids(6)), circleMethodSchedule(ids(6))));

// === courtNumber contiguous 0-based within each round (no holes after BYE skip) ===
check("N=5 → courtNumber 0-based contiguous per round", () => {
  for (const r of circleMethodSchedule(ids(5))) {
    r.matches.forEach((m, i) => assert.equal(m.courtNumber, i));
  }
});

// =====================================================================
// generateRoundRobin — fake-prisma transactional tests (harness from admin.test.ts)
// =====================================================================

interface FakeOpts {
  status: string;
  format: string;
  participantMode: string;
  roundCount?: number; // existing rounds (generate-once guard)
  pairs?: { id: string; player1Id: string; player2Id: string }[];
  players?: { userId: string }[];
}
function fakePrisma(opts: FakeOpts) {
  const calls = {
    roundsCreated: [] as { tournamentId: string; roundNumber: number; id: string }[],
    matchesCreated: [] as Record<string, unknown>[],
    transition: null as null | { from: string; to: string; status: string },
  };
  let roundSeq = 0;
  const prisma = {
    tournament: {
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        status: opts.status,
        format: opts.format,
        participantMode: opts.participantMode,
      }),
      update: async ({ where, data }: { where: { id: string }; data: { status: string } }) => {
        // transitionTournament's update — record the resulting status.
        calls.transition = { from: "registration", to: data.status, status: data.status };
        return { id: where.id, status: data.status };
      },
    },
    round: {
      count: async () => opts.roundCount ?? 0,
      create: async ({ data, select }: { data: { tournamentId: string; roundNumber: number }; select: unknown }) => {
        void select;
        const id = `r${roundSeq++}`;
        calls.roundsCreated.push({ ...data, id });
        return { id };
      },
    },
    roundMatch: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.matchesCreated.push(data);
        return { id: `rm${calls.matchesCreated.length}` };
      },
    },
    pair: {
      findMany: async () => opts.pairs ?? [],
    },
    tournamentPlayer: {
      findMany: async () => opts.players ?? [],
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  return { prisma, calls };
}

async function main() {
  // --- pairs mode: 4 pairs → 3 rounds + 6 matches, all 4 FKs set ---
  await checkAsync("generateRoundRobin pairs: 4 pairs → 3 rounds, 6 matches", async () => {
    const pairs = [0, 1, 2, 3].map((i) => ({
      id: `p${i}`,
      player1Id: `p${i}a`,
      player2Id: `p${i}b`,
    }));
    const { prisma, calls } = fakePrisma({
      status: "registration",
      format: "round_robin",
      participantMode: "pairs",
      pairs,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await generateRoundRobin(prisma as any, "t1");
    assert.equal(res.roundsCreated, 3);
    assert.equal(res.matchesCreated, 6);
    assert.equal(calls.roundsCreated.length, 3);
    assert.equal(calls.matchesCreated.length, 6);
    // Every match fills all 4 team FKs (pairs reuse the slots).
    for (const m of calls.matchesCreated) {
      assert.ok(m.teamA1Id != null && m.teamA2Id != null);
      assert.ok(m.teamB1Id != null && m.teamB2Id != null);
      assert.ok(typeof m.courtNumber === "number");
      assert.ok(typeof m.roundId === "string");
    }
  });

  // --- singles mode: 4 players → teamA2/teamB2 null ---
  await checkAsync("generateRoundRobin singles: 4 players → teamA2/teamB2 null", async () => {
    const players = [0, 1, 2, 3].map((i) => ({ userId: `u${i}` }));
    const { prisma, calls } = fakePrisma({
      status: "registration",
      format: "round_robin",
      participantMode: "singles",
      players,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await generateRoundRobin(prisma as any, "t1");
    assert.equal(res.roundsCreated, 3);
    assert.equal(res.matchesCreated, 6);
    for (const m of calls.matchesCreated) {
      assert.ok(m.teamA1Id != null && m.teamB1Id != null);
      assert.equal(m.teamA2Id, null);
      assert.equal(m.teamB2Id, null);
    }
  });

  // --- status flip via transitionTournament ---
  await checkAsync("generateRoundRobin flips registration → in_progress", async () => {
    const players = [0, 1, 2, 3].map((i) => ({ userId: `u${i}` }));
    const { prisma, calls } = fakePrisma({
      status: "registration",
      format: "round_robin",
      participantMode: "singles",
      players,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await generateRoundRobin(prisma as any, "t1");
    assert.deepEqual(calls.transition, { from: "registration", to: "in_progress", status: "in_progress" });
  });

  // --- not_open: status != registration ---
  await checkAsync("generateRoundRobin throws not_open when not registration", async () => {
    const { prisma, calls } = fakePrisma({
      status: "in_progress",
      format: "round_robin",
      participantMode: "singles",
      players: [0, 1].map((i) => ({ userId: `u${i}` })),
    });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => generateRoundRobin(prisma as any, "t1"),
      (e: unknown) => e instanceof FormatError && e.code === "not_open",
    );
    assert.equal(calls.roundsCreated.length, 0);
  });

  // --- wrong_format: format != round_robin ---
  await checkAsync("generateRoundRobin throws wrong_format for non-round_robin", async () => {
    const { prisma } = fakePrisma({
      status: "registration",
      format: "playoff",
      participantMode: "pairs",
      pairs: [0, 1].map((i) => ({ id: `p${i}`, player1Id: `p${i}a`, player2Id: `p${i}b` })),
    });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => generateRoundRobin(prisma as any, "t1"),
      (e: unknown) => e instanceof FormatError && e.code === "wrong_format",
    );
  });

  // --- already_generated: existing rounds ---
  await checkAsync("generateRoundRobin throws already_generated when rounds exist", async () => {
    const { prisma, calls } = fakePrisma({
      status: "registration",
      format: "round_robin",
      participantMode: "singles",
      roundCount: 3,
      players: [0, 1, 2, 3].map((i) => ({ userId: `u${i}` })),
    });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => generateRoundRobin(prisma as any, "t1"),
      (e: unknown) => e instanceof FormatError && e.code === "already_generated",
    );
    assert.equal(calls.roundsCreated.length, 0);
  });

  // --- no_units: fewer than 2 participants ---
  await checkAsync("generateRoundRobin throws no_units when < 2 participants", async () => {
    const { prisma } = fakePrisma({
      status: "registration",
      format: "round_robin",
      participantMode: "singles",
      players: [{ userId: "u0" }],
    });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => generateRoundRobin(prisma as any, "t1"),
      (e: unknown) => e instanceof FormatError && e.code === "no_units",
    );
  });
}

main()
  .then(() => {
    console.log(`\nround-robin: ${passed} assertions passed.`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
