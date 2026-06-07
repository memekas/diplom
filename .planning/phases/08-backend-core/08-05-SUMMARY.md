---
phase: 08-backend-core
plan: 05
subsystem: server-actions
tags: [server-actions, registration, admin, regression]
requires: ["08-02", "08-03"]
provides:
  - participateSingleAction
  - removeRegistrationAction
  - finishTournamentAction
affects:
  - src/app/(public)/tournaments/[id]/actions.ts
tech-stack:
  added: []
  patterns:
    - "Server Action thin-wrapper: requireUser/requireAdmin first line -> service in $transaction -> typed RU result -> revalidatePath"
    - "Single kind-dispatched admin remove action (pair|player) per RESEARCH Open Q2"
    - "Idempotent manual finish (repeat = no-op)"
key-files:
  created: []
  modified:
    - src/app/(public)/tournaments/[id]/actions.ts
decisions:
  - "removeRegistrationAction = single action with kind discriminator (not two actions) — RESEARCH Open Q2"
  - "participateSingleAction skips parseRegisterSingleForm call — schema is empty (no client fields); parse would be trivially ok, identity comes from session"
metrics:
  duration: ~1m
  completed: 2026-06-07
requirements: [REG-06, ADMN-01, ADMN-02]
---

# Phase 8 Plan 05: Wire single-registration + admin remove/finish Server Actions Summary

Wired three new Server Actions in `tournaments/[id]/actions.ts` to the Plan 02/03 services — single-player registration (REG-06), admin kind-dispatched registration removal (ADMN-01), and idempotent manual finish (ADMN-02) — then confirmed the full phase-8 regression gate (8 test scripts, 222 assertions, tsc clean) with playoff/validation invariant intact.

## What was built

- **`participateSingleAction(tournamentId, _prev, _formData)`** — `requireUser()` first line; `userId` from session (never form); calls `registerSingle(prisma, { tournamentId, userId })`; `RegistrationError` → `e.message`, else generic RU fallback; `revalidatePath` on success. Singles form carries no client fields (empty schema), so `parseRegisterSingleForm` is intentionally not invoked.
- **`removeRegistrationAction(tournamentId, kind, id, _prev, _fd)`** — `requireAdmin()` first line (throw "Forbidden" not caught); `kind`-dispatch `removePair` / `removeParticipant`; `AdminError` → `e.message`, else generic RU; ids bound from leaf, not form.
- **`finishTournamentAction(tournamentId, _prev, _fd)`** — `requireAdmin()` first line; idempotent `finishTournament(prisma, tournamentId)`; any throw → generic RU fallback (status-machine plain Error never leaks).
- New state types: `RemoveRegistrationActionState`, `FinishTournamentActionState`; reused `ParticipateActionState` for the single action.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | participateSingleAction (REG-06) | 8b5914e | src/app/(public)/tournaments/[id]/actions.ts |
| 2 | removeRegistrationAction + finishTournamentAction (ADMN-01/02) | 8c12bec | src/app/(public)/tournaments/[id]/actions.ts |
| 3 | Regression gate (verification-only, no code) | — | — |

## Verification

- All 8 test scripts pass (222 assertions): bracket 40, registration 18, result 43, tournament-status 16, admin 8, profile 33, registration-validation 8, tournament-validation 56.
- `npx tsc --noEmit` exits 0 (whole project clean).
- Playoff stack untouched: bracket.test.ts + result.test.ts (auto-finish) green; registerPair pairs-path green via registration.test.ts.

## Deviations from Plan

None — plan executed as written. Note: per the plan's own guidance, `participateSingleAction` omits the `parseRegisterSingleForm` call because `registerSingleSchema` is empty (no client-supplied fields); parse would be trivially `ok` and identity is taken from the session guard.

## Self-Check: PASSED

- FOUND: src/app/(public)/tournaments/[id]/actions.ts (participateSingleAction, removeRegistrationAction, finishTournamentAction present)
- FOUND commit: 8b5914e
- FOUND commit: 8c12bec
