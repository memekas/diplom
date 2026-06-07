// Unit tests for the transactional registerPair integrity service (REG-02, REG-03).
// Run: npx tsx src/lib/services/registration.test.ts
// (No test framework — self-contained assertion script with a hand-written fake
// prisma whose $transaction(fn) invokes fn(tx) with the same fake. Exits non-zero
// on failure. async cases live in main() because tsx emits CJS — no top-level await.)
import assert from "node:assert/strict";
import { registerPair, registerSingle, findUserIdByNickname, RegistrationError } from "./registration";

let passed = 0;
async function checkAsync(name: string, fn: () => Promise<void>) {
  await fn();
  passed++;
  console.log(`  ok - ${name}`);
}

// Configurable fake: $transaction(fn) runs fn(tx) with `tx` === the same fake, so
// every check + the insert exercise the single-transaction path (Pitfall 7).
function fakePrisma(opts: {
  status: string;
  size: number;
  count: number;
  existingPair?: { id: string } | null;
  level?: string;
  participantMode?: string;
  // skillLevel per player for registerPair level-check (tx.user.findMany).
  playerLevels?: Array<{ id: string; skillLevel: string }>;
}) {
  const level = opts.level ?? "intermediate";
  const participantMode = opts.participantMode ?? "pairs";
  const calls = {
    created: null as null | { tournamentId: string; player1Id: string; player2Id: string },
    countWhere: null as null | unknown,
    findFirstWhere: null as null | unknown,
    inTransaction: false,
  };
  const tx = {
    tournament: {
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        status: opts.status,
        size: opts.size,
        level,
        participantMode,
      }),
    },
    user: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        opts.playerLevels ?? where.id.in.map((id) => ({ id, skillLevel: level })),
    },
    pair: {
      count: async ({ where }: { where: unknown }) => {
        calls.countWhere = where;
        return opts.count;
      },
      findFirst: async ({ where }: { where: unknown }) => {
        calls.findFirstWhere = where;
        return opts.existingPair ?? null;
      },
      create: async ({ data }: { data: { tournamentId: string; player1Id: string; player2Id: string } }) => {
        calls.created = { tournamentId: data.tournamentId, player1Id: data.player1Id, player2Id: data.player2Id };
        return { id: "p-new", createdAt: new Date(), ...data };
      },
    },
  };
  const prisma = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $transaction: async (fn: (tx: any) => Promise<unknown>) => {
      calls.inTransaction = true;
      return fn(tx);
    },
  };
  return { prisma, calls };
}

// Fake prisma for registerSingle (TournamentPlayer path).
function fakeSinglePrisma(opts: {
  status: string;
  size: number;
  count: number;
  existingPlayer?: { id: string } | null;
  level?: string;
  participantMode?: string;
  meSkillLevel?: string;
}) {
  const level = opts.level ?? "intermediate";
  const participantMode = opts.participantMode ?? "singles";
  const meSkillLevel = opts.meSkillLevel ?? level;
  const calls = {
    created: null as null | { tournamentId: string; userId: string },
    countWhere: null as null | unknown,
    inTransaction: false,
  };
  const tx = {
    tournament: {
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        status: opts.status,
        size: opts.size,
        level,
        participantMode,
      }),
    },
    user: {
      findUniqueOrThrow: async () => ({ skillLevel: meSkillLevel }),
    },
    tournamentPlayer: {
      count: async ({ where }: { where: unknown }) => {
        calls.countWhere = where;
        return opts.count;
      },
      findUnique: async () => opts.existingPlayer ?? null,
      create: async ({ data }: { data: { tournamentId: string; userId: string } }) => {
        calls.created = { tournamentId: data.tournamentId, userId: data.userId };
        return { id: "tp-new", createdAt: new Date(), ...data };
      },
    },
  };
  const prisma = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $transaction: async (fn: (tx: any) => Promise<unknown>) => {
      calls.inTransaction = true;
      return fn(tx);
    },
  };
  return { prisma, calls };
}

// Minimal fake for findUserIdByNickname (a direct prisma.user.findUnique, NOT in a
// transaction). Returns the configured user (or null on miss) and records the where.
function fakeUserLookup(found: { id: string } | null) {
  const calls = { findUniqueWhere: null as null | { nickname: string } };
  const prisma = {
    user: {
      findUnique: async ({ where }: { where: { nickname: string } }) => {
        calls.findUniqueWhere = where;
        return found;
      },
    },
  };
  return { prisma, calls };
}

