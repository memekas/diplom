---
phase: 09-format-engines
plan: 01
subsystem: format-engines
tags: [round-robin, circle-method, FMT-01, schedule, prisma-transaction]
requires:
  - "src/lib/services/tournament-status.ts (transitionTournament)"
  - "prisma/schema.prisma (Round, RoundMatch, Pair, TournamentPlayer)"
provides:
  - "circleMethodSchedule<T> — pure circle-method round-robin scheduler"
  - "generateRoundRobin(prisma, tournamentId) — transactional schedule generator"
  - "FormatError — typed reject (not_open|wrong_format|already_generated|no_units)"
affects:
  - "09-06 dispatch (startTournamentAction routes round_robin → generateRoundRobin)"
tech-stack:
  added: []
  patterns:
    - "pure-fn-first: schedule math solved once, tested without DB (mirror bracket.advance)"
    - "one-transaction generate-once (mirror generateBracket)"
    - "shuffle-once outside the pure scheduler for determinism"
key-files:
  created:
    - "src/lib/services/round-robin.ts"
    - "src/lib/services/round-robin.test.ts"
  modified: []
decisions:
  - "BYE = null sentinel appended for odd N; BYE side produces no RoundMatch"
  - "courtNumber re-indexed 0-based over really-created matches (no holes after BYE skip)"
  - "pairs reuse all 4 team FKs; singles fill teamA1/teamB1 only (teamA2/teamB2 null)"
metrics:
  duration_min: 2
  completed: 2026-06-07
  tasks: 2
  files: 2
---

# Phase 09 Plan 01: Round-Robin Format Engine Summary

Round-robin (FMT-01) circle-method engine: a Prisma-free `circleMethodSchedule` that yields a complete "each-meets-each" schedule (odd N → one unit sits per round, no BYE match), plus a transactional `generateRoundRobin` that mirrors `generateBracket` — single transaction, generate-once guard, pairs/singles unit branching, and a `registration→in_progress` status flip via `transitionTournament`.

## What Was Built

- **`circleMethodSchedule<T>(units): ScheduledRound<T>[]`** — generic, deterministic (no internal shuffle). Even N → N-1 rounds; odd N → a `null` BYE sentinel is appended → N rounds, each unit sits exactly once. `arr[0]` is fixed forever, only the tail rotates (FORMATS §1 error 1 avoided). `courtNumber` is re-indexed 0-based over matches actually created in a round.
- **`generateRoundRobin(prisma, tournamentId)`** — `prisma.$transaction`: re-reads status/format/participantMode, generate-once via `round.count > 0`, loads units (`Pair` for pairs → 4 FKs reused; `TournamentPlayer` for singles → teamA1/teamB1 only), shuffles once, persists all `Round` + `RoundMatch`, then `transitionTournament`. Returns `{ tournamentId, roundsCreated, matchesCreated }`.
- **`FormatError`** — typed reject (`not_open | wrong_format | already_generated | no_units`), mirror of `BracketError`; keeps raw Prisma text off the client (T-09-03).
- **`round-robin.test.ts`** — 28 assertions: pure-fn (N=4/6 even, N=3/5 odd BYE, each-meets-each invariant via C(n,2), arr[0]-fixed, determinism, contiguous courtNumber) + fake-prisma transactional cases (pairs 4-FK, singles null A2/B2, status flip, not_open/wrong_format/already_generated/no_units).

## Deviations from Plan

None - plan executed exactly as written. Both tasks (pure scheduler RED→GREEN, then transactional generator) were implemented in the two planned files and verified together; committed as a single FMT-01 feature commit since both deliverables live in the same new file pair.

## Verification

- `npx tsx src/lib/services/round-robin.test.ts` → 28 assertions passed, exit 0.
- `npx tsc --noEmit` → exit 0.
- Regression: all 8 existing `*.test.ts` green (224 assertions: admin 10, bracket 40, registration 18, result 43, tournament-status 16, profile 33, registration-validation 8, tournament-validation 56). `bracket.ts`/`result.ts` untouched; no migrations; no new deps.

## Commits

- `838bce3` feat(09): round-robin format engine (FMT-01)

## Self-Check: PASSED

- FOUND: src/lib/services/round-robin.ts
- FOUND: src/lib/services/round-robin.test.ts
- FOUND commit: 838bce3
