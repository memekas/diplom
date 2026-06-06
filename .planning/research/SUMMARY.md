# Project Research Summary

**Project:** Padel Tournaments
**Domain:** Single-org, single-elimination padel (pairs/doubles) tournament web app — thesis-grade
**Researched:** 2026-06-06
**Confidence:** HIGH

## Executive Summary

This is a small full-stack CRUD app whose only non-trivial mechanic is a fixed-size single-elimination (playoff) bracket for pairs. One seeded organization admin creates tournaments (4/8/16 pairs), players self-register and form pairs, the admin enters scores, and the winning pair auto-advances up a pre-generated match tree. The stack is locked: Next.js (App Router, TS) + Prisma + SQLite in a single repo. Experts build this exactly the way the locked stack suggests — Server Components for reads, Server Actions for writes, a thin auth/validation layer over a framework-agnostic service layer, and a persisted match tree advanced by a `nextMatch` pointer. The guiding principle from PROJECT.md is simplicity and speed over extensibility; the 4/8/16 power-of-two constraint is the single biggest simplifier (no byes, no seeding math, table-drivable round counts).

The recommended approach: pin **Prisma 6.x (>=6.2, NOT 7)**, **Next.js 16 App Router**, **bcryptjs**, **Zod 4**, **Tailwind 4**, and a **hand-rolled encrypted-cookie session** (iron-session or jose). Pre-generate the entire `size-1` match tree in one transaction at registration lock, wire children to parents via `nextMatchId` + `nextSlot`, fill round-1 randomly, and advance winners with a single tested pure function. Keep all domain logic (bracket gen, advancement, registration rules) in `lib/services/` so actions stay thin (auth -> validate -> service -> `revalidatePath`).

The dominant risks are all correctness, not scale: the **winner-advancement slot math** (`parent = floor(i/2)`, `slot = i%2`), **off-by-one round counts**, **state-machine transitions enforced only in the UI**, **pair/partner integrity** (self-partner, double-registration, over-capacity races), **admin authz bypass via direct Server Action calls**, and **stale bracket caching** after a result. Each is mitigated by isolating logic into tested pure functions, doing capacity+insert and result+advance inside `$transaction`, calling `requireAdmin()` at the top of every mutation, and `revalidatePath()` after each write (verified against a production build, not just `next dev`).

## Key Findings

### Recommended Stack

The stack is pre-decided; the research turns it into a prescriptive, simplicity-tuned recipe. App Router is genuinely *simpler* here: reads are async Server Components hitting Prisma directly (no API layer, no client fetch), writes are Server Actions called from `<form action>`. No bracket library, no UI component kit — a fixed 4/8/16 tree is static flex/grid layout. See `.planning/research/STACK.md`.

**Core technologies (with versions):**
- **Next.js 16.x (App Router)** + React 19 + TypeScript 5 — single repo, server-rendered bracket, Server Actions for mutations.
- **Prisma 6.x — pin `>=6.2`, NOT 7** — simplest workflow (`prisma-client-js`, generates to node_modules). Prisma 7 forces mandatory driver adapters + `prisma.config.ts` + generated output path = pure complexity for zero benefit. 6.2+ also gives native SQLite enums (see reconciliation).
- **SQLite** (`file:./dev.db`) — zero setup, single file; perfect for zero-load demo.
- **bcryptjs 3.x** — pure-JS password hashing, no native build, works in Server Actions.
- **iron-session 8.x** (or `jose` signed JWT cookie) — encrypted stateless cookie session, no session table.
- **Zod 4.x** — validate Server Action FormData (4/8/16 constraint, email, partner, score).
- **Tailwind 4.x** — CSS-first, no config file; the bracket is the only real layout.
- **pnpm** (npm acceptable fallback — pick one, document for grader).

### Expected Features

The MVP equals exactly the PROJECT.md Active list. See `.planning/research/FEATURES.md`.

