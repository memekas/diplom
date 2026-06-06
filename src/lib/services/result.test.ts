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

// --- setWinner valid sets (gamesPerSet = 6) ---
check("setWinner 6:4 => A", () => assert.equal(setWinner(6, 4, 6), "A"));
check("setWinner 4:6 => B", () => assert.equal(setWinner(4, 6, 6), "B"));
check("setWinner 7:5 => A", () => assert.equal(setWinner(7, 5, 6), "A"));
check("setWinner 6:0 => A", () => assert.equal(setWinner(6, 0, 6), "A"));
check("setWinner 0:6 => B", () => assert.equal(setWinner(0, 6, 6), "B"));
check("setWinner 6:3 => A", () => assert.equal(setWinner(6, 3, 6), "A"));
check("setWinner 7:6 tiebreak => A", () => assert.equal(setWinner(7, 6, 6), "A"));
check("setWinner 6:7 tiebreak => B", () => assert.equal(setWinner(6, 7, 6), "B"));

// --- setWinner invalid sets (each throws ResultError code "invalid_set") ---
const isInvalidSet = (e: unknown) => e instanceof ResultError && e.code === "invalid_set";
check("setWinner 6:5 throws", () => assert.throws(() => setWinner(6, 5, 6), isInvalidSet));
check("setWinner 5:6 throws", () => assert.throws(() => setWinner(5, 6, 6), isInvalidSet));
check("setWinner 4:4 throws", () => assert.throws(() => setWinner(4, 4, 6), isInvalidSet));
check("setWinner 8:6 throws", () => assert.throws(() => setWinner(8, 6, 6), isInvalidSet));
check("setWinner 6:6 throws", () => assert.throws(() => setWinner(6, 6, 6), isInvalidSet));
check("setWinner 7:7 throws", () => assert.throws(() => setWinner(7, 7, 6), isInvalidSet));
check("setWinner 6:8 throws", () => assert.throws(() => setWinner(6, 8, 6), isInvalidSet));
check("setWinner -1:6 throws", () => assert.throws(() => setWinner(-1, 6, 6), isInvalidSet));
check("setWinner 6:-1 throws", () => assert.throws(() => setWinner(6, -1, 6), isInvalidSet));
check("setWinner 3:3 throws", () => assert.throws(() => setWinner(3, 3, 6), isInvalidSet));
check("setWinner 0:0 throws", () => assert.throws(() => setWinner(0, 0, 6), isInvalidSet));
check("setWinner non-integer 6.5:4 throws", () => assert.throws(() => setWinner(6.5, 4, 6), isInvalidSet));

// --- setWinner reads gamesPerSet from the param (gamesPerSet = 4) ---
check("setWinner 4:2 gps4 => A", () => assert.equal(setWinner(4, 2, 4), "A"));
check("setWinner 5:4 gps4 tiebreak => A", () => assert.equal(setWinner(5, 4, 4), "A"));
check("setWinner 4:3 gps4 throws", () => assert.throws(() => setWinner(4, 3, 4), isInvalidSet));
check("setWinner 4:4 gps4 throws", () => assert.throws(() => setWinner(4, 4, 4), isInvalidSet));

// --- matchWinnerFromSets (setsPerMatch = 3 unless noted; needed = ceil(3/2) = 2) ---
check("match [A,A] => A (2:0)", () => assert.equal(matchWinnerFromSets(["A", "A"], 3), "A"));
check("match [A,B,A] => A (2:1)", () => assert.equal(matchWinnerFromSets(["A", "B", "A"], 3), "A"));
check("match [B,A,B] => B (2:1)", () => assert.equal(matchWinnerFromSets(["B", "A", "B"], 3), "B"));
check("match [A,B] => null (undecided)", () => assert.equal(matchWinnerFromSets(["A", "B"], 3), null));
check("match [] => null", () => assert.equal(matchWinnerFromSets([], 3), null));
check("match [A] => null (3-set)", () => assert.equal(matchWinnerFromSets(["A"], 3), null));
check("match [B,B] => B (2:0)", () => assert.equal(matchWinnerFromSets(["B", "B"], 3), "B"));
check("match [A] setsPerMatch 1 => A (needed 1)", () => assert.equal(matchWinnerFromSets(["A"], 1), "A"));

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
  setsPerMatch?: number;
  gamesPerSet?: number;
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
          tournament: { setsPerMatch: opts.setsPerMatch ?? 3, gamesPerSet: opts.gamesPerSet ?? 6 },
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

  // Reject no_winner: [{6,4},{4,6}] 1:1 of 3 → no decisive winner.
  await checkAsync("recordResult no_winner reject (nothing persisted)", async () => {
    const f = fakePrisma({
      match: { id: "m1", pairAId: "pA", pairBId: "pB", nextMatchId: "mP", nextSlot: "A" },
      parent: { id: "mP" },
    });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => recordResult(f.prisma as any, "m1", [{ gamesPair1: 6, gamesPair2: 4 }, { gamesPair1: 4, gamesPair2: 6 }]),
      (e: unknown) => e instanceof ResultError && e.code === "no_winner",
    );
    assert.equal(f.matches.get("m1")!.winnerId, null);
    assert.equal(f.getSetScores("m1").length, 0);
    assert.equal(f.matches.get("mP")!.pairAId, null);
  });

  // Reject invalid_set: [{6,5}] bubbled from setWinner.
  await checkAsync("recordResult invalid_set reject (nothing persisted)", async () => {
    const f = fakePrisma({
      match: { id: "m1", pairAId: "pA", pairBId: "pB", nextMatchId: "mP", nextSlot: "A" },
      parent: { id: "mP" },
    });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => recordResult(f.prisma as any, "m1", [{ gamesPair1: 6, gamesPair2: 5 }]),
      (e: unknown) => e instanceof ResultError && e.code === "invalid_set",
    );
    assert.equal(f.matches.get("m1")!.winnerId, null);
    assert.equal(f.getSetScores("m1").length, 0);
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

  // Reject too many sets (> setsPerMatch).
  await checkAsync("recordResult too-many-sets reject (empty code)", async () => {
    const f = fakePrisma({
      match: { id: "m1", pairAId: "pA", pairBId: "pB", nextMatchId: "mP", nextSlot: "A" },
      parent: { id: "mP" },
      setsPerMatch: 3,
    });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => recordResult(f.prisma as any, "m1", [
        { gamesPair1: 6, gamesPair2: 0 },
        { gamesPair1: 6, gamesPair2: 0 },
        { gamesPair1: 6, gamesPair2: 0 },
        { gamesPair1: 6, gamesPair2: 0 },
      ]),
      (e: unknown) => e instanceof ResultError && e.code === "empty",
    );
    assert.equal(f.matches.get("m1")!.winnerId, null);
    assert.equal(f.getSetScores("m1").length, 0);
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
