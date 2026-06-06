// Unit tests for the bracket-generation core (BRKT-01, BRKT-03).
// Run: npx tsx src/lib/services/bracket.test.ts
// (No test framework — self-contained assertion script. The pure-math cases
// (advance/ROUNDS/matchCount) run synchronously; the generateBracket cases use a
// hand-written fake prisma whose $transaction(fn) invokes fn(tx) with the same
// fake — NO real DB. async cases live in main() because tsx emits CJS, no
// top-level await. Exits non-zero on failure.)
import assert from "node:assert/strict";
import { advance, ROUNDS, matchCount, generateBracket } from "./bracket";

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

// --- advance() exhaustive round-1 cases (the four spec rows) ---
check("advance(1,0) => {2,0,A}", () => {
  assert.deepEqual(advance(1, 0), { round: 2, position: 0, slot: "A" });
});
check("advance(1,1) => {2,0,B}", () => {
  assert.deepEqual(advance(1, 1), { round: 2, position: 0, slot: "B" });
});
check("advance(1,2) => {2,1,A}", () => {
  assert.deepEqual(advance(1, 2), { round: 2, position: 1, slot: "A" });
});
check("advance(1,3) => {2,1,B}", () => {
  assert.deepEqual(advance(1, 3), { round: 2, position: 1, slot: "B" });
});

// --- advance() general rule across rounds: {round+1, floor(pos/2), pos even?A:B} ---
check("advance general rule holds for many (round,position)", () => {
  for (let round = 1; round <= 4; round++) {
    for (let pos = 0; pos < 8; pos++) {
      assert.deepEqual(advance(round, pos), {
        round: round + 1,
        position: Math.floor(pos / 2),
        slot: pos % 2 === 0 ? "A" : "B",
      });
    }
  }
});

// --- ROUNDS table shape for 4/8/16 ---
check("ROUNDS table is exactly {4:[2,1], 8:[4,2,1], 16:[8,4,2,1]}", () => {
  assert.deepEqual(ROUNDS[4], [2, 1]);
  assert.deepEqual(ROUNDS[8], [4, 2, 1]);
  assert.deepEqual(ROUNDS[16], [8, 4, 2, 1]);
});

for (const size of [4, 8, 16]) {
  check(`ROUNDS[${size}] sums to size-1 (${size - 1})`, () => {
    assert.equal(
      ROUNDS[size].reduce((a, b) => a + b, 0),
      size - 1,
    );
  });
  check(`ROUNDS[${size}] final round has exactly 1 match`, () => {
    assert.equal(ROUNDS[size][ROUNDS[size].length - 1], 1);
  });
}

check("round counts are 2/3/4 for 4/8/16 (length of ROUNDS table)", () => {
  assert.equal(ROUNDS[4].length, 2);
  assert.equal(ROUNDS[8].length, 3);
  assert.equal(ROUNDS[16].length, 4);
});

// --- matchCount(size) === size - 1 ---
check("matchCount(4)=3, matchCount(8)=7, matchCount(16)=15", () => {
  assert.equal(matchCount(4), 3);
  assert.equal(matchCount(8), 7);
  assert.equal(matchCount(16), 15);
});

// --- generateBracket: hand-written fake prisma/tx (NO real DB) ---
// $transaction(fn) runs fn(tx) with tx === the same fake, so every read/guard/write
// in generateBracket exercises the single-transaction path (Pitfall 3). Records every
// match.create, pair.update (seed), and tournament status write.

interface FakeMatch {
  id: string;
  tournamentId: string;
  round: number;
  position: number;
  pairAId: string | null;
  pairBId: string | null;
  nextMatchId: string | null;
  nextSlot: string | null;
}