**Must have (table stakes):**
- Player registration (email + password) + court-side preference (display-only field, no logic).
- Login + persisted session.
- Seeded admin account (role `admin`) — no admin self-registration.
- Admin creates playoff tournament (size 4/8/16 + name/dates/location).
- "Participate" -> form a pair by naming partner (registered user) — **Variant B**.
- Registration auto-locks at exactly capacity.
- Bracket generation (random round-1 placement, no byes).
- Public tournament page (info + pair list + bracket + status).
- Admin enters structured per-set games score (sets->games, tennis-style); set & match winner DERIVED -> winner auto-advances. See ARCHITECTURE.md "SCORING MODEL OVERRIDE".
- Bracket renders TBD / pair name / winner highlight; tournament status badge.

**Should have (competitive, defer):**
- Player "my tournaments" view (free once partner = real user — v1.x).
- Structured set-by-set scoring (replace free-text later).

**Defer (v2+) / Anti-features (deliberately NOT built):**
- Singles with random partner matching; other formats (round-robin, groups, double-elim).
- Rankings/ELO, seeding, byes/non-power-of-2, payments, notifications, mobile app.
- Mutual partner consent/invite/accept flow.
- Structured padel scoring engine; caching/scaling.

### Bracket Data Model + Advancement (the load-bearing core)

The bracket is a **pre-generated match tree**: at registration lock, create all `size-1` `Match` rows (round 1 filled with randomly-shuffled pairs, later rounds with null slots) inside one `$transaction`, each child wired to its parent via `nextMatchId` + `nextSlot` ("A"/"B"). Reading the bracket is a single `findMany({ where: { tournamentId }, include: { pairA, pairB } })` grouped by `round`, ordered by `position` — no read-time bracket math. **Advancement** is one update: on result entry, set `winnerId`, then write that winner into the parent match's A or B slot via a single tested pure function `advance(round, position) => { round+1, floor(position/2), position % 2 }`; when there is no `nextMatchId`, the final is decided and the tournament flips to `completed`. See `.planning/research/ARCHITECTURE.md`.

### Architecture Approach

Single Next.js process, no separate backend. Layered: Server Components (reads) and Server Actions (writes, auth+validation) -> `lib/services/` (framework-agnostic domain logic) -> `lib/db.ts` Prisma singleton -> SQLite. Middleware is **UX redirect only, never the security boundary** — real authz is `requireUser()`/`requireAdmin()` inside every action and protected component.

**Major components:**
1. **Server Components (pages)** — read via services, render HTML, never mutate.
2. **Server Actions** (`actions.ts` per route group) — auth -> Zod validate -> call service -> `revalidatePath`.
3. **`lib/services/`** — `auth . tournaments . registration . bracket . matches`; pure, testable domain logic.
4. **`lib/db.ts`** — Prisma singleton (avoids dev hot-reload connection storm).
5. **`prisma/seed.ts`** — idempotent (`upsert`) admin seeded from env vars.

### Critical Pitfalls

Top items from `.planning/research/PITFALLS.md`:

1. **Winner-advancement slot math** — winners land in the wrong parent slot or overwrite each other. Avoid: isolate `advance(round, position)` as a unit-tested pure function; advancement is an UPDATE into a pre-existing row, never an insert.
2. **Off-by-one round/match counts** — 16 pairs render 3 rounds not 4; final never resolves. Avoid: table-drive `{4:2, 8:3, 16:4}`; assert total matches `= size-1`; never bare `Math.log2`.
3. **State transitions enforced only in UI** — joins after start, results before start. Avoid: one server-side transition function; every mutation re-checks DB status inside its transaction; `finished` derived automatically from the final's winner.
4. **Pair/partner integrity + join race** — self-partner, player in two pairs, over-capacity. Avoid: capacity check + insert in one `$transaction`; reject `playerA===playerB`; resolve partner to a real User; enforce per-player-per-tournament uniqueness.
5. **Admin authz bypass + stale cache** — non-admin POSTs directly to a Server Action; bracket shows old state after a result. Avoid: `requireAdmin()` as the first line of every mutation; `revalidatePath('/tournaments/[id]')` after each write, verified on `next build && next start`.

