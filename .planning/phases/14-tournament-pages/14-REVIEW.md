---
phase: 14-tournament-pages
reviewed: 2026-06-14T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - src/app/(public)/tournaments/[id]/page.tsx
  - src/app/(public)/tournaments/[id]/tournament.css
  - src/app/(public)/tournaments/[id]/participate-form.tsx
  - src/app/(public)/tournaments/[id]/start-tournament-form.tsx
  - src/app/(public)/tournaments/[id]/score-form.tsx
  - src/app/(public)/tournaments/[id]/round-score-form.tsx
  - src/app/(public)/tournaments/[id]/remove-registration-form.tsx
  - src/app/(public)/tournaments/[id]/finish-tournament-form.tsx
  - src/components/bracket-view.tsx
  - src/components/bracket-scroll-client.tsx
  - src/components/bracket.css
  - src/components/round-robin-view.tsx
  - src/components/rotation-view.tsx
  - src/components/formats.css
  - src/app/(app)/admin/tournaments/new/page.tsx
  - src/app/(app)/admin/tournaments/new/create-tournament-form.tsx
  - src/app/(app)/admin/tournaments/new/create-tournament.css
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-06-14
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

This is a presentational restyle of the tournament detail page, playoff bracket,
round-robin/rotation format views, and the create-tournament form onto the Court
design language. I reviewed all 17 files against the four review priorities (gate
preservation, the new `bracket-scroll-client` client logic, set-tally derivation,
and the forced-value submit path in the create form), plus general React/CSS
correctness.

**Security gates verified intact (no BLOCKERs):**
- `page.tsx:133` `readOnly = !isAdmin || status === "finished"` — preserved.
- `page.tsx:137-157` `renderEntry` defined ONLY when `isAdmin && status === "in_progress"`, otherwise `undefined`; `RoundRobinView`/`RotationView` only call it when `!readOnly && Boolean(renderEntry)`.
- `page.tsx:440` playoff `ScoreForm` block gated by `isPlayoff && isAdmin && status === "in_progress"`.
- `page.tsx:464` `FinishTournamentForm` gated by `isAdmin && status === "in_progress"`.
- `page.tsx:314,349` `RemoveRegistrationForm` gated by `isAdmin && status === "registration"`.
- Server Actions are the authoritative boundary and were NOT changed: `actions.ts` still calls `requireAdmin()` as the first line of `recordResultAction`, `startTournamentAction`, `removeRegistrationAction`, `finishTournamentAction`; `recordResultAction(tournamentId, matchId, setsPerMatch)` signature unchanged and consumed identically by both `score-form.tsx` and `round-score-form.tsx`.
- No final score rendered anywhere: `bracket-view.tsx:91-105` drops tally and popover sets when `m.nextMatchId === null` (the final); the champion banner (`bracket-scroll-client.tsx:230-254`) shows name only.
- `rotation-view.tsx` rating table has no qualification/knockout cut-line; row classes are cosmetic (`leader`/`podium`) only.
- No hardcoded hex, `rgb()`, or `hsl()` literals in any of the four CSS files (verified by grep) — Court tokens only.

The forced-value submit path in `create-tournament-form.tsx` is intact: for
americano/mexicano a hidden `participantMode=singles` input (line 115) and hidden
`scoringMode=points` input (line 202) carry the value while the disabled select is
non-submitting; size single-name swap and free-form scoring (no
setsPerMatch/gamesPerSet/targetPoints) are preserved.

Findings below are correctness/robustness in the new client leaf and minor quality
items. None compromise the gates or alter engine logic.

## Warnings

### WR-01: Pinned popover not dismissed on resize — stale fixed position over wrong card