async function main() {
  await checkAsync("self-partner rejected with no create (RegistrationError self_partner)", async () => {
    const { prisma, calls } = fakePrisma({ status: "registration", size: 8, count: 0 });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => registerPair(prisma as any, { tournamentId: "t1", player1Id: "u1", player2Id: "u1" }),
      (e: unknown) => e instanceof RegistrationError && e.code === "self_partner",
    );
    assert.equal(calls.created, null);
  });

  await checkAsync("not-open status rejected with no create (status guard REG-03)", async () => {
    const { prisma, calls } = fakePrisma({ status: "in_progress", size: 8, count: 0 });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => registerPair(prisma as any, { tournamentId: "t1", player1Id: "u1", player2Id: "u2" }),
      (e: unknown) => e instanceof RegistrationError && e.code === "not_open",
    );
    assert.equal(calls.created, null);
  });

  await checkAsync("over-capacity rejected with no create (count == size, REG-03)", async () => {
    const { prisma, calls } = fakePrisma({ status: "registration", size: 4, count: 4 });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => registerPair(prisma as any, { tournamentId: "t1", player1Id: "u1", player2Id: "u2" }),
      (e: unknown) => e instanceof RegistrationError && e.code === "tournament_full",
    );
    assert.equal(calls.created, null);
  });

  await checkAsync("either-slot duplicate rejected with no create (REG-02)", async () => {
    const { prisma, calls } = fakePrisma({
      status: "registration",
      size: 8,
      count: 1,
      existingPair: { id: "p-existing" },
    });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => registerPair(prisma as any, { tournamentId: "t1", player1Id: "u1", player2Id: "u2" }),
      (e: unknown) => e instanceof RegistrationError && e.code === "already_registered",
    );
    assert.equal(calls.created, null);
  });

  await checkAsync("happy path creates exactly one pair and returns it (REG-01)", async () => {
    const { prisma, calls } = fakePrisma({ status: "registration", size: 8, count: 2, existingPair: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await registerPair(prisma as any, { tournamentId: "t1", player1Id: "u1", player2Id: "u2" });
    assert.deepEqual(calls.created, { tournamentId: "t1", player1Id: "u1", player2Id: "u2" });
    assert.equal(r.player1Id, "u1");
    assert.equal(r.player2Id, "u2");
    assert.equal(r.tournamentId, "t1");
    assert.equal(calls.inTransaction, true);
  });

  await checkAsync("findFirst either-slot query covers both players in both slots", async () => {
    const { prisma, calls } = fakePrisma({ status: "registration", size: 8, count: 1, existingPair: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await registerPair(prisma as any, { tournamentId: "t1", player1Id: "u1", player2Id: "u2" });
    // The duplicate check must look for either player in either slot of this tournament.
    const where = calls.findFirstWhere as { tournamentId: string; OR: unknown[] };
    assert.equal(where.tournamentId, "t1");
    assert.equal(Array.isArray(where.OR), true);
    assert.equal(where.OR.length, 2);
  });

  // --- findUserIdByNickname (REG-04) ---
  await checkAsync("findUserIdByNickname returns id for a known nick (exact lookup)", async () => {
    const { prisma, calls } = fakeUserLookup({ id: "u2" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const id = await findUserIdByNickname(prisma as any, "bob");
    assert.equal(id, "u2");
    assert.deepEqual(calls.findUniqueWhere, { nickname: "bob" });
  });

  await checkAsync("findUserIdByNickname throws partner_not_found on unknown nick (creates nothing)", async () => {
    const { prisma, calls } = fakeUserLookup(null);
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => findUserIdByNickname(prisma as any, "ghost"),
      (e: unknown) => e instanceof RegistrationError && e.code === "partner_not_found",
    );
    // No pair model touched — lookup-only fake has no pair.create to call.
    assert.deepEqual(calls.findUniqueWhere, { nickname: "ghost" });
  });

  // --- registerPair level + mode (REG-05, Pitfall 5/6) ---
  await checkAsync("registerPair passes when both players match tournament level (insert called)", async () => {
    const { prisma, calls } = fakePrisma({
      status: "registration",
      size: 8,
      count: 0,
      level: "advanced",
      playerLevels: [{ id: "u1", skillLevel: "advanced" }, { id: "u2", skillLevel: "advanced" }],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await registerPair(prisma as any, { tournamentId: "t1", player1Id: "u1", player2Id: "u2" });
    assert.deepEqual(calls.created, { tournamentId: "t1", player1Id: "u1", player2Id: "u2" });
  });

  await checkAsync("registerPair throws level_mismatch when player1 level differs (no create)", async () => {
    const { prisma, calls } = fakePrisma({
      status: "registration",
      size: 8,
      count: 0,
      level: "advanced",
      playerLevels: [{ id: "u1", skillLevel: "intermediate" }, { id: "u2", skillLevel: "advanced" }],
    });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => registerPair(prisma as any, { tournamentId: "t1", player1Id: "u1", player2Id: "u2" }),
      (e: unknown) => e instanceof RegistrationError && e.code === "level_mismatch",
    );
    assert.equal(calls.created, null);
  });

  await checkAsync("registerPair throws level_mismatch when only player2 mismatches (both checked)", async () => {
    const { prisma, calls } = fakePrisma({
      status: "registration",
      size: 8,
      count: 0,
      level: "advanced",
      playerLevels: [{ id: "u1", skillLevel: "advanced" }, { id: "u2", skillLevel: "beginner" }],
    });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => registerPair(prisma as any, { tournamentId: "t1", player1Id: "u1", player2Id: "u2" }),
      (e: unknown) => e instanceof RegistrationError && e.code === "level_mismatch",
    );
    assert.equal(calls.created, null);
  });

  await checkAsync("registerPair throws wrong_mode when tournament is singles (no create)", async () => {
    const { prisma, calls } = fakePrisma({
      status: "registration",
      size: 8,
      count: 0,
      participantMode: "singles",
    });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => registerPair(prisma as any, { tournamentId: "t1", player1Id: "u1", player2Id: "u2" }),
      (e: unknown) => e instanceof RegistrationError && e.code === "wrong_mode",
    );
    assert.equal(calls.created, null);
  });

  // --- registerSingle (REG-06) ---
  await checkAsync("registerSingle happy path creates exactly one TournamentPlayer", async () => {
    const { prisma, calls } = fakeSinglePrisma({ status: "registration", size: 8, count: 2 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await registerSingle(prisma as any, { tournamentId: "t1", userId: "u1" });
    assert.deepEqual(calls.created, { tournamentId: "t1", userId: "u1" });
    assert.equal(r.userId, "u1");
    assert.equal(r.tournamentId, "t1");
    assert.equal(calls.inTransaction, true);
  });

  await checkAsync("registerSingle throws not_open when status != registration (no create)", async () => {
    const { prisma, calls } = fakeSinglePrisma({ status: "in_progress", size: 8, count: 0 });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => registerSingle(prisma as any, { tournamentId: "t1", userId: "u1" }),
      (e: unknown) => e instanceof RegistrationError && e.code === "not_open",
    );
    assert.equal(calls.created, null);
  });

  await checkAsync("registerSingle throws wrong_mode when tournament is pairs (no create)", async () => {
    const { prisma, calls } = fakeSinglePrisma({ status: "registration", size: 8, count: 0, participantMode: "pairs" });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => registerSingle(prisma as any, { tournamentId: "t1", userId: "u1" }),
      (e: unknown) => e instanceof RegistrationError && e.code === "wrong_mode",
    );
    assert.equal(calls.created, null);
  });

  await checkAsync("registerSingle throws level_mismatch when player level differs (no create)", async () => {
    const { prisma, calls } = fakeSinglePrisma({
      status: "registration",
      size: 8,
      count: 0,
      level: "advanced",
      meSkillLevel: "beginner",
    });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => registerSingle(prisma as any, { tournamentId: "t1", userId: "u1" }),
      (e: unknown) => e instanceof RegistrationError && e.code === "level_mismatch",
    );
    assert.equal(calls.created, null);
  });

  await checkAsync("registerSingle throws tournament_full by TournamentPlayer count >= size (no create)", async () => {
    const { prisma, calls } = fakeSinglePrisma({ status: "registration", size: 4, count: 4 });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => registerSingle(prisma as any, { tournamentId: "t1", userId: "u1" }),
      (e: unknown) => e instanceof RegistrationError && e.code === "tournament_full",
    );
    assert.equal(calls.created, null);
  });

  await checkAsync("registerSingle throws already_registered on duplicate TournamentPlayer (no create)", async () => {
    const { prisma, calls } = fakeSinglePrisma({
      status: "registration",
      size: 8,
      count: 1,
      existingPlayer: { id: "tp-existing" },
    });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => registerSingle(prisma as any, { tournamentId: "t1", userId: "u1" }),
      (e: unknown) => e instanceof RegistrationError && e.code === "already_registered",
    );
    assert.equal(calls.created, null);
  });
}

main()
  .then(() => {
    console.log(`\nregistration service: ${passed} assertions passed.`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
