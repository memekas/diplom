---
phase: 12-court
reviewed: 2026-06-14T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/app/globals.css
  - src/app/layout.tsx
  - src/components/nav.tsx
  - src/components/tournament-status-badge.tsx
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-06-14
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Phase 12 is a pure visual restyle that ports the validated Court design tokens and the
`_base` component-class layer from the `sketch-findings-diplom` skill into the real
Next.js 16 + Tailwind 4 app. No application logic, Server Actions, or data flow were
changed — confirmed by reading the components and the git history.

The token block (`globals.css :root`) is a **byte-for-byte faithful** copy of
`sources/themes/default.css` (Court), and the `@layer components` block is a faithful
copy of `sources/_base.css`, correctly adapted in two ways: font tokens now consume the
`next/font` CSS variables (`--next-oswald` etc.) instead of `'Oswald'` literals, and the
sketch-only chrome (`#variant-nav`, `#sketch-tools`, `.app` preview frame) was correctly
dropped. The status-badge component maps the three DB statuses to the exact `.badge`/
`.badge-*` classes from the contract. All three `next/font` families do support the
`cyrillic` subset (verified against Next's bundled font-data), so layout.tsx will not
throw at build time.

No Critical findings. The defects are all design-contract / quality concerns, the most
important of which is a **deviation from the skill's container-query convention** (`.cq`
vs the documented `.app`) that risks breaking the "paste markup unchanged" promise for
phases 13/14 — the explicit reason this phase exists. There is also leftover dead
scaffolding and one structural-fidelity drift in the `@layer components` placement.

## Warnings

### WR-01: Container-query wrapper renamed `.cq`, breaking the documented `.app` contract

**File:** `src/app/globals.css:240-243`
**Issue:** The skill's responsive contract (`references/foundation.md:215-235`, and the
`_base.css` header) is explicit and validated: the query container is `.app`
(`container-type: inline-size`), set "once on the page root", and every sketch's HTML/CSS
is written against that name. This phase instead invents a new class `.cq` and documents
in a comment that "Phases 13/14 attach `.cq` to per-screen wrappers". That is a unilateral
change to the design contract whose entire purpose (per phase context) is "1:1 token/
class-name fidelity with the sketch sources so phases 13/14 can paste markup unchanged."
Any markup pasted from the sketches will reference `.app` and silently lose its query
container, so every `@container` breakpoint authored in 13/14 against pasted markup will
fail to match. The class was also renamed *and* its scope changed (page-root → per-screen
wrapper) without the foundation doc being the source of truth.
**Fix:** Either keep the contract name, or — if a rename is genuinely wanted — record the
deviation in the skill foundation so 13/14 author against it. Minimal contract-faithful
form:
```css
/* container-query root: matches sketch foundation (.app = query container) */
.app { container-type: inline-size; }
```
If a shorter alias is desired, alias it rather than replacing the contract name:
```css
.app, .cq { container-type: inline-size; }
```

### WR-02: Dead `--background`/`--foreground` tokens + `@theme inline` block retained

**File:** `src/app/globals.css:5-6, 63-66`
**Issue:** The monochrome `--background: #0a0a0a` / `--foreground: #ededed` pair and the
`@theme inline { --color-background; --color-foreground }` mapping are leftover
create-next-app scaffolding. The Court `body` (lines 248-258) renders from `--page` and
`--text`, not these tokens. A grep across `src/` confirms `--background`/`--foreground`
and the generated Tailwind utilities `bg-background`/`text-foreground` are consumed
nowhere — the only references are the two self-referential lines inside `@theme inline`.
The inline comment "monochrome pair (retained as part of the set)" rationalizes dead code.
For a thesis judged on "simple, no cruft" this is noise that invites the question "what
uses these?" at defense. (Not a Critical: harmless at runtime — it only generates two
unused utility classes.)
**Fix:** Remove the dead tokens and the now-empty `@theme inline` block:
```css
:root {
  /* surfaces */
  --page: radial-gradient(...);
  ...
}
/* delete lines 4-6 (--background/--foreground) and the @theme inline block 63-66 */
```
If a `@theme` block is still wanted to expose Court tokens as Tailwind utilities, map real
Court tokens instead of the dead pair (e.g. `--color-surface: var(--surface)`).

### WR-03: Base layer split — `body` and universal reset moved OUTSIDE `@layer components`

