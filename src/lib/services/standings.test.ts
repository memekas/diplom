// Unit tests for computeStandings (FMT-02/FMT-03). Run: npx tsx src/lib/services/standings.test.ts
// (No test framework — self-contained node:assert/strict script + hand-written fake
// prisma, mirroring result.test.ts / admin.test.ts. Exits non-zero on failure.)
import assert from "node:assert/strict";
import { rankPlayers, computeStandings } from "./standings";

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

// ─────────────────────────────────────────────────────────────────────────────
// Task 1 — pure rankPlayers tiebreak chain: sumFor desc → pointDiff desc → wins
// desc → userId asc (stable, deterministic fallback for mexicano cut).
// ─────────────────────────────────────────────────────────────────────────────

check("rankPlayers: order by sum of personal points desc", () => {
  const out = rankPlayers([
    { userId: "u-a", sumFor: 10, sumAgainst: 5, wins: 1, played: 2 },
    { userId: "u-b", sumFor: 30, sumAgainst: 5, wins: 3, played: 3 },
    { userId: "u-c", sumFor: 20, sumAgainst: 5, wins: 2, played: 2 },
  ]);
  assert.deepEqual(out.map((r) => r.userId), ["u-b", "u-c", "u-a"]);
  assert.deepEqual(out.map((r) => r.rank), [1, 2, 3]);
});

check("rankPlayers: tiebreak by point diff when sumFor equal", () => {
  // equal sumFor=20; u-x diff=+15 vs u-y diff=+5 → u-x first.
  const out = rankPlayers([
    { userId: "u-y", sumFor: 20, sumAgainst: 15, wins: 1, played: 2 },
    { userId: "u-x", sumFor: 20, sumAgainst: 5, wins: 1, played: 2 },
  ]);
  assert.deepEqual(out.map((r) => r.userId), ["u-x", "u-y"]);
});

check("rankPlayers: tiebreak by wins when sumFor + pointDiff equal", () => {
  // identical sumFor=20, sumAgainst=10 (diff +10); u-w has more wins.
  const out = rankPlayers([
    { userId: "u-l", sumFor: 20, sumAgainst: 10, wins: 1, played: 3 },
    { userId: "u-w", sumFor: 20, sumAgainst: 10, wins: 3, played: 3 },
  ]);
  assert.deepEqual(out.map((r) => r.userId), ["u-w", "u-l"]);
});

check("rankPlayers: stable userId asc fallback on full equality", () => {
  const out = rankPlayers([
    { userId: "u-3", sumFor: 10, sumAgainst: 5, wins: 1, played: 1 },
    { userId: "u-1", sumFor: 10, sumAgainst: 5, wins: 1, played: 1 },
    { userId: "u-2", sumFor: 10, sumAgainst: 5, wins: 1, played: 1 },
  ]);
  assert.deepEqual(out.map((r) => r.userId), ["u-1", "u-2", "u-3"]);
});

check("rankPlayers: does NOT mutate input array", () => {
  const input = [
    { userId: "u-b", sumFor: 30, sumAgainst: 5, wins: 3, played: 3 },
    { userId: "u-a", sumFor: 10, sumAgainst: 5, wins: 1, played: 2 },
  ];
  const snapshot = input.map((r) => r.userId);
  rankPlayers(input);
  assert.deepEqual(input.map((r) => r.userId), snapshot);
});

check("rankPlayers: maps fields onto PlayerStanding (played/wins/pointsFor/Against/diff)", () => {
  const out = rankPlayers([{ userId: "u-a", sumFor: 17, sumAgainst: 9, wins: 2, played: 3 }]);
  assert.deepEqual(out[0], {
    userId: "u-a",
    rank: 1,
    played: 3,
    wins: 2,
    pointsFor: 17,
    pointsAgainst: 9,
    pointDiff: 8,
  });
});

