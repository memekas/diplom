---
phase: 11-tournament-ux
verified: 2026-06-07T23:05:00Z
status: human_needed
score: 5/5 success criteria verified (static); 6/6 requirements satisfied (static)
overrides_applied: 0
re_verification:
  previous_status: null
  previous_score: null
human_verification:
  - test: "Create form — switch format between playoff / round_robin / americano / mexicano and observe conditional fields"
    expected: "playoff → size as 4/8/16 select; others → size number input. americano/mexicano → Тип locked to «одиночный» (disabled), Подсчёт locked to «Очки» (disabled), «Число раундов» appears (required for mexicano). scoringMode=sets → Сетов/Геймов inputs; scoringMode=points → Целевые очки input."
    why_human: "Client-side useState field show/hide and disabled-select rendering cannot be confirmed by static grep alone."
  - test: "Register — submit form without choosing a level"
    expected: "HTML required + zod «Выберите уровень» error; no silent «beginner» default reaches the server. Picking a level + optional birthDate persists both to User after signup."
    why_human: "Browser required-attribute behavior + Better Auth signup round-trip writing birthDate to DB needs a live session."
  - test: "Profile — edit each field (name/courtSide/phone/level/birthDate/nickname/email) and save; also try a nickname/email already taken by another user"
    expected: "All fields save and reflect on reload; taken nickname → «Никнейм уже занят» RU error; taken email → email-taken RU error; no crash."
    why_human: "DB persistence + unique-conflict RU error path + Better Auth changeEmail flow require a live session and data."
  - test: "Participation — open a singles tournament vs a pairs tournament as a logged-in player"
    expected: "singles → «Участвовать» button (participateSingleAction); pairs → partner-nickname form (participateAction). Anonymous sees «Войдите, чтобы участвовать»."
    why_human: "Session/role-gated rendering and the resulting registration write need a live session."
  - test: "Result entry — as admin on an in_progress round-based tournament in points mode vs sets mode"
    expected: "points mode → two fields (points_a/points_b); sets mode → N set rows (set{n}_a/set{n}_b) up to setsPerMatch. Saving recomputes standings / advances rounds (americano/mexicano)."
    why_human: "Admin-session-gated entry UI + downstream standings/rotation recompute need a running app with data."
  - test: "Per-format visualization — view active round_robin (matches table + unit standings), americano/mexicano (current vs past games + player rating), playoff (bracket); then view each as finished"
    expected: "Correct view per format; current/past split correct; finished tournament shows the same per-format view fully read-only (no entry controls) for admin and players alike (VIS-02)."
    why_human: "Visual layout, current/past grouping, and read-only control-hiding across roles are visual/session checks."
  - test: "Adaptive/dark-theme rendering of all new forms and views on desktop + mobile widths"
    expected: "No horizontal scroll or clipping; dark-theme-safe colors throughout the create/register/profile forms and the round-robin/rotation views."
    why_human: "Responsive layout and theme contrast are inherently visual."
---

# Phase 11: UX турниров (формы, ввод счёта, визуализация) Verification Report

**Phase Goal:** Полный пользовательский путь по турнирам: админ создаёт турнир со всеми полями и режимом подсчёта, игрок регистрируется (одиночно/парой по виду турнира) с уровнем и датой рождения, админ вводит результаты по режиму и управляет турниром, а все видят визуализацию активного турнира по его формату и историю прошедших.
**Verified:** 2026-06-07T23:05:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Phase 11 Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Create form: format/вид/уровень/кол-во/цена + scoringMode selector + (for sets) setsPerMatch/gamesPerSet without cap | ✓ VERIFIED | `create-tournament-form.tsx`: name=format/participantMode/level/size/price/scoringMode present; `effectiveScoring==="sets"` reveals setsPerMatch/gamesPerSet (`min={1}`, no max); points → targetPoints; isRoundFormat → totalRounds (required for mexicano). playoff size = 4/8/16 select, else number input. |
| 2 | Register collects required level (5 RU) + birthDate; singles/pairs participate by kind | ✓ VERIFIED | `register-form.tsx`: `<select name="skillLevel" defaultValue="" required>` with disabled empty option (no beginner slip); `<input name="birthDate" type="date">`; `registerSchema.skillLevel: z.enum(skillLevels)` (no default), `birthDate.optional()`; `auth.ts` declares `birthDate {type:"string", input:true}`. Participation by-kind verified in page.tsx (truth 3). |
| 3 | Extended profile edits all fields; admin remove + finish controls | ✓ VERIFIED | `profile-form.tsx`: name/courtSide/phone/skillLevel/birthDate/nickname/email all present, wired to `updateProfileAction`. `page.tsx`: `RemoveRegistrationForm` per registration during `status==="registration"` (admin only); `FinishTournamentForm` during `in_progress` (all formats, admin only). |
| 4 | Result entry branches by mode (N set rows vs two points fields); score visualized by mode | ✓ VERIFIED | `round-score-form.tsx`: `scoringMode==="points"` → points_a/points_b; else N rows set{n}_a/set{n}_b; bound via `recordResultAction.bind(null, tournamentId, roundMatchId, setsPerMatch)`. `recordResultAction` re-reads format from DB and dispatches via `recordFormatResult`. |
| 5 | Per-format active viz (bracket / RR table / standings+rounds) + current/past panels; finished read-only with per-format history | ✓ VERIFIED | `page.tsx`: isPlayoff → BracketView (unchanged); round_robin → RoundRobinView; americano/mexicano → RotationView. RotationView splits current (unrecorded) vs past (recorded). standings unwrapped by kind (units→RR, players→Rotation). `readOnly = !isAdmin || status==="finished"` gives read-only history (VIS-02). |

