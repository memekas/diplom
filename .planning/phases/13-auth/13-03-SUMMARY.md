---
phase: 13-auth
plan: 03
subsystem: public-tournaments-list
tags: [ui-restyle, court, server-filtering, container-queries, read-only-query]
requires:
  - "Phase 12 Court tokens + _base component layer (globals.css)"
  - "listTournaments service (Plan 01)"
  - "TournamentStatusBadge component"
provides:
  - "listTournaments read-only facet filter (status/format/level/participantMode/q) + _count capacity"
  - "Court 004 dense tournaments list (server-side filtering, phone-card reflow)"
  - "filter-bar.tsx client leaf (popover + outside-click + .fcount + facet→URL)"
  - "co-located tournaments.css (004 classes, token-only)"
affects:
  - "src/app/(public)/tournaments/page.tsx"
  - "src/lib/services/tournament.ts"
tech-stack:
  added: []
  patterns:
    - "Server-side facet filtering: validated searchParams → typed Prisma where (no client row-hiding)"
    - "Container-query reflow via grid-template-areas (same DOM, no field hiding)"
    - "Token-scoped --chev CSS-mask chevron (defined on .cq, globals.css untouched)"
key-files:
  created:
    - "src/app/(public)/tournaments/tournaments.css"
    - "src/app/(public)/tournaments/filter-bar.tsx"
  modified:
    - "src/lib/services/tournament.ts"
    - "src/lib/validation/tournament.ts"
    - "src/lib/validation/auth.ts"
    - "src/app/(public)/tournaments/page.tsx"
decisions:
  - "Capacity X/size derived from _count.pairs + _count.tournamentPlayers (only one non-zero per format → safe sum)"
  - "No venue/«место» field beyond existing `location` column — rendered as-is, nothing omitted"
  - "Price displayed as `{price} ₽` using the raw int (matches create-form + sketch); null → бесплатно"
  - "fcount counts the 4 selects (status/format/level/mode); search excluded, mirroring the sketch"
  - "Facets submitted via router.push (GET semantics); selects submit on change, search on Enter/clear"
metrics:
  duration_min: 3
  tasks_completed: 3
  files_created: 2
  files_modified: 4
  completed: 2026-06-14
---

# Phase 13 Plan 03: Tournaments dense list restyle (UI-03) Summary

Restyled the public tournaments list onto Court 004 «Плотный список» — a dense aligned `.trow` grid that reflows to a card-per-row on phone via `@container` — with server-side facet filtering driven by validated searchParams and a collapsed «Фильтры» popover client leaf. The data layer was extended read-only only (facet `where` + a `_count` for capacity); no schema, migrations, writes, or new Server Actions.

## What Was Built

- **Task 1 (83431f6):** `listTournaments` widened to accept a read-only `ListTournamentsFilter` (`status/format/level/participantMode/q`), each typed against the existing tuples. Builds an AND-ed `Prisma.TournamentWhereInput`; `q` matches name OR location via parameterized `contains`. Added `_count: { pairs, tournamentPlayers }` for the capacity cue. Exported `TournamentFormat`, `ParticipantMode`, `SkillLevel` types. `createTournament`/`getTournament` untouched.
- **Task 2 (2d4b78f):** Co-located `tournaments.css` ports the 004 screen classes 1:1 (page-head/filters/search/sel-field/list/trow/tr-*/fmt-tag/price-free), token-only, with the fixed grid `1.7fr 1fr .9fr 1.1fr .9fr 118px 30px`, the `@container (max-width: 780px)` `grid-template-areas` reflow (all fields kept), and the `@container (max-width: 460px)` single-column panel. `--chev` is scoped to `.cq` (globals.css untouched). The page reads + validates the 5 facets server-side, preserves `?status=`, fetches filtered + total counts in parallel, and renders the dense list with capacity X/size + progress + price + date + location, reusing `<TournamentStatusBadge>`.
- **Task 3 (9015933):** `filter-bar.tsx` `"use client"` leaf — search input + «Фильтры» button with `.fcount` active-facet badge + 2×2 `.sel-field` popover. Manages only popover open/close, outside-click close (`aria-expanded`/`aria-controls`), and pushes facets to the URL via `router.push`. No `[hidden]` row-hiding ported. Status options use raw DB strings; format/level/mode use the existing label maps.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing type exports for facet typing**
- **Found during:** Task 1
- **Issue:** `ListTournamentsFilter` needed `TournamentFormat`/`ParticipantMode`/`SkillLevel`, none of which were exported (`tournament.ts` only exported `TournamentStatus`; `auth.ts` exported no `SkillLevel`).
- **Fix:** Added `export type TournamentFormat`/`ParticipantMode` (tournament.ts) and `export type SkillLevel` (auth.ts) off the existing tuples. No behavior change — pure type derivation.
- **Files modified:** src/lib/validation/tournament.ts, src/lib/validation/auth.ts
- **Commit:** 83431f6

### Notes

- SQLite Prisma `contains` is case-insensitive for ASCII by default; the `mode: "insensitive"` option (unsupported by the SQLite connector) was intentionally omitted.
- Capacity fraction was cheap to compute (a single `_count`), so it is shown for every row rather than degrading to size-only.

## Threat Model Compliance

- **T-13-06 (Tampering, searchParams):** mitigated — every facet validated against its tuple via `pick()` before reaching Prisma (unknown → undefined = no filter); `q` flows only through parameterized `contains`. Mirrors the prior `?status=` validation.
- **T-13-07 (Info Disclosure):** accepted as planned — list + aggregate `_count` are public by design.
- **T-13-SC (supply chain):** no new dependencies installed.

## Verification

- `npx tsc --noEmit` → exit 0.
- `npx next build` → exit 0; `/tournaments` compiles (dynamic SSR, expected with searchParams).
- `tournaments.css` contains the fixed `.trow` grid + `grid-template-areas` reflow; no hex (`grep -nE '#[0-9a-fA-F]{3,8}'` empty).
- `page.tsx` still validates `status` against `tournamentStatuses` → `?status=finished` path preserved.
- `filter-bar.tsx` contains `"use client"`, `aria-expanded`, `fcount`; no `[hidden]` row-hiding.

## Self-Check: PASSED
- FOUND: src/app/(public)/tournaments/tournaments.css
- FOUND: src/app/(public)/tournaments/filter-bar.tsx
- FOUND commit 83431f6, 2d4b78f, 9015933
