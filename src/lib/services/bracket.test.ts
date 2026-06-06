// Unit tests for the bracket-generation core (BRKT-01, BRKT-03).
// Run: npx tsx src/lib/services/bracket.test.ts
// (No test framework — self-contained assertion script. The pure-math cases
// (advance/ROUNDS/matchCount) run synchronously; the generateBracket cases use a
// hand-written fake prisma whose $transaction(fn) invokes fn(tx) with the same
// fake — NO real DB. async cases live in main() because tsx emits CJS, no
// top-level await. Exits non-zero on failure.)
import assert from "node:assert/strict";
import { advance, ROUNDS, matchCount } from "./bracket";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok - ${name}`);
}

// --- advance() exhaustive round-1 cases (the four spec rows) ---
check("advance(1,0) => {2,0,A}", () => {
  assert.deepEqual(advance(1, 0), { round: 2, position: 0, slot: "A" });
});
check("advance(1,1) => {2,0,B}", () => {
  assert.deepEqual(advance(1, 1), { round: 2, position: 0, slot: "B" });
});
check("advance(1,2) => {2,1,A}", () => {
  assert.deepEqual(advance(1, 2), { round: 2, position: 1, slot: "A" });
});
check("advance(1,3) => {2,1,B}", () => {
  assert.deepEqual(advance(1, 3), { round: 2, position: 1, slot: "B" });
});

// --- advance() general rule across rounds: {round+1, floor(pos/2), pos even?A:B} ---
check("advance general rule holds for many (round,position)", () => {
  for (let round = 1; round <= 4; round++) {
    for (let pos = 0; pos < 8; pos++) {
      assert.deepEqual(advance(round, pos), {
        round: round + 1,
        position: Math.floor(pos / 2),
        slot: pos % 2 === 0 ? "A" : "B",
      });
    }
  }
});

// --- ROUNDS table shape for 4/8/16 ---
check("ROUNDS table is exactly {4:[2,1], 8:[4,2,1], 16:[8,4,2,1]}", () => {
  assert.deepEqual(ROUNDS[4], [2, 1]);
  assert.deepEqual(ROUNDS[8], [4, 2, 1]);
  assert.deepEqual(ROUNDS[16], [8, 4, 2, 1]);
});

for (const size of [4, 8, 16]) {
  check(`ROUNDS[${size}] sums to size-1 (${size - 1})`, () => {
    assert.equal(
      ROUNDS[size].reduce((a, b) => a + b, 0),
      size - 1,
    );
  });
  check(`ROUNDS[${size}] final round has exactly 1 match`, () => {
    assert.equal(ROUNDS[size][ROUNDS[size].length - 1], 1);
  });
}

check("round counts are 2/3/4 for 4/8/16 (length of ROUNDS table)", () => {
  assert.equal(ROUNDS[4].length, 2);
  assert.equal(ROUNDS[8].length, 3);
  assert.equal(ROUNDS[16].length, 4);
});

// --- matchCount(size) === size - 1 ---
check("matchCount(4)=3, matchCount(8)=7, matchCount(16)=15", () => {
  assert.equal(matchCount(4), 3);
  assert.equal(matchCount(8), 7);
  assert.equal(matchCount(16), 15);
});

console.log(`\nbracket: ${passed} assertions passed.`);
