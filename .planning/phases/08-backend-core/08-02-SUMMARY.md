---
phase: 08-backend-core
plan: 02
subsystem: backend-registration
tags: [registration, level-matching, singles, transactional, service]
requires:
  - "registerPair / RegistrationError / findUserIdByNickname (registration.ts, Phase 4-6)"
  - "Tournament.{level,participantMode,size,status} columns (Phase 7)"
  - "User.skillLevel; TournamentPlayer model with @@unique([tournamentId, userId]) (Phase 7)"
provides:
  - "RegistrationError +level_mismatch +wrong_mode codes"
  - "registerPair strict level-equality (both players) + pairs mode-guard inside $transaction"
  - "registerSingle service on TournamentPlayer (status/mode/level/capacity/dup/insert)"
  - "parseRegisterSingleForm + ParseRegisterSingleFormResult"
affects:
  - "Phase 8 Plan 05 actions (wire registerSingle + registerPair mode/level errors to RU messages)"
  - "Phase 9 engines (read TournamentPlayer roster for singles formats)"
tech-stack:
  added: []
  patterns:
    - "transactional integrity gate reused for singles (count+insert in one $transaction)"
    - "strict equality level-match; for pairs, both players checked via tx.user.findMany().some"
    - "capacity for singles by TournamentPlayer count vs size (not Pair count)"
key-files:
  created: []
  modified:
    - src/lib/services/registration.ts
    - src/lib/validation/registration.ts
    - src/lib/services/registration.test.ts
decisions:
  - "registerSingle mirrors registerPair gate order; capacity by tournamentPlayer.count (Pitfall 7)"
  - "registerSingleSchema is an empty zod object — singles needs no client-supplied fields; identity from session guard"
  - "registration.ts holds both Task 1 (level/mode in registerPair) and Task 2 (registerSingle) service work — committed as one service commit, validation + test separate"
metrics:
  duration: ~6m
  completed: 2026-06-07
  tasks: 3
  files: 3
---

# Phase 8 Plan 02: Level-Matching + Single Registration (REG-05/REG-06) Summary

Added strict level-matching (both players for pairs) and a `wrong_mode` participant-mode guard to `registerPair`, implemented `registerSingle` as a transactional mirror on `TournamentPlayer`, added the `parseRegisterSingleForm` helper, and extended the registration test suite from 8 to 18 assertions.

## What Was Built

- **Task 1 — registerPair level/mode (registration.ts):** `RegistrationError` union widened with `"level_mismatch"` and `"wrong_mode"`. `registerPair`'s tournament `select` now reads `level` + `participantMode`. Right after the status guard, a mode-guard rejects with `wrong_mode` ("регистрация только одиночная") when `participantMode !== "pairs"`. After the self/capacity/cross-slot-dup gates and before insert, both players' skillLevels are read via `tx.user.findMany` and `.some((p) => p.skillLevel !== tournament.level)` throws `level_mismatch` — strict equality, both players, all inside the existing `$transaction`.
- **Task 2 — registerSingle + parse (registration.ts, validation/registration.ts):** `registerSingle(prisma, { tournamentId, userId })` runs one `$transaction`: re-read status (`not_open`), mode-guard `participantMode !== "singles"` (`wrong_mode` "только парой"), level equality via `tx.user.findUniqueOrThrow` (`level_mismatch`), capacity by `tx.tournamentPlayer.count >= size` (`tournament_full`, Pitfall 7), duplicate via composite `tournamentId_userId` (`already_registered`), then `tx.tournamentPlayer.create`. `parseRegisterSingleForm` + `registerSingleSchema` (empty object) + `ParseRegisterSingleFormResult` mirror the pair-parse discriminated shape; singles needs no partner fields.
- **Task 3 — tests (registration.test.ts):** `fakePrisma` extended with `level`/`participantMode` defaults, `tx.user.findMany`, and per-player `playerLevels`. New `fakeSinglePrisma` covers the TournamentPlayer path. 10 new cases: registerPair both-match passes / player1-mismatch / player2-only-mismatch → level_mismatch / singles → wrong_mode; registerSingle happy / not_open / pairs→wrong_mode / level_mismatch / full-by-TournamentPlayer-count / duplicate.

## Verification

- `npx tsc --noEmit` → 0 errors.
- `npx tsx src/lib/services/registration.test.ts` → 18 assertions passed (8 original pair assertions still green).
- Regression: `npx tsx src/lib/services/bracket.test.ts` → 40 assertions passed (playoff path intact). The 8 pre-existing pair assertions were updated only in their fake-prisma wiring (new level/participantMode fields default to intermediate/pairs/matching) and remain green.

## Deviations from Plan

`registration.ts` carries both Task 1 (level/mode in registerPair) and Task 2 (registerSingle) service code; since they share one file they were committed together as a single service commit (`22acbd1`), with the validation helper (`1ad7ae6`) and tests (`16eb3c9`) as separate commits. Commit-grouping choice, not a behavioral deviation. No auto-fixes (Rules 1-3) needed; no architectural decisions (Rule 4).

## Threat Coverage

- T-08-04 (registration on wrong level) — strict `skillLevel === tournament.level` inside the transaction, both players for pairs; `level_mismatch`.
- T-08-05 (participantMode tampering) — DB `participantMode` re-read in-transaction; pair path requires `"pairs"`, single path requires `"singles"`; `wrong_mode`.
- T-08-06 (singles over-capacity race) — `tournamentPlayer.count` + insert in one `$transaction`.
- T-08-07 (raw error disclosure) — only typed `RegistrationError` RU messages thrown.

## Self-Check: PASSED

- FOUND: src/lib/services/registration.ts
- FOUND: src/lib/validation/registration.ts
- FOUND: src/lib/services/registration.test.ts
- FOUND commit: 22acbd1 (service)
- FOUND commit: 1ad7ae6 (validation)
- FOUND commit: 16eb3c9 (tests)
