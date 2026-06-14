// Unit tests for the pure tennis-scoring core (MATCH-01 set rule, MATCH-02 match-winner rule).
// Run: npx tsx src/lib/services/result.test.ts
// (No test framework — self-contained assertion script mirroring bracket.test.ts. All
// cases are synchronous pure-function checks; exits non-zero on failure.)
import assert from "node:assert/strict";
import { setWinner, matchWinnerFromSets, ResultError, recordResult } from "./result";

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

// --- setWinner: more games wins; ANY non-negative integer pair accepted; tie → null ---
check("setWinner 6:4 => A", () => assert.equal(setWinner(6, 4), "A"));
check("setWinner 4:6 => B", () => assert.equal(setWinner(4, 6), "B"));
check("setWinner 7:5 => A", () => assert.equal(setWinner(7, 5), "A"));
check("setWinner 6:0 => A", () => assert.equal(setWinner(6, 0), "A"));
check("setWinner 0:6 => B", () => assert.equal(setWinner(0, 6), "B"));
check("setWinner 4:5 => B (free-form, formerly invalid)", () => assert.equal(setWinner(4, 5), "B"));
check("setWinner 6:5 => A (free-form, formerly invalid)", () => assert.equal(setWinner(6, 5), "A"));
check("setWinner 8:6 => A (free-form overshoot ok)", () => assert.equal(setWinner(8, 6), "A"));
check("setWinner 10:3 => A (free-form)", () => assert.equal(setWinner(10, 3), "A"));
check("setWinner 6:6 => null (tie)", () => assert.equal(setWinner(6, 6), null));
check("setWinner 0:0 => null (tie)", () => assert.equal(setWinner(0, 0), null));

// --- setWinner still rejects non-integer / negative ---
const isInvalidSet = (e: unknown) => e instanceof ResultError && e.code === "invalid_set";
check("setWinner -1:6 throws", () => assert.throws(() => setWinner(-1, 6), isInvalidSet));
check("setWinner 6:-1 throws", () => assert.throws(() => setWinner(6, -1), isInvalidSet));
check("setWinner non-integer 6.5:4 throws", () => assert.throws(() => setWinner(6.5, 4), isInvalidSet));

// --- matchWinnerFromSets (per-set scores): more sets, then total games, else null draw ---
const S = (a: number, b: number) => ({ gamesPair1: a, gamesPair2: b });
check("match 6:4,6:3 => A (2:0 sets)", () => assert.equal(matchWinnerFromSets([S(6, 4), S(6, 3)]), "A"));
check("match 6:4,4:6,7:5 => A (2:1 sets)", () => assert.equal(matchWinnerFromSets([S(6, 4), S(4, 6), S(7, 5)]), "A"));
check("match 4:6,6:4,5:7 => B (2:1 sets)", () => assert.equal(matchWinnerFromSets([S(4, 6), S(6, 4), S(5, 7)]), "B"));
check("match 0:6,0:6 => B (2:0 sets)", () => assert.equal(matchWinnerFromSets([S(0, 6), S(0, 6)]), "B"));
check("match 4:5 single => B (more games, 0:0 sets→games tiebreak)", () => assert.equal(matchWinnerFromSets([S(4, 5)]), "B"));
check("match 6:4,4:6 => null sets tie, games 10:10 → draw", () => assert.equal(matchWinnerFromSets([S(6, 4), S(4, 6)]), null));
check("match 6:4,3:6 => B (1:1 sets, games 9:10 → B)", () => assert.equal(matchWinnerFromSets([S(6, 4), S(3, 6)]), "B"));
check("match [] => null (draw)", () => assert.equal(matchWinnerFromSets([]), null));
check("match 6:6 single tie => null (draw)", () => assert.equal(matchWinnerFromSets([S(6, 6)]), null));

// --- recordResult: hand-written fake prisma/tx (NO real DB) ---
// $transaction(fn) runs fn(tx) with tx === the same fake, so the whole transactional
// path (load → validate → persist → advance → finish) is exercised in-memory. Mirrors
// bracket.test.ts. Records setScore deletes/creates, match updates, status writes.

