---
phase: 10-ux-foundation
plan: 03
subsystem: ux-foundation
tags: [header, nav, i18n, dark-theme, responsive, auth-forms, profile]
requires:
  - "skillLevelLabels RU map (10-01 / auth.ts)"
  - "(public)/tournaments list honors ?status= filter (10-02) — enables «Прошедшие турниры» link"
  - "Semantic dark theme tokens (10-01)"
provides:
  - "Rebuilt RU header (HDR-01): CLUB_NAME + inline SVG logo + Прошедшие турниры + Личный кабинет"
  - "courtSideLabels RU map (left/right/either)"
  - "Fully RU-localized login/register/dashboard/profile with dark alert pills"
  - "RU user-facing zod messages in registerSchema/loginSchema (W2 fix)"
affects:
  - src/components/nav.tsx
  - src/components/logout-button.tsx
  - src/lib/validation/auth.ts
  - src/lib/validation/profile.ts
  - src/app/(auth)/login/page.tsx
  - src/app/(auth)/login/login-form.tsx
  - src/app/(auth)/register/page.tsx
  - src/app/(auth)/register/register-form.tsx
  - src/app/(app)/dashboard/page.tsx
  - src/app/(app)/profile/page.tsx
  - src/app/(app)/profile/profile-form.tsx
tech-stack:
  added: []
  patterns:
    - "Inline SVG logo placeholder in nav (no external asset in public/)"
    - "flex-wrap + gap-x/gap-y for responsive header (no burger lib)"
    - "Display-only RU label maps (courtSideLabels) keyed against zod tuple; DB/FormData stay latin"
    - "Error message strings hardcoded RU at UI boundary; error.code branching untouched"
key-files:
  created: []
  modified:
    - src/components/nav.tsx
    - src/components/logout-button.tsx
    - src/lib/validation/auth.ts
    - src/lib/validation/profile.ts
    - src/app/(auth)/login/page.tsx
    - src/app/(auth)/login/login-form.tsx
    - src/app/(auth)/register/page.tsx
    - src/app/(auth)/register/register-form.tsx
    - src/app/(app)/dashboard/page.tsx
    - src/app/(app)/profile/page.tsx
    - src/app/(app)/profile/profile-form.tsx
decisions:
  - "CLUB_NAME = «Падел Клуб» placeholder constant in nav.tsx (renameable; one admin org)"
  - "«Прошедшие турниры» → /tournaments?status=finished (filter from 10-02; per-format history is Phase 11 VIS-02)"
  - "Login error fallback replaced with fixed RU «Неверная почта или пароль» (error.message is EN); register fallback «Не удалось зарегистрироваться»"
  - "W2 fix: only message STRINGS in registerSchema/loginSchema translated; schema shape/validation logic untouched"
metrics:
  duration: ~12m
  completed: 2026-06-07
---

# Phase 10 Plan 03: RU header + login/register/dashboard/profile localization Summary

Rebuilt the site header (HDR-01) with a club name placeholder, inline SVG logo, «Прошедшие турниры» and «Личный кабинет» links, and finished RU localization (SITE-01) of login/register/dashboard/profile plus the logout button, darkened all light alert pills (SITE-02), made the header and forms responsive (SITE-03), and fixed plan-checker W2 (EN zod messages surfacing to users).

## What Was Built

**Task 1 — Header (HDR-01):** `nav.tsx` now declares `const CLUB_NAME = "Падел Клуб"` (placeholder, renameable) and renders an inline SVG logo placeholder + club name on the left (link to `/`). Right side: Турниры, Прошедшие турниры (`/tournaments?status=finished`), admin-only Создать турнир, Личный кабинет (`/profile`, newly added), user name, Выйти. Guests see Войти/Регистрация. Layout uses `flex-wrap` + `gap-x/gap-y` so the header wraps on mobile without horizontal scroll. `getOptionalSession()` and admin role gating unchanged.

**Task 2 — Auth/dashboard + W2:** Translated login page+form, register page+form, dashboard, and logout button to RU. Register level `<select>` now renders `skillLevelLabels[lvl]`. Alert pills changed `bg-red-100 text-red-800` → `bg-red-900/40 text-red-300`, inline errors `text-red-600` → `text-red-400`. W2 fix: `registerSchema`/`loginSchema` user-facing zod message strings translated to RU (email/password/name validation messages) — schema shape and validation logic untouched.

**Task 3 — Profile:** Added `courtSideLabels` RU map (`left`/`right`/`either` → Левая/Правая/Любая) in `profile.ts`. Profile page title → Личный кабинет; form labels/buttons RU; court-side `<select>` uses `courtSideLabels`, level `<select>` uses `skillLevelLabels`; success/error pills darkened. `useActionState`/`parseProfileForm`/server action logic untouched.

## Deviations from Plan

### Auto-fixed Issues

None beyond the planned W2 fix. One minor cleanup during Task 3: the initial `skillLevelLabels` import was added as a second `@/lib/validation/auth` import line, then consolidated into the existing `skillLevels` import (no behavior change).

## Verification

- `npx tsc --noEmit` → 0 errors.
- `npx next build` → success (11/11 routes).
- `npx tsx src/lib/validation/profile.test.ts` → 33 assertions passed (profile regression green).
- Per-task automated greps → OK (CLUB_NAME/Прошедшие/`/profile`/Войти present; no EN user-facing strings in auth/dashboard/profile/logout; no `bg-*-100` light alerts; `skillLevelLabels`/`courtSideLabels` wired).

## Self-Check: PASSED

- nav.tsx, profile.ts, auth.ts, all (auth)/(app) files modified and committed.
- Commits a611c9a, 4e516f9, c6dcf4b present in git log.
