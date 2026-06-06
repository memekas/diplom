---
phase: 01-foundation-auth
verified: 2026-06-06T00:00:00Z
status: human_needed
score: 6/6 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Register flow in browser: open /register, submit email/password/name (+ optional phone, skillLevel), submit"
    expected: "Immediate auto sign-in (no email verification) and redirect to /dashboard showing 'Welcome, {name}'; no courtSide field on the form"
    why_human: "Browser-driven form submission + client-side router redirect cannot be exercised by grep/tsc; backend signUp path proven programmatically but the visual click-through is browser-only"
  - test: "Session persistence: after registering/logging in, hard-reload /dashboard"
    expected: "Still signed in, name still shown (AUTH-02 persistence across reload)"
    why_human: "Cookie persistence across a real browser reload is a runtime/browser behavior; server route gating (307 anon / 200 authed) was proven in 01-01 but the visual reload is browser-only"
  - test: "Logout from a non-dashboard page via the nav Log out button"
    expected: "Session cleared, redirected to /, nav now shows Log in / Register"
    why_human: "Client onClick → authClient.signOut() → router redirect is interactive browser behavior"
  - test: "Profile edit round-trip: open /profile signed in, change courtSide to 'left', set phone, set skillLevel to 'advanced', Save, then reload"
    expected: "'Saved.' indication, updated values render, and values persist after reload (and in Prisma Studio) on the caller's own row; name/email/role not editable"
    why_human: "Visual save feedback + form submission UX is browser-only; persistence/ownership-scoping/validation proven programmatically via the integration script and unit tests"
  - test: "Admin page access control in browser: sign in as a non-admin player, visit /admin; then sign in as the seeded admin, visit /admin"
    expected: "Non-admin redirected to /login; admin sees the admin placeholder page"
    why_human: "Page-level guard redirect under a real session cookie is a browser flow; guard logic itself verified in source + build"
---

# Phase 1: Foundation & Auth Verification Report

**Phase Goal:** Запустить проект на залоченном стеке (Next.js 16 App Router + Prisma 6 SQLite + Better Auth ^1.6 + Tailwind 4 + Zod) со схемой БД, идемпотентным seed-аккаунтом админа и рабочей аутентификацией (регистрация/вход/выход + серверные гварды роли requireUser/requireAdmin) + просмотр/редактирование профиля игрока.
**Verified:** 2026-06-06
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | New player registers (email/password/name, optional phone/skillLevel) and is auto-signed-in; courtSide NOT asked, defaults `either` | ✓ VERIFIED | register-form.tsx calls `authClient.signUp.email` with name + optional phone/skillLevel; no courtSide field (grep OK-not-present); auth.ts `additionalFields` = phone/skillLevel only; schema `courtSide String @default("either")`; clean-state seed produced courtSide=`either`. Browser click-through → human. |
| 2 | Login + session persists across reload; logout from any page | ✓ VERIFIED | login-form.tsx `authClient.signIn.email`; dashboard reads live session via `requireUser()` (RSC); Nav mounted in layout shows LogoutButton (`authClient.signOut`) on every page. Runtime cookie persistence + click → human. |
| 3 | Player opens profile, edits courtSide/phone/skillLevel, changes save and display | ✓ VERIFIED | /profile RSC `getProfile`; `updateProfileAction` (requireUser → parseProfileForm → updateProfile → revalidatePath); integration script (per SUMMARY) + 16 passing unit assertions; `updateProfile` mutates only the 3 fields scoped to guard userId. Visual save → human. |
| 4 | After idempotent seed from env, exactly one role `admin`; re-run no duplicate | ✓ VERIFIED | Ran seed: clean-state → `Created admin … role "admin"`; re-run → `Admin already exists … skipping`; DB query admin_count=1, courtSide=either; password in Account (scrypt), not on User. |
| 5 | requireAdmin rejects non-admin on direct call (not just hidden UI); requireUser rejects anon | ✓ VERIFIED | auth-guards.ts: requireUser throws "Unauthorized" when no session/banned; requireAdmin throws "Forbidden" unless `role === "admin"` (+ban check); identity solely from `auth.api.getSession`. adminPing first line `await requireAdmin()`. Proven w/ signed cookies in 01-02 SUMMARY. |
| 6 | Credentials/secrets do not leak to client payload | ✓ VERIFIED | User schema has NO password column (confirmed `user_has_password_field: false`); password in Account; services use explicit `safeProfileSelect` (no credential fields); `.env` gitignored + not tracked; `.env.example` placeholders only. |

