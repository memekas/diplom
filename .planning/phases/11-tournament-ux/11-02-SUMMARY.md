---
phase: 11-tournament-ux
plan: 02
subsystem: auth-profile-forms
tags: [forms, register, profile, birthDate, skillLevel, better-auth]
requires:
  - "updateProfileAction + profileSchema (Phase 8)"
  - "authClient.signUp.email additionalFields (Phase 7)"
provides:
  - "Register form: required explicit skill-level select (no beginner default-slip)"
  - "Register form: optional birthDate wired through Better Auth → User.birthDate"
  - "Profile form: edits all fields (name/level/phone/birthDate/courtSide/nickname/email)"
affects:
  - "src/lib/auth.ts additionalFields"
  - "src/lib/validation/auth.ts registerSchema"
tech-stack:
  added: []
  patterns:
    - "birthDate additionalField as type:string (A1-safe ISO round-trip), not type:date"
    - "date-union zod trick reused from profileSchema for registerSchema.birthDate"
key-files:
  created: []
  modified:
    - src/lib/auth.ts
    - src/lib/validation/auth.ts
    - src/app/(auth)/register/register-form.tsx
    - src/app/(app)/profile/profile-form.tsx
    - src/app/(app)/profile/page.tsx
decisions:
  - "skillLevel REQUIRED at register (z.enum w/ message), drop `?? beginner` slip — closes Phase 7 WR-01/IN-01"
  - "birthDate declared as string additionalField per RESEARCH A1; form sends .toISOString()"
metrics:
  duration: 3 min
  completed: 2026-06-07
---

# Phase 11 Plan 02: Register required-level + birthDate wiring; full profile form Summary

Made register skill-level an explicit required select (no silent beginner default-slip), wired an optional birthDate end-to-end through Better Auth into `User.birthDate`, and expanded the profile form from 3 fields to all 7 editable fields (name/level/phone/birthDate/courtSide/nickname/email) with RU taken-error display.

## What Was Built

**Task 1 — birthDate wiring + required register level** (`dad3594`)
- `auth.ts`: added `birthDate: { type: "string", required: false, input: true }` to `user.additionalFields` (A1-safe ISO fallback, not `"date"` — Prisma/SQLite round-trips the ISO string into the `DateTime?` column). changeEmail block + plugin order untouched.
- `validation/auth.ts`: `skillLevel` now `z.enum(skillLevels, { message: "Выберите уровень" })` (required, no `.optional()`); added optional `birthDate` date-union (same trick as profileSchema).
- `register-form.tsx`: added `birthDate` to safeParse input + FieldErrors union; removed the `skillLevel ?? "beginner"` fallback (passes `skillLevel` directly); converted level `<select>` to `required` with disabled `Выберите уровень` placeholder (no selectable empty option, label dropped "необязательно"); added optional `name="birthDate" type="date"` input; conditionally spreads `birthDate.toISOString()` into `signUp.email`. Error-code branches + dark classes kept.

**Task 2 — full profile form** (`e3e7885`)
- `profile/page.tsx`: `initial` prop expanded to name/email/nickname/courtSide/phone/skillLevel/birthDate (birthDate as `yyyy-MM-dd` slice). requireUser guard unchanged.
- `profile-form.tsx`: widened `Initial` type; added inputs for name (ФИО, required), birthDate (optional date), nickname (required), email — matching exact `parseProfileForm` `name=` attributes, each pre-filled from `initial`. nickname/email taken-errors surface via `errors.nickname`/`errors.email` (RU). courtSide/phone/skillLevel kept. Dark-theme classes preserved. useActionState pre-check wiring unchanged.

**Task 3 — verification** (no file changes)
- `npx next build` → exit 0; `npx tsx src/lib/services/registration.test.ts` → exit 0 (18 assertions). No fixture changes needed — the test exercises `registerPair`/`registerSingle` service logic, not `registerSchema`.

## Verification Results
- `npx tsc --noEmit` → 0 errors (both tasks).
- `npx next build` → exit 0.
- `npx tsx src/lib/services/registration.test.ts` → 18 assertions passed.

## Deviations from Plan
None — plan executed exactly as written.

## Threat Flags
None — no new security surface. birthDate stays on the owning User row; no public projection touched (T-11-04 deferred to Plan 03 read helpers, as planned). No new deps (T-11-07 N/A).

## Self-Check: PASSED
- Files: all 5 modified files present.
- Commits: dad3594, e3e7885 both in git log.
