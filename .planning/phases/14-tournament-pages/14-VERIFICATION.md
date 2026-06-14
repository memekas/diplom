---
phase: 14-tournament-pages
verified: 2026-06-14T19:05:00Z
status: human_needed
score: 22/22 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open the tournament detail page, create form, playoff bracket, and round-robin/rotation format views on desktop AND at ≤375px width, for tournament sizes 4/8/16."
    expected: "Court programme layout reads correctly; bracket round columns and connector lines align for 4/8/16 (intentional horizontal scroll allowed); wide standings tables scroll inside their box, not the page; popover (per-set games) places correctly on hover/tap; no layout breakage on phone."
    why_human: "Visual correctness, responsive layout at narrow widths, and connector geometry across 4/8/16 draw sizes cannot be verified by grep/static inspection — requires rendering. This is the FINAL collective v3.0 visual UAT covering phases 12–14 together, deferred per 14-CONTEXT."
---

# Phase 14: Страницы турниров Verification Report

**Phase Goal:** Страница турнира, форма создания и все виды визуализации результатов (плей-офф сетка + форматные страницы) переведены на Court с сохранением v2.0-функциональности; сложные раскладки (сетка/широкие таблицы) корректны на 4/8/16 и на телефоне.
**Verified:** 2026-06-14T19:05:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| RC-1 | Tournament page = Court programme layout (hero + регламент-мета + стартовый лист с посевом и подсветкой "ваша пара" + прогресс + CTA) | ✓ VERIFIED | page.tsx imports tournament.css (line 3); `.cq`/hero/`.meta`/`.plist`/`.cta-stack`/`.admin-box` present; `is-you` highlight at lines 287, 332 |
| RC-2 | Create form changes fields by format (playoff→4/8/16 select; round_robin→number; americano/mexicano→Тип=Одиночный + Подсчёт=Очки locked + Число раундов) | ✓ VERIFIED | `isRoundFormat` drives `effectiveMode="singles"`/`effectiveScoring="points"` (l.63-64), disabled select + hidden input (l.115,202), `sizeMinByFormat` 3/4/8 (l.30-34), totalRounds `required={format==="mexicano"}` (l.242) |
| RC-3 | Playoff bracket = round columns, full names + set-tally, per-game score on hover/tap, no final score, champion banner; aligned for 4/8/16 | ✓ VERIFIED | bracket-view derives tally via `tallyOf(m.sets)` (l.42-50,86), final detected `nextMatchId===null` (l.56,91), tally/sets dropped for final; champ-banner + ch-name name-only (client l.238-259); `.sd-pop` fixed popover; no size-toggle |
| RC-4 | Format pages: round_robin = matches-by-round + standings table; americano/mexicano = текущие/прошедшие игры + рейтинг игроков | ✓ VERIFIED | round-robin-view `.round-block`/`.round-label`/standings table (Место/Очки/Разница, leader/podium/diff); rotation-view `.matches live` + standings; both use authoritative `computeStandings`/`UnitStanding`, never recompute |
| 1-01a | Hero: eyebrow + status-badge + h1 + lede over регламент over стартовый лист over CTA | ✓ VERIFIED | page.tsx hero block; tournament-status-badge component imported |
| 1-01b | Регламент meta card with Формат value carrying hover/focus tooltip (.tip) | ✓ VERIFIED | tournament.css contains `.tip`; per-format tooltip copy authored (SUMMARY documented, copy-only) |
| 1-01c | Стартовый лист numbered .pair + avatar + side·level; current-user pair .is-you via same userId compare | ✓ VERIFIED | `is-you` class toggled on `mine` (l.287,332); getOptionalSession userId (l.87,89) |
| 1-01d | Прогресс: .cap-count "N / size" + .progress bar + .empty | ✓ VERIFIED | tournament.css `.cap-count`/`.cap-head`; classes present in page markup |
| 1-01e | Sub-forms (participate/start/score/round-score/remove/finish) on _base primitives; Server Actions & gates unchanged | ✓ VERIFIED | All 6 sub-forms use `.field/.input/.btn/.error`; no phase-14 commit touches actions.ts |
| 1-01f | renderEntry only admin+in_progress; readOnly=!isAdmin\|\|finished | ✓ VERIFIED | page.tsx l.133 readOnly, l.137-138 renderEntry, gate lines 314/349/440/464 intact |
| 2-02a | Round columns L→R with depth-from-final labels | ✓ VERIFIED | bracket-view computes labels; `.bracket-scroll`/`.round`/`.round-label` in bracket.css |
| 2-02b | Two .slot per match, full names (not truncated), winner .win | ✓ VERIFIED | `.slot`/`.sl-name`/`.win` in bracket.css; white-space normal |
| 2-02c | Set-tally derived from m.sets (not stored setsWonA/B), one .sl-tally/slot | ✓ VERIFIED | `tallyOf` counts games>opponent (l.42-50); view derives rather than uses setsWonA/B (IN-04 documented divergence) |
| 2-02d | Per-game score in fixed popover .sd-pop hover/tap; no inline game score | ✓ VERIFIED | `.sd-pop` fixed popover; placePopover; sets dropped for final |
| 2-02e | No final score anywhere; champion banner name-only | ✓ VERIFIED | final tally/sets dropped (l.91-105); ch-name shows championName only |
| 2-02f | Geometry correct for actual size; no size-toggle | ✓ VERIFIED (code) | no toggle in source; connectors degradable. Visual 4/8/16 alignment → human UAT |
| 3-03a | Round-robin matches by round (.round-block/.mrow/.court/.matchup/.score/.await) | ✓ VERIFIED | round-robin-view structure present incl. `.await` "Ожидает счёта" |
| 3-03b | Standings table cols Место/Участник/Игр/Победы/Поражения/Очки/Разница; leader/podium; diff pos/neg/zero | ✓ VERIFIED | table.standings columns + leader/podium/diff classes (l.101-122) |
| 3-03c | Rotation: .matches live + past games + player rating | ✓ VERIFIED | rotation-view `.matches live` (l.80), standings rating table |
| 3-03d | Player rating: no cut-line (clean rating) | ✓ VERIFIED | no cut-line/qualif markers; row classes cosmetic only (REVIEW confirmed) |
| 3-03e | Both tables scroll inside .standings-scroll; computeStandings never recomputed | ✓ VERIFIED | `.standings-scroll` wrappers; UnitStanding consumed, never recomputed |
| 4-04a | Size control swaps select↔number, only visible carries name="size" | ✓ VERIFIED | exactly one control rendered (l.172-189), both name="size", swapped by format |
| 4-04b | createTournamentAction + parseTournamentForm + Zod + free-form scoring (no setsPerMatch/gamesPerSet/targetPoints) unchanged | ✓ VERIFIED | createTournamentAction wired; no forbidden fields (only comment confirming absence); no actions/zod commit in phase 14 |

