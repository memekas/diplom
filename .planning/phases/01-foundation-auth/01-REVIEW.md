---
phase: 01-foundation-auth
reviewed: 2026-06-06T00:00:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - prisma/schema.prisma
  - prisma/seed.ts
  - prisma.config.ts
  - src/lib/db.ts
  - src/lib/auth.ts
  - src/lib/auth-client.ts
  - src/lib/auth-guards.ts
  - src/lib/services/profile.ts
  - src/lib/validation/auth.ts
  - src/lib/validation/profile.ts
  - src/lib/validation/profile.test.ts
  - src/app/api/auth/[...all]/route.ts
  - src/app/(app)/admin/actions.ts
  - src/app/(app)/admin/page.tsx
  - src/app/(app)/dashboard/page.tsx
  - src/app/(app)/profile/actions.ts
  - src/app/(app)/profile/page.tsx
  - src/app/(app)/profile/profile-form.tsx
  - src/app/(auth)/login/page.tsx
  - src/app/(auth)/login/login-form.tsx
  - src/app/(auth)/register/page.tsx
  - src/app/(auth)/register/register-form.tsx
  - src/components/nav.tsx
  - src/components/logout-button.tsx
  - src/app/layout.tsx
  - src/app/page.tsx
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-06-06
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

Reviewed the Foundation & Auth phase: Prisma schema, Better Auth wiring, the
server-side guards, profile service/validation, and the auth UI. The security
posture on the points the focus called out is sound:

- **Auth boundary holds.** `updateProfileAction` and `adminPing` both open with
  `requireUser()` / `requireAdmin()` as the first line. The three protected
  pages (`dashboard`, `admin`, `profile`) all guard before reading. No mutation
  trusts client-supplied identity.
- **Identity from session only.** The profile write derives `userId` from
  `requireUser().id`, never from `formData`; `profileSchema` strips `role`/
  `name`/`email` (test confirms). Ownership scoping on the Prisma `update` is
  correct (`where: { id: userId }`).
- **No credential leak.** `User` has no password column; the credential lives in
  `Account`. `safeProfileSelect` whitelists fields and is used on every read and
  write. `.env.example` carries placeholders only; `.env` is gitignored and not
  in scope.
- **Validation applied server-side** before mutation; enums match the schema
  (`courtSide` left/right/either, `skillLevel` beginner/intermediate/advanced/pro).
- **`revalidatePath("/profile")`** is present after the profile mutation.
- Server/client boundary is clean: `"use client"` files (`login-form`,
  `register-form`, `logout-button`, `profile-form`) import only `auth-client`
  and validation; no client file imports `@/lib/auth` or `@/lib/db`.

No BLOCKERs found. Findings below are robustness/quality issues.

## Warnings

### WR-01: Bare `catch` in protected pages swallows non-auth errors into a login redirect

**File:** `src/app/(app)/profile/page.tsx:11-15`, `src/app/(app)/admin/page.tsx:8-12`
**Issue:** The guard call is wrapped in `try { await requireUser() } catch { redirect("/login") }`.
The `catch` is untyped and catches *everything*, not just the guard's
`"Unauthorized"`/`"Forbidden"` throw. If `auth.api.getSession` throws for an
operational reason (DB unavailable, cookie-parse failure, Better Auth internal
error), the user is silently bounced to `/login` instead of surfacing a real
error — masking failures and producing a confusing "you got logged out" UX for
an authenticated user. `redirect()` itself throws `NEXT_REDIRECT`, so the
current placement (redirect in the catch, not the try) is safe, but the
indiscriminate catch is the problem.
**Fix:** Narrow the catch to the guard's contract, e.g.:
```ts
try {
  user = await requireUser();
} catch (e) {
  if (e instanceof Error && (e.message === "Unauthorized" || e.message === "Forbidden")) {
    redirect("/login");
  }
  throw e; // let real errors hit the error boundary
}
```
Or have the guards throw a typed sentinel (`AuthError`) the pages can match on.

### WR-02: `dashboard` and `nav` re-implement the auth check instead of using the guard

**File:** `src/app/(app)/dashboard/page.tsx:9-13`, `src/components/nav.tsx:9`
**Issue:** `requireUser()` exists as the canonical boundary, but `dashboard/page.tsx`
inlines its own `auth.api.getSession` + `if (!session?.user) redirect`, and
`nav.tsx` calls `getSession` directly. Two parallel idioms for "is there a
session" invite drift — a future change to the guard (e.g. ban-expiry handling
via the admin plugin's `banned`/`banExpires` columns, which are in the schema)
won't reach the inlined copies. The dashboard in particular is a *protected*
page that bypasses the shared guard.
**Fix:** Have `dashboard/page.tsx` use `requireUser()` like `profile`/`admin`.
`nav.tsx` is display-only (chooses links), so a raw `getSession` is defensible
there, but consider a shared `getOptionalSession()` helper so all session reads
funnel through `auth-guards.ts`.