## Reconciliation of Cross-Doc Conflicts

These were resolved across the four research docs; downstream phases must follow the resolution, not the superseded text:

1. **Prisma + SQLite enums.** STACK.md and ARCHITECTURE.md modeled `Role`/`status`/`courtSide` as `String` (assuming SQLite has no enums). PITFALLS.md verified (HIGH) that **native SQLite enum support exists since Prisma ORM 6.2.0**. **Resolution: pin Prisma `>=6.2` (6.x, NOT 7) and USE Prisma `enum` for `Role`, `TournamentStatus`, and `CourtSide`.** The `String`-field approach is a still-valid fallback only if on an older Prisma; with the pinned version it is unnecessary. Treat the ARCHITECTURE.md `String` schema snippet as superseded on this point.

2. **Auth approach.** Consensus recommendation: **hand-rolled encrypted/signed cookie session** (iron-session or jose) — Lucia is deprecated (March 2025, author says roll your own), and Auth.js v5 is still beta with a painful Edge/Node split for the Credentials provider. ~50 lines, trivial to defend in a thesis, no beta dependency. **Open question (top): the thesis rubric may require a *named* auth library** — if so, flip to **Auth.js v5** (`next-auth@beta`), keep all auth in the Node runtime, do NOT protect routes via Edge middleware. Confirm early because it changes the auth phase.

3. **Partner registration model.** Consensus: **Variant B** — the registering player picks an already-registered user as partner; `Pair { player1Id, player2Id }`; **no consent/invite/accept/notification flow** (registering player is authoritative; document as a scope decision). Enforce: no self-partner, no player in two pairs per tournament, no duplicate pair. **Fallback: Variant A** (free-text partner name) is simpler but lossier — partner isn't a real user, can't log in or see "my tournaments." Default to B; only drop to A if a user picker proves too costly.

## Implications for Roadmap

Build order is a strict dependency chain (foundation -> auth -> tournament CRUD -> registration/pairs -> bracket gen -> results/advancement -> public view). Each phase is independently demoable.

### Phase 1: Foundation & Schema
**Rationale:** Every later phase depends on the schema, Prisma singleton, and migration/seed workflow; these are expensive to change later.
**Delivers:** `schema.prisma` (User, Tournament+`setsPerMatch`/`gamesPerSet`, Pair, Match+`SetScore` child with `onDelete: Cascade` on Pair/Match/SetScore -> parent; **enums** for Role/TournamentStatus/CourtSide; game/set counts as `Int`, never Float), `lib/db.ts` singleton, `prisma migrate dev`, idempotent env-based admin seed. Structured scoring schema per ARCHITECTURE.md "SCORING MODEL OVERRIDE".
**Uses:** Prisma >=6.2 (NOT 7), SQLite.
**Avoids:** Prisma/SQLite gotchas (enum version, cascade, score type), server/client boundary convention.

### Phase 2: Auth
**Rationale:** Tournament CRUD and every mutation need `requireAdmin()`/`requireUser()`; auth is the security spine.
**Delivers:** register/login/logout, encrypted cookie session, `lib/auth.ts` with `requireUser`/`requireAdmin`, bcryptjs hashing, middleware as UX-only redirect.
**Uses:** iron-session/jose, bcryptjs.
**Avoids:** admin authz bypass (authz in server actions, not UI), password-hash leak (explicit `select`, never return `passwordHash`), unsafe seed.
**Decision gate:** confirm hand-rolled vs Auth.js v5 (rubric question) before building.

