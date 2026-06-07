---
phase: 09-format-engines
reviewed: 2026-06-07T18:28:26Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/lib/services/round-robin.ts
  - src/lib/services/americano.ts
  - src/lib/services/mexicano.ts
  - src/lib/services/standings.ts
  - src/lib/services/round-result.ts
  - src/lib/services/format-engine.ts
  - src/lib/validation/round-result.ts
  - src/app/(public)/tournaments/[id]/actions.ts
  - src/lib/services/tournament.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: resolved
resolved: 2026-06-07
resolution: CR-01, WR-01, WR-02, WR-03 fixed with regression tests (361 assertions, tsc clean). IN-01 fixed (comment). IN-02 documented + enforced via WR-01 (mexicano requires totalRounds; americano derives N-1).
---

# Phase 9: Code Review Report

**Reviewed:** 2026-06-07T18:28:26Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** resolved

## Summary

Reviewed the Phase 09 format engines (round-robin / americano / mexicano schedule
generators, standings, round-based result recording, and the start/record dispatch).
The hard algorithmic cores are correct: the round-robin circle method fixes `arr[0]`
and rotates the tail correctly (each-meets-each verified), the americano partner-once
rotation was independently verified to produce **0 duplicate partnerships** for
N = 4/6/8/10/12/16, the mexicano `1+4 vs 2+3` cross-pair and `rankPlayers`
userId-asc determinism are sound, and the `PlayerMatchScore` fan-out correctly gives
both partners the same `pointsFor` with `pointsAgainst = opponent score` (no swap/sign
bug). Security boundaries are preserved (dispatch is admin-only via `requireAdmin`,
winner/sets-won/points are all server-derived, raw Prisma text is never forwarded).

However there is **one blocker**: the `targetPoints` sum check fires for `round_robin`
points matches, where no target sum exists — every non-target score is rejected, and
the existing test masks it by using `targetPoints: null` instead of the production
default of 24. Plus a mexicano no-terminal-condition gap when `totalRounds` is null, and
a stale-pairing gap on round re-record.

## Critical Issues

### CR-01: `bad_sum` rejects all valid round_robin points scores (target check leaks into RR)

**File:** `src/lib/services/round-result.ts:76` (and `:187-192`), `src/lib/services/tournament.ts:42`

**Issue:** `scorePointsMode` enforces `pointsA + pointsB === targetPoints` whenever
`targetPoints != null`. The "points-to-target" rule is a property of **americano/mexicano
only** (FORMATS.md §2/§3); round_robin points are "two arbitrary integers, winner = more
points" with **no target sum** (FORMATS.md §1). But:

1. `round_robin` is allowed to use `scoringMode = "points"` (only americano/mexicano are
   forced away from `sets`; see `tournament.ts` validation `superRefine`).
2. `createTournament` defaults `targetPoints` to **24** for *any* points-mode tournament
   (`tournament.ts:42`), including round_robin.
3. `recordRoundResult` *always* passes `tournament.targetPoints` into `scorePointsMode`
   (`round-result.ts:187-192`).

Net effect: a round_robin points tournament created without an explicit `targetPoints`
gets `targetPoints = 24`, so recording any normal score whose sum ≠ 24 (e.g. `11:7`,
sum 18) throws `RoundResultError("bad_sum")` and the result cannot be saved. The format
is effectively broken for the common case.

The existing test `points round_robin 15:9 records score` passes only because the fake
tournament sets `targetPoints: null` (round-result.test.ts:48) — it does not reproduce
the `createTournament` default of 24, so the regression is untested.

**Fix:** Gate the target-sum check to the target-based formats (and/or stop defaulting
`targetPoints` for round_robin). Minimal fix in `scorePointsMode`:

```ts
// target-sum only applies to points-to-target formats (americano/mexicano), FORMATS §2/§3
const targetApplies = format === "americano" || format === "mexicano";
if (targetApplies && targetPoints != null && pointsA + pointsB !== targetPoints) {
  throw new RoundResultError("bad_sum", `Сумма очков должна быть ${targetPoints}`);
}
```

And add a test that constructs a round_robin/points tournament with `targetPoints: 24`
(the real default) and records `11:7` → expect success.

**RESOLVED (215318e):** `scorePointsMode` now gates the sum check behind
`targetApplies = format === "americano" || format === "mexicano"`, and `createTournament`
defaults `targetPoints = 24` only for americano/mexicano (round_robin → null). Added two
regression tests: RR `11:7` with `targetPoints: 24` records (no `bad_sum`); americano
`11:7` with `targetPoints: 24` still rejects `bad_sum`.

## Warnings

### WR-01: mexicano with `totalRounds = null` never terminates / never auto-finishes

**File:** `src/lib/services/round-result.ts:230-249`, `src/lib/validation/tournament.ts:64-66`, `src/lib/services/tournament.ts:43`

**Issue:** `totalRounds` is `Int?` and is **not** required for mexicano by the
create-tournament `superRefine` (only size/mode are constrained for mexicano); it is
stored as `data.totalRounds ?? null`. In `recordRoundResult`, `isLastRound = totalRounds
!= null && roundNumber >= totalRounds`. When `totalRounds` is null, `isLastRound` is
**always false**, so the engine takes the materialize branch on every completed round and
**never reaches the finish branch**. A mexicano with no `totalRounds` therefore has no
terminal condition: it keeps cross-pairing and materializing a new round after each
completed round indefinitely, and only a manual `finishTournament` can end it.

