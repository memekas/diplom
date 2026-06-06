---
phase: 05-results-advancement
reviewed: 2026-06-06T00:00:00Z
depth: deep
files_reviewed: 8
files_reviewed_list:
  - src/lib/services/result.ts
  - prisma/schema.prisma
  - src/lib/validation/result.ts
  - src/app/(public)/tournaments/[id]/actions.ts
  - src/app/(public)/tournaments/[id]/score-form.tsx
  - src/components/bracket-view.tsx
  - src/lib/services/bracket.ts
  - src/app/(public)/tournaments/[id]/page.tsx
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-06-06
**Depth:** deep
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the Phase 5 scoring + advancement slice at deep depth, tracing the full
chain: `score-form.tsx` (client leaf) → `recordResultAction` (auth boundary) →
`parseRecordResultForm` (input shaping) → `recordResult` (`$transaction`) →
`setWinner` / `matchWinnerFromSets` (scoring core) → `transitionTournament` (status
machine) → `listBracket` / `BracketView` (read path).

The core is well-constructed. The security boundary is correct: `requireAdmin()` is the
first line of `recordResultAction`, identity/role come only from the signed session,
and `tournamentId`/`matchId` are bound from the leaf — never read from the form body.
`winnerId` is derived server-side and constrained to `∈ {pairAId, pairBId}`. The
transaction loads DB-authoritative config, rejects unfilled slots / empty / invalid set
/ no-decisive-winner before any write, and the rollback semantics hold (interactive
`$transaction` callback throws → nothing persists). The re-record-final no-op guard
(re-read status, treat already-`finished` as no-op) is correct and matches the test.

No BLOCKERs. The findings below are correctness-robustness gaps that are reachable only
under specific configs or accepted-but-undocumented edge cases, plus minor quality
items. The most material is WR-01 (`matchWinnerFromSets` false-positive on even
`setsPerMatch`) — latent because the create form never sets an even value today, but it
is a silent data-corruption path the moment the default changes.

## Warnings

### WR-01: `matchWinnerFromSets` reports a false winner on a tie when `setsPerMatch` is even

**File:** `src/lib/services/result.ts:63-74`
**Issue:** `needed = ceil(setsPerMatch/2)`. For an even `setsPerMatch`, both sides can
reach `needed` from a tie. Example: `setsPerMatch=4` → `needed=2`. Submit four valid
sets, A wins 2 and B wins 2. The function counts all sets (a=2, b=2), then the ordered
`if (a >= needed) return "A"` fires and declares **A the winner of a 2-2 tie**. This is
a silent incorrect-winner → wrong pair advances → corrupt bracket. `recordResult` does
not guard against it (only `sets.length <= setsPerMatch` is checked, and 4 ≤ 4 passes).
Currently latent because `setsPerMatch` is `@default(3)` and is not a create-form field,
so only odd `3` is reachable through the UI — but the rule is wrong for the general case
the function advertises ("first to ceil(setsPerMatch/2)"), and it counts totals rather
than detecting who reached the threshold first.
**Fix:** Reject the ambiguous case explicitly instead of letting `if`-ordering pick a
winner:
```ts
export function matchWinnerFromSets(setWins: Side[], setsPerMatch: number): Side | null {
  const needed = Math.ceil(setsPerMatch / 2);
  let a = 0, b = 0;
  for (const w of setWins) (w === "A" ? a++ : b++);
  if (a >= needed && b >= needed) return null; // tie — never a winner
  if (a >= needed) return "A";
  if (b >= needed) return "B";
  return null;
}
```
(With odd `setsPerMatch` the extra branch is dead, so this is safe to add now and
correct if the default ever changes.)

### WR-02: Re-editing a decided match can leave the parent match's `winnerId` pointing at a pair no longer in that parent

**File:** `src/lib/services/result.ts:189-194`
**Issue:** On a re-record that flips the winner, step (8) overwrites the parent slot
(`pairAId`/`pairBId`) with the new winner via UPDATE. If the parent match has **already
been played** (has its own `winnerId`, `setsWonA/B`, and `SetScore` rows that reference
the OLD pair in that slot), this UPDATE silently swaps the parent's opponent out from
under its already-recorded result. The parent now has a `winnerId` and set scores that
describe a match between pairs that are no longer both present — a self-inconsistent row.
The code comment explicitly accepts "downstream cascade cleanup is OUT OF SCOPE," and
this does not crash, so it is not a BLOCKER. But "accepted" currently means *silently
inconsistent data is persisted*, not "rejected" or "flagged."
**Fix:** Either (a) document this as a known limitation in user-facing terms and accept
it, or (b) when the parent slot being overwritten already differs from the incoming
`winnerId` AND the parent already has a `winnerId`, reject the edit (`ResultError`) so an
admin must clear downstream results first:
```ts
if (match.nextMatchId) {
  const parent = await tx.match.findUniqueOrThrow({
    where: { id: match.nextMatchId },
    select: { pairAId: true, pairBId: true, winnerId: true },
  });
  const occupied = match.nextSlot === "A" ? parent.pairAId : parent.pairBId;
  if (parent.winnerId && occupied && occupied !== winnerId) {
    throw new ResultError("no_winner",
      "Нельзя изменить результат: следующий матч уже сыгран");
  }
  await tx.match.update({ where: { id: match.nextMatchId },
    data: match.nextSlot === "A" ? { pairAId: winnerId } : { pairBId: winnerId } });
}
```

