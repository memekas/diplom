---
phase: 01-foundation-auth
plan: 02
subsystem: auth
tags: [better-auth, prisma, sqlite, server-actions, rbac, seed, security]

# Dependency graph
requires:
  - "01-01: Better Auth server (src/lib/auth.ts), Prisma singleton (src/lib/db.ts), User.role"
provides:
  - "Server-side auth guards requireUser()/requireAdmin() (src/lib/auth-guards.ts)"
  - "Idempotent env-based admin seed (prisma/seed.ts) creating exactly one role 'admin'"
  - "Guarded admin Server Action adminPing() + guarded /admin route (AUTH-05 proof)"
affects: [03-registration-pairs, 04-bracket, 05-results, tournaments]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Every Server Action / protected RSC opens with requireUser()/requireAdmin() — identity from session cookie only"
    - "Idempotent seed: existence-check (findUnique) -> auth.api.signUpEmail -> prisma.user.update role 'admin'"
    - "Admin = session.user.role === 'admin', read server-side; client role/id never trusted (Pitfall 8)"

key-files:
  created:
    - "src/lib/auth-guards.ts"
    - "prisma/seed.ts"
    - "src/app/(app)/admin/page.tsx"
    - "src/app/(app)/admin/actions.ts"
  modified: []

key-decisions:
  - "Dropped planned `import 'server-only'` from auth-guards.ts — package not installed; next/headers already makes the module server-only by construction and no client path imports it (avoids an unrequested new dep)"
  - "No .env/.env.example edits needed — ADMIN_EMAIL/ADMIN_PASSWORD were already documented (placeholders) and set (local) in 01-01"
  - "Admin page converts guard throw to redirect('/login') for UX; the guard remains the source of truth"

requirements-completed: [AUTH-04, AUTH-05]

# Metrics
duration: 3min
completed: 2026-06-06
---

# Phase 1 Plan 02: Auth Guards + Admin Seed Summary

**Server-side `requireUser`/`requireAdmin` guards (identity from the signed session cookie, never the client) plus an idempotent env-based admin seed, proven by a guarded `adminPing` Server Action that rejects anonymous and non-admin callers on direct invocation.**

## Performance
- **Duration:** ~3 min
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint auto-handled in AUTO_MODE)
- **Files created:** 4

## Accomplishments
- `src/lib/auth-guards.ts`: `requireUser()` (throws `Unauthorized` when anon) and `requireAdmin()` (throws `Forbidden` unless `session.user.role === "admin"`), both deriving identity solely from `auth.api.getSession({ headers: await headers() })`.
- `prisma/seed.ts`: reads `ADMIN_EMAIL`/`ADMIN_PASSWORD` (throws if missing), existence-guarded via `findUnique`; creates the admin through `auth.api.signUpEmail` (scrypt-hashed password) then promotes `role: "admin"`. Re-run is a logged no-op.
- `src/app/(app)/admin/actions.ts`: `adminPing()` whose first line is `await requireAdmin()` — the AUTH-05 direct-call security proof.
- `src/app/(app)/admin/page.tsx`: server-guarded admin landing (requireAdmin → redirect on failure).

## Task Commits
1. **Task 1: Server-side guards requireUser/requireAdmin** — `3d0b0ba` (feat)
2. **Task 2: Idempotent admin seed + guarded admin action** — `3210c1a` (feat)
3. **Task 3: Human-verify checkpoint** — auto-handled (AUTO_MODE), no code

## Verification Output

**Seed idempotency (run twice):**
```
[seed] Created admin admin@padel.local with role "admin".      # run 1
[seed] Admin already exists (admin@padel.local, role=admin) — skipping.   # run 2
```
DB after two runs — exactly one admin:
```
SELECT email,role FROM user;            -> admin@padel.local|admin
SELECT COUNT(*) ... role='admin';       -> 1
```

**Guard direct-invocation proof** (real signed cookies, guards called directly — the path a forged POST to a Server Action takes):
```
anon   -> requireUser: Unauthorized | requireAdmin: Forbidden
player -> requireUser: ok:player     | requireAdmin: Forbidden
admin  -> requireAdmin: ok:admin
```
This proves AUTH-05: rejection is server-side at the guard, not UI hiding. Non-admin/anon callers are rejected even when invoking the action directly. (Proof player row deleted after the run; only the admin remains.)

**Typecheck / build:**
- `npx tsc --noEmit` — PASS
- `npx next build` — PASS (compiled, TypeScript checked, 8/8 static pages; `/admin` route present). Note: the 01-01 SUMMARY flagged a kysely/better-auth `next build` blocker; it did not reproduce here — both `dev` and `build` are green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `server-only` import dropped from auth-guards.ts**
- **Found during:** Task 1
- **Issue:** Plan-style hardening used `import "server-only"`, but the package is not installed; importing it fails typecheck/build.
- **Fix:** Removed the import. The module already imports `next/headers` (server-only by construction) and is imported only by Server Components/Actions, so the server boundary is preserved without adding an unrequested dependency.
- **Files modified:** src/lib/auth-guards.ts
- **Committed in:** `3d0b0ba`

**2. [Note — not a deviation] No `.env` / `.env.example` changes**
- Plan listed `.env`/`.env.example` under files. 01-01 already documented `ADMIN_EMAIL`/`ADMIN_PASSWORD` placeholders in `.env.example` and set local values in `.env` (gitignored). No edit was required; no credentials committed.

**Total deviations:** 1 auto-fixed (blocking). No scope creep.

## Human Verification Deferred (AUTO_MODE)
AUTO_MODE active — the Task 3 browser-only steps were auto-approved after running all automatable equivalents:
- Seed run twice + DB query (idempotency, exactly one admin) — done programmatically (above).
- Guard rejection for anon + non-admin + admin via real signed session cookies — done (above).
- `tsc`/`build` — done.

Remaining purely-visual checks a human may still want to eyeball in a real browser:
- Visit `/admin` while signed in as a non-admin player → expect redirect to `/login`.
- Visit `/admin` as the admin → expect the admin placeholder to render.
- Inspect the single admin row in `npx prisma studio`.
No functional gaps expected — the programmatic proofs cover the same authorization paths.

## Known Stubs
- `adminPing()` and the `/admin` page are intentional minimal placeholders proving the guard boundary; later phases (04 bracket, 05 results) replace them with real admin mutations, each opening with `requireAdmin()`. Documented as intentional per the plan.

## Next Phase Readiness
- `requireUser`/`requireAdmin` are the reusable authorization spine — every future mutation gates on them as its first line.
- A deterministic single admin exists from env; graders recreate it with `npx prisma db seed`.

## Self-Check: PASSED
All 4 created files exist on disk; both task commits (`3d0b0ba`, `3210c1a`) are present in git history.
