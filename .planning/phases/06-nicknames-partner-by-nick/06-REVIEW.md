---
phase: 06-nicknames-partner-by-nick
reviewed: 2026-06-06T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - prisma/schema.prisma
  - prisma/migrations/20260606180646_add_user_nickname/migration.sql
  - prisma/seed.ts
  - scripts/seed-test-users.ts
  - scripts/e2e-record-result.ts
  - src/lib/auth.ts
  - src/lib/auth-client.ts
  - src/lib/validation/auth.ts
  - src/app/(auth)/register/register-form.tsx
  - src/lib/services/registration.ts
  - src/lib/services/registration.test.ts
  - src/lib/validation/registration.ts
  - src/lib/validation/registration.test.ts
  - src/app/(public)/tournaments/[id]/actions.ts
  - src/app/(public)/tournaments/[id]/page.tsx
  - src/app/(public)/tournaments/[id]/participate-form.tsx
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-06-06
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Reviewed the Nicknames & Partner-by-Nick phase: `User.nickname` (required, `@@unique`), Better Auth `additionalFields` signup wiring, the `findUserIdByNickname` lookup resolved before the untouched transactional `registerPair` gate, the `player2Id` → `player2Nickname` surface rename, and the seed/e2e updates.

The core mechanics are correct and match the research:

- **Duplicate-nickname handling** is sound. `error.code === "FAILED_TO_CREATE_USER"` → «Никнейм уже занят» and `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` → email message; the form branches on `error.code` (stable contract), not `error.message`. Atomicity holds per the research finding (collision aborts `createUser`, no orphan rows).
- **Self-pairing guard intact.** Own nickname → own id → `registerPair`'s `player1Id === player2Id` guard → `self_partner`. The lookup correctly does NOT special-case it.
- **`partner_not_found` handling correct.** `findUserIdByNickname` throws `RegistrationError("partner_not_found")`, caught by the action's `instanceof RegistrationError` branch and surfaced as the RU message; no pair is created.
- **No stale `player2Id` references** on the form/validation/action/page surface (grep-confirmed). Remaining `player2Id` occurrences are the internal resolved-id param (`registerPair`, Pair model, tests, e2e) — correct per plan.
- **Validation bounds/regex** (`trim`, 3–30, `^[A-Za-z0-9_-]+$`) match the locked spec.

No Critical issues. Findings below are robustness/quality concerns, none blocking for a thesis demo.

## Warnings

### WR-01: Non-idempotent seed leaves orphaned auth rows on a mid-run failure

