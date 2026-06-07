---
phase: 08-backend-core
plan: 01
subsystem: backend-validation
tags: [tournament, validation, zod, server-action, multiformat]
requires:
  - "Phase 7 schema: Tournament.{format,participantMode,level,price,scoringMode,targetPoints,totalRounds} columns"
  - "skillLevels (src/lib/validation/auth.ts)"
provides:
  - "createTournamentSchema with format-dependent size/mode superRefine"
  - "parseTournamentForm reading all multiformat fields"
  - "createTournament persisting all new tournament config fields"
  - "tournamentFormats/participantModes/scoringModes/PLAYOFF_SIZES/SIZE_CAP exports"
affects:
  - "Phase 9 engines (read format/scoringMode/participantMode/targetPoints/totalRounds)"
  - "Phase 11 create-tournament form (same parseTournamentForm)"
tech-stack:
  added: []
  patterns:
    - "zod superRefine for cross-field (format ↔ participantMode/scoringMode/size) rules"
    - "String + zod-union (no Prisma enums)"
    - "server-set status; points-mode server default targetPoints=24"
key-files:
  created: []
  modified:
    - src/lib/validation/tournament.ts
    - src/lib/validation/tournament.test.ts
    - src/lib/services/tournament.ts
    - src/app/(app)/admin/tournaments/actions.ts
decisions:
  - "superRefine over discriminatedUnion (cross-format rules, shared fields)"
  - "setsPerMatch/gamesPerSet written only when supplied; else Prisma schema defaults (3/6)"
  - "points-mode without explicit targetPoints → server default 24"
metrics:
  duration: ~8m
  completed: 2026-06-07
  tasks: 3
  files: 4
---

# Phase 8 Plan 01: Multiformat Tournament Creation (TOUR-05) Summary

Extended `createTournamentSchema` to all four formats (playoff / round_robin / americano / mexicano) with format-dependent size and participant-mode validation via zod `superRefine`, wired the new fields through `parseTournamentForm` and `createTournament`, and expanded the validation test suite to 56 assertions.

## What Was Built

- **Schema (Task 1):** New exports `tournamentFormats`, `participantModes`, `scoringModes`, `PLAYOFF_SIZES`, `SIZE_CAP`. Added fields `format`, `participantMode`, `level` (reuses `skillLevels`), `size`, `price`, `scoringMode`, `targetPoints`, `totalRounds`, `setsPerMatch`, `gamesPerSet`. `superRefine` enforces: playoff ∈ {4,8,16}; round_robin 3..24; americano ≥4 forced singles+points; mexicano ≥8 forced singles+points; points-mode targetPoints>0. Legacy `tournamentSizes`/`tournamentStatuses`/`TournamentStatus`/`tournamentStatusSchema` exports preserved (consumed by tournament-status.ts).
- **Parse (Task 2):** `parseTournamentForm` reads all new FormData keys; empty optional numerics (`price`, `targetPoints`, `totalRounds`, `setsPerMatch`, `gamesPerSet`) coerced `"" → undefined`. `ParseTournamentFormResult` errors union widened via new `TournamentFieldKey` type.
- **Service + Action + Tests (Task 3):** `createTournament` writes all new fields; `status` stays hard-set `"registration"`; points-mode defaults `targetPoints=24`; `setsPerMatch`/`gamesPerSet` written only when supplied (else schema defaults). `tournamentSelect` returns new columns. `createTournamentAction` error type extended with all new field keys. Test rewritten to a `base` valid object + format×size matrix, mode-forcing, scoringMode, points-target, and parse cases.

## Verification

- `npx tsc --noEmit` → clean (0 errors).
- `npx tsx src/lib/validation/tournament.test.ts` → 56 assertions passed.

## Deviations from Plan

None — plan executed as written. Tasks 1 and 2 both modify only `src/lib/validation/tournament.ts`, so they were committed together as one schema/parse commit; Task 3 (service + action + test) committed separately. This is a commit-grouping choice, not a behavioral deviation.

## Threat Coverage

- T-08-02 (Tampering: size/format/mode from form) — server-side `superRefine` rejects invalid combinations before write.
- T-08-03 (Tampering: status from form) — `createTournament` hard-sets `status:"registration"`, never from input.

## Self-Check: PASSED

- FOUND: src/lib/validation/tournament.ts
- FOUND: src/lib/validation/tournament.test.ts
- FOUND: src/lib/services/tournament.ts
- FOUND: src/app/(app)/admin/tournaments/actions.ts
- FOUND commit: 4c603c1 (schema + parse)
- FOUND commit: a55aa39 (service + action + tests)
