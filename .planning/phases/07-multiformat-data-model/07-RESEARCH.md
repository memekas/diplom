# Phase 7: Модель данных мультиформата - Research

**Researched:** 2026-06-07
**Domain:** Prisma 6 schema design, SQLite migration, idempotent seeds (Better Auth)
**Confidence:** HIGH (codebase verified; no external libs introduced)

<user_constraints>
## User Constraints (from 07-CONTEXT.md)

### Locked Decisions
- **D4 (architecture):** Playoff stack (`Match`/`Pair`/`SetScore`) stays UNTOUCHED — do not alter `pairAId/pairBId/winnerId` FK-to-`Pair`, `nextMatchId/nextSlot/position`, `@@unique([tournamentId,round,position])`. Round-based/individual formats get SEPARATE models. Generalized-`Match`-with-discriminator is REJECTED.
- **New models:** `TournamentPlayer` (singles entry, `@@unique([tournamentId,userId])`), `Round` (`tournamentId,roundNumber,status` `pending|in_progress|finished`, `@@unique([tournamentId,roundNumber])`), `RoundMatch` (`roundId,courtNumber`, 4 nullable `User` FK `teamA1/A2/B1/B2`, points result), `PlayerMatchScore` (`roundMatchId,userId,teamSlot,pointsFor,pointsAgainst` — both partners get the SAME team `pointsFor`; `pointsAgainst` REQUIRED).
- **Tournament +fields:** `format` (`playoff|round_robin|americano|mexicano`, default `playoff`), `participantMode` (`pairs|singles`, default `pairs`), `level` (one of 5 RU), `price`, `scoringMode` (`sets|points`, default `sets`), `targetPoints Int?` (default-via-app 24), `totalRounds Int?`, `setsPerMatch`/`gamesPerSet` configurable with NO upper limit.
- **User:** `skillLevel` becomes REQUIRED with 5 values (add a "progressing" tier between beginner and intermediate); `birthDate DateTime?`.
- **Migration:** `prisma migrate reset` + reseed is allowed (thesis — avoids backfill of required `skillLevel`). Seeds updated for required `skillLevel`(5) + `birthDate`, keeping idempotency + nickname uniqueness.
- **Format decisions (from FORMATS.md, schema context only):** D1 americano/mexicano = singles + system rotation + individual points. D2 RR points: equal scores forbidden (validation = Phase 8; schema just stores two ints). D3 americano/mexicano default `points` only (schema allows both). D5 RR single, clean table. D6 `targetPoints` default 24, configurable. D7 soft participant cap (≤~24, validated Phase 8).

### Claude's Discretion
- Exact field/model names, types (Int vs Decimal for `price`, `DateTime` for `birthDate`), nullable strategy, indexes — follow existing `schema.prisma` conventions.
- Level slug keys: latin (`beginner|progressing|intermediate|advanced|pro`) vs RU strings — pick ONE and document.
- Whether RR pairs need a dedicated model or reuse `RoundMatch` with pair slots — discretion (must not break playoff `Match`).

### Deferred Ideas (OUT OF SCOPE)
- Business logic: create/validate/generate/score — Phase 8 (core) + Phase 9 (engines).
- All UI (forms, bracket viz, localization, theme) — Phases 10–11.
- Exact validation rules for size/level/draws — Phase 8 (schema only stores).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | `User.skillLevel` required, one of 5 RU values; optional `User.birthDate` | §"User changes" — make `skillLevel String` (drop `?`), extend `skillLevels` 4→5, add `birthDate DateTime?` |
| DATA-02 | `Tournament` stores format / participantMode / level / price | §"Tournament changes" — 7 new fields, all String/Int with defaults per Pitfall 9 |
| DATA-03 | Round-robin model: round-robin matches + results/points for standings | `Round`+`RoundMatch`+`PlayerMatchScore` cover RR (use teamA1/B1 only for singles RR; pair slots for pairs RR) |
| DATA-04 | Americano/mexicano model: rotating-roster rounds + per-player points | `Round`+`RoundMatch` (4 User FK) + `PlayerMatchScore` (individual `pointsFor`) |
| DATA-05 | Participant = single player OR pair, no break to playoff pairs | `TournamentPlayer` (singles) added alongside existing `Pair` (pairs); `participantMode` discriminates |
| DATA-06 | Migration (reset+reseed ok) + both seeds updated for required level(5)+birthDate | §"Migration approach" + §"Seed updates" |
| DATA-07 | `scoringMode` sets/points; `setsPerMatch`/`gamesPerSet` no cap; points result = arbitrary ints per side | `scoringMode` field + `RoundMatch.pointsA/pointsB Int?` + `PlayerMatchScore` ints; remove conceptual cap (Phase 8 validates) |
</phase_requirements>

## Summary

