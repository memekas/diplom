// Unit tests for the format-engine dispatch. Run: npx tsx src/lib/services/format-engine.test.ts
// (No test framework — self-contained assertion script with a hand-written fake prisma,
// same harness style as admin.test.ts. Exits non-zero on failure.)
//
// These tests assert ROUTING only: startFormat reads tournament.format and reaches the
// correct generator (round-based → Round.create; playoff → Match.create), and
// recordFormatResult routes by format to the correct recorder (playoff → SetScore path
// via recordResult; round-based → RoundMatch.update path via recordRoundResult). The
// generator/recorder internals are exhaustively covered by their own test files; here we
// only verify the dispatch picks the right one based on the DB-read format.
import assert from "node:assert/strict";
import { startFormat, recordFormatResult } from "./format-engine";

let passed = 0;
async function checkAsync(name: string, fn: () => Promise<void>) {
  await fn();
  passed++;
  console.log(`  ok - ${name}`);
}

// Fake prisma serving as both `prisma` and `tx` (generators call $transaction(fn => fn(tx))).
// It records which CREATE path fired so a test can assert the route taken. The fake fills
// in only the minimal selects/counts the generators read on their happy path for the given
// participant/size config.
type Flags = {
  roundCreated: boolean; // a Round row was created → round-based generator ran
  matchCreated: boolean; // a Match row was created → playoff generator ran
  setScoreWritten: boolean; // SetScore deleteMany/create → recordResult (playoff) ran
  roundMatchUpdated: boolean; // RoundMatch.update with points → recordRoundResult ran
};