**File:** `scripts/seed-test-users.ts:56-69`, `prisma/seed.ts:21-34`
**Issue:** Both seeds key idempotency on **email** (`findUnique({ where: { email } })`), but the User table now has a second unique constraint on **nickname**. The two-step pattern — `auth.api.signUpEmail(...)` then `prisma.user.update(...)` — is not atomic. If `signUpEmail` succeeds (User + Account rows committed) but the subsequent `update` throws, a re-run will find the email exists and skip, leaving a User whose `courtSide`/`role` was never applied. More directly relevant to this phase: if test data is ever re-seeded against a DB where a nickname like `player3` already exists under a *different* email, `signUpEmail` now throws `FAILED_TO_CREATE_USER` mid-loop and aborts the whole script (the email check won't catch a nickname collision). The deterministic `playerN` scheme makes this unlikely in the happy path, but the email-only guard no longer covers all unique constraints.
**Fix:** This is acceptable for the locked `migrate reset` + reseed flow (empty table → no collisions). If hardening is desired, wrap the loop body so a `signUpEmail` failure is logged-and-skipped rather than aborting, e.g.:
```ts
try {
  await auth.api.signUpEmail({ body: { email, password: PASSWORD, name, nickname, phone, skillLevel } });
  await prisma.user.update({ where: { email }, data: { courtSide } });
  created++;
} catch (e) {
  console.warn(`[seed-test-users] skip ${email}: ${(e as Error).message}`);
  skipped++;
  continue;
}
```

### WR-02: Generic fallback can mask a real nickname-collision regression at signup

**File:** `src/app/(auth)/register/register-form.tsx:60-66`
**Issue:** The mapping relies on the documented assumption (Research A1) that `FAILED_TO_CREATE_USER` at signup is *always* a nickname collision because email is pre-checked. That is correct for the current schema, but the assumption is undocumented at the call site beyond a comment, and any future unique create-time field (or a transient Prisma/DB error wrapped as `FAILED_TO_CREATE_USER`) would be mislabeled to the user as «Никнейм уже занят». For a thesis this is fine, but the message is asserted with no server-side confirmation that the failing column was actually `nickname`.
**Fix:** No change required for v1.1 (single unique create-time field). If a second unique field is added later, disambiguate server-side (catch P2002 and inspect `meta.target`) rather than inferring from the generic code. Document the A1 assumption near the schema's `@@unique([nickname])` so the coupling is discoverable.

### WR-03: Dead code — `listEligiblePartners` no longer referenced anywhere

**File:** `src/lib/services/registration.ts:139-159`
**Issue:** The participate page no longer loads `listEligiblePartners` and the form dropped the `partners` prop (grep-confirmed: zero references outside the definition). The function, its `playerSelect`-adjacent inline `select`, and the explanatory comment about the `<select>` it backed are now dead code. The summary notes this was a deliberate "leave it" call per the locked optional-deletion decision, so this is informational-leaning, but a dead exported service function with a stale doc-comment ("backing the `<select>`") is a maintainability smell that can mislead a future reader into thinking a partner list is still surfaced.
**Fix:** Delete `listEligiblePartners` (lines 139-159) since REG-04 removed its only consumer. If intentionally retained for a future autocomplete feature (explicitly deferred/out of scope per RESEARCH), update the doc-comment to state it is currently unused, e.g. `// UNUSED since REG-04 (partner-by-nickname). Retained for a possible future autocomplete; no current caller.`

## Info

### IN-01: Migration warning comment is misleading for the reset path

**File:** `prisma/migrations/20260606180646_add_user_nickname/migration.sql:1-6`
**Issue:** The auto-generated header warns "Added the required column `nickname` ... not possible if the table is not empty." This is the standard Prisma boilerplate from `--create-only`, but it documents a failure mode the locked `migrate reset` path deliberately sidesteps (empty table at apply time). A grader reading the migration may think the migration is unsafe. Behaviorally fine — the comment is just inherited noise.
**Fix:** Optional: leave as-is (Prisma-generated, conventional) or trim the warning block to a one-line note that reset is the applied path.

### IN-02: Nickname stored but never displayed in the participant list

**File:** `src/app/(public)/tournaments/[id]/page.tsx:126-133`
**Issue:** The whole phase introduces nicknames as the stable human handle, yet the participant list still renders only `player.name` (court side + skill level). A user who registers a partner by nickname cannot see that nickname anywhere in the UI to confirm they paired with the right person. This matches the locked scope (REG-04 is *entry* by nickname; display was not specified), so it is not a defect — flagged only as a coherence gap a reviewer at defense might raise.
**Fix:** Out of scope; no change. If desired later, add `nickname` to `playerSelect` and render it beside `player.name`.

### IN-03: Register form `name` validation messages are English while nickname messages are Russian

**File:** `src/lib/validation/auth.ts:6-15`
**Issue:** `email`/`password`/`name` use English messages ("Enter a valid email address", "Name is required") while the new `nickname` rules use Russian ("Минимум 3 символа", "Только буквы, цифры, _ и -"). The register form is now mixed-language. Pre-existing for the other fields; the phase only added the inconsistency by introducing RU messages alongside the existing EN ones.
**Fix:** Cosmetic; out of correctness scope. For consistency, align all `registerSchema` messages to one language.

### IN-04: `findUserIdByNickname` does not re-trim, relying on caller + stored-value invariant

**File:** `src/lib/services/registration.ts:44-56`
**Issue:** The lookup does an exact `where: { nickname }` with whatever string it receives. Correctness depends on (a) the action passing the already-trimmed `parsed.data.player2Nickname` (it does — `registerPairSchema` trims) and (b) stored nicknames having been trimmed at registration (they were — `registerSchema` trims). The invariant holds across the current call path, but the helper itself has no guard, so a future caller passing an untrimmed string would silently miss-match. Not a live bug.
**Fix:** No change required (the single caller trims). Optional defensive `nickname.trim()` inside the helper if it may gain other callers.

---

_Reviewed: 2026-06-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