This is a **schema-only** phase: no new dependencies, no business logic. The codebase already runs Prisma 6.19.3 + SQLite + Better Auth 1.6.14, uses the **String + zod-union** convention for all enum-like fields (no Prisma `enum` — "Pitfall 9"), and the entire playoff stack (`Tournament/Pair/Match/SetScore`) is locked and tested. The job is purely additive on the schema side plus two well-bounded mutations to existing models (`User.skillLevel` nullable→required+5 values; `Tournament` gets 7 new optional/defaulted fields), then a `migrate reset` + reseed.

The dominant risk is **not** technical — it's regression to the playoff path. The locked D4 decision (separate `Round/RoundMatch/PlayerMatchScore/TournamentPlayer` models) already eliminates that risk: nothing about `Match`/`Pair`/`SetScore` changes, so the four playoff test scripts (`bracket.test.ts`, `result.test.ts`, `registration.test.ts`, `tournament-status.test.ts`) must remain green by construction. The second risk is the `skillLevels` constant ripple: changing it 4→5 touches register/profile validation, Better Auth `additionalFields` (`required: false`→`true`), both seeds, and a hardcoded `skillLevelLabel` switch in the public tournament page.

**Primary recommendation:** Store level keys as **latin slugs** (`beginner|progressing|intermediate|advanced|pro`) — this matches the existing 4-value constant, keeps RU strings confined to the UI label layer (already established by `skillLevelLabel`), and avoids putting Cyrillic into DB values / FormData. Add all new models exactly as locked in D4, make `Tournament`'s new fields nullable-or-defaulted so reads of old-shaped rows never break, run `prisma migrate dev --name multiformat_data_model` (then `migrate reset` for the demo DB), and update both seeds to supply a required `skillLevel` + optional `birthDate`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Schema definition (models/fields/relations) | Database/Storage (Prisma schema) | — | Single source of truth; Prisma generates the client |
| Enum-like value constraint (format, level, scoringMode, status) | API/Backend (zod + TS union) | Database (String column) | Pitfall 9 — SQLite has no enum; validation lives in zod, DB stores String |
| Required-field enforcement (skillLevel) | API/Backend (Better Auth additionalFields + zod) | Database (NOT NULL via required schema field) | Better Auth validates presence at signup; DB column is non-null |
| Seed data | Database/Storage (seed scripts via Better Auth) | — | Recreates demo data post-reset; Better Auth hashes passwords |
| Migration | Database/Storage (Prisma migrate) | — | `migrate reset` rebuilds dev.db from migrations + seed |

## Standard Stack

No new libraries. Phase reuses the locked stack verified in `package.json`:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| prisma / @prisma/client | 6.19.3 | Schema, migrate, generate, type-safe client | Already in use; `migrate dev`/`reset` workflow established | `[VERIFIED: npx prisma --version → 6.19.3]` |
| SQLite | file (`DATABASE_URL`) | DB | Zero-setup thesis DB; established | `[VERIFIED: datasource provider="sqlite"]` |
| zod | 4.4.3 | Enum-like value validation (String + z.enum union) | Pitfall 9 convention | `[VERIFIED: package.json]` |
| better-auth | 1.6.14 | `additionalFields` carry domain User fields; seeds sign up via `auth.api.signUpEmail` | Established; `skillLevel` already an additionalField | `[VERIFIED: package.json + src/lib/auth.ts]` |
| tsx | 4.22.4 | Runs seed scripts + the self-contained `.test.ts` files | Established (`prisma.config.ts` seed hook, test "Run:" headers) | `[VERIFIED: package.json]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| String + zod-union | Prisma `enum` | SQLite has no native enum (CLAUDE.md "SQLite Gotchas"); project explicitly chose String + zod ("Pitfall 9"). DO NOT introduce Prisma enums. |
| Latin level slugs | RU strings as DB values | RU values would diverge from existing 4-value constant + put Cyrillic in FormData/DB. Reject — keep latin keys, RU in UI labels only. |
| `migrate reset` | Additive migration + backfill of `skillLevel` | Backfill needed because `skillLevel` goes nullable→required. CONTEXT explicitly permits reset for thesis — simplest correct path. |

**Installation:** None — no packages added.

## Package Legitimacy Audit

Not applicable — this phase installs **zero external packages**. All tooling (prisma, zod, better-auth, tsx) is already present and version-pinned in `package.json` (verified via `npx prisma --version` and `grep` on `package.json`). No `npm install` step in the plan.

## Architecture Patterns

### Data Flow (conceptual)

```
                            participantMode
                                  │
           ┌──────────────────────┴───────────────────────┐
        "pairs"                                         "singles"
           │                                               │
      ┌────┴─────┐                                  ┌───────┴────────┐
   format=                                       format=
   playoff │ round_robin(pairs)            round_robin(singles) │ americano │ mexicano
      │            │                                            │
   ┌──┴──┐     ┌───┴───────────────┐              ┌─────────────┴────────────────┐
  Pair  Match  Pair   Round/RoundMatch           TournamentPlayer  Round/RoundMatch
   │    SetScore │    (pair slots:               (userId)          (4 User FK:
   │    (LOCKED)  │     teamA1/teamB1 +                              teamA1/A2/B1/B2)
   │             │     teamA2/teamB2)                                     │
   │             │          │                                     PlayerMatchScore
   │             │     PlayerMatchScore                           (pointsFor/Against,
   │             │     (per pair → both                            per player)
   │             │      partners same                                   │
   └─ winnerId   │      pointsFor)                              standings = SUM(pointsFor)
      advancement│
                 └─ standings = wins/points per pair

  Tournament (parent of ALL): +format +participantMode +level +price
                              +scoringMode +targetPoints +totalRounds
                              (+ setsPerMatch/gamesPerSet now uncapped)