function fakeStartPrisma(config: {
  format: string;
  participantMode: string;
  size: number;
  pairCount: number;
  playerCount: number;
}) {
  const flags: Flags = {
    roundCreated: false,
    matchCreated: false,
    setScoreWritten: false,
    roundMatchUpdated: false,
  };

  const prisma: Record<string, unknown> = {
    tournament: {
      findUniqueOrThrow: async ({ select }: { select?: Record<string, boolean> }) => {
        const row: Record<string, unknown> = {
          id: "t1",
          status: "registration",
          format: config.format,
          participantMode: config.participantMode,
          size: config.size,
        };
        // narrow to selected keys (generators select different subsets)
        if (!select) return row;
        const out: Record<string, unknown> = {};
        for (const k of Object.keys(select)) out[k] = row[k];
        return out;
      },
      update: async () => ({ id: "t1", status: "in_progress" }),
    },
    pair: {
      count: async () => config.pairCount,
      findMany: async () =>
        Array.from({ length: config.pairCount }, (_, i) => ({
          id: `p${i}`,
          player1Id: `u${i}a`,
          player2Id: `u${i}b`,
        })),
      update: async () => ({}),
    },
    tournamentPlayer: {
      findMany: async () =>
        Array.from({ length: config.playerCount }, (_, i) => ({ userId: `u${i}` })),
    },
    round: {
      count: async () => 0,
      create: async ({ select }: { select?: Record<string, boolean> }) => {
        flags.roundCreated = true;
        return select?.id ? { id: `r${Math.random()}` } : {};
      },
    },
    roundMatch: {
      create: async () => ({}),
    },
    match: {
      count: async () => 0,
      create: async ({ select }: { select?: Record<string, boolean> }) => {
        flags.matchCreated = true;
        return select?.id ? { id: `m${Math.random()}` } : {};
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  return { prisma, flags };
}

function fakeRecordPrisma(config: {
  format: string;
  scoringMode: string;
}) {
  const flags: Flags = {
    roundCreated: false,
    matchCreated: false,
    setScoreWritten: false,
    roundMatchUpdated: false,
  };

  const prisma: Record<string, unknown> = {
    tournament: {
      findUniqueOrThrow: async ({ select }: { select?: Record<string, boolean> }) => {
        const row: Record<string, unknown> = {
          id: "t1",
          format: config.format,
          scoringMode: config.scoringMode,
          totalRounds: null,
          status: "in_progress",
        };
        if (!select) return row;
        const out: Record<string, unknown> = {};
        for (const k of Object.keys(select)) out[k] = row[k];
        return out;
      },
    },
    // recordResult (playoff) path
    match: {
      findUniqueOrThrow: async () => ({
        id: "m1",
        tournamentId: "t1",
        pairAId: "pa",
        pairBId: "pb",
        // non-final match → winner advances to a parent (UPDATE), no tournament finish
        // → keeps this routing test free of the status-machine path.
        nextMatchId: "parent1",
        nextSlot: "A",
      }),
      update: async () => ({}),
    },
    setScore: {
      deleteMany: async () => {
        flags.setScoreWritten = true;
        return { count: 0 };
      },
      create: async () => {
        flags.setScoreWritten = true;
        return {};
      },
    },
    // recordRoundResult (round-based) path
    roundMatch: {
      findUnique: async () => ({
        id: "rm1",
        courtNumber: 0,
        teamA1Id: "u0",
        teamA2Id: "u1",
        teamB1Id: "u2",
        teamB2Id: "u3",
        round: { id: "r1", roundNumber: 1, tournamentId: "t1" },
      }),
      update: async () => {
        flags.roundMatchUpdated = true;
        return {};
      },
      count: async () => 1, // > 0 → not the last/complete round; no finish/materialize
    },
    playerMatchScore: {
      deleteMany: async () => ({ count: 0 }),
      create: async () => ({}),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  return { prisma, flags };
}

// Build playoff set-score FormData (set1_a/set1_b ...), best-of-3 → 2:0.
function playoffForm(): FormData {
  const fd = new FormData();
  fd.set("set1_a", "6");
  fd.set("set1_b", "0");
  fd.set("set2_a", "6");
  fd.set("set2_b", "0");
  return fd;
}

// Build round-based points FormData.
function pointsForm(a: string, b: string): FormData {
  const fd = new FormData();
  fd.set("points_a", a);
  fd.set("points_b", b);
  return fd;
}

async function main() {
  // --- startFormat routing ---
  await checkAsync("startFormat playoff → generateBracket (Match created, no Round)", async () => {
    const { prisma, flags } = fakeStartPrisma({
      format: "playoff",
      participantMode: "pairs",
      size: 4,
      pairCount: 4,
      playerCount: 0,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await startFormat(prisma as any, "t1");
    assert.equal(flags.matchCreated, true, "expected Match.create");
    assert.equal(flags.roundCreated, false, "did not expect Round.create");
  });

  await checkAsync("startFormat round_robin → generateRoundRobin (Round created, no Match)", async () => {
    const { prisma, flags } = fakeStartPrisma({
      format: "round_robin",
      participantMode: "pairs",
      size: 4,
      pairCount: 4,
      playerCount: 0,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await startFormat(prisma as any, "t1");
    assert.equal(flags.roundCreated, true, "expected Round.create");
    assert.equal(flags.matchCreated, false, "did not expect Match.create");
  });

  await checkAsync("startFormat americano → generateAmericano (Round created, no Match)", async () => {
    const { prisma, flags } = fakeStartPrisma({
      format: "americano",
      participantMode: "singles",
      size: 4,
      pairCount: 0,
      playerCount: 8,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await startFormat(prisma as any, "t1");
    assert.equal(flags.roundCreated, true, "expected Round.create");
    assert.equal(flags.matchCreated, false, "did not expect Match.create");
  });

  await checkAsync("startFormat mexicano → generateMexicanoRound1 (Round created, no Match)", async () => {
    const { prisma, flags } = fakeStartPrisma({
      format: "mexicano",
      participantMode: "singles",
      size: 8,
      pairCount: 0,
      playerCount: 8,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await startFormat(prisma as any, "t1");
    assert.equal(flags.roundCreated, true, "expected Round.create");
    assert.equal(flags.matchCreated, false, "did not expect Match.create");
  });

  await checkAsync("startFormat unknown format throws (defensive default)", async () => {
    const { prisma } = fakeStartPrisma({
      format: "bogus",
      participantMode: "pairs",
      size: 4,
      pairCount: 4,
      playerCount: 0,
    });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => startFormat(prisma as any, "t1"),
      (e: unknown) => e instanceof Error && /Неизвестный формат/.test(e.message),
    );
  });

  // --- recordFormatResult routing ---
  await checkAsync("recordFormatResult playoff → recordResult (SetScore path)", async () => {
    const { prisma, flags } = fakeRecordPrisma({
      format: "playoff",
      scoringMode: "sets",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await recordFormatResult(prisma as any, "t1", "m1", playoffForm());
    assert.equal(r.ok, true);
    assert.equal(flags.setScoreWritten, true, "expected SetScore write (recordResult)");
    assert.equal(flags.roundMatchUpdated, false, "did not expect RoundMatch.update");
  });

  await checkAsync("recordFormatResult round_robin points → recordRoundResult (RoundMatch path)", async () => {
    const { prisma, flags } = fakeRecordPrisma({
      format: "round_robin",
      scoringMode: "points",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await recordFormatResult(prisma as any, "t1", "rm1", pointsForm("9", "6"));
    assert.equal(r.ok, true);
    assert.equal(flags.roundMatchUpdated, true, "expected RoundMatch.update (recordRoundResult)");
    assert.equal(flags.setScoreWritten, false, "did not expect SetScore write");
  });

  await checkAsync("recordFormatResult americano points → recordRoundResult (RoundMatch path)", async () => {
    const { prisma, flags } = fakeRecordPrisma({
      format: "americano",
      scoringMode: "points",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await recordFormatResult(prisma as any, "t1", "rm1", pointsForm("16", "8"));
    assert.equal(r.ok, true);
    assert.equal(flags.roundMatchUpdated, true, "expected RoundMatch.update");
    assert.equal(flags.setScoreWritten, false, "did not expect SetScore write");
  });

  await checkAsync("recordFormatResult playoff with bad form → {ok:false} (no recorder call)", async () => {
    const { prisma, flags } = fakeRecordPrisma({
      format: "playoff",
      scoringMode: "sets",
    });
    const empty = new FormData(); // no sets at all → parser fails
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await recordFormatResult(prisma as any, "t1", "m1", empty);
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.error.length > 0);
    assert.equal(flags.setScoreWritten, false, "recorder must not run on parse failure");
  });

  await checkAsync("recordFormatResult round-based with bad form → {ok:false} (no recorder call)", async () => {
    const { prisma, flags } = fakeRecordPrisma({
      format: "round_robin",
      scoringMode: "points",
    });
    const partial = new FormData();
    partial.set("points_a", "9"); // missing points_b → parser fails
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await recordFormatResult(prisma as any, "t1", "rm1", partial);
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.error.length > 0);
    assert.equal(flags.roundMatchUpdated, false, "recorder must not run on parse failure");
  });
}

main()
  .then(() => {
    console.log(`\nformat-engine: ${passed} assertions passed.`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
