// Unit tests for the mexicano engine (FMT-02): pure quad cut / cross-pair "1+4 vs 2+3"
// + determinism, generateMexicanoRound1 (Round-1-only baseline), and
// materializeNextMexicanoRound (gate + re-sort + cross-pair, materialize-once).
// Run: npx tsx src/lib/services/mexicano.test.ts
// No test framework — self-contained assertion script mirroring result.test.ts /
// bracket.test.ts. Exits non-zero on failure.
import assert from "node:assert/strict";
import {
  quadCut,
  crossPairQuad,
  round1Cut,
  crossPairCut,
  generateMexicanoRound1,
  materializeNextMexicanoRound,
  FormatError,
} from "./mexicano";

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

// ── crossPairQuad: LOCKED D1 "1+4 vs 2+3" = A=(s0,s3), B=(s1,s2) ──────────────
check("crossPairQuad A=(s0,s3) B=(s1,s2)", () => {
  const r = crossPairQuad(["s0", "s1", "s2", "s3"]);
  assert.deepEqual(r.teamA, ["s0", "s3"]);
  assert.deepEqual(r.teamB, ["s1", "s2"]);
});

// ── quadCut: consecutive quads, court = group index ──────────────────────────
check("quadCut 8 ids → 2 quads, courts 0,1", () => {
  const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const q = quadCut(ids);
  assert.equal(q.length, 2);
  assert.deepEqual(q[0], { courtNumber: 0, quad: ["a", "b", "c", "d"] });
  assert.deepEqual(q[1], { courtNumber: 1, quad: ["e", "f", "g", "h"] });
});

check("quadCut 12 ids → 3 quads, courts 0,1,2", () => {
  const ids = Array.from({ length: 12 }, (_, i) => `p${i}`);
  const q = quadCut(ids);
  assert.equal(q.length, 3);
  assert.deepEqual(
    q.map((x) => x.courtNumber),
    [0, 1, 2],
  );
});

check("quadCut 10 ids → 2 quads + 2 sit out (remainder dropped)", () => {
  const ids = Array.from({ length: 10 }, (_, i) => `p${i}`);
  const q = quadCut(ids);
  assert.equal(q.length, 2);
  // p8, p9 are not assigned to any court (they sit out this round).
  const assigned = q.flatMap((x) => x.quad);
  assert.equal(assigned.length, 8);
  assert.ok(!assigned.includes("p8"));
  assert.ok(!assigned.includes("p9"));
});

// ── round1Cut: baseline A=(q0,q1) B=(q2,q3) — NO cross-pair ───────────────────
check("round1Cut baseline A=(q0,q1) B=(q2,q3)", () => {
  const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const courts = round1Cut(ids);
  assert.equal(courts.length, 2);
  assert.deepEqual(courts[0], { courtNumber: 0, teamA: ["a", "b"], teamB: ["c", "d"] });
  assert.deepEqual(courts[1], { courtNumber: 1, teamA: ["e", "f"], teamB: ["g", "h"] });
});

// ── crossPairCut: rank-driven cross-pair across all quads ─────────────────────
check("crossPairCut applies 1+4vs2+3 per quad", () => {
  const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const courts = crossPairCut(ids);
  assert.deepEqual(courts[0], { courtNumber: 0, teamA: ["a", "d"], teamB: ["b", "c"] });
  assert.deepEqual(courts[1], { courtNumber: 1, teamA: ["e", "h"], teamB: ["f", "g"] });
});

// ── determinism: same ranked input → identical cut + cross-pair ───────────────
check("quadCut+crossPairCut deterministic on fixed ranked input", () => {
  const ranked = ["r0", "r1", "r2", "r3", "r4", "r5", "r6", "r7"];
  const a = crossPairCut(ranked);
  const b = crossPairCut([...ranked]);
  assert.deepEqual(a, b);
});

// ── fake prisma harness for round-based services ─────────────────────────────
// Models Round / RoundMatch / PlayerMatchScore + Tournament + TournamentPlayer.
// $transaction(fn) runs fn(tx) with tx === the same fake (mirrors result.test.ts).

interface FakeRoundMatch {
  id: string;
  roundId: string;
  courtNumber: number;
  teamA1Id: string | null;
  teamA2Id: string | null;
  teamB1Id: string | null;
  teamB2Id: string | null;
  pointsA: number | null;
  pointsB: number | null;
  playerScores: { userId: string; pointsFor: number; pointsAgainst: number }[];
}
interface FakeRound {
  id: string;
  tournamentId: string;
  roundNumber: number;
}

