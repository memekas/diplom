---
phase: 13-auth
plan: 01
subsystem: auth-ui
tags: [ui, restyle, court, auth, container-queries]
requires:
  - "Phase 12 Court token + _base component layer (globals.css)"
  - "Existing Better Auth client (authClient.signIn/signUp.email)"
  - "Zod loginSchema/registerSchema + skillLevels/skillLevelLabels"
provides:
  - "src/app/(auth)/auth.css — 008 screen-specific classes (.modeseg/.cardA*/.pw/.reveal/.sel-wrap), token-only"
  - "Court-restyled login + register screens (two-routes tab-card)"
  - "Password reveal-eye client toggle in both auth form leaves"
affects:
  - "src/app/(auth)/login/* , src/app/(auth)/register/*"
tech-stack:
  added: []
  patterns:
    - "Two-routes tab-card: Вход/Регистрация are <Link>s between /login and /register (active = current route), NOT in-place setMode/body.is-login"
    - "Co-located global CSS imported into a page (App Router)"
    - "Token-driven select chevron (border-square, --text-muted -> --ring on focus)"
    - "Container-query (@container) breakpoint, never @media"
key-files:
  created:
    - "src/app/(auth)/auth.css"
  modified:
    - "src/app/(auth)/login/page.tsx"
    - "src/app/(auth)/login/login-form.tsx"
    - "src/app/(auth)/register/page.tsx"
    - "src/app/(auth)/register/register-form.tsx"
decisions:
  - "auth.css lives at src/app/(auth)/auth.css; pages import it as ../auth.css (correct relative path) — the plan's literal grep './auth.css' was a path typo, see Deviations"
  - "Ported .net-rule into auth.css (absent from globals.css — it is a screen-specific class, not a base component)"
  - "Reveal-eye uses local useState in each form leaf (both already client components), no shared PasswordInput leaf"
metrics:
  duration: "~12 min"
  completed: "2026-06-14"
  tasks: 3
  files: 5
requirements: [UI-02]
---

# Phase 13 Plan 01: Auth tab-card restyle (Court) Summary

Restyled `/login` and `/register` onto the Court design language as a single 008 «Карточка с вкладками» tab-card, consuming the Phase 12 token + `_base` component layer; the Вход/Регистрация tabs are `<Link>`s between the two preserved routes, and a co-located `auth.css` carries the screen-specific classes — all v2.0 auth behavior (Server Actions, field set, Zod, RU error mapping, router flow) is unchanged.

## What Was Built

- **`auth.css`** (new, co-located global stylesheet): ported the 008 screen-specific classes absent from `globals.css` — `.net-rule`, `.ball`, `.field-court`, `.brand-lockup`, `.modeseg` (+ `a` / `a.on` for the `<Link>` tabs), `.authform`, `.grid-2`, `.opt`, `.pw`/`.pw .reveal`/`.pw .reveal.on`, `.sel-wrap` token-chevron, and the `.cardA*`/`.wrap` card layout. Single `@container (max-width: 460px)` phone reflow. No hex literals — every color is a Court token or `color-mix`.
- **Login** (`page.tsx` + `login-form.tsx`): `.cq` wrapper → `.card cardA` shell with brand lockup, `.modeseg` tablist (Вход active `.on`, Регистрация → `/register`), `.net-rule cardA-seam`, then the form leaf. Form uses `.field/.label/.input/.error/.btn-primary/.btn-block` + a `.pw .reveal` reveal-eye toggle.
- **Register** (`page.tsx` + `register-form.tsx`): same `.cardA` shell with Регистрация active and Вход → `/login`. Full field set preserved in order (email, пароль+hint, имя, никнейм+hint, телефон/дата рождения in `.grid-2` with `.opt` markers, уровень in `.sel-wrap`). Same reveal-eye toggle.

## How It Works

Each page is a Server Component that imports `../auth.css` and renders the static Court card; the interactive form is the existing `"use client"` leaf, now restyled. The only new client behavior is a `showPassword` `useState` that flips the password input `type` between `password`/`text` and adds `.on` to the reveal button (token color cue). The Вход/Регистрация segmented control is mechanically two routes — clicking a tab navigates; the active tab is hard-coded `.on` per route. No `setMode()`/`body.is-login` JS was ported.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] auth.css import path is `../auth.css`, not `./auth.css`**
- **Found during:** Task 2
- **Issue:** The plan's action text and the Task 2 automated grep both reference `import "./auth.css"`, but `auth.css` was placed at `src/app/(auth)/auth.css` (parent of `login/` and `register/`), so a same-directory `./auth.css` import would not resolve.
- **Fix:** Imported `../auth.css` from both pages (the correct relative path for the planned file location). Verified via `next build` (both routes compile).
- **Files modified:** `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx`
- **Commits:** ffab432, 6f7cb36

**2. [Rule 2 - Missing class] Ported `.net-rule` into auth.css**
- **Found during:** Task 1
- **Issue:** `.net-rule` (the card seam under the head) is used by the Court card but is absent from `globals.css` — it is a screen-specific class, not a base component.
- **Fix:** Ported `.net-rule` (token-only) into `auth.css` alongside the other 008 classes.
- **Files modified:** `src/app/(auth)/auth.css`
- **Commit:** 97adb8a

### Notes (not deviations)
- Replaced the sketch's hardcoded `#fff`/`#000` inside `.ball` gradient with `var(--text)`/`var(--bg)` to satisfy the no-hex constraint.
- `aria-selected` added to the `<Link>` tabs and `aria-pressed` to the reveal button (accessibility, no behavior change).

## Verification Results

- `npx tsc --noEmit` — clean (no errors).
- `npx next build` — compiled successfully; `/login` and `/register` routes generated.
- `grep -rnE '#[0-9a-fA-F]{3,8}' src/app/(auth)/` (excluding comments) — no hex literals.
- `authClient.signIn.email` present in login-form; `authClient.signUp.email` + `FAILED_TO_CREATE_USER` present in register-form.
- `name="nickname"` present, `name="courtSide"` absent in register-form.

## Self-Check: PASSED
