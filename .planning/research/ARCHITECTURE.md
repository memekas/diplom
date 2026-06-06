# Architecture Research

**Domain:** Single-elimination padel (pairs) tournament web app — Next.js full-stack
**Researched:** 2026-06-06
**Confidence:** HIGH

## Standard Architecture

Single Next.js (App Router) process. No separate backend. Prisma talks to a local SQLite file. Server Components render pages and read data directly via a service layer; Server Actions perform all mutations and enforce auth. The bracket is a **pre-generated match tree** persisted in the DB, advanced by following a `nextMatchId` pointer on each match.

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Browser (React client)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │ Public pages │  │ Player dash  │  │ Admin pages  │  (Client comps  │
│  │ + bracket    │  │ (join/forms) │  │ (CRUD/score) │   only where    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   interactive)  │
└─────────┼─────────────────┼─────────────────┼──────────────────────────┘
          │ render (RSC)     │ <form action>   │ <form action>
┌─────────┼─────────────────┼─────────────────┼──────────────────────────┐
│         ▼                 ▼                 ▼      Next.js server        │
│  ┌──────────────┐   ┌─────────────────────────────────────┐            │
│  │ Server       │   │  Server Actions  (mutations)         │            │
│  │ Components    │   │  - requireUser() / requireAdmin()   │ ← auth gate │
│  │ (read via     │   │  - validate input (zod)             │            │
│  │  services)    │   │  - call services → revalidatePath() │            │
│  └──────┬───────┘   └──────────────────┬──────────────────┘            │
│         │                              │                                 │
│         ▼                              ▼                                 │
│  ┌──────────────────────────────────────────────────────┐              │
│  │  lib/services  (domain logic — framework-agnostic)    │              │
│  │  auth · tournaments · registration · bracket · matches│              │
│  └──────────────────────────┬───────────────────────────┘              │
│                             ▼                                            │
│  ┌──────────────────────────────────────────────────────┐              │
│  │  lib/db.ts  → Prisma Client (singleton)               │              │
│  └──────────────────────────┬───────────────────────────┘              │
└──────────────────────────────┼──────────────────────────────────────────┘
                               ▼
                       ┌──────────────┐
                       │  SQLite file │  (dev.db)
                       └──────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Server Components (pages) | Read data, render HTML; never mutate | `app/**/page.tsx`, call services directly, `async` components |
| Server Actions | Entry point for all mutations; auth + validation + revalidation | `"use server"` functions in `app/**/actions.ts` |
| Service layer | Domain logic (bracket gen, advancement, registration rules); reusable, testable | `lib/services/*.ts`, plain async functions taking Prisma |
| Auth helpers | `getSession`, `requireUser`, `requireAdmin`; throw/redirect on failure | `lib/auth.ts` |
| Prisma client | DB access singleton | `lib/db.ts` |
| Middleware | Coarse redirect of unauthenticated users away from `/dashboard`, `/admin` (UX only, NOT security) | `middleware.ts` |

## Recommended Project Structure

```
src/
├── app/
│   ├── (public)/
│   │   ├── page.tsx                 # landing / tournament list
│   │   └── tournaments/[id]/page.tsx# public tournament + bracket (RSC)
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── actions.ts               # login, register, logout server actions
│   ├── dashboard/
│   │   ├── page.tsx                 # player's tournaments + join UI
│   │   └── actions.ts               # joinTournament(partner) action
│   ├── admin/
│   │   ├── tournaments/
│   │   │   ├── page.tsx             # list/create
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/page.tsx        # manage: close reg, gen bracket, enter scores
│   │   └── actions.ts               # createTournament, generateBracket, recordResult
│   └── layout.tsx
├── components/
│   ├── Bracket.tsx                  # renders match tree (client, presentational)
│   └── ...
├── lib/
│   ├── db.ts                        # Prisma singleton
│   ├── auth.ts                      # session, requireUser, requireAdmin, hashing
│   └── services/
│       ├── tournaments.ts
│       ├── registration.ts          # join, partner linking, capacity checks
│       ├── bracket.ts               # generation algorithm
│       └── matches.ts               # recordResult + advancement
├── middleware.ts
└── prisma/
    ├── schema.prisma
    └── seed.ts                      # seeds the single admin account
```

