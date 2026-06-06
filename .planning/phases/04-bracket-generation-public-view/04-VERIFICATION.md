---
phase: 04-bracket-generation-public-view
verified: 2026-06-06T00:00:00Z
status: human_needed
score: 12/12 must-haves verified
overrides_applied: 0
human_verification:
  - test: "As admin, open a tournament in status registration with EXACTLY size pairs (4/8/16). Confirm an enabled «Старт турнира» button shows under «Управление турниром»."
    expected: "Enabled submit button visible (admin only)."
    why_human: "RSC conditional rendering + role gating — only observable in a logged-in admin browser session."
  - test: "Click «Старт». Confirm the page revalidates and the «Сетка» section appears with the bracket; the status badge becomes in_progress and the «Старт» entry disappears."
    expected: "Bracket renders (rounds R1→Финал columns); status flips to in_progress; revalidatePath refresh is immediate."
    why_human: "Full click → server action → generateBracket → revalidatePath → re-render cycle; only observable live in a browser."
  - test: "On a tournament where pairs != size, confirm the «Старт» area shows the disabled hint «Для старта нужно ровно N пар (сейчас M).» and no enabled button."
    expected: "Disabled hint text, no submit button."
    why_human: "Conditional client-leaf render (canStart=false branch) — needs a rendered admin view."
  - test: "As anonymous (logged out) visitor, open an in_progress tournament. Confirm the bracket is fully visible (round columns, pair names, «TBD» for unfilled future slots) with no login required."
    expected: "Bracket visible to anon; player names shown; «TBD» on later-round empty slots."
    why_human: "Anon read path + visual layout of columns/«TBD» — browser-only."
  - test: "Re-click «Старт» on an already-started tournament (or direct re-POST). Confirm a RU error 'Сетка уже сгенерирована — повторная генерация запрещена' surfaces (not a raw error)."
    expected: "RU reject banner; no second bracket; status stays in_progress."
    why_human: "Live action error surfacing through useActionState banner — browser-only."
  - test: "As non-admin or anonymous, attempt a direct POST to startTournamentAction. Confirm it is rejected server-side ('Forbidden') before any generation, not merely hidden in UI."
    expected: "Forbidden thrown before generateBracket; no bracket created."
    why_human: "Server-side authz on a public HTTP endpoint — requires crafted request / non-admin session."
---

# Phase 4: Bracket Generation & Public View Verification Report

