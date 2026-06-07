---
phase: 09-format-engines
plan: 02
subsystem: format-engines
tags: [americano, circle-method, FMT-02, partner-once, schedule, prisma-transaction]
requires:
  - "src/lib/services/tournament-status.ts (transitionTournament)"
  - "prisma/schema.prisma (Round, RoundMatch, TournamentPlayer)"
provides:
  - "americanoSchedule<T> — pure circle-on-players, partner-once scheduler"
  - "generateAmericano(prisma, tournamentId) — transactional americano generator (singles)"
  - "FormatError — typed reject (not_open|wrong_format|already_generated|no_units)"
affects:
  - "09-06 dispatch (startTournamentAction routes americano → generateAmericano)"
tech-stack:
  added: []
  patterns:
    - "pure-fn-first: partner-once rotation solved once, tested without DB"
    - "one-transaction generate-once (mirror generateRoundRobin/generateBracket)"
    - "shuffle-once outside the pure scheduler for determinism"
    - "FormatError declared locally per service (no cross-service import)"
key-files:
  created:
    - "src/lib/services/americano.ts"
    - "src/lib/services/americano.test.ts"
  modified: []
decisions:
  - "americano is always singles — read TournamentPlayer, never Pair (Pitfall 3)"
  - "partnership = positions (i, N-1-i); court k = partnership(2k) vs partnership(2k+1)"
  - "BYE=null appended for odd N (1 sit-out); N≡2 mod4 → last unpaired partnership sits (2 sit-out)"
  - "totalRounds = N-1 derived from circle; schedule is the source, totalRounds informational (RESEARCH OQ1/A4)"
metrics:
  duration_min: 2
  completed: 2026-06-07
  tasks: 2
  files: 2
---

# Phase 09 Plan 02: Americano Format Engine Summary

Americano (FMT-02) circle-on-players engine: a Prisma-free `americanoSchedule` guaranteeing partner-once (each player partners every other exactly once over N-1 rounds, 0 duplicate partnerships), plus a transactional `generateAmericano` mirroring `generateRoundRobin` — singles-only source (TournamentPlayer), single transaction, generate-once guard, 4-FK partnership persistence, and a `registration→in_progress` flip via `transitionTournament`.

## What Was Built

- **`americanoSchedule<T>(players): AmericanoRound<T>[]`** — generic, deterministic (no internal shuffle), strictly per FORMATS §2. Even N → N-1 rounds; `arr = [fixed, ...ring]`, partnerships from positions `(i, N-1-i)`, court `k = partnership(2k) vs partnership(2k+1)`, ring rotates by one each round, `arr[0]` fixed forever. Odd N → `null` BYE appended (1 player sits/round). N≡2 mod4 → odd partnership count → last unpaired partnership sits (2 players sit). `courtNumber` 0-based over courts actually created. Verified against the exact FORMATS §2 N=4 example (R1 0&3vs1&2 / R2 0&2vs3&1 / R3 0&1vs2&3).
- **`generateAmericano(prisma, tournamentId)`** — `prisma.$transaction`: re-reads status/format, generate-once via `round.count > 0`, loads players from `TournamentPlayer` (singles; never Pair), `< 4` → `no_units`, shuffles once, persists all `Round` + `RoundMatch` (teamA1/A2 = partnership A, teamB1/B2 = partnership B), then `transitionTournament`. Returns `{ tournamentId, roundsCreated, matchesCreated }`.
- **`FormatError`** — typed reject (`not_open | wrong_format | already_generated | no_units`), declared locally (no cross-import from round-robin.ts); keeps raw Prisma text off the client (T-09-07).
- **`americano.test.ts`** — 29 assertions: pure-fn (FORMATS §2 N=4 exact example, partner-once invariant C(N,2)/0 dupes for N=4/8/12/16, N/4 courts per round, no self-partnership, arr[0]-fixed, determinism, sit-outs N=5 BYE / N=6 N≡2mod4) + fake-prisma transactional cases (8 players → 7 rounds/14 matches with 4 FKs, status flip, not_open/wrong_format/already_generated/no_units).

## Deviations from Plan

None - plan executed exactly as written. Both tasks (pure scheduler RED→GREEN, then transactional generator) were implemented in the two planned files and verified together; committed as a single FMT-02 feature commit since both deliverables live in the same new file pair (mirror of 09-01).

## Verification

- `npx tsx src/lib/services/americano.test.ts` → 29 assertions passed, exit 0.
- `npx tsc --noEmit` → exit 0.
- Regression: all 10 `*.test.ts` green (281 assertions: admin 10, americano 29, bracket 40, registration 18, result 43, round-robin 28, tournament-status 16, profile 33, registration-validation 8, tournament-validation 56). Playoff (`bracket.ts`/`result.ts`) untouched; no migrations; no new deps.

## Commits

- `765d044` feat(09): americano format engine (FMT-02)

## Self-Check: PASSED

- FOUND: src/lib/services/americano.ts
- FOUND: src/lib/services/americano.test.ts
- FOUND commit: 765d044
