---
phase: 01-foundation-auth
plan: 01
subsystem: auth
tags: [next.js, prisma, sqlite, better-auth, tailwind, zod, app-router, server-components]

# Dependency graph
requires: []
provides:
  - "Next.js 16 App Router (TS, src/, Tailwind 4) scaffolded on npm"
  - "Prisma 6 + SQLite singleton (src/lib/db.ts) + applied init_auth migration"
  - "Better Auth server (src/lib/auth.ts) + client (src/lib/auth-client.ts) + catch-all route"
  - "User domain schema: role(player), courtSide(either), phone?, skillLevel? on Better-Auth User"
  - "Working register/login/logout + session-gated dashboard slice (walking skeleton)"
  - "Zod auth validation schemas (src/lib/validation/auth.ts)"
affects: [02-admin-seed-profile, 03-registration-pairs, 04-bracket, 05-results, tournaments, auth-guards]

# Tech tracking
tech-stack:
  added:
    - "next@16.2.7, react@19.2.4 (create-next-app)"
    - "prisma@6.19.3, @prisma/client@6.19.3 (sqlite)"
    - "better-auth@1.6.14 (prismaAdapter, admin(), nextCookies())"
    - "zod@4.4.3"
    - "tsx@4 (dev, for plan-02 seed), dotenv@17 (dev, prisma.config.ts)"
  patterns:
    - "Prisma global singleton guarded on globalThis"
    - "Better Auth owns auth tables + password (Account/scrypt); domain fields added onto generated User"
    - "Server Components read session via auth.api.getSession({ headers }); client leaves for interactivity"
    - "Route groups (auth)/(app); catch-all /api/auth/[...all]"
    - "String enums (role/courtSide/skillLevel) + Zod unions, not native Prisma enums"

key-files:
  created:
    - "src/lib/db.ts"
    - "src/lib/auth.ts"
    - "src/lib/auth-client.ts"
    - "src/lib/validation/auth.ts"
    - "src/app/api/auth/[...all]/route.ts"
    - "prisma/schema.prisma"
    - "prisma/migrations/20260606124009_init_auth/migration.sql"
    - "src/app/(auth)/register/page.tsx + register-form.tsx"
    - "src/app/(auth)/login/page.tsx + login-form.tsx"
    - "src/components/nav.tsx + logout-button.tsx"
    - "src/app/(app)/dashboard/page.tsx"
    - ".env.example, prisma.config.ts"
  modified:
    - "src/app/layout.tsx (mount Nav)"
    - "src/app/page.tsx, src/app/globals.css (landing + Tailwind 4 CSS-first)"
    - "next.config.ts (serverExternalPackages)"
    - ".gitignore (dev.db*, .env, generated client)"
    - "package.json (deps + prisma.seed hook)"

key-decisions:
  - "Scaffolded via temp subdir then merged (create-next-app refuses non-empty dir even with --yes)"
  - "Prisma classic prisma-client-js generator (not the 6.19 default prisma-client + generated-output) for the simplest import-from-@prisma/client path per STACK.md"
  - "Seed hook lives in prisma.config.ts (Prisma 6.19 overrides package.json#prisma)"
  - "admin({ defaultRole: 'player' }) so signups get role='player'; courtSide via DB default 'either' (not collected at signup)"
  - "Nav is a Server Component reading getSession; Logout is a client leaf (avoids SSR useSession hook crash)"
  - "Removed next/font/google (Geist) from layout — offline-demo safety, no network font fetch"

patterns-established:
  - "Auth: betterAuth(prismaAdapter sqlite, emailAndPassword, admin(), nextCookies() last)"
  - "Identity derived from signed session cookie only — never from client props/form"
  - "Domain enums as String + Zod; password never on User (Account table)"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, PLAYER-01]

# Metrics
duration: 38min
completed: 2026-06-06
---

# Phase 1 Plan 01: Walking Skeleton (Foundation & Auth) Summary

**Next.js 16 + Prisma 6/SQLite + Better Auth 1.6 walking skeleton: register → auto sign-in → session-gated dashboard → logout, proven end-to-end through one real DB write and one real DB read.**

## Performance

- **Duration:** ~38 min
- **Started:** 2026-06-06T12:06Z
- **Completed:** 2026-06-06T12:46Z
- **Tasks:** 5 (3 auto + 2 checkpoints auto-handled in AUTO_MODE)
- **Files modified:** ~33