interface FakeMatch {
  id: string;
  tournamentId: string;
  pairAId: string | null;
  pairBId: string | null;
  winnerId: string | null;
  setsWonA: number | null;
  setsWonB: number | null;
  nextMatchId: string | null;
  nextSlot: string | null;
}
interface FakeSetScore {
  matchId: string;
  setNumber: number;
  gamesPair1: number;
  gamesPair2: number;
}

function fakePrisma(opts: {
  match: Partial<FakeMatch> & { id: string };
  parent?: Partial<FakeMatch> & { id: string };
  status?: string;
}) {
  const tournamentId = "trn-1";
  const matches = new Map<string, FakeMatch>();
  const mkMatch = (m: Partial<FakeMatch> & { id: string }): FakeMatch => ({
    id: m.id,
    tournamentId: m.tournamentId ?? tournamentId,
    pairAId: m.pairAId ?? null,
    pairBId: m.pairBId ?? null,
    winnerId: m.winnerId ?? null,
    setsWonA: m.setsWonA ?? null,
    setsWonB: m.setsWonB ?? null,
    nextMatchId: m.nextMatchId ?? null,
    nextSlot: m.nextSlot ?? null,
  });
  matches.set(opts.match.id, mkMatch(opts.match));
  if (opts.parent) matches.set(opts.parent.id, mkMatch(opts.parent));

  let setScores: FakeSetScore[] = [];
  let status = opts.status ?? "in_progress";
  const setScoreDeletes: string[] = [];
  const statusWrites: { id: string; status: string }[] = [];

  const tx = {
    match: {
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const m = matches.get(where.id);
        if (!m) throw new Error(`no match ${where.id}`);
        return {
          id: m.id,
          tournamentId: m.tournamentId,
          pairAId: m.pairAId,
          pairBId: m.pairBId,
          nextMatchId: m.nextMatchId,
          nextSlot: m.nextSlot,
        };
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<FakeMatch> }) => {
        const m = matches.get(where.id);
        if (!m) throw new Error(`no match ${where.id}`);
        Object.assign(m, data);
        return { ...m };
      },
    },
    setScore: {
      deleteMany: async ({ where }: { where: { matchId: string } }) => {
        setScoreDeletes.push(where.matchId);
        const before = setScores.length;
        setScores = setScores.filter((s) => s.matchId !== where.matchId);
        return { count: before - setScores.length };
      },
      create: async ({ data }: { data: FakeSetScore }) => {
        setScores.push({ ...data });
        return { ...data };
      },
    },
    tournament: {
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => ({ id: where.id, status }),
      update: async ({ where, data }: { where: { id: string }; data: { status: string } }) => {
        status = data.status;
        statusWrites.push({ id: where.id, status: data.status });
        return { id: where.id, status: data.status };
      },
    },
  };
  const prisma = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $transaction: async (fn: (tx: any) => Promise<unknown>) => fn(tx),
  };
  return {
    prisma,
    matches,
    getSetScores: (id: string) => setScores.filter((s) => s.matchId === id),
    setScoreDeletes,
    statusWrites,
    getStatus: () => status,
    tournamentId,
  };
}

