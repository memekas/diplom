---
phase: 08-backend-core
reviewed: 2026-06-07T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/lib/validation/tournament.ts
  - src/lib/services/tournament.ts
  - src/lib/services/registration.ts
  - src/lib/validation/registration.ts
  - src/lib/services/admin.ts
  - src/lib/auth.ts
  - src/lib/validation/profile.ts
  - src/lib/services/profile.ts
  - src/app/(app)/profile/actions.ts
  - src/app/(public)/tournaments/[id]/actions.ts
  - src/app/(app)/admin/tournaments/actions.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: resolved
resolution:
  WR-01: fixed (ee16085) — email normalized to lowercase().trim() before self-compare, findUnique, and changeEmail
  WR-02: fixed (c09115e) — removePair/removeParticipant use deleteMany({id, tournamentId}); throw not_open on count 0
  WR-03: fixed (e72803f) — finishTournament throws AdminError not_started off in_progress; action surfaces RU message
  IN-01: deferred (non-issue, dead branch)
  IN-02: deferred (intentional symmetry placeholder for Phase 11)
  IN-03: deferred (Phase 9 — engines own totalRounds default)
---

# Phase 8: Code Review Report

**Reviewed:** 2026-06-07
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 8 backend core is well-structured and faithful to the locked CONTEXT/RESEARCH
decisions: all new Server Actions place `requireAdmin`/`requireUser` as the first
line, identity comes from the session guard (never the form), ids are bound via
`.bind()`, `registerSingle` correctly mirrors `registerPair`'s transactional gate
(status/mode/level/capacity/duplicate all inside one `$transaction`, capacity counted
on `TournamentPlayer`), level equality re-checks both players against the DB row, and
`finishTournament` is idempotent. The playoff stack is untouched (additive only) and
all 8 new test files pass (admin 8, registration 18, tournament-validation 56,
profile 33, plus existing invariants).

No blockers. Three warnings worth fixing — the most material being a case-sensitivity
hole in the email pre-check that re-opens the very anti-enumeration footgun the
pre-check exists to close (Better Auth lowercases the email internally; the pre-check
does not). One IDOR-shaped gap in the status-guarded delete (status checked on the
`tournamentId` row, but the delete targets a `pairId`/`playerId` that is never
verified to belong to that tournament). Severity is calibrated to thesis scope
(single trusted admin, offline demo, no real load).

## Warnings

### WR-01: Email uniqueness pre-check is case-sensitive but Better Auth lowercases — pre-check is defeated

**File:** `src/app/(app)/profile/actions.ts:57-66`
**Issue:** The pre-check `prisma.user.findUnique({ where: { email } })` uses the raw,
mixed-case email from the form. SQLite TEXT comparison is BINARY (case-sensitive),
and stored emails are already lowercased at signup (`node_modules/better-auth/dist/api/routes/sign-up.mjs:164`
`email.toLowerCase()`). Better Auth's `changeEmail` then lowercases internally before
its own duplicate lookup (`update-user.mjs:415` `const newEmail = ctx.body.newEmail.toLowerCase()`,
`:433` `findUserByEmail(newEmail)`).

Consequence: a user submits `Existing@Email.com` where `existing@email.com` is already
taken by another user. The pre-check looks for exact `Existing@Email.com`, finds
nothing, passes. `changeEmail` lowercases, finds the existing user, and silently
returns `{status:true}` WITHOUT changing the email (RESEARCH Pitfall 1, anti-enumeration).
The user "succeeds" but their email is unchanged — exactly the UX bug the pre-check was
added to prevent. Also affects the self-compare at `:57`: `email !== user.email`
compares mixed-case form input against a lowercased stored value, so re-submitting your
own email in different case proceeds to `changeEmail`, which then rejects with
"email is the same" (`update-user.mjs:416`) → caught → "Не удалось сменить email".

**Fix:** Normalize before both the comparison and the lookup, matching Better Auth's
own normalization:
```typescript
const newEmail = email?.toLowerCase();
if (newEmail && newEmail !== user.email.toLowerCase()) {
  const clash = await prisma.user.findUnique({ where: { email: newEmail }, select: { id: true } });
  if (clash && clash.id !== user.id) {
    return { ok: false, errors: { email: "Этот email уже используется" } };
  }
  try {
    await auth.api.changeEmail({ body: { newEmail }, headers: await headers() });
  } catch {
    return { ok: false, errors: { email: "Не удалось сменить email" } };
  }
}
```

### WR-02: Status-guarded delete checks status on `tournamentId` but deletes by `id` without binding the two — guard can be bypassed across tournaments

