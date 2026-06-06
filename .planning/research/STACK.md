# Stack Research

**Domain:** Padel tournament organization web app (small CRUD + playoff bracket, thesis-grade)
**Researched:** 2026-06-06
**Confidence:** HIGH (core versions verified against npm + official docs; auth recommendation MEDIUM — opinionated tradeoff)

> The stack is pre-decided: Next.js (TypeScript) full-stack + Prisma + SQLite, single repo.
> This document is a prescriptive recipe *within* that stack, tuned for **simplicity and speed**, not extensibility or production hardening.

## TL;DR Recommendations

| Decision | Recommendation | Confidence |
|----------|----------------|------------|
| Router | **App Router** (Next.js 16) | HIGH |
| Next.js version | **16.x** (current stable 16.2.7) | HIGH |
| Auth | **Hand-rolled cookie session** (iron-session or signed JWT cookie) — NOT Auth.js, NOT Lucia | MEDIUM |
| Password hash | **bcryptjs** (pure JS, zero native build) | HIGH |
| ORM | **Prisma 6.x** (NOT Prisma 7 — see rationale) | MEDIUM |
| DB | **SQLite** via local file | HIGH |
| Validation | **Zod 4** | HIGH |
| Data fetching / mutations | **Server Components for reads + Server Actions for writes** | HIGH |
| UI | **Tailwind CSS 4** + plain JSX (no component library) | HIGH |
| Package manager | **pnpm** | MEDIUM |

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.2.x (latest stable; 15.x also fine) | Full-stack React framework, routing, server actions | Single language/repo, server-rendered bracket page, built-in mutations via Server Actions — no separate API layer needed. Use **App Router** (see below). |
| React | 19.x | UI | Bundled with Next 16; nothing to decide. |
| TypeScript | 5.x | Type safety | Standard with `create-next-app`. |
| Prisma ORM | **6.x** (`prisma`, `@prisma/client`) | Type-safe DB access + migrations + seeding | Simplest workflow. **Avoid Prisma 7** for a thesis — see "What NOT to Use". |
| SQLite | file-based (`file:./dev.db`) | Database | Zero setup, single file, perfect for a demo with no real load. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 4.4.x | Form / input validation, parsing Server Action FormData | Validate tournament creation (4/8/16), registration, score entry. |
| bcryptjs | 3.0.x | Password hashing | Hash on register, compare on login. Pure JS — no node-gyp, works everywhere. |
| iron-session | 8.x | Encrypted stateless cookie session | Simplest persistent session without a session table. (Alternative: `jose` for a signed JWT cookie.) |
| tailwindcss | 4.x + `@tailwindcss/postcss` | Styling | CSS-first config, auto content detection, no `tailwind.config.js` needed. |
| @prisma/client | matches `prisma` (6.x) | Generated query client | Auto-installed with Prisma. |

> Bracket rendering needs **no library** — a fixed 4/8/16 playoff is a static tree. Render rounds as flex/grid columns with Tailwind. Adding `react-brackets` or similar is over-engineering for this scope.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| pnpm | Package manager | Fast, disk-efficient, strict. npm is an acceptable fallback if the grader's machine lacks pnpm — pick one and document it. |
| Prisma Studio | DB inspection GUI | `pnpm prisma studio` — useful for demoing data during defense. |
| `prisma migrate dev` | Schema migrations | Generates + applies migrations from `schema.prisma`. |
| `prisma db seed` | Seed admin account | Configured via `package.json` `prisma.seed`. |
| ESLint | Linting | Comes with `create-next-app`; leave defaults. |

## Installation

```bash
# Scaffold (App Router + TS + Tailwind + ESLint)
pnpm create next-app@latest padel --ts --app --tailwind --eslint --src-dir --import-alias "@/*"
cd padel

# ORM (pin to v6)
pnpm add prisma@6 @prisma/client@6
pnpm prisma init --datasource-provider sqlite

# Auth + validation
pnpm add bcryptjs iron-session zod
pnpm add -D @types/bcryptjs

# tsx for running the TS seed script
pnpm add -D tsx
```