function fakePrisma(opts: {
  status?: string;
  format?: string;
  playerCount?: number;
  rounds?: FakeRound[];
  matches?: FakeRoundMatch[];
}) {
  const tournamentId = "trn-1";
  const status = opts.status ?? "registration";
  const format = opts.format ?? "mexicano";
  const players = Array.from({ length: opts.playerCount ?? 0 }, (_, i) => ({
    userId: `u${String(i).padStart(2, "0")}`,
  }));
  const rounds: FakeRound[] = [...(opts.rounds ?? [])];
  const matches: FakeRoundMatch[] = [...(opts.matches ?? [])];
  let statusOut = status;
  const statusWrites: { id: string; status: string }[] = [];
  let roundSeq = rounds.length;
  let matchSeq = matches.length;

  const tx = {
    tournament: {
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        status: statusOut,
        format,
      }),
      update: async ({ where, data }: { where: { id: string }; data: { status: string } }) => {
        statusOut = data.status;
        statusWrites.push({ id: where.id, status: data.status });
        return { id: where.id, status: data.status };
      },
    },
    tournamentPlayer: {
      findMany: async () => players.map((p) => ({ userId: p.userId })),
    },
    round: {
      count: async ({ where }: { where: { tournamentId?: string; roundNumber?: number } }) =>
        rounds.filter(
          (r) =>
            (where.tournamentId == null || r.tournamentId === where.tournamentId) &&
            (where.roundNumber == null || r.roundNumber === where.roundNumber),
        ).length,
      findUnique: async ({
        where,
      }: {
        where: { tournamentId_roundNumber: { tournamentId: string; roundNumber: number } };
      }) => {
        const key = where.tournamentId_roundNumber;
        const r = rounds.find(
          (x) => x.tournamentId === key.tournamentId && x.roundNumber === key.roundNumber,
        );
        return r ? { id: r.id } : null;
      },
      findMany: async () =>
        rounds.map((r) => ({
          matches: matches
            .filter((m) => m.roundId === r.id)
            .map((m) => ({ playerScores: m.playerScores })),
        })),
      create: async ({ data }: { data: { tournamentId: string; roundNumber: number } }) => {
        // Enforce @@unique([tournamentId, roundNumber]) — P2002 on duplicate.
        if (
          rounds.some(
            (r) => r.tournamentId === data.tournamentId && r.roundNumber === data.roundNumber,
          )
        ) {
          throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        }
        const r: FakeRound = { id: `rnd-${++roundSeq}`, ...data };
        rounds.push(r);
        return { id: r.id };
      },
    },
    roundMatch: {
      count: async ({
        where,
      }: {
        where: { roundId: string; OR?: { pointsA?: null; pointsB?: null }[] };
      }) =>
        matches.filter((m) => {
          if (m.roundId !== where.roundId) return false;
          if (!where.OR) return true;
          return where.OR.some(
            (c) =>
              ("pointsA" in c && m.pointsA == null) || ("pointsB" in c && m.pointsB == null),
          );
        }).length,
      create: async ({ data }: { data: Omit<FakeRoundMatch, "id" | "pointsA" | "pointsB" | "playerScores"> }) => {
        const m: FakeRoundMatch = {
          id: `rm-${++matchSeq}`,
          pointsA: null,
          pointsB: null,
          playerScores: [],
          ...data,
        };
        matches.push(m);
        return { id: m.id };
      },
    },
  };
  const prisma = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $transaction: async (fn: (tx: any) => Promise<unknown>) => fn(tx),
  };
  return { prisma, tx, rounds, matches, statusWrites, getStatus: () => statusOut, tournamentId };
}