**Score:** 5/5 success criteria verified statically. Live rendering/flow confirmation routed to human verification.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `create-tournament-form.tsx` | Conditional create form by format/scoringMode | ✓ VERIFIED | All field names present; conditional blocks correct; wired to createTournamentAction via useActionState + parseTournamentForm pre-check. |
| `src/lib/auth.ts` | birthDate additionalField (input:true) | ✓ VERIFIED | `birthDate: {type:"string", required:false, input:true}` at L29; also skillLevel required, nickname required. |
| `src/lib/validation/auth.ts` | registerSchema required skillLevel + optional birthDate | ✓ VERIFIED | `skillLevel: z.enum(skillLevels)` (L50, no default), `birthDate ... .optional()` (L53-55), 5 skillLevels. |
| `register-form.tsx` | Required level select + birthDate input wired to signUp.email | ✓ VERIFIED | Empty disabled default + required; birthDate spread as ISO into authClient.signUp.email. |
| `profile-form.tsx` | Full profile edit (7 fields) | ✓ VERIFIED | name/courtSide/phone/skillLevel/birthDate/nickname/email; wired to updateProfileAction. |
| `src/lib/services/rounds.ts` | listRounds + listTournamentPlayers safe-select read helpers | ✓ VERIFIED | Both exported; explicit selects exclude email/birthDate; ordered roundNumber asc, courtNumber asc; players oldest-first. |
| `round-robin-view.tsx` | RR matches table + unit standings (readOnly-aware) | ✓ VERIFIED | Consumes UnitStanding[]; readOnly + renderEntry props; standings table; never recomputes. |
| `rotation-view.tsx` | Americano/mexicano current/past + player rating (readOnly-aware) | ✓ VERIFIED | Consumes PlayerStanding[]; current=unrecorded / past=recorded split; readOnly + renderEntry. |
| `round-score-form.tsx` | Mode-branched round score form | ✓ VERIFIED | points/sets branch; bound to recordResultAction. |
| `remove-registration-form.tsx` | Admin remove leaf | ✓ VERIFIED | `removeRegistrationAction.bind(null, tournamentId, kind, id)`, kind "pair"|"player". |
| `finish-tournament-form.tsx` | Admin finish leaf | ✓ VERIFIED | `finishTournamentAction.bind(null, tournamentId)`. |
| `participate-form.tsx` | ParticipateForm + SingleParticipateForm | ✓ VERIFIED | Both exported; bound to participateAction / participateSingleAction. |
| `page.tsx` | Format-dispatched + mode-branched detail page | ✓ VERIFIED | participantMode branch + format dispatch + admin controls + readOnly all present and wired. |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| create-form FormData names | parseTournamentForm / createTournamentAction | name= attributes + useActionState | ✓ WIRED |
| register-form | authClient.signUp.email | spread birthDate ISO + skillLevel | ✓ WIRED |
| auth.ts additionalFields.birthDate | User.birthDate | input:true createUser spread | ✓ WIRED |
| profile-form | updateProfileAction | useActionState + parseProfileForm | ✓ WIRED |
| page.tsx | listRounds + listTournamentPlayers + computeStandings | RSC awaits for non-playoff | ✓ WIRED |
| round-score-form | recordResultAction | recordResultAction.bind | ✓ WIRED |
| page.tsx | participateSingleAction / participateAction | participantMode branch | ✓ WIRED |
| round/rotation views | computeStandings shapes | typed UnitStanding[] / PlayerStanding[] props | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| page.tsx (non-playoff) | rounds | `listRounds(prisma, id)` → `prisma.round.findMany` | DB query (real) | ✓ FLOWING |
| page.tsx (singles) | players | `listTournamentPlayers` → `prisma.tournamentPlayer.findMany` | DB query (real) | ✓ FLOWING |
| page.tsx | standings | `computeStandings(prisma, id)` | DB-derived | ✓ FLOWING |
| page.tsx (pairs) | pairs | `listTournamentPairs(prisma, id)` | DB query (real) | ✓ FLOWING |
| RoundRobinView/RotationView | standings | unwrapped by `standings.kind` from computeStandings | real, not hardcoded | ✓ FLOWING |