### Structure Rationale

- **`lib/services/`:** Domain logic lives here, not in actions. Actions are thin (auth → validate → call service → revalidate). Keeps bracket/advancement logic unit-testable without Next.js. This is the "Data Access Layer" the Next.js security guidance recommends.
- **Route groups `(public)` / `(auth)`:** Organize by audience without affecting URLs.
- **`actions.ts` co-located per route group:** Mutations live next to the pages that call them.
- **`prisma/seed.ts`:** The admin is a seeded row, not a registration flow — matches the constraint.

## Data Model

Concrete enough to translate directly to `schema.prisma`. SQLite has **no native enums**, so enums are `String` fields with documented allowed values (optionally guarded by zod/TS union types in the service layer).

```prisma
// prisma/schema.prisma
datasource db { provider = "sqlite"; url = env("DATABASE_URL") }
generator client { provider = "prisma-client-js" }

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String
  name          String
  role          String   @default("player")  // "player" | "admin"
  courtSide     String   @default("either")   // "left" | "right" | "either"
  createdAt     DateTime @default(now())

  // pairs this user is part of (as either slot)
  pairsAsP1     Pair[]   @relation("PairPlayer1")
  pairsAsP2     Pair[]   @relation("PairPlayer2")
}

model Tournament {
  id          String   @id @default(cuid())
  name        String
  size        Int        // 4 | 8 | 16  (number of pairs)
  status      String   @default("registration")
                         // "registration" | "in_progress" | "completed"
  createdAt   DateTime @default(now())

  pairs       Pair[]
  matches     Match[]
}

model Pair {
  id            String     @id @default(cuid())
  tournamentId  String
  tournament    Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)

  // creator + named partner; both are Users in v1
  player1Id     String
  player1       User       @relation("PairPlayer1", fields: [player1Id], references: [id])
  player2Id     String
  player2       User       @relation("PairPlayer2", fields: [player2Id], references: [id])

  seed          Int?       // 1..size, assigned at bracket generation
  createdAt     DateTime   @default(now())

  // a pair can be slot A or slot B in matches
  matchesAsA    Match[]    @relation("MatchPairA")
  matchesAsB    Match[]    @relation("MatchPairB")
  matchesWon    Match[]    @relation("MatchWinner")

  // one player cannot be in two pairs in the same tournament
  @@unique([tournamentId, player1Id])
  @@unique([tournamentId, player2Id])
}

model Match {
  id            String     @id @default(cuid())
  tournamentId  String
  tournament    Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)

  round         Int        // 1 = first round; max round = final
  position      Int        // 0-based index of this match within its round (for layout)

  pairAId       String?
  pairA         Pair?      @relation("MatchPairA", fields: [pairAId], references: [id])
  pairBId       String?
  pairB         Pair?      @relation("MatchPairB", fields: [pairBId], references: [id])

  scoreA        Int?
  scoreB        Int?
  winnerId      String?
  winner        Pair?      @relation("MatchWinner", fields: [winnerId], references: [id])

  // advancement pointer: when this match has a winner, write it into nextMatch
  nextMatchId   String?
  nextMatch     Match?     @relation("Bracket", fields: [nextMatchId], references: [id])
  feederMatches Match[]    @relation("Bracket")
  // which slot of nextMatch this winner fills: "A" or "B"
  nextSlot      String?

  @@index([tournamentId, round])
}
```

