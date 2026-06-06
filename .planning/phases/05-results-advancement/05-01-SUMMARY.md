---
phase: 05-results-advancement
plan: 01
subsystem: scoring
tags: [scoring, pure-functions, tdd, match-01, match-02]
requires: []
provides:
  - "setWinner(gamesA, gamesB, gamesPerSet): Side — single-set validation + winner (MATCH-01)"
  - "matchWinnerFromSets(setWins, setsPerMatch): Side | null — first-to-majority (MATCH-02)"
  - "ResultError typed class (code: invalid_set | slots_unfilled | no_winner | empty)"
affects:
  - "Plan 02 recordResult (consumes setWinner/matchWinnerFromSets + ResultError codes)"
  - "Plan 03 UI (leans on the proven contract)"
tech-stack:
  added: []
  patterns:
    - "Pure Prisma-free service module + typed *Error class (bracket.ts house style)"
    - "Dependency-free tsx assertion harness (node:assert/strict, pass counter)"
key-files:
  created:
    - src/lib/services/result.ts
    - src/lib/services/result.test.ts
  modified: []
decisions:
  - "Set validity reads gamesPerSet from the parameter (not hardcoded 6): win at gamesPerSet with margin>=2, OR gamesPerSet+1 vs gamesPerSet-1 (7:5), OR tiebreak gamesPerSet+1:gamesPerSet (7:6)"
  - "ResultError carries the full 4-code union now so Plan 02/03 import one error type; only invalid_set is thrown by this pure module"
metrics:
  duration: ~2 min
  completed: 2026-06-06
  tasks: 1
  files: 2
---

# Phase 05 Plan 01: Pure tennis-scoring functions Summary

setWinner + matchWinnerFromSets implemented test-first as pure Prisma-free functions with a typed ResultError, mirroring the bracket.ts house style; 32 dependency-free assertions pass and tsc is clean.

## What Was Built

- `src/lib/services/result.ts` — pure scoring core:
  - `setWinner(gamesA, gamesB, gamesPerSet): "A" | "B"` — validates a single set and returns the winning side. Valid wins: (a) winner === gamesPerSet with margin >= 2; (b) winner === gamesPerSet+1 with loser === gamesPerSet-1 (the 7:5 case); (c) tiebreak winner === gamesPerSet+1, loser === gamesPerSet (7:6). Integer + non-negative guards. Throws `ResultError("invalid_set", <RU msg with the two scores>)` otherwise.
  - `matchWinnerFromSets(setWins, setsPerMatch): "A" | "B" | null` — counts set wins, returns the first side to `ceil(setsPerMatch/2)`, else `null` (undecided; does not throw).
  - `ResultError extends Error` with `code: "invalid_set" | "slots_unfilled" | "no_winner" | "empty"` and `name = "ResultError"`.
- `src/lib/services/result.test.ts` — 32-assertion dependency-free tsx suite.

## TDD: RED → GREEN → REFACTOR

- **RED** (`19bab25`): authored `result.test.ts` first; `npx tsx src/lib/services/result.test.ts` failed with `Cannot find module './result'` (exit 1) — no exports existed yet.
- **GREEN** (`d5a82ed`): implemented `result.ts`. First run surfaced that 7:5 must be valid (extended win at gamesPerSet+1, loser gamesPerSet-1) — added that branch to `isValidSet` alongside clean-win and tiebreak. Re-run: **all 32 assertions passed, exit 0**.
- **REFACTOR**: none required — the `isValidSet` helper was already extracted during GREEN; the module is minimal and reads the rules as single boolean expressions.

## Verification

- `npx tsx src/lib/services/result.test.ts` → exit 0, **32 assertions passed**.
- `npx tsc --noEmit` → exit 0 (clean).
- `grep -nE "from \"@prisma/client\"|@/lib/db" src/lib/services/result.ts` → no match (Prisma-free confirmed).
- TDD gate: `test(05-01)` commit `19bab25` (RED) precedes `feat(05-01)` commit `d5a82ed` (GREEN).

## Deviations from Plan

None — plan executed as written. The 7:5 "extended win" branch was a refinement during GREEN to satisfy a spec-listed valid case (the plan's prose described it as valid; the rule was generalized to `gamesPerSet+1 vs gamesPerSet-1`), not a deviation from intent.

## Self-Check: PASSED

- FOUND: src/lib/services/result.ts
- FOUND: src/lib/services/result.test.ts
- FOUND commit: 19bab25 (RED)
- FOUND commit: d5a82ed (GREEN)