`package.json` seed hook:
```json
{
  "prisma": { "seed": "tsx prisma/seed.ts" }
}
```

---

## Key Decisions (Rationale)

### 1. App Router vs Pages Router → **App Router**
**Confidence: HIGH.** App Router is the default and actively developed path in Next.js 15/16; Pages Router is in maintenance. For this app it is *simpler*, not harder:
- **Reads** (tournament page, bracket) are React Server Components that query Prisma directly — no API endpoint, no client fetch, no loading state.
- **Writes** (create tournament, register pair, enter score) are **Server Actions** — a function with `"use server"` called straight from a `<form action={...}>`. No REST route, no fetch wiring.
- Layouts, `loading.tsx`, and route protection are first-class.

Pages Router would force `getServerSideProps` + `/pages/api/*` handlers + client-side fetch — more files for the same result. Only choose Pages Router if you already know it well and time pressure trumps everything.

> Note: in Next 15/16, `params` and `searchParams` are **Promises** — `await` them in page components. Minor gotcha, not a blocker.

### 2. Auth → **Hand-rolled cookie session** (recommend), Auth.js as fallback
**Confidence: MEDIUM (opinionated).** Compared options:

| Approach | Verdict for this thesis |
|----------|-------------------------|
| **Hand-rolled cookie session** (`iron-session` or `jose` JWT cookie) | **RECOMMENDED.** ~50 lines: register → bcrypt hash → store user; login → compare → set encrypted cookie with `{userId, role}`; read cookie in Server Components / Server Actions for auth + admin checks. No beta dependency, full control, trivial to explain in a thesis defense. |
| **Auth.js (NextAuth) v5** | Workable but **still beta** (`5.0.0-beta.31` as of June 2026) and the Credentials provider forces real friction: you must **split config** so middleware runs on the Edge runtime (no Node `crypto`/bcrypt) while the actual sign-in runs in Node. That edge/node split is a well-known footgun and pure overhead for a single-admin demo. |
| **Lucia** | **DO NOT USE.** Lucia v3 was **deprecated (March 2025)**; the maintainer's official guidance is "implement sessions yourself." It is now a *learning resource*, not a library. |

The requirements are tiny: email+password, persistent session, one seeded `admin` role. A signed/encrypted cookie covers all three without a sessions table. This is also exactly what Lucia's author now recommends. If the grader specifically expects a named auth library, fall back to Auth.js v5 and accept the edge/node split boilerplate.

> Avoid the Edge runtime entirely: do **not** add NextAuth-style middleware auth. Do route protection inside Server Components / Server Actions (Node runtime) where bcrypt and cookies just work.

### 3. Password hashing → **bcryptjs** over argon2
**Confidence: HIGH.** argon2 is cryptographically stronger (memory-hard) but the `argon2` npm package needs a C compiler + node-gyp at install and breaks in Edge runtime. `bcryptjs` is pure JavaScript: no native build, no platform issues, works in Server Actions out of the box. For a thesis with no attacker model, bcryptjs's correctness and zero-friction install win. (If you want native speed and don't mind the build step, `@node-rs/argon2` is Next's auto-externalized option — but it's unnecessary here.)

### 4. Validation → **Zod 4**
**Confidence: HIGH.** Validate Server Action inputs by `schema.safeParse(Object.fromEntries(formData))`. Enforce the 4/8/16 constraint (`z.enum`/`z.union` of literals), email format, non-empty partner selection, and score shape. Return field errors to the form via `useActionState`.

### 5. Data fetching → **Server Components (reads) + Server Actions (writes)**
**Confidence: HIGH.** No standalone API routes needed for the app's own UI. Use a **Route Handler** (`app/api/.../route.ts`) only if you must expose an external/JSON endpoint — not required by current scope. Pattern:
- Bracket/tournament pages: `async` Server Component → `prisma.tournament.findUnique(...)`.
- Create tournament / register pair / enter score: Server Action → validate (Zod) → mutate (Prisma) → `revalidatePath()` so the bracket re-renders.