### Phase 3: Tournament CRUD + Status State Machine
**Rationale:** Tournaments are the root entity; the status state machine (`draft -> registration -> in_progress -> finished`) must exist before registration and results so both lean on it.
**Delivers:** admin create tournament (size 4/8/16), list/view, single server-side transition function with guards.
**Avoids:** status transitions enforced only in UI; client-supplied status.

### Phase 4: Registration / Pairs
**Rationale:** Pairs only exist within a tournament; bracket generation requires a full, locked field.
**Delivers:** "Participate" -> name partner (Variant B, registered user) -> `Pair` row; capacity + duplicate-player + self-partner checks in one `$transaction`; auto-lock at capacity.
**Addresses:** doubles entry mechanic (Core Value).
**Avoids:** pair/partner integrity violations, join race / over-capacity.

### Phase 5: Bracket Generation
**Rationale:** Needs the full set of pairs; produces the structure results depend on.
**Delivers:** shuffle, create all `size-1` match rows in one `$transaction` (final-first so parents exist), wire `nextMatchId`/`nextSlot`, fill round-1 randomly, set `in_progress`. Generation gated to run exactly once (refuse if matches exist or status != registration); no regenerate.
**Avoids:** off-by-one counts, mutating/reshuffling a started bracket.

### Phase 6: Match Results + Advancement
**Rationale:** Needs matches; the most bug-prone logic in the app.
**Delivers:** admin enters per-set games (sets->games); `recordResult(matchId, sets[])` validates each set (reach `gamesPerSet`, win-by-2 or 7:6), DERIVES set winners + match winner (first to `ceil(setsPerMatch/2)` sets), sets `setsWonA/B`+`winnerId`, advances winner into parent slot, completes tournament on the final — all in `$transaction`; `revalidatePath` after commit. Reject unless both slots filled and a decisive winner. Free editing: delete+reinsert SetScores, re-derive, re-propagate. See ARCHITECTURE.md "SCORING MODEL OVERRIDE".
**Avoids:** winner-advancement slot-math bug, results entered out of order, stale bracket caching.

### Phase 7: Public Bracket View
**Rationale:** Visibility is the Core Value; can be built incrementally alongside 5-6.
**Delivers:** public tournament page (info + pair list + status badge + `Bracket.tsx`), TBD/pair-name/winner-highlight rendering, single grouped read query.
**Avoids:** N+1 (one `include` query); stale state (relies on Phase 6 revalidation, tested on prod build).

### Phase Ordering Rationale
- **Strict dependency chain:** schema -> auth (needed by all mutations) -> tournament root -> pairs (need tournament) -> bracket (needs full pairs) -> results (need bracket) -> public view (needs structure + results).
- **State machine before registration/results** so both reuse one guarded transition function.
- **Pure-function-first** for `advance()` and round-count lookups — write and unit-test before any UI wiring (directly defeats the top two critical pitfalls).

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Auth):** MEDIUM-confidence, opinionated decision + open rubric question (hand-rolled vs Auth.js v5). Confirm the constraint, then the implementation path is well-documented either way. Light research / decision only.

Phases with standard patterns (skip research-phase):
- **Phase 1, 3, 4, 6, 7:** well-documented Next.js App Router + Prisma + Server Action patterns; algorithms and pitfalls already fully specified in ARCHITECTURE.md / PITFALLS.md (including ready-to-use `generateBracket` and `recordResult` reference implementations).
- **Phase 5 (Bracket gen):** non-trivial logic but fully solved in research (final-first creation, slot math, table-driven counts) — implement against the provided algorithm + unit tests; no new research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified against npm + official docs; Prisma 7 and Lucia avoidance well-justified. Auth choice MEDIUM (opinionated tradeoff + rubric dependency). |
| Features | HIGH | Domain conventions verified; scope locked in PROJECT.md; MVP = Active list. |
| Architecture | HIGH | Standard Next.js App Router + service-layer DAL; pre-generated tree with reference algorithms provided. |
| Pitfalls | HIGH | Bracket/state/integrity from domain reasoning; Prisma 6.2 enum + revalidatePath behavior verified against docs. |