No hollow props: standings passed as `standings.kind==="units" ? standings.units : []` / `players : []` — the empty fallback only triggers on the wrong kind (mutually exclusive branch already selects the right view), not as a permanent stub.

### Probe Execution

No project probe scripts (`scripts/*/tests/probe-*.sh`) exist. Verification used the project's `node:test`/tsx assertion suite instead.

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Type check | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Production build | `npx next build` | Compiled + TypeScript OK, 11/11 pages | ✓ PASS |
| rounds read helpers (Plan 03) | `npx tsx --test src/lib/services/rounds.test.ts` | 3 assertions, pass | ✓ PASS |
| Full service+validation suite | `npx tsx --test src/lib/services/*.test.ts src/lib/validation/*.test.ts` | 17/17 files pass, 0 fail | ✓ PASS |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All actions exported | grep recordResult/participateSingle/finish/removeRegistration/participate Action | 5/5 found | ✓ PASS |
| Server forces singles+points for americano/mexicano | grep tournament.ts superRefine | participantMode/scoringMode/totalRounds guards present | ✓ PASS |
| recordResultAction admin-guarded + DB-dispatch | read actions.ts L249+ | requireAdmin + recordFormatResult dispatch + typed RU errors | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| FORM-01 | 11-01 | Create form fields format/mode/level/count/price | ✓ SATISFIED | create-tournament-form.tsx all fields + server superRefine |
| FORM-02 | 11-02, 11-04 | Register required level (5 RU) + birthDate; singles/pairs by kind | ✓ SATISFIED | register-form.tsx + auth.ts + page.tsx participate branch |
| FORM-03 | 11-02, 11-04 | Full profile edit + admin remove/finish | ✓ SATISFIED | profile-form.tsx + RemoveRegistrationForm + FinishTournamentForm |
| SCORE-02 | 11-01, 11-04 | scoringMode selector + sets/games no cap; entry branches by mode | ✓ SATISFIED | create-form conditional fields + round-score-form points/sets |
| VIS-01 | 11-03, 11-04 | Per-format active viz + current/past panels | ✓ SATISFIED | rounds.ts + RoundRobinView + RotationView + page.tsx dispatch |
| VIS-02 | 11-04 | Finished tournaments viewable with per-format history | ✓ SATISFIED | readOnly = !isAdmin \|\| finished in page.tsx |

No orphaned requirements: REQUIREMENTS.md maps exactly FORM-01/02/03, SCORE-02, VIS-01/02 to Phase 11; all claimed by plans.

### Playoff Invariant

| File | Last commit | Touched in Phase 11? |
|------|-------------|----------------------|
| `bracket-view.tsx` | 0902643 (05-03) | NO |
| `score-form.tsx` | 0902643 (05-03) | NO |
| `result.ts` | 32661b1 (05) | NO |
| `bracket.ts` | 0902643 (05-03) | NO |

✓ Playoff path unchanged. page.tsx routes isPlayoff → listBracket/BracketView/ScoreForm exactly as before; round-based path is additive (separate round-score-form.tsx, never edits score-form.tsx).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | No TODO/FIXME/XXX/TBD/HACK/PLACEHOLDER/"not implemented" in any of the 13 phase-11 modified files | — | — |

### Human Verification Required

7 items (visual rendering, session/role-gated control hiding, full per-format flows, DB persistence, responsive/dark-theme). See `human_verification` frontmatter for the full checklist — these are inherently browser/session checks, not code gaps. Both SUMMARYs (11-01, 11-04) explicitly deferred manual per-format UAT to phase UAT.

### Gaps Summary

No code gaps. Every statically checkable artifact exists, is substantive, is wired, and feeds real DB-derived data. Type check, production build, and the full 17-file test suite all pass. The playoff invariant holds (protected files unchanged since Phase 05). All 6 requirements and all 5 ROADMAP success criteria are satisfied at the code level. The remaining verification is purely browser/session/visual — listed as human_verification items, not failures.

---

_Verified: 2026-06-07T23:05:00Z_
_Verifier: Claude (gsd-verifier)_
