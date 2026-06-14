# Deferred Items — quick 260614-s1z

## Out-of-scope discoveries (NOT fixed — outside this plan's scope)

### Pre-existing test failure: `src/lib/services/tournament.test.ts:41`
- **Status:** Pre-existing, fails identically at clean HEAD (confirmed via stash).
- **Cause:** Commit `9576c69` (date-based listing) changed `listTournaments`'
  `orderBy` from an object `{ createdAt: "desc" }` to an array
  `[{ createdAt: "desc" }]` for the timeframe sorting, but the test's
  `assert.deepEqual(f.calls[0].orderBy, { createdAt: "desc" })` was never
  updated to expect the array.
- **Not touched by this plan:** This plan dropped scoring columns; it did not
  touch `listTournaments`, its orderBy logic, or `tournament.test.ts`.
- **Fix (if desired):** update the three orderBy assertions in
  `tournament.test.ts` to expect arrays, or none — a separate task.

### Stale comments referencing the dropped column names (out of plan file scope)
These files mention `setsPerMatch`/`gamesPerSet`/`targetPoints` in comments but
were NOT in this plan's task-1 file list, so per "surgical edits only" they were
left untouched:
- `prisma/schema.prisma:216` — SetScore comment "setNumber 1..setsPerMatch"
- `src/app/(app)/admin/tournaments/new/create-tournament-form.tsx:223`
- `src/lib/validation/round-result.ts:7`
- `src/lib/validation/result.ts:3`

Intentional keep (still valid): `src/lib/validation/tournament.test.ts:223-230`
— asserts the create zod schema ignores these names (still true).
