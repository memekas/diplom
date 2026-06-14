---
phase: 13-auth
plan: 04
subsystem: account-screens
tags: [ui, dashboard, court, read-only, container-queries]
requires:
  - "src/lib/auth-guards.ts (requireUser)"
  - "src/lib/services/profile.ts (getProfile — courtSide read)"
  - "src/components/tournament-status-badge.tsx"
  - "globals.css Court component layer (.cq/.avatar/.pill/.badge*/.btn*/.eyebrow/.progress/.empty)"
provides:
  - "getMyTournaments(prisma, userId): MyTournaments — read-only session-scoped participation read"
  - "Restyled /dashboard «Мои турниры» (Court Variant A)"
affects:
  - "/dashboard route only"
tech-stack:
  added: []
  patterns:
    - "Read-only domain service over existing models (Pair + TournamentPlayer + Round), session-scoped by userId"
    - "Co-located screen CSS (dashboard.css) — globals component layer NOT re-ported"
    - "@container reflow on a .cq wrapper (no @media)"
key-files:
  created:
    - "src/lib/services/dashboard.ts"
    - "src/app/(app)/dashboard/dashboard.css"
  modified:
    - "src/app/(app)/dashboard/page.tsx"
decisions:
  - "courtSide side-pill read via getProfile (courtSide is NOT a Better Auth additionalField → absent from session)"
  - "De-dup merge by tournament id; a Pair entry wins over a stray TournamentPlayer (carries partner)"
  - "Round progress: total = totalRounds ?? materialized Round count; block omitted when total == 0 or playoff"
metrics:
  duration: ~9m
  completed: 2026-06-14
---

# Phase 13 Plan 04: Dashboard «Мои турниры» Restyle (UI-04) Summary

Restyled the ЛК-dashboard onto Court (005 Variant A): a `.who` identity header plus three status sections (Активные / Предстоящие / Завершённые) of role-aware `.tcard`s with state-appropriate CTAs, fed by a new READ-ONLY, session-scoped `getMyTournaments` over existing models.

## What Was Built

- **`src/lib/services/dashboard.ts`** — `getMyTournaments(prisma, userId)`:
  - Two read-only queries scoped to `userId`: `pair.findMany({ where: { OR: [{player1Id},{player2Id}] } })` (role=pair, partner = the non-session player) + `tournamentPlayer.findMany({ where: { userId } })` (role=solo).
  - Merges/de-dupes by tournament id (pair wins, carries `partnerName`).
  - Status → group: `in_progress`→active, `registration`→upcoming, `finished`→finished (unknown → upcoming).
  - Best-effort round progress for round-based formats (`round_robin`/`americano`/`mexicano`) via one grouped `round.findMany`; `total = totalRounds ?? roundCount`, block omitted when `total == 0`. Playoff has no `Round` rows → block omitted (graceful degrade).
- **`src/app/(app)/dashboard/dashboard.css`** — ported only the 005 screen-specific classes absent from globals: `.net-rule`, `.who*`, `.lkA`/`.head`/`.head-cta`, `.sec*`/`.tlist`, `.tcard`(+`::before` state bars `is-active`→`--primary` / `is-upcoming`→`--accent` / `is-finished`→`--text-faint`), `.tc-*`, `.place`/`.medal`, `.tcard .btn`, plus `@container` (560px / 480px) reflow. Token-only, no hex.
- **`src/app/(app)/dashboard/page.tsx`** — `requireUser()` guard preserved verbatim. Parallel `getProfile` (for `courtSide`/canonical `skillLevel`) + `getMyTournaments`. Identity header with @nickname mono pill, level pill, side pill; Профиль (`/profile`) + Найти турнир (`/tournaments`) CTAs. Three `<Section>`s of `<TournamentCard>`; state CTAs: active → round-progress + «К текущему раунду», upcoming → «Открыть», finished → «Результаты», all to `/tournaments/{id}`. Empty sections hidden; full-empty fallback `.empty` shown.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CSS comment `*/` sequence broke PostCSS parse**
- **Found during:** Task 3 (`next build`)
- **Issue:** The dashboard.css header comment listed reused classes as `.badge*/.btn*/.eyebrow/…`; the `*/` after `.btn` prematurely closed the CSS comment → `CssSyntaxError: Unknown word`, build failed.
- **Fix:** Rewrote the comment to plain words (no `*/` sequence).
- **Files modified:** `src/app/(app)/dashboard/dashboard.css`
- **Commit:** c220fe4

### Plan-checker WARNING resolved

- **courtSide side-pill:** As flagged, `courtSide` is NOT a Better Auth `additionalField`, so `session.user.courtSide` is `undefined`. Resolved by reading it via `getProfile(prisma, user.id)` (same as the profile screen) rather than the session, and rendering the pill only when valid. `additionalFields` / auth contract untouched. `skillLevel` + `@nickname` come from the session/profile and render as level pill + mono pill.

## Deferred Items

- **Playoff round-progress «N/M»** — playoff tournaments have no `Round` rows, so the round block is intentionally omitted (graceful degrade per CONTEXT/PATTERNS). Not fabricated. Carried as a deferred display nicety, not a code gap.
- **Finished `.place` (rank/medal)** — the sketch shows a placement medal on finished cards. There is no cheap read-only derivation of final standings/placement over the existing models without invoking format engines (business logic). Per the read-only constraint this was omitted; finished cards show the status badge + «Результаты» CTA. Deferred (would require a standings read, out of scope for this restyle).

## Verification

- `npx tsc --noEmit` — clean (all 3 tasks).
- `npx next build` — green; `/dashboard` route compiled.
- `getMyTournaments`: no `.create/.update/.delete/.upsert/.createMany`; every query filtered by `userId` (grep-asserted). Threats T-13-08 / T-13-09 mitigated — userId from `requireUser()` only, guard preserved verbatim.
- `grep -rnE '#[0-9a-fA-F]{3,8}' src/app/(app)/dashboard/` → no hex.
- CTAs target only `/profile`, `/tournaments`, `/tournaments/{id}`.

## Commits

- 464b7bf: feat(13-04): add read-only getMyTournaments dashboard service
- 604175f: feat(13-04): port 005 dashboard CSS (token-only, @container reflow)
- c220fe4: feat(13-04): restyle dashboard to Court sectioned «Мои турниры» (UI-04)

## Self-Check: PASSED

- FOUND: src/lib/services/dashboard.ts
- FOUND: src/app/(app)/dashboard/dashboard.css
- FOUND: src/app/(app)/dashboard/page.tsx
- FOUND commit: 464b7bf
- FOUND commit: 604175f
- FOUND commit: c220fe4
