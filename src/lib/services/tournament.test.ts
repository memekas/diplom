// Unit tests for listTournaments status filter (HOME-01 / plan 03 «Прошедшие турниры»).
// Run: npx tsx src/lib/services/tournament.test.ts
// (No test framework — self-contained node:assert/strict script + hand-written fake
// prisma, mirroring standings.test.ts / admin.test.ts. Exits non-zero on failure.)
import assert from "node:assert/strict";
import { listTournaments } from "./tournament";

let passed = 0;
async function checkAsync(name: string, fn: () => Promise<void>) {
  await fn();
  passed++;
  console.log(`  ok - ${name}`);
}

// Fake prisma capturing the findMany argument; returns a stub array.
function fakePrisma() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calls: any[] = [];
  return {
    calls,
    client: {
      tournament: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        findMany: async (args: any) => {
          calls.push(args);
          return [];
        },
      },
    },
  };
}

async function main() {
  // (a) No status arg → `where` absent (backward compat with (public)/tournaments).
  await checkAsync("listTournaments(prisma): no where filter when no status", async () => {
    const f = fakePrisma();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listTournaments(f.client as any);
    assert.equal(f.calls.length, 1);
    assert.equal("where" in f.calls[0], false);
    // No timeframe → legacy createdAt desc, now emitted as a single-element array.
    assert.deepEqual(f.calls[0].orderBy, [{ createdAt: "desc" }]);
  });

  // (b) status: "registration" → where.status === "registration".
  await checkAsync("listTournaments(prisma, {status:'registration'}): where.status set", async () => {
    const f = fakePrisma();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listTournaments(f.client as any, { status: "registration" });
    assert.equal(f.calls[0].where.status, "registration");
  });

  // (c) status: "finished" → where.status === "finished".
  await checkAsync("listTournaments(prisma, {status:'finished'}): where.status set", async () => {
    const f = fakePrisma();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listTournaments(f.client as any, { status: "finished" });
    assert.equal(f.calls[0].where.status, "finished");
  });

  // (d) timeframe: "upcoming" → date asc (createdAt tiebreak) + future-or-undated where.
  await checkAsync("listTournaments(prisma, {timeframe:'upcoming'}): date asc + future/no-date where", async () => {
    const f = fakePrisma();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listTournaments(f.client as any, { timeframe: "upcoming" });
    assert.deepEqual(f.calls[0].orderBy, [{ date: "asc" }, { createdAt: "desc" }]);
    assert.ok(Array.isArray(f.calls[0].where.AND));
    assert.ok("OR" in f.calls[0].where.AND[0]);
  });

  // (e) timeframe: "past" → date desc + date < today.
  await checkAsync("listTournaments(prisma, {timeframe:'past'}): date desc + past where", async () => {
    const f = fakePrisma();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listTournaments(f.client as any, { timeframe: "past" });
    assert.deepEqual(f.calls[0].orderBy, [{ date: "desc" }, { createdAt: "desc" }]);
    assert.ok(f.calls[0].where.AND[0].date.lt instanceof Date);
  });
}

main()
  .then(() => {
    console.log(`\ntournament: ${passed} assertions passed.`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
