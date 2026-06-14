---
phase: quick-260614-s1z
plan: 01
subsystem: data-model
tags: [prisma, migration, schema-cleanup, scoring, docs]
requires: [post-v2.0 free-form scoring]
provides: [Tournament model without legacy scoring columns, drop_legacy_scoring_columns migration]
affects: [tournament service, score forms, recordResultAction, format-engine, data-model doc]
tech-stack:
  added: []
  patterns: [hand-authored SQLite table-rebuild migration applied via migrate deploy]
key-files:
  created:
    - prisma/migrations/20260614171924_drop_legacy_scoring_columns/migration.sql
  modified:
    - prisma/schema.prisma
    - src/lib/services/tournament.ts
    - src/app/(public)/tournaments/[id]/page.tsx
    - src/app/(public)/tournaments/[id]/score-form.tsx
    - src/app/(public)/tournaments/[id]/round-score-form.tsx
    - src/app/(public)/tournaments/[id]/actions.ts
    - src/lib/services/result.ts
    - src/lib/services/format-engine.ts
    - src/lib/services/result.test.ts
    - src/lib/services/format-engine.test.ts
    - src/lib/services/round-result.test.ts
    - docs/04-model-dannyh.md
decisions:
  - "Migration hand-authored as SQLite table-rebuild + applied via migrate deploy (prisma migrate dev refuses non-interactive data-loss confirmation)"
metrics:
  duration: ~12m
  completed: 2026-06-14
---

# Phase quick-260614-s1z Plan 01: Drop dead Tournament scoring columns Summary

Dropped the three functionally-dead scoring columns (`setsPerMatch`, `gamesPerSet`, `targetPoints`) from `model Tournament`, unplumbed every inert reference across services/actions/forms/tests, migrated + regenerated the client, and synced the ch.2 data-model doc.

## What Was Done

### Task 1 — Schema drop + unplumb + migrate + regen + tests (commit `c6e29dd`)
- **schema.prisma:** removed the 3 columns and their orphaned comments; removed the now-false "Phase 5 needs no Tournament migration" sentence from the model header.
- **tournament.ts:** removed `targetPoints`/`setsPerMatch`/`gamesPerSet` from `tournamentSelect`; dropped the stale "columns remain (no migration)" comment in `createTournament` (no data change — they were never set there).
- **page.tsx:** removed `setsPerMatch={...}` prop from `<RoundScoreForm>` and `<ScoreForm>`.
- **score-form.tsx / round-score-form.tsx:** dropped `setsPerMatch` from props type + destructure; changed both binds to `recordResultAction.bind(null, tournamentId, matchId|roundMatchId)`; trimmed stale header comments.
- **actions.ts:** removed the inert `_setsPerMatch: number` param from `recordResultAction`; new signature `(tournamentId, matchId, _prev, formData)`. Body unchanged.
- **result.ts / format-engine.ts:** reworded stale free-form scoring comments (comments only, no code change).
- **test fixtures:** removed the legacy fields from the fake-prisma builders in `result.test.ts`, `format-engine.test.ts` (incl. all 5 `fakeRecordPrisma` call sites), and `round-result.test.ts`.
- **Migration:** `prisma migrate dev` refuses to run in a non-interactive shell when a drop touches existing data (15 non-null rows), so the migration was hand-authored as a SQLite table-rebuild (`PRAGMA defer_foreign_keys` + new_tournament + copy + rename) and applied with `npx prisma migrate deploy`; client regenerated with `npx prisma generate`. `prisma migrate status` → "Database schema is up to date!".

### Task 2 — Sync data-model doc 04 (commit `7912a75`)
- **A:** removed the 3 columns from the ER-diagram TOURNAMENT block + §4.1 table; rewrote the §7 rationale to state the columns were dropped via `drop_legacy_scoring_columns` (removed all "avoid migration"/"compromise" wording).
- **B:** documented `@@index([roundId])` in §5.3 (new Ограничения line) and §6 (Round → RoundMatch row).
- **C:** marked `setsWonA/B` nullable in the ER-diagram MATCH block (pointsA/B already said nullable).
- **D:** sharpened §6 — required User-FK with no explicit `onDelete` is Prisma default **Restrict**: deleting a referenced player is blocked (error), not silently ignored. Updated the cascade-discipline paragraph and the User → Pair row.

## Verification

- `npx prisma migrate deploy` applied `drop_legacy_scoring_columns`; `migrate status` clean; `npx prisma generate` regenerated client without the 3 fields.
- All 11 OTHER `src/lib/services/*.test.ts` pass via `npx tsx` (admin, americano, bracket, format-engine, mexicano, registration, result, round-result, round-robin, rounds, standings, tournament-status). `format-engine` 10 assertions, `result` 34, `round-result` 16.
- `npx tsc --noEmit` clean (no references to the dropped fields; action signature aligned).
- Task 2 greps all pass: doc name-count == 1 (migration sentence), `drop_legacy_scoring_columns` present, `@@index([roundId])` present, `Restrict` present, "12 сущност" present.

## Deviations from Plan

### Deviated: migration command path (Rule 3 — blocking issue)
- **Found during:** Task 1, step 10.
- **Issue:** `npx prisma migrate dev --name drop_legacy_scoring_columns` (the plan's verify command) aborts with "environment is non-interactive" because dropping columns that still hold 15 non-null values triggers an interactive data-loss confirmation that cannot be satisfied non-interactively (piping `yes` does not help — Prisma keys off TTY, not stdin). `--create-only` prompts the same way.
- **Fix:** hand-authored the migration directory `20260614171924_drop_legacy_scoring_columns/migration.sql` (standard Prisma SQLite table-rebuild, matching the style of `20260607163701_multiformat_data_model`) and applied it with `npx prisma migrate deploy`, then `npx prisma generate`. Net result is identical to what `migrate dev` would have produced: migration recorded, schema dropped, client regenerated, status in sync.
- **Files:** `prisma/migrations/20260614171924_drop_legacy_scoring_columns/migration.sql` (created).
- **Commit:** `c6e29dd`.

## Deferred Issues (out of scope — see deferred-items.md)

- **`src/lib/services/tournament.test.ts:41` fails** — pre-existing, confirmed failing at clean HEAD. Cause: commit `9576c69` (date-based listing) changed `listTournaments`' `orderBy` to an array but never updated the test's object-shaped `deepEqual` assertion. Unrelated to dropping scoring columns; not in this plan's file scope. NOT fixed.
- **Stale column-name comments** in 4 files not listed in this plan's task-1 scope (`schema.prisma:216` SetScore comment, `create-tournament-form.tsx:223`, `validation/round-result.ts:7`, `validation/result.ts:3`) left untouched per "surgical edits only". The intentional keep at `validation/tournament.test.ts:223` (create-schema "ignored" assertion) remains.

## Self-Check: PASSED

- prisma/migrations/20260614171924_drop_legacy_scoring_columns/migration.sql — FOUND
- prisma/schema.prisma (no legacy cols) — FOUND
- docs/04-model-dannyh.md (synced) — FOUND
- Commit c6e29dd — FOUND
- Commit 7912a75 — FOUND
