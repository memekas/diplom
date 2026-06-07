---
phase: 08-backend-core
plan: 03
subsystem: backend-admin
tags: [admin, remove, finish, status-guard, idempotent, service]
requires:
  - "transitionTournament / ALLOWED_TRANSITIONS (tournament-status.ts, forward-only machine)"
  - "Pair / TournamentPlayer / Tournament.status models (Phase 7)"
  - "RegistrationError typed-error convention (registration.ts) — mirrored by AdminError"
provides:
  - "AdminError typed error (code: not_open)"
  - "removePair / removeParticipant — status-guarded delete (registration only)"
  - "finishTournament — idempotent in_progress→finished via transitionTournament"
affects:
  - "Phase 8 Plan 05 actions (wire removePair/removeParticipant/finishTournament; map AdminError not_open → RU)"
tech-stack:
  added: []
  patterns:
    - "status-guarded delete inside $transaction (re-read status, registration-only)"
    - "idempotent finish: no-op on finished, else delegate to forward-only machine (Pitfall 8)"
    - "AdminError mirrors RegistrationError (code union, name) for string-match-free action mapping"
key-files:
  created:
    - src/lib/services/admin.ts
    - src/lib/services/admin.test.ts
  modified: []
decisions:
  - "finishTournament re-reads status BEFORE transitionTournament so finished→no-op without tripping the forward-only guard"
  - "AdminError code union is single-value (not_open) — only one admin-side integrity violation exists"
  - "Playoff auto-finish (result.ts) left untouched — manual finish is a parallel path to the same terminal"
metrics:
  duration: ~5m
  completed: 2026-06-07
  tasks: 2
  files: 2
---

# Phase 8 Plan 03: Admin Remove + Manual Finish Summary

Status-guarded registration removal (ADMN-01) and idempotent manual tournament finish (ADMN-02), built as a thin service layer over the existing forward-only status machine — no UI/actions (Plan 05 wires those).

## What Was Built

- **`AdminError`** — typed error mirroring `RegistrationError` (code union `"not_open"`, `name="AdminError"`) so the Plan 05 action maps code→RU without string-matching.
- **`removePair(prisma, { tournamentId, pairId })`** — inside `$transaction`, re-reads tournament status; if not `"registration"` throws `AdminError("not_open")`, else `pair.delete`.
- **`removeParticipant(prisma, { tournamentId, playerId })`** — same registration guard on `tournamentPlayer.delete`.
- **`finishTournament(prisma, tournamentId)`** — reads status; if already `"finished"` returns (idempotent no-op, Pitfall 8); else delegates to `transitionTournament(prisma, id, "in_progress", "finished")`. The status machine is reused, never re-implemented.
- **`admin.test.ts`** — self-contained tsx script (no framework), hand-written `fakePrisma` serving as both `prisma` and `tx`, 8 assertions.

## Verification

- `npx tsc --noEmit` — clean for admin.ts / admin.test.ts.
- `npx tsx src/lib/services/admin.test.ts` — 8 assertions passed (remove registration→delete; in_progress/finished→not_open no delete; finish finished→no-op no update; finish in_progress→status finished; finish registration→throws).
- Regression: `tournament-status.test.ts` — 16 assertions passed (transitionTournament unmodified).

## Threats Mitigated

- **T-08-08** (delete after start): `status === "registration"` guard re-read inside the transaction; AdminError not_open.
- **T-08-09** (finish from illegal status / bypass machine): delegated to transitionTournament — forward-only guard + DB re-read.
- **T-08-10** (repeat finish): idempotent no-op on finished; duplicate POST neither throws nor corrupts state.

## Deviations from Plan

None — plan executed exactly as written.

## Commits

- `39a3984` feat(08-03): admin remove (status-guarded) + idempotent finish
- `4bc49a3` test(08-03): admin services — status-guard remove + idempotent finish

## Self-Check: PASSED

All created files exist; both commits present in git history.