**File:** `src/components/bracket-scroll-client.tsx:209-226`
**Issue:** The resize handler re-runs `positionConnectors()` (which re-lays out the
match cards via `translateY`), but does NOT call `placePopover()` or dismiss an
active/pinned popover. `placePopover` only re-runs on `[active, placePopover]`
(line 103-105), and `active` does not change on resize. So if a popover is pinned
(tap) and the user rotates the device or resizes, the connector pass moves the
trigger card to a new Y while the `position: fixed` popover stays at its old
coordinates — it now floats over an unrelated card or empty space, with `triggerRef`
pointing at a card that has since moved. The `onScroll` handler dismisses on scroll
but resize is a separate event with no dismissal.
**Fix:** Dismiss the popover inside the resize handler (cheapest, matches the scroll
behavior), or re-place it:
```ts
const onResize = () => {
  positionConnectors();
  if (active) placePopover(); // or: dismiss like onScroll
};
window.addEventListener("resize", onResize);
```
Note this requires `active`/`placePopover` in the effect deps or a ref, since the
current effect closes over a stale `placePopover` is fine (stable via useCallback) but
not over `active`.

### WR-02: `data-gap` connector lookup trusts attribute, no guard on `matchesByRound[gap]`

**File:** `src/components/bracket-scroll-client.tsx:185-189`
**Issue:** `const gap = Number(col.getAttribute("data-gap"));` then `matchesByRound[gap]`
and `matchesByRound[gap + 1]`. `data-gap` is set from `idx` (line 308) so in practice
it is always valid, but `Number(null)` would be `0` and an out-of-range index yields
`undefined`. `feeders[e * 2]` on an `undefined` `feeders` would throw
`Cannot read properties of undefined`. The inner loop is only entered if
`.connectors` columns exist, which the JSX guarantees correspond to non-final rounds,
so this is currently safe — but it relies on DOM/JSX staying in lockstep with no
defensive check. Connectors are documented as "degradable, decorative"; a throw here
would break the entire `useLayoutEffect` (both rAF passes), not degrade gracefully.
**Fix:** Guard the lookup before iterating elbows:
```ts
const feeders = matchesByRound[gap];
if (!feeders) return;
const nextRound = matchesByRound[gap + 1];
```

### WR-03: `tabIndex={0}` on detail matches with no keyboard activation

**File:** `src/components/bracket-scroll-client.tsx:288-299`
**Issue:** Matches with `hasDetail` get `tabIndex={0}` (focusable) but only
`onMouseEnter`/`onMouseLeave`/`onClick` handlers — no `onFocus`/`onKeyDown`. A keyboard
user can focus the card but pressing Enter/Space fires the `onClick` synthetic event
only via browser button emulation, which does NOT happen for a plain `<div>` (only
`<button>`/`<a>` synthesize click from keyboard). So focusing the card reveals nothing
and Enter does nothing — the popover (per-set games) is mouse/tap-only. This is a
genuine focus trap for keyboard/AT users: a focusable element that exposes no behavior
on focus or key. The games are decorative detail so it is not a data-loss issue, but a
focusable-with-no-affordance element is a real a11y defect.
**Fix:** Either drop `tabIndex` (make it non-focusable, accepting mouse/tap-only), or
add `onFocus={(e) => show(m, e.currentTarget)}` + `onBlur={hide}` and an
`onKeyDown` that toggles on Enter/Space. Dropping `tabIndex` is the smaller change and
consistent with "decorative".

### WR-04: Outside-click dismiss races with `onClick` toggle via event ordering, not guarded by ref identity on document handler