check("rankPlayers: DETERMINISM — two differently-shuffled copies sort identically", () => {
  // A set with several full ties resolvable only by the userId fallback — the
  // invariant the mexicano quad cut relies on (Pitfall 2).
  const base = [
    { userId: "u-05", sumFor: 12, sumAgainst: 8, wins: 2, played: 3 },
    { userId: "u-02", sumFor: 12, sumAgainst: 8, wins: 2, played: 3 }, // full tie with u-05
    { userId: "u-09", sumFor: 20, sumAgainst: 4, wins: 3, played: 3 },
    { userId: "u-01", sumFor: 12, sumAgainst: 8, wins: 2, played: 3 }, // full tie
    { userId: "u-07", sumFor: 5, sumAgainst: 15, wins: 0, played: 3 },
    { userId: "u-03", sumFor: 12, sumAgainst: 8, wins: 2, played: 3 }, // full tie
  ];
  const shuffleA = [base[3], base[0], base[5], base[1], base[2], base[4]];
  const shuffleB = [base[4], base[2], base[1], base[5], base[0], base[3]];
  const orderA = rankPlayers(shuffleA).map((r) => r.userId);
  const orderB = rankPlayers(shuffleB).map((r) => r.userId);
  assert.deepEqual(orderA, orderB);
  assert.deepEqual(orderA, ["u-09", "u-01", "u-02", "u-03", "u-05", "u-07"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 2 — computeStandings: read+aggregate from RoundMatch/PlayerMatchScore.
// Hand-written fake prisma (mirror result.test.ts). Only the methods/selects the
// service calls are implemented.
// ─────────────────────────────────────────────────────────────────────────────

interface FakePlayerScore {
  userId: string;
  teamSlot: string;
  pointsFor: number;
  pointsAgainst: number;
}
interface FakeRoundMatch {
  id: string;
  courtNumber: number;
  teamA1Id: string | null;
  teamA2Id: string | null;
  teamB1Id: string | null;
  teamB2Id: string | null;
  pointsA: number | null;
  pointsB: number | null;
  playerScores: FakePlayerScore[];
}
interface FakeRound {
  roundNumber: number;
  matches: FakeRoundMatch[];
}

function fakePrisma(opts: {
  tournament: { format: string; participantMode: string; scoringMode: string };
  rounds: FakeRound[];
  pairs?: { id: string; player1Id: string; player2Id: string }[];
}) {
  return {
    tournament: {
      findUniqueOrThrow: async () => opts.tournament,
    },
    round: {
      findMany: async () =>
        opts.rounds.map((r) => ({
          roundNumber: r.roundNumber,
          matches: r.matches.map((m) => ({
            id: m.id,
            courtNumber: m.courtNumber,
            teamA1Id: m.teamA1Id,
            teamA2Id: m.teamA2Id,
            teamB1Id: m.teamB1Id,
            teamB2Id: m.teamB2Id,
            pointsA: m.pointsA,
            pointsB: m.pointsB,
            playerScores: m.playerScores,
          })),
        })),
    },
    pair: {
      findMany: async () => opts.pairs ?? [],
    },
  };
}

async function main() {
  // --- americano: player rating from PlayerMatchScore (both partners share team pointsFor) ---
  await checkAsync("computeStandings americano: rating by sum of personal points", async () => {
    // Round 1: court A=(p1,p2) beat B=(p3,p4) 24:16. Both A players +24/-16, both B +16/-24.
    const f = fakePrisma({
      tournament: { format: "americano", participantMode: "singles", scoringMode: "points" },
      rounds: [
        {
          roundNumber: 1,
          matches: [
            {
              id: "rm1",
              courtNumber: 0,
              teamA1Id: "p1",
              teamA2Id: "p2",
              teamB1Id: "p3",
              teamB2Id: "p4",
              pointsA: 24,
              pointsB: 16,
              playerScores: [
                { userId: "p1", teamSlot: "A", pointsFor: 24, pointsAgainst: 16 },
                { userId: "p2", teamSlot: "A", pointsFor: 24, pointsAgainst: 16 },
                { userId: "p3", teamSlot: "B", pointsFor: 16, pointsAgainst: 24 },
                { userId: "p4", teamSlot: "B", pointsFor: 16, pointsAgainst: 24 },
              ],
            },
          ],
        },
      ],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await computeStandings(f as any, "t1");
    assert.equal(out.kind, "players");
    if (out.kind !== "players") return;
    assert.equal(out.format, "americano");
    // p1/p2 tie on 24/-16 → userId asc; p3/p4 tie on 16/+(-8) → userId asc.
    assert.deepEqual(out.players.map((p) => p.userId), ["p1", "p2", "p3", "p4"]);
    assert.deepEqual(out.players.map((p) => p.rank), [1, 2, 3, 4]);
    assert.equal(out.players[0].pointsFor, 24);
    assert.equal(out.players[0].wins, 1);
    assert.equal(out.players[0].played, 1);
    assert.equal(out.players[2].wins, 0);
    assert.equal(out.players[2].pointDiff, -8);
  });

  // --- americano: ignore unrecorded matches (no playerScores) ---
  await checkAsync("computeStandings americano: unrecorded match (no scores) ignored", async () => {
    const f = fakePrisma({
      tournament: { format: "americano", participantMode: "singles", scoringMode: "points" },
      rounds: [
        {
          roundNumber: 1,
          matches: [
            {
              id: "rm1",
              courtNumber: 0,
              teamA1Id: "p1",
              teamA2Id: "p2",
              teamB1Id: "p3",
              teamB2Id: "p4",
              pointsA: 24,
              pointsB: 16,
              playerScores: [
                { userId: "p1", teamSlot: "A", pointsFor: 24, pointsAgainst: 16 },
                { userId: "p2", teamSlot: "A", pointsFor: 24, pointsAgainst: 16 },
                { userId: "p3", teamSlot: "B", pointsFor: 16, pointsAgainst: 24 },
                { userId: "p4", teamSlot: "B", pointsFor: 16, pointsAgainst: 24 },
              ],
            },
          ],
        },
        {
          roundNumber: 2,
          matches: [
            // Not yet recorded — no playerScores, pointsA/B null. Must not contribute.
            {
              id: "rm2",
              courtNumber: 0,
              teamA1Id: "p1",
              teamA2Id: "p3",
              teamB1Id: "p2",
              teamB2Id: "p4",
              pointsA: null,
              pointsB: null,
              playerScores: [],
            },
          ],
        },
      ],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await computeStandings(f as any, "t1");
    if (out.kind !== "players") throw new Error("expected players");
    // Still only 1 played per player; p1 not double-counted.
    assert.equal(out.players.find((p) => p.userId === "p1")!.played, 1);
    assert.equal(out.players.length, 4);
  });

  // --- round_robin pairs: unit table, pair identity recovered by player1Id ---
  await checkAsync("computeStandings round_robin pairs: unit table by pairId", async () => {
    // 3 pairs RR (1 round shown, partial). pairX players (a1,a2), pairY (b1,b2), pairZ (c1,c2).
    // rm1: pairX vs pairY → A 6:3 (sets-won) → pairX win. rm2: pairX vs pairZ → A 6:0 → pairX win.
    const f = fakePrisma({
      tournament: { format: "round_robin", participantMode: "pairs", scoringMode: "sets" },
      pairs: [
        { id: "pairX", player1Id: "a1", player2Id: "a2" },
        { id: "pairY", player1Id: "b1", player2Id: "b2" },
        { id: "pairZ", player1Id: "c1", player2Id: "c2" },
      ],
      rounds: [
        {
          roundNumber: 1,
          matches: [
            {
              id: "rm1",
              courtNumber: 0,
              teamA1Id: "a1",
              teamA2Id: "a2",
              teamB1Id: "b1",
              teamB2Id: "b2",
              pointsA: 2,
              pointsB: 1,
              playerScores: [],
            },
            {
              id: "rm2",
              courtNumber: 1,
              teamA1Id: "a1",
              teamA2Id: "a2",
              teamB1Id: "c1",
              teamB2Id: "c2",
              pointsA: 2,
              pointsB: 0,
              playerScores: [],
            },
            // pairY vs pairZ not yet recorded.
            {
              id: "rm3",
              courtNumber: 0,
              teamA1Id: "b1",
              teamA2Id: "b2",
              teamB1Id: "c1",
              teamB2Id: "c2",
              pointsA: null,
              pointsB: null,
              playerScores: [],
            },
          ],
        },
      ],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await computeStandings(f as any, "t1");
    assert.equal(out.kind, "units");
    if (out.kind !== "units") return;
    assert.equal(out.format, "round_robin");
    const pairX = out.units.find((u) => u.unitId === "pairX")!;
    assert.equal(pairX.kind, "pair");
    assert.equal(pairX.wins, 2);
    assert.equal(pairX.losses, 0);
    assert.equal(pairX.played, 2);
    assert.equal(pairX.rank, 1);
    assert.equal(pairX.pointsFor, 4); // 2 + 2 sets-won
    assert.equal(pairX.pointsAgainst, 1); // 1 + 0
    const pairY = out.units.find((u) => u.unitId === "pairY")!;
    assert.equal(pairY.wins, 0);
    assert.equal(pairY.losses, 1);
    assert.equal(pairY.played, 1);
  });

  // --- round_robin singles: unit = player ---
  await checkAsync("computeStandings round_robin singles: unit table by userId", async () => {
    const f = fakePrisma({
      tournament: { format: "round_robin", participantMode: "singles", scoringMode: "points" },
      rounds: [
        {
          roundNumber: 1,
          matches: [
            {
              id: "rm1",
              courtNumber: 0,
              teamA1Id: "s1",
              teamA2Id: null,
              teamB1Id: "s2",
              teamB2Id: null,
              pointsA: 21,
              pointsB: 15,
              playerScores: [],
            },
          ],
        },
      ],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await computeStandings(f as any, "t1");
    if (out.kind !== "units") throw new Error("expected units");
    const s1 = out.units.find((u) => u.unitId === "s1")!;
    assert.equal(s1.kind, "user");
    assert.equal(s1.wins, 1);
    assert.equal(s1.pointsFor, 21);
    assert.equal(s1.pointsAgainst, 15);
    assert.equal(s1.pointDiff, 6);
    assert.equal(s1.rank, 1);
    const s2 = out.units.find((u) => u.unitId === "s2")!;
    assert.equal(s2.losses, 1);
    assert.equal(s2.rank, 2);
  });

  // --- unit-table tiebreak determinism: equal wins/diff/for → unitId asc ---
  await checkAsync("computeStandings units: stable unitId tiebreak on full equality", async () => {
    // Two singles each win one match 10:0 over a third → equal wins(1)/diff(+10)/for(10).
    const f = fakePrisma({
      tournament: { format: "round_robin", participantMode: "singles", scoringMode: "points" },
      rounds: [
        {
          roundNumber: 1,
          matches: [
            {
              id: "rm1",
              courtNumber: 0,
              teamA1Id: "z2",
              teamA2Id: null,
              teamB1Id: "z9",
              teamB2Id: null,
              pointsA: 10,
              pointsB: 0,
              playerScores: [],
            },
            {
              id: "rm2",
              courtNumber: 1,
              teamA1Id: "z1",
              teamA2Id: null,
              teamB1Id: "z8",
              teamB2Id: null,
              pointsA: 10,
              pointsB: 0,
              playerScores: [],
            },
          ],
        },
      ],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await computeStandings(f as any, "t1");
    if (out.kind !== "units") throw new Error("expected units");
    // z1 and z2 fully tied at top → z1 before z2 (unitId asc).
    assert.deepEqual(out.units.map((u) => u.unitId), ["z1", "z2", "z8", "z9"]);
  });
}

main()
  .then(() => {
    console.log(`\nstandings: ${passed} assertions passed.`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
