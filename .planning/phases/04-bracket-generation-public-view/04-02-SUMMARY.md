---
phase: 04-bracket-generation-public-view
plan: 02
subsystem: bracket-public-view
tags: [next, server-action, rsc, bracket, tailwind, authz]
requires:
  - "generateBracket(prisma, tournamentId) — Plan 04-01 transactional generate-once"
  - "Match model + Pair player relations (Plan 04-01 / Phase 3)"
  - "requireAdmin / getOptionalSession (auth-guards)"
provides:
  - "startTournamentAction (requireAdmin → generateBracket → revalidatePath) — BRKT-01/BRKT-03 surface"
  - "StartTournamentForm admin-only «Старт» client leaf (enabled/disabled + RU hint)"
  - "BracketView pure presentational Server Component (rounds R1→final, names/«TBD») — BRKT-02"
  - "listBracket(prisma, tournamentId) one-query safe-select read path"
affects:
  - "Phase 5 (results) lights up BracketView's winner-highlight hook once Match.winnerId is set"
tech-stack:
  added: []
  patterns:
    - "Server Action security boundary: requireAdmin() as first line, throw NOT caught (T-04-04)"
    - "Action + client-leaf + public RSC split (mirrors participateAction / participate-form)"
    - "One findMany with player-name-only select (no PII, mirrors listTournamentPairs) — T-04-06"
key-files:
  created:
    - "src/app/(public)/tournaments/[id]/start-tournament-form.tsx"
    - "src/components/bracket-view.tsx"
  modified:
    - "src/app/(public)/tournaments/[id]/actions.ts"
    - "src/app/(public)/tournaments/[id]/page.tsx"
    - "src/lib/services/bracket.ts"
decisions:
  - "listBracket helper added to bracket.ts (one query, safe select) rather than inline findMany in the page — keeps the read path beside generateBracket"
  - "«Старт» admin entry placed inside the registration block (status===registration only); cosmetic gate, generateBracket's tx is authoritative"
  - "winner-highlight is a render-ready hook (pairId===winnerId → ring) that does not trigger in Phase 4 (winnerId null)"
metrics:
  duration_min: 6
  completed: "2026-06-06"
  tasks: 2
  files: 5
---

# Phase 4 Plan 02: «Старт» action + public bracket view Summary

Exposes Plan 01's generation core to users: an admin clicks «Старт турнира» on a full (`status=registration` && pairs===size) tournament → `startTournamentAction` runs `requireAdmin()` then `generateBracket`, the tournament flips to `in_progress`, the page revalidates, and ANY visitor (incl. anonymous) sees the sealed bracket — rounds as left-to-right columns R1→final with pair names or «TBD» for unfilled slots. This is the Phase 4 Core Value slice.

## What Was Built

- **`startTournamentAction`** (`actions.ts`): `requireAdmin()` as the literal first line (T-04-04 / Pitfall 8 — a non-admin/anon direct POST throws "Forbidden" before any DB work; that throw is intentionally NOT caught). Then `generateBracket(prisma, tournamentId)` in a try/catch that maps the service's plain RU `Error` (wrong-status / wrong-count / already-generated → BRKT-03) to `{ok:false,error}`. On success `revalidatePath(/tournaments/${id})` (Pitfall 10) + `{ok:true}`, no redirect. `tournamentId` is bound from the leaf, never trusted from the form.
- **`StartTournamentForm`** (`start-tournament-form.tsx`): `"use client"` leaf, `useActionState(startTournamentAction.bind(null, tournamentId), null)`. `canStart` false → disabled-equivalent: a RU hint «Для старта нужно ровно {size} пар (сейчас {pairCount})». `canStart` true → enabled «Старт турнира» submit + red error banner (reuses participate-form's style). Never imports prisma.
- **`BracketView`** (`bracket-view.tsx`): pure presentational Server Component (no `"use client"`, no prisma). Groups matches by round, sorts each round by position, renders rounds as flex columns R1→final with RU headers (Финал / Полуфинал / Четвертьфинал / «N раунд»). Each match = two slots showing the pair name or «TBD» (opacity-dimmed). Winner-highlight hook (`pairId===winnerId` → ring/bold) wired but inert in Phase 4.
- **`listBracket`** (`bracket.ts`): one `findMany` ordered round→position selecting only pair player **names** (no PII — mirrors `listTournamentPairs`, T-04-06), mapped to `{pairAName,pairBName}` as `"name1 / name2"` or null.
- **`page.tsx`**: reads `isAdmin` from the optional session; fetches `listBracket`; renders an admin-only «Управление турниром» → «Старт» block during registration; renders the «Сетка» section with `<BracketView>` only when `matches.length > 0`. Page stays a public RSC — no guard added (anon views the bracket).

## Tasks Completed

| Task | Name | Commit | Key files |
|------|------|--------|-----------|
| 1 | startTournamentAction + admin-only «Старт» leaf (BRKT-01, BRKT-03) | bf10d05 | actions.ts, start-tournament-form.tsx |
| 2 | Public BracketView + Сетка section + listBracket (BRKT-02, BRKT-01) | 20199e4 | bracket-view.tsx, bracket.ts, page.tsx |

## Verification

- `npx tsc --noEmit` → clean (exit 0), both tasks.
- `npm run build` → success, 11 routes (incl. `/tournaments/[id]`), both tasks.
- **End-to-end runtime exercise** (tsx scratch script against the seeded dev DB, size-4 / 4 pairs, cleaned up after): `generateBracket` → matchesCreated **3**; tournament status → **in_progress**; **2** R1 matches fully named; **1** final match TBD/TBD; sample R1 slot rendered as `"P2 / P3"` via `listBracket`. **Re-generate rejected** (BRKT-03): `Нельзя сгенерировать сетку: турнир в статусе "in_progress"`. **Under-filled rejected**: `Нужно ровно 4 пар для старта (зарегистрировано 0)`. Confirms the wired read path + the action's error mapping behave correctly at runtime.
- Server-side authz (T-04-04): `requireAdmin()` is the action's first line; the throw is not caught, so a non-admin/anon POST is rejected before `generateBracket` — verified by code inspection (the guard contract is unit-covered in auth-guards).

## Deferred Manual Checks (auto-mode, browser-only)

- Visual: admin sees enabled «Старт» on a full tournament and the hint on an under-filled one; clicking flips to in_progress and the bracket appears; anon visitor sees the bracket with names + «TBD». Logic is covered by build + the runtime exercise above; only the browser rendering/click path is deferred.

## Deviations from Plan

None — plan executed exactly as written. The plan offered discretion between an inline `findMany` and a `listBracket` helper; chose the helper (one query, beside `generateBracket`).

## Self-Check: PASSED

All created files exist on disk; both task commits (bf10d05, 20199e4) present in git history.
