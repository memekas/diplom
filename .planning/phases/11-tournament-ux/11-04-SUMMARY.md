---
phase: 11-tournament-ux
plan: 04
subsystem: tournament-detail-ux
tags: [frontend, server-component, server-actions, format-dispatch, vis]
requires:
  - "11-03: RoundRobinView/RotationView + listRounds/listTournamentPlayers + RoundRead types"
  - "11-02: register required level + participate/single actions"
  - "09: computeStandings, recordFormatResult dispatch, round generators"
  - "08: removeRegistration/finishTournament admin actions"
provides:
  - "Format-dispatched + mode-branched tournament detail page (final v2.0 user path)"
  - "RoundScoreForm (mode-branched round-match entry leaf)"
  - "RemoveRegistrationForm (admin remove pair/player leaf)"
  - "FinishTournamentForm (admin manual finish leaf, all formats)"
  - "SingleParticipateForm (singles participate button leaf)"
affects:
  - "src/app/(public)/tournaments/[id]/page.tsx"
tech-stack:
  added: []
  patterns:
    - "RSC reads-only dispatch by tournament.format/participantMode; no engine calls from page"
    - "ids bound into Server Actions via .bind() (never client-trusted)"
    - "standings union unwrapped by `kind` before passing to views (W-1 fix)"
key-files:
  created:
    - "src/app/(public)/tournaments/[id]/round-score-form.tsx"
    - "src/app/(public)/tournaments/[id]/remove-registration-form.tsx"
    - "src/app/(public)/tournaments/[id]/finish-tournament-form.tsx"
  modified:
    - "src/app/(public)/tournaments/[id]/participate-form.tsx"
    - "src/app/(public)/tournaments/[id]/page.tsx"
decisions:
  - "renderEntry slot only supplied when admin+in_progress; readOnly=!isAdmin||finished drives VIS-02"
  - "nameById built from round team members + players list + pairs (pairId→'n1 / n2')"
metrics:
  duration: 9m
  completed: 2026-06-07
---

# Phase 11 Plan 04: Tournament Detail Page Summary

Format-dispatched + mode-branched tournament detail page wiring participate (singles button vs pairs nickname), participant lists, admin remove/finish, mode-branched round-match score entry, and read-only finished history — playoff (BracketView/ScoreForm/listBracket) left byte-for-byte intact.

## What Was Built

- **3 new client leaves** (`"use client"`, never import prisma, dark `bg-red-900/40 text-red-300` error boxes, ids bound into actions):
  - `round-score-form.tsx` — `RoundScoreForm`: branches inputs by `scoringMode` (`points` → `points_a`/`points_b`; `sets` → `set{n}_a`/`set{n}_b` rows mirroring playoff score-form), binds `recordResultAction.bind(null, tournamentId, roundMatchId, setsPerMatch)` to the RoundMatch id (server dispatcher routes by DB format).
  - `remove-registration-form.tsx` — `RemoveRegistrationForm`: binds `removeRegistrationAction.bind(null, tournamentId, kind, id)` (kind `pair`→Pair.id, `player`→TournamentPlayer.id).
  - `finish-tournament-form.tsx` — `FinishTournamentForm`: binds `finishTournamentAction.bind(null, tournamentId)`.
- **`participate-form.tsx`**: added `SingleParticipateForm` (singles «Участвовать» button → `participateSingleAction`, no client fields); fixed existing `ParticipateForm` error box to the dark class.
- **`page.tsx`** (async public Server Component, `getOptionalSession` only): metadata now shows `formatLabels[format]`, вид, уровень, цена, режим подсчёта, and size label «пар» (pairs) vs «участников» (singles); participation/list branch by `participantMode`; visualization dispatched by `format` (playoff→BracketView UNCHANGED; round_robin→RoundRobinView; americano/mexicano→RotationView); admin remove per registration during `registration`, finish during `in_progress` (all formats); round entry injected via the view `renderEntry` slot by `scoringMode`; `readOnly = !isAdmin || finished` gives the per-format read-only history (VIS-02).

### W-1 fix (plan-checker)

`computeStandings` returns a `{kind:"units"|"players"}` union — unwrapped by `kind` before passing to views: `standings.kind === "units" ? standings.units : []` → RoundRobinView, `standings.kind === "players" ? standings.players : []` → RotationView. The raw union is never passed.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface

No new surface. All reads use safe-select projections (`listTournamentPairs`/`listTournamentPlayers`/`listRounds`); page selects no birthDate (T-11-13). All ids bound via `.bind()` (T-11-12). Server guards (`requireAdmin`/`requireUser`) authoritative; hidden buttons cosmetic (T-11-11). No installs (T-11-14). mexicano stale_pairings surfaces verbatim via `{ok:false}` (T-11-15).

## Verification

- `npx tsc --noEmit` → 0 errors.
- `npx next build` → exit 0 (all 11 routes generated).
- Playoff regression: `git diff` shows NO changes to bracket-view.tsx / score-form.tsx / bracket.ts / result.ts — byte-for-byte intact.
- All 13 service test scripts pass (admin 10, americano 29, bracket 40, format-engine 10, mexicano 16, registration 18, result 43, round-result 16, round-robin 28, rounds 3, standings 12, tournament-status 16, tournament 3).
- Manual per-format UAT (register/start/enter-by-mode/finish/read-only history; anon/player control hiding) deferred to phase UAT.

## Self-Check: PASSED

- FOUND: src/app/(public)/tournaments/[id]/round-score-form.tsx
- FOUND: src/app/(public)/tournaments/[id]/remove-registration-form.tsx
- FOUND: src/app/(public)/tournaments/[id]/finish-tournament-form.tsx
- FOUND: src/app/(public)/tournaments/[id]/participate-form.tsx (SingleParticipateForm)
- FOUND: src/app/(public)/tournaments/[id]/page.tsx (format dispatch + mode branch)
- Commits: 5ebc98f, 31b62aa, a7451f3
