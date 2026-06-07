// Unit tests for the americano format engine (FMT-02).
// Run: npx tsx src/lib/services/americano.test.ts
// (No test framework — self-contained assertion script mirroring round-robin.test.ts /
// admin.test.ts. Pure-function cases are synchronous; generateAmericano cases use a
// hand-written fake prisma. Exits non-zero on failure.)
import assert from "node:assert/strict";
import { americanoSchedule, generateAmericano, FormatError } from "./americano";

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

const ids = (n: number) => Array.from({ length: n }, (_, i) => `u${i}`);
const combos = (n: number) => (n * (n - 1)) / 2;

// Set of unordered partnerships ("min|max") over all rounds/courts (both teams).
function partnerships(rounds: { courts: { teamA: [string, string]; teamB: [string, string] }[] }[]): string[] {
  const out: string[] = [];
  for (const r of rounds) {
    for (const c of r.courts) {
      out.push([...c.teamA].sort().join("|"));
      out.push([...c.teamB].sort().join("|"));
    }
  }
  return out;
}

// === americanoSchedule: exact N=4 example from FORMATS §2 ===
// Input [0,1,2,3] (here u0..u3): R1 (0&3 vs 1&2), R2 (0&2 vs 3&1), R3 (0&1 vs 2&3).
check("N=4 → 3 rounds", () => assert.equal(americanoSchedule(ids(4)).length, 3));
check("N=4 → exact FORMATS §2 example", () => {
  const s = americanoSchedule(ids(4));
  // R1: (u0,u3) vs (u1,u2)
  assert.deepEqual(s[0].courts, [{ courtNumber: 0, teamA: ["u0", "u3"], teamB: ["u1", "u2"] }]);
  // R2: (u0,u2) vs (u3,u1)
  assert.deepEqual(s[1].courts, [{ courtNumber: 0, teamA: ["u0", "u2"], teamB: ["u3", "u1"] }]);
  // R3: (u0,u1) vs (u2,u3)
  assert.deepEqual(s[2].courts, [{ courtNumber: 0, teamA: ["u0", "u1"], teamB: ["u2", "u3"] }]);
});

// === partner-once invariant: N=4/8/12/16 → set of partnerships == C(N,2), 0 dupes ===
for (const N of [4, 8, 12, 16]) {
  check(`N=${N} → ${N - 1} rounds`, () => assert.equal(americanoSchedule(ids(N)).length, N - 1));
  check(`N=${N} → ${N / 4} courts per round`, () =>
    americanoSchedule(ids(N)).forEach((r) => assert.equal(r.courts.length, N / 4)));
  check(`N=${N} → partner-once: C(${N},2) partnerships, 0 duplicates`, () => {
    const ps = partnerships(americanoSchedule(ids(N)));
    assert.equal(ps.length, combos(N), "partnership count must equal C(N,2)");
    assert.equal(new Set(ps).size, combos(N), "no duplicate partnerships");
  });
  check(`N=${N} → no player partners self / partnership has 2 distinct players`, () => {
    for (const r of americanoSchedule(ids(N))) {
      for (const c of r.courts) {
        assert.notEqual(c.teamA[0], c.teamA[1]);
        assert.notEqual(c.teamB[0], c.teamB[1]);
      }
    }
  });
}

// === sit-outs: N≡2 mod4 (N=6) → 2 players sit (one partnership idle); N odd (N=5) → 1 BYE ===
check("N=6 → 5 rounds, 1 court each (1 partnership sits → 2 players sit)", () => {
  const s = americanoSchedule(ids(6));
  assert.equal(s.length, 5);
  // 6 players → 3 partnerships, odd → 1 court (2 partnerships), 1 partnership sits.
  s.forEach((r) => assert.equal(r.courts.length, 1));
  for (const r of s) {
    const playing = new Set(r.courts.flatMap((c) => [...c.teamA, ...c.teamB]));
    assert.equal(6 - playing.size, 2, "exactly 2 players sit each round (N≡2 mod4)");
  }
});
check("N=6 → still partner-once (no duplicate partnerships)", () => {
  const ps = partnerships(americanoSchedule(ids(6)));
  assert.equal(new Set(ps).size, ps.length);
});
check("N=5 → 5 rounds, 1 BYE (1 player sits each round)", () => {
  const s = americanoSchedule(ids(5));
  assert.equal(s.length, 5);
  // 5 + BYE = 6 → 3 partnerships, 1 contains BYE (drops), 2 valid → 1 court.
  s.forEach((r) => assert.equal(r.courts.length, 1));
  for (const r of s) {
    const playing = new Set(r.courts.flatMap((c) => [...c.teamA, ...c.teamB]));
    assert.equal(5 - playing.size, 1, "exactly 1 player sits each round (odd N)");
    assert.ok(!playing.has(null as unknown as string), "no BYE sentinel leaks into a court");
  }
});