```

Reads (standings, bracket) = Server Components querying Prisma. Writes (create/register/score) = Server Actions. **Both are Phase 8/9** — this phase only shapes what they will read/write.

### Component Responsibilities (new + changed)

| Model | Status | Owns | Read by (future) |
|-------|--------|------|------------------|
| `Tournament` | CHANGED (+7 fields) | format config, scoring config, level, price | every page |
| `User` | CHANGED (skillLevel required+5, +birthDate) | player profile data | profile, partner picker, standings |
| `TournamentPlayer` | NEW | singles registration row | americano/mexicano/singles-RR registration + standings |
| `Round` | NEW | per-round container + status | mexicano gating (Phase 9), round display |
| `RoundMatch` | NEW | a court match in a round; 4 User FK + points result | RR/americano/mexicano match display + scoring |
| `PlayerMatchScore` | NEW | individual per-player points for a match | americano/mexicano standings |
| `Pair`/`Match`/`SetScore` | UNCHANGED | playoff single-elim (LOCKED) | bracket page (existing) |

### Pattern 1: String + zod-union ("Pitfall 9")
**What:** Every enum-like column is a `String` in Prisma with a `@default`, validated by a `z.enum([...] as const)` + exported TS union in `src/lib/validation/*`.
**When to use:** ALL new categorical fields (`format`, `participantMode`, `scoringMode`, `level`, `Round.status`, `teamSlot`).
**Example (existing — copy this shape):**
```prisma
// Source: prisma/schema.prisma:117 (Tournament.status)
status String @default("registration") // "registration" | "in_progress" | "finished"
```
```typescript
// Source: src/lib/validation/tournament.ts:11
export const tournamentStatuses = ["registration", "in_progress", "finished"] as const;
export type TournamentStatus = (typeof tournamentStatuses)[number];
```
> NOTE: The zod constants for `format`/`scoringMode`/`participantMode`/`level` are Phase 8 concerns (validation logic). In THIS phase, define only what the **schema** needs: the `String` columns + their `@default`s + the inline `// "a" | "b"` comments. Extending the `skillLevels` constant 4→5 IS in scope only because the schema requiredness depends on it and the seeds consume it. Decide with the planner whether to pre-create the empty zod constants now or leave them to Phase 8 — recommend leaving format/scoringMode zod to Phase 8 to keep this phase schema-pure, but extend `skillLevels` now (it already exists and seeds need it).

### Pattern 2: Named relations for multiple FKs to the same model
**What:** When one model has >1 FK to another, Prisma requires `@relation("Name")` on both sides.
**When to use:** `RoundMatch` has **4** FKs to `User` (teamA1/A2/B1/B2) → 4 named relations + 4 back-relations on `User`. Also `PlayerMatchScore.userId` → User (5th back-relation), and `TournamentPlayer.userId` → User (6th).
**Example (existing — `Pair` has 2 User FK, `Match` has 3 Pair FK):**
```prisma
// Source: prisma/schema.prisma:44 (User side)
pairsAsP1 Pair[] @relation("PairPlayer1")
pairsAsP2 Pair[] @relation("PairPlayer2")
// Source: prisma/schema.prisma:141 (Pair side)
player1   User   @relation("PairPlayer1", fields: [player1Id], references: [id])
```
> The 4 User FKs on `RoundMatch` are **nullable** (`teamA2Id`/`teamB2Id` null for singles RR/1v1; all four set for doubles formats). This is the documented FORMATS.md §4 shape. Each needs a unique relation name (e.g. `"RMTeamA1"`, `"RMTeamA2"`, `"RMTeamB1"`, `"RMTeamB2"`) and a matching back-relation array on `User`.

### Pattern 3: `onDelete: Cascade` down the ownership chain
**What:** Child rows cascade-delete with parent so deleting a `Tournament` cleans everything.
**When to use:** `TournamentPlayer.tournamentId`→Tournament Cascade; `Round.tournamentId`→Tournament Cascade; `RoundMatch.roundId`→Round Cascade; `PlayerMatchScore.roundMatchId`→RoundMatch Cascade. **Do NOT** cascade the User FKs (deleting a user should not silently delete match history — match existing `Pair.player1` which has no cascade).
**Example:** `prisma/schema.prisma:139` (`Pair.tournament ... onDelete: Cascade`), `:166` (`Match.tournament ... onDelete: Cascade`), `:206` (`SetScore.match ... onDelete: Cascade`).

### Anti-Patterns to Avoid
- **Touching `Match`/`Pair`/`SetScore`:** locked D4. Any nullable field added there or any `@@unique` loosened = playoff regression. Do not.
- **Prisma `enum`:** forbidden by Pitfall 9 / SQLite gotcha. Use `String` + comment.
- **Cyrillic DB values for level/format:** keep DB values latin; RU is a UI label concern (`skillLevelLabel`).
- **Putting validation logic in this phase:** equal-points rejection, size-by-format, target-points rules are Phase 8. Schema only stores ints/strings.
- **Adding business defaults that imply logic:** e.g. don't add a DB `@default(24)` for `targetPoints` — keep it `Int?` and let Phase 8 apply the 24 default (D6 says "configurable, app default"). Avoid baking format-specific semantics into column defaults.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing in seeds | Manual scrypt/bcrypt in seed scripts | `auth.api.signUpEmail({...})` (already done) | Better Auth produces the exact `Account` row shape; both seeds already do this (`prisma/seed.ts:33`, `scripts/seed-test-users.ts:68`) |
| Migration SQL | Hand-written ALTER TABLE | `prisma migrate dev` | Generates correct SQLite migration incl. table-rebuild for the nullable→required change |
| Enum validation | Custom validators | `z.enum([...] as const)` (Pitfall 9 pattern) | Established single-source-of-truth pattern |
| Test runner | Adding vitest/jest | Existing self-contained `tsx file.test.ts` scripts | No framework in repo by design; tests are runnable scripts (`Run: npx tsx ...`) |

**Key insight:** Everything this phase needs already has an established pattern in the repo. Introducing any new tool (test framework, enum approach, hashing) would contradict CLAUDE.md ("follow existing patterns, ask before new deps") and the thesis simplicity directive.

## Runtime State Inventory

> Rename/migration-adjacent (schema change + `migrate reset`). All categories checked.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `dev.db` SQLite file holds existing users/tournaments/pairs/matches with `skillLevel` nullable + no 5th level value. After `skillLevel`→required, old rows with NULL would violate the column. | `migrate reset` drops & recreates the DB, then reseed supplies valid 5-value `skillLevel`. No manual backfill. (CONTEXT D6 explicitly allows this.) |
| Live service config | None — no external services. SQLite is a local file, Better Auth runs in-process. | None. |
| OS-registered state | None — no schedulers, daemons, or registered processes. | None. |
| Secrets/env vars | `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `TEST_USER_PASSWORD` — names unchanged by this phase. Seeds still read them. | None (names stable; values untouched). |
| Build artifacts | `@prisma/client` generated into `node_modules` (`prisma-client-js`); imported as `@prisma/client`. After schema change it MUST be regenerated. | Run `prisma generate` (automatic in `migrate dev`/`reset`). TypeScript code referencing new models won't compile until regenerated. |

**The canonical question (after every file is updated, what still holds the old shape?):** The generated Prisma client in `node_modules` and the `dev.db` file. Both are refreshed by `prisma migrate reset` (which runs migrate → generate → seed). No other runtime state carries the old schema.

## Common Pitfalls

### Pitfall 1: nullable→required column on SQLite
**What goes wrong:** Making `User.skillLevel` non-null while rows hold NULL fails the migration / leaves invalid data.
**Why it happens:** SQLite can't add a NOT NULL constraint to a column with NULLs without a default or table rebuild; existing seeded users have no 5th-tier value either.
**How to avoid:** Use the locked `migrate reset` path (empty DB → no NULLs → reseed with valid values). Confirm both seeds set `skillLevel` for **every** user before resetting.
**Warning signs:** `migrate dev` prompts about data loss / non-null without default.

### Pitfall 2: Better Auth `required` mismatch
**What goes wrong:** Schema makes `skillLevel` required but `src/lib/auth.ts` still has `required: false` → signups (and seeds via `signUpEmail`) can omit it and write a row Prisma will reject (or Better Auth inserts empty).
**Why it happens:** Two sources of truth (Prisma column + Better Auth additionalFields).
**How to avoid:** Flip `src/lib/auth.ts:20` `skillLevel: { type: "string", required: true, input: true }`. Update register form/schema (`src/lib/validation/auth.ts:21` drop `.optional()`) — though strictly the form/schema part is Phase 8; at minimum the seeds must always pass `skillLevel`. Decide split with planner: the **schema requiredness + seeds + auth.ts required:true** belong here; the register-form UX can be Phase 8/11. Recommend doing `auth.ts` here so seeds don't break.
**Warning signs:** Seed run throws Prisma "Null constraint" on `user.skillLevel`, or a signup succeeds with empty level.

### Pitfall 3: `skillLevels` 4→5 ripple missed somewhere
**What goes wrong:** Adding `progressing` to the constant but the public page's hardcoded `skillLevelLabel` switch (`src/app/(public)/tournaments/[id]/page.tsx:28`) returns "—" for the new value.
**Why it happens:** That label map is a separate hardcoded switch, NOT derived from `skillLevels`.
**How to avoid:** Add a `case "progressing": return "прогрессирующий";` (and align the other RU labels with the CONTEXT spelling: новичок/прогрессирующий/средний/высокий/профессиональный — note current labels say "начинающий/продвинутый/профессионал", which differ from CONTEXT's RU wording). Decide with planner whether to also centralize labels into a `skillLevelLabels` map — recommend a single map next to `skillLevels` in `src/lib/validation/auth.ts` to prevent future drift. **Consumers to check (verified via grep):** `validation/auth.ts` (constant + register schema), `validation/profile.ts` (profile schema), `register-form.tsx`, `profile-form.tsx`, `tournaments/[id]/page.tsx` (label switch). The order-sensitive insert is **between** beginner and intermediate.
**Warning signs:** Profile/register dropdown missing the new tier; standings/list shows "—" for progressing players.

### Pitfall 4: New `RoundMatch` User FKs without back-relations
**What goes wrong:** Prisma validate fails — every relation needs both sides.
**Why it happens:** 4 User FKs on RoundMatch + userId on PlayerMatchScore + userId on TournamentPlayer = 6 new back-relation arrays required on `User`.
**How to avoid:** Add all six back-relation fields on `User` with matching `@relation` names. Run `prisma validate` before generate.
**Warning signs:** `prisma validate` error "missing an opposite relation field".

### Pitfall 5: Seed idempotency / nickname collisions after adding required fields
**What goes wrong:** Updating seeds but breaking the existing email-keyed idempotency guard, or test-users loop aborting on a nickname clash.
**Why it happens:** Both seeds guard on email existence only; nickname `@@unique` is separate (WR-01 hardening already in both).
**How to avoid:** Keep the existing guard/try-catch shape; just add `skillLevel` (and optional `birthDate`) to the `signUpEmail` body / post-update. `seed-test-users.ts:34` `SKILL_LEVELS` array must grow to 5 (latin keys) so the round-robin assignment covers `progressing`. `prisma/seed.ts` admin must also pass a valid `skillLevel` (e.g. `"pro"`).
**Warning signs:** Seed throws null-constraint on skillLevel; or duplicate-nickname FAILED_TO_CREATE_USER.

## Code Examples

### New models (illustrative — planner finalizes names/indexes per discretion)
```prisma
// --- Domain: TournamentPlayer (Phase 7) — singles registration ---
model TournamentPlayer {
  id           String     @id @default(cuid())
  tournamentId String
  tournament   Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  userId       String
  user         User       @relation("TournamentPlayerUser", fields: [userId], references: [id])
  createdAt    DateTime   @default(now())

  @@unique([tournamentId, userId])
  @@index([tournamentId])
  @@map("tournament_player")
}

// --- Domain: Round (Phase 7) — round container (mexicano materializes one-by-one) ---
model Round {
  id           String       @id @default(cuid())
  tournamentId String
  tournament   Tournament   @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  roundNumber  Int
  status       String       @default("pending") // "pending" | "in_progress" | "finished"
  createdAt    DateTime     @default(now())
  matches      RoundMatch[]

  @@unique([tournamentId, roundNumber])
  @@map("round")
}

// --- Domain: RoundMatch (Phase 7) — a court match in a round (RR/americano/mexicano) ---
// 4 nullable User FK = two dynamic teams. Singles RR/1v1 fills only teamA1/teamB1.
// pointsA/pointsB hold the points-mode result (arbitrary ints, NOT via SetScore).
model RoundMatch {
  id          String  @id @default(cuid())
  roundId     String
  round       Round   @relation(fields: [roundId], references: [id], onDelete: Cascade)
  courtNumber Int
  teamA1Id    String?
  teamA1      User?   @relation("RMTeamA1", fields: [teamA1Id], references: [id])
  teamA2Id    String?
  teamA2      User?   @relation("RMTeamA2", fields: [teamA2Id], references: [id])
  teamB1Id    String?
  teamB1      User?   @relation("RMTeamB1", fields: [teamB1Id], references: [id])
  teamB2Id    String?
  teamB2      User?   @relation("RMTeamB2", fields: [teamB2Id], references: [id])
  pointsA     Int?    // points-mode team A score (null until recorded)
  pointsB     Int?    // points-mode team B score
  playerScores PlayerMatchScore[]

  @@index([roundId])
  @@map("round_match")
}

// --- Domain: PlayerMatchScore (Phase 7) — individual per-player points ---
// Both partners of a team get the SAME team pointsFor. pointsAgainst REQUIRED
// (tiebreak + mexicano determinism). teamSlot = "A" | "B".
model PlayerMatchScore {
  id           String     @id @default(cuid())
  roundMatchId String
  roundMatch   RoundMatch @relation(fields: [roundMatchId], references: [id], onDelete: Cascade)
  userId       String
  user         User       @relation("PlayerMatchScoreUser", fields: [userId], references: [id])
  teamSlot     String     // "A" | "B"
  pointsFor    Int
  pointsAgainst Int

  @@unique([roundMatchId, userId])
  @@index([userId])
  @@map("player_match_score")
}
```

### User changes (additive + one requiredness flip)
```prisma
// CHANGE prisma/schema.prisma:39 — was: skillLevel String?
skillLevel String   // "beginner"|"progressing"|"intermediate"|"advanced"|"pro" (5, USER req)
// ADD:
birthDate  DateTime? // optional date of birth
// ADD 6 back-relations:
tournamentPlayers TournamentPlayer[] @relation("TournamentPlayerUser")
roundMatchesAsA1  RoundMatch[]       @relation("RMTeamA1")
roundMatchesAsA2  RoundMatch[]       @relation("RMTeamA2")
roundMatchesAsB1  RoundMatch[]       @relation("RMTeamB1")
roundMatchesAsB2  RoundMatch[]       @relation("RMTeamB2")
playerMatchScores PlayerMatchScore[] @relation("PlayerMatchScoreUser")
```

### Tournament changes (all additive — defaults preserve old reads)
```prisma
// ADD to model Tournament (after gamesPerSet):
format          String  @default("playoff")  // "playoff"|"round_robin"|"americano"|"mexicano"
participantMode String  @default("pairs")    // "pairs"|"singles"
level           String  @default("intermediate") // one of the 5 skill levels (matching for Phase 8)
price           Int?    // display price in minor currency units; null = free/unset
scoringMode     String  @default("sets")     // "sets"|"points"
targetPoints    Int?    // points-mode target sum per match (app default 24)
totalRounds     Int?    // americano/mexicano round count
// CHANGE setsPerMatch/gamesPerSet: keep @default(3)/(6) but document "no upper cap"
//   (the cap is conceptual — there's no DB max; Phase 8 validation no longer hard-limits).
//   No type change needed; they remain Int with defaults.
// ADD back-relations:
tournamentPlayers TournamentPlayer[]
rounds            Round[]
```
> `price` Int vs Decimal: recommend **Int** (minor units) — SQLite Decimal maps to a JS Decimal/string and adds friction for a thesis with display-only pricing. `level` default: give it a default so old/partial inserts don't break; `intermediate` is a safe neutral.

### Extend skillLevels constant (in scope — seeds depend on it)
```typescript
// src/lib/validation/auth.ts:3 — insert "progressing" between beginner and intermediate
export const skillLevels = ["beginner", "progressing", "intermediate", "advanced", "pro"] as const;
// Recommended: add a co-located RU label map (replaces hardcoded switch in tournaments/[id]/page.tsx)
export const skillLevelLabels: Record<(typeof skillLevels)[number], string> = {
  beginner: "новичок",
  progressing: "прогрессирующий",
  intermediate: "средний",
  advanced: "высокий",
  pro: "профессиональный",
};
```

## Migration approach

**Recommended (simplest correct path, matches CONTEXT D6):**
1. Edit `schema.prisma` (new models + User/Tournament changes).
2. `npx prisma validate` — catches missing back-relations early.
3. `npx prisma migrate dev --name multiformat_data_model` — generates the migration AND regenerates the client. On the existing dev.db this may flag the `skillLevel` nullable→required change as data-loss-risky.
4. For the demo DB, run `npx prisma migrate reset` (drops, re-applies all migrations, runs the `prisma.config.ts` seed hook = `tsx prisma/seed.ts`). Then `npm run seed:test-users`.

**Why not additive + backfill:** `skillLevel` going nullable→required requires every existing row to have a value. Backfill is extra migration SQL for zero thesis benefit; reset is explicitly sanctioned. Keep it.

**Migration files:** 7 already applied (latest `20260606180646_add_user_nickname`). The new migration appends as the 8th. `migration_lock.toml` provider = sqlite — unchanged.

**Note on the new migration directory:** because `skillLevel` becomes NOT NULL, Prisma's SQLite migration will rebuild the `user` table (create-new / copy / drop / rename). That's normal and handled automatically — do not hand-edit it.

## Seed updates

| File | Change |
|------|--------|
| `prisma/seed.ts` (admin) | Add `skillLevel: "pro"` (or any valid latin key) to the `signUpEmail` body (line ~34). Optionally set `birthDate` via the post-create `prisma.user.update` (currently sets role). Keep email-keyed idempotency guard. |
| `scripts/seed-test-users.ts` | Extend `SKILL_LEVELS` array (line 34) to all 5 latin keys so the round-robin `(i-1)%5` assignment covers `progressing`. `skillLevel` is already passed to `signUpEmail` (line 69) — now always valid. Optionally add a deterministic `birthDate` (e.g. via `prisma.user.update` alongside `courtSide`, line 71). Keep idempotency + try/catch (WR-01). |

## Keeping playoff intact

By D4, **no playoff model changes** → playoff is safe by construction. Verification = these 4 self-contained test scripts must still pass unchanged:

| Test | File | Covers | Why it stays green |
|------|------|--------|--------------------|
| Bracket gen | `src/lib/services/bracket.test.ts` | BRKT-01/03 (advance/ROUNDS/matchCount/generateBracket) | Uses fake prisma; `Match`/`Pair` unchanged |
| Result recording | `src/lib/services/result.test.ts` | recordResult/setWinner/matchWinnerFromSets | `Match`/`SetScore` unchanged |
| Registration | `src/lib/services/registration.test.ts` | pair registration invariants | `Pair` unchanged (note: reads `User.skillLevel` via select at `registration.ts:121` — still valid as a column) |
| Status machine | `src/lib/services/tournament-status.test.ts` | ALLOWED_TRANSITIONS | `Tournament.status` unchanged |

Plus the validation tests: `validation/tournament.test.ts`, `validation/profile.test.ts`, `validation/registration.test.ts`. **Watch `profile.test.ts`** — it asserts `skillLevel rejects invalid value "legend"` and accepts each valid value; after adding `progressing` it should still pass (progressing isn't tested as invalid), but if the planner tightens profile schema, re-run it. These tests do NOT assert the *count* of valid levels, so extending 4→5 doesn't break them — but `progressing` won't be exercised unless a test is added (optional, Phase 8).

## Validation Architecture

> nyquist_validation not explicitly disabled → included. No framework in repo by design.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None — self-contained `tsx` scripts using `node:assert/strict`; each file's header gives `Run: npx tsx <file>` |
| Config file | none |
| Quick run command | `npx tsx src/lib/services/<name>.test.ts` (per file) |
| Full suite command | Run each `*.test.ts` via tsx (no aggregate script exists; planner may add a loop, but adding a test runner is OUT of thesis scope) |

### Phase Requirements → Test Map
This is a schema phase — most verification is **structural** (prisma validate/generate + migration + existing tests stay green), not new unit tests.

| Req | Behavior | Test Type | Command | Exists? |
|-----|----------|-----------|---------|---------|
| DATA-01..07 | schema compiles + client generates | structural | `npx prisma validate && npx prisma generate` | n/a (CLI) |
| DATA-06 | migration applies + seeds run | structural | `npx prisma migrate reset --force && npm run seed:test-users` | n/a |
| DATA-05 (no playoff break) | playoff logic unchanged | unit (existing) | `npx tsx src/lib/services/bracket.test.ts` (and result/registration/tournament-status) | ✅ |
| DATA-01 (level validation) | 5-value enum accepted/invalid rejected | unit (existing) | `npx tsx src/lib/validation/profile.test.ts` | ✅ (extend optional) |

### Sampling Rate
- **Per task:** `npx prisma validate` after each schema edit.
- **Per phase gate:** `prisma validate` + `prisma generate` clean; `migrate reset` + both seeds succeed; all 4 playoff test scripts + 3 validation test scripts pass; `prisma studio` visually confirms new tables.

### Wave 0 Gaps
- None required. Existing test scripts cover the playoff-intact invariant. Optionally add a `progressing`-accepts case to `profile.test.ts` (low value — defer to Phase 8 when profile schema is finalized).

## Security Domain

> security_enforcement not disabled → included. Schema-only phase, minimal surface.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | indirect | Better Auth (unchanged); seeds hash via `signUpEmail` |
| V3 Session Management | no | not touched |
| V4 Access Control | no (schema) | enforced in Server Actions (Phase 8) |
| V5 Input Validation | deferred | String + zod-union is the mechanism; format/scoringMode validation = Phase 8 |
| V6 Cryptography | indirect | passwords via Better Auth scrypt (`Account.password`); never hand-rolled |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Invalid enum value persisted (e.g. `format="hax"`) | Tampering | zod `z.enum` at the Server Action boundary (Phase 8); DB stores String, app validates |
| Secrets in seeds | Info disclosure | env-only creds (`ADMIN_EMAIL/PASSWORD`, `TEST_USER_PASSWORD`) — already the pattern; never commit |
| Cascade delete data loss | DoS/integrity | Cascade only down ownership chain (Tournament→Round→RoundMatch→PlayerMatchScore); User FKs NOT cascaded |

## State of the Art

| Old | Current | Impact |
|-----|---------|--------|
| `skillLevel` 4 latin values, optional | 5 latin values, required | +`progressing` tier; ripple to constant/auth/seeds/label-map |
| Tournament = playoff-only | Tournament parents 4 formats | 7 new fields, all defaulted/nullable (back-compatible reads) |
| Single match model (`Match`) | `Match` (playoff) + `RoundMatch` (round-based) | clean separation, no discriminator |

**Deprecated/outdated:** Nothing. Prisma 6 String-enum convention is intentional (NOT a Prisma-7 migration). Do not introduce Prisma `enum` or driver adapters.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `price` best as `Int` (minor units) not `Decimal` | Tournament changes | Low — display-only; CONTEXT leaves it to discretion. Planner may pick Decimal. |
| A2 | `level` should have a `@default` (`intermediate`) so partial inserts don't break | Tournament changes | Low — could be required-no-default; default is safer for additive migration. |
| A3 | RR-pairs can reuse `RoundMatch` (teamA1/A2 + teamB1/B2 as the two pairs) rather than a 7th model | Architecture | Medium — CONTEXT marks this discretion. If pairs RR needs FK-to-`Pair` for standings, a thin `RoundMatch.pairAId/pairBId Int?` could be cleaner; recommend reuse + document. |
| A4 | `auth.ts` `required:true` + `skillLevels` extension belong in THIS phase (seeds depend on it); register-form UX defers to Phase 8 | Pitfall 2/3 | Low — without `required:true`/extended constant, seeds break; safe to include. |
| A5 | `targetPoints` stays `Int?` with NO DB default (app applies 24) | Tournament changes | Low — D6 says configurable app default; DB default would imply logic. |
| A6 | CONTEXT RU labels (новичок/средний/высокий/профессиональный) supersede current page labels (начинающий/продвинутый/профессионал) | Pitfall 3 | Low — cosmetic; align label map to CONTEXT wording. |

## Open Questions

1. **RR-pairs storage: reuse `RoundMatch` or add a pair-slot model?**
   - Known: CONTEXT leaves this to planner discretion; must not break playoff `Match`.
   - Unclear: whether pairs-RR standings are cleaner with FK-to-`Pair` vs 4 User FKs.
   - Recommendation: reuse `RoundMatch` (teamA1/A2 = pair A, teamB1/B2 = pair B); document. Avoids a 7th model. Revisit only if Phase 9 standings need pair identity.

2. **Should the register-form/auth.ts `required` flip happen here or Phase 8?**
   - Known: seeds break unless `skillLevels` is extended now; `auth.ts required:true` keeps seeds honest.
   - Recommendation: include constant extension + `auth.ts required:true` + label map here; leave register-form UX/error wiring to Phase 8/11.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| prisma CLI | migrate/validate/generate | ✓ | 6.19.3 | — |
| tsx | seeds + test scripts | ✓ | 4.22.4 | — |
| SQLite (file) | DB | ✓ | bundled | — |
| node | runtime | ✓ | (project) | — |

No missing dependencies.

## Sources

### Primary (HIGH confidence)
- `prisma/schema.prisma` (full read) — current models, conventions, named relations, cascade pattern, Pitfall 9 comments.
- `prisma/seed.ts`, `scripts/seed-test-users.ts` — idempotent seed pattern via Better Auth `signUpEmail`.
- `src/lib/validation/auth.ts:3,21`, `profile.ts`, `tournament.ts` — String+zod-union convention; `skillLevels` constant.
- `src/lib/auth.ts:17-26` — Better Auth `additionalFields` (skillLevel required:false → must flip).
- `.planning/research/FORMATS.md` §4 + §6 (D1–D7) — data-model requirements + locked format decisions.
- `.planning/phases/07-multiformat-data-model/07-CONTEXT.md` — locked architecture.
- `.planning/REQUIREMENTS.md:14-20` — DATA-01..07 text.
- `npx prisma --version` → 6.19.3; `package.json` → zod 4.4.3, better-auth 1.6.14, tsx 4.22.4, next 16.2.7. `[VERIFIED]`
- grep of `skillLevel`/`skillLevels` across `src/`+`scripts/` — exhaustive ripple list (5 consumers + label switch at `tournaments/[id]/page.tsx:28`).

### Secondary
- CLAUDE.md "SQLite Gotchas" / "What NOT to Use" — no Prisma enum, no Prisma 7, no new deps.

### Tertiary
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified from registry/package.json; no new deps.
- Architecture: HIGH — models specified verbatim in CONTEXT D4 + FORMATS §4; relation/cascade patterns copied from existing schema.
- Pitfalls: HIGH — ripple list grep-verified; nullable→required + Better Auth mismatch are concrete codebase facts.

**Research date:** 2026-06-07
**Valid until:** stable — schema/conventions are project-internal; ~30 days.