## Accomplishments
- Full locked stack scaffolded on npm: Next 16.2.7 (App Router, TS, src/), Tailwind 4 (CSS-first), Prisma 6.19.3 + SQLite, Better Auth 1.6.14, Zod 4.
- Better Auth wired front-to-back: prismaAdapter(sqlite) + emailAndPassword + admin() + nextCookies(); catch-all `/api/auth/[...all]`; React client.
- `init_auth` migration applied — User/Session/Account/Verification tables created with domain fields (role default `player`, courtSide default `either`, phone?, skillLevel?); no passwordHash column.
- Register/login forms (Zod-validated, client leaves), Server-Component dashboard reading the live session, nav with logout reachable on every page.
- Verified end-to-end against the running app + Better Auth API: signup wrote a User (role `player`, courtSide `either`, phone/skillLevel persisted, password hashed in `account`), session persisted, dashboard gated (307 anon / 200 authed), logout + re-login worked.

## Task Commits

1. **Task 1: Scaffold stack on npm** - `454abc9` (chore)
2. **Task 2: Better Auth server/client + User schema + route + Zod** - `11ef9bc` (feat)
3. **Task 3: [BLOCKING] prisma migrate dev --name init_auth** - `0e78d39` (feat)
4. **Task 4: Register/login/logout + dashboard slice** - `31ef1e0` (feat)
5. **Task 5: Human-verify checkpoint** - auto-handled (AUTO_MODE), no code

**Plan metadata:** (final docs commit — this SUMMARY + STATE + ROADMAP)

## Files Created/Modified
See frontmatter `key-files`. Highlights:
- `src/lib/auth.ts` / `auth-client.ts` - Better Auth server + browser client
- `prisma/schema.prisma` + `migrations/*init_auth*` - auth tables + domain fields
- `src/lib/db.ts` - Prisma singleton (globalThis guard)
- `src/app/(auth)/*`, `src/app/(app)/dashboard/page.tsx`, `src/components/nav.tsx` + `logout-button.tsx` - the auth slice
- `.env` (gitignored) / `.env.example` - DATABASE_URL, BETTER_AUTH_SECRET/URL, ADMIN_EMAIL/PASSWORD

## Decisions Made
- **Scaffold via temp subdir + merge:** `create-next-app` refuses a non-empty directory even with `--yes`; scaffolded into `scaffold-tmp/` then moved files into the repo root and merged `.gitignore`.
- **Classic Prisma generator:** Prisma 6.19 `init` now defaults to `prisma-client` + generated-output + `prisma.config.ts`. Switched the generator to `prisma-client-js` (import from `@prisma/client`) for the simplest path per STACK.md; kept `prisma.config.ts` (loads `.env` via dotenv) and moved the seed hook there.
- **Roles:** `admin({ defaultRole: "player" })` so new signups persist `role="player"`; courtSide relies on the DB column default `"either"` and is never collected at signup (PLAYER-01).
- **Nav split:** Better Auth's `useSession()` hook crashed during SSR of the layout-mounted nav ("Invalid hook call / useRef null"). Refactored the nav to a Server Component reading `auth.api.getSession`, with logout as a tiny client leaf — the plan explicitly sanctioned passing session from the layout.
- **No Google fonts:** dropped the scaffold's `next/font/google` (Geist) to keep the offline demo network-free.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prisma 6.19 generator/config defaults vs the plan's simple path**
- **Found during:** Task 1
- **Issue:** `prisma init` emitted `prisma-client` generator + `prisma.config.ts` importing `dotenv/config` (not installed); plan/STACK.md want `prisma-client-js` import-from-`@prisma/client`.
- **Fix:** Set generator to `prisma-client-js`; installed `dotenv` (dev); kept `prisma.config.ts` for `.env` loading.
- **Files modified:** prisma/schema.prisma, prisma.config.ts, package.json
- **Verification:** `prisma generate` + `prisma migrate dev` succeed; `@prisma/client` import works.
- **Committed in:** `454abc9` / `11ef9bc`

**2. [Rule 3 - Blocking] Better Auth CLI generate needed an existing Prisma client**
- **Found during:** Task 2
- **Issue:** `@better-auth/cli generate` imports `auth.ts` → `db.ts` → `@prisma/client`, which wasn't generated yet.
- **Fix:** Ran `npx prisma generate` first, then re-ran the Better Auth generate.
- **Verification:** Schema overwritten with User/Session/Account/Verification + plugin fields.
- **Committed in:** `11ef9bc`