function fakePrisma(opts: {
  status: string;
  size: number;
  pairCount: number;
  existingMatchCount?: number;
}) {
  let matchSeq = 0;
  const matches: FakeMatch[] = [];
  const seedUpdates: { id: string; seed: number }[] = [];
  const statusWrites: { id: string; status: string }[] = [];
  const pairs = Array.from({ length: opts.pairCount }, (_, i) => ({ id: `pair-${i}` }));

  const tx = {
    tournament: {
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        status: opts.status,
        size: opts.size,
      }),
      // Some implementations may call findUnique
      findUnique: async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        status: opts.status,
        size: opts.size,
      }),
      update: async ({ where, data }: { where: { id: string }; data: { status: string } }) => {
        statusWrites.push({ id: where.id, status: data.status });
        return { id: where.id, status: data.status };
      },
    },
    pair: {
      count: async () => opts.pairCount,
      findMany: async () => pairs.map((p) => ({ ...p })),
      update: async ({ where, data }: { where: { id: string }; data: { seed: number } }) => {
        seedUpdates.push({ id: where.id, seed: data.seed });
        return { id: where.id, seed: data.seed };
      },
    },
    match: {
      count: async () => opts.existingMatchCount ?? 0,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const id = `m-${matchSeq++}`;
        const rec: FakeMatch = {
          id,
          tournamentId: data.tournamentId as string,
          round: data.round as number,
          position: data.position as number,
          pairAId: (data.pairAId as string | undefined) ?? null,
          pairBId: (data.pairBId as string | undefined) ?? null,
          nextMatchId: (data.nextMatchId as string | undefined) ?? null,
          nextSlot: (data.nextSlot as string | undefined) ?? null,
        };
        matches.push(rec);
        return { id, ...rec };
      },
    },
  };
  const prisma = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $transaction: async (fn: (tx: any) => Promise<unknown>) => fn(tx),
  };
  return { prisma, tx, matches, seedUpdates, statusWrites, pairs };
}

