---
phase: 09-format-engines
plan: 04
subsystem: format-engines
tags: [mexicano, FMT-02, cross-pair, gate, materialize-once, determinism, rating-rotation, prisma-write]
requires:
  - "src/lib/services/standings.ts (rankPlayers — deterministic player-rating sort)"
  - "src/lib/services/tournament-status.ts (transitionTournament)"
  - "prisma/schema.prisma (Round @@unique([tournamentId, roundNumber]), RoundMatch, PlayerMatchScore)"
provides:
  - "quadCut / crossPairQuad / round1Cut / crossPairCut — pure Prisma-free scheduling math"
  - "generateMexicanoRound1(prisma, tournamentId) — Round-1-only random baseline start"
  - "materializeNextMexicanoRound(tx, tournamentId, completedRoundNumber) — gated rating-driven next round"
  - "FormatError (codes incl. round_incomplete) exported from mexicano.ts"
affects:
  - "09-05 round-result (recordRoundResult calls materializeNextMexicanoRound inside its tx; owns finish-on-totalRounds)"
  - "09-06 dispatch (Server Action routes mexicano start → generateMexicanoRound1)"
  - "Phase 11 VIS (mexicano round/court render)"
tech-stack:
  added: []
  patterns:
    - "pure-fn-first: quad cut + cross-pair solved once, unit-tested without DB (advance()/setWinner() discipline)"
    - "Round-1-only generation: mexicano materializes later rounds one at a time (unlike playoff/RR/americano all-at-once)"
    - "external-tx materialize: materializeNextMexicanoRound accepts caller tx, does NOT open its own $transaction (mirrors transitionTournament)"
    - "gate + materialize-once: count unrecorded RoundMatch → null; existing-Round check + P2002 backstop"
    - "deterministic re-sort: rankPlayers stable userId-asc terminal key makes equal-points quad cut reproducible"
key-files:
  created:
    - "src/lib/services/mexicano.ts"
    - "src/lib/services/mexicano.test.ts"
  modified: []
decisions:
  - "Cross-pair LOCKED D1 «1+4 vs 2+3»: crossPairQuad → teamA=(s0,s3), teamB=(s1,s2) (even teams, rank-sum 5=5)"
  - "Round 1 baseline = NO cross-pair: round1Cut → teamA=(q0,q1), teamB=(q2,q3) on shuffled order"
  - "Mexicano minimum 8 players (FORMATS.md §3 size N≥8) → no_units below"
  - "quadCut drops <4 remainder (those players sit out the round); courtNumber = group index 0-based"
  - "materializeNextMexicanoRound does NOT finish on last round — recordRoundResult (Plan 05) owns totalRounds comparison"
  - "Re-rank aggregates PlayerMatchScore inline (same logic as computeStandings players-branch) then rankPlayers, to consume only the pure sort and keep the tx-typed argument"
metrics:
  duration_min: 5
  completed: 2026-06-07
  tasks: 2
  files: 2
---

# Phase 09 Plan 04: Mexicano Engine (FMT-02) Summary

Mexicano rotation engine: random Round-1 baseline (`generateMexicanoRound1`) plus rating-driven `materializeNextMexicanoRound` (gate on full round → re-sort via `rankPlayers` → consecutive quads by rank → cross-pair LOCKED D1 «1+4 vs 2+3»), with materialize-once enforced by an existing-Round check and a P2002 backstop. Pure cut/cross-pair math is Prisma-free and determinism-tested.

## What Was Built

- **Pure scheduling math** (`mexicano.ts`, Prisma-free):
  - `quadCut(ids)` — cuts an ordered list into consecutive quads `ids[4g..4g+3]`, `courtNumber = g`; a <4 remainder is dropped (sit-out).
  - `crossPairQuad([s0,s1,s2,s3])` — LOCKED D1 «1+4 vs 2+3»: `teamA=[s0,s3]`, `teamB=[s1,s2]`.
  - `round1Cut(ids)` — baseline (no cross): `teamA=(q0,q1)`, `teamB=(q2,q3)`.
  - `crossPairCut(rankedIds)` — `quadCut` + `crossPairQuad` per quad (rounds 2..R).
- **`generateMexicanoRound1(prisma, tournamentId)`** — one transaction: re-reads status (`not_open`), format (`wrong_format`), generate-once (`already_generated`), loads singles `TournamentPlayer` (min 8 → `no_units`), shuffles once → `round1Cut` → creates ONLY Round 1 + its RoundMatch, flips `registration → in_progress` via `transitionTournament`. Returns `{ tournamentId, roundsCreated: 1, matchesCreated }`.
- **`materializeNextMexicanoRound(tx, tournamentId, completedRoundNumber)`** — accepts the caller's tx (no own `$transaction`): (1) gate — returns `null` if the completed round has any RoundMatch with null `pointsA`/`pointsB`; (2) materialize-once — `null` if Round r+1 exists; (3) re-aggregates `PlayerMatchScore` cumulatively → `rankPlayers` for deterministic order; (4) `crossPairCut` → creates Round r+1 + RoundMatch; (5) P2002 race backstop → `null`. Returns `{ createdRoundNumber }`.

## Verification

- `npx tsx src/lib/services/mexicano.test.ts` — 16 assertions green (cross-pair exactness, quadCut on 8/12/10, round1Cut baseline, crossPairCut, determinism, fake-prisma: R1 create / already_generated / no_units / wrong_format / not_open, gate / rank-cut+1+4vs2+3 / materialize-once / tie-determinism).
- `npx tsc --noEmit` — exit 0.
- Baseline regression: all 8 existing service suites green (admin 10, americano 29, bracket 40, registration 18, result 43, round-robin 28, standings 12, tournament-status 16). Playoff untouched.

## Deviations from Plan

None — plan executed exactly as written. (`crossPairCut` was added as a small internal helper composing `quadCut`+`crossPairQuad`; it is an implementation convenience, not a scope change — the plan's named exports `quadCut`/`crossPairQuad`/`round1Cut`/`generateMexicanoRound1`/`materializeNextMexicanoRound` are all present.)

## Notes for Downstream

- **Plan 05 (recordRoundResult)** must call `materializeNextMexicanoRound(tx, tournamentId, completedRoundNumber)` INSIDE its own transaction and own the finish decision: compare `completedRoundNumber + 1` (or the returned `createdRoundNumber`) against `totalRounds` → `transitionTournament(... finished)`. This function deliberately never finishes the tournament.
- **Plan 06 (dispatch)** routes the mexicano start action to `generateMexicanoRound1` and maps `FormatError` codes (`not_open|wrong_format|already_generated|no_units`) to RU messages; `requireAdmin()` is the auth gate (service is auth-free by design, T-09-15).

## Self-Check: PASSED

- FOUND: src/lib/services/mexicano.ts
- FOUND: src/lib/services/mexicano.test.ts
- FOUND commit: b2ef624