**File:** `src/components/bracket-scroll-client.tsx:117-150`
**Issue:** `toggle` calls `e.stopPropagation()` (line 118) to prevent the document
click handler from immediately closing a just-pinned popover. This works only because
the match card's `onClick` runs in the bubble phase and `stopPropagation` halts
propagation to `document`. However, the `document` listener is attached in the bubble
phase (default), and React 19 attaches synthetic handlers at the root container — with
React's root-level delegation, `e.stopPropagation()` on the synthetic event does stop
the native event from reaching listeners attached ABOVE the React root
(`document`). This is correct in practice, but it is fragile: any future move of the
React root or addition of a portal could break the stopPropagation chain and cause
tap-to-pin to immediately self-dismiss. There is no defensive "ignore the click that
opened me" guard (e.g., comparing `e.target` against the trigger in the document
handler).
**Fix:** Make the dismiss robust to delegation changes by checking the target in the
document handler instead of relying solely on `stopPropagation`:
```ts
const onDocClick = (e: MouseEvent) => {
  if (pinnedRef.current && !triggerRef.current?.contains(e.target as Node)) {
    pinnedRef.current = false;
    triggerRef.current = null;
    setActive(null);
  }
};
```
This keeps tap-to-pin working even if `stopPropagation` ever stops shielding it.

## Info

### IN-01: `hide()` fires when moving toward the popover (pointer-events:none)

**File:** `src/components/bracket-scroll-client.tsx:294`, `src/components/bracket.css:258`
**Issue:** `.sd-pop` has `pointer-events: none`, and the popover is positioned 10px
above the card. Moving the mouse from the card upward toward the popover crosses the
gap, fires `onMouseLeave` → `hide()`, and the popover disappears before the cursor
reaches it. Hover users cannot interact with popover content. Acceptable since the
popover is read-only detail (no interactive content), but worth noting as intended
behavior, not a polished hover-tooltip.
**Fix:** None required if read-only detail is the intent. If hover-persist is wanted,
add a small `onMouseLeave` delay or extend the trigger hit-area.

### IN-02: `onScroll` capture handler runs `setActive(null)` on every bracket horizontal scroll

**File:** `src/components/bracket-scroll-client.tsx:139-145`
**Issue:** `window.addEventListener("scroll", onScroll, true)` (capture) fires for the
`.bracket-scroll` horizontal scroll container too, calling `setActive(null)` on every
scroll tick even when nothing is active. React bails out on identical state so there is
no render churn, but the unconditional ref writes + setState call on every scroll frame
is wasteful.
**Fix:** Early-return when nothing is open:
```ts
const onScroll = () => {
  if (!active && !pinnedRef.current) return;
  ...
};
```
(Use a ref mirror of `active` to avoid re-subscribing the effect.)

### IN-03: Inline style objects scattered across restyled markup

**File:** `src/app/(public)/tournaments/[id]/page.tsx:200,270,291,322,336,357,395,442,465,466`; `participate-form.tsx:22,55`; `score-form.tsx`/`round-score-form.tsx` (many)
**Issue:** A restyle onto a CSS-token design language still leaves many literal inline
`style={{...}}` objects (margins, widths, flex). These bypass the Court token system
(e.g., `marginBottom: 30`, `maxWidth: 340`, `width: 72`) and reintroduce magic numbers
the CSS files were meant to centralize. No correctness impact.
**Fix:** Promote recurring inline values to utility classes / CSS tokens where it
reduces magic-number drift; low priority for a thesis.

### IN-04: `tallyOf` ignores tie sets silently (by design, but undocumented edge)

**File:** `src/components/bracket-view.tsx:42-50`
**Issue:** A set with `gamesPair1 === gamesPair2` increments neither tally. For padel a
drawn set is impossible, so this is fine, but the derived tally can disagree with
`setsWonA`/`setsWonB` from the engine if data ever contains a tie. The view derives
tally rather than using the stored `setsWonA/B` (intentional per the score contract),
so this is a deliberate divergence — noting it for completeness.
**Fix:** None; document that tied sets are not expected in padel data.

### IN-05: `participate-form.tsx` inline grid style duplicated verbatim

**File:** `src/app/(public)/tournaments/[id]/participate-form.tsx:22,55`
**Issue:** Both forms use identical
`style={{display:"grid",gap:10,width:"100%",maxWidth:340}}`. Duplicated literal; a
`.cta-form` class already exists on these elements and could own the layout.
**Fix:** Move the grid/gap/max-width into the `.cta-form` rule in `tournament.css`.

---

_Reviewed: 2026-06-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
