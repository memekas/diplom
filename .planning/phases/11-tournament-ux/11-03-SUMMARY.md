---
phase: 11-tournament-ux
plan: 03
subsystem: ui
tags: [react, server-component, prisma, round-robin, americano, mexicano, standings, vis-01]

# Dependency graph
requires:
  - phase: 09-round-formats
    provides: computeStandings (units/players), Round/RoundMatch schema, round generators
  - phase: 07-singles-rounds
    provides: TournamentPlayer model, registration.playerSelect safe-select convention
provides:
  - listRounds + listTournamentPlayers thin read-only helpers (safe selects, exported row types)
  - RoundRobinView presentational component (matches table + unit standings)
  - RotationView presentational component (current/past games + player rating)
affects: [11-04, tournament-detail-page, score-entry]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Prisma payload-inferred exported row types (RoundRead/RoundReadMatch/TournamentPlayerRead) keep view props in lock-step with the query select"
    - "readOnly + optional renderEntry slot: presentational view injects per-match entry form supplied by caller, renders none itself"

key-files:
  created:
    - src/lib/services/rounds.ts
    - src/lib/services/rounds.test.ts
    - src/components/round-robin-view.tsx
    - src/components/rotation-view.tsx
  modified: []

key-decisions:
  - "Team display names come from the listRounds { id, name } slots, not nameById — nameById is only for standings rows (unit/user ids)"
  - "current vs past games derived purely from pointsA/pointsB null-ness; mexicano's single materialized round naturally lands as the lone current group (no engine call)"
  - "Row types derived via Prisma.RoundGetPayload<typeof select> so props cannot drift from the query"

patterns-established:
  - "Pattern: safe-select read helper test asserts the query's nested select is exactly { id, name } and crawls the result for leaked email/birthDate keys"
  - "Pattern: per-format presentational view mirrors BracketView (no use client, no prisma, plain dark-safe Tailwind, prop-fed)"

requirements-completed: [VIS-01]

# Metrics
duration: 12min
completed: 2026-06-07
---

# Phase 11 Plan 03: Round-based read helpers + RoundRobinView/RotationView Summary

**Added the two missing read-only helpers (`listRounds`, `listTournamentPlayers`) and the two per-format presentational view components VIS-01 needs — pure reads + display, no engine logic, with a readOnly-gated per-match entry slot for Plan 04 to wire.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 3 completed
- **Files modified:** 4 created, 0 modified

## Accomplishments
- `listRounds` / `listTournamentPlayers`: thin, READ-ONLY Prisma helpers with explicit safe selects (team slots → `{ id, name }`; players → `{ id, name, skillLevel, courtSide }`), ordered round/court asc and oldest-first; exported Prisma-inferred row types shared with the views and Plan 04.
- `RoundRobinView`: presentational RSC rendering per-round matches (Раунд/Корт/score) + a unit standings table from `UnitStanding[]`.
- `RotationView`: presentational RSC splitting americano/mexicano matches into «Текущие игры» (unrecorded) vs «Прошедшие игры» (recorded) + a player rating table from `PlayerStanding[]`.
- Both views accept `readOnly` and an optional `renderEntry` slot called only for unrecorded matches when `!readOnly` — they render no score form themselves.

## Task Commits

1. **Task 1 (RED): failing read-helper test** - `cdac289` (test)
2. **Task 1 (GREEN): listRounds + listTournamentPlayers** - `70cd0e7` (feat)
3. **Task 2: RoundRobinView** - `52cfb7d` (feat)
4. **Task 3: RotationView** - `26aeeec` (feat)

## Files Created/Modified
- `src/lib/services/rounds.ts` - `listRounds` (rounds + matches with team `{id,name}` slots + points) and `listTournamentPlayers` (singles registrants) read helpers; exports `RoundRead`, `RoundReadMatch`, `TournamentPlayerRead`.
- `src/lib/services/rounds.test.ts` - fake-prisma test asserting round/court ordering is enforced by the query, the nested team-slot select is exactly `{ id, name }`, and results carry no `email`/`birthDate`.
- `src/components/round-robin-view.tsx` - `RoundRobinView` presentational component.
- `src/components/rotation-view.tsx` - `RotationView` presentational component.

## Verification
- `npx tsx src/lib/services/rounds.test.ts` → 3 assertions passed, exit 0.
- `npx tsc --noEmit` → 0 errors.
- `npx next build` → success (11/11 pages, all routes compile).
- `src/components/bracket-view.tsx` confirmed untouched (`git diff --quiet HEAD` → clean).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tsc error in test fake's round sort**
- **Found during:** Task 1 GREEN typecheck
- **Issue:** Indexing `rounds[i][key]` produced TS7053 (implicit any) because the mapped object lacked a string index signature.
- **Fix:** Annotated the mapped round object `as Record<string, unknown>` so the dynamic-key sort typechecks.
- **Files modified:** src/lib/services/rounds.test.ts
- **Commit:** 70cd0e7 (folded into the GREEN commit)

## Threat Model Compliance
- **T-11-08 (Info Disclosure):** Both helpers use explicit safe selects; the test crawls results and asserts no `email`/`birthDate` keys. Mitigated.
- **T-11-09 (Tampering):** Views are display-only — winners read from stored `pointsA/pointsB`, standings consumed from `computeStandings`, no recomputation, no engine/materialize calls. Mitigated.
- **T-11-10:** No new deps installed. N/A.

## Self-Check: PASSED
- src/lib/services/rounds.ts — FOUND
- src/lib/services/rounds.test.ts — FOUND
- src/components/round-robin-view.tsx — FOUND
- src/components/rotation-view.tsx — FOUND
- Commits cdac289, 70cd0e7, 52cfb7d, 26aeeec — FOUND in git log
