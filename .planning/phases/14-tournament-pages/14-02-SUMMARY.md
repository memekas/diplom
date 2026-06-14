---
phase: 14-tournament-pages
plan: 02
subsystem: ui
tags: [bracket, playoff, react, client-component, popover, server-component, court, css]

# Dependency graph
requires:
  - phase: 12-court
    provides: "Court tokens + _base layer + .cq wrapper in globals.css (--winner-bg/--primary/--surface-2/--font-mono/etc.)"
  - phase: 13-auth
    provides: "Co-located screen-CSS + client-leaf-for-interactivity precedent (profile.css / profile-form.tsx)"
provides:
  - "Court-restyled playoff bracket (UI-08): L→R round columns with depth-from-final labels"
  - "Derived per-pair set-tally (from m.sets) shown inline; per-set games only in a fixed-position hover/tap popover"
  - "No final score anywhere; champion banner shows the name only"
  - "BracketScrollClient client leaf owning the games popover + measured elbow connectors"
  - "Co-located bracket.css (003 «Classic columns» ported 1:1, tokens-only)"
affects: [tournament-detail-page, milestone-v3-visual-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Component derives a fully-serializable bracket payload (labels + tally + champion) and delegates all render/interaction to a 'use client' leaf"
    - "Fixed-position popover placed via getBoundingClientRect with flip-below; dismissed on outside click, scroll, and pointer-leave"
    - "Measured elbow connectors: useLayoutEffect + double-rAF + document.fonts.ready + resize re-measure; transforms never measured mid-transition"
    - "display:contents wrapper to keep React-keyed round+connector pairs as direct flex children of .bracket"

key-files:
  created:
    - "src/components/bracket.css"
    - "src/components/bracket-scroll-client.tsx"
  modified:
    - "src/components/bracket-view.tsx"

key-decisions:
  - "Connectors implemented faithfully (NOT degraded) — the sketch geometry ported cleanly into React useLayoutEffect; columns also stand on their own via justify-content:space-around if connectors are stripped later"
  - "Set-tally + popover sets are suppressed on the final match (isFinal/nextMatchId===null) to honor the no-final-score contract"
  - "BracketScrollClient owns the .cq wrapper (the bracket renders standalone inside the detail page's «Сетка» section; UI-06 owns the page shell)"

patterns-established:
  - "RSC→client serialization for read-only visualizations: no prisma/business logic crosses; only display fields"
  - "Single shared fixed-position .sd-pop popover toggled by hover/tap with a pinned-state ref"

requirements-completed: [UI-08]

# Metrics
duration: ~12min
completed: 2026-06-14
---

# Phase 14 Plan 02: Playoff Bracket Restyle (UI-08) Summary

**Court-restyled playoff bracket: L→R round columns (depth-from-final labels), full-name match cards with a derived per-pair set-tally, per-set games in a fixed-position hover/tap popover, no final score anywhere, champion banner by name only — with measured elbow connectors ported faithfully.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-14T15:05:00Z (approx)
- **Completed:** 2026-06-14T15:17:36Z
- **Tasks:** 2
- **Files modified:** 3 (1 modified, 2 created)

## Accomplishments
- Ported sketch 003 «Classic columns» (variant A) into a co-located `bracket.css` — tokens only, zero hex outside comments.
- Refactored `bracket-view.tsx` into a Server Component that computes depth-from-final round labels, derives per-pair set-tally from `m.sets`, extracts the champion name only, and hands a serializable payload to the client leaf. Removed `setsLabel` + all inline game scores + the final score.
- Built `bracket-scroll-client.tsx` (`"use client"`): champion banner (name only), `.bracket-scroll` round columns, full-name `.slot` cards (`white-space:normal`, never truncated) with derived `.sl-tally`, TBD slots («Победитель пары»), winner bar + checkmark.
- Implemented the fixed-position `.sd-pop` games popover (one `.sd-col` per set, set-winning game `.w`), placed via `getBoundingClientRect` with flip-below-if-no-room, dismissed on outside click / scroll / pointer-leave; hover (desktop) + tap (mobile).
- Ported the measured elbow connectors faithfully (centering pass + elbow-sizing pass; `useLayoutEffect`, double-rAF, `document.fonts.ready`, resize re-measure).

## Connector Decision (required by plan)

**FAITHFUL GEOMETRY IMPLEMENTED — not degraded.** The 003 `positionConnectors` algorithm ported cleanly to React via `useLayoutEffect`:
- Pass 1 cascades L→R, centering each next-round card on its two feeders' midpoint via `translateY`.
- Pass 2 sizes each `.elbow` from feeder `getBoundingClientRect()` and aligns the outgoing stub to the actual next-round match center.
- Re-measurement runs on a double-`requestAnimationFrame`, on `document.fonts.ready` (Oswald metric swap), and on `window.resize`.
- No CSS transition is applied to the measured `transform`, so cards are never measured mid-transition.
- Connectors remain decorative/degradable: `.round` columns use `justify-content:space-around`, so the bracket lays out correctly even if connectors were stripped.

## Popover dismiss triggers wired (required by plan)
- **Outside click** — `document` click clears a pinned popover.
- **Scroll** — capture-phase `window` scroll listener clears any popover.
- **Pointer-leave** — `onMouseLeave` hides the hover popover (no-op while pinned).
- Tap toggles a pinned state; hover is ignored while pinned.

## Task Commits

1. **Task 1: bracket.css + depth-from-final labels + derived tally in bracket-view.tsx** — `a34cf9d` (feat)
2. **Task 2: bracket-scroll-client.tsx — columns/cards + fixed-position popover + connectors** — `1871b30` (feat)

## Files Created/Modified
- `src/components/bracket.css` — 003 «Classic columns» classes (champion banner, scroller, round columns, match/slot, set-tally, connectors, fixed popover). Tokens only.
- `src/components/bracket-view.tsx` — Server Component: depth-from-final labels, `tallyOf` derivation, champion-name extraction, serializable rounds payload; renders `<BracketScrollClient>`.
- `src/components/bracket-scroll-client.tsx` — `"use client"` leaf: banner + columns + cards + games popover + measured connectors.

## Decisions Made
- Connectors implemented faithfully rather than degraded — the React port proved stable; recorded above as the plan's required connector decision.
- Tally and popover sets are dropped on the final match to guarantee no final score renders (the source `BracketMatch.sets` for the final is simply not emitted to the client).
- The `.cq` wrapper lives in the client leaf since the bracket is rendered standalone inside the detail page's «Сетка» section; the detail-page shell (UI-06) is a separate plan and was not touched.

## Deviations from Plan

None - plan executed exactly as written. (Connectors were a sanctioned degradable choice; the faithful path was taken and recorded.)

## Issues Encountered
None. `npx tsc --noEmit` and `npx next build` both green on first pass after Task 2.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- UI-08 met. Bracket data/advancement logic untouched (restyle-only); no schema/Server Action change.
- Visual/browser UAT (desktop + ≤375px + 4/8/16 draw sizes + connector alignment) deferred to the milestone-v3.0 visual UAT after Phase 14, per 14-CONTEXT.
- Remaining Phase 14 plans: 14-03, 14-04.

## Self-Check: PASSED

---
*Phase: 14-tournament-pages*
*Completed: 2026-06-14*