**Score:** 22/22 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/app/(public)/tournaments/[id]/tournament.css` | 002 screen classes (.plist/.tip/.cta-stack...) | ✓ VERIFIED | exists, substantive, contains `.plist`; no hardcoded colors |
| `src/app/(public)/tournaments/[id]/page.tsx` | Court programme hub | ✓ VERIFIED | exists; imports tournament.css; gates intact |
| `src/components/bracket-scroll-client.tsx` | Client leaf — fixed popover + connectors | ✓ VERIFIED | exists; exports BracketScrollClient; `.sd-pop`; WR fixes applied |
| `src/components/bracket.css` | 003 screen classes | ✓ VERIFIED | exists; contains `.sd-pop`; token-only |
| `src/components/bracket-view.tsx` | Server Component: labels + set-tally + champion | ✓ VERIFIED | exists; tallyOf + championName + passes to client leaf. NOTE: plan's `contains: champ-banner` pattern lives in the client leaf (correct architecture: SC computes, leaf renders) — not a defect |
| `src/components/formats.css` | 009 screen classes | ✓ VERIFIED | exists; contains `.standings-scroll`; token-only |
| `src/components/round-robin-view.tsx` | Court round-robin | ✓ VERIFIED | exists; round-block + standings |
| `src/components/rotation-view.tsx` | Court rotation, no cut-line | ✓ VERIFIED | exists; matches live + rating |
| `src/app/(app)/admin/tournaments/new/create-tournament.css` | 007 screen classes | ✓ VERIFIED | exists; contains `.sel-wrap`; token-only |
| `src/app/(app)/admin/tournaments/new/create-tournament-form.tsx` | Court sectioned form | ✓ VERIFIED | exists; format-driven, size swap, forced+locked, totalRounds |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| page.tsx | tournament.css | `import "./tournament.css"` | ✓ WIRED | line 3 (tool false-negative: regex had literal quotes) |
| page.tsx | .is-you compare | userId === player.id | ✓ WIRED | lines 287, 332 |
| bracket-view.tsx | bracket-scroll-client.tsx | `<BracketScrollClient>` | ✓ WIRED | line 111 |
| bracket-scroll-client.tsx | .sd-pop popover | fixed-position toggled hover/tap, dismissed scroll/resize/outside | ✓ WIRED | popover + WR-01/04 dismissal fixes |
| round-robin-view.tsx | formats.css | `import "./formats.css"` | ✓ WIRED | line 14 (tool false-negative: regex had literal quotes) |
| rotation-view.tsx | .standings-scroll | wraps rating table | ✓ WIRED | line 156 |
| create-tournament-form.tsx | createTournamentAction | useActionState | ✓ WIRED | imported + wired |
| create-tournament-form.tsx | name="size" swap | only visible carries name | ✓ WIRED | lines 176, 187 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| TypeScript compiles | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Production build green | `npx next build` | Compiled successfully, 11/11 routes | ✓ PASS |
| No hardcoded colors in 4 phase CSS files | grep hex/rgb/hsl | NONE | ✓ PASS |
| Server Action / engine / schema unchanged | git log name-only filter | no actions.ts/engine/prisma/migration in phase 14 | ✓ PASS |
| WR-01..04 hardening present | git show f88d8c5 | resize-dismiss, feeder guard, onFocus/onKeyDown, outside-click | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| UI-06 | 14-01 | Tournament page programme layout in Court | ✓ SATISFIED | RC-1, truths 1-01a..f |
| UI-07 | 14-04 | Create form Court + format-driven fields | ✓ SATISFIED | RC-2, truths 4-04a..b |
| UI-08 | 14-02 | Playoff bracket in Court | ✓ SATISFIED | RC-3, truths 2-02a..f |
| UI-09 | 14-03 | Format pages (round-robin + rotation) | ✓ SATISFIED | RC-4, truths 3-03a..e |

All 4 requirement IDs from PLAN frontmatter accounted for; REQUIREMENTS.md maps exactly UI-06..UI-09 to Phase 14 — no orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| page.tsx, participate-form.tsx, score-form.tsx | various | Inline `style={{}}` magic numbers | ℹ️ Info | IN-03; no correctness impact, low priority for thesis |
| bracket-view.tsx | 42-50 | tallyOf ignores tie sets | ℹ️ Info | IN-04; impossible in padel; deliberate score-contract divergence |

No debt markers (TBD/FIXME/XXX) introduced. No stubs: all artifacts substantive, wired, and data flows from authoritative services (computeStandings, m.sets, Server Actions). The 4 REVIEW warnings (WR-01..04, bracket client leaf robustness) were fixed in commit f88d8c5.

### Human Verification Required

#### 1. Final v3.0 collective visual UAT (phases 12–14)

**Test:** Render the tournament detail page, create-tournament form, playoff bracket, and round-robin/rotation format views on desktop AND at ≤375px width, across tournament sizes 4/8/16.
**Expected:** Court programme layout reads correctly; bracket round columns + connector lines align on 4/8/16 (intentional horizontal scroll acceptable); wide standings tables scroll inside `.standings-scroll`, not the page; per-set games popover places correctly on hover (desktop) and tap (mobile); no layout breakage on phone.
**Why human:** Visual fidelity, responsive narrow-width layout, and connector geometry across draw sizes require rendering — not statically verifiable. Per 14-CONTEXT this is the final milestone-wide v3.0 visual UAT covering phases 12–14 together.

### Gaps Summary

No gaps. All 22 observable truths verified, all 10 artifacts exist/substantive/wired, all 8 key links wired, tsc + next build green, no hardcoded colors, restyle-only constraint upheld (no Server Action / engine / validation / branching / gate / migration change in phase 14), and all 4 REVIEW warnings fixed in f88d8c5. The two gsd-tools "failures" (CSS import patterns, champ-banner location) are tool false-negatives confirmed correct by direct inspection. Status is `human_needed` solely because the milestone-wide visual/responsive/4-8-16 UAT is the final deferred human-verify item — not a gap.

---

_Verified: 2026-06-14T19:05:00Z_
_Verifier: Claude (gsd-verifier)_
