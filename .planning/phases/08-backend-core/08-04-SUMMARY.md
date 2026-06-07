---
phase: 08-backend-core
plan: 04
subsystem: profile
tags: [profile, auth, better-auth, validation, server-action]
requires:
  - Better Auth (auth.ts) configured (Phase 2)
  - updateProfile/profileSchema baseline (Phase 7)
provides:
  - "user.changeEmail = {enabled, updateEmailWithoutVerification}"
  - "profileSchema covers name/skillLevel/phone/birthDate/courtSide/nickname/email"
  - "updateProfile writes all domain fields (direct prisma; email excluded)"
  - "updateProfileAction: P2002→RU nick + pre-check email + auth.api.changeEmail"
affects:
  - Phase 11 profile UI form (will bind to updateProfileAction + getProfile)
tech-stack:
  added: []
  patterns:
    - "email owned by Better Auth → auth.api.changeEmail (never prisma.update)"
    - "@@unique conflict → catch P2002 → RU message (no TOCTOU pre-check)"
    - "pre-check email uniqueness (changeEmail silently no-ops on dup)"
key-files:
  created: []
  modified:
    - src/lib/auth.ts
    - src/lib/validation/profile.ts
    - src/lib/validation/profile.test.ts
    - src/lib/services/profile.ts
    - src/app/(app)/profile/actions.ts
decisions:
  - "Email split out of parsed.data before updateProfile; routed via changeEmail only when changed"
  - "nickname mirrors registerSchema rules (trim/3-30/[A-Za-z0-9_-])"
  - "birthDate uses z.union([literal(''), coerce.date()]) like createTournamentSchema date"
metrics:
  duration: ~2m
  completed: 2026-06-07
requirements: [USR-03]
---

# Phase 8 Plan 04: USR-03 Full Profile Edit (nickname + email via changeEmail) Summary

Extended the profile edit slice to all USR-03 fields — name/skillLevel/phone/birthDate/courtSide/nickname (direct guarded `prisma.user.update`) plus email through Better Auth's `auth.api.changeEmail` (with uniqueness pre-check), enabled by turning on `user.changeEmail` without verification (works because `emailVerified` defaults false in this offline demo).

## What Was Built

**Task 1 — auth.ts + profileSchema/parseProfileForm (commit 56a24d1)**
- `src/lib/auth.ts`: added `user.changeEmail = { enabled: true, updateEmailWithoutVerification: true }` (both flags required, Pitfall 2). `additionalFields`/`plugins`/`emailAndPassword` untouched (additive).
- `src/lib/validation/profile.ts`: extended `profileSchema` with `name` (required, trimmed), `nickname` (mirrors registerSchema: trim/3–30/`^[A-Za-z0-9_-]+$`), `email` (optional, `""`→undefined), `birthDate` (`z.union([z.literal(""), z.coerce.date()])`→undefined-on-empty). `parseProfileForm` now reads the new FormData keys; `ParseProfileFormResult` errors union widened to name/nickname/email/birthDate.

**Task 2 — updateProfile (commit a9c3ce3)**
- `src/lib/services/profile.ts`: `updateProfile` now writes `name`, `courtSide`, `phone`→null, `birthDate`→null, `nickname`, and `skillLevel` only when defined. Email is NOT written (Pitfall 3). No nickname pre-check — P2002 propagates to the action (Pitfall 4). `safeProfileSelect` gained `nickname`/`birthDate` (no credential columns).

**Task 3 — updateProfileAction + tests (commit 14b98a2)**
- `src/app/(app)/profile/actions.ts`: after `requireUser()` (identity never from form) and parse, splits `email` out. (1) Domain fields via `updateProfile`, catching P2002→`{ok:false, errors:{nickname:"Этот ник уже занят"}}`. (2) Email only if changed: pre-check `findUnique` (Pitfall 1)→`{email:"Этот email уже используется"}` on clash, else `auth.api.changeEmail({body:{newEmail}, headers})` wrapped in try/catch→`{email:"Не удалось сменить email"}`. `ProfileActionState` errors union widened.
- `src/lib/validation/profile.test.ts`: rewritten around a valid `base` (name+courtSide+nickname now required); added name/nickname/email/birthDate assertions. 33 assertions pass (was 16).

## Verification

- `npx tsc --noEmit` — clean (whole project; no errors in any of the four touched files).
- `npx tsx src/lib/validation/profile.test.ts` — 33 assertions passed.
- Full regression: bracket 40, registration 18, tournament-status 16, admin 8, result 43, tournament-validation 56, registration-validation 8 — all green. No playoff/registration regressions.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- Files exist: auth.ts, validation/profile.ts, validation/profile.test.ts, services/profile.ts, profile/actions.ts — all modified.
- Commits exist: 56a24d1, a9c3ce3, 14b98a2.
