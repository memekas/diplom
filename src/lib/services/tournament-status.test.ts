// Unit tests for the tournament status machine. Run: npx tsx src/lib/services/tournament-status.test.ts
// (No test framework — self-contained assertion script; uses a hand-written fake
// prisma for the async transitionTournament cases. Exits non-zero on failure.)
import assert from "node:assert/strict";
import { ALLOWED_TRANSITIONS, isAllowedTransition, transitionTournament } from "./tournament-status";
import { tournamentStatuses } from "@/lib/validation/tournament";

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

// --- ALLOWED_TRANSITIONS shape ---
check("ALLOWED_TRANSITIONS encodes exactly the two forward edges", () => {
  assert.deepEqual(ALLOWED_TRANSITIONS.registration, ["in_progress"]);
  assert.deepEqual(ALLOWED_TRANSITIONS.in_progress, ["finished"]);
  // finished is terminal — no outgoing edges.
  assert.deepEqual((ALLOWED_TRANSITIONS as Record<string, string[]>).finished ?? [], []);
});

// --- isAllowedTransition over all 9 ordered pairs ---
const allowedPairs = new Set(["registration->in_progress", "in_progress->finished"]);
for (const from of tournamentStatuses) {
  for (const to of tournamentStatuses) {
    const key = `${from}->${to}`;
    const expected = allowedPairs.has(key);
    check(`isAllowedTransition ${key} === ${expected}`, () => {
      assert.equal(isAllowedTransition(from, to), expected);
    });
  }
}
check("isAllowedTransition rejects out-of-set value", () => {
  // @ts-expect-error testing runtime guard with invalid value
  assert.equal(isAllowedTransition("registration", "completed"), false);
  // @ts-expect-error testing runtime guard with invalid value
  assert.equal(isAllowedTransition("draft", "in_progress"), false);
});

async function main() {
// --- transitionTournament with a fake prisma ---
function fakePrisma(dbStatus: string) {
  const calls = { updated: null as null | { id: string; status: string } };
  const prisma = {
    tournament: {
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        status: dbStatus,
      }),
      update: async ({ where, data }: { where: { id: string }; data: { status: string } }) => {
        calls.updated = { id: where.id, status: data.status };
        return { id: where.id, status: data.status };
      },
    },
  };
  return { prisma, calls };
}

await checkAsync("transitionTournament updates on allowed edge matching DB status", async () => {
  const { prisma, calls } = fakePrisma("registration");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await transitionTournament(prisma as any, "t1", "registration", "in_progress");
  assert.equal(r.status, "in_progress");
  assert.deepEqual(calls.updated, { id: "t1", status: "in_progress" });
});

await checkAsync("transitionTournament throws when DB status != supplied from (client not trusted)", async () => {
  const { prisma, calls } = fakePrisma("in_progress"); // DB already advanced
  await assert.rejects(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => transitionTournament(prisma as any, "t1", "registration", "in_progress"),
  );
  assert.equal(calls.updated, null); // no write attempted
});

await checkAsync("transitionTournament throws on illegal skip registration→finished", async () => {
  const { prisma, calls } = fakePrisma("registration");
  await assert.rejects(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => transitionTournament(prisma as any, "t1", "registration", "finished"),
  );
  assert.equal(calls.updated, null);
});

await checkAsync("transitionTournament throws on backward edge in_progress→registration", async () => {
  const { prisma, calls } = fakePrisma("in_progress");
  await assert.rejects(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => transitionTournament(prisma as any, "t1", "in_progress", "registration"),
  );
  assert.equal(calls.updated, null);
});

await checkAsync("transitionTournament second forward edge in_progress→finished succeeds", async () => {
  const { prisma, calls } = fakePrisma("in_progress");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await transitionTournament(prisma as any, "t1", "in_progress", "finished");
  assert.equal(r.status, "finished");
  assert.deepEqual(calls.updated, { id: "t1", status: "finished" });
});
}

main()
  .then(() => {
    console.log(`\ntournament-status: ${passed} assertions passed.`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
