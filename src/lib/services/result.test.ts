// Unit tests for the pure tennis-scoring core (MATCH-01 set rule, MATCH-02 match-winner rule).
// Run: npx tsx src/lib/services/result.test.ts
// (No test framework — self-contained assertion script mirroring bracket.test.ts. All
// cases are synchronous pure-function checks; exits non-zero on failure.)
import assert from "node:assert/strict";
import { setWinner, matchWinnerFromSets, ResultError } from "./result";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
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

console.log(`\n${passed} assertions passed.`);