**Why this shape:**
- **Pre-generated match tree** (chosen over computed-on-the-fly): all `Match` rows exist from generation time, fully wired via `nextMatchId` + `nextSlot`. Reading the bracket is a single `findMany({ where: { tournamentId }, include: { pairA, pairB } })`. The frontend groups by `round` and orders by `position`. No recursion needed to display, and advancement is one update. This is the simplest correct representation for a fixed power-of-two bracket.
- **`Pair` belongs to a Tournament** (registration = creating a Pair row in that tournament). No separate join/registration table needed in v1 since a pair only exists in the context of one tournament.
- **Nullable `pairA`/`pairB`:** first-round matches are filled at generation; later-round matches start null and get filled as winners advance.
- **`courtSide` / `role` as String:** SQLite has no enum type; validate with a TS union + zod in services.

## Architectural Patterns

### Pattern 1: Pre-generated bracket tree with `nextMatch` pointer

**What:** At "generate bracket", create every match for every round and link child→parent via `nextMatchId` and `nextSlot`. Round 1 matches get pairs; later matches get pairs as winners are recorded.
**When to use:** Fixed-size single elimination (exactly 4/8/16). Total matches = `size - 1`.
**Trade-offs:** Tiny write amplification at generation; in return, display and advancement are trivial and there's no bracket-math at read time.

**Generation algorithm (no byes, power of two):**

```typescript
// lib/services/bracket.ts
export async function generateBracket(db, tournamentId: string) {
  const t = await db.tournament.findUniqueOrThrow({ where: { id: tournamentId } });
  const pairs = await db.pair.findMany({ where: { tournamentId } });
  if (pairs.length !== t.size) throw new Error("Tournament not full");

  // 1. Seed/shuffle: simple random shuffle (no ranking system in v1)
  const shuffled = shuffle([...pairs]);                 // Fisher–Yates
  shuffled.forEach((p, i) =>                             // assign 1..size
    db.pair.update({ where: { id: p.id }, data: { seed: i + 1 } }));

  // 2. Build rounds bottom-up. size=8 → rounds [4,2,1] matches.
  const rounds: number[] = [];                            // matches per round
  for (let n = t.size / 2; n >= 1; n = Math.floor(n / 2)) rounds.push(n);
  //   size 4 → [2,1]; size 8 → [4,2,1]; size 16 → [8,4,2,1]

  // 3. Create matches round by round, top (final) created last so we
  //    can link children to already-created parents. Create FINAL first:
  const matchIdsByRound: string[][] = [];
  for (let r = rounds.length; r >= 1; r--) {              // final → round 1
    const count = rounds[r - 1];
    const ids: string[] = [];
    for (let pos = 0; pos < count; pos++) {
      const parent = r < rounds.length
        ? { nextMatchId: matchIdsByRound[0][Math.floor(pos / 2)],
            nextSlot: pos % 2 === 0 ? "A" : "B" }          // even→A, odd→B
        : { nextMatchId: null, nextSlot: null };           // final
      const m = await db.match.create({
        data: { tournamentId, round: r, position: pos, ...parent },
      });
      ids.push(m.id);
    }
    matchIdsByRound.unshift(ids);                          // prepend
  }

  // 4. Fill round-1 matches: pairs in seed order, 2 per match.
  const round1 = matchIdsByRound[0];
  for (let i = 0; i < round1.length; i++) {
    await db.match.update({
      where: { id: round1[i] },
      data: { pairAId: shuffled[2 * i].id, pairBId: shuffled[2 * i + 1].id },
    });
  }
  await db.tournament.update({ where: { id }, data: { status: "in_progress" } });
}
```

> Note: wrap the whole thing in `db.$transaction(...)` so a partial bracket can't be persisted. Order of creation (final-first) guarantees a parent id exists before children reference it.

### Pattern 2: Winner advancement via the pointer

**What:** Recording a result sets `winner` on the match, then writes that winner into the parent match's A or B slot.