async function recordMain() {
  // Advance: both-slots non-final match, sets [{6,4},{6,3}] → winner pairA, 2:0, parent slot updated.
  await checkAsync("recordResult advance 2:0 → winner A, parent slot A filled", async () => {
    const f = fakePrisma({
      match: { id: "m1", pairAId: "pA", pairBId: "pB", nextMatchId: "mP", nextSlot: "A" },
      parent: { id: "mP" },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await recordResult(f.prisma as any, "m1", [
      { gamesPair1: 6, gamesPair2: 4 },
      { gamesPair1: 6, gamesPair2: 3 },
    ]);
    const m1 = f.matches.get("m1")!;
    assert.equal(m1.winnerId, "pA");
    assert.equal(m1.setsWonA, 2);
    assert.equal(m1.setsWonB, 0);
    assert.equal(f.matches.get("mP")!.pairAId, "pA");
    assert.equal(f.getSetScores("m1").length, 2);
    assert.equal(r.finished, false);
    assert.equal(r.winnerId, "pA");
  });

  // nextSlot B routing.
  await checkAsync("recordResult parent slot B routing", async () => {
    const f = fakePrisma({
      match: { id: "m1", pairAId: "pA", pairBId: "pB", nextMatchId: "mP", nextSlot: "B" },
      parent: { id: "mP" },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await recordResult(f.prisma as any, "m1", [
      { gamesPair1: 1, gamesPair2: 6 },
      { gamesPair1: 2, gamesPair2: 6 },
    ]);
    assert.equal(f.matches.get("m1")!.winnerId, "pB");
    assert.equal(f.matches.get("mP")!.pairBId, "pB");
    assert.equal(f.matches.get("mP")!.pairAId, null);
  });

  // 2:1 path: 3 SetScore rows persisted, winner A.
  await checkAsync("recordResult 2:1 → winner A, 3 set rows", async () => {
    const f = fakePrisma({
      match: { id: "m1", pairAId: "pA", pairBId: "pB", nextMatchId: "mP", nextSlot: "A" },
      parent: { id: "mP" },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await recordResult(f.prisma as any, "m1", [
      { gamesPair1: 6, gamesPair2: 4 },
      { gamesPair1: 4, gamesPair2: 6 },
      { gamesPair1: 7, gamesPair2: 5 },
    ]);
    assert.equal(f.matches.get("m1")!.winnerId, "pA");
    assert.equal(f.matches.get("m1")!.setsWonA, 2);
    assert.equal(f.matches.get("m1")!.setsWonB, 1);
    assert.equal(f.getSetScores("m1").length, 3);
  });

  // Final: nextMatchId null → tournament finished, no parent update.
  await checkAsync("recordResult final → tournament finished", async () => {
    const f = fakePrisma({
      match: { id: "mF", pairAId: "pA", pairBId: "pB", nextMatchId: null, nextSlot: null },
      status: "in_progress",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await recordResult(f.prisma as any, "mF", [
      { gamesPair1: 6, gamesPair2: 0 },
      { gamesPair1: 6, gamesPair2: 0 },
    ]);
    assert.equal(f.getStatus(), "finished");
    assert.deepEqual(f.statusWrites, [{ id: f.tournamentId, status: "finished" }]);
    assert.equal(r.finished, true);
    assert.equal(f.matches.get("mF")!.winnerId, "pA");
  });

  // Reject slots_unfilled: pairBId null → nothing persisted.
  await checkAsync("recordResult slots_unfilled reject (nothing persisted)", async () => {
    const f = fakePrisma({
      match: { id: "m1", pairAId: "pA", pairBId: null, nextMatchId: "mP", nextSlot: "A" },
      parent: { id: "mP" },
    });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => recordResult(f.prisma as any, "m1", [{ gamesPair1: 6, gamesPair2: 0 }, { gamesPair1: 6, gamesPair2: 0 }]),
      (e: unknown) => e instanceof ResultError && e.code === "slots_unfilled",
    );
    assert.equal(f.matches.get("m1")!.winnerId, null);
    assert.equal(f.matches.get("mP")!.pairAId, null);
    assert.equal(f.getSetScores("m1").length, 0);
    assert.equal(f.statusWrites.length, 0);
  });

  // PLAYOFF draw reject: [{6,4},{4,6}] → 1:1 sets, 10:10 games → draw, must NOT advance.
  await checkAsync("recordResult playoff draw reject (nothing persisted)", async () => {
    const f = fakePrisma({
      match: { id: "m1", pairAId: "pA", pairBId: "pB", nextMatchId: "mP", nextSlot: "A" },
      parent: { id: "mP" },
    });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => recordResult(f.prisma as any, "m1", [{ gamesPair1: 6, gamesPair2: 4 }, { gamesPair1: 4, gamesPair2: 6 }]),
      (e: unknown) => e instanceof ResultError && e.code === "draw",
    );
    assert.equal(f.matches.get("m1")!.winnerId, null);
    assert.equal(f.getSetScores("m1").length, 0);
    assert.equal(f.matches.get("mP")!.pairAId, null);
  });

  // Free-form decisive single set: [{4,5}] → B wins (more games), advances.
  await checkAsync("recordResult single set 4:5 → winner B advances", async () => {
    const f = fakePrisma({
      match: { id: "m1", pairAId: "pA", pairBId: "pB", nextMatchId: "mP", nextSlot: "A" },
      parent: { id: "mP" },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await recordResult(f.prisma as any, "m1", [{ gamesPair1: 4, gamesPair2: 5 }]);
    assert.equal(r.winnerId, "pB");
    assert.equal(f.matches.get("m1")!.setsWonB, 1);
    assert.equal(f.matches.get("mP")!.pairAId, "pB");
    assert.equal(f.getSetScores("m1").length, 1);
  });

  // Free-form: any number of sets accepted (4 sets, no cap).
  await checkAsync("recordResult accepts 4 sets (no upper cap)", async () => {
    const f = fakePrisma({
      match: { id: "m1", pairAId: "pA", pairBId: "pB", nextMatchId: "mP", nextSlot: "A" },
      parent: { id: "mP" },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await recordResult(f.prisma as any, "m1", [
      { gamesPair1: 6, gamesPair2: 0 },
      { gamesPair1: 6, gamesPair2: 0 },
      { gamesPair1: 0, gamesPair2: 6 },
      { gamesPair1: 6, gamesPair2: 0 },
    ]);
    assert.equal(r.winnerId, "pA");
    assert.equal(f.matches.get("m1")!.setsWonA, 3);
    assert.equal(f.matches.get("m1")!.setsWonB, 1);
    assert.equal(f.getSetScores("m1").length, 4);
  });

  // Reject empty: [] → ResultError empty.
  await checkAsync("recordResult empty reject", async () => {
    const f = fakePrisma({
      match: { id: "m1", pairAId: "pA", pairBId: "pB", nextMatchId: "mP", nextSlot: "A" },
      parent: { id: "mP" },
    });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => recordResult(f.prisma as any, "m1", []),
      (e: unknown) => e instanceof ResultError && e.code === "empty",
    );
    assert.equal(f.matches.get("m1")!.winnerId, null);
  });

  // Free edit (MATCH-04): record A then re-record B → old set scores gone, winner+parent re-written.
  await checkAsync("recordResult free-edit re-record flips winner + parent slot", async () => {
    const f = fakePrisma({
      match: { id: "m1", pairAId: "pA", pairBId: "pB", nextMatchId: "mP", nextSlot: "A" },
      parent: { id: "mP" },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await recordResult(f.prisma as any, "m1", [{ gamesPair1: 6, gamesPair2: 0 }, { gamesPair1: 6, gamesPair2: 0 }]);
    assert.equal(f.matches.get("m1")!.winnerId, "pA");
    assert.equal(f.matches.get("mP")!.pairAId, "pA");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await recordResult(f.prisma as any, "m1", [{ gamesPair1: 0, gamesPair2: 6 }, { gamesPair1: 0, gamesPair2: 6 }]);
    assert.equal(f.getSetScores("m1").length, 2, "old set rows replaced, exactly 2 remain");
    assert.equal(f.matches.get("m1")!.winnerId, "pB");
    assert.equal(f.matches.get("m1")!.setsWonA, 0);
    assert.equal(f.matches.get("m1")!.setsWonB, 2);
    assert.equal(f.matches.get("mP")!.pairAId, "pB", "parent slot re-written to new winner");
  });

  // Free edit of the FINAL: re-record an already-finished tournament must NOT throw (no-op transition).
  await checkAsync("recordResult re-record final does not throw on already-finished", async () => {
    const f = fakePrisma({
      match: { id: "mF", pairAId: "pA", pairBId: "pB", nextMatchId: null, nextSlot: null },
      status: "in_progress",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await recordResult(f.prisma as any, "mF", [{ gamesPair1: 6, gamesPair2: 0 }, { gamesPair1: 6, gamesPair2: 0 }]);
    assert.equal(f.getStatus(), "finished");
    // re-record with flipped winner — tournament already finished, must not throw.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await recordResult(f.prisma as any, "mF", [{ gamesPair1: 0, gamesPair2: 6 }, { gamesPair1: 0, gamesPair2: 6 }]);
    assert.equal(f.matches.get("mF")!.winnerId, "pB");
    assert.equal(f.getStatus(), "finished");
    assert.equal(r.finished, true);
    // only the first record wrote a status transition; re-record was a no-op.
    assert.equal(f.statusWrites.length, 1);
  });
}

recordMain()
  .then(() => {
    console.log(`\n${passed} assertions passed.`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
