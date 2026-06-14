---
phase: 13-auth
reviewed: 2026-06-14T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - src/app/(auth)/auth.css
  - src/app/(auth)/login/page.tsx
  - src/app/(auth)/login/login-form.tsx
  - src/app/(auth)/register/page.tsx
  - src/app/(auth)/register/register-form.tsx
  - src/app/(app)/profile/page.tsx
  - src/app/(app)/profile/profile-form.tsx
  - src/app/(app)/profile/profile.css
  - src/app/(public)/tournaments/page.tsx
  - src/app/(public)/tournaments/filter-bar.tsx
  - src/app/(public)/tournaments/tournaments.css
  - src/app/(app)/dashboard/page.tsx
  - src/app/(app)/dashboard/dashboard.css
  - src/lib/services/tournament.ts
  - src/lib/services/dashboard.ts
  - src/lib/validation/auth.ts
  - src/lib/validation/tournament.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-06-14
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Phase 13 is a visual restyle of four account/browse screens onto the Court design language, plus two permitted read-only backend extensions. The review focused on the three stated priorities: (1) the backend read-extensions, (2) the restyle contract preservation, and (3) hardcoded-hex / query efficiency / React correctness in the client leaves.

**The two backend reads are sound and meet the security bar.** `getMyTournaments` is strictly read-only and session-scoped — `userId` flows from the `requireUser()` guard at the call site (dashboard `page.tsx` passes `user.id`, never client input), and every Prisma query in the service is filtered by that id. `listTournaments` is read-only; all five facets are validated against existing zod tuples in `page.tsx` via `pick()` (unknown values drop to `undefined` = no filter), and `q` reaches Prisma only through the parameterized typed `contains` operator — no raw string injection into the `where`. The `?status=` backward-compat path is preserved. Filtering is genuinely server-side; the client leaf only pushes facets to the URL and re-queries through the Server Component. No create/update/delete/upsert appears in either read path. No hardcoded hex/rgb/hsl in any of the four restyle CSS files — Court tokens only.

The defects found are all non-security UX/quality issues. The most material is a dead CSS path that makes the profile "changed-dot" indicator permanently invisible (the restyle dropped the `is-changed` class hook that the ported CSS still depends on).

## Warnings

### WR-01: Profile "changed-dot" indicator is permanently invisible (dead CSS path)

**File:** `src/app/(app)/profile/profile-form.tsx:124,143,163,186,204,229` + `src/app/(app)/profile/profile.css:164-175`

**Issue:** The per-field changed indicator never renders. The JSX conditionally mounts `<span className="changed-dot" />` inside each `.label` when `changed(key)` is true. But the ported CSS hides `.label .changed-dot` by default (`display: none`) and only reveals it via `.field.is-changed .label .changed-dot { display: inline-block }`. The component never adds the `is-changed` class to the `.field` wrapper, so the dot is always `display:none`. The feature the markup and CSS both describe ("per-field changed-dot") silently does nothing — a restyle-contract regression of an interactive affordance.

**Fix:** Either gate the dot's visibility on a class the component actually sets, or drive the dot purely from the conditional mount. Simplest is to mark the field:
```tsx
<div className={`field${changed("name") ? " is-changed" : ""}`} style={{ ... }}>
```
(applied per field). Alternatively, since the JSX already conditionally renders the span, make the base rule visible and delete the `.field.is-changed` selector:
```css
.label .changed-dot {
  display: inline-block; /* was: none */
  /* ...rest unchanged... */
}
/* remove the now-redundant .field.is-changed .label .changed-dot rule */
```

### WR-02: Status `<option>` vocabulary duplicated in filter-bar instead of reusing existing label map

**File:** `src/app/(public)/tournaments/filter-bar.tsx:25-29`

**Issue:** `statusOptions` hand-rolls the status value/label pairs (`registration → Регистрация`, etc.) as a local literal, while format/level/mode reuse the shared label maps (`formatLabels`, `skillLevelLabels`, `tournamentKindLabels`) keyed off the validation tuples. There is no `tournamentStatusLabels` map, so status RU vocabulary now lives in two places (the component comment even claims "no re-derived RU vocab"). If a status value is added/renamed in `tournamentStatuses`, this list silently drifts and can present a value the server-side `pick()` will reject. The `dashboard.ts` `statusGroup()` and `STATUS_SEAM` in `page.tsx` are separate status mappings too — the status vocabulary is now fragmented across the phase.