```typescript
// lib/services/matches.ts
export async function recordResult(db, matchId, scoreA, scoreB) {
  const m = await db.match.findUniqueOrThrow({ where: { id: matchId } });
  if (!m.pairAId || !m.pairBId) throw new Error("Match not ready");
  if (scoreA === scoreB) throw new Error("No ties in elimination");
  const winnerId = scoreA > scoreB ? m.pairAId : m.pairBId;

  await db.$transaction(async (tx) => {
    await tx.match.update({ where: { id: matchId },
      data: { scoreA, scoreB, winnerId } });

    if (m.nextMatchId) {                                   // advance
      await tx.match.update({
        where: { id: m.nextMatchId },
        data: m.nextSlot === "A" ? { pairAId: winnerId } : { pairBId: winnerId },
      });
    } else {
      await tx.tournament.update({ where: { id: m.tournamentId },
        data: { status: "completed" } });                  // final decided
    }
  });
}
```

**Trade-offs:** Editing an already-recorded result that has propagated isn't handled in v1 (would need to clear downstream). Acceptable for a thesis; flag in PITFALLS.

### Pattern 3: Thin Server Action over fat service, auth at the action boundary

**What:** Every mutation is a Server Action that (1) checks auth, (2) validates input, (3) delegates to a service, (4) `revalidatePath`. **Server Actions are public HTTP endpoints — they must re-check auth even if middleware ran** (per CVE-2025-29927 guidance; middleware is not a security boundary).

```typescript
// app/admin/actions.ts
"use server";
export async function recordResultAction(formData: FormData) {
  await requireAdmin();                                    // throws/redirects
  const { matchId, scoreA, scoreB } = parseResult(formData); // zod
  await recordResult(db, matchId, scoreA, scoreB);
  revalidatePath(`/tournaments/${/* tournamentId */}`);
}
```

**Trade-offs:** A little repetition of `requireAdmin()` across actions — but explicit auth at each mutation is the correct, defense-in-depth pattern.

## Data Flow

### Request Flow (admin records a score)

```
Admin clicks "Save score"  (client form)
    ↓ <form action={recordResultAction}>
recordResultAction (Server Action)
    → requireAdmin()  → parse/validate (zod)
    → matches.recordResult(db, ...)  → Prisma $transaction
        → update match (winner) → update parent slot (advance)
    → revalidatePath("/tournaments/[id]")
    ↓
Public bracket page re-renders with new winner in next round
```

### Read Flow (anyone views bracket)

```
GET /tournaments/[id]  → Server Component
    → tournaments.getWithBracket(db, id)
        → findMany matches (include pairA, pairB)
    → group by round, sort by position
    → <Bracket rounds={...} />   (presentational)
```

### Auth boundary

- **`middleware.ts`** — coarse UX redirect only: unauthenticated → `/login` for `/dashboard` and `/admin`. Treated as optimization, not security.
- **`lib/auth.ts`** — `requireUser()` and `requireAdmin()` read the session and throw/redirect. Called inside every Server Action and at the top of protected Server Components. This is the real boundary.
- Admin-only mutations (`createTournament`, `generateBracket`, `recordResult`) all call `requireAdmin()` first.

## Suggested Build Order

Dependencies flow top-down; each step is demoable.

1. **Project + Prisma + seed** — `schema.prisma`, `lib/db.ts`, seed admin account. *(Depends on: nothing.)*
2. **Auth** — register/login/logout, session, `requireUser`/`requireAdmin`, middleware. *(Depends on: 1.)*
3. **Tournament CRUD (admin)** — create tournament (name, size 4/8/16, status=registration), list, view. *(Depends on: 2 — needs `requireAdmin`.)*
4. **Registration / pairs (player)** — "Participate" + name partner → create `Pair`; capacity + duplicate-player checks; close registration when full. *(Depends on: 3 — pair needs a tournament.)*
5. **Bracket generation** — shuffle/seed, create match tree, wire `nextMatch`/`nextSlot`, set status `in_progress`. *(Depends on: 4 — needs full set of pairs.)*
6. **Match results + advancement** — admin enters score/winner; `recordResult` advances winner, completes tournament on final. *(Depends on: 5 — needs matches.)*
7. **Public bracket view** — read-grouped-by-round, `Bracket.tsx` rendering. *(Depends on: 5 for structure, 6 for results; can be built incrementally alongside.)*

