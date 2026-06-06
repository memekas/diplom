---
phase: 05-results-advancement
plan: 03
subsystem: results-ui
tags: [scoring, server-action, requireAdmin, bracket-view, champion, match-01, match-02, match-03, match-04, match-05, auth-05]
requires:
  - "05-02: recordResult(prisma, matchId, sets[]) → {matchId,winnerId,setsWonA,setsWonB,finished}; ResultError codes; SetScore + Match.setsWonA/B"
  - "05-01: setWinner / matchWinnerFromSets / ResultError"
  - "Phase 4: listBracket, BracketView (inert winner-highlight hook), bracket.ts advance/nextSlot wiring, detail page + actions.ts"
  - "Phase 1: requireAdmin / getOptionalSession auth-guards; action→service[$transaction]→revalidatePath pattern"
provides:
  - "recordResultAction(tournamentId, matchId, setsPerMatch, _prev, formData) — requireAdmin-first guarded Server Action → recordResult → revalidatePath (MATCH-01/02/03/04, AUTH-05)"
  - "parseRecordResultForm(formData, setsPerMatch) — integer-coerce set{n}_a/set{n}_b rows, skip empty, reject partial/negative"
  - "ScoreForm — admin-only \"use client\" per-set score-entry leaf (binds tournamentId+matchId, pre-fills existing sets)"
  - "Extended listBracket (setScores + setsWonA/B + nextMatchId) + BracketView (per-set scores, winner highlight, champion banner)"
affects:
  - "Closes milestone v1.0 — full result-entry slice live (admin enters/edits scores; bracket + champion update immediately)"
tech-stack:
  added: []
  patterns:
    - "Guarded Server Action mirroring startTournamentAction: requireAdmin() literal first line; tournamentId+matchId bound from the leaf (never form body); ResultError→RU map; generic RU fallback; revalidatePath; no redirect"
    - "use-client leaf (useActionState + bound ids), public RSC stays server-only — Pitfall 11 boundary"
    - "Champion derived in BracketView as winner of the parent-less (nextMatchId null) final match"
key-files:
  created:
    - src/lib/validation/result.ts
    - src/app/(public)/tournaments/[id]/score-form.tsx
    - scripts/e2e-record-result.ts
  modified:
    - src/app/(public)/tournaments/[id]/actions.ts
    - src/lib/services/bracket.ts
    - src/components/bracket-view.tsx
    - src/app/(public)/tournaments/[id]/page.tsx
decisions:
  - "Form convention: up to setsPerMatch rows named set{n}_a / set{n}_b (n from 1); fully-empty rows skipped (match may end in 2 of 3), partial rows rejected — parser only shapes+integer-coerces, validity stays in recordResult/setWinner (T-05-06)"
  - "setsPerMatch passed as a 3rd bound arg into recordResultAction so the parser knows the row count without re-reading the tournament in the action"
  - "Champion derived inside BracketView from the parent-less final match (no extra page prop) — simplest, page already gates by matches.length"
  - "Admin score-forms rendered as a separate 'Ввод результатов' section under the bracket (Claude's Discretion) — one form per both-pairs-filled match, only when status==in_progress"
metrics:
  duration: ~12 min
  completed: 2026-06-06
  tasks: 2
  files: 7
---

# Phase 05 Plan 03: Result-entry UI + bracket scores/champion Summary

Exposed the Phase 5 scoring engine to users — the Core Value slice that closes milestone v1.0. Added a `requireAdmin`-guarded `recordResultAction` wrapping `recordResult` + `revalidatePath`, an admin-only `"use client"` per-set score-entry leaf, and extended `listBracket`/`BracketView` to render per-set scores, light up the previously-inert winner highlight, and show the champion when the final is decided. Verified on a green production build plus a seeded full-4-pair-bracket e2e exercising the entire service path (R1 advancement → final → finished + champion → MATCH-04 edit re-derive + re-propagate → invalid/no-winner rejects).

## What Was Built

