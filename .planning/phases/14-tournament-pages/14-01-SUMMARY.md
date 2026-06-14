---
phase: 14-tournament-pages
plan: 01
subsystem: ui
tags: [nextjs, server-components, tailwind, container-queries, court-design, css]

# Dependency graph
requires:
  - phase: 12-court
    provides: "Court tokens + _base component layer (.card/.meta/.badge/.progress/.empty/.field/.input/.btn/.avatar/.eyebrow) + .cq container-query wrapper + liveDot keyframe"
  - phase: 13-auth
    provides: "Co-located screen .css precedent (profile.css) + .net-rule rule + client-leaf form pattern"
provides:
  - "Tournament detail hub restyled onto Court «Programme» (002): hero + РЕГЛАМЕНТ + СТАРТОВЫЙ ЛИСТ + CTA + admin-box"
  - "Co-located tournament.css carrying the 002 screen-specific classes (.net-rule/.lede/.tip/.plist/.pair/.is-you/.pair-seed/.player/.player-sub/.vs/.you-tag/.cap-head/.cap-count/.cta-stack/.cta-row/.cta-price/.admin-box) + .badge-prog live-dot"
  - "Six sub-forms (participate/single/start/score/round-score/remove/finish) restyled onto _base form primitives"
affects: [14-02-bracket, 14-03-formats, milestone-uat-v3.0]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-screen co-located .css holding only non-globals classes; imported at top of the Server Component (Phase 13 precedent extended to the public tournaments route)"
    - "Format tooltip via .tip[tabIndex][data-tip] (hover + :focus-visible), token-only"
    - "Flex-trim gotcha solved with JSX nbsp ({\"\\u00a0\"}) around the lede price, not collapsible {\" \"}"

key-files:
  created:
    - "src/app/(public)/tournaments/[id]/tournament.css"
  modified:
    - "src/app/(public)/tournaments/[id]/page.tsx"
    - "src/app/(public)/tournaments/[id]/participate-form.tsx"
    - "src/app/(public)/tournaments/[id]/start-tournament-form.tsx"
    - "src/app/(public)/tournaments/[id]/score-form.tsx"
    - "src/app/(public)/tournaments/[id]/round-score-form.tsx"
    - "src/app/(public)/tournaments/[id]/remove-registration-form.tsx"
    - "src/app/(public)/tournaments/[id]/finish-tournament-form.tsx"

key-decisions:
  - ".badge-prog::before live-dot was NOT in globals — added it to tournament.css (globals only had .badge-reg::before + the liveDot keyframe)"
  - "TournamentStatusBadge component logic left untouched (it already maps registration/in_progress/finished → .badge.badge-reg/-prog/-fin); the live-dot is purely CSS"
  - "Per-format tooltip copy authored: playoff/round_robin/americano/mexicano each get a one-sentence RU explanation"
  - "Sub-form intra-layout uses inline grid/flex styles (token-driven, no hex) rather than inventing new screen classes, since the _base primitives carry all the visual chrome"

patterns-established:
  - "Editorial .prog-col ≤720px column inside a .cq main; @container (not @media) for the phone reflow"
  - "Start-list .pair card with .is-you highlight driven by the existing userId compare (no new data read)"

requirements-completed: [UI-06]

# Metrics
duration: 7min
completed: 2026-06-14
---

# Phase 14 Plan 01: Tournament Detail Page Restyle Summary

**Tournament detail hub and its six sub-forms restyled onto the Court «Programme» language (sketch 002 + _base primitives) — hero/РЕГЛАМЕНТ/СТАРТОВЫЙ ЛИСТ/CTA/admin-box in a ≤720px editorial column, with every v2.0 gate (renderEntry, readOnly, format/mode branching, Server Actions) preserved byte-identical.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-06-14T15:05:28Z
- **Completed:** 2026-06-14T15:12:00Z
- **Tasks:** 3
- **Files modified:** 8 (1 created, 7 modified)

## Accomplishments
- New co-located `tournament.css` carrying the 002 variant-A screen classes (token-only, zero hex), plus the `.badge-prog` live-dot pulse.
- Detail hub `page.tsx` rebuilt as a Court programme: `.cq` + `.prog-col`, hero (eyebrow «Турнир · Формат» + status badge + h1 + dot-separated lede with `&nbsp;` price), РЕГЛАМЕНТ `.meta` card with a format `.tip` tooltip, СТАРТОВЫЙ ЛИСТ `.plist`/`.pair` with seed + avatar + «сторона · уровень» + `.is-you` «Ваша пара» highlight, `.cap-count`/`.progress` capacity, `.cta-stack` CTA, dashed `.admin-box`.
- All six sub-forms swapped to `.field/.label/.input/.error/.btn(.btn-primary|.btn-ghost)`; dropped every `bg-red-*`/`bg-foreground` Tailwind utility.
- `npx tsc --noEmit` and `npx next build` both green; zero hex literals across the whole route directory.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create tournament.css + badge-prog live-dot** - `b783eda` (feat)
2. **Task 2: Restyle detail hub page.tsx onto Court programme** - `9db08b8` (feat)
3. **Task 3: Restyle the six sub-forms onto _base primitives** - `b6e52fe` (feat)

