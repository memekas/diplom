---
phase: 13-auth
plan: 02
subsystem: account-ui
tags: [ui, restyle, court, profile, container-queries]
requires:
  - "Phase 12 Court token + _base component layer (globals.css)"
  - "Existing updateProfileAction + parseProfileForm + getProfile + requireUser"
  - "courtSides/courtSideLabels (@/lib/validation/profile), skillLevels/skillLevelLabels (@/lib/validation/auth)"
provides:
  - "src/app/(app)/profile/profile.css — 006 screen-specific classes (.idcard/.id-avatar/.id-chip/.ro-tag/.seg/.select-wrap/.changed-dot/.net-rule), token-only"
  - "Court-restyled profile page: player-pass idcard + read-only contact strip"
  - "Profile form leaf: courtSide .seg, read-only email, edit-toggle + diff-gated Save + per-field changed-dot"
affects:
  - "src/app/(app)/profile/*"
tech-stack:
  added: []
  patterns:
    - "Co-located global CSS imported into a page (App Router): import './profile.css'"
    - "Controlled-state diff against a baseline drives per-field changed-dot + Save enable; re-baseline on state.ok"
    - "courtSide .seg = 3 <button aria-pressed> mirrored into a hidden <input name='courtSide'> (payload identical)"
    - "Read-only email = disabled input; absent from FormData → action's `|| undefined` treats as no-change"
    - "Container-query (@container) phone reflow, never @media"
key-files:
  created:
    - "src/app/(app)/profile/profile.css"
  modified:
    - "src/app/(app)/profile/page.tsx"
    - "src/app/(app)/profile/profile-form.tsx"
decisions:
  - "profile.css imported as './profile.css' (co-located in the profile/ dir, unlike 13-01 where auth.css sat one level up — no path deviation here)"
  - "Ported .net-rule into profile.css (screen-specific, absent from globals.css; same call as 13-01)"
  - "Replaced the Tailwind green-utility success banner with a token-driven (--success/--success-soft) inline style to honor the no-off-palette-color constraint; the form-level error uses the .error _base class"
  - "useState-controlled form values (not data-init DOM attrs) port the sketch's diff/changed-dot behavior idiomatically in React over the existing useActionState flow"
metrics:
  duration: "~10 min"
  completed: "2026-06-14"
  tasks: 3
  files: 3
requirements: [UI-05]
---

# Phase 13 Plan 02: Profile player-pass restyle (Court) Summary

Restyled `/profile` onto the Court 006 «Карточка + форма» language: a player-pass `.idcard` (initials avatar, name, @nickname, level + side chips) with a read-only Email/Телефон contact strip, a dashed `.net-rule`, then an edit form over the real v2.0 fields with a courtSide `.seg`, a read-only login Email, and an edit-toggle + diff-gated Save — all layered over the unchanged `updateProfileAction`/`parseProfileForm`/`getProfile`/`requireUser` contract.

## What Was Built

- **`profile.css`** (new, co-located global stylesheet): ported the 006 screen-specific classes absent from `globals.css` — `.net-rule`, `.idcard` + `::before`/`::after` court motif, `.id-avatar`, `.id-name`/`.id-handle`, `.id-chips`/`.id-chip`(+`.accent`/`.ck`), `.id-contact` meta overrides, `.ro-tag`, `.changed-dot` (+ `.field.is-changed .changed-dot`), the `.select-wrap` CSS-mask token chevron, the three-column `.seg` (`button[aria-pressed="true"]` → `--primary-soft`/`--primary`; `.seg.locked`), `.edit-toggle`, `.form-head`/`.form-foot`. Single `@container (max-width: 440px)` phone reflow. No hex literals — every color is a Court token or `color-mix`.
- **Page** (`page.tsx`): preserved the `requireUser()` guard and `getProfile(prisma, user.id)` read verbatim and the `initial`-prop shape; imported `./profile.css`. Renders the `.cq` wrapper → `.card card-pad idcard` with an `initials()` avatar, eyebrow "Личный кабинет", `<h1>{name}`, `@{nickname}` mono handle, level (`.id-chip accent`) + side (`.id-chip`) chips via `skillLevelLabels`/`courtSideLabels`, and an `.id-contact` strip with Email (`логин` ro-tag) + Телефон (`скрыт от соперников` ro-tag, em-dash when empty). Then `<hr class="net-rule">` and `<ProfileForm>`.
- **Form leaf** (`profile-form.tsx`): kept the `useActionState`/`parseProfileForm`/`updateProfileAction` flow and every field `name`. Restyled to Court `.field`/`.label`/`.input`. courtSide is now the 006 `.seg` (3 `<button aria-pressed>` from `courtSides`/`courtSideLabels`) mirrored into a hidden `<input name="courtSide">`. skillLevel select wrapped in `.select-wrap`. Email rendered read-only (`disabled`, `name="email"` kept). Added an edit-toggle (Редактировать enables inputs + seg), controlled-state per-field diff vs a baseline driving `.changed-dot`, Save disabled until a field diffs or while `pending` (label `Сохраняем…`/`Сохранить`), and re-lock + re-baseline on `state.ok`.

## How It Works

The page stays a Server Component; identity comes only from `requireUser()` → `getProfile`. The form leaf holds `values`/`baseline` controlled state seeded from `initial`. `Редактировать` flips `editing`, enabling the inputs and the seg and resetting the baseline to `initial`; each field compares `values[k] !== baseline[k]` to toggle its `.changed-dot` and to compute `dirty` (Save gate). The courtSide buttons set `values.courtSide`, and a hidden `<input name="courtSide">` mirrors it so the submitted FormData is byte-identical to the old `<select name="courtSide">`. On `state.ok` a `useEffect` re-baselines to the saved values and re-locks. Email is a `disabled` input: disabled controls are omitted from FormData, and the action's `formData.get("email") || undefined` already maps that to "no change", so the read-only email cannot alter the Better Auth changeEmail path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Off-palette color] Token-driven success banner**
- **Found during:** Task 3
- **Issue:** The original success banner used Tailwind `bg-green-900/40 text-green-300` utilities — off the Court palette, conflicting with the no-hardcoded-color constraint applied across the restyle.
- **Fix:** Replaced with an inline style driven by `--success`/`--success-soft` + `color-mix` (matching the `.error` _base treatment); copy changed to "Профиль сохранён".
- **Files modified:** `src/app/(app)/profile/profile-form.tsx`
- **Commit:** 62297c2

### Notes (not deviations)
- Ported `.net-rule` into `profile.css` (screen-specific, absent from `globals.css`) — same call as 13-01; the sibling `auth.css` copy is route-group-scoped and not imported here.
- The disabled read-only email no longer submits a value, but the action already no-ops on absent/empty email, so the effective changeEmail behavior is unchanged (email was already only changed when it differed from `user.email`).
- Sketch's vanilla `data-init`/DOM-mutation diff JS was reimplemented as React controlled state (idiomatic), not ported verbatim.

## Verification Results

- `npx tsc --noEmit` — clean (exit 0).
- `npx next build` — compiled successfully; `/profile` route generated (all 11 routes build).
- `grep -rnE '#[0-9a-fA-F]{3,8}' src/app/(app)/profile/` — no hex literals.
- profile-form contains `updateProfileAction`, `parseProfileForm`, `name="courtSide"`, `name="email"`, `name="nickname"`, `aria-pressed`.
- profile page contains `requireUser` + `getProfile` + `idcard` + `ro-tag` + `profile.css`.
- profile.css contains `.idcard`, `.ro-tag`, `aria-pressed`, `.changed-dot`; no hex.

## Self-Check: PASSED
