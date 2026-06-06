# Auth Library Research

**Domain:** Auth for Padel Tournaments thesis app — Next.js 16 App Router + Prisma 6 + SQLite, TypeScript
**Researched:** 2026-06-06
**Confidence:** HIGH (versions + capabilities verified against npm + official Better Auth / Auth.js / Clerk docs on 2026-06-06, not training memory)

> **This document overrides the auth section of `STACK.md`.** The prior conclusion ("hand-roll a cookie session, no named library fits") was based on a stale premise. It is now **wrong**: a maintained, well-supported, Node-native auth library that fits this exact stack cleanly **does exist** — **Better Auth**. Use it.

---

## Headline (the thing that changes the prior conclusion)

1. **Better Auth is production-ready, stable, and the de-facto recommended new-project auth library for Next.js as of 2026.** Stable `1.6.14` (published 2026-06-02), ~3.6M weekly npm downloads, active multi-release-per-week cadence. Not beta, not a rewrite-in-progress.
2. **It fits this stack natively:** built-in email+password, official Prisma adapter with `provider: "sqlite"`, runs **fully in the Node runtime** (no Edge/crypto pain), and a first-class **`admin` plugin** that adds a `role` field + server-side `getSession`/permission checks usable directly from Server Actions and RSCs.
3. **The NextAuth maintainers themselves now point new projects at Better Auth** ("Auth.js is now part of Better Auth", nextauthjs discussion #13252, Sep 2025). Auth.js **v5 is still published under the `beta` tag** (`5.0.0-beta.31`); `latest` is still v4 (`4.24.14`). The Edge/Node Credentials split the prior research described is real.
4. **Lucia is still deprecated** (`3.2.2`, frozen; a learning resource). The prior doc was right about Lucia — but wrong to jump from "Lucia is dead" to "therefore roll your own," because Better Auth is precisely the maintained successor.

---

## Options Compared

| Library | Current ver (verified) | Status | Email+pwd built-in | Prisma adapter | SQLite | App Router (Server Actions / RSC) | Roles / admin | Runs in Node (no Edge pain) | External dep | Fit for this thesis |
|---|---|---|---|---|---|---|---|---|---|---|
| **Better Auth** | **1.6.14** (2026-06-02) | **Stable, very active**, ~3.6M dl/wk | **Yes** (`emailAndPassword.enabled`) | **Yes** (`better-auth/adapters/prisma`, `provider:"sqlite"`) | **Yes** | **Yes** (`auth.api.getSession({headers})`, `nextCookies()` plugin, `toNextJsHandler`) | **Yes** — `admin()` plugin: `role` field, `adminUserIds`, `userHasPermission` | **Yes** — pure server, no Edge requirement | **No** — self-hosted, your DB | **BEST — pick this** |
| **Auth.js v5 (NextAuth)** | `5.0.0-beta.31` (beta tag); `latest`=v4 `4.24.14` | **Still beta**; maintainers now redirect new projects to Better Auth | Via Credentials provider (you write `authorize` + bcrypt yourself) | `@auth/prisma-adapter` (but **not used by Credentials/JWT sessions**) | Adapter supports it, but Credentials → JWT sessions don't persist via adapter | Yes, but more wiring | Manual (stuff `role` into JWT/session callbacks) | **Edge/Node split is real** — middleware on Edge can't use bcrypt/`crypto`; needs split `auth.config.ts` | No | Workable fallback, but more boilerplate + beta |
| **Clerk** | `@clerk/nextjs 7.4.3` (2026-06-05) | Stable, polished, commercial | Yes (hosted) | n/a (users live in Clerk) | n/a | Yes, excellent DX | Yes (`publicMetadata.role`, RBAC) | Yes | **YES — needs internet; web offline support is Expo-only** | **Risky for offline thesis demo** |
| **Supabase Auth** | `@supabase/supabase-js 2.107.0` | Stable | Yes | n/a (own Postgres + GoTrue) | **No** — forces Postgres, replaces SQLite | Yes | Yes (RLS / custom claims) | Yes | YES (or self-host stack) | **Off-stack** — kills the SQLite simplicity |
| **Auth0 / WorkOS** | hosted | Stable, enterprise | Yes | n/a | n/a | OK | Yes | Yes | YES (internet) | **Overkill** + external dep |
| **Lucia** | `3.2.2` (frozen) | **Deprecated** (Mar 2025) → learning resource | n/a (you build it) | n/a | n/a | n/a | n/a | n/a | No | **Do not use** (prior doc correct) |

---

## Recommendation (Ranked)

### 1. Better Auth `^1.6` — **USE THIS**
It is the cleanest, lowest-effort path that is *also* a real, maintained, named library — best of both worlds for a thesis. Concretely it gives you, out of the box:
- email+password registration & login (`emailAndPassword: { enabled: true }`),
- persistent cookie sessions stored in **your SQLite DB via the Prisma adapter**,
- a seeded `admin` **role** through the official `admin()` plugin,
- admin-only **Server Actions** by reading `session.user.role` from `auth.api.getSession()` — pure Node, no Edge, no bcrypt-on-Edge footgun.

Setup is small (one `auth.ts`, one `auth-client.ts`, one catch-all route, `npx auth generate` for the Prisma models, the `nextCookies()` plugin). You can defend it in a thesis: "I used Better Auth, the current standard auth library for Next.js, with its Prisma+SQLite adapter and admin plugin." Stronger narrative than "I hand-rolled cookies."

**Note for STACK.md:** with Better Auth you do **not** need `iron-session` or `jose`, and you **do not hash passwords yourself** — Better Auth handles password hashing (scrypt by default) and session signing internally. You can drop `bcryptjs` from the auth path. (Keep `zod` for app-form validation; keep Prisma 6.)

### 2. Auth.js v5 (`next-auth@beta`) — fallback only
Choose only if a rubric explicitly demands "NextAuth" by name. Costs: still beta, you implement the Credentials `authorize` callback + your own bcrypt compare, push `role` through `jwt`/`session` callbacks, and either accept the Edge/Node `auth.config.ts` split or keep all auth in Node and skip Edge middleware. More moving parts than Better Auth for the same result. (And its own maintainers now point you to Better Auth.)

### 3. Hand-rolled cookie session (the prior recommendation) — **demote**
Still *technically* fine and dependency-light, but it is no longer the best option now that Better Auth exists and fits. Only reasonable if the thesis must demonstrate auth from first principles with zero auth dependency. Otherwise it trades a 5-line library for ~50–100 lines you maintain and must defend.

### 4. Clerk — only if online demo is guaranteed
Best DX of all, but **hosted**: the web SDK needs network to verify sessions (documented offline support is **Expo/React-Native only**, via `expo-secure-store` — not the Next.js web SDK). If the grading machine may be offline, this is a demo-day failure risk. Also an external account dependency, against the stated thesis preference. Skip unless internet is certain.

**When I'd switch from #1:** move to Clerk only if the project later needs social login, MFA, email deliverability, and a hosted dashboard *and* connectivity is guaranteed. Move to Auth.js only if a grader names it. Neither applies to current scope.

---

## Recommended Setup for Our Stack (concrete)

### Install
```bash
pnpm add better-auth
# Prisma 6 already installed. No bcryptjs/iron-session/jose needed for auth.
```

### `lib/auth.ts` (server)
```ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient(); // reuse your lib/prisma.ts singleton instead

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  emailAndPassword: { enabled: true },
  plugins: [
    admin(),          // adds `role`, `banned`, etc.; default roles: admin | user
    nextCookies(),    // MUST be last — sets cookies from Server Actions
  ],
});
```

### `lib/auth-client.ts` (client, for the login/register forms)
```ts
import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({ plugins: [adminClient()] });
// authClient.signUp.email(...), authClient.signIn.email(...), authClient.signOut()
```

### Route handler — `app/api/auth/[...all]/route.ts`
```ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
export const { GET, POST } = toNextJsHandler(auth);
```

### Prisma models — generate them, don't hand-write
```bash
npx auth generate   # reads lib/auth.ts + plugins, writes the models into schema.prisma
pnpm prisma migrate dev --name auth
```
The `admin()` plugin's required models/fields are produced by this command. Better Auth's base schema is **User, Session, Account, Verification**; the admin plugin adds `role` (and `banned`/`banReason`/`banExpires`) to `User`. Add your domain field `preferredSide` (left/right) to the `User` model after generation, then re-migrate. The `User.role` defaults to `"user"`; admins are `"admin"`.

### Seed the single admin — `prisma/seed.ts`
Create the admin through Better Auth so the password is hashed correctly and the account row matches Better Auth's expectations, then set the role:
```ts
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";

const email = "admin@org.example";
const existing = await prisma.user.findUnique({ where: { email } });
if (!existing) {
  await auth.api.signUpEmail({
    body: { email, password: process.env.ADMIN_PASSWORD!, name: "Org Admin" },
  });
  await prisma.user.update({ where: { email }, data: { role: "admin" } });
}
```
Idempotent (guarded by the existence check). Run via the existing `prisma db seed` hook (`tsx prisma/seed.ts`).

### Admin-only Server Action (the role check)
```ts
"use server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function createTournament(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user.role !== "admin") throw new Error("Forbidden");
  // ...validate with zod, prisma.tournament.create(...), revalidatePath(...)
}
```
The same `getSession()` call works in RSCs to gate UI. All of this runs in the **Node runtime** — bcrypt/crypto/Edge concerns never arise. (Better Auth handles password hashing and session signing internally; you don't.)

### Route protection
For this app, gate inside Server Actions / RSCs as above (recommended by Better Auth). If you want a redirect at the edge, Next.js 16 "proxy" (`proxy.ts`) can call `auth.api.getSession` in the Node runtime, or do a cheap cookie-existence check with `getSessionCookie` — but **page/action-level checks are the source of truth.** No Edge auth needed.

---

## Open Considerations

- **Email verification:** Better Auth supports it but it's **off by default** — leave it disabled for the thesis (no SMTP setup, no internet needed). `emailAndPassword.enabled` alone allows immediate sign-in.
- **Prisma 7 note (only if you later upgrade Prisma):** Better Auth's Prisma adapter works with v7 too, but v7 requires importing `PrismaClient` from your generated output path. STACK.md already recommends staying on **Prisma 6** — keep that; the adapter snippet above (`@prisma/client`) is correct for v6.
- **Prisma singleton:** pass your existing `lib/prisma.ts` global-singleton client into `prismaAdapter`, not a fresh `new PrismaClient()`, to avoid dev hot-reload connection churn (per STACK.md SQLite gotcha).
- **Password hashing in the thesis writeup:** Better Auth uses scrypt by default (memory-hard, modern) — a slightly better story than bcrypt if you discuss hashing, and you get it for free.
- **`adminUserIds` shortcut:** the admin plugin also lets you mark admins by user id array without a role column; for a single seeded admin the **`role: "admin"`** column approach above is cleaner and matches the `User.role` model. Use the role field.
- **Confidence on capabilities:** HIGH — every capability above is from current official Better Auth docs (Prisma adapter, admin plugin, Next.js integration, email/password pages) read 2026-06-06; versions from npm registry same day.

## Sources

- npm registry (2026-06-06): `better-auth` latest **1.6.14** (modified 2026-06-02; tags include `beta 1.7.0-beta.4`), `next-auth` latest **4.24.14** + `beta 5.0.0-beta.31`, `lucia` **3.2.2** (frozen, 2025-06), `@clerk/nextjs` **7.4.3**, `@supabase/supabase-js` **2.107.0** — **HIGH**
- npm downloads API (week of 2026-05-27): better-auth ~3.60M/wk, next-auth ~4.61M/wk — **HIGH**
- https://www.better-auth.com/docs/adapters/prisma — Prisma adapter, `provider:"sqlite"`, `npx auth generate` schema generation — **HIGH**
- https://www.better-auth.com/docs/authentication/email-password — built-in email+password, `signUp.email`/`signIn.email`/`auth.api.signUpEmail` — **HIGH**
- https://www.better-auth.com/docs/plugins/admin — `admin()` plugin: `role`/`adminUserIds`/`adminRoles`/`defaultRole`, `createUser`, `userHasPermission`, base+admin schema fields — **HIGH**
- https://www.better-auth.com/docs/integrations/next — `toNextJsHandler`, `nextCookies()` plugin, `auth.api.getSession({headers})` in RSC/Server Actions, Next 16 proxy, Node runtime — **HIGH**
- https://github.com/nextauthjs/next-auth/discussions/13252 ("Auth.js is now part of Better Auth", Sep 2025) + https://authjs.dev/getting-started/migrating-to-v5 (v5 still `beta` tag) — **HIGH/MEDIUM**
- https://blog.logrocket.com/best-auth-library-nextjs-2026/ — 2026 Next.js auth library comparison, Better Auth as recommended default — **MEDIUM**
- https://clerk.com/docs/guides/development/offline-support — Clerk offline support is **Expo-only** (`expo-secure-store`); web SDK needs network — **HIGH**
- https://lucia-auth.com / lucia-auth deprecation (Mar 2025) — Lucia is a learning resource, not a maintained library — **HIGH**

---
*Auth research for: padel tournament thesis app. Overrides STACK.md §2 (Auth). Recommendation: **Better Auth ^1.6**.*