**Fix:** Require `totalRounds` for mexicano (and americano) at creation, e.g. in
`superRefine`:

```ts
if ((d.format === "mexicano" || d.format === "americano") && d.totalRounds == null)
  ctx.addIssue({ code: "custom", path: ["totalRounds"], message: "Укажите число раундов" });
```

Or, if `totalRounds` is meant to be optional, define a fallback terminal condition for
the null case (e.g. finish after N−1 rounds). Either way the null path must terminate.

**RESOLVED (bf6bc85):** `createTournamentSchema.superRefine` now requires `totalRounds`
for mexicano (`path: ["totalRounds"]`). Americano is intentionally NOT required (it derives
N−1 rounds from the circle method — see IN-02). Added regression tests: mexicano without
`totalRounds` → rejected on `totalRounds` path; americano without `totalRounds` → accepted.

### WR-02: mexicano early-round re-record leaves stale downstream pairings

**File:** `src/lib/services/round-result.ts:234-240`, `src/lib/services/mexicano.ts:202-206`

**Issue:** Once round `r+1` is materialized, editing a score in round `r` re-runs
`recordRoundResult` → `materializeNextMexicanoRound(tx, …, r)`, which hits the
materialize-once guard (`alreadyNext > 0 → return null`) and does **not** re-derive round
`r+1` from the corrected standings. The round `r+1` quad cut / cross-pairing is then
inconsistent with the edited round `r` results — silently. Standings (`computeStandings`)
recompute correctly, but the already-played pairings do not, so the tournament can
proceed on pairings that no longer reflect the recorded scores.

This is an inherent tension of one-at-a-time materialization, but it is currently silent.

**Fix (thesis-appropriate, pick one):** (a) reject editing a recorded result once a later
round exists for mexicano (`RoundResultError`), or (b) document the limitation and surface
a warning in the Phase 11 UI. At minimum, note the constraint where the gate is checked so
it is a conscious decision rather than a latent surprise.

**RESOLVED (fe005fa):** chose option (a). `recordRoundResult` now rejects with a new typed
`RoundResultError("stale_pairings")` when recording a mexicano round whose successor round
already exists (`round.count({ roundNumber: { gt: thisRound } }) > 0`), before any write.
The Server Action already surfaces `e.message` for any RoundResultError. Added regression
tests: re-record of round 1 after round 2 exists → `stale_pairings` (nothing persisted);
recording the latest round (no successor) still allowed + materializes the next round.

### WR-03: `scoreSetsMode` does not cap the number of sets (no parity with playoff path)

**File:** `src/lib/services/round-result.ts:89-119`

**Issue:** `recordResult` (playoff) rejects `sets.length > setsPerMatch`
(result.ts:138-143), but `scoreSetsMode` has no such guard — it tallies whatever it is
given and relies on `matchWinnerFromSets` "tolerating" trailing sets by counting. Via the
normal form path the parser caps rows at `setsPerMatch` (round-result.ts validation loop
`n <= setsPerMatch`), so this is not reachable from the UI, but `scoreSetsMode` /
`recordRoundResult` are exported services and a direct caller (or a future call site)
could submit an over-length set list and have it silently accepted.

**Fix:** Mirror the playoff guard for consistency and defense-in-depth:

```ts
if (sets.length > setsPerMatch) {
  throw new RoundResultError("invalid_set", `Слишком много сетов: максимум ${setsPerMatch}`);
}
```

**RESOLVED (9e3d2a3):** added exactly this guard at the top of `scoreSetsMode`. Added a
regression test: 4 sets with `setsPerMatch: 3` → `invalid_set` (nothing persisted).

## Info

### IN-01: `targetPoints` comment claims "advisory / optional" but it is always enforced

**File:** `src/lib/services/round-result.ts:58`

**Issue:** The comment says the targetPoints check is "ADVISORY (A5) — only enforced when
the caller passes targetPoints." In practice `recordRoundResult` always passes
`tournament.targetPoints`, and for points mode `createTournament` always defaults it to
24, so it is effectively mandatory for every points match. The comment is misleading
(and is the root of CR-01's surprise). Update the wording to reflect actual behaviour
after CR-01 is fixed.

**RESOLVED (215318e):** comment rewritten — the sum check is now documented as applying to
americano/mexicano ONLY (the misleading "ADVISORY / optional" wording is gone).

### IN-02: americano ignores admin-supplied `totalRounds`

**File:** `src/lib/services/americano.ts:144`, `src/lib/validation/tournament.ts:38`

**Issue:** `generateAmericano` always produces N−1 rounds from the circle method,
regardless of any `totalRounds` value the admin entered at creation. Auto-finish keys off
"all matches recorded", so this is not a correctness bug, but the `totalRounds` field is
silently meaningless for americano, which is confusing. Either ignore it explicitly in the
UI for americano or document that the round count is derived (N−1), not configured.

**RESOLVED (bf6bc85):** documented at the WR-01 superRefine site — americano derives N−1
rounds and ignores `totalRounds` (so `totalRounds` is intentionally NOT required for
americano, only for mexicano). Captured in a regression test.

---

_Reviewed: 2026-06-07T18:28:26Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
