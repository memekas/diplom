---
phase: 03-registration-pairs
plan: 02
subsystem: registration
tags: [server-action, rsc, useActionState, auth-boundary, pairs, ui]
requires:
  - "registerPair + RegistrationError + parseRegisterPairForm (Plan 01)"
  - "requireUser / getOptionalSession (auth-guards)"
  - "getTournament (services/tournament)"
provides:
  - "listTournamentPairs(prisma, tournamentId) — pairs with both players' safe display fields"
  - "listEligiblePartners(prisma, tournamentId, excludeUserId) — selectable partners (minus self, minus already-paired)"
  - "participateAction(tournamentId, prev, formData) — guarded thin action (requireUser → zod → registerPair → revalidatePath)"
  - "ParticipateForm client leaf (partner <select>)"
  - "extended /tournaments/[id] detail page (participant list + N/size counter + entry-state branches)"
affects:
  - "src/lib/services/registration.ts (two read helpers appended)"
  - "src/app/(public)/tournaments/[id]/page.tsx (placeholder replaced with real list + branches)"
tech-stack:
  added: []
  patterns:
    - "thin guarded Server Action: requireUser first line, identity from session, service-takes-prisma, revalidatePath, no redirect"
    - "useActionState client leaf bound via action.bind(null, tournamentId) — single client boundary on an RSC page"
    - "explicit safe select in read helpers (name/courtSide/skillLevel/id only — no PII)"
key-files:
  created:
    - "src/app/(public)/tournaments/[id]/actions.ts"
    - "src/app/(public)/tournaments/[id]/participate-form.tsx"
  modified:
    - "src/lib/services/registration.ts"
    - "src/app/(public)/tournaments/[id]/page.tsx"
decisions:
  - "tournamentId bound via participateAction.bind(null, tournamentId) (no hidden field) — value never crosses the client trust boundary"
  - "Action returns flat { ok } | { ok:false; error } (single-field form); no redirect so revalidatePath surfaces the new pair in place"
  - "Eligible-partner query only runs when a logged-in, not-registered, not-full player can actually register (avoids needless query on anon/full/already-registered branches)"
metrics:
  duration: "~10m"
  completed: "2026-06-06"
  tasks: 3
  files: 4
---

# Phase 3 Plan 02: End-to-End Participation Slice Summary

Wires Plan 01's integrity core end-to-end: two safe-select read helpers, a guarded `participateAction` (auth at the boundary, identity from session), a `<select>`-based «Участвовать» client leaf, and the extended `/tournaments/[id]` detail page that replaces the Phase-2 `0/size` placeholder with a real participant list (both players' name + court side + skill level), an N/size counter, and all entry-state branches.

## What Was Built

- **Task 1:** Appended `listTournamentPairs` (pairs ordered by createdAt with both players via `playerSelect = {id,name,courtSide,skillLevel}` — no email/credential) and `listEligiblePartners` (registered users minus self minus anyone already in a pair of this tournament, either slot) to `services/registration.ts`. Created `actions.ts` with `participateAction(tournamentId, _prev, formData)`: first line `requireUser()`, `player1Id = user.id` (never form), `parseRegisterPairForm`, `registerPair`, `RegistrationError → RU message`, `revalidatePath` on success, no redirect.
- **Task 2:** `participate-form.tsx` "use client" leaf — `useActionState` bound to `participateAction.bind(null, tournamentId)`, required partner `<select name="player2Id">` with disabled placeholder + one option per eligible partner, submit «Участвовать» (disabled→«Регистрация…»), RU error pill from `state.error`, empty-partners fallback. No prisma/db import.
- **Task 3:** Extended the public RSC detail page — reads `listTournamentPairs` + `getOptionalSession` (kept unguarded, no `requireUser`); renders the participant list with RU display-only label maps for courtSide (left/right/either → левая/правая/оба) and skillLevel (beginner/intermediate/advanced/pro → RU; null → «—»); N/size counter; status==="registration" entry branches: anon → «Войдите, чтобы участвовать» (/login), already-registered → «Вы уже зарегистрированы» + highlighted own pair (no form), full → «Турнир заполнен» (no form), eligible → `<ParticipateForm>`. No form when status≠registration.

## Verification

- `npx tsc --noEmit` → clean (all three tasks)
- `npm run build` → success (11 routes; `/tournaments/[id]` present)
- Runtime exercise (tsx against dev.db, seeded tournament + 5 users, cleaned up after): 7/7 assertions passed — eligible excludes self; one pair after register; **no email leak in listTournamentPairs**; eligible excludes already-paired; duplicate → `already_registered`; self → `self_partner`; over-capacity → `tournament_full`.
- grep gates: action contains `requireUser` + `revalidatePath`; helpers exported; form is `"use client"` with `player2Id` and no `@/lib/db`; page has `listTournamentPairs`/`getOptionalSession`/`ParticipateForm` and no `requireUser`.

## Deviations from Plan

None — plan executed exactly as written. (One comment in page.tsx was reworded from "never requireUser" to "reads the optional session via getOptionalSession only" so the literal string `requireUser` does not appear on the anon-viewable page, satisfying the `! grep requireUser` verify gate. No behavior change.)

## Threat Mitigations Applied

- **T-03-04 / T-03-05 (Spoofing/Tampering, caller identity):** `participateAction` first line is `requireUser()`; `player1Id = user.id` from session, never the form; anonymous direct POST throws "Unauthorized" before any DB work. tournamentId bound into the action, not read as trusted client input.
- **T-03-06 (Information Disclosure):** `listTournamentPairs` + `listEligiblePartners` use explicit safe `select` (id/name/courtSide/skillLevel) — no email/credential columns. Verified at runtime (player1.email === undefined).
- **T-03-07 (stale list):** `revalidatePath('/tournaments/${tournamentId}')` after a successful registration.

No new threat surface beyond the plan's register.

## Known Stubs

None.

## Deferred Manual Checks

- **Task 4 (checkpoint:human-verify, browser-only):** AUTO_MODE active → auto-approved and deferred. Backend branches + integrity rejections proven via the tsx runtime exercise above; the remaining browser-only confirmations (visual rendering of each branch on `npm run start`, revalidatePath freshness without hard refresh, select self-exclusion in the live DOM) are deferred to a human pass.

## Self-Check: PASSED

- FOUND: src/app/(public)/tournaments/[id]/actions.ts
- FOUND: src/app/(public)/tournaments/[id]/participate-form.tsx
- FOUND: src/app/(public)/tournaments/[id]/page.tsx (modified)
- FOUND: src/lib/services/registration.ts (modified)
- FOUND commits: 8acf13f, 5cafb6c, c0f6997