**Phase Goal:** Админ «Старт» (ровно 4/8/16 пар) → одна транзакция: Fisher–Yates → полная иммутабельная single-elimination сетка (size-1 матчей) → турнир in_progress; любой видит сетку (раунды/пары/TBD).
**Verified:** 2026-06-06
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | advance(round,position) returns correct parent {round+1, floor(pos/2), slot} for 4/8/16 | ✓ VERIFIED | bracket.ts:34-43 pure fn; test exhaustively asserts the four spec rows + general rule (test passes, 40 assertions exit 0) |
| 2 | generateBracket creates exactly size-1 matches with round counts {4:[2,1],8:[4,2,1],16:[8,4,2,1]} | ✓ VERIFIED | ROUNDS table bracket.ts:47-51; matchCount=size-1 :54; FINAL-FIRST loop :119-162; tests assert count + per-round count for 4/8/16 |
| 3 | Round-1 matches fully paired (pairAId+pairBId); later rounds null pair slots | ✓ VERIFIED | bracket.ts:135-138 round===1 fills shuffled[pos*2]/[pos*2+1], else null; tests "round-1 fully paired with distinct pairs" + "rounds>1 null pair slots" pass |
| 4 | Every non-final match wired to exactly one parent slot (nextMatchId+nextSlot A/B); final null; no orphan/cycle | ✓ VERIFIED | advance() wiring :127-131; test "full wiring: parent slots, no orphan/cycle, final unparented" asserts distinct A/B per parent, bounded chain, final null |
| 5 | generateBracket rejects when status!=registration, pairs!=size, or any Match exists (BRKT-03 immutability) | ✓ VERIFIED | Guards bracket.ts:81-102 throw BracketError; 5 reject tests assert nothing created/no status flip; P2002 concurrency backstop :153-159 |
| 6 | After success: status in_progress, seeds 1..size assigned (Fisher–Yates order) | ✓ VERIFIED | shuffle+seed :109-115; transitionTournament →in_progress :166; tests "assigns seeds 1..size" + "happy path flips status to in_progress" pass |
| 7 | Admin sees enabled «Старт» when registration & pairs===size | ✓ VERIFIED (code) / human | page.tsx:166-176 admin+registration gate, canStart=pairs===size; form.tsx:36-50 enabled button. Visual render → human |
| 8 | Clicking «Старт» calls generateBracket → in_progress → revalidate → bracket shows | ✓ VERIFIED (wiring) / human | actions.ts:64-88 requireAdmin→generateBracket→revalidatePath; page re-fetches listBracket. Live cycle → human |
| 9 | When pairs!=size, «Старт» disabled/absent with hint stating exactly N pairs needed | ✓ VERIFIED (code) / human | form.tsx:28-34 !canStart → RU hint «Для старта нужно ровно {size} пар (сейчас {pairCount})» |
| 10 | Non-admin/anon direct POST to start action rejected server-side (requireAdmin first line) | ✓ VERIFIED (code) / human | actions.ts:69 `await requireAdmin()` first line, throw uncaught; auth-guards.ts:50 throws "Forbidden" |
| 11 | Re-clicking «Старт» on started tournament rejected with RU error | ✓ VERIFIED (code) / human | generateBracket existing-match guard :99-102 + P2002 backstop; action maps BracketError to RU :80-81 |
| 12 | Any user (incl. anon) sees bracket: rounds R1→final columns, pairA vs pairB names or «TBD» | ✓ VERIFIED (code) / human | page.tsx public RSC no guard, listBracket :61, BracketView :180-185; bracket-view.tsx columns + `name ?? "TBD"` :42 |

