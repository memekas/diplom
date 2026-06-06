---
phase: 02-tournaments-status-machine
verified: 2026-06-06T00:00:00Z
status: human_needed
score: 12/12 must-haves verified
overrides_applied: 0
re_verification:
human_verification:
  - test: "As an admin, open /admin/tournaments/new, fill name + size (8) + optional date/location, submit"
    expected: "Tournament is created, browser redirects to /tournaments/{id}, page shows the tournament with the «Регистрация открыта» badge"
    why_human: "Full browser round-trip (form submit → Server Action → redirect → RSC render); cannot be confirmed by grep/tsc alone"
  - test: "As an anonymous visitor (logged out), open /tournaments"
    expected: "Page renders the list (or «Турниров пока нет» empty-state) with no redirect to /login; status badges render the RU labels"
    why_human: "Anonymous-reachability + visual badge rendering is a browser-only behavior"
  - test: "As a non-admin (logged-in player) or anonymous, navigate to /admin/tournaments/new"
    expected: "Redirected to /login (page guard); the «Создать турнир» nav link is not shown to non-admins"
    why_human: "Redirect UX + conditional nav rendering depend on live session state in the browser"
  - test: "Open /tournaments/{a-random-nonexistent-id}"
    expected: "Next.js not-found page renders (no 500/crash)"
    why_human: "notFound() boundary rendering is observed in the browser"
---

# Phase 2: Tournaments & Status Machine Verification Report

**Phase Goal:** Админ создаёт playoff-турнир для пар (размер 4/8/16); любой пользователь (включая анонима) видит список турниров и страницу турнира со статусом; статус (registration→in_progress→finished) управляется единственной серверной функцией перехода с гвардами.
**Verified:** 2026-06-06
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| 1  | Tournament model exists with setsPerMatch/gamesPerSet defaults | ✓ VERIFIED | `schema.prisma:98-110` model Tournament; migration SQL has `setsPerMatch DEFAULT 3`, `gamesPerSet DEFAULT 6`; `prisma migrate status` = "up to date" |
| 2  | createTournament persists status 'registration' | ✓ VERIFIED | `tournament.ts:26` hard-sets `status: "registration"`; not in schema/input. Migration default also `'registration'` |
| 3  | transitionTournament rejects illegal edges server-side, DB-checked | ✓ VERIFIED | `tournament-status.ts:32` re-reads DB via findUniqueOrThrow, `:38` rejects stale `from`, `:44` rejects non-allowed edge. 16/16 test assertions pass |
| 4  | size validated to {4,8,16}, others rejected before DB write | ✓ VERIFIED | `validation/tournament.ts:23-27` zod refine over tournamentSizes; test rejects 5/0/32/1/non-numeric |
| 5  | Admin creates tournament via guarded page/form (name, size, date?, location?) | ✓ VERIFIED (code) / human flow | action+page+form all exist & wired; browser round-trip → human #1 |
| 6  | Created tournament persists at status 'registration' | ✓ VERIFIED | same as truth 2 (action calls service which hard-sets) |
| 7  | Non-admin/anon direct create-action call rejected server-side (Forbidden) | ✓ VERIFIED | `actions.ts:26` `await requireAdmin()` is first executable line; `auth-guards.ts:50` throws "Forbidden"; throw uncaught (rejection IS the boundary) |
| 8  | Create link admin-only; create page redirects non-admins | ✓ VERIFIED (code) / human UX | `nav.tsx:24` gates link on role==="admin"; `new/page.tsx:9-19` requireAdmin→redirect("/login"); redirect UX → human #3 |
| 9  | Anyone (incl anon) sees /tournaments newest-first with RU badge | ✓ VERIFIED (code) / human render | `page.tsx` no guard, `listTournaments` (createdAt desc), maps TournamentStatusBadge; anon render → human #2 |
| 10 | Empty list shows clear empty-state | ✓ VERIFIED | `page.tsx:19-22` «Турниров пока нет.» on length===0 |
| 11 | Anyone sees /tournaments/[id]: info, format, date/loc if set, badge, 0/size + placeholder | ✓ VERIFIED | `[id]/page.tsx` getTournament, name/size/«Single-elimination (пары)»/conditional date+loc/badge/`0/{size}`/«Пока нет зарегистрированных пар» — no Pair query (correct per CONTEXT) |
| 12 | Unknown id → not-found state, not crash | ✓ VERIFIED (code) / human render | `[id]/page.tsx:17-19` notFound() on null; render → human #4 |

