---
phase: 04-bracket-generation-public-view
plan: 01
subsystem: bracket-generation
tags: [prisma, bracket, single-elimination, transaction, tdd]
requires:
  - "src/lib/services/tournament-status.ts (transitionTournament)"
  - "Tournament + Pair models (Phases 2-3)"
provides:
  - "Match Prisma model (advancement-pointer tree) + Pair/Tournament back-relations"
  - "advance() pure slot-arithmetic, ROUNDS table, matchCount()"
  - "generateBracket(prisma, tournamentId) — transactional generate-once (BRKT-01/BRKT-03)"
affects:
  - "Plan 04-02 (Старт action + public bracket view) consumes Match + generateBracket"
  - "Phase 5 (results/advancement) fills Match.winnerId + adds setsWonA/B + SetScore"
tech-stack:
  added: []
  patterns:
    - "Pure framework-agnostic math (advance/ROUNDS) tested without Prisma"
    - "Single $transaction check-then-act with DB-authoritative guards (mirrors registerPair)"
    - "FINAL-FIRST match creation so children link to existing parent ids"
key-files:
  created:
    - "src/lib/services/bracket.ts"
    - "src/lib/services/bracket.test.ts"
    - "prisma/migrations/20260606144135_add_match/migration.sql"
  modified:
    - "prisma/schema.prisma"
decisions:
  - "Counts table-driven (ROUNDS), NOT log2 — avoids float/off-by-one (Pitfall 2)"
  - "Plain Error (RU messages) on reject, not a typed error class — action maps them in Plan 02"
  - "transitionTournament reused inside the same tx as the single status-machine source of truth"
metrics:
  duration_min: 3
  completed: "2026-06-06"
  tasks: 3
  files: 4
---

# Phase 4 Plan 01: Match model + bracket generation core Summary

Test-first delivery of the project's highest-risk code: the `Match` advancement-pointer model (migrated) plus `src/lib/services/bracket.ts` — the pure `advance()` slot-arithmetic, the table-driven `ROUNDS`/`matchCount`, and the transactional, generate-once `generateBracket(prisma, tournamentId)` that draws a full single-elimination tree (Fisher–Yates) and flips the tournament to `in_progress`.

## What Was Built

- **Match model** (`prisma/schema.prisma`, migration `add_match`): `id/tournamentId(+Cascade)/round/position`, nullable `pairAId/pairBId/winnerId/nextMatchId/nextSlot`, self-relation `"Bracket"` (`nextMatch`/`feederMatches`), `@@index([tournamentId, round])`, `@@map("match")`. Pair back-relations `matchesAsA/matchesAsB/matchesWon`, `Tournament.matches`. No Phase 5 fields (no `setsWonA/B`, no `SetScore`). kysely override + auth tables untouched.
- **`advance(round, position)`** — pure, Prisma-free: `{ round+1, floor(position/2), position%2===0?"A":"B" }`.
- **`ROUNDS`** = `{4:[2,1], 8:[4,2,1], 16:[8,4,2,1]}`, **`matchCount(size)`** = `size-1`. Derived as a fixed table, not log2 (Pitfall 2).
- **`generateBracket`** — one `$transaction`: re-read status (must be `registration`), reject unsupported size / pair-count ≠ size, reject if any Match exists (BRKT-03 immutability), Fisher–Yates shuffle + assign `Pair.seed` 1..size, create `size-1` matches FINAL-FIRST wiring child→parent via `advance()`, fill round-1 two pairs each, transition →`in_progress` via `transitionTournament`. Any throw rolls back — no partial bracket (Pitfall 3 / T-04-01/02).

## Tasks Completed

| Task | Name | Commits | Key files |
|------|------|---------|-----------|
| 1 | advance() + ROUNDS + matchCount (TDD) | c2f7210 (RED), e290e15 (GREEN) | bracket.ts, bracket.test.ts |
| 3 | [BLOCKING] Match model + back-relations + migration | 6c80561 | schema.prisma, migration.sql |
| 2 | generateBracket transactional generate-once (TDD) | 90d4618 (RED), 16daf9d (GREEN) | bracket.ts, bracket.test.ts |

Task 3 (BLOCKING migration) was run before Task 2 GREEN so the `@prisma/client` `Match` type existed for `tsc` — same ordering as Phase 3 Plan 01 Task 3.

## Verification

- `npx tsx src/lib/services/bracket.test.ts` → **40 assertions passed (exit 0)**. Covers, for 4/8/16: advance() exhaustive + general rule; match count 3/7/15; round counts 2/3/4; round-1 fully paired with each pair used once; rounds>1 null slots; full wiring (every non-final → exactly one parent slot matching advance(), distinct A/B per parent, final unparented, no orphan/cycle); seeds 1..size; happy-path status flip. Reject paths (wrong status, pair count < / > size, existing Match, unsupported size 6) each create nothing and write no status.
- `npx prisma validate` → valid. `npx prisma migrate status` → "Database schema is up to date!" (4 migrations).
- `npx tsc --noEmit` → clean (exit 0).
- `npm run build` → success (11 routes generated).
- `dev.db` has `match` table (self-relation FK, `match_tournamentId_round_idx`) alongside intact `user/session/account/verification/tournament/pair`.
- `git diff prisma/schema.prisma` → only Match model + 3 Pair back-relations + `Tournament.matches` added.

## TDD Gate Compliance

Both TDD tasks followed RED→GREEN with separate commits:
- Task 1: `test(04-01)` c2f7210 (module absent → fail) → `feat(04-01)` e290e15 (14 assertions pass).
- Task 2: `test(04-01)` 90d4618 (`generateBracket is not a function` → fail) → `feat(04-01)` 16daf9d (40 assertions pass).

## Deviations from Plan

None — plan executed exactly as written. One in-task fix during Task 2 GREEN: the fake `match.create` test helper spread `id` twice (`{ id, ...rec }` where `rec` already had `id`), tripping TS2783; changed to `{ ...rec }`. This was a test-harness type error in the same task's new code, not a plan deviation.

## Notes for Plan 02

- `generateBracket` throws plain `Error` with RU messages on every reject path — the «Старт» Server Action should `try/catch` and surface `error.message`, and gate the button on `status === "registration" && pairCount === size`.
- Authorization (requireAdmin) is intentionally NOT in the service (T-04-03 transfer) — it is the action's first line in Plan 02.
- Public bracket view: single `findMany({ where: { tournamentId }, include: { pairA, pairB } })`, group by `round`, order by `position`; null pair slots render as «TBD».

## Self-Check: PASSED

All created files exist on disk; all 5 task commits (c2f7210, e290e15, 6c80561, 90d4618, 16daf9d) present in git history.
