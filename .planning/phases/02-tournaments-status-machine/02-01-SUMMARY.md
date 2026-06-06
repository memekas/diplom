---
phase: 02-tournaments-status-machine
plan: 01
subsystem: tournaments
tags: [prisma, zod, status-machine, services, validation, tdd]
requires: []
provides:
  - Tournament Prisma model + applied migration (relation-less)
  - createTournament / listTournaments / getTournament services
  - transitionTournament + isAllowedTransition + ALLOWED_TRANSITIONS (TOUR-04 status machine)
  - createTournamentSchema / tournamentStatusSchema / parseTournamentForm validation
affects:
  - prisma/schema.prisma
  - prisma/dev.db
tech-stack:
  added: []
  patterns:
    - thin-action→zod→service→revalidate (reused from profile.ts)
    - prisma-client-in, explicit select (framework-agnostic services)
    - status as String + zod-union + DB-checked transition guard (Pitfall 4)
key-files:
  created:
    - src/lib/validation/tournament.ts
    - src/lib/validation/tournament.test.ts
    - src/lib/services/tournament-status.ts
    - src/lib/services/tournament-status.test.ts
    - src/lib/services/tournament.ts
    - prisma/migrations/20260606133517_add_tournament/migration.sql
  modified:
    - prisma/schema.prisma
decisions:
  - "Tournament kept relation-less; Pair (Phase 3) / Match (Phase 4/5) add back-relations later — avoids speculative schema (plan-checker warning #2)"
  - "status stored as String + zod enum (not Prisma enum) per CONTEXT D; terminal = 'finished'"
  - "TDD tests are dependency-free tsx assertion scripts; async cases wrapped in main() IIFE because tsx emits CJS (no top-level await)"
metrics:
  duration: ~4m
  completed: 2026-06-06
  tasks: 3
  files: 7
---

# Phase 2 Plan 01: Tournament Model + Status Machine Summary

Foundation slice: relation-less `Tournament` Prisma model (with `setsPerMatch=3`/`gamesPerSet=6` defaults so Phase 5 needs no migration), a zod validation schema (name required; `size ∈ {4,8,16}`; date/location optional; status union), and the two domain services — `createTournament` (hard-sets `status: "registration"`) plus the single server-side, DB-checked status machine `transitionTournament` (TOUR-04). Status guards and validation written test-first as dependency-free `tsx` assertion scripts.

## What Was Built

- **Validation** (`src/lib/validation/tournament.ts`): `tournamentSizes [4,8,16]`, `tournamentStatuses [registration,in_progress,finished]`, `createTournamentSchema` (size coerced from form string then membership-constrained; name trimmed+required; date empty→undefined / parseable→Date; location empty→undefined), `tournamentStatusSchema` (zod enum), `parseTournamentForm` (discriminated `{ok,data|errors}` mirroring `parseProfileForm`).
- **Status machine** (`src/lib/services/tournament-status.ts`): `ALLOWED_TRANSITIONS` (registration→in_progress→finished, finished terminal), pure `isAllowedTransition`, and `transitionTournament(prisma,id,from,to)` which re-reads DB status, rejects when DB status ≠ supplied `from` (client not trusted — T-02-01), rejects illegal edges, then updates. Framework-agnostic for Phase 4/5 reuse.
- **Tournament service** (`src/lib/services/tournament.ts`): `createTournament` (status hard-set to `registration` — T-02-02), `listTournaments` (createdAt desc), `getTournament` (null on miss); explicit `tournamentSelect`.
- **Model + migration**: `model Tournament` (relation-less) + applied migration `20260606133517_add_tournament` (`status` default `registration`, `setsPerMatch` default 3, `gamesPerSet` default 6).

## Tasks & Commits

| Task | Name | Commit(s) |
| ---- | ---- | --------- |
| 1 | Tournament validation schema + status union (TDD) | `0827801` (test/RED), `cb5d3d8` (feat/GREEN) |
| 2 | Status machine transitionTournament + guards (TDD, TOUR-04) | `0519685` (test/RED), `7fff0d6` (feat/GREEN) |
| 3 | [BLOCKING] Tournament model + migration + service | `38cdb5c` (feat) |

## Verification Output

- `npx tsx src/lib/validation/tournament.test.ts` → 32 assertions passed, exit 0.
- `npx tsx src/lib/services/tournament-status.test.ts` → 16 assertions passed, exit 0 (all 9 ordered status pairs asserted; stale-`from` + illegal skip + backward edge all throw; no write attempted on rejection).
- `npx prisma migrate status` → "Database schema is up to date!" (2 migrations, no drift).
- `migration.sql` → `tournament` table with `status DEFAULT 'registration'`, `setsPerMatch DEFAULT 3`, `gamesPerSet DEFAULT 6`.
- `npx tsc --noEmit` → clean.
- `npm run build` → "Compiled successfully in 2.3s", TypeScript finished, 9/9 static pages generated.
- Phase 1 auth models (User/Session/Account/Verification) and the kysely `0.28.17` override → unchanged (verified via `git diff`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tsx top-level await in status-machine test**
- **Found during:** Task 2 (RED run)
- **Issue:** tsx/esbuild emits CJS for the test; top-level `await` on the async `transitionTournament` cases failed to transform.
- **Fix:** Wrapped the async assertions in an `async function main()` invoked via `main().then(...).catch(exit(1))`; synchronous pure-guard assertions stay top-level. No production code affected.
- **Files modified:** `src/lib/services/tournament-status.test.ts`
- **Commit:** `0519685`

**Schema scope (per prompt directive, not a code deviation):** Tournament was kept relation-less — no `pairs Pair[]`/`matches Match[]` and no Pair/Match stubs — per the prompt's `<schema_decision>` (plan-checker warning #2). The plan's Task 3 explicitly permitted omitting relations when a relation-less model validates green; `prisma validate` is green.

## Requirements

- **TOUR-01** (data foundation) and **TOUR-04** (server-side status machine): logic + model delivered here. Full requirement completion lands when the Wave-2 UI plans (admin create action, public list/detail) wire these services — noted as partially satisfied at the data/service layer.

## Self-Check: PASSED

- FOUND: src/lib/validation/tournament.ts
- FOUND: src/lib/validation/tournament.test.ts
- FOUND: src/lib/services/tournament-status.ts
- FOUND: src/lib/services/tournament-status.test.ts
- FOUND: src/lib/services/tournament.ts
- FOUND: prisma/migrations/20260606133517_add_tournament/migration.sql
- FOUND commits: 0827801, cb5d3d8, 0519685, 7fff0d6, 38cdb5c
