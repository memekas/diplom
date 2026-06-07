---
phase: 10-ux-foundation
plan: 01
subsystem: ux-foundation
tags: [theme, i18n, labels, ui]
requires: []
provides:
  - "Forced dark theme (no OS-driven switching)"
  - "html lang=ru + RU metadata"
  - "formatLabels + tournamentKindLabels RU maps (reusable by plan 02 / Phase 11)"
  - "Dark-contrast tournament status pills"
affects:
  - src/app/globals.css
  - src/app/layout.tsx
  - src/lib/validation/auth.ts
  - src/components/tournament-status-badge.tsx
tech-stack:
  added: []
  patterns:
    - "Tailwind 4 CSS-first :root variables (no theme lib, no toggle)"
    - "Display-only RU label maps typed against zod tuples (skillLevelLabels pattern)"
key-files:
  created: []
  modified:
    - src/app/globals.css
    - src/app/layout.tsx
    - src/lib/validation/auth.ts
    - src/components/tournament-status-badge.tsx
decisions:
  - "Forced dark via :root dark values + removing prefers-color-scheme block entirely (light OS can no longer switch site to light)"
  - "formatLabels/tournamentKindLabels live in auth.ts alongside skillLevelLabels; import tournamentFormats/participantModes from tournament.ts for key-type safety"
  - "Dark pills use translucent tints (bg-*-900/40, bg-white/10) + semantic text-foreground/70 for contrast"
metrics:
  duration: ~3m
  completed: 2026-06-07
---

# Phase 10 Plan 01: UX Foundation (theme + localization + labels) Summary

Forced site-wide dark theme (removed `@media (prefers-color-scheme: dark)`, dark `:root`), declared the root document Russian (`lang="ru"` + RU metadata), added reusable RU label maps (`formatLabels`, `tournamentKindLabels`) typed against the tournament zod tuples, and darkened the tournament status pills for readable contrast on the dark background.

## What Was Built

- **Task 1 — Forced dark theme** (`src/app/globals.css`): `:root` now sets `--background: #0a0a0a` / `--foreground: #ededed`; the `@media (prefers-color-scheme: dark)` block was removed so a light OS no longer flips the site to light. `@theme inline` mapping and the `body` rule were left intact. Commit `bc9896a`.
- **Task 2 — RU localization of root** (`src/app/layout.tsx`): `<html lang="en">` → `<html lang="ru">`; `metadata.title` → «Падел турниры», `metadata.description` → «Турниры по паделу: регистрируйтесь, играйте, следите за сеткой.». Component structure/classes untouched. Commit `b788eab`.
- **Task 3 — RU label maps + dark pills** (`src/lib/validation/auth.ts`, `src/components/tournament-status-badge.tsx`): added `formatLabels` (4 formats) and `tournamentKindLabels` (pairs/singles) typed by `tournamentFormats`/`participantModes` from `tournament.ts`; `skillLevelLabels` unchanged. Status pills (`STATUS_CLASSES` + fallback) switched from light `*-100`/`*-200` palettes to `bg-green-900/40 text-green-300`, `bg-amber-900/40 text-amber-200`, `bg-white/10 text-foreground/70`. Commit `0ada444`.

## Verification

- `grep "prefers-color-scheme" src/app/globals.css` → absent (OK).
- `grep 'lang="ru"' src/app/layout.tsx` → found; no `Padel Tournaments`/`Organize and follow` remaining.
- `grep "formatLabels"` and `grep "tournamentKindLabels"` in `auth.ts` → both found.
- No `bg-(green|amber|red|gray)-(100|200)` in `tournament-status-badge.tsx`.
- `npx tsc --noEmit` → exit 0.
- Visual dark-theme confirmation deferred to end-of-phase human-verify (per plan/CONTEXT).

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- FOUND: src/app/globals.css, src/app/layout.tsx, src/lib/validation/auth.ts, src/components/tournament-status-badge.tsx
- FOUND commits: bc9896a, b788eab, 0ada444