**Fix:** Derive the options from the existing tuple plus a single shared label map (introduce `tournamentStatusLabels` alongside the other label maps in the validation layer), e.g.:
```tsx
const statusOptions = tournamentStatuses.map((value) => ({ value, label: tournamentStatusLabels[value] }));
```
so adding a status cannot leave the filter out of sync.

### WR-03: Tournaments page issues a second full-table query just to compute the "X из Y" total

**File:** `src/app/(public)/tournaments/page.tsx:54-59`

**Issue:** To show `<b>{shown}</b> из {total}`, the page runs `listTournaments(prisma)` a second time (unfiltered) in parallel with the filtered query, pulling every tournament row — including the `_count` aggregate select — purely to read `all.length`. This is a redundant full-table read with the heavier `tournamentListSelect`; `total` only needs a count. (Performance is out of v1 scope, but this is also a correctness/robustness smell: the displayed total can disagree with the filtered list under concurrent writes, and it materializes rows that are never rendered.)

**Fix:** Replace the second `findMany` with a count, or add a count-only helper:
```tsx
const [tournaments, total] = await Promise.all([
  listTournaments(prisma, { status, format, level, participantMode: mode, q }),
  prisma.tournament.count(),
]);
const shown = tournaments.length;
```

## Info

### IN-01: `solos` query selects only `tournament` but partner/role logic can never enrich a solo row

**File:** `src/lib/services/dashboard.ts:78-81,107-123`

**Issue:** The de-dup comment says "a pair row + a stray TournamentPlayer row for the same tournament should not double-render — pair wins." That is handled by `byId.has(t.id)`. This is correct, but note the merge assumes a user is never in two *different* pairs in the same tournament; given the de-dup is keyed on tournament id, a (data-model-illegal) second pair row for the same tournament would be silently dropped, last-write-wins on partner. Not a defect under current invariants — flagging as an assumption to document.

**Fix:** None required; optionally add a code comment that the de-dup relies on the one-entry-per-tournament invariant rather than enforcing it.

### IN-02: `formatLabel`/`kindLabel` helpers in dashboard duplicate the inline label-fallback pattern used in the tournaments list

**File:** `src/app/(app)/dashboard/page.tsx:31-40` vs `src/app/(public)/tournaments/page.tsx:105-108`

**Issue:** The dashboard wraps the "validate-then-label-or-passthrough" logic in named helpers (`formatLabel`, `kindLabel`); the tournaments list inlines the same pattern as `formatLabels[t.format as TournamentFormat] ?? t.format`. Two different idioms for the identical concern. Minor inconsistency; both are correct.

**Fix:** Pick one idiom (the named-helper form is clearer) if a shared util is ever extracted.

### IN-03: `pct` width interpolation can briefly exceed bounds for the dashboard round progress bar

**File:** `src/app/(app)/dashboard/page.tsx:87`

**Issue:** `const pct = t.round && t.round.total > 0 ? (t.round.done / t.round.total) * 100 : 0;` is not clamped to 100. The tournaments-list equivalent (`page.tsx:92`) clamps with `Math.min(100, ...)`. If `done` ever exceeds `total` (e.g., a data state where finished-round count outruns the configured `totalRounds`), the progress span would overflow its track. The list path already guards against this; the dashboard path does not.

**Fix:** Mirror the list's clamp:
```tsx
const pct = t.round && t.round.total > 0 ? Math.min(100, (t.round.done / t.round.total) * 100) : 0;
```

### IN-04: `useEffect([state])` re-baselines from stale closure `values` but is silenced rather than corrected

**File:** `src/app/(app)/profile/profile-form.tsx:65-72`

**Issue:** On a successful save the effect runs `setBaseline(values)` with `values` intentionally omitted from the dependency array (eslint disabled). It works in practice because `values` reflects the just-submitted form at the moment `state` flips to `ok`, but it relies on render timing rather than an explicit contract, and the disabled exhaustive-deps lint hides the coupling. Not a bug under the current single-submit flow.

**Fix:** None required for correctness. If hardened later, capture the submitted values into the action result and baseline from `state` instead of the live `values` closure.

---

_Reviewed: 2026-06-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