### WR-03: `requireAdmin` does not account for banned users

**File:** `src/lib/auth-guards.ts:29-35`
**Issue:** The schema carries `banned`/`banExpires` (admin plugin), but
`requireUser`/`requireAdmin` check only `session?.user` and `role`. A banned
user with a still-valid session cookie passes both guards. For Phase 1 this may
be acceptable (banning is a later-phase feature), but the guard is documented as
"the REAL security check" — leaving ban state unenforced here means every future
caller inherits the gap. Flagging so it is a conscious deferral, not an oversight.
**Fix:** If ban enforcement is in scope, add to both guards:
```ts
if (session.user.banned && (!session.user.banExpires || session.user.banExpires > new Date())) {
  throw new Error("Unauthorized");
}
```
If out of scope for Phase 1, note the deferral explicitly in the guard comment.

### WR-04: Profile pre-validation logic is duplicated verbatim between client and server

**File:** `src/app/(app)/profile/profile-form.tsx:24-40` vs `src/app/(app)/profile/actions.ts:25-38`
**Issue:** The exact same `safeParse({ courtSide, phone, skillLevel })` +
issue-collection loop is copy-pasted in the client form and the server action.
The two reads of `formData` must stay byte-for-byte identical (note `phone:
formData.get("phone") ?? undefined` and `skillLevel: ... || undefined` in both)
or client and server will disagree on what is valid. Divergence here is a latent
bug: the client could accept input the server rejects, or vice versa.
**Fix:** Extract a single `parseProfileForm(formData): { ok; data } | { ok; errors }`
helper (in a non-`"use server"` module) and call it from both sides.

## Info

### IN-01: `getProfile` uses `findUniqueOrThrow` with no caller-side handling

**File:** `src/lib/services/profile.ts:18`, `src/app/(app)/profile/page.tsx:17`
**Issue:** `getProfile` calls `findUniqueOrThrow`. The id comes from a valid
session, so the row normally exists — but if the user row was deleted while the
session cookie is still live, the page throws an unhandled `NotFoundError`
(500) instead of redirecting. Edge case, low likelihood in the offline demo.
**Fix:** Either keep `findUniqueOrThrow` and add an error boundary, or use
`findUnique` and `redirect("/login")` on `null`.

### IN-02: `updateProfileAction` declares a `form` error key it never sets

**File:** `src/app/(app)/profile/actions.ts:11,40`
**Issue:** `ProfileActionState` includes a `form` error key (rendered by the
form at `profile-form.tsx:50`), but the action has no try/catch around
`updateProfile`. A DB write failure throws and surfaces as an uncaught Server
Action error rather than a `{ ok: false, errors: { form } }` the UI can show.
The `form` channel is effectively dead unless a wrapper sets it.
**Fix:** Wrap the `updateProfile` call in try/catch and return
`{ ok: false, errors: { form: "Could not save. Try again." } }` on failure, or
drop the unused `form` key.

### IN-03: `let user;` typed as possibly-undefined after redirect

**File:** `src/app/(app)/profile/page.tsx:10-17`
**Issue:** `let user;` (implicit `any`/possibly-undefined) is assigned in the
`try`; control only reaches `getProfile(prisma, user.id)` when the try
succeeded, so it is defined at runtime. But the pattern leans on `redirect()`'s
throw for narrowing and yields a weakly typed `user`. Style/robustness only.
**Fix:** `const user = await requireUser().catch(() => redirect("/login"));`
keeps `user` typed and const, or use the narrowed-catch pattern from WR-01.

### IN-04: `auth-client` relies on implicit same-origin `baseURL`

**File:** `src/lib/auth-client.ts:6-8`
**Issue:** `createAuthClient` is called with no `baseURL`. In the browser it
defaults to the current origin, which is correct for this same-origin app, so
this works. Noting only because `BETTER_AUTH_URL` is configured server-side but
not referenced client-side — if the app is ever served behind a path prefix or
a different public origin, the client will need an explicit `baseURL`.
**Fix:** None required for Phase 1; document the same-origin assumption.

---

_Reviewed: 2026-06-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