**File:** `src/lib/services/admin.ts:25-39` (`removePair`), `48-62` (`removeParticipant`)
**Issue:** Both services re-read `status` for the passed `tournamentId` and gate the
delete on `status === "registration"`, but the delete itself is
`tx.pair.delete({ where: { id: pairId } })` / `tx.tournamentPlayer.delete({ where: { id: playerId } })`
with no `tournamentId` filter. There is no check that `pairId`/`playerId` actually
belongs to `tournamentId`. An admin (or a tampered `.bind()` payload) can pass the
`tournamentId` of any registration-open tournament together with a `pairId` from a
DIFFERENT, already-started/finished tournament and delete a registration from the
started tournament — bypassing the "no deletion after start" invariant (T-08-18). The
status guard validates the wrong row. Impact is bounded (admin-only, single trusted
admin, ids bound from leaf), hence WARNING not BLOCKER, but the guard is structurally
incorrect.

**Fix:** Scope the delete to the tournament so the status guard and the target are the
same row. `deleteMany` returns a count, letting you detect a mismatch:
```typescript
const res = await tx.pair.deleteMany({ where: { id: pairId, tournamentId } });
if (res.count === 0) throw new AdminError("not_open", "Регистрация не найдена");
```
(same for `tournamentPlayer`). Or include `tournamentId` in the existence check before
deleting by id.

### WR-03: `finishTournament` on a `registration`-status round-based tournament throws a raw status-machine error mapped to a generic retry message

**File:** `src/lib/services/admin.ts:71-78`, surfaced at `src/app/(public)/tournaments/[id]/actions.ts:208-212`
**Issue:** For round_robin/americano/mexicano, manual finish is the primary terminal
path (CONTEXT ADMN-02) and there is no playoff-style auto-start. If the admin finishes
a tournament still in `registration` (never started), `finishTournament` skips the
idempotent no-op (status is `registration`, not `finished`) and calls
`transitionTournament(..., "in_progress", "finished")`, which throws
`Tournament status changed: expected "in_progress" but DB has "registration"`. The
action's bare `catch` maps this to "Не удалось завершить турнир. Попробуйте ещё раз." —
a misleading "try again" message for a permanent state error (it will never succeed
from `registration`). Not data-corrupting (forward-only machine holds), but the error
classification is wrong and confusing.

**Fix:** Either treat finish-from-registration as an explicit typed `AdminError`
("Турнир ещё не начат — сначала запустите") so the action can surface a correct
message, or accept that finish requires `in_progress` and have the UI/flow guarantee a
start first (Phase 11). At minimum return a distinct message, not a transient "retry".

## Info

### IN-01: Dead validation branch in `createTournamentSchema` superRefine

**File:** `src/lib/validation/tournament.ts:83-84`
**Issue:** `if (d.scoringMode === "points" && d.targetPoints !== undefined && d.targetPoints <= 0)`
is unreachable: the field is declared `z.coerce.number().int().positive()` (line 37),
so any value ≤ 0 is already rejected before superRefine runs. The `targetPoints <= 0`
custom issue can never fire.
**Fix:** Remove the dead branch, or if a custom RU message is desired for non-positive
targets, relax the field to `.optional()` (drop `.positive()`) and let superRefine own
the bound.

### IN-02: `registerSingleSchema` is an empty object with full parse boilerplate

**File:** `src/lib/validation/registration.ts:43-62`
**Issue:** `registerSingleSchema = z.object({})` and `parseRegisterSingleForm` exist for
symmetry but validate nothing (singles carries no client fields — userId is from the
session). The function is currently unreferenced by `participateSingleAction`
(`tournaments/[id]/actions.ts:83-105` does not call it). Harmless but dead until a UI
needs it.
**Fix:** Acceptable as an intentional symmetry placeholder for Phase 11; otherwise drop
until a field actually needs validation. Noting only so it is not mistaken for a wired
boundary.

### IN-03: `createTournament` defaults `targetPoints` to 24 only for points-mode but never validates `totalRounds` presence for americano/mexicano

**File:** `src/lib/services/tournament.ts:42-43`, `src/lib/validation/tournament.ts:38`
**Issue:** `totalRounds` is optional everywhere and never defaulted or required, even
for americano/mexicano where it is the round count the Phase 9 engine will read. A
tournament can be created with `totalRounds: null`. This is correctly deferred per
CONTEXT/RESEARCH (Phase 9 engines own round generation), so it is in-scope-deferred,
not a defect — flagged only so Phase 9 remembers to handle the null/default.
**Fix:** None now (Phase 9). When the engine lands, default or require `totalRounds`
for round-based formats.

---

_Reviewed: 2026-06-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