**Score:** 6/6 truths verified (functional substance proven; browser-visual confirmation deferred to human)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prisma/schema.prisma` | BA tables + User domain fields | ✓ VERIFIED | User/Session/Account/Verification; User has name/role(default player)/courtSide(default either)/phone?/skillLevel?/banned; no passwordHash; `prisma validate` passes |
| `prisma/seed.ts` | Idempotent env admin seed | ✓ VERIFIED | findUnique guard → signUpEmail → update role admin; proven idempotent at runtime |
| `src/lib/db.ts` | Prisma singleton | ✓ VERIFIED | globalThis-guarded (per 01-01); imported by auth.ts, profile action/page |
| `src/lib/auth.ts` | BA server (prismaAdapter sqlite + emailAndPassword + admin + nextCookies last) | ✓ VERIFIED | Matches plan; nextCookies() last; additionalFields phone/skillLevel (not courtSide) |
| `src/lib/auth-client.ts` | BA React client w/ adminClient | ✓ VERIFIED | createAuthClient([adminClient()]) |
| `src/lib/auth-guards.ts` | requireUser/requireAdmin/getOptionalSession | ✓ VERIFIED | All three exported; ban-aware; session-only identity |
| `src/lib/services/profile.ts` | getProfile/updateProfile safe-select | ✓ VERIFIED | safeProfileSelect, no credential columns, userId-scoped update |
| `src/lib/validation/profile.ts` | profileSchema + parseProfileForm | ✓ VERIFIED | courtSide enum, optional phone/skillLevel; shared parse helper (WR-04 addressed) |
| `src/app/api/auth/[...all]/route.ts` | toNextJsHandler GET/POST | ✓ VERIFIED | Exports GET/POST via toNextJsHandler(auth) |
| `(auth)/register`, `(auth)/login` | Forms wired to authClient | ✓ VERIFIED | signUp.email / signIn.email; Zod-validated; no courtSide field |
| `(app)/dashboard/page.tsx` | RSC reads session, shows name | ✓ VERIFIED | Uses requireUser() (WR-02 addressed); renders user.name |
| `(app)/profile/*` | View + edit + guarded action | ✓ VERIFIED | requireUser-guarded action, revalidatePath, ownership-scoped |
| `(app)/admin/{page,actions}.ts` | Guarded admin surface | ✓ VERIFIED | requireAdmin first line; minimal scaffold (intentional per plan) |

### Key Link Verification

| From | To | Via | Status |
|------|-----|-----|--------|
| auth.ts | db.ts | prismaAdapter(prisma, sqlite) | ✓ WIRED |
| api/auth route | auth.ts | toNextJsHandler(auth) | ✓ WIRED |
| register-form | auth-client | authClient.signUp.email | ✓ WIRED |
| login-form | auth-client | authClient.signIn.email | ✓ WIRED |
| nav/dashboard | auth-guards/auth | getOptionalSession / requireUser | ✓ WIRED |
| seed.ts | auth.ts | auth.api.signUpEmail | ✓ WIRED (runtime-proven) |
| admin/actions | auth-guards | requireAdmin() | ✓ WIRED |
| profile/actions | auth-guards + service | requireUser() + updateProfile | ✓ WIRED |
| profile/page | service | getProfile(prisma, user.id) | ✓ WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Type safety | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Production build | `npm run build` | Compiled OK, 9/9 pages, all 8 routes present | ✓ PASS |
| Schema validity | `npx prisma validate` | valid | ✓ PASS |
| Profile validation | `npx tsx src/lib/validation/profile.test.ts` | 16/16 assertions passed | ✓ PASS |
| Seed creation | `npx prisma db seed` (clean) | Created admin, role admin, courtSide either, password in Account | ✓ PASS |
| Seed idempotency | `npx prisma db seed` (re-run) | Skipped, admin_count=1 | ✓ PASS |
| Migration applied | ls prisma/migrations | `20260606124009_init_auth` + dev.db present | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AUTH-01 | 01-01 | Register by email/password | ✓ SATISFIED | register-form → signUp.email; auto sign-in |
| AUTH-02 | 01-01 | Login + session persists | ✓ SATISFIED | login-form → signIn.email; RSC live-session read |
| AUTH-03 | 01-01 | Logout from any page | ✓ SATISFIED | Nav (layout-mounted) LogoutButton → signOut |
| AUTH-04 | 01-02 | Idempotent env admin seed | ✓ SATISFIED | Runtime-proven: create + idempotent re-run, 1 admin |
| AUTH-05 | 01-02 | Server-side role guard on actions | ✓ SATISFIED | requireAdmin first line of adminPing; session-only role |
| PLAYER-01 | 01-01 | Signup name + optional phone/skill; courtSide NOT asked, default either | ✓ SATISFIED | Form fields + schema default; courtSide absent from form |
| PLAYER-03 | 01-03 | Edit own profile (courtSide/phone/skill) | ✓ SATISFIED | Guarded action, ownership-scoped, validated, persisted |

All 7 declared requirement IDs map to REQUIREMENTS.md and are covered. No orphaned requirements for Phase 1 (PLAYER-02 correctly deferred to Phase 3 in REQUIREMENTS.md).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER in src or seed | — | Clean |

admin/page.tsx + adminPing are an intentional minimal scaffold (AUTH-05 proof surface) documented in the plan/SUMMARY; the guard itself is real and enforced — not a stub blocking the goal.

### Code Review Cross-Check

01-REVIEW.md flagged 4 warnings (no blockers). Verified against current source — all addressed: WR-01 (narrowed catch in profile/admin/dashboard pages — present), WR-02 (dashboard now uses requireUser — present), WR-03 (guards now reject banned users via isBanned — present), WR-04 (shared parseProfileForm helper — present).

### Human Verification Required

Five browser-only flows (registration click-through, session persistence across reload, logout from nav, profile edit save+reload, admin page redirect). All have programmatic/backend equivalents proven (build, tsc, unit tests, seed runtime, signed-cookie guard proof in 01-02), but the visual/interactive confirmation is browser-only. See frontmatter `human_verification`.

### Gaps Summary

No functional gaps. The locked stack runs (`npm run build` green, kysely pinned to 0.28.17 via override resolving the prior Turbopack issue), schema + idempotent admin seed + ban-aware role guards + register/login/logout + profile view/edit are all present, wired, and behaviorally proven. Status is `human_needed` solely because the phase ships interactive browser flows whose visual confirmation cannot be automated (per phase context, these are classified human_needed, not gaps). Out-of-scope items (scale/perf/caching, email verification) are correctly excluded.

---

_Verified: 2026-06-06_
_Verifier: Claude (gsd-verifier)_