**Overall confidence:** HIGH

### Gaps to Address
- **Auth library requirement (rubric):** Confirm whether the thesis grader mandates a named auth library. If yes -> Auth.js v5 (Node runtime only); if no -> hand-rolled cookie session. Resolve before Phase 2. **This is the one true open question.**
- **pnpm vs npm:** Pick one based on the grading machine and document it. Trivial; resolve at Phase 1 scaffold.
- **Editable results re-propagation:** Out of scope by default; simplest rule = a result is editable only while its next match has no result. Decide at Phase 6 if editing is needed at all.
- **Variant B user picker UX:** If selecting a registered partner proves costly, the documented fallback is Variant A (free-text). Decide at Phase 4.

## Consolidated Open Questions

1. **Does the thesis rubric require a named auth library?** (Yes -> Auth.js v5, Node runtime, no Edge middleware. No -> hand-rolled encrypted cookie session.) — **highest priority, resolve before Phase 2.**
2. **pnpm or npm?** — pick per grading machine, document.
3. **Variant B (registered-user partner) vs fallback Variant A (free-text)?** — default B; drop to A only if picker is too costly.
4. **Are recorded results editable?** — default no / "editable only while next match undecided"; confirm at Phase 6.
5. **Court-side preference** — confirm it stays display-only in v1 (any auto-pairing logic is v2 scope creep).

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view`) — verified versions: next 16.2.7, prisma 6.x/7.8.0, next-auth 5.0.0-beta.31, zod 4.4.3, bcryptjs 3.0.3, tailwindcss 4.3.0, react 19.2.7.
- https://nextjs.org/blog/next-16 , https://nextjs.org/docs/app/guides/upgrading/version-16 — App Router default, Server Actions, async params.
- https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7 — Prisma 7 breaking changes (driver adapters, prisma.config.ts).
- https://www.prisma.io/docs/orm/core-concepts/supported-databases/sqlite , https://www.prisma.io/docs/orm/reference/database-features — SQLite connector + native enum support since Prisma 6.2.0.
- https://nextjs.org/docs/app/api-reference/functions/revalidatePath , https://nextjs.org/docs/app/getting-started/revalidating — revalidatePath purges data + client Router Cache.
- https://nextjs.org/docs/app/guides/authentication , https://nextjs.org/docs/app/getting-started/mutating-data — DAL / per-operation auth, Server Actions for mutations.
- https://lucia-auth.com/lucia-v3/migrate , https://github.com/lucia-auth/lucia/discussions/1714 — Lucia v3 deprecation (March 2025).
- Single-elimination structure (log2 rounds, size-1 matches, slot = floor(i/2)/i%2, byes only for non-power-of-2): https://en.wikipedia.org/wiki/Single-elimination_tournament , https://kb.score7.io/blog/guides/single-elimination-tournament-how-it-works/

### Secondary (MEDIUM confidence)
- https://authjs.dev/getting-started/migrating-to-v5 , https://authjs.dev/getting-started/providers/credentials — Auth.js v5 status (still beta) + Credentials Edge/Node split.
- https://www.authgear.com/post/nextjs-security-best-practices/ — middleware not a security boundary, CVE-2025-29927.
- https://workos.com/blog/nextjs-app-router-authentication-guide-2026 — App Router auth patterns.
- Padel scoring conventions (display-only free-text rationale): https://thepadelschool.com/post/learn-how-padel-scoring-works , https://padel-rules.com/
- Doubles partner registration (mutual invite/accept — deliberately simplified away): USTA Serve Tennis, UTR docs.

### Tertiary (LOW confidence)
- https://www.pkgpulse.com/compare/argon2-vs-bcrypt — argon2 vs bcrypt tradeoffs (bcryptjs chosen for zero native build).

---
*Research completed: 2026-06-06*
*Ready for roadmap: yes*
