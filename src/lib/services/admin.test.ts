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
// findUniqueOrThrow + deleteMany inside $transaction(fn => fn(tx)); finishTournament
// calls findUniqueOrThrow on prisma AND delegates to transitionTournament (which
// itself calls findUniqueOrThrow + update). The same object covers both levels.
//
// deleteMany is scoped by {id, tournamentId} (WR-02): the fake "owns" exactly one
// (id, tournamentId) pairing per kind; a mismatching tournamentId yields count 0,
// modelling a registration that does not belong to the gated tournament.
function fakePrisma(
  dbStatus: string,
  owned: { pair?: { id: string; tournamentId: string }; player?: { id: string; tournamentId: string } } = {},
) {
  const calls = {
    pairDeleted: null as null | { id: string; tournamentId: string },
    playerDeleted: null as null | { id: string; tournamentId: string },
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
      deleteMany: async ({ where }: { where: { id: string; tournamentId: string } }) => {
        if (owned.pair && owned.pair.id === where.id && owned.pair.tournamentId === where.tournamentId) {
          calls.pairDeleted = { id: where.id, tournamentId: where.tournamentId };
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
    tournamentPlayer: {
      deleteMany: async ({ where }: { where: { id: string; tournamentId: string } }) => {
        if (owned.player && owned.player.id === where.id && owned.player.tournamentId === where.tournamentId) {
          calls.playerDeleted = { id: where.id, tournamentId: where.tournamentId };
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
    // $transaction(fn) runs fn with the same fake acting as tx.
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  return { prisma, calls };
}

async function main() {
  // --- removePair ---
  await checkAsync("removePair on registration deletes the pair scoped by tournamentId", async () => {
    const { prisma, calls } = fakePrisma("registration", { pair: { id: "p1", tournamentId: "t1" } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await removePair(prisma as any, { tournamentId: "t1", pairId: "p1" });
    assert.deepEqual(calls.pairDeleted, { id: "p1", tournamentId: "t1" });
  });

  await checkAsync(
    "removePair with pair from another tournament throws not_open, no delete (WR-02)",
    async () => {
      // Status row for t1 is registration-open, but p1 belongs to t2 → count 0.
      const { prisma, calls } = fakePrisma("registration", { pair: { id: "p1", tournamentId: "t2" } });
      await assert.rejects(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => removePair(prisma as any, { tournamentId: "t1", pairId: "p1" }),
        (err: unknown) => err instanceof AdminError && err.code === "not_open",
      );
      assert.equal(calls.pairDeleted, null);
    },
  );

  await checkAsync("removePair on in_progress throws AdminError not_open, no delete", async () => {
    const { prisma, calls } = fakePrisma("in_progress", { pair: { id: "p1", tournamentId: "t1" } });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => removePair(prisma as any, { tournamentId: "t1", pairId: "p1" }),
      (err: unknown) => err instanceof AdminError && err.code === "not_open",
    );
    assert.equal(calls.pairDeleted, null);
  });

  await checkAsync("removePair on finished throws AdminError not_open, no delete", async () => {
    const { prisma, calls } = fakePrisma("finished", { pair: { id: "p1", tournamentId: "t1" } });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => removePair(prisma as any, { tournamentId: "t1", pairId: "p1" }),
      (err: unknown) => err instanceof AdminError && err.code === "not_open",
    );
    assert.equal(calls.pairDeleted, null);
  });

  // --- removeParticipant ---
  await checkAsync("removeParticipant on registration deletes the player scoped by tournamentId", async () => {
    const { prisma, calls } = fakePrisma("registration", { player: { id: "tp1", tournamentId: "t1" } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await removeParticipant(prisma as any, { tournamentId: "t1", playerId: "tp1" });
    assert.deepEqual(calls.playerDeleted, { id: "tp1", tournamentId: "t1" });
  });

  await checkAsync(
    "removeParticipant with player from another tournament throws not_open, no delete (WR-02)",
    async () => {
      const { prisma, calls } = fakePrisma("registration", { player: { id: "tp1", tournamentId: "t2" } });
      await assert.rejects(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => removeParticipant(prisma as any, { tournamentId: "t1", playerId: "tp1" }),
        (err: unknown) => err instanceof AdminError && err.code === "not_open",
      );
      assert.equal(calls.playerDeleted, null);
    },
  );

  await checkAsync("removeParticipant outside registration throws not_open, no delete", async () => {
    const { prisma, calls } = fakePrisma("in_progress", { player: { id: "tp1", tournamentId: "t1" } });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => removeParticipant(prisma as any, { tournamentId: "t1", playerId: "tp1" }),
      (err: unknown) => err instanceof AdminError && err.code === "not_open",
    );
    assert.equal(calls.playerDeleted, null);
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

  await checkAsync(
    "finishTournament on registration throws typed AdminError not_started, no update (WR-03)",
    async () => {
      const { prisma, calls } = fakePrisma("registration");
      await assert.rejects(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => finishTournament(prisma as any, "t1"),
        (err: unknown) => err instanceof AdminError && err.code === "not_started",
      );
      assert.equal(calls.updated, null);
    },
  );
}

main()
  .then(() => {
    console.log(`\nadmin: ${passed} assertions passed.`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