**Score:** 12/12 truths verified at code level (6 of them additionally routed to human for browser-only confirmation)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `prisma/schema.prisma` | Match model + Pair back-relations + Tournament.matches | ✓ VERIFIED | Match :154-178 (round/position Int, nullable pair/winner/nextMatch/nextSlot, Cascade, @@unique+@@index+@@map); Pair matchesAsA/B/Won :139-141; Tournament.matches :114. No Phase 5 fields (only a comment) |
| `src/lib/services/bracket.ts` | advance, ROUNDS, matchCount, generateBracket, listBracket, BracketError | ✓ VERIFIED | 211 lines; all exports present; $transaction wraps read+shuffle+create+wire+transition |
| `src/lib/services/bracket.test.ts` | Table-driven tests advance + generateBracket shape/immutability 4/8/16 | ✓ VERIFIED | 40 assertions pass exit 0; fake-tx harness, no real DB |
| `src/app/(public)/tournaments/[id]/actions.ts` | startTournamentAction (requireAdmin→generateBracket→revalidatePath) | ✓ VERIFIED | :64-88; typed BracketError mapping; generic fallback (WR-02 fixed) |
| `src/app/(public)/tournaments/[id]/start-tournament-form.tsx` | Admin «Старт» client leaf, disabled+hint when pairs!=size | ✓ VERIFIED | "use client" leaf, useActionState, no prisma import |
| `src/components/bracket-view.tsx` | Public bracket render, columns, names or «TBD» | ✓ VERIFIED | Pure Server Component, group-by-round, position sort, «TBD» on null |
| `src/app/(public)/tournaments/[id]/page.tsx` | Сетка section + «Старт» entry wired | ✓ VERIFIED | listBracket + BracketView :61,180-185; admin «Старт» entry :166-176 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| bracket.ts | prisma.$transaction | single tx wrapping all steps | ✓ WIRED | :75 `prisma.$transaction(async (tx) => {...}` — read/shuffle/create/wire/transition all on tx |
| bracket.ts | transitionTournament | flip registration→in_progress | ✓ WIRED | :166 reuses Phase 2 status machine inside same tx |
| actions.ts | generateBracket | import @/lib/services/bracket, after requireAdmin | ✓ WIRED | import :6; called :76 after requireAdmin :69 |
| page.tsx | prisma.match.findMany | grouped query feeding BracketView | ✓ WIRED | via listBracket helper (bracket.ts:177 real findMany) :61 |
| page.tsx | BracketView | render Сетка when matches exist | ✓ WIRED | :180-185 `matches.length > 0` guard |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| BracketView (page) | `matches` | listBracket → prisma.match.findMany (real query, orderBy round/position, real player-name select) | Yes (real DB query) | ✓ FLOWING |
| StartTournamentForm | `canStart/pairCount/size` | page.tsx pairs.length + tournament.size (real getTournament/listTournamentPairs) | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Bracket core math + shape + immutability | `npx tsx src/lib/services/bracket.test.ts` | 40 assertions passed, exit 0 | ✓ PASS |
| Type safety incl. Match client type | `npx tsc --noEmit` | exit 0, no errors | ✓ PASS |
| Prod build (route wiring) | `npm run build` | success, /tournaments/[id] builds | ✓ PASS |
| Migration applied | `npx prisma migrate status` | "Database schema is up to date!" (5 migrations incl. match_unique_slot) | ✓ PASS |
| WR-01 unique constraint in DB | inspect migration SQL | CREATE UNIQUE INDEX match_tournamentId_round_position_key present | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| BRKT-01 | 04-01, 04-02 | Admin «Старт» (4/8/16 pairs) → Fisher–Yates → full SE bracket → in_progress | ✓ SATISFIED | generateBracket transactional core + startTournamentAction entry; tests + build green (live click → human) |
| BRKT-02 | 04-02 | Any user sees bracket: rounds, matches, pairs, winners, TBD slots | ✓ SATISFIED | listBracket anon read + BracketView columns/«TBD»; winner highlight hook ready for Phase 5 (visual → human) |
| BRKT-03 | 04-01, 04-02 | Bracket immutable after generation — no re-draw | ✓ SATISFIED | existing-match guard + @@unique P2002 backstop; reject tests pass; RU error surfaced in action |

No orphaned requirements — all three BRKT IDs are claimed by phase plans and mapped to Phase 4 in REQUIREMENTS.md.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| bracket.ts / bracket-view.tsx | 132,175,42 | "TBD" | ℹ️ Info | Legitimate domain term (unfilled bracket slot — the actual feature), NOT a debt marker |

No FIXME/XXX/TODO/HACK/PLACEHOLDER markers. WR-01 (concurrent generate-once) fixed via @@unique([tournamentId,round,position]) + P2002→BracketError mapping. WR-02 (raw error forwarding) fixed via typed BracketError + generic RU fallback. IN-01 (nextSlot string typing) and IN-02 (totalRounds from key count) are info-only, non-blocking; not defects for Phase-4 data.

Note (per phase context): Match has no setsWonA/B or SetScore, winner nullable — this is correct Phase-5-deferred scope, NOT a gap.

### Human Verification Required

All bracket math, generation, immutability, schema, and wiring are verified programmatically (tests + tsc + build + migrate all green). The remaining 6 items are browser-only behaviors — admin button render/enablement, the live click→generate→revalidate→render cycle, anon bracket visibility with «TBD», RU re-generation reject surfacing, and server-side authz on a direct POST. See `human_verification` in frontmatter for exact steps/expected results.

### Gaps Summary

No gaps. Every must-have truth is backed by real code, a real DB query, and passing automated checks. Both code-review warnings (WR-01, WR-02) are confirmed fixed in source. Status is `human_needed` solely because the user-facing flows (admin button, start click, anon view, re-start reject, authz) are browser/session-bound and cannot be confirmed by grep/tests alone — not because anything is missing.

---

_Verified: 2026-06-06_
_Verifier: Claude (gsd-verifier)_
