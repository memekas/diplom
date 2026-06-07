// Unit tests for parseRoundResultForm + the pure scorePointsMode / scoreSetsMode core
// (SCORE-01 mode branching). Run: npx tsx src/lib/validation/round-result.test.ts
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

// --- scorePointsMode ---
check("points 15:9 round_robin => winner A", () => {
  assert.deepEqual(scorePointsMode(15, 9, "round_robin"), { pointsA: 15, pointsB: 9, winner: "A" });
});
check("points 9:15 americano => winner B", () => {
  assert.deepEqual(scorePointsMode(9, 15, "americano"), { pointsA: 9, pointsB: 15, winner: "B" });
});
check("points round_robin 12:12 => draw_not_allowed (D2)", () => {
  assert.throws(() => scorePointsMode(12, 12, "round_robin"), isCode("draw_not_allowed"));
});
check("points americano 12:12 => winner null (draw ok)", () => {
  assert.deepEqual(scorePointsMode(12, 12, "americano"), { pointsA: 12, pointsB: 12, winner: null });
});
check("points mexicano 12:12 => winner null (draw ok)", () => {
  assert.deepEqual(scorePointsMode(12, 12, "mexicano"), { pointsA: 12, pointsB: 12, winner: null });
});
check("points negative => invalid_points", () => {
  assert.throws(() => scorePointsMode(-1, 9, "americano"), isCode("invalid_points"));
});
check("points non-integer => invalid_points", () => {
  assert.throws(() => scorePointsMode(15.5, 9, "americano"), isCode("invalid_points"));
});
check("points targetPoints satisfied => ok", () => {
  assert.deepEqual(scorePointsMode(15, 9, "americano", 24), { pointsA: 15, pointsB: 9, winner: "A" });
});
check("points targetPoints violated => bad_sum", () => {
  assert.throws(() => scorePointsMode(15, 8, "americano", 24), isCode("bad_sum"));
});
check("points targetPoints null => not enforced", () => {
  assert.deepEqual(scorePointsMode(15, 8, "americano", null), { pointsA: 15, pointsB: 8, winner: "A" });
});

// --- scoreSetsMode ---
check("sets 6:4,6:3 => pointsA=2 winner A", () => {
  assert.deepEqual(
    scoreSetsMode([{ gamesPair1: 6, gamesPair2: 4 }, { gamesPair1: 6, gamesPair2: 3 }], 6, 3),
    { pointsA: 2, pointsB: 0, winner: "A" },
  );
});
check("sets 4:6,3:6 => pointsB=2 winner B", () => {
  assert.deepEqual(
    scoreSetsMode([{ gamesPair1: 4, gamesPair2: 6 }, { gamesPair1: 3, gamesPair2: 6 }], 6, 3),
    { pointsA: 0, pointsB: 2, winner: "B" },
  );
});
check("sets 6:4,3:6,6:2 => 2:1 winner A", () => {
  assert.deepEqual(
    scoreSetsMode(
      [{ gamesPair1: 6, gamesPair2: 4 }, { gamesPair1: 3, gamesPair2: 6 }, { gamesPair1: 6, gamesPair2: 2 }],
      6,
      3,
    ),
    { pointsA: 2, pointsB: 1, winner: "A" },
  );
});
check("sets invalid set 6:5 => invalid_set", () => {
  assert.throws(() => scoreSetsMode([{ gamesPair1: 6, gamesPair2: 5 }], 6, 3), isCode("invalid_set"));
});
check("sets too few decisive 6:4 only => no_winner", () => {
  assert.throws(() => scoreSetsMode([{ gamesPair1: 6, gamesPair2: 4 }], 6, 3), isCode("no_winner"));
});
check("sets 1:1 split => no_winner", () => {
  assert.throws(
    () => scoreSetsMode([{ gamesPair1: 6, gamesPair2: 4 }, { gamesPair1: 4, gamesPair2: 6 }], 6, 3),
    isCode("no_winner"),
  );
});

// --- parseRoundResultForm: points mode ---
check("parse points valid", () => {
  const r = parseRoundResultForm(form({ points_a: "15", points_b: "9" }), { scoringMode: "points", setsPerMatch: 3 });
  assert.deepEqual(r, { ok: true, data: { pointsA: 15, pointsB: 9 } });
});
check("parse points missing field => error", () => {
  const r = parseRoundResultForm(form({ points_a: "15" }), { scoringMode: "points", setsPerMatch: 3 });
  assert.equal(r.ok, false);
});
check("parse points negative => error", () => {
  const r = parseRoundResultForm(form({ points_a: "-1", points_b: "9" }), { scoringMode: "points", setsPerMatch: 3 });
  assert.equal(r.ok, false);
});
check("parse points non-numeric => error", () => {
  const r = parseRoundResultForm(form({ points_a: "abc", points_b: "9" }), { scoringMode: "points", setsPerMatch: 3 });
  assert.equal(r.ok, false);
});

// --- parseRoundResultForm: sets mode ---
check("parse sets two rows", () => {
  const r = parseRoundResultForm(
    form({ set1_a: "6", set1_b: "4", set2_a: "6", set2_b: "3" }),
    { scoringMode: "sets", setsPerMatch: 3 },
  );
  assert.deepEqual(r, {
    ok: true,
    data: { sets: [{ gamesPair1: 6, gamesPair2: 4 }, { gamesPair1: 6, gamesPair2: 3 }] },
  });
});
check("parse sets skips trailing empty row", () => {
  const r = parseRoundResultForm(
    form({ set1_a: "6", set1_b: "4", set2_a: "6", set2_b: "3", set3_a: "", set3_b: "" }),
    { scoringMode: "sets", setsPerMatch: 3 },
  );
  assert.equal(r.ok, true);
  if (r.ok) assert.equal((r.data as { sets: unknown[] }).sets.length, 2);
});
check("parse sets partial row => error", () => {
  const r = parseRoundResultForm(form({ set1_a: "6", set1_b: "" }), { scoringMode: "sets", setsPerMatch: 3 });
  assert.equal(r.ok, false);
});
check("parse sets no rows => error", () => {
  const r = parseRoundResultForm(form({}), { scoringMode: "sets", setsPerMatch: 3 });
  assert.equal(r.ok, false);
});

console.log(`\n${passed} validation assertions passed`);