**File:** `src/app/globals.css:68-244` vs `246-263`
**Issue:** In the source `_base.css` the universal box-sizing reset and `body` styles sit
in the same flat (unlayered) stylesheet as the component classes. In this port, the
component classes were wrapped in `@layer components` (lines 68-244) while the universal
reset (246), `body` (248-258), and `@keyframes liveDot` (260-263) were left *unlayered*.
Unlayered CSS has **higher precedence than any `@layer`** in the cascade. This is mostly
benign here, but it is a real cascade-fidelity drift from the contract: a consumer in 13/14
who pastes a sketch rule expecting to override `.muted`/`.card` from a later unlayered
block will now find the layered component class behaves differently than the flat sketch
did. The mix (some base rules layered, the reset/body not) is also internally inconsistent
with no stated rationale. Also note `h1,h2,h3`, `a`, `.eyebrow` etc. are element/utility
*base* styles, not really "components" — putting them in `@layer components` is a
debatable categorization.
**Fix:** Be consistent. Either keep the whole `_base` port unlayered (closest 1:1 to the
sketch and simplest), or move the reset + `body` + keyframes into the same layer as the
rest. Recommended for fidelity:
```css
/* drop the @layer components wrapper entirely; keep the flat order from _base.css:
   reset → body → typography → components → keyframes */
```

## Info

### IN-01: `liveDot` animation rule present but example markup omits it — verify wiring

**File:** `src/app/globals.css:184` and `src/components/tournament-status-badge.tsx:14-18`
**Issue:** `globals.css:184` correctly ports `.badge-reg::before { animation: liveDot ... }`
and the `@keyframes` (260-263), matching `foundation.md:247-253`. The badge component
emits `badge badge-reg` for `registration`, so the live dot will animate. This is correct
— flagged only so the reviewer confirms the pulsing-dot intent is satisfied and no extra
`prefers-reduced-motion` guard was required by the contract (the sketch has none, so this
is contract-faithful, not a defect).
**Fix:** None required. If accessibility is later in scope, wrap in
`@media (prefers-reduced-motion: reduce)`.

### IN-02: Badge label "Регистрация открыта" diverges from contract label "Регистрация"

**File:** `src/components/tournament-status-badge.tsx:9`
**Issue:** `foundation.md:241-245` specifies the RU label for `registration` as
"Регистрация"; the component renders "Регистрация открыта". This is a string/label
divergence, **but** it predates phase 12 (introduced in commit 72cc05f, untouched by the
12-02 className-only restyle) and label text is application content, not visual styling —
so it is out of phase-12 scope. Recorded for completeness only.
**Fix:** Out of scope for this phase. If label fidelity matters, align to the contract or
update the contract — but not as part of a visual restyle.

### IN-03: `<html>` carries `antialiased` while `body` also sets font-smoothing

**File:** `src/app/layout.tsx:37` and `src/app/globals.css:256`
**Issue:** `layout.tsx` adds Tailwind's `antialiased` utility on `<html>` (and `<body>` has
`min-h-full flex flex-col`), while `globals.css` body also declares
`-webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility`. Harmless
duplication of the smoothing intent across two mechanisms (Tailwind utility + raw CSS).
Minor redundancy, not a bug.
**Fix:** Pick one source of truth for font smoothing — either the `antialiased` utility or
the raw `body` declaration — to avoid two places asserting the same thing.

### IN-04: LogoutButton uses hardcoded `border-current/40` utility instead of a token class

**File:** `src/components/logout-button.tsx:17` (sibling of the restyled nav)
**Issue:** Not in the phase-12 file list, but it is the interactive leaf rendered by the
restyled `nav.tsx` and is now the only nav control NOT using the Court `.btn`/token system
(it uses `rounded-md border border-current/40 px-3 py-1`). After this restyle the logout
button visually mismatches the new `.btn btn-primary` register button beside it and the
token-driven nav links. CLAUDE.md forbids hardcoded color outside the token block; while
`border-current` is not a hex, the button bypasses the `_base` `.btn`/`.btn-ghost`
contract that the rest of the nav now follows.
**Fix:** When this leaf is in scope, restyle to the contract, e.g.
`className="btn btn-ghost"` (or a small token-driven variant) so the nav is visually
consistent.

---

_Reviewed: 2026-06-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
