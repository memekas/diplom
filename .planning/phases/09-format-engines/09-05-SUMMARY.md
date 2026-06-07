---
phase: 09-format-engines
plan: 05
subsystem: format-engines
tags: [FMT-03, SCORE-01, record-result, scoring-mode, player-match-score, fan-out, auto-finish, mexicano-gate, prisma-write]
requires:
  - "src/lib/services/result.ts (setWinner / matchWinnerFromSets — pure scoring core, sets-mode reuse)"
  - "src/lib/services/mexicano.ts (materializeNextMexicanoRound — gated next-round materialization)"
  - "src/lib/services/tournament-status.ts (transitionTournament in_progress→finished)"
  - "prisma/schema.prisma (RoundMatch pointsA/pointsB, PlayerMatchScore @@unique([roundMatchId,userId]), Round @@unique([tournamentId,roundNumber]))"
provides:
  - "scorePointsMode / scoreSetsMode — pure Prisma-free SCORE-01 mode branching"
  - "recordRoundResult(prisma, roundMatchId, input) — transactional round-based result recording"
  - "RoundResultError (typed RU-coded errors) exported from round-result.ts"
  - "parseRoundResultForm(formData, { scoringMode, setsPerMatch }) — points + sets form parser"
affects:
  - "09-06 dispatch (recordResultAction routes round-based matches → recordRoundResult; requireAdmin boundary)"
  - "Phase 11 SCORE-02 (score-entry form posts points_a/points_b or set{n}_a/set{n}_b)"
tech-stack:
  added: []
  patterns:
    - "separate service over reuse: recordRoundResult does NOT call playoff recordResult (avoids its nextMatchId==null auto-finish misfire — FORMATS.md §5); shares ONLY the pure scoring core"
    - "pure-fn-first: scorePointsMode/scoreSetsMode unit-tested without DB before the transaction leans on them"
    - "sets-mode collapse: per-set games validated by setWinner, stored as two sets-won integers in pointsA/pointsB (no per-set rows for round-based — A1)"
    - "PlayerMatchScore fan-out: deleteMany→create, one row per non-null team FK; both partners share team pointsFor (idempotent re-record, Pitfall 6)"
    - "format-branched finish: round_robin/americano auto-finish on full schedule; mexicano gates next-round materialization then finishes on totalRounds"
    - "DB-authoritative config: format/scoringMode/targetPoints re-read inside tx — client score/winner never trusted (T-09-16/17)"
key-files:
  created:
    - "src/lib/services/round-result.ts"
    - "src/lib/services/round-result.test.ts"
    - "src/lib/validation/round-result.ts"
    - "src/lib/validation/round-result.test.ts"
  modified: []
decisions:
  - "recordRoundResult SEPARATE from playoff recordResult — playoff format → RoundResultError(not_round_based); no nextMatchId advancement/auto-finish in round-based (FMT-03 «playoff без регрессии»)"
  - "points-mode: round_robin rejects draw (D2 draw_not_allowed); americano/mexicano allow draw (winner=null); targetPoints check ADVISORY (A5) — only enforced when caller passes targetPoints"
  - "sets-mode reuses setWinner/matchWinnerFromSets generalized on gamesPerSet/setsPerMatch; ResultError(invalid_set) re-thrown as RoundResultError(invalid_set); null winner → no_winner"
  - "PlayerMatchScore fan-out: both partners of a team get SAME team pointsFor, pointsAgainst=opponent score; teamSlot A/B"
  - "round_robin/americano auto-finish when ALL RoundMatch of ALL rounds recorded; already-finished treated as no-op (mirrors result.ts step-9 guard)"
  - "mexicano: skip materializeNextMexicanoRound on the LAST round (roundNumber>=totalRounds) — the helper has no totalRounds knowledge and would otherwise materialize a spurious round totalRounds+1; finish instead"
metrics:
  duration_min: 4
  completed: 2026-06-07
  tasks: 2
  files: 4
---