## Page / Route Map

| Route | Audience | Type | Purpose |
|-------|----------|------|---------|
| `/` | public | RSC | Landing + list of tournaments |
| `/tournaments/[id]` | public | RSC | Tournament info + live bracket |
| `/login`, `/register` | public | RSC + action | Player auth |
| `/dashboard` | player | RSC + action | My tournaments; join + name partner |
| `/admin/tournaments` | admin | RSC | List / entry to management |
| `/admin/tournaments/new` | admin | RSC + action | Create tournament |
| `/admin/tournaments/[id]` | admin | RSC + actions | Close reg, generate bracket, enter scores |

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Thesis / demo (current) | SQLite + single process is ideal. No changes needed. |
| If ever multi-org / real load | Swap SQLite→Postgres (Prisma: change `provider` + `url`); enums could become native; add connection pooling. Service layer is unchanged. |

### Scaling Priorities

1. **First bottleneck:** SQLite single-writer under concurrent writes — irrelevant here (one admin writes). No action.
2. **Not applicable:** project explicitly excludes load optimization.

## Anti-Patterns

### Anti-Pattern 1: Computing the bracket on every read instead of persisting matches

**What people do:** Store only pairs + results and recompute round-by-round who plays whom at render time.
**Why it's wrong:** Re-derives advancement on every page load, easy to get off-by-one wrong, harder to display partially-filled later rounds.
**Do this instead:** Pre-generate all `size-1` match rows wired by `nextMatchId`. Reading is one query; advancing is one update.

### Anti-Pattern 2: Relying on middleware for authorization

**What people do:** Gate `/admin` in `middleware.ts` and assume mutations are safe.
**Why it's wrong:** Middleware is bypassable (CVE-2025-29927) and never runs for direct Server Action invocation guarantees. UI-only checks aren't security.
**Do this instead:** `requireAdmin()` inside every admin Server Action and protected Server Component. Middleware is UX redirect only.

### Anti-Pattern 3: Putting domain logic inside Server Actions / components

**What people do:** Write bracket generation and advancement directly in `actions.ts` or page files.
**Why it's wrong:** Untestable, not reusable, mixes auth/transport with domain rules.
**Do this instead:** Keep generation/advancement in `lib/services/`, pure async functions taking the Prisma client; actions stay thin.

### Anti-Pattern 4: SQLite enums via Prisma `enum`

**What people do:** Declare `enum Role { ... }` in schema.
**Why it's wrong:** SQLite provider doesn't support native enums; Prisma errors.
**Do this instead:** Use `String` fields with a documented union + zod validation in the service layer.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| (none) | — | No email/payments/push — explicitly out of scope. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Server Action ↔ Service | direct function call | Action does auth+validation, service does domain work |
| Service ↔ Prisma | direct (`db` passed in) | Pass client for testability; use `$transaction` for advancement |
| Server Component ↔ Service | direct call | Read-only; no mutations in components |
| Middleware ↔ everything | redirect only | Not an auth guarantee |

## Sources

- [Next.js — Mutating Data (Server Actions for in-app mutations)](https://nextjs.org/docs/app/getting-started/mutating-data) — HIGH
- [Next.js — Route Handlers (when to use vs actions)](https://nextjs.org/docs/app/getting-started/route-handlers) — HIGH
- [Next.js — Authentication guide (DAL, per-operation checks)](https://nextjs.org/docs/app/guides/authentication) — HIGH
- [Next.js Security Best Practices 2026 — middleware not a boundary, CVE-2025-29927](https://www.authgear.com/post/nextjs-security-best-practices/) — MEDIUM
- [WorkOS — Next.js App Router auth guide 2026](https://workos.com/blog/nextjs-app-router-authentication-guide-2026) — MEDIUM
- Prisma SQLite connector (no native enums; relations) — training + Prisma docs, MEDIUM

---
*Architecture research for: single-elimination padel pairs tournament app*
*Researched: 2026-06-06*