### 6. UI → **Tailwind CSS 4, no component library**
**Confidence: HIGH.** Tailwind 4 is CSS-first: import once in `globals.css` (`@import "tailwindcss";`), auto-detects content, no `tailwind.config.js`. The bracket is the only non-trivial layout — render each round as a column (`flex` of match cards), connect visually with borders/spacing. A component kit (shadcn/MUI/Chakra) adds setup and concepts for ~10 screens of forms and one bracket — not worth it. Plain Tailwind is the fastest path. Plain CSS would also work but Tailwind is already scaffolded and faster for iterating layout.

### 7. Tooling → **pnpm**, default tsconfig, `next dev`
**Confidence: MEDIUM.** pnpm is fast and standard; npm is a fine fallback (decide once, document for the grader). Keep the `create-next-app` `tsconfig.json` defaults (`strict: true`). Local run: `pnpm dev` (Turbopack dev is default/stable in 16). DB lives as a committed-ignored `dev.db` file.

---

## Prisma + SQLite Workflow (concrete)

```prisma
// schema.prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")   // "file:./dev.db"
}
generator client {
  provider = "prisma-client-js"    // v6 default — generates into node_modules, zero config
}

enum Role { admin player }          // see SQLite enum gotcha below
```

Workflow:
1. Edit `schema.prisma`.
2. `pnpm prisma migrate dev --name init` → creates + applies migration, regenerates client.
3. `pnpm prisma db seed` → runs `prisma/seed.ts` (bcrypt-hash a fixed admin password, `prisma.user.create({ data: { email, passwordHash, role: "admin" }})`, use `upsert` so re-seeding is idempotent).
4. `pnpm prisma studio` to inspect.

### SQLite Gotchas (verified)
| Gotcha | Reality | Mitigation |
|--------|---------|------------|
| **Enums** | SQLite has **no native enum type**. Prisma 6 *does* let you declare `enum` in schema and emulates it (stored as TEXT, validated at client level). | Fine to use `enum Role`. If any tooling complains, fall back to a `String` field with app-level validation (Zod) — equally simple. |
| **Concurrent writes** | SQLite serializes writes (single-writer lock); concurrent write bursts can hit `SQLITE_BUSY`. | Irrelevant for a thesis demo (one admin, low traffic). No action needed. Do not add connection pooling or WAL tuning — over-engineering. |
| **Single Prisma instance in dev** | Next.js hot-reload can spawn many PrismaClient instances → "too many connections"/file lock warnings. | Use the standard global-singleton pattern for `PrismaClient` in `lib/prisma.ts`. |
| **DB file in repo** | `dev.db` shouldn't be committed. | Add `*.db` / `dev.db*` to `.gitignore`; provide seed + migrations so graders recreate it. |

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| App Router | Pages Router | Only if you're far more fluent in Pages and deadline-bound. |
| Hand-rolled cookie session | Auth.js (NextAuth) v5 | If the thesis rubric *requires* a named auth library; accept the edge/node split boilerplate. |
| bcryptjs | argon2 / @node-rs/argon2 | If you want to *discuss* memory-hard hashing in the thesis and can afford the native build. |
| Prisma 6 | Prisma 7 | If you specifically want to showcase the newest ORM and don't mind driver-adapter setup. |
| Tailwind 4 | Plain CSS / CSS Modules | If you dislike utility classes; slower to iterate the bracket layout. |
| pnpm | npm / bun | Use whatever the grading machine reliably has. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Lucia** | Deprecated March 2025; author says roll your own. | Hand-rolled cookie session. |
| **Auth.js Edge middleware for protection** | Forces edge/node config split; bcrypt/crypto unavailable on Edge → classic footgun. | Check session in Server Components / Server Actions (Node runtime). |
| **Prisma 7** (for this thesis) | v7 makes **driver adapters mandatory** (`@prisma/adapter-better-sqlite3`), requires a **generated output path** (no more `@prisma/client` import), a **`prisma.config.ts`**, and `provider = "prisma-client"`. More moving parts, more version-pinning, more to explain — net complexity increase for zero benefit at this scale. | Prisma 6.x (`prisma-client-js`, generates to node_modules, import from `@prisma/client`). |
| **A bracket/charting library** | A fixed 4/8/16 single-elim tree is trivial static layout. | Tailwind flex/grid columns. |
| **A UI component kit (MUI/Chakra/shadcn)** | Setup + concepts disproportionate to ~10 form screens. | Plain Tailwind. |
| **argon2 (native)** | node-gyp build + Edge incompatibility for no security benefit at thesis scale. | bcryptjs. |
| **Connection pooling / WAL tuning / caching** | No real load; premature optimization, explicitly out of scope. | Default SQLite + Prisma singleton. |

