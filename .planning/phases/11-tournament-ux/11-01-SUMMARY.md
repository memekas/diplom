---
phase: 11-tournament-ux
plan: 01
subsystem: admin-create-tournament-ui
tags: [form, scoring-mode, conditional-fields, FORM-01, SCORE-02]
requires:
  - createTournamentAction (Phase 8)
  - createTournamentSchema / parseTournamentForm (Phase 8)
  - formatLabels / tournamentKindLabels / skillLevelLabels (auth.ts)
provides:
  - Extended create-tournament form exposing all multiformat fields with client conditional visibility
affects:
  - src/app/(app)/admin/tournaments/new/create-tournament-form.tsx
tech-stack:
  added: []
  patterns:
    - Client field-visibility via React useState driving conditional render
    - Disabled-select + hidden-input pairing so forced values still submit
key-files:
  created: []
  modified:
    - src/app/(app)/admin/tournaments/new/create-tournament-form.tsx
decisions:
  - Disabled selects do not submit; paired hidden inputs carry forced singles/points values for americano/mexicano
metrics:
  duration: ~2 min
  completed: 2026-06-07
---

# Phase 11 Plan 01: Extended Create-Tournament Form Summary

Extended the admin create-tournament form to expose every field the shipped `createTournamentSchema` accepts (format, participantMode, level, size, price) plus scoringMode with client-driven conditional sets/points/rounds fields — backend untouched, pure presentation + client visibility.

## What Was Built

- **format** select (`tournamentFormats` / `formatLabels`), controlled by local state, drives all conditional visibility.
- **participantMode** select (`participantModes` / `tournamentKindLabels`); for americano/mexicano forced to `singles`, rendered disabled, with a paired hidden input so the value still submits.
- **level** select (`skillLevels` / `skillLevelLabels`), required.
- **size**: 4/8/16 select (`PLAYOFF_SIZES`, "{n} пар") for playoff; number input (advisory min by format) otherwise. Label swaps "Размер сетки" ↔ "Количество участников".
- **price** optional number input (₽, min 0).
- **scoringMode** select (`sets`="Сеты/геймы", `points`="Очки"), controlled by state; forced to `points` + disabled for americano/mexicano (paired hidden input).
- Conditional fields (absent from DOM when hidden → parser coerces "" to undefined):
  - `sets` → `setsPerMatch` + `gamesPerSet` number inputs, min 1, **no max** (SCORE-02/D5).
  - `points` → `targetPoints` optional number input, min 1.
  - americano/mexicano → `totalRounds` number input, min 1, required for mexicano.
- Kept date (datetime-local) + location optional inputs.
- Dark-theme error classes: form-level box `bg-red-900/40 text-red-300`, per-field spans `text-red-400` (Pitfall 7 cleanup).
- Action wiring unchanged: `useActionState` runs `parseTournamentForm` pre-check then `createTournamentAction` (which redirects).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Disabled selects drop their value from FormData**
- **Found during:** Task 1
- **Issue:** The plan specified rendering participantMode/scoringMode as disabled selects for americano/mexicano. Disabled form controls are excluded from FormData submission, so `parseTournamentForm` would read `null` and the server superRefine (which requires `participantMode=singles` / `scoringMode=points` for those formats) would reject otherwise-valid submissions.
- **Fix:** Paired each disabled select with a hidden input carrying the forced value; the visible select retains the `name=` only when enabled. The disabled select stays purely cosmetic, matching the plan's intent while keeping FormData correct.
- **Files modified:** src/app/(app)/admin/tournaments/new/create-tournament-form.tsx
- **Commit:** a249e46

## Threat Surface

No new surface. Per T-11-01/T-11-02: client forcing is UX-only; `createTournamentSchema.superRefine` + `requireAdmin()` remain the server boundary (untouched). No deps added (T-11-03 N/A).

## Verification

- `npx tsc --noEmit` → 0 errors.
- `npx next build` → exit 0; `/admin/tournaments/new` compiles.
- Manual UAT (4-format create + conditional field show/hide) deferred to phase UAT.

## Self-Check: PASSED

- FOUND: src/app/(app)/admin/tournaments/new/create-tournament-form.tsx
- FOUND commit: a249e46