- **`src/lib/validation/result.ts` — `parseRecordResultForm(formData, setsPerMatch)`** (mirrors `parseRegisterPairForm`'s discriminated `{ok,data|errors}`): scans rows `set{n}_a`/`set{n}_b` for n=1..setsPerMatch; skips fully-empty rows; rejects partial rows and zod-coerces each present pair to a non-negative integer. Does NOT re-implement set/match validity — that stays in `recordResult`/`setWinner` (T-05-06).
- **`recordResultAction` appended to `actions.ts`** (participate/start untouched): `await requireAdmin()` is the literal first statement (T-05-04 / AUTH-05 — a non-admin/anon POST throws "Forbidden" before any parse/DB work, NOT caught). `tournamentId` + `matchId` bound from the leaf, never the form body (T-05-05). Parses → on failure returns `{ok:false,error}`; calls `recordResult(prisma, matchId, sets)` in try/catch; maps `ResultError` → `e.message` (RU), any other throw → generic RU fallback (T-05-07 / WR-02). On success `revalidatePath(/tournaments/${tournamentId})` (Pitfall 10), returns `{ok:true}`, no redirect. Exports `RecordResultActionState`.
- **`src/app/(public)/tournaments/[id]/score-form.tsx` — `ScoreForm`** (`"use client"`, no prisma import): `useActionState(recordResultAction.bind(null, tournamentId, matchId, setsPerMatch), null)`. Renders setsPerMatch rows of two number inputs pre-filled from existing sets (editable — MATCH-04), pair-name labels, «Сохранить счёт» (disabled while pending), red error banner (participate-form class).
- **`listBracket` (bracket.ts)** extended: selects `setScores` (orderBy setNumber → gamesPair1/gamesPair2), `setsWonA`/`setsWonB`, `nextMatchId`; maps `sets: {gamesPair1,gamesPair2}[]` into the returned shape. Pair select unchanged (names only — no PII, T-05-08).
- **`BracketView` (bracket-view.tsx)** extended: `BracketMatch` gains `nextMatchId`/`setsWonA`/`setsWonB`/`sets`; renders a per-set score line (`6:4 6:3`) under each match when sets exist; the existing `pairId === winnerId` Slot hook now lights up (winnerId arrives non-null); a champion banner («Чемпион: …») derived from the parent-less final match's winner.
- **`page.tsx`** wired: imports `ScoreForm`; adds an admin-only «Ввод результатов» section (only `status === "in_progress"`) rendering one form per match with both pair slots filled. Page stays unguarded — anonymous visitors still see the bracket + scores + champion.

## Verification

- `npx tsc --noEmit` → clean (after each task).
- `npm run build` → success (11/11 static pages, all routes compiled, TypeScript pass).
- `grep -nE "await requireAdmin\(\)" actions.ts` → line 111 is recordResultAction's literal first statement.
- `grep '"use client"' score-form.tsx` → present; `grep -lE "@/lib/db|@prisma/client" score-form.tsx` → NO_PRISMA_IMPORT (leaf clean).
- **Seeded full-bracket e2e** (`scripts/e2e-record-result.ts`, `npx tsx` → "E2E PASSED", all assertions ok):
  - generateBracket → 3 matches, 2 R1, final at round 2 with empty slots.
  - record R1 match0 (6:4 6:3) → pairA wins 2:0, not finished; record R1 match1 (3:6 4:6) → pairB wins.
  - both R1 winners advance into the final's slots; final undecided.
  - invalid set 6:5 (no tiebreak) → ResultError reject; single 6:4 best-of-3 → no-winner reject.
  - record final (6:2 6:1) → slot-A wins, `finished=true`, tournament status "finished", champion = final winner in bracket read, 2 sets shown.
  - MATCH-04 edit (flip to 3:6 4:6) → winner re-derived to slot-B, stays finished (no-op transition), champion re-derived in bracket read.

## Deviations from Plan

None — plan executed as written. Form-input convention chosen as `set{n}_a`/`set{n}_b` (documented in result.ts); `setsPerMatch` passed as a bound action arg so the parser gets the row count without an extra DB read.

## Deferred Manual Checks (AUTO_MODE)

The human-verify checkpoint's interactive browser steps were auto-approved after running the automatable equivalents. Deferred to a human on `npm run build && npm start`:
- Visual confirmation the public page updates without a hard refresh after save/edit (revalidatePath on a real `next start` — Pitfall 10; the action calls revalidatePath and the prod build is green, but cache-revalidation visual timing is browser-only).
- Logged-out/incognito read-only view rendering scores + winner highlight + champion with no score form.
- The behaviors themselves (advancement, champion, free-edit re-propagation, invalid/no-winner rejects, server-side authz reject) are covered by the e2e + the requireAdmin-first static check.

## Self-Check: PASSED

- FOUND: src/lib/validation/result.ts
- FOUND: src/app/(public)/tournaments/[id]/score-form.tsx
- FOUND: scripts/e2e-record-result.ts
- FOUND commit eea5dc0 (Task 1)
- FOUND commit 0902643 (Task 2)
- FOUND commit ab19f7a (e2e)