// === arr[0] fixed: u0 plays in every round (no sit-outs for even-mult-of-4) ===
check("N=8 → u0 participates in every round", () => {
  for (const r of americanoSchedule(ids(8))) {
    const playing = new Set(r.courts.flatMap((c) => [...c.teamA, ...c.teamB]));
    assert.ok(playing.has("u0"), `u0 missing in round ${r.roundNumber}`);
  }
});

// === determinism: same input → identical schedule (no internal shuffle) ===
check("deterministic for fixed input", () =>
  assert.deepEqual(americanoSchedule(ids(8)), americanoSchedule(ids(8))));

// =====================================================================
// generateAmericano — fake-prisma transactional tests (harness from admin.test.ts)
// =====================================================================

interface FakeOpts {
  status: string;
  format: string;
  participantMode: string;
  roundCount?: number;
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
    tournamentPlayer: {
      findMany: async () => opts.players ?? [],
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  return { prisma, calls };
}

async function main() {
  // --- 8 players → 7 rounds + 14 matches (2 courts each), all 4 partnership FKs set ---
  await checkAsync("generateAmericano: 8 players → 7 rounds, 14 matches, 4 FKs set", async () => {
    const players = ids(8).map((u) => ({ userId: u }));
    const { prisma, calls } = fakePrisma({
      status: "registration",
      format: "americano",
      participantMode: "singles",
      players,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await generateAmericano(prisma as any, "t1");
    assert.equal(res.roundsCreated, 7);
    assert.equal(res.matchesCreated, 14); // 7 rounds * 2 courts
    assert.equal(calls.roundsCreated.length, 7);
    assert.equal(calls.matchesCreated.length, 14);
    for (const m of calls.matchesCreated) {
      // Partnership variant: all 4 FKs filled (2 players per team).
      assert.ok(m.teamA1Id != null && m.teamA2Id != null);
      assert.ok(m.teamB1Id != null && m.teamB2Id != null);
      assert.ok(typeof m.courtNumber === "number");
      assert.ok(typeof m.roundId === "string");
    }
  });

  // --- status flip via transitionTournament ---
  await checkAsync("generateAmericano flips registration → in_progress", async () => {
    const { prisma, calls } = fakePrisma({
      status: "registration",
      format: "americano",
      participantMode: "singles",
      players: ids(4).map((u) => ({ userId: u })),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await generateAmericano(prisma as any, "t1");
    assert.deepEqual(calls.transition, { from: "registration", to: "in_progress", status: "in_progress" });
  });

  // --- not_open: status != registration ---
  await checkAsync("generateAmericano throws not_open when not registration", async () => {
    const { prisma, calls } = fakePrisma({
      status: "in_progress",
      format: "americano",
      participantMode: "singles",
      players: ids(4).map((u) => ({ userId: u })),
    });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => generateAmericano(prisma as any, "t1"),
      (e: unknown) => e instanceof FormatError && e.code === "not_open",
    );
    assert.equal(calls.roundsCreated.length, 0);
  });

  // --- wrong_format: format != americano ---
  await checkAsync("generateAmericano throws wrong_format for non-americano", async () => {
    const { prisma } = fakePrisma({
      status: "registration",
      format: "round_robin",
      participantMode: "singles",
      players: ids(4).map((u) => ({ userId: u })),
    });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => generateAmericano(prisma as any, "t1"),
      (e: unknown) => e instanceof FormatError && e.code === "wrong_format",
    );
  });

  // --- already_generated: existing rounds ---
  await checkAsync("generateAmericano throws already_generated when rounds exist", async () => {
    const { prisma, calls } = fakePrisma({
      status: "registration",
      format: "americano",
      participantMode: "singles",
      roundCount: 7,
      players: ids(8).map((u) => ({ userId: u })),
    });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => generateAmericano(prisma as any, "t1"),
      (e: unknown) => e instanceof FormatError && e.code === "already_generated",
    );
    assert.equal(calls.roundsCreated.length, 0);
  });

  // --- no_units: fewer than 4 players ---
  await checkAsync("generateAmericano throws no_units when < 4 players", async () => {
    const { prisma } = fakePrisma({
      status: "registration",
      format: "americano",
      participantMode: "singles",
      players: ids(3).map((u) => ({ userId: u })),
    });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => generateAmericano(prisma as any, "t1"),
      (e: unknown) => e instanceof FormatError && e.code === "no_units",
    );
  });
}

main()
  .then(() => {
    console.log(`\namericano: ${passed} assertions passed.`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
