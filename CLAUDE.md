<!-- GSD:project-start source:PROJECT.md -->

## Project

**Padel Tournaments**

Веб-приложение для организации турниров по паделу. Падел — командный спорт: за одну команду играют два игрока (пара). Платформа делается для одной конкретной организации, которая выступает администратором: только она создаёт турниры. Игроки регистрируются, участвуют парами, смотрят информацию о турнире и турнирную сетку.

Дипломная работа — не продакшн, реальной нагрузки не будет. Приоритет: простое работающее приложение, сделанное быстро, без усложнений и преждевременной оптимизации.

**Core Value:** Организация может создать playoff-турнир для пар, игроки регистрируются в него парами, и все могут видеть турнирную сетку с результатами по мере продвижения.

### Constraints

- **Tech stack**: Next.js 16 (TypeScript, App Router) full-stack — Server Components (чтение) + Server Actions (запись), Prisma 6.x (≥6.2), SQLite — Один язык и один репозиторий, быстрый старт, удобный рендер сетки на фронте; выбрано в questioning
- **Auth-библиотека**: Better Auth `^1.6` (email+password, `admin()` plugin для роли, Prisma-адаптер, SQLite, Node runtime) — Живая поддерживаемая библиотека (research/AUTH.md); email-верификация выключена для офлайн-демо
- **Bracket**: только 4 / 8 / 16 пар (степень двойки) — Упрощает генерацию сетки, исключает bye-логику
- **Auth**: единственный админ — предзаданный seed-аккаунт с ролью `admin` (создаётся идемпотентно из env) — Организация одна, регистрация админов не нужна
- **Scope**: дипломная работа — Делать просто и быстро, без преждевременной оптимизации и лишних фич

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

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

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| pnpm | Package manager | Fast, disk-efficient, strict. npm is an acceptable fallback if the grader's machine lacks pnpm — pick one and document it. |
| Prisma Studio | DB inspection GUI | `pnpm prisma studio` — useful for demoing data during defense. |
| `prisma migrate dev` | Schema migrations | Generates + applies migrations from `schema.prisma`. |
| `prisma db seed` | Seed admin account | Configured via `package.json` `prisma.seed`. |
| ESLint | Linting | Comes with `create-next-app`; leave defaults. |

## Installation

# Scaffold (App Router + TS + Tailwind + ESLint)

# ORM (pin to v6)

# Auth + validation

# tsx for running the TS seed script

## Key Decisions (Rationale)

### 1. App Router vs Pages Router → **App Router**

- **Reads** (tournament page, bracket) are React Server Components that query Prisma directly — no API endpoint, no client fetch, no loading state.
- **Writes** (create tournament, register pair, enter score) are **Server Actions** — a function with `"use server"` called straight from a `<form action={...}>`. No REST route, no fetch wiring.
- Layouts, `loading.tsx`, and route protection are first-class.

### 2. Auth → **Hand-rolled cookie session** (recommend), Auth.js as fallback

| Approach | Verdict for this thesis |
|----------|-------------------------|
| **Hand-rolled cookie session** (`iron-session` or `jose` JWT cookie) | **RECOMMENDED.** ~50 lines: register → bcrypt hash → store user; login → compare → set encrypted cookie with `{userId, role}`; read cookie in Server Components / Server Actions for auth + admin checks. No beta dependency, full control, trivial to explain in a thesis defense. |
| **Auth.js (NextAuth) v5** | Workable but **still beta** (`5.0.0-beta.31` as of June 2026) and the Credentials provider forces real friction: you must **split config** so middleware runs on the Edge runtime (no Node `crypto`/bcrypt) while the actual sign-in runs in Node. That edge/node split is a well-known footgun and pure overhead for a single-admin demo. |
| **Lucia** | **DO NOT USE.** Lucia v3 was **deprecated (March 2025)**; the maintainer's official guidance is "implement sessions yourself." It is now a *learning resource*, not a library. |

### 3. Password hashing → **bcryptjs** over argon2

### 4. Validation → **Zod 4**

### 5. Data fetching → **Server Components (reads) + Server Actions (writes)**

- Bracket/tournament pages: `async` Server Component → `prisma.tournament.findUnique(...)`.
- Create tournament / register pair / enter score: Server Action → validate (Zod) → mutate (Prisma) → `revalidatePath()` so the bracket re-renders.

### 6. UI → **Tailwind CSS 4, no component library**

### 7. Tooling → **pnpm**, default tsconfig, `next dev`

## Prisma + SQLite Workflow (concrete)

### SQLite Gotchas (verified)

| Gotcha | Reality | Mitigation |
|--------|---------|------------|
| **Enums** | SQLite has **no native enum type**. Prisma 6 *does* let you declare `enum` in schema and emulates it (stored as TEXT, validated at client level). | Fine to use `enum Role`. If any tooling complains, fall back to a `String` field with app-level validation (Zod) — equally simple. |
| **Concurrent writes** | SQLite serializes writes (single-writer lock); concurrent write bursts can hit `SQLITE_BUSY`. | Irrelevant for a thesis demo (one admin, low traffic). No action needed. Do not add connection pooling or WAL tuning — over-engineering. |
| **Single Prisma instance in dev** | Next.js hot-reload can spawn many PrismaClient instances → "too many connections"/file lock warnings. | Use the standard global-singleton pattern for `PrismaClient` in `lib/prisma.ts`. |
| **DB file in repo** | `dev.db` shouldn't be committed. | Add `*.db` / `dev.db*` to `.gitignore`; provide seed + migrations so graders recreate it. |

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

- Use Auth.js v5 (`next-auth@beta`) Credentials provider.
- Keep all auth in the Node runtime; do not protect routes via Edge middleware.
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

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
