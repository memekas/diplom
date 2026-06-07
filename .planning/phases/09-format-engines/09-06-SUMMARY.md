---
phase: 09-format-engines
plan: 06
subsystem: format-dispatch
tags: [format-engine, server-actions, dispatch, regression]
requires:
  - generateBracket (bracket.ts, Phase 4)
  - generateRoundRobin (round-robin.ts, 09-01)
  - generateAmericano (americano.ts, 09-02)
  - generateMexicanoRound1 (mexicano.ts, 09-04)
  - recordResult (result.ts, Phase 5)
  - recordRoundResult (round-result.ts, 09-05)
  - parseRecordResultForm (validation/result.ts)
  - parseRoundResultForm (validation/round-result.ts, 09-05)
provides:
  - startFormat (format-engine.ts) — dispatch Старт by DB format
  - recordFormatResult (format-engine.ts) — dispatch result entry by DB format
  - startTournamentAction/recordResultAction wired through format-engine (all 4 formats)
affects:
  - src/app/(public)/tournaments/[id]/actions.ts
tech-stack:
  added: []
  patterns:
    - "single DB-authoritative dispatch point (format re-read inside service, client never trusted)"
    - "discriminated return contract { ok:true; result } | { ok:false; error } for uniform action mapping"
    - "decoupled FormatError classes caught by name match (round-robin/americano/mexicano)"
key-files:
  created:
    - src/lib/services/format-engine.ts
    - src/lib/services/format-engine.test.ts
  modified:
    - src/app/(public)/tournaments/[id]/actions.ts
decisions:
  - "FormatError matched by e.name === 'FormatError' (3 decoupled classes are structurally identical) rather than importing all three"
  - "setsPerMatch action param kept for UI positional bind but DB-authoritative value used inside engine (param prefixed _setsPerMatch)"
  - "playoff branch threads same parser (parseRecordResultForm) + recorder (recordResult) → byte-for-byte unchanged behaviour"
metrics:
  duration: ~25m
  completed: 2026-06-07
  tasks: 3
  files: 3
---

# Phase 9 Plan 06: Format-Engine Dispatch + Action Branching Summary

Format-engine dispatch (`startFormat` / `recordFormatResult`) routes both Старт and result entry by the DB-authoritative `tournament.format`, wiring all four formats (playoff / round_robin / americano / mexicano) into the existing `startTournamentAction` / `recordResultAction` without changing playoff behaviour — flips FMT-01/02/03 + SCORE-01 to complete.

## What Was Built

- **`format-engine.ts`** — two dispatch functions:
  - `startFormat(prisma, tournamentId)`: reads `{ format }`, switches → `generateBracket` (playoff) / `generateRoundRobin` / `generateAmericano` / `generateMexicanoRound1`; unknown format throws a defensive plain Error.
  - `recordFormatResult(prisma, tournamentId, matchId, formData)`: reads `{ format, scoringMode, setsPerMatch }`; playoff → `parseRecordResultForm` + `recordResult`; round-based → `parseRoundResultForm` + `recordRoundResult`. Returns `{ ok:true; result } | { ok:false; error }`; parser failures become `{ ok:false }`, service rejects are thrown for the action's catch.
- **`actions.ts`** — `startTournamentAction` now calls `startFormat`, catching `BracketError` + `FormatError` (by name). `recordResultAction` now calls `recordFormatResult`, returning its `{ok:false}` and catching `ResultError` + `RoundResultError`. `requireAdmin()` preserved as first line in both; signatures unchanged.
- **`format-engine.test.ts`** — 10 routing assertions (fake-prisma harness): each of the 4 formats reaches the correct generator (round-based → Round.create, playoff → Match.create); record-result routes playoff → SetScore path vs round-based → RoundMatch.update path; bad form → `{ok:false}` with no recorder call; unknown format throws.

## Deviations from Plan

None — plan executed exactly as written. The only judgment call (FormatError matched by `name` rather than importing three identical classes) is consistent with the plan's note that the three FormatError classes are deliberately decoupled and "Plan 06 dispatch handles both error types".

## Verification

- `npx tsx src/lib/services/format-engine.test.ts` → 10/10 green.
- `npx tsc --noEmit` → exit 0.
- `npx eslint` on changed files → 0 errors (8 pre-existing `_prev`/`_formData` unused-param warnings, identical pattern across all actions in the file — not introduced here).
- **Full regression**: 15 test scripts, 0 failures, **354 total assertions**. The 14 pre-existing scripts remain **344 assertions** unchanged (playoff invariant: bracket 40 / result 43 untouched); new format-engine adds 10.

## Threat Surface

All STRIDE mitigations in the plan's threat register satisfied: `requireAdmin()` first line (T-09-22), format re-read from DB (T-09-23), recorder chosen by DB-format with round-result's `not_round_based` guard (T-09-24), typed-error-only mapping with generic RU fallback (T-09-25). No new surface introduced.

## Self-Check: PASSED

- FOUND: src/lib/services/format-engine.ts
- FOUND: src/lib/services/format-engine.test.ts
- FOUND (modified): src/app/(public)/tournaments/[id]/actions.ts
- FOUND commit: 7fcd959 (Task 1)
- FOUND commit: 614c97e (Task 2)
