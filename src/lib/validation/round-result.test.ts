// Unit tests for parseRoundResultForm + the pure scorePointsMode / scoreSetsMode core
// (SCORE-01 mode branching, free-form scoring). Run: npx tsx src/lib/validation/round-result.test.ts
// (No test framework — self-contained assertion script; exits non-zero on failure.)
import assert from "node:assert/strict";
import { parseRoundResultForm } from "./round-result";
import {
  scorePointsMode,
  scoreSetsMode,
  RoundResultError,
} from "@/lib/services/round-result";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok - ${name}`);
}

const isCode = (code: string) => (e: unknown) =>
  e instanceof RoundResultError && e.code === code;

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

// --- scorePointsMode (free-form: any two ints, no target, draws allowed everywhere) ---
check("points 15:9 => winner A", () => {
  assert.deepEqual(scorePointsMode(15, 9), { pointsA: 15, pointsB: 9, winner: "A" });
});
check("points 9:15 => winner B", () => {
  assert.deepEqual(scorePointsMode(9, 15), { pointsA: 9, pointsB: 15, winner: "B" });
});
check("points 13:9 (no target) => winner A", () => {
  assert.deepEqual(scorePointsMode(13, 9), { pointsA: 13, pointsB: 9, winner: "A" });
});
check("points 12:12 => winner null (draw allowed)", () => {
  assert.deepEqual(scorePointsMode(12, 12), { pointsA: 12, pointsB: 12, winner: null });
});
check("points negative => invalid_points", () => {
  assert.throws(() => scorePointsMode(-1, 9), isCode("invalid_points"));
});
check("points non-integer => invalid_points", () => {
  assert.throws(() => scorePointsMode(15.5, 9), isCode("invalid_points"));
});

// --- scoreSetsMode (free-form: any sets/games, winner by sets then games, draw ok) ---
check("sets 6:4,6:3 => pointsA=2 winner A", () => {
  assert.deepEqual(
    scoreSetsMode([{ gamesPair1: 6, gamesPair2: 4 }, { gamesPair1: 6, gamesPair2: 3 }]),
    { pointsA: 2, pointsB: 0, winner: "A" },
  );
});
check("sets 4:6,3:6 => pointsB=2 winner B", () => {
  assert.deepEqual(
    scoreSetsMode([{ gamesPair1: 4, gamesPair2: 6 }, { gamesPair1: 3, gamesPair2: 6 }]),
    { pointsA: 0, pointsB: 2, winner: "B" },
  );
});
check("sets 6:4,3:6,6:2 => 2:1 winner A", () => {
  assert.deepEqual(
    scoreSetsMode([{ gamesPair1: 6, gamesPair2: 4 }, { gamesPair1: 3, gamesPair2: 6 }, { gamesPair1: 6, gamesPair2: 2 }]),
    { pointsA: 2, pointsB: 1, winner: "A" },
  );
});
check("sets 4:5 single (free-form) => pointsB=1 winner B", () => {
  assert.deepEqual(scoreSetsMode([{ gamesPair1: 4, gamesPair2: 5 }]), { pointsA: 0, pointsB: 1, winner: "B" });
});
check("sets single 6:4 => winner A (one set, more games)", () => {
  assert.deepEqual(scoreSetsMode([{ gamesPair1: 6, gamesPair2: 4 }]), { pointsA: 1, pointsB: 0, winner: "A" });
});
check("sets 6:4,4:6 split => winner null (1:1 sets, games tie → draw)", () => {
  assert.deepEqual(
    scoreSetsMode([{ gamesPair1: 6, gamesPair2: 4 }, { gamesPair1: 4, gamesPair2: 6 }]),
    { pointsA: 1, pointsB: 1, winner: null },
  );
});
check("sets negative => invalid_set", () => {
  assert.throws(() => scoreSetsMode([{ gamesPair1: -1, gamesPair2: 5 }]), isCode("invalid_set"));
});

// --- parseRoundResultForm: points mode ---
check("parse points valid", () => {
  const r = parseRoundResultForm(form({ points_a: "15", points_b: "9" }), { scoringMode: "points" });
  assert.deepEqual(r, { ok: true, data: { pointsA: 15, pointsB: 9 } });
});
check("parse points missing field => error", () => {
  const r = parseRoundResultForm(form({ points_a: "15" }), { scoringMode: "points" });
  assert.equal(r.ok, false);
});
check("parse points negative => error", () => {
  const r = parseRoundResultForm(form({ points_a: "-1", points_b: "9" }), { scoringMode: "points" });
  assert.equal(r.ok, false);
});
check("parse points non-numeric => error", () => {
  const r = parseRoundResultForm(form({ points_a: "abc", points_b: "9" }), { scoringMode: "points" });
  assert.equal(r.ok, false);
});

// --- parseRoundResultForm: sets mode (dynamic scan, no cap) ---
check("parse sets two rows", () => {
  const r = parseRoundResultForm(
    form({ set1_a: "6", set1_b: "4", set2_a: "6", set2_b: "3" }),
    { scoringMode: "sets" },
  );
  assert.deepEqual(r, {
    ok: true,
    data: { sets: [{ gamesPair1: 6, gamesPair2: 4 }, { gamesPair1: 6, gamesPair2: 3 }] },
  });
});
check("parse sets any count (5 rows, no cap)", () => {
  const r = parseRoundResultForm(
    form({
      set1_a: "6", set1_b: "4",
      set2_a: "4", set2_b: "6",
      set3_a: "6", set3_b: "3",
      set4_a: "2", set4_b: "6",
      set5_a: "6", set5_b: "1",
    }),
    { scoringMode: "sets" },
  );
  assert.equal(r.ok, true);
  if (r.ok) assert.equal((r.data as { sets: unknown[] }).sets.length, 5);
});
check("parse sets skips trailing empty row", () => {
  const r = parseRoundResultForm(
    form({ set1_a: "6", set1_b: "4", set2_a: "6", set2_b: "3", set3_a: "", set3_b: "" }),
    { scoringMode: "sets" },
  );
  assert.equal(r.ok, true);
  if (r.ok) assert.equal((r.data as { sets: unknown[] }).sets.length, 2);
});
check("parse sets partial row => error", () => {
  const r = parseRoundResultForm(form({ set1_a: "6", set1_b: "" }), { scoringMode: "sets" });
  assert.equal(r.ok, false);
});
check("parse sets no rows => error", () => {
  const r = parseRoundResultForm(form({}), { scoringMode: "sets" });
  assert.equal(r.ok, false);
});

console.log(`\n${passed} validation assertions passed`);