## Files Created/Modified
- `src/app/(public)/tournaments/[id]/tournament.css` - 002 screen-specific classes (net-rule/lede/tip/plist/pair/is-you/seed/player/player-sub/vs/you-tag/cap-head/cap-count/cta-stack/admin-box) + `.badge-prog::before` live-dot.
- `src/app/(public)/tournaments/[id]/page.tsx` - Restyled hub markup; all data reads, branches, `readOnly`, `renderEntry`, the visualization dispatch + playoff ScoreForm filter + finish block, and view-component props unchanged. Added local helpers `initials()`, `playerSub()`, and the `formatTips` copy map.
- `src/app/(public)/tournaments/[id]/participate-form.tsx` - `ParticipateForm` + `SingleParticipateForm` on `.field/.label/.input/.error/.btn.btn-primary.btn-block`; `name="player2Nickname"` + `.bind` preserved.
- `src/app/(public)/tournaments/[id]/start-tournament-form.tsx` - `!canStart` note → muted, submit → `.btn.btn-primary.btn-block`.
- `src/app/(public)/tournaments/[id]/score-form.tsx` - Set-row inputs → `.input`, labels → `.label`, add/remove → `.btn-ghost`, submit → `.btn-primary`; dynamic `set${n}_a/_b` names + row machinery untouched.
- `src/app/(public)/tournaments/[id]/round-score-form.tsx` - Same swap for both the points (`points_a/points_b`) and sets branches; `scoringMode === "points"` branch verbatim.
- `src/app/(public)/tournaments/[id]/remove-registration-form.tsx` - Button → `.btn-ghost` small, error → `.error`; `kind`/`id` binding preserved.
- `src/app/(public)/tournaments/[id]/finish-tournament-form.tsx` - Submit → `.btn.btn-primary`, error → `.error`.

## Decisions Made
- **`.badge-prog` live-dot needed adding** (per the plan's open question): globals.css carried only `.badge-reg::before { animation: liveDot … }` plus the `liveDot` keyframe; the in_progress pulse was absent, so it was added to `tournament.css`.
- **TournamentStatusBadge left untouched** — it already emits the correct `.badge.badge-*` classes; no component edit was required (so it is not in the modified-files list despite being named in the plan frontmatter).
- **РЕГЛАМЕНТ tooltip copy** authored per format (deviation note below): playoff «Игра на вылет…», round_robin «Круговой: каждый играет с каждым…», americano «Одиночная ротация: партнёры меняются каждый раунд…», mexicano «Одиночная ротация: соперников подбирают по текущему рейтингу…».
- **Singles start-list** uses a single `.player` inside each `.pair` with a «Вы» tag (the pairs branch uses «Ваша пара»), mirroring the 002 rail for the non-pairs mode the sketch did not draw.

## Deviations from Plan

The РЕГЛАМЕНТ tooltip copy is authored rather than quoted verbatim from the sketch (the sketch only supplies the playoff/«Олимпийская» string). round_robin/americano/mexicano strings were written to match the plan's described intent. This is the only copy-level deviation and is within the plan's explicit «per-format explanation string» instruction — not a behavior change.

No deviation rules (1–4) were triggered: no bugs, no missing critical functionality, no blocking issues, no architectural changes. Plan executed as written.

## Issues Encountered
- The route directory name contains `[id]`, which is a bash glob character class — `grep`/`sed`/`perl` with the path silently read the wrong target. Switched all content verification to Python (literal `open()`) for reliable reads/edits. A transient typo introduced during a scripted edit («Взбор») was caught and corrected before the Task 2 commit; final content is «Взнос».

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Hub shell is Court; the bracket/round-robin/rotation view components (imported untouched here) are owned by plans 14-02 / 14-03 and remain on their v2.0 styling until restyled.
- Visual UAT (desktop + ≤375px) deferred to the milestone-wide v3.0 visual UAT per 14-CONTEXT.

## Self-Check: PASSED

- `tournament.css` — FOUND
- `14-01-SUMMARY.md` — FOUND
- Commits `b783eda`, `9db08b8`, `b6e52fe` — all FOUND in git history

---
*Phase: 14-tournament-pages*
*Completed: 2026-06-14*
