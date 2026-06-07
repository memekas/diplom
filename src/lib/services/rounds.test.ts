// Unit tests for the thin read helpers listRounds + listTournamentPlayers (VIS-01).
// Run: npx tsx src/lib/services/rounds.test.ts
// (No test framework — self-contained assertion script with a hand-written fake prisma
// mirroring round-result.test.ts. Exits non-zero on failure.)
//
// The fake prisma RESPECTS the orderBy/select passed by the helper: it sorts and
// projects according to the query object so the ordering + safe-select contract is
// enforced by the helper's query, not by pre-sorted fixtures.
import assert from "node:assert/strict";
import { listRounds, listTournamentPlayers } from "./rounds";

let passed = 0;
async function checkAsync(name: string, fn: () => Promise<void>) {
  await fn();
  passed++;
  console.log(`  ok - ${name}`);
}

// Pulls only the relation-slot keys the helper selected from a raw match row,
// projecting each User FK relation into { id, name } | null per the select.
function projectMatch(raw: Record<string, unknown>, sel: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(sel)) {
    const v = raw[key];
    if (v && typeof v === "object" && "select" in (sel[key] as object)) {
      // relation slot — project nested select (e.g. { id, name }); leak guard below
      const inner = (sel[key] as { select: Record<string, unknown> }).select;
      if (v === null) {
        out[key] = null;
      } else {
        const slot: Record<string, unknown> = {};
        for (const ik of Object.keys(inner)) slot[ik] = (v as Record<string, unknown>)[ik];
        out[key] = slot;
      }
    } else {
      out[key] = v ?? null;
    }
  }
  return out;
}

// A configurable fake DB modelling round.findMany + tournamentPlayer.findMany. It
// honours orderBy (asc) and select, returning unsorted source data so the helper's
// query drives the result order. Records the query objects for contract assertions.
function fakeDb(opts: {
  rounds: Record<string, unknown>[];
  players: Record<string, unknown>[];
}) {
  const calls = {
    roundQuery: null as Record<string, unknown> | null,
    playerQuery: null as Record<string, unknown> | null,
  };
  const prisma = {
    round: {
      findMany: async (q: Record<string, unknown>) => {
        calls.roundQuery = q;
        const sel = q.select as Record<string, unknown>;
        const matchSel = (sel.matches as { select: Record<string, unknown> }).select;
        const matchOrder = (sel.matches as { orderBy: Record<string, "asc" | "desc"> }).orderBy;
        const matchOrderKey = Object.keys(matchOrder)[0];
        const rounds = [...opts.rounds].map((r) => {
          const rawMatches = (r.matches as Record<string, unknown>[]) ?? [];
          const matches = [...rawMatches]
            .sort((a, b) => (a[matchOrderKey] as number) - (b[matchOrderKey] as number))
            .map((m) => projectMatch(m, matchSel));
          return { roundNumber: r.roundNumber, matches } as Record<string, unknown>;
        });
        const order = q.orderBy as Record<string, "asc" | "desc">;
        const key = Object.keys(order)[0];
        rounds.sort((a, b) => (a[key] as number) - (b[key] as number));
        return rounds;
      },
    },
    tournamentPlayer: {
      findMany: async (q: Record<string, unknown>) => {
        calls.playerQuery = q;
        const sel = q.select as Record<string, unknown>;
        const userSel = (sel.user as { select: Record<string, unknown> }).select;
        const rows = [...opts.players].map((p) => {
          const u = p.user as Record<string, unknown>;
          const user: Record<string, unknown> = {};
          for (const k of Object.keys(userSel)) user[k] = u[k];
          return { id: p.id, user };
        });
        const order = q.orderBy as Record<string, "asc" | "desc">;
        const key = Object.keys(order)[0];
        rows.sort((a, b) => ((opts.players.find((x) => x.id === a.id)![key] as number) - (opts.players.find((x) => x.id === b.id)![key] as number)));
        return rows;
      },
    },
  };
  return { prisma, calls };
}

// Deeply collect every key present anywhere in a value (for the leak assertion).
function allKeys(v: unknown, acc = new Set<string>()): Set<string> {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const [k, val] of Object.entries(v)) {
      acc.add(k);
      allKeys(val, acc);
    }
  } else if (Array.isArray(v)) {
    for (const el of v) allKeys(el, acc);
  }
  return acc;
}