**Score:** 12/12 truths verified at code level (4 also need browser confirmation, listed in Human Verification)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `prisma/schema.prisma` | Tournament model + defaults | ✓ VERIFIED | model present, relation-less by design, kysely/auth tables untouched |
| `src/lib/validation/tournament.ts` | schema + status union + parse | ✓ VERIFIED | exports createTournamentSchema, parseTournamentForm, tournamentSizes, tournamentStatuses, tournamentStatusSchema, TournamentStatus |
| `src/lib/services/tournament-status.ts` | transition + ALLOWED_TRANSITIONS + isAllowedTransition | ✓ VERIFIED | all three exported; finished terminal `[]` |
| `src/lib/services/tournament.ts` | create/list/get | ✓ VERIFIED | all three exported, explicit select |
| `*.test.ts` (validation + status) | unit tests | ✓ VERIFIED | 32 + 16 assertions, both exit 0 |
| `admin/tournaments/actions.ts` | guarded create action | ✓ VERIFIED | requireAdmin first, parse, create (WR-01 try/catch), revalidate, redirect |
| `admin/tournaments/new/page.tsx` | guarded page | ✓ VERIFIED | requireAdmin→redirect non-admin |
| `admin/tournaments/new/create-tournament-form.tsx` | client form | ✓ VERIFIED | useActionState, size select 4/8/16, optional date/location |
| `(public)/tournaments/page.tsx` | public list | ✓ VERIFIED | unguarded, badge, empty-state |
| `(public)/tournaments/[id]/page.tsx` | public detail | ✓ VERIFIED | unguarded, notFound, 0/size placeholder |
| `components/tournament-status-badge.tsx` | RU badge | ✓ VERIFIED | exact RU labels, raw-value fallback, no "use client" |
| `components/nav.tsx` | admin-only create link + public link | ✓ VERIFIED | role-gated «Создать турнир», public «Турниры» |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| tournament.ts | prisma.tournament | create/findMany/findUnique | ✓ WIRED | 3 matches |
| tournament-status.ts | prisma.tournament | findUniqueOrThrow/update | ✓ WIRED | 2 matches |
| actions.ts | requireAdmin | first line | ✓ WIRED | line 26, before parse/DB |
| actions.ts | createTournament | parsed → service → revalidate | ✓ WIRED | 1 call + revalidatePath + redirect |
| public/page.tsx | listTournaments | RSC direct read | ✓ WIRED | call present |
| public/page.tsx | TournamentStatusBadge | per-row render | ✓ WIRED | imported + rendered |
| public/[id]/page.tsx | getTournament | RSC read by id | ✓ WIRED | call present |
| nav.tsx | /admin/tournaments/new | admin-only Link | ✓ WIRED | role-gated |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Validation logic | `npx tsx tournament.test.ts` | 32 assertions passed, exit 0 | ✓ PASS |
| Status machine guards | `npx tsx tournament-status.test.ts` | 16 assertions passed, exit 0 | ✓ PASS |
| Type safety | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Migration sync | `npx prisma migrate status` | "Database schema is up to date!" | ✓ PASS |
| Migration committed | `ls prisma/migrations` | `20260606133517_add_tournament/` present | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| TOUR-01 | 02-01, 02-02 | Admin creates tournament (name, size 4/8/16, single-elim, opt date/location) | ✓ SATISFIED | guarded action/page/form + service create at status registration |
| TOUR-02 | 02-03 | Anyone sees tournament list with status | ✓ SATISFIED | public list page + RU status badge + empty-state |
| TOUR-03 | 02-03 | Anyone sees tournament page: info, pairs list, status | ✓ SATISFIED | public detail page (pairs list = Phase-3 placeholder per CONTEXT — not a gap) |
| TOUR-04 | 02-01 | Status registration→in_progress→finished via guarded server transitions | ✓ SATISFIED | transitionTournament, DB-checked, illegal edges rejected (proven by tests) |

No orphaned requirements. REQUIREMENTS.md already marks TOUR-01..04 Complete (independently confirmed here).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | — | No TBD/FIXME/XXX/TODO/HACK debt markers | — | clean |
| `[id]/page.tsx` | 60 | "Placeholder" comment | ℹ️ Info | Intentional — pairs list deferred to Phase 3 per CONTEXT; not a stub |

No blockers. WR-01 (review warning re: errors.form dead UI) is already fixed: `actions.ts:34-39` wraps createTournament in try/catch and surfaces a `form` error. IN-01/IN-02/IN-03 are documented thesis-acceptable info items.

### Human Verification Required

All code-level truths are VERIFIED. The following are browser-only behaviors (visual render, redirect UX, anonymous reachability) that cannot be confirmed without running the app:

1. **Admin create round-trip** — submit /admin/tournaments/new as admin → expect redirect to detail page showing new tournament with «Регистрация открыта» badge.
2. **Anonymous list access** — open /tournaments logged out → expect list/empty-state, no /login redirect, RU badges render.
3. **Non-admin guard UX** — non-admin/anon visiting /admin/tournaments/new → expect redirect to /login; «Создать турнир» nav link absent for non-admins.
4. **Not-found render** — open /tournaments/{bad-id} → expect Next not-found page, no 500.

### Gaps Summary

No gaps. All 12 must-have truths are satisfied in the actual codebase, all artifacts exist and are substantive and wired, all key links connect, both unit-test suites pass (48 assertions total), tsc is clean, the migration is committed and the DB is in sync, and the security boundary (requireAdmin first line, server-set status, DB-authoritative transitions, size validation) holds under tracing. The relation-less Tournament model and 0/size placeholder are correct by design (Pair/Match are Phase 3/4/5). Status is therefore `human_needed` solely because four browser-only flows require human confirmation — there is nothing to fix.

---

_Verified: 2026-06-06_
_Verifier: Claude (gsd-verifier)_