async function main() {
  for (const size of [4, 8, 16]) {
    await checkAsync(`generateBracket(size=${size}) creates exactly size-1 matches`, async () => {
      const f = fakePrisma({ status: "registration", size, pairCount: size });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await generateBracket(f.prisma as any, "t1");
      assert.equal(f.matches.length, matchCount(size));
    });

    await checkAsync(`generateBracket(size=${size}) round counts match ROUNDS table`, async () => {
      const f = fakePrisma({ status: "registration", size, pairCount: size });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await generateBracket(f.prisma as any, "t1");
      const expected = ROUNDS[size];
      for (let r = 1; r <= expected.length; r++) {
        const inRound = f.matches.filter((m) => m.round === r).length;
        assert.equal(inRound, expected[r - 1], `round ${r}`);
      }
    });

    await checkAsync(`generateBracket(size=${size}) round-1 fully paired with distinct pairs`, async () => {
      const f = fakePrisma({ status: "registration", size, pairCount: size });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await generateBracket(f.prisma as any, "t1");
      const r1 = f.matches.filter((m) => m.round === 1);
      const usedPairs = new Set<string>();
      for (const m of r1) {
        assert.ok(m.pairAId, "round-1 pairA filled");
        assert.ok(m.pairBId, "round-1 pairB filled");
        assert.notEqual(m.pairAId, m.pairBId, "distinct pairs");
        usedPairs.add(m.pairAId!);
        usedPairs.add(m.pairBId!);
      }
      // every pair used exactly once across round-1
      assert.equal(usedPairs.size, size);
    });

    await checkAsync(`generateBracket(size=${size}) rounds > 1 have null pair slots`, async () => {
      const f = fakePrisma({ status: "registration", size, pairCount: size });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await generateBracket(f.prisma as any, "t1");
      for (const m of f.matches.filter((m) => m.round > 1)) {
        assert.equal(m.pairAId, null);
        assert.equal(m.pairBId, null);
      }
    });

    await checkAsync(`generateBracket(size=${size}) full wiring: parent slots, no orphan/cycle, final unparented`, async () => {
      const f = fakePrisma({ status: "registration", size, pairCount: size });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await generateBracket(f.prisma as any, "t1");
      const byId = new Map(f.matches.map((m) => [m.id, m]));
      const finalRound = ROUNDS[size].length;
      const finals = f.matches.filter((m) => m.round === finalRound);
      assert.equal(finals.length, 1, "exactly one final");
      // final unparented
      assert.equal(finals[0].nextMatchId, null);
      assert.equal(finals[0].nextSlot, null);

      // every non-final match wired to an existing parent with a valid slot;
      // siblings feeding one parent occupy distinct slots; no cycle.
      const slotTaken = new Map<string, Set<string>>();
      for (const m of f.matches) {
        if (m.round === finalRound) continue;
        // not an orphan
        assert.ok(m.nextMatchId, `match ${m.id} has parent`);
        assert.ok(m.nextSlot === "A" || m.nextSlot === "B", "valid slot");
        const parent = byId.get(m.nextMatchId!);
        assert.ok(parent, "parent exists");
        // parent is exactly one round up
        assert.equal(parent!.round, m.round + 1, "parent one round up");
        // slot uniqueness per parent
        const taken = slotTaken.get(m.nextMatchId!) ?? new Set<string>();
        assert.ok(!taken.has(m.nextSlot!), `slot ${m.nextSlot} not double-filled on ${m.nextMatchId}`);
        taken.add(m.nextSlot!);
        slotTaken.set(m.nextMatchId!, taken);
      }
      // every non-final parent receives exactly two feeders (A and B)
      for (const [, taken] of slotTaken) {
        assert.deepEqual([...taken].sort(), ["A", "B"]);
      }
      // each non-final match's parent matches advance() of its (round, position)
      for (const m of f.matches) {
        if (m.round === finalRound) continue;
        const parent = byId.get(m.nextMatchId!)!;
        const exp = advance(m.round, m.position);
        assert.equal(parent.round, exp.round);
        assert.equal(parent.position, exp.position);
        assert.equal(m.nextSlot, exp.slot);
      }
      // no cycle: walking nextMatchId from any match terminates at the final
      for (const start of f.matches) {
        let cur: FakeMatch | undefined = start;
        let hops = 0;
        while (cur && cur.nextMatchId) {
          cur = byId.get(cur.nextMatchId);
          hops++;
          assert.ok(hops <= finalRound, "no cycle / bounded chain");
        }
      }
    });

    await checkAsync(`generateBracket(size=${size}) assigns seeds 1..size`, async () => {
      const f = fakePrisma({ status: "registration", size, pairCount: size });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await generateBracket(f.prisma as any, "t1");
      assert.equal(f.seedUpdates.length, size);
      const seeds = f.seedUpdates.map((s) => s.seed).sort((a, b) => a - b);
      assert.deepEqual(seeds, Array.from({ length: size }, (_, i) => i + 1));
      // distinct pairs seeded
      assert.equal(new Set(f.seedUpdates.map((s) => s.id)).size, size);
    });

    await checkAsync(`generateBracket(size=${size}) happy path flips status to in_progress`, async () => {
      const f = fakePrisma({ status: "registration", size, pairCount: size });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await generateBracket(f.prisma as any, "t1");
      assert.deepEqual(f.statusWrites, [{ id: "t1", status: "in_progress" }]);
    });
  }

  // --- Reject paths: nothing created, no status flip (BRKT-03 + guards) ---
  await checkAsync("rejects when status != registration (nothing created)", async () => {
    const f = fakePrisma({ status: "in_progress", size: 8, pairCount: 8 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assert.rejects(() => generateBracket(f.prisma as any, "t1"));
    assert.equal(f.matches.length, 0);
    assert.equal(f.seedUpdates.length, 0);
    assert.equal(f.statusWrites.length, 0);
  });

  await checkAsync("rejects when pair count < size (nothing created)", async () => {
    const f = fakePrisma({ status: "registration", size: 8, pairCount: 7 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assert.rejects(() => generateBracket(f.prisma as any, "t1"));
    assert.equal(f.matches.length, 0);
    assert.equal(f.seedUpdates.length, 0);
    assert.equal(f.statusWrites.length, 0);
  });

  await checkAsync("rejects when pair count > size (nothing created)", async () => {
    const f = fakePrisma({ status: "registration", size: 8, pairCount: 9 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assert.rejects(() => generateBracket(f.prisma as any, "t1"));
    assert.equal(f.matches.length, 0);
    assert.equal(f.statusWrites.length, 0);
  });

  await checkAsync("rejects when any Match already exists — BRKT-03 immutability (nothing created)", async () => {
    const f = fakePrisma({ status: "registration", size: 8, pairCount: 8, existingMatchCount: 1 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assert.rejects(() => generateBracket(f.prisma as any, "t1"));
    assert.equal(f.matches.length, 0);
    assert.equal(f.seedUpdates.length, 0);
    assert.equal(f.statusWrites.length, 0);
  });

  await checkAsync("rejects when size has no ROUNDS entry (e.g. 6) — nothing created", async () => {
    const f = fakePrisma({ status: "registration", size: 6, pairCount: 6 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assert.rejects(() => generateBracket(f.prisma as any, "t1"));
    assert.equal(f.matches.length, 0);
    assert.equal(f.statusWrites.length, 0);
  });
}

main()
  .then(() => {
    console.log(`\nbracket: ${passed} assertions passed.`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
