---
phase: 14-tournament-pages
plan: 03
subsystem: tournament-format-views
tags: [ui, restyle, court, round-robin, rotation, standings, UI-09]
requires:
  - "Phase 12 Court tokens + _base layer + .cq (globals.css)"
  - "computeStandings (UnitStanding / PlayerStanding) — services/standings"
  - "listRounds RoundRead/RoundReadMatch (courtNumber, pointsA/B, teamA1/2/B1/2)"
provides:
  - "src/components/formats.css — 009 A+B match-rows + standings classes"
  - "round-robin-view.tsx restyled (Court .round-block/.matches/.standings)"
  - "rotation-view.tsx restyled (Court live/past + player rating, no cut-line)"
affects:
  - "src/components/round-robin-view.tsx"
  - "src/components/rotation-view.tsx"
  - "src/components/formats.css"
tech-stack:
  added: []
  patterns:
    - "Co-located screen .css per Phase 13 precedent; globals.css untouched"
    - "@container reflow (no @media); token/color-mix only, zero hex"
    - "Display-only win/lose + .dim derived from stored points (no recompute)"
key-files:
  created:
    - "src/components/formats.css"
  modified:
    - "src/components/round-robin-view.tsx"
    - "src/components/rotation-view.tsx"
decisions:
  - "Rotation «Текущие игры» uses «Ожидает счёта» — RoundReadMatch carries no target value, so no «До N» pill (do-not-invent-target rule honored)"
  - "win/lose side highlight + .dim losing number are pure presentation of already-stored pointsA/pointsB; computeStandings never recomputed"
metrics:
  duration: "~4 min"
  completed: "2026-06-14"
  tasks: 3
  files: 3
---

# Phase 14 Plan 03: Format pages restyle (round-robin + rotation, UI-09) Summary

Restyled the two non-playoff format views onto Court via a single co-located `formats.css`: round-robin renders per-round `.round-block` match rows (court chip · matchup with win/lose dot · score with dimmed losing number or «Ожидает счёта») plus a `.standings` table; rotation renders `.matches.live` current games, past games with real scores, and a `.unit-cell` player-rating ladder with no qualification boundary — both standings tables scroll horizontally inside `.standings-scroll`, computeStandings stays authoritative, and the admin `renderEntry` injection path is intact.

## What Was Built

- **`src/components/formats.css`** (new) — ports the 009 sketch classes absent from globals: `.t-head`/`.meta-strip`/`.round-prog`/`.net-rule` header shell, `.round-block`/`.round-label`/`.rl-tag`, `.matches`(+`.live`)/`.mrow`/`.court`(+net glyph `i`)/`.matchup`/`.side`(+`.win::after` primary dot/`.lose`)/`.mdash`/`.score`(+`.a`/`.b`/`.sep`/`.dim`)/`.await`, and `.standings-wrap`/`.standings-scroll`/`table.standings`/`.rank`/`tr.leader`/`tr.podium`/`.diff.pos/.neg/.zero`/`.unit-cell`. `@container (max-width:480px)` reflows `.mrow` (court spans full width). Token-only, zero hex.
- **`round-robin-view.tsx`** — `import "./formats.css"`; «Матчи» as `.round-block > .matches > .mrow`, «Турнирная таблица» in `.standings-wrap > .standings-scroll > table.standings`. Row 0 → `tr.leader`, rows 1–2 → `tr.podium`; Место as `.rank` chip; Разница `.diff.pos/.neg/.zero` (+ `+` prefix on positive).
- **`rotation-view.tsx`** — `import "./formats.css"`; «Текущие игры» in `.matches.live` (with `.rl-tag` «В игре»), «Прошедшие игры» with real `.score`, «Рейтинг игроков» with Игрок cell as `.unit-cell` (avatar initials + name). No knockout/advancement boundary in the rating table.

## Key Decisions

- **Target pill — NOT used.** `RoundReadMatch` exposes only `courtNumber`, `pointsA`, `pointsB`, and the four team slots; there is no target/points-to value in the data. Per the plan's do-not-invent-target rule, current rotation games render `<span className="await">Ожидает счёта</span>`, not a «До N» pill.
- **win/lose styling is display-only.** Both views derive `aWins`/`bWins` by comparing the already-stored `m.pointsA`/`m.pointsB` (`>` only — equal points produce neither `.win` nor `.lose`). This applies `.win`/`.lose` to the two `.side` spans and `.dim` to the losing number. No new winner is computed and `computeStandings` output is rendered verbatim (T-11-09 guard preserved).
- **`renderEntry` admin path intact (T-14-06).** `showEntry = !readOnly && Boolean(renderEntry)` unchanged; unrecorded round-robin matches still call `renderEntry!(m)` when `showEntry`, falling back to `.await` only in the read-only case. Rotation current games likewise call `renderEntry!(m)` when `showEntry`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `@media` literal in formats.css comment tripped the verify assert**
- **Found during:** Task 1
- **Issue:** The header comment said "use @container, NOT @media"; the automated `! grep -q "@media"` check matched the comment text.
- **Fix:** Rephrased the comment to "use container queries, not width media queries" (no behavior change).
- **Files modified:** src/components/formats.css
- **Commit:** 4bba3cf

**2. [Rule 3 - Blocking] "cut-line"/"qualification" literals in rotation-view comment tripped the verify assert**
- **Found during:** Task 3
- **Issue:** A clarifying comment used "NO knockout / qualification cut-line"; the `! grep -iE 'cut-line|qualif|...'` check matched the comment.
- **Fix:** Reworded to "no knockout, no advancement boundary, no \"advanced\" styling" (intent unchanged).
- **Files modified:** src/components/rotation-view.tsx
- **Commit:** 8c54bbb

## Verification

- `npx tsc --noEmit` → exit 0.
- `npx next build` → "Compiled successfully", TypeScript finished, 11/11 static pages generated.
- No hex in formats.css outside comments (grep clean).
- No `@media` (only `@container`) in formats.css.
- rotation-view: no `cut-line|qualif|вылет|cutline` (grep clean).
- Both views keep computeStandings-derived standings unrecomputed and the renderEntry admin path verbatim.

## Threat Flags

None — pure presentational restyle, no new endpoints, no data/schema/Server Action changes. T-14-06 (renderEntry gate) and T-14-07 (standings integrity) preserved; T-14-SC N/A (no package installs).

## Self-Check: PASSED

- formats.css, round-robin-view.tsx, rotation-view.tsx, 14-03-SUMMARY.md all present on disk.
- Commits 4bba3cf, ae69ed3, 8c54bbb all in git log.
