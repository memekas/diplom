---
phase: 10-ux-foundation
plan: 02
subsystem: ux-foundation
tags: [home, tournaments-list, status-filter, server-component, i18n]
requires:
  - "formatLabels/tournamentKindLabels/skillLevelLabels RU maps (10-01)"
  - "TournamentStatusBadge dark pills (10-01)"
provides:
  - "listTournaments status filter (opts.status -> where.status)"
  - "Home Server Component listing registration-open tournaments (HOME-01)"
  - "(public)/tournaments list honors ?status= filter (enables 10-03 «Прошедшие турниры»)"
affects:
  - src/lib/services/tournament.ts
  - src/lib/services/tournament.test.ts
  - src/app/page.tsx
  - src/app/(public)/tournaments/page.tsx
tech-stack:
  added: []
  patterns:
    - "Optional service filter: spread {where:{status}} only when arg present (backward compat)"
    - "Next 16 async searchParams validated against zod status tuple before use"
    - "Prisma String columns cast `as keyof typeof labelMap` for RU label indexing (mirrors [id] page)"
key-files:
  created:
    - src/lib/services/tournament.test.ts
  modified:
    - src/lib/services/tournament.ts
    - src/app/page.tsx
    - src/app/(public)/tournaments/page.tsx
decisions:
  - "listTournaments(prisma, opts?) — optional `{status}`; no arg keeps where-less query for backward compat with existing callers"
  - "tournaments/page.tsx validates searchParams.status against tournamentStatuses; unknown/absent -> show all (no error)"
  - "Card date uses toLocaleDateString('ru-RU') (date-only) vs [id] page toLocaleString (date+time)"
metrics:
  duration: ~6m
  completed: 2026-06-07
---

# Phase 10 Plan 02: Home tournament listing + status filter Summary

Extended `listTournaments` with an optional server-side `status` filter (unit-tested via fake-prisma), replaced the static English home splash with an async Server Component that lists registration-open tournaments as RU-localized cards linking to `/tournaments/[id]`, and fixed plan-checker W1 so the public tournaments list reads `?status=` (enabling the 10-03 «Прошедшие турниры» link to actually filter).

## What Was Built

- **Task 1 — status filter + TDD test** (`src/lib/services/tournament.ts`, `tournament.test.ts`): `listTournaments(prisma, opts?: { status?: TournamentStatus })` spreads `{ where: { status } }` only when `opts.status` is set; no-arg call keeps the prior where-less query. Self-contained `node:assert/strict` test with hand-written fake prisma capturing `findMany` args verifies (a) no `where` when no status, (b) `where.status==="registration"`, (c) `where.status==="finished"`. RED commit `96bcaba`, GREEN commit `9c0caaf`.
- **Task 2 — home Server Component** (`src/app/page.tsx`): rewritten as `async` Server Component calling `listTournaments(prisma, { status: "registration" })`; renders «Открытые турниры» heading + cards (name, `formatLabels`/`tournamentKindLabels`/`skillLevelLabels`, size, optional RU date) linking to `/tournaments/${t.id}`; RU empty state «Сейчас нет открытых турниров»; mobile-first `flex-wrap` cards, `max-w-2xl`, `border-current/15`/`opacity-70` dark palette. No English strings remain. Commit `8398439`.
- **W1 fix — searchParams.status** (`src/app/(public)/tournaments/page.tsx`): reads Next 16 async `searchParams.status`, validates against `tournamentStatuses`, passes valid value to `listTournaments`; unknown/absent → all tournaments. Makes the 10-03 header «Прошедшие турниры» (`?status=finished`) filter functional. Commit `287c237`.

## Verification

- `npx tsx src/lib/services/tournament.test.ts` → 3 assertions passed, exit 0.
- `npx tsx src/lib/services/tournament-status.test.ts` → PASS (regression, status type untouched).
- `npx tsc --noEmit` → exit 0.
- `npx next build` → success; `/` now ƒ (Dynamic, server-rendered).
- `src/app/page.tsx` contains `listTournaments(prisma, { status: "registration" })` and `/tournaments/${t.id}`; no `Register as a pair` / `Log in` / `Padel Tournaments`.
- Visual (cards / responsive / dark) deferred to end-of-phase human-verify per plan.

## Deviations from Plan

### Added (in-scope per orchestrator brief)

**1. [Rule 3 - Blocking] Cast Prisma String columns to label-map key types**
- **Found during:** Task 2
- **Issue:** `t.format`/`t.participantMode`/`t.level` are typed `string` by Prisma (SQLite String columns); indexing the `Record<tuple, string>` label maps directly raised TS7053.
- **Fix:** `formatLabels[t.format as keyof typeof formatLabels]` etc., mirroring the existing `skillLevelLabel` cast in `(public)/tournaments/[id]/page.tsx`.
- **Files modified:** src/app/page.tsx
- **Commit:** 8398439

**2. W1 plan-checker fix** (explicitly requested in orchestrator brief, not original plan tasks) — see «W1 fix» above. Commit `287c237`.

## Self-Check: PASSED

- FOUND: src/lib/services/tournament.ts, src/lib/services/tournament.test.ts, src/app/page.tsx, src/app/(public)/tournaments/page.tsx
- FOUND commits: 96bcaba, 9c0caaf, 8398439, 287c237