**3. [Rule 3 - Blocking] Prisma 6.19 seed hook moved to prisma.config.ts**
- **Found during:** Task 2/3
- **Issue:** Prisma 6.19 warns that `prisma.config.ts` overrides the `package.json#prisma` seed property, so the plan-02 seed hook would be ignored.
- **Fix:** Added `migrations.seed: "tsx prisma/seed.ts"` to `prisma.config.ts` (kept the package.json hook too).
- **Committed in:** `11ef9bc`

**4. [Rule 1 - Bug] Nav `useSession()` SSR crash**
- **Found during:** Task 4
- **Issue:** Client `authClient.useSession()` in the layout-mounted Nav threw "Invalid hook call / Cannot read properties of null (reading 'useRef')" → every route 500.
- **Fix:** Made Nav a Server Component reading `auth.api.getSession`; extracted `LogoutButton` as the only client leaf.
- **Files modified:** src/components/nav.tsx, src/components/logout-button.tsx
- **Verification:** All routes 200/307; tsc clean; logout works via API.
- **Committed in:** `31ef1e0`

---

**Total deviations:** 4 auto-fixed (3 blocking, 1 bug)
**Impact on plan:** All necessary for correctness/runtime. No scope creep — same files/architecture the plan specified.

## Issues Encountered

- **`next build` (Turbopack) fails on better-auth's kysely-adapter** — upstream version mismatch: `@better-auth/kysely-adapter@1.6.14` statically imports `DEFAULT_MIGRATION_TABLE` from `kysely@0.29.2`, which no longer exports it. Better Auth imports the kysely adapter in `context/init` regardless of using the Prisma adapter, so Turbopack's static export tracing trips. Three config attempts (`serverExternalPackages` with various entries) did not satisfy the externals-tracer; hit the per-task fix limit. **This does NOT affect `npm run dev`** (the documented run target per CONTEXT.md), which works fully end-to-end. See Deferred Issues.

## Deferred Issues

- **Production build (`next build`) blocked by better-auth ↔ kysely static-export mismatch.** Follow-ups for a later plan: (a) pin/upgrade `kysely`/`better-auth` once the export is restored upstream, (b) try the webpack builder (`next build --webpack`) or a bundler ignore/alias for `@better-auth/kysely-adapter`, or (c) wrap the auth import so the kysely path is dynamically required. Not required for the thesis demo, which runs via `npm run dev`.

## Human Verification Deferred (AUTO_MODE)

AUTO_MODE active — the agent cannot drive a browser, so Task 3 and Task 5 human-verify checkpoints were auto-approved after running all automatable checks. Equivalent verification performed programmatically:
- Migration created (`prisma/migrations/20260606124009_init_auth`), `dev.db` present, `prisma validate` passes; tables confirmed via sqlite3 (`user/session/account/verification`).
- Registered `player1@padel.local` via `/api/auth/sign-up/email` → 200, auto-session issued; `/api/auth/get-session` returns the user; `/dashboard` → 200 with cookie, 307 without.
- DB row: `role=player`, `courtSide=either`, phone/skillLevel persisted; password in `account` (credential/scrypt); no `passwordHash` column on `user`.
- Sign-out + re-login (`/api/auth/sign-in/email`) → 200, dashboard accessible again.
- Test rows deleted afterward so `dev.db` ships empty.

Remaining purely-visual checks a human may still want to eyeball: form styling/layout, Prisma Studio inspection, and clicking Logout from a non-dashboard page in a real browser. No functional gaps expected.

## Next Phase Readiness
- Schema, Prisma singleton, Better Auth, route groups, and the Server-Component-reads pattern are in place — Plan 02 (admin seed + auth-guards + profile) can build directly on `auth.api.getSession` and the `User` model.
- `ADMIN_EMAIL`/`ADMIN_PASSWORD` already reserved in `.env`/`.env.example`; `prisma.config.ts` seed hook wired (seed.ts authored in plan 02).
- **Concern:** resolve the `next build` kysely issue before any deployment-style verification; dev workflow is unaffected.

## Self-Check: PASSED

All 15 key files + the `init_auth` migration directory exist on disk; all 4 task commits (`454abc9`, `11ef9bc`, `0e78d39`, `31ef1e0`) are present in git history.
