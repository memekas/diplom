---
phase: 03-registration-pairs
plan: 01
subsystem: registration
tags: [prisma, transaction, integrity, tdd, pairs]
requires:
  - "src/lib/db.ts (prisma singleton)"
  - "Tournament + User models (Phase 1/2)"
provides:
  - "Pair model + migration (pair table with two per-slot @@unique, cascade-on-tournament-delete)"
  - "registerPair(prisma, {tournamentId, player1Id, player2Id}) transactional integrity service"
  - "RegistrationError typed error (self_partner | already_registered | tournament_full | not_open)"
  - "registerPairSchema + parseRegisterPairForm (player2Id-only validation)"
affects:
  - "prisma/schema.prisma (Tournament.pairs, User.pairsAsP1/pairsAsP2 back-relations)"
tech-stack:
  added: []
  patterns:
    - "single-$transaction check-then-insert (status re-read + count + cross-slot dup + create)"
    - "typed RegistrationError with discriminated code for downstream RU mapping"
    - "dependency-free tsx assertion-script TDD with fake-$transaction harness"
key-files:
  created:
    - "src/lib/validation/registration.ts"
    - "src/lib/validation/registration.test.ts"
    - "src/lib/services/registration.ts"
    - "src/lib/services/registration.test.ts"
    - "prisma/migrations/20260606141738_add_pair/migration.sql"
  modified:
    - "prisma/schema.prisma"
decisions:
  - "All five integrity gates (status, self, capacity, cross-slot dup) + insert run inside ONE prisma.$transaction so count+insert cannot race (Pitfall 7)"
  - "Cross-slot duplicate via findFirst OR[player1Id in, player2Id in]; @@unique constraints kept as defense-in-depth only (cannot catch player-as-p1-here/p2-there)"
  - "player1Id is NOT in registerPairSchema — it comes from session in the action (Plan 02), never the form (T-03-01)"
metrics:
  duration: "~12m"
  completed: "2026-06-06"
  tasks: 3
  files: 6
---

# Phase 3 Plan 01: Pair Model + Transactional registerPair Integrity Core Summary

Pair Prisma model (migrated) plus the atomic `registerPair` service that enforces every REG-02/REG-03 integrity rule (no self-partner, no player in two pairs of one tournament, no over-capacity, registration-open) inside a single `$transaction`, built test-first.

## What Was Built

- **Task 1 (TDD):** `registerPairSchema` (zod, `player2Id` trimmed non-empty, RU message "Выберите партнёра") + `parseRegisterPairForm` mirroring `parseTournamentForm`'s discriminated `{ok,data}|{ok,errors}` shape. player1 identity deliberately excluded (session-sourced downstream). 8 assertions, RED→GREEN.
- **Task 2 (TDD):** `registerPair(prisma, {tournamentId, player1Id, player2Id})` wrapping status re-read → self guard → capacity count → cross-slot `findFirst` → `create`, all in one `prisma.$transaction`. Typed `RegistrationError` with codes `self_partner | already_registered | tournament_full | not_open`. Fake-$transaction harness (tx === same fake) proves each reject path calls NO `pair.create` and the happy path creates exactly once. 6 assertions, RED→GREEN.
- **Task 3 ([BLOCKING]):** `model Pair` (id cuid, tournamentId+cascade, player1Id/player1 + player2Id/player2 named relations, `seed Int?` for Phase 4, createdAt, two `@@unique` per-slot constraints, `@@map("pair")`) + back-relations `Tournament.pairs`, `User.pairsAsP1/pairsAsP2`. Migration `20260606141738_add_pair` applied to dev.db; client regenerated. NO Match relations (Phase 4 owns Match).

## Verification

- `npx tsx src/lib/validation/registration.test.ts` → 8 assertions passed (exit 0)
- `npx tsx src/lib/services/registration.test.ts` → 6 assertions passed (exit 0): self-partner, not-open, over-capacity, either-slot duplicate each reject with no create; happy path creates once; all branches inside $transaction
- `npx prisma validate` → valid; `npx prisma migrate status` → "Database schema is up to date!" (3 migrations, no drift)
- `npx tsc --noEmit` → clean
- `npm run build` → success (11 routes)
- `git diff prisma/schema.prisma` → 30 insertions, 0 deletions; kysely override + auth tables untouched

## Deviations from Plan

None — plan executed exactly as written. (Task 2's `tsc --noEmit` could only pass after Task 3's `prisma generate` produced the `Pair` client type; the service test, which uses `prisma as any`, passed at Task 2 GREEN as planned, and tsc was confirmed clean after Task 3. This is the intended BLOCKING ordering, not a deviation.)

## Threat Mitigations Applied

- **T-03-01 (Tampering, player1 identity):** schema accepts only `player2Id`; player1 comes from session in Plan 02.
- **T-03-02 (over-capacity / double-register race):** status re-read + count + dup check + insert all inside one `$transaction`; per-slot `@@unique` as DB defense-in-depth.
- **T-03-03 (self-partner / cross-slot dup):** explicit `player1Id !== player2Id` guard + cross-slot `findFirst`.

No new threat surface introduced beyond the plan's register.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: src/lib/validation/registration.ts, src/lib/validation/registration.test.ts
- FOUND: src/lib/services/registration.ts, src/lib/services/registration.test.ts
- FOUND: prisma/migrations/20260606141738_add_pair/migration.sql
- FOUND commits: ea8ec11, 5467fa3, 64bfec1, a584635, 9b8e31a
