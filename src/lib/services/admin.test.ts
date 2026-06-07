// Unit tests for the admin services. Run: npx tsx src/lib/services/admin.test.ts
// (No test framework — self-contained assertion script with a hand-written fake
// prisma. Exits non-zero on failure.)
import assert from "node:assert/strict";
import { AdminError, removePair, removeParticipant, finishTournament } from "./admin";

let passed = 0;
async function checkAsync(name: string, fn: () => Promise<void>) {
  await fn();
  passed++;
  console.log(`  ok - ${name}`);
}

// One fake serving as both `prisma` and `tx`: removePair/removeParticipant call
// findUniqueOrThrow + delete inside $transaction(fn => fn(tx)); finishTournament
// calls findUniqueOrThrow on prisma AND delegates to transitionTournament (which
// itself calls findUniqueOrThrow + update). The same object covers both levels.
function fakePrisma(dbStatus: string) {
  const calls = {
    pairDeletedId: null as null | string,
    playerDeletedId: null as null | string,
    updated: null as null | { id: string; status: string },
  };
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
    pair: {
      delete: async ({ where }: { where: { id: string } }) => {
        calls.pairDeletedId = where.id;
        return { id: where.id };
      },
    },
    tournamentPlayer: {
      delete: async ({ where }: { where: { id: string } }) => {
        calls.playerDeletedId = where.id;
        return { id: where.id };
      },
    },
    // $transaction(fn) runs fn with the same fake acting as tx.
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  return { prisma, calls };
}

async function main() {
  // --- removePair ---
  await checkAsync("removePair on registration deletes the pair by id", async () => {
    const { prisma, calls } = fakePrisma("registration");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await removePair(prisma as any, { tournamentId: "t1", pairId: "p1" });
    assert.equal(calls.pairDeletedId, "p1");
  });

  await checkAsync("removePair on in_progress throws AdminError not_open, no delete", async () => {
    const { prisma, calls } = fakePrisma("in_progress");
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => removePair(prisma as any, { tournamentId: "t1", pairId: "p1" }),
      (err: unknown) => err instanceof AdminError && err.code === "not_open",
    );
    assert.equal(calls.pairDeletedId, null);
  });

  await checkAsync("removePair on finished throws AdminError not_open, no delete", async () => {
    const { prisma, calls } = fakePrisma("finished");
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => removePair(prisma as any, { tournamentId: "t1", pairId: "p1" }),
      (err: unknown) => err instanceof AdminError && err.code === "not_open",
    );
    assert.equal(calls.pairDeletedId, null);
  });

  // --- removeParticipant ---
  await checkAsync("removeParticipant on registration deletes the player by id", async () => {
    const { prisma, calls } = fakePrisma("registration");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await removeParticipant(prisma as any, { tournamentId: "t1", playerId: "tp1" });
    assert.equal(calls.playerDeletedId, "tp1");
  });

  await checkAsync("removeParticipant outside registration throws not_open, no delete", async () => {
    const { prisma, calls } = fakePrisma("in_progress");
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => removeParticipant(prisma as any, { tournamentId: "t1", playerId: "tp1" }),
      (err: unknown) => err instanceof AdminError && err.code === "not_open",
    );
    assert.equal(calls.playerDeletedId, null);
  });

  // --- finishTournament ---
  await checkAsync("finishTournament on finished is a no-op (idempotent, no update, no throw)", async () => {
    const { prisma, calls } = fakePrisma("finished");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await finishTournament(prisma as any, "t1");
    assert.equal(calls.updated, null);
  });

  await checkAsync("finishTournament on in_progress transitions to finished", async () => {
    const { prisma, calls } = fakePrisma("in_progress");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await finishTournament(prisma as any, "t1");
    assert.deepEqual(calls.updated, { id: "t1", status: "finished" });
  });

  await checkAsync("finishTournament on registration throws (machine rejects mismatch)", async () => {
    const { prisma, calls } = fakePrisma("registration");
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => finishTournament(prisma as any, "t1"),
    );
    assert.equal(calls.updated, null);
  });
}

main()
  .then(() => {
    console.log(`\nadmin: ${passed} assertions passed.`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