# Phase 9 Plan 5: recordRoundResult (FMT-03 / SCORE-01) Summary

Transactional round-based result recording — `recordRoundResult` writes a RoundMatch score branched by scoringMode (points = two ints; sets = sets-won via the reused tennis core), fans out PlayerMatchScore to every participant (both partners share the team score), and gates finish/materialization per format — kept deliberately separate from playoff `recordResult` so its nextMatchId auto-finish cannot misfire.

## What Was Built

- **`scorePointsMode` / `scoreSetsMode`** (pure, Prisma-free): SCORE-01 mode branching. Points enforces non-negative ints, D2 draw rejection for round_robin, draw-allowed for americano/mexicano, advisory targetPoints sum check. Sets reuses `setWinner`/`matchWinnerFromSets` and collapses to two sets-won integers.
- **`recordRoundResult`** (one `$transaction`): loads DB-authoritative format/scoring config, rejects `format=playoff` with `not_round_based`, derives score server-side, writes `pointsA/pointsB`, fans out PlayerMatchScore (`deleteMany`→`create`), then branches finish:
  - round_robin/americano → auto-finish when every RoundMatch of every round is recorded.
  - mexicano → materialize next round via `materializeNextMexicanoRound` while not on the last round; on the last round, finish when fully recorded.
- **`parseRoundResultForm`**: points branch reads `points_a`/`points_b`; sets branch mirrors `parseRecordResultForm` (`set{n}_a`/`set{n}_b`, empty rows skipped).
- **`RoundResultError`**: typed RU-coded errors (`invalid_points`, `draw_not_allowed`, `bad_sum`, `invalid_set`, `no_winner`, `not_round_based`, `already_finished`, `match_not_found`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Spurious round materialization on the final mexicano round**
- **Found during:** Task 2 (test "mexicano last round complete → finished")
- **Issue:** Calling `materializeNextMexicanoRound` unconditionally before the finish check caused it to materialize round `totalRounds+1` on the last round — its internal gate (round fully recorded + materialize-once) passes, and the helper has no `totalRounds` knowledge (by its own design contract, recordRoundResult owns that).
- **Fix:** Guard with `isLastRound = totalRounds != null && roundNumber >= totalRounds`; only call materialize when not the last round, otherwise run the finish branch.
- **Files modified:** src/lib/services/round-result.ts
- **Commit:** 2d97c9f

## Threat Mitigations Applied

- **T-09-16/17 (Tampering):** winner/sets-won derived server-side from validated input; format/scoringMode/targetPoints re-read inside the tx; playoff → `not_round_based`.
- **T-09-18 (Input validation):** zod in `parseRoundResultForm` + server re-validation in `scorePointsMode`/`scoreSetsMode` (DB-authoritative).
- **T-09-19 (Info disclosure):** typed `RoundResultError` with RU codes; no raw Prisma text surfaced.
- **T-09-20 (Double-record/race):** `deleteMany` before `create` for PlayerMatchScore; materialize-once handled by `materializeNextMexicanoRound`.

## Verification

- `npx tsx src/lib/validation/round-result.test.ts` → 24 assertions green.
- `npx tsx src/lib/services/round-result.test.ts` → 11 assertions green (points RR no-draw, amer/mex draw, sets sets-won, fan-out both partners equal, auto-finish, partial not-finished, mexicano next-round trigger, last-round finish, playoff rejected, match-not-found).
- `npx tsc --noEmit` → exit 0.
- Full baseline: 13 test files, 344 ok-assertions, 0 failures.
- Playoff `result.ts` / `bracket.ts` unchanged (setWinner/matchWinnerFromSets only imported).

## Self-Check: PASSED

- FOUND: src/lib/services/round-result.ts
- FOUND: src/lib/services/round-result.test.ts
- FOUND: src/lib/validation/round-result.ts
- FOUND: src/lib/validation/round-result.test.ts
- FOUND commit: 5405ec7 (Task 1)
- FOUND commit: 2d97c9f (Task 2)