async function asyncMain() {
  // ── generateMexicanoRound1: 8 players → 1 Round + 2 RoundMatch, status flips ──
  await checkAsync("generateMexicanoRound1 8 players → 1 round, 2 matches", async () => {
    const f = fakePrisma({ playerCount: 8 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await generateMexicanoRound1(f.prisma as any, f.tournamentId);
    assert.equal(r.roundsCreated, 1);
    assert.equal(r.matchesCreated, 2);
    assert.equal(f.rounds.length, 1);
    assert.equal(f.rounds[0].roundNumber, 1);
    assert.equal(f.matches.length, 2);
    assert.equal(f.getStatus(), "in_progress");
    // Every match has all 4 team slots filled (singles → 2 per team).
    for (const m of f.matches) {
      assert.ok(m.teamA1Id && m.teamA2Id && m.teamB1Id && m.teamB2Id);
    }
  });

  // ── generate-once: second start → already_generated, nothing extra created ────
  await checkAsync("generateMexicanoRound1 already_generated on re-start", async () => {
    const f = fakePrisma({
      playerCount: 8,
      rounds: [{ id: "rnd-1", tournamentId: "trn-1", roundNumber: 1 }],
    });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => generateMexicanoRound1(f.prisma as any, f.tournamentId),
      (e: unknown) => e instanceof FormatError && e.code === "already_generated",
    );
    assert.equal(f.rounds.length, 1);
  });

  // ── <8 players → no_units ────────────────────────────────────────────────────
  await checkAsync("generateMexicanoRound1 <8 players → no_units", async () => {
    const f = fakePrisma({ playerCount: 7 });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => generateMexicanoRound1(f.prisma as any, f.tournamentId),
      (e: unknown) => e instanceof FormatError && e.code === "no_units",
    );
    assert.equal(f.rounds.length, 0);
  });

  // ── wrong format → wrong_format ──────────────────────────────────────────────
  await checkAsync("generateMexicanoRound1 wrong_format", async () => {
    const f = fakePrisma({ playerCount: 8, format: "americano" });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => generateMexicanoRound1(f.prisma as any, f.tournamentId),
      (e: unknown) => e instanceof FormatError && e.code === "wrong_format",
    );
  });

  // ── not open → not_open ──────────────────────────────────────────────────────
  await checkAsync("generateMexicanoRound1 not_open when in_progress", async () => {
    const f = fakePrisma({ playerCount: 8, status: "in_progress" });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => generateMexicanoRound1(f.prisma as any, f.tournamentId),
      (e: unknown) => e instanceof FormatError && e.code === "not_open",
    );
  });

  // ── materializeNextMexicanoRound: GATE — unrecorded match → null ─────────────
  await checkAsync("materialize gate: unrecorded match → null, no round created", async () => {
    const f = fakePrisma({
      status: "in_progress",
      rounds: [{ id: "rnd-1", tournamentId: "trn-1", roundNumber: 1 }],
      matches: [
        {
          id: "rm-1", roundId: "rnd-1", courtNumber: 0,
          teamA1Id: "a", teamA2Id: "b", teamB1Id: "c", teamB2Id: "d",
          pointsA: 24, pointsB: 18,
          playerScores: [
            { userId: "a", pointsFor: 24, pointsAgainst: 18 },
            { userId: "b", pointsFor: 24, pointsAgainst: 18 },
            { userId: "c", pointsFor: 18, pointsAgainst: 24 },
            { userId: "d", pointsFor: 18, pointsAgainst: 24 },
          ],
        },
        {
          id: "rm-2", roundId: "rnd-1", courtNumber: 1,
          teamA1Id: "e", teamA2Id: "f", teamB1Id: "g", teamB2Id: "h",
          pointsA: null, pointsB: null, playerScores: [], // unrecorded
        },
      ],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await materializeNextMexicanoRound(f.tx as any, f.tournamentId, 1);
    assert.equal(r, null);
    assert.equal(f.rounds.length, 1); // no Round 2
  });

  // ── materialize: all recorded → creates Round 2 with rank cut + cross-pair ───
  await checkAsync("materialize creates Round 2 by rank with 1+4vs2+3", async () => {
    // Construct scores so the cumulative ranking is a known order. 8 players a..h.
    // Give descending sumFor so ranked order is exactly [a,b,c,d,e,f,g,h].
    const sf = (u: string, pf: number, pa: number) => ({ userId: u, pointsFor: pf, pointsAgainst: pa });
    const f = fakePrisma({
      status: "in_progress",
      rounds: [{ id: "rnd-1", tournamentId: "trn-1", roundNumber: 1 }],
      matches: [
        {
          id: "rm-1", roundId: "rnd-1", courtNumber: 0,
          teamA1Id: "a", teamA2Id: "b", teamB1Id: "c", teamB2Id: "d",
          pointsA: 24, pointsB: 18,
          // a:30 b:28 c:26 d:24 (descending, distinct → deterministic order a>b>c>d)
          playerScores: [sf("a", 30, 10), sf("b", 28, 10), sf("c", 26, 10), sf("d", 24, 10)],
        },
        {
          id: "rm-2", roundId: "rnd-1", courtNumber: 1,
          teamA1Id: "e", teamA2Id: "f", teamB1Id: "g", teamB2Id: "h",
          pointsA: 22, pointsB: 16,
          playerScores: [sf("e", 22, 10), sf("f", 20, 10), sf("g", 18, 10), sf("h", 16, 10)],
        },
      ],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await materializeNextMexicanoRound(f.tx as any, f.tournamentId, 1);
    assert.deepEqual(r, { createdRoundNumber: 2 });
    const round2 = f.rounds.find((x) => x.roundNumber === 2)!;
    assert.ok(round2);
    const r2matches = f.matches.filter((m) => m.roundId === round2.id).sort((x, y) => x.courtNumber - y.courtNumber);
    assert.equal(r2matches.length, 2);
    // ranked = [a,b,c,d,e,f,g,h]; quad0=[a,b,c,d] → A=(a,d) B=(b,c); quad1=[e,f,g,h] → A=(e,h) B=(f,g)
    assert.deepEqual([r2matches[0].teamA1Id, r2matches[0].teamA2Id], ["a", "d"]);
    assert.deepEqual([r2matches[0].teamB1Id, r2matches[0].teamB2Id], ["b", "c"]);
    assert.deepEqual([r2matches[1].teamA1Id, r2matches[1].teamA2Id], ["e", "h"]);
    assert.deepEqual([r2matches[1].teamB1Id, r2matches[1].teamB2Id], ["f", "g"]);
  });

  // ── materialize-once: Round 2 already exists → null ──────────────────────────
  await checkAsync("materialize-once: existing Round 2 → null", async () => {
    const f = fakePrisma({
      status: "in_progress",
      rounds: [
        { id: "rnd-1", tournamentId: "trn-1", roundNumber: 1 },
        { id: "rnd-2", tournamentId: "trn-1", roundNumber: 2 },
      ],
      matches: [
        {
          id: "rm-1", roundId: "rnd-1", courtNumber: 0,
          teamA1Id: "a", teamA2Id: "b", teamB1Id: "c", teamB2Id: "d",
          pointsA: 24, pointsB: 18,
          playerScores: [
            { userId: "a", pointsFor: 24, pointsAgainst: 18 },
            { userId: "b", pointsFor: 24, pointsAgainst: 18 },
            { userId: "c", pointsFor: 18, pointsAgainst: 24 },
            { userId: "d", pointsFor: 18, pointsAgainst: 24 },
          ],
        },
      ],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await materializeNextMexicanoRound(f.tx as any, f.tournamentId, 1);
    assert.equal(r, null);
    assert.equal(f.rounds.filter((x) => x.roundNumber === 2).length, 1);
  });

  // ── determinism: equal points → stable cut via userId fallback ───────────────
  await checkAsync("materialize deterministic on tie (userId fallback)", async () => {
    // All 8 players identical scores → rankPlayers tiebreak falls to userId asc.
    // Expected ranked order: u00,u01,...,u07 → quad0=[u00..u03], quad1=[u04..u07].
    const eq = (u: string) => ({ userId: u, pointsFor: 20, pointsAgainst: 20 });
    const ids = ["u00", "u01", "u02", "u03", "u04", "u05", "u06", "u07"];
    const f = fakePrisma({
      status: "in_progress",
      rounds: [{ id: "rnd-1", tournamentId: "trn-1", roundNumber: 1 }],
      matches: [
        {
          id: "rm-1", roundId: "rnd-1", courtNumber: 0,
          teamA1Id: "u00", teamA2Id: "u01", teamB1Id: "u02", teamB2Id: "u03",
          pointsA: 20, pointsB: 20,
          playerScores: ids.slice(0, 4).map(eq),
        },
        {
          id: "rm-2", roundId: "rnd-1", courtNumber: 1,
          teamA1Id: "u04", teamA2Id: "u05", teamB1Id: "u06", teamB2Id: "u07",
          pointsA: 20, pointsB: 20,
          playerScores: ids.slice(4, 8).map(eq),
        },
      ],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await materializeNextMexicanoRound(f.tx as any, f.tournamentId, 1);
    assert.deepEqual(r, { createdRoundNumber: 2 });
    const round2 = f.rounds.find((x) => x.roundNumber === 2)!;
    const r2 = f.matches.filter((m) => m.roundId === round2.id).sort((x, y) => x.courtNumber - y.courtNumber);
    // quad0=[u00,u01,u02,u03] → A=(u00,u03) B=(u01,u02)
    assert.deepEqual([r2[0].teamA1Id, r2[0].teamA2Id], ["u00", "u03"]);
    assert.deepEqual([r2[0].teamB1Id, r2[0].teamB2Id], ["u01", "u02"]);
    assert.deepEqual([r2[1].teamA1Id, r2[1].teamA2Id], ["u04", "u07"]);
    assert.deepEqual([r2[1].teamB1Id, r2[1].teamB2Id], ["u05", "u06"]);
  });
}

asyncMain()
  .then(() => {
    console.log(`\n${passed} passed`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
