---
phase: 14-tournament-pages
plan: 04
subsystem: ui
tags: [court, create-tournament, react, server-action, conditional-form, css-container]

# Dependency graph
requires:
  - phase: 12-court
    provides: "Court tokens + _base component layer (.field/.input/.btn/.error/.eyebrow/.cq) in globals.css"
  - phase: 13-auth
    provides: "co-located per-screen .css precedent + .net-rule + CSS-mask select chevron (profile.css)"
provides:
  - "Court-restyled admin create-tournament form (007 sectioned form, UI-07)"
  - "create-tournament.css screen-specific classes (.fset/.sec/.sel-wrap/.seg/.seg-lock/.opt-tag/.req-tag/.cond)"
  - "Court editorial page shell for /admin/tournaments/new"
affects: [tournament-pages, ui-redesign-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sectioned create form: numbered .fset.sec fieldsets + .net-rule dividers, ≤640px .cq column"
    - "Forced-value lock kept as controlled-select + hidden-input (NOT .seg radio) so locked values post reliably"
    - "Size element-swap: render exactly one control carrying name=\"size\" (no double-submit)"

key-files:
  created:
    - "src/app/(app)/admin/tournaments/new/create-tournament.css"
  modified:
    - "src/app/(app)/admin/tournaments/new/create-tournament-form.tsx"
    - "src/app/(app)/admin/tournaments/new/page.tsx"

key-decisions:
  - "Kept Тип/Подсчёт as controlled-select + hidden-input throughout (did NOT migrate to .seg :has() radio pills) — preserves the proven forced singles/points submission for americano/mexicano (pattern risk #2: correctness over sketch fidelity). The .seg/.seg-lock CSS was still ported for visual lock captions."
  - "Used the CSS-mask chevron flavour (.sel-wrap::after, background: var(--text-muted) / focus var(--ring)) — token-driven, no hex baked into the SVG."

patterns-established:
  - "Conditional fields wrapped in .cond fade-in; .req-tag (--danger) for mexicano required-rounds, .opt-tag (--text-faint) for optional fields"

requirements-completed: [UI-07]

# Metrics
duration: 11min
completed: 2026-06-14
---

# Phase 14 Plan 04: Create-tournament form restyle Summary

**Admin create-tournament form restyled onto the Court 007 sectioned form (≤640px .cq column, three numbered .fset.sec fieldsets + .net-rule dividers, token-mask select chevrons), with the format-driven conditional fields and forced americano/mexicano singles+points locks preserved exactly.**

## Performance

- **Duration:** ~11 min
- **Completed:** 2026-06-14
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- New co-located `create-tournament.css` carrying only the 007 classes absent from globals (`.fset/.sec`, `.net-rule`, token-mask `.sel-wrap` chevron, `.seg/.seg-lock` pills, `.opt-tag/.req-tag`, `.cond` fade-in) — zero hex, token-only.
- `create-tournament-form.tsx` restyled to a sectioned Court form: `.cq` ≤640px column, three numbered sections, every `<select>` in a `.sel-wrap`, fields as `.field/.label/.input`, errors as `.error`, submit `.btn.btn-primary.btn-block`. Server Action, Zod pre-check, `useState` branching, and every `name=` attribute untouched.
- `page.tsx` restyled to a Court editorial heading (`.eyebrow` «Новый турнир» + `<h1>` + implicit-status hint) with `requireAdmin()` + `redirect("/login")` guard byte-identical.

## Task Commits

1. **Task 1: create-tournament.css (007 sectioned-form classes)** - `f3fcceb` (feat)
2. **Task 2: restyle create-tournament-form.tsx** - `861100b` (feat)
3. **Task 3: restyle create page shell (page.tsx)** - `e212695` (feat)

## Files Created/Modified
- `src/app/(app)/admin/tournaments/new/create-tournament.css` - 007 screen-specific classes (token-mask chevron, fieldset sections, seg pills, conditional fade-in)
- `src/app/(app)/admin/tournaments/new/create-tournament-form.tsx` - Court sectioned conditional form leaf (restyle only; logic/action/names preserved)
- `src/app/(app)/admin/tournaments/new/page.tsx` - Court editorial page shell (guard preserved)

## Decisions Made
- **Тип/Подсчёт submission mechanism: KEPT controlled-select + hidden-input (NOT migrated to `.seg` `:has()` radio pills).** Per pattern-mapper risk #2 and the plan's RISK #2 directive, migrating the forced/locked americano/mexicano values to native `.seg` radios threatened reliable native submission of the forced singles/points. The existing disabled-select + hidden-input mechanism (lines 115, 202) is proven to post the forced values, so it was retained verbatim for both free and forced cases; the `.seg`/`.seg-lock` CSS was still ported and a `.seg-lock` caption («Формат играется только одиночно» / «Подсчёт — только очки») provides the visual lock. Correctness over sketch fidelity.
- **CSS-mask chevron flavour** chosen over the 007 rotated-border-square so the arrow color is a single token (`--text-muted` → focus `--ring`), reusing the profile.css mask verbatim — keeps zero hex.
- Added one screen-scoped spacing rule `.sec .field + .field { margin-top: 16px }` for vertical rhythm between stacked fields (sketch used a grid gap; the restyle stacks fields in a single column).

## Forced-value submission path (confirmed preserved)
- americano/mexicano: `effectiveMode = "singles"` → `<input type="hidden" name="participantMode" value="singles">` + disabled visible select; `effectiveScoring = "points"` → `<input type="hidden" name="scoringMode" value="points">` + disabled visible select. Disabled selects do not post; the hidden inputs carry the forced values. Verified present at form-leaf lines 115 and 202.
- playoff/round_robin Тип stays user-selectable (NOT auto-locked).
- Size renders exactly one control carrying `name="size"` per format (select for playoff, number otherwise) — no double-submit.

## Deviations from Plan

None - plan executed exactly as written. (The Тип/Подсчёт controlled-select decision is the plan's explicitly-sanctioned RISK #2 safe path, not a deviation.)

## Issues Encountered
- The plan's Task 2 grep `! grep -qE 'setsPerMatch|gamesPerSet|targetPoints'` matches the explanatory comment that the plan itself instructs to keep ("Free-form scoring: no setsPerMatch / gamesPerSet / targetPoints inputs"). Confirmed via line-level grep that the only match is that comment — there are zero actual input fields with those names, satisfying the threat-model constraint (T-14-08). No action needed.

## Verification
- `npx tsc --noEmit` exits 0.
- `npx next build` green (11 routes, `/admin/tournaments/new` builds).
- `grep -rnE '#[0-9a-fA-F]{3,8}'` over the screen dir returns no hex outside comments.
- No `@media` (only `@container` via `.cq`).
- `requireAdmin` + `redirect("/login")` on Unauthorized/Forbidden preserved verbatim.

## Next Phase Readiness
- UI-07 met. Create-tournament surface is Court-styled. Visual/browser UAT (desktop + ≤375px) is deferred to the v3.0 milestone-wide visual UAT after Phase 14.

## Self-Check: PASSED

All created/modified files exist on disk; all three task commits (`f3fcceb`, `861100b`, `e212695`) present in git history.

---
*Phase: 14-tournament-pages*
*Completed: 2026-06-14*