### WR-03: `setsWonA`/`setsWonB` count ALL submitted sets, so the cached display can disagree with the derived winner

**File:** `src/lib/services/result.ts:142-153`, rendered at `src/components/bracket-view.tsx:52-53,106-108`
**Issue:** Trailing/extra sets beyond the decisive set are tolerated (by design), but
they are still tallied into `setsWonA`/`setsWonB` and persisted as `SetScore` rows.
Example with `setsPerMatch=3`: an admin submits `6:0, 0:6, 6:0` (A wins) and then
appends a 4th-by-mistake row — blocked by the `> setsPerMatch` guard, good. But submit
`6:0, 6:0, 0:6`: A is the winner (2-1), yet a viewer sees three sets `6:0 6:0 0:6` and
`setsWonA=2 / setsWonB=1`. That is internally consistent. The problematic case is
`6:0, 6:0` then re-edit to `6:0, 0:6, 0:6`: winner is now B? No — A=1, B=2 → B wins,
consistent. The real exposure is that a "phantom" set played after the match was
mathematically over is recorded and displayed as if it counted, with no indication it
was dead. Low-severity display-truth issue, not a wrong-winner.
**Fix:** Optionally stop tallying once a side reaches `needed`, or document that all
entered sets are displayed verbatim. If correctness of the displayed score matters,
truncate `perSetWinners`/persisted sets at the decisive set. Otherwise, accept and
document.

### WR-04: Client-supplied `setsPerMatch` is trusted for the input-row scan limit

**File:** `src/app/(public)/tournaments/[id]/actions.ts:104-117`, `src/lib/validation/result.ts:25-31`
**Issue:** `setsPerMatch` is bound into the action from the client form
(`score-form.tsx:28`), then passed to `parseRecordResultForm` as the `for (n=1..setsPerMatch)`
loop bound. A tampered POST can supply an arbitrary `setsPerMatch` (e.g. a huge integer)
to widen the scan loop, or a small one to truncate it. The authoritative validity check
is server-side in `recordResult` (it re-reads `setsPerMatch` from the DB and enforces
`sets.length <= setsPerMatch`), so this cannot produce an invalid persisted result — but
a maliciously large value makes the parser iterate that many times reading FormData keys
before `recordResult` rejects. No data corruption, bounded by `recordResult`'s DB check;
flagged because a security-sensitive value is being sourced from the client when the DB
already has it.
**Fix:** Drop the `setsPerMatch` action parameter; have `recordResultAction` (or
`recordResult`) read `setsPerMatch` from the tournament/match and pass it to
`parseRecordResultForm`, so the client never supplies it. The form still needs it only
for rendering rows, which is fine to keep client-side.

## Info

### IN-01: `nextSlot` compared as truthy/`"A"` with no validation of unexpected values

**File:** `src/lib/services/result.ts:192`
**Issue:** `match.nextSlot === "A" ? { pairAId } : { pairBId }` treats any non-`"A"`
value (including a corrupt `null`/`""`/`"X"` on a row that has a non-null `nextMatchId`)
as slot B. `nextSlot` is a free `String?` in the schema with no enum/check constraint.
Given Phase 4 always writes `"A"`/`"B"` together with `nextMatchId`, this is safe today,
but the fallback is a silent mis-advance rather than an error.
**Fix:** Assert the pair invariant: if `nextMatchId` is set, require `nextSlot` to be
exactly `"A"` or `"B"`, else throw `ResultError`.

### IN-02: `transitionTournament` receives `tx` via `as unknown as PrismaClient`

**File:** `src/lib/services/result.ts:209`, `src/lib/services/bracket.ts:166`
**Issue:** The transaction client is force-cast through `unknown` to `PrismaClient` to
reuse `transitionTournament`. It works because the function only uses
`findUniqueOrThrow`/`update`, which exist on both, but the double-cast defeats the type
system and would silently compile if `transitionTournament` ever started calling
`$transaction` (illegal on a tx client). Pre-existing pattern from Phase 4, repeated
here.
**Fix:** Type `transitionTournament`'s first param as
`Pick<PrismaClient, "tournament">` or `Prisma.TransactionClient` so the cast disappears.

### IN-03: `RecordResultInput` type duplicated across modules

**File:** `src/lib/validation/result.ts:15-17` vs `src/lib/services/result.ts:88-91`
**Issue:** `RecordResultInput.sets` (`{ gamesPair1; gamesPair2 }[]`) and `SetInput`
(`{ gamesPair1; gamesPair2 }`) describe the same shape in two places. They happen to
match, so `parsed.data.sets` flows into `recordResult` cleanly, but the two definitions
can drift independently.
**Fix:** Export one shared `SetInput` type and reference it from both.

---

_Reviewed: 2026-06-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