async function main() {
  await checkAsync("listRounds sorts rounds asc and matches by court asc", async () => {
    const { prisma, calls } = fakeDb({
      players: [],
      rounds: [
        {
          roundNumber: 2,
          matches: [
            { id: "m2c2", courtNumber: 2, pointsA: null, pointsB: null, teamA1: { id: "u1", name: "Анна", email: "leak@x.io" }, teamA2: null, teamB1: { id: "u2", name: "Борис", birthDate: "2000-01-01" }, teamB2: null },
            { id: "m2c1", courtNumber: 1, pointsA: 6, pointsB: 4, teamA1: { id: "u3", name: "Вера" }, teamA2: null, teamB1: { id: "u4", name: "Глеб" }, teamB2: null },
          ],
        },
        {
          roundNumber: 1,
          matches: [
            { id: "m1c1", courtNumber: 1, pointsA: 6, pointsB: 2, teamA1: { id: "u1", name: "Анна" }, teamA2: null, teamB1: { id: "u2", name: "Борис" }, teamB2: null },
          ],
        },
      ],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await listRounds(prisma as any, "t1");
    assert.deepEqual(res.map((r) => r.roundNumber), [1, 2]);
    assert.deepEqual(res[1].matches.map((m) => m.courtNumber), [1, 2]);

    // Ordering contract is on the query, not the fixtures.
    assert.deepEqual(calls.roundQuery!.orderBy, { roundNumber: "asc" });
    const matchesSel = (calls.roundQuery!.select as Record<string, unknown>).matches as {
      orderBy: unknown;
      select: Record<string, unknown>;
    };
    assert.deepEqual(matchesSel.orderBy, { courtNumber: "asc" });

    // Safe-select contract: nested team-slot select MUST be exactly { id, name }.
    for (const slot of ["teamA1", "teamA2", "teamB1", "teamB2"]) {
      assert.deepEqual(
        (matchesSel.select[slot] as { select: unknown }).select,
        { id: true, name: true },
        `${slot} select must be { id, name } only`,
      );
    }
  });

  await checkAsync("listRounds result never carries email/birthDate", async () => {
    const { prisma } = fakeDb({
      players: [],
      rounds: [
        {
          roundNumber: 1,
          matches: [
            { id: "m1", courtNumber: 1, pointsA: null, pointsB: null, teamA1: { id: "u1", name: "Анна", email: "leak@x.io", birthDate: "2000-01-01" }, teamA2: null, teamB1: { id: "u2", name: "Борис" }, teamB2: null },
          ],
        },
      ],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await listRounds(prisma as any, "t1");
    const keys = allKeys(res);
    assert.equal(keys.has("email"), false, "result must not contain email");
    assert.equal(keys.has("birthDate"), false, "result must not contain birthDate");
    // teamA1 slot projects to { id, name }
    assert.deepEqual(res[0].matches[0].teamA1, { id: "u1", name: "Анна" });
    assert.equal(res[0].matches[0].teamA2, null);
  });

  await checkAsync("listTournamentPlayers oldest-first + safe user select", async () => {
    const { prisma, calls } = fakeDb({
      rounds: [],
      players: [
        { id: "tp2", createdAt: 2, user: { id: "u2", name: "Борис", skillLevel: "pro", courtSide: "right", email: "leak@x.io", birthDate: "1990-01-01" } },
        { id: "tp1", createdAt: 1, user: { id: "u1", name: "Анна", skillLevel: "beginner", courtSide: "left" } },
      ],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await listTournamentPlayers(prisma as any, "t1");
    assert.deepEqual(res.map((p) => p.id), ["tp1", "tp2"]);
    assert.deepEqual(calls.playerQuery!.orderBy, { createdAt: "asc" });
    const userSel = ((calls.playerQuery!.select as Record<string, unknown>).user as { select: unknown }).select;
    assert.deepEqual(userSel, { id: true, name: true, skillLevel: true, courtSide: true });

    const keys = allKeys(res);
    assert.equal(keys.has("email"), false);
    assert.equal(keys.has("birthDate"), false);
    assert.deepEqual(res[0].user, { id: "u1", name: "Анна", skillLevel: "beginner", courtSide: "left" });
  });

  console.log(`\n${passed} rounds read-helper assertions passed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