## Stack Patterns by Variant

**If grader requires a named auth library:**
- Use Auth.js v5 (`next-auth@beta`) Credentials provider.
- Keep all auth in the Node runtime; do not protect routes via Edge middleware.

**If you want to use Prisma's newest version:**
- Prisma 7 + `@prisma/adapter-better-sqlite3` (pin `>=1.0.7` for correct enum behavior), add `prisma.config.ts`, set generator `output`, import client from the generated folder.
- Otherwise stay on Prisma 6 for the simplest path.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| next@16.x | react@19.x | Bundled together by `create-next-app`. |
| next@16.x | prisma@6.x, @prisma/client@6.x | No special integration; use Prisma singleton in dev. |
| next-auth@5.0.0-beta | next@14+ | Min Next 14; still **beta** — not recommended primary. |
| prisma@6.x | @prisma/client@6.x | **Must match major/minor.** |
| tailwindcss@4.x | next@16.x | Use `@tailwindcss/postcss`; no JS config file required. |
| bcryptjs@3.x | any runtime | Pure JS, no native deps. |
| zod@4.x | typescript@5.x | — |

## Sources

- npm registry (`npm view`) — verified current versions: next 16.2.7, prisma 7.8.0 (latest) / 6.x available, next-auth latest 4.24.14 + beta 5.0.0-beta.31, zod 4.4.3, bcryptjs 3.0.3, argon2 0.44.0, tailwindcss 4.3.0, lucia 3.2.2, react 19.2.7 — **HIGH**
- https://nextjs.org/blog/next-16 , https://nextjs.org/docs/app/guides/upgrading/version-16 — App Router default, Server Actions, async params — **HIGH**
- https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7 — Prisma 7 driver-adapter + generated-output + prisma.config.ts breaking changes — **HIGH**
- https://www.prisma.io/docs/orm/core-concepts/supported-databases/sqlite — SQLite connector behavior — **HIGH**
- https://github.com/lucia-auth/lucia/discussions/1714 , https://lucia-auth.com/lucia-v3/migrate — Lucia v3 deprecation (March 2025), "roll your own" guidance — **HIGH**
- https://authjs.dev/getting-started/migrating-to-v5 , https://authjs.dev/getting-started/providers/credentials — Auth.js v5 status + Credentials provider — **MEDIUM** (v5 still beta)
- https://nextjs.org/docs/messages/node-module-in-edge-runtime , https://github.com/vercel/next.js/discussions/62985 — Edge runtime crypto/native-module limits, NextAuth edge/node split footgun — **HIGH**
- https://www.pkgpulse.com/compare/argon2-vs-bcrypt — argon2 vs bcrypt tradeoffs — **MEDIUM**
- https://tailwindcss.com/docs/guides/nextjs — Tailwind 4 CSS-first, no config file — **HIGH**

---
*Stack research for: padel tournament thesis app (Next.js + Prisma + SQLite)*
*Researched: 2026-06-06*
