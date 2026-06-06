---
phase: 02-tournaments-status-machine
plan: 03
subsystem: tournaments
tags: [next-app-router, rsc, public-route-group, tailwind, status-badge]
requires:
  - listTournaments / getTournament services (Plan 01)
  - TournamentStatus union (Plan 01 validation)
provides:
  - TournamentStatusBadge (RU status → Tailwind pill)
  - Public /tournaments list page (anon-viewable) + empty-state
  - Public /tournaments/[id] detail page (anon-viewable) + not-found + 0/size pairs placeholder
affects:
  - src/app/(public)/* (new public route group)
tech-stack:
  added: []
  patterns:
    - RSC reads via service directly (no client fetch); Prisma never crosses to client
    - (public) route group keeps /tournaments URL with no auth guard
    - Next 16 params is a Promise — await params for dynamic id
key-files:
  created:
    - src/components/tournament-status-badge.tsx
    - src/app/(public)/tournaments/page.tsx
    - src/app/(public)/tournaments/[id]/page.tsx
  modified: []
decisions:
  - "notFound() (next/navigation) for unknown id — uses framework not-found state, minimal code"
  - "Status badge accepts plain string with typed-record lookup + raw-value fallback (DB stores status as String)"
  - "Detail pairs section is a static 0/size placeholder — NO Pair query (Pair logic is Phase 3)"
metrics:
  duration: ~5m
  completed: 2026-06-06
  tasks: 3
  files: 3
---

# Phase 2 Plan 03: Public View Vertical Slice Summary

Read/consumer side of the phase: the only anonymous-reachable surface. A reusable RU `TournamentStatusBadge`, a public `/tournaments` list (newest-first, badge per row, empty-state), and a public `/tournaments/[id]` detail (info + status + fixed single-elim format + conditional date/location + `0/size` registered-pairs placeholder + not-found). Both pages are Server Components reading directly through the Plan-01 services with no auth guard — Prisma stays server-side.

## What Was Built

- **TournamentStatusBadge** (`src/components/tournament-status-badge.tsx`): pure presentational Server Component. Typed-record maps `registration`→«Регистрация открыта», `in_progress`→«Идёт», `finished`→«Завершён» to RU labels + distinct Tailwind pills (green/amber/grey, reusing profile-form pill style). Unknown status falls back to the raw value (no throw). No `"use client"`.
- **Public list** (`src/app/(public)/tournaments/page.tsx`): public RSC, no guard. `listTournaments(prisma)` (createdAt desc from Plan 01) → rows with name `<Link>` to detail, `{size} пар`, and `<TournamentStatusBadge>`. Empty DB → «Турниров пока нет.» empty-state. `(public)` route group keeps the `/tournaments` URL.
- **Public detail** (`src/app/(public)/tournaments/[id]/page.tsx`): public RSC, no guard. Awaits `params` (Next 16 Promise), `getTournament(prisma, id)`; null → `notFound()`. Renders name + status badge, size, fixed format "Single-elimination (пары)", date/location only when set, and a `0/{size}` registered-pairs section with a «Пока нет зарегистрированных пар.» placeholder. Does NOT query the Pair model (Phase 3).

## Tasks & Commits

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | TournamentStatusBadge (RU labels) | `72cc05f` (feat) |
| 2 | Public tournament list page + empty-state | `27dee7b` (feat) |
| 3 | Public tournament detail page (info + status + 0/size + not-found) | `2de3bef` (feat) |

## Verification Output

- `npx tsc --noEmit` → clean (run after each task; exit 0).
- `npm run build` → "Compiled successfully in 2.2s", TypeScript finished, 11/11 static pages generated. Route table includes both `ƒ /tournaments` and `ƒ /tournaments/[id]` (server-rendered on demand). Exit 0.
- Routes are unguarded RSCs (no `requireUser`/`requireAdmin` import) → reachable by anonymous visitors.
- RU labels render exactly via the typed record: Регистрация открыта / Идёт / Завершён.
- Unknown id path calls `notFound()` → Next not-found state, not a 500.
- No Prisma client / server secrets in client bundle (badge + both pages are RSC/presentational; no `"use client"`).

## Deviations from Plan

None — plan executed exactly as written.

## Deferred Manual Checks

- **Browser visual/functional render** (human-verify, browser-only): auto-mode auto-approved and deferred. `npm run build` confirms both routes compile and are present; live anonymous-200 + visual badge/empty-state/not-found checks are a browser-only step.

## Requirements

- **TOUR-02** (public list, newest-first, status badges, empty-state) — delivered.
- **TOUR-03** (public detail: info, status, fixed format, conditional date/location, 0/size placeholder, not-found) — delivered.

## Self-Check: PASSED

- FOUND: src/components/tournament-status-badge.tsx
- FOUND: src/app/(public)/tournaments/page.tsx
- FOUND: src/app/(public)/tournaments/[id]/page.tsx
- FOUND commits: 72cc05f, 27dee7b, 2de3bef
