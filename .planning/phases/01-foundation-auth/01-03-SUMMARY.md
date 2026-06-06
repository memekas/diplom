---
phase: 01-foundation-auth
plan: 03
subsystem: profile
tags: [server-actions, prisma, zod, profile, rsc, security]

# Dependency graph
requires:
  - "01-01: Prisma singleton (src/lib/db.ts), User domain fields courtSide/phone/skillLevel, Zod, skillLevels const (src/lib/validation/auth.ts)"
  - "01-02: requireUser() guard (src/lib/auth-guards.ts)"
provides:
  - "Profile service getProfile/updateProfile over Prisma User, safe-field select (src/lib/services/profile.ts)"
  - "profileSchema Zod schema for profile edit (src/lib/validation/profile.ts)"
  - "Guarded profile slice: /profile view + edit form + updateProfileAction (src/app/(app)/profile/*)"
affects: [03-registration-pairs, tournaments]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Thin Server Action / fat service: action does requireUser() -> profileSchema.safeParse -> updateProfile(prisma, user.id) -> revalidatePath('/profile')"
    - "userId for mutations comes from the requireUser() guard result, never from form data (Pitfall 8)"
    - "Service reads/writes use an explicit safe-field select — no credential columns cross to the client (Pitfall 12)"
    - "Page = Server Component reads via service; single 'use client' leaf is the form (Pitfall 11); revalidatePath co-located with the write (Pitfall 10)"

key-files:
  created:
    - "src/lib/validation/profile.ts"
    - "src/lib/validation/profile.test.ts"
    - "src/lib/services/profile.ts"
    - "src/app/(app)/profile/page.tsx"
    - "src/app/(app)/profile/profile-form.tsx"
    - "src/app/(app)/profile/actions.ts"
  modified: []

key-decisions:
  - "Reused skillLevels const from src/lib/validation/auth.ts instead of re-declaring — single source of truth for the skill enum"
  - "No test framework added (minimal-deps stance): validation unit tests are a tsx-runnable assertion script (profile.test.ts); service/action proven via a throwaway integration script run against the real SQLite DB (deleted, not committed)"
  - "updateProfile clears optional phone/skillLevel to null when the form sends empty (empty string -> undefined -> null) so unsetting a value works"
  - "page.tsx converts the requireUser() throw to redirect('/login') for UX; the guard remains the source of truth"
  - "Form uses useActionState with updateProfileAction; client-side profileSchema parse is UX-only, the action re-validates server-side as the real boundary"

requirements-completed: [PLAYER-03]

# Metrics
duration: 6min
completed: 2026-06-06
---

# Phase 1 Plan 03: Profile Slice Summary

**Profile vertical slice (PLAYER-03): a signed-in user views their name/email and edits the display-only domain fields — courtSide (left/right/either), phone, skillLevel — through a `requireUser`-guarded Server Action → Zod → service → `revalidatePath`, mutating only their own User row.**

## Performance
- **Duration:** ~6 min
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint auto-handled in AUTO_MODE)
- **Files created:** 6

## Accomplishments
- `src/lib/validation/profile.ts`: `profileSchema` — `courtSide` enum (left/right/either, required), `phone` optional trimmed string (empty → undefined), `skillLevel` optional enum (reuses `skillLevels`). Excludes name/email/role (role never client-editable, Pitfall 8).
- `src/lib/services/profile.ts`: `getProfile(prisma, userId)` and `updateProfile(prisma, userId, data)` over the Prisma User with an explicit `safeProfileSelect` (id/name/email/courtSide/phone/skillLevel) — no credential columns (Pitfall 12). `updateProfile` mutates only the three domain fields, scoped to the given userId; empty optional fields clear to null.
- `src/app/(app)/profile/page.tsx`: Server Component — `requireUser()` (redirect to /login on throw) → `getProfile` → renders read-only name/email + `<ProfileForm initial={...} />`.
- `src/app/(app)/profile/profile-form.tsx`: the single `"use client"` leaf (Pitfall 11) — `useActionState` over `updateProfileAction`, controlled selects/input, "Saved." / error feedback. Client-side `profileSchema` parse is UX-only.
- `src/app/(app)/profile/actions.ts`: `updateProfileAction` — first line `await requireUser()` (security boundary), `profileSchema.safeParse`, `updateProfile(prisma, user.id, ...)`, then `revalidatePath("/profile")` (Pitfall 10). userId comes from the guard, never the form (Pitfall 8).

## Task Commits
1. **Task 1: Profile service + Zod validation schema** — `9c843e8` (feat)
2. **Task 2: Profile view page + edit form + guarded update action** — `4b300ad` (feat)
3. **Task 3: Human-verify checkpoint** — auto-handled (AUTO_MODE), no code

## Verification Output

**Validation unit tests** (`npx tsx src/lib/validation/profile.test.ts`):
```
profileSchema: 16 assertions passed.
```
Covers: courtSide accepts left/right/either + rejects invalid + required; skillLevel accepts all 4 values + optional + empty→undefined + rejects invalid; phone optional/empty/trim; role/name/email stripped from output.

**Integration proof** (throwaway tsx script against the real SQLite DB — two test players signed up via Better Auth, exercised, then deleted):
```
ok - getProfile returns safe defaults, no credential fields
ok - updateProfile persisted courtSide/phone/skillLevel to player A's row
ok - player B row unaffected (update scoped to userId)
ok - name/email/role not mutated by profile update
ok - profileSchema rejects invalid courtSide
ok - clearing optional phone/skillLevel writes null

PROFILE INTEGRATION: all assertions passed.
```
This is the programmatic equivalent of the Task 3 human checkpoint: a real signed-in user's edit persists to their own row, ownership is isolated (player B untouched), display-only fields (name/email/role) are not mutated, invalid input is rejected, and unsetting works. Test users cleaned up (0 leftover; verified).

**Typecheck / build:**
- `npx tsc --noEmit` — PASS
- `npm run build` — PASS (Compiled successfully, TypeScript checked, 9/9 static pages; `/profile` route present, server-rendered on demand).

## Deviations from Plan
None — plan executed as written. The plan's Task 1 note explicitly permits exercising the service via integration verify (no DB-mocking harness) and validation via unit tests; both were done. No new dependencies added.

**Total deviations:** 0.

## Human Verification Deferred (AUTO_MODE)
AUTO_MODE active — the Task 3 browser-only steps were auto-approved after running all automatable equivalents (above: integration proof + build). Remaining purely-visual checks a human may still want to eyeball in a real browser:
- Visit `/profile` signed in as a player → see name/email (read-only) + current courtSide ("either"), phone, skillLevel.
- Change courtSide to "left", set a phone, set skillLevel to "advanced", Save → expect the "Saved." indication and the new values to render.
- Reload `/profile` (and inspect the row in `npx prisma studio`) → values persisted on your own row.
- Confirm name/email/role are not editable from the form.
No functional gaps expected — the integration proof covers the same persistence, ownership-isolation, and validation paths programmatically.

## Known Stubs
None. The profile fields are intentionally display-only in v1 per CONTEXT (no domain logic) — this is a documented scope decision, not a stub.

## Next Phase Readiness
- The thin-action / fat-service convention (requireUser → zod → service → revalidatePath) is now established and reused by phases 2–5 for every mutation.
- `getProfile`/`updateProfile` and the safe-field `select` pattern are the template for user-data reads crossing to the client.

## Self-Check: PASSED
All 6 created files exist on disk; both task commits (`9c843e8`, `4b300ad`) are present in git history. Build green; `/profile` route generated.
