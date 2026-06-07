# Free-form match scoring

status: complete
date: 2026-06-08
branch: main (sequential, branching=none)

## Objective

Make match scoring FULLY free-form across all formats. Remove tennis set-validity, fixed
set/game sizes, and target points. The admin can add any number of sets and enter ANY score;
points = any two non-negative integers, no target. Playoff still advances a winner on decisive
scores; playoff draw is rejected.

## Layers (atomic commits)

1. **services** — `result.ts`, `round-result.ts`
2. **validation** — `validation/result.ts`, `validation/round-result.ts`, `validation/tournament.ts`,
   `services/tournament.ts`, `services/format-engine.ts`, `admin/tournaments/actions.ts`
3. **forms** — `create-tournament-form.tsx`, `score-form.tsx`, `round-score-form.tsx`
4. **tests** — `result.test.ts`, `round-result.test.ts`, `validation/round-result.test.ts`,
   `validation/tournament.test.ts`

## Constraints

- No schema migration (Tournament.setsPerMatch/gamesPerSet/targetPoints columns kept, defaults stay).
- No new deps. Thesis simplicity. Existing patterns.
- PLAYOFF must still advance on decisive scores (key invariant).
