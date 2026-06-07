# Free-form match scoring — SUMMARY

status: complete
date: 2026-06-08

Corrected the over-constrained v2.0 scoring: match scoring is now fully free-form across all
formats. Any number of sets, any non-negative integer games per set, points = any two integers
with no target. Winner determined by games/sets; playoff still requires a decisive winner.

## What changed per layer

### Services (fix)
- result.ts: setWinner(gamesA, gamesB) — more games wins, equal -> null (tied set); dropped
  gamesPerSet param and the win-by-2 / 7:5 / 7:6 isValidSet rule (deleted). Only non-integer/negative
  still throws invalid_set. matchWinnerFromSets(sets) takes per-set scores -> more sets won, tie
  broken by total games, still equal -> null (draw). Added tallySetsWon. recordResult reads no
  set/game config, accepts any number of sets (no cap); on a draw throws
  ResultError("draw", "Ничья недопустима в playoff — введите решающий счёт") with NO advance/finish.
  SetScore delete+recreate persistence intact. Added "draw" code.
- round-result.ts: scorePointsMode(pointsA, pointsB) — two arbitrary ints, NO target, draws allowed
  for ALL formats. Removed targetPoints/bad_sum and the round_robin draw_not_allowed ban.
  scoreSetsMode(sets) — free-form, no setsPerMatch cap, draw allowed. recordRoundResult stops reading
  gamesPerSet/setsPerMatch/targetPoints. Removed codes draw_not_allowed, bad_sum, no_winner.

### Validation (fix)
- validation/result.ts + validation/round-result.ts: scan set{n}_a/set{n}_b dynamically (until a row
  key is absent), no upper cap. parseRoundResultForm opts no longer takes setsPerMatch.
- validation/tournament.ts: removed setsPerMatch/gamesPerSet/targetPoints fields, targetPoints>0
  refine, FieldKey entries, and form reads. scoringMode kept.
- services/tournament.ts: createTournament no longer writes those columns (DB defaults kept).
- services/format-engine.ts + admin/tournaments/actions.ts: updated to new parser signatures and
  trimmed error FieldKey union.

### Forms (feat)
- create-tournament-form.tsx: removed setsPerMatch/gamesPerSet/targetPoints inputs; scoringMode kept.
- score-form.tsx (playoff) + round-score-form.tsx: dynamic set rows — one starting row (playoff
  pre-fills existing), "+ Добавить сет" button, per-row remove, any integer inputs. Points branch
  unchanged. Submit via existing recordResultAction.

### Tests (test)
- Rewrote result.test.ts, round-result.test.ts, validation/round-result.test.ts,
  validation/tournament.test.ts for free-form: any score accepted, winner by games/sets, playoff
  draw -> error, round-based draw allowed, no target/cap, dynamic set scan.

## Verification
- npx tsc --noEmit -> 0 errors.
- npx next build -> success (11/11 pages).
- ALL *.test.ts green (every services/ + validation/ file run individually).
- DB smoke (throwaway data, cleaned up — 0 leftover):
  - playoff single set 4:5 -> winner = more-games side (B), parent slot filled (advances).
  - playoff 6:4,4:6 (1:1 sets, 10:10 games) -> ResultError("draw"), no advance.
  - round-based points 13:9 (no target) -> winner A, pointsA=13.
  - round-based sets [4:5, 6:3, 10:2] -> 2:1, winner A.

## Playoff invariant confirmation
PLAYOFF still advances a winner on decisive scores (UPDATE into pre-existing parent slot; autofinish
on the final) — confirmed by unit test and live DB smoke. Draws are the only non-advancing case and
are surfaced as a typed RU error.

## Schema / deps
- No migration. Tournament.setsPerMatch/gamesPerSet/targetPoints columns remain with defaults; no
  longer read/required. No new dependencies.
