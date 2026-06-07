---
phase: 10-ux-foundation
reviewed: 2026-06-07T19:01:34Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - src/app/globals.css
  - src/app/layout.tsx
  - src/components/nav.tsx
  - src/components/logout-button.tsx
  - src/components/tournament-status-badge.tsx
  - src/app/page.tsx
  - src/app/(public)/tournaments/page.tsx
  - src/lib/services/tournament.ts
  - src/lib/validation/auth.ts
  - src/lib/validation/profile.ts
  - src/app/(auth)/login/login-form.tsx
  - src/app/(auth)/register/register-form.tsx
  - src/app/(app)/dashboard/page.tsx
  - src/app/(app)/profile/profile-form.tsx
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-06-07T19:01:34Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Phase 10 (UX-фундамент) — forced dark theme, RU localization, responsive header, home open-tournaments listing, and a `?status=` filter on the public list. Reviewed against the adversarial focus areas: Next 16 async `searchParams`, status-filter injection, label-map indexing, public-data exposure, auth guards, RU completeness, forced dark, and no-new-deps convention.

The phase is solid. **Security is clean:** the `?status=` filter is whitelisted against `tournamentStatuses` before reaching Prisma (no raw passthrough, no injection); Next 16 `searchParams` is correctly awaited; the home page exposes only `status="registration"` tournaments and the public list exposes all-but-only-public Tournament columns (no credential leak); auth guards (`getOptionalSession` in nav, `requireUser` in dashboard/profile, admin role gating) are unchanged — confirmed via git that no phase-10 commit touches `auth-guards.ts`. RU localization is complete (no leftover English in user-facing strings, including zod messages). Forced dark is genuinely forced (`prefers-color-scheme` block removed, `:root` set to dark values). No new dependencies; Server Components for reads; `String`+zod-union for status. No Phase 11 creep.

One genuine quality defect (mode-inaccurate participant-count label on the home cards) and two informational items (defensive inconsistency between sibling pages; a pre-existing un-awaited rejection path that phase 10 only re-labeled).

## Warnings

### WR-01: Home card labels pair-mode tournaments as "{N} участников" — wrong count for pairs

**File:** `src/app/page.tsx:39`
**Issue:** The card renders `<span>{t.size} участников</span>` for every tournament regardless of `participantMode`. For `pairs`-mode tournaments, `size` is the number of **pairs**, not participants — an 8-pair playoff is "8 участников" on the home page but is actually 16 players / 8 pairs. The two sibling pages handle this correctly and inconsistently with the home page: `(public)/tournaments/page.tsx:44` and `(public)/tournaments/[id]/page.tsx:71` both render `{t.size} пар`. Since the card already renders `tournamentKindLabels[t.participantMode]`, the unit can be derived from the same value.
**Fix:**
```tsx
<span>
  {t.size} {t.participantMode === "pairs" ? "пар" : "игроков"}
</span>
```
(Or, if a single generic noun is preferred for thesis simplicity, keep "участников" but apply it consistently and note that for pairs it counts teams, not people — the current mix of "пар" on two pages and "участников" on the home page is the inconsistency worth resolving.)

## Info

### IN-01: Home page label indexing lacks the `?? "—"` fallback its sibling page uses

**File:** `src/app/page.tsx:34-38`
**Issue:** `formatLabels[t.format as keyof typeof formatLabels]`, `tournamentKindLabels[...]`, and `skillLevelLabels[t.level as keyof typeof skillLevelLabels]` index the RU maps with a bare `as` cast and no fallback. The sibling detail page defensively uses `skillLevelLabels[level as ...] ?? "—"` (`(public)/tournaments/[id]/page.tsx:30`). This is **not a live bug**: `format`/`participantMode`/`level` are non-null `String` columns with defaults and are constrained to the valid enum values on every write path (`createTournamentSchema`), so the cast always resolves to a defined label. Flagged only as a consistency gap — if a future migration or manual DB edit ever introduced an out-of-enum value, the home card would render the literal `undefined` text instead of the `—` the detail page shows.
**Fix:** Mirror the detail page for robustness: append `?? "—"` to each label lookup, or extract a shared `label(map, key)` helper.

### IN-02: Auth/logout client handlers leave the form stuck if the network call rejects

**File:** `src/app/(auth)/login/login-form.tsx:36-45`, `src/app/(auth)/register/register-form.tsx:47-69`, `src/components/logout-button.tsx:9-13`
**Issue:** `authClient.signIn.email` / `signUp.email` / `signOut` are awaited without a `try/catch`. The handlers only inspect the returned `{ error }` object; if the underlying call **rejects** (network failure, server 5xx surfaced as a throw), the promise rejection is unhandled and `submitting` is never reset to `false`, leaving the submit button permanently disabled until reload. This is **pre-existing** — phase 10 only translated the strings (verified via `git show 4e516f9`: the only diff in `login-form.tsx` was `"Signing in…"/"Log in"` → `"Вход…"/"Войти"`), so it is out of phase-10's introduced surface. Noted for awareness; not a phase-10 regression. Low priority for a thesis demo (CLAUDE.md: simplicity, no real load).
**Fix (if addressed):** Wrap each `await authClient.*` in `try { … } catch { setErrors({ form: "Произошла ошибка, попробуйте ещё раз" }); } finally { setSubmitting(false); }`.

---

_Reviewed: 2026-06-07T19:01:34Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
