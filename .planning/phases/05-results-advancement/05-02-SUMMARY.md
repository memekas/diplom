---
phase: 05-results-advancement
plan: 02
subsystem: scoring
tags: [scoring, advancement, transactional, tdd, match-02, match-03, match-04, match-05]
requires:
  - "05-01: setWinner, matchWinnerFromSets, ResultError (codes invalid_set|slots_unfilled|no_winner|empty)"
  - "Phase 4: bracket.ts advance + Match.winnerId/nextMatchId/nextSlot already wired"
  - "Phase 2: tournament-status.ts transitionTournament (in_progress→finished); Tournament.setsPerMatch/gamesPerSet"
provides:
  - "recordResult(prisma, matchId, sets: {gamesPair1,gamesPair2}[]): RecordResultSummary — transactional result + advancement (MATCH-02/03/04)"
  - "SetScore model (cascade from Match, @@unique[matchId,setNumber]) + Match.setsWonA/B + Match.setScores (MATCH-05)"
  - "SetInput / RecordResultSummary types"
affects:
  - "Plan 03 action+UI: calls recordResult inside a requireAdmin Server Action, then revalidatePath"
tech-stack:
  added: []
  patterns:
    - "Transactional service mirroring generateBracket: prisma.$transaction(async tx => ...), tx as unknown as PrismaClient when calling transitionTournament"
    - "Typed ResultError reject → whole-transaction rollback (no partial writes)"
    - "delete-then-recreate SetScores for free edit (MATCH-04)"
key-files:
  created:
    - prisma/migrations/20260606151631_add_setscore/migration.sql
  modified:
    - prisma/schema.prisma
    - src/lib/services/result.ts
    - src/lib/services/result.test.ts
decisions:
  - "Too-many-sets (sets.length > setsPerMatch) reuses ResultError code \"empty\" (no new code added — keeps the 4-code union from Plan 01 intact)"
  - "Final re-record guard: re-read tournament.status inside the tx; if already \"finished\", skip transitionTournament (no-op) instead of letting it throw on the stale `from` — so MATCH-04 edits of the final don't error"
  - "winnerId derived server-side, constrained ∈ {pairAId, pairBId} with a defensive check (T-05-01)"
metrics:
  duration: ~6 min
  completed: 2026-06-06
  tasks: 1
  files: 4
---

# Phase 05 Plan 02: SetScore schema + recordResult advancement Summary

Migrated the structured-scoring schema (SetScore + Match.setsWonA/B + back-relation) and built `recordResult` — a single-transaction engine that validates sets, derives + persists the winner, advances it into the pre-existing parent slot, and finishes the tournament on the final. Built test-first against a fake prisma; 43 assertions pass, tsc clean, production build green.

## What Was Built

- **Schema (`prisma/schema.prisma`)** — additive only (25 insertions, no existing field touched):
  - `model SetScore { id, matchId, match @relation(...onDelete: Cascade), setNumber, gamesPair1, gamesPair2, @@unique([matchId, setNumber]), @@map("set_score") }`.
  - `Match.setsWonA Int?`, `Match.setsWonB Int?` (cached display counts), `Match.setScores SetScore[]` back-relation.
  - Tournament.setsPerMatch/gamesPerSet, Match.winnerId/nextMatchId/nextSlot, kysely override, auth tables — all untouched.
- **Migration `20260606151631_add_setscore`** — applied; `dev.db` has `set_score` (cascade FK, unique [matchId,setNumber]) + `match.setsWonA/setsWonB` columns.
- **`recordResult(prisma, matchId, sets[])`** in `src/lib/services/result.ts` — one `prisma.$transaction`:
  1. load match (pairAId/pairBId/nextMatchId/nextSlot) + tournament (setsPerMatch, gamesPerSet);
  2. reject `slots_unfilled` if either pair slot null;
  3. reject `empty` on no sets or `sets.length > setsPerMatch`;
  4. validate each set via `setWinner` (bubbles `invalid_set`), tally setsWonA/B;
  5. derive winner via `matchWinnerFromSets`, reject `no_winner` if null; winnerId = side→pairAId/pairBId (defensive ∈-check);
  6. `setScore.deleteMany` + recreate rows 1..n (free edit MATCH-04);
  7. update match setsWonA/B + winnerId;
  8. if nextMatchId → UPDATE pre-existing parent slot (nextSlot) with winnerId;
  9. if no nextMatchId (final) → `transitionTournament(tx, ..., "in_progress", "finished")`, guarded as a no-op when already finished.
  Returns `{ matchId, winnerId, setsWonA, setsWonB, finished }`.

## TDD: RED → [migrate] → GREEN

- **RED** (`56add93`): extended `result.test.ts` with 11 fake-prisma transactional cases; `npx tsx` failed `recordResult is not a function`.
- **Migration (BLOCKING)** between RED and GREEN: edited schema, `npx prisma migrate dev --name add_setscore` (had a TTY — interactive fallback NOT needed), `npx prisma generate`, `npx prisma migrate status` → "Database schema is up to date!". So `@prisma/client` exposes SetScore + setsWonA/B for tsc.
- **GREEN** (`bac9385`): implemented `recordResult`; re-run → **all 43 assertions pass, exit 0**.
- **REFACTOR**: none — implementation is minimal and reads the 9-step contract linearly.

## Verification

- `npx tsx src/lib/services/result.test.ts` → exit 0, **43 assertions passed** (32 pure from 05-01 + 11 transactional: advance 2:0, slot-B routing, 2:1 three-rows, final→finished, slots_unfilled/no_winner/invalid_set/empty/too-many rejects, free-edit flip, re-record-final no-op).
- `npx tsc --noEmit` → exit 0 (SetScore + setsWonA/B types resolve).
- `npm run build` → success (11/11 static pages, all routes compiled).
- `npx prisma migrate status` → "Database schema is up to date!" (6 migrations, no drift).
- `npx prisma validate` → valid.
- `grep -nE "transitionTournament|matchWinnerFromSets|setWinner" src/lib/services/result.ts` → all three wired (key-links).
- `dev.db` (sqlite3): `set_score` table present with cascade FK + unique index; `match.setsWonA/setsWonB` columns present.
- `git diff --stat prisma/schema.prisma` → 25 insertions only (no existing field/relation modified).
- git log: `test(05-02)` (56add93) precedes `feat(05-02)` (bac9385).

## Deviations from Plan

None — plan executed as written. Reject for `sets.length > setsPerMatch` reuses the existing `empty` ResultError code (per Plan 01's intent to keep the 4-code union closed); the plan's behavior block listed this reject under the empty/too-many path without mandating a new code.

## Note for Plan 03

- Signature: `recordResult(prisma, matchId: string, sets: { gamesPair1: number; gamesPair2: number }[]): Promise<{ matchId, winnerId, setsWonA, setsWonB, finished }>`.
- `recordResult` is **auth-free** by design (like bracket.ts) — Plan 03 must enforce `requireAdmin` as the first line of the Server Action, and call `revalidatePath` after success (verify on prod build).
- Map `ResultError.code` → friendly RU message: `slots_unfilled` | `empty` | `invalid_set` | `no_winner`. `empty` also covers "too many sets".
- `finished: true` in the summary means the tournament was finished (final recorded) — use for champion display.

## Self-Check: PASSED

- FOUND: prisma/migrations/20260606151631_add_setscore/migration.sql
- FOUND: src/lib/services/result.ts (recordResult exported)
- FOUND: src/lib/services/result.test.ts
- FOUND commit: 56add93 (RED)
- FOUND commit: bac9385 (GREEN)
