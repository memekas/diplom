---
phase: 02-tournaments-status-machine
reviewed: 2026-06-06T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - prisma/schema.prisma
  - src/lib/services/tournament.ts
  - src/lib/services/tournament-status.ts
  - src/lib/validation/tournament.ts
  - src/app/(app)/admin/tournaments/actions.ts
  - src/app/(app)/admin/tournaments/new/page.tsx
  - src/app/(app)/admin/tournaments/new/create-tournament-form.tsx
  - src/app/(public)/tournaments/page.tsx
  - src/app/(public)/tournaments/[id]/page.tsx
  - src/components/tournament-status-badge.tsx
  - src/components/nav.tsx
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-06-06
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the Phase 2 tournament creation flow, the status state machine, the
public read pages, and the server/client boundary. The security-critical paths
hold up under adversarial tracing:

- `createTournamentAction` calls `await requireAdmin()` as its first statement
  (line 26) before any parse or DB work; the throw is intentionally uncaught so
  a non-admin POST is rejected at the boundary, not just hidden in the nav.
- `status` is hard-set to `"registration"` in `createTournament` (service layer)
  and is absent from `createTournamentSchema` — it cannot be supplied by the
  client. `setsPerMatch`/`gamesPerSet` correctly fall to schema defaults.
- `size` is constrained to `{4,8,16}` server-side via the zod `.refine` over
  `tournamentSizes`; a missing/garbage field coerces to a non-member and is
  rejected before the write.
- `transitionTournament` re-reads DB status via `findUniqueOrThrow`, rejects a
  stale/forged `from` (DB is authoritative), and only permits the two forward
  edges `registration → in_progress → finished`. Terminal is `"finished"`, not
  `"completed"`. No client-trusted status anywhere.
- Both public pages are correctly unguarded; `[id]` page `await`s `params`
  (Next 16) and calls `notFound()` on a null lookup. Only public Tournament
  columns are selected — no credential/PII leak.
- Server/client boundary is clean: the only `"use client"` file in scope is the
  form leaf, and it imports `createTournamentAction` (a Server Action) plus the
  shared validation module — no client import of `@/lib/db`, server `@/lib/auth`,
  or services. (The three other client files import `@/lib/auth-client`, the
  legitimate browser SDK — not a leak.)
- `nav.tsx` gates the "Создать турнир" link behind `session.user.role === "admin"`
  read server-side from the session; cosmetic only, the real guard is the action.

No blockers. One warning and three minor info items below.

## Warnings

### WR-01: `errors.form` is declared in the action state contract but is never producible

**File:** `src/app/(app)/admin/tournaments/actions.ts:12`, `src/app/(app)/admin/tournaments/new/create-tournament-form.tsx:32`
**Issue:** `CreateTournamentActionState` includes a `"form"` key in its error
record, and the form renders `errors.form` as a top-level error banner (line 32).
But no code path ever sets `errors.form`: `requireAdmin()` throws (uncaught,
surfaces as a rejected action — not a returned state), `parseTournamentForm`
only emits `name`/`size`/`date`/`location` keys, and `createTournament` throwing
(e.g. SQLITE_BUSY / DB error) likewise rejects rather than returning a state with
`form` set. The result: any unexpected server-side failure during creation
produces a rejected promise / unhandled action error with no user-facing message,
and the `errors.form` banner is dead UI. For a thesis demo this means a DB hiccup
shows nothing to the admin.
**Fix:** Either wrap the `createTournament` call so operational failures return a
populated `form` error, or drop the unreachable `form` key + banner to make the
contract honest. Minimal version that surfaces failures:
```ts
let created;
try {
  created = await createTournament(prisma, parsed.data);
} catch {
  return { ok: false, errors: { form: "Не удалось создать турнир. Попробуйте ещё раз." } };
}
revalidatePath("/tournaments");
redirect(`/tournaments/${created.id}`); // redirect stays OUTSIDE the try
```
Note: keep `redirect()` outside the try so its `NEXT_REDIRECT` throw is not
swallowed.

## Info

### IN-01: `formData.get("date") ?? undefined` is a no-op; relies on the `z.literal("")` branch

**File:** `src/lib/validation/tournament.ts:54-55`
**Issue:** `FormData.get()` returns `""` (not `null`) for an empty text/datetime
input, so `?? undefined` never fires for `date` or `location` when the field is
present-but-blank. The empty case is actually handled downstream by the
`z.literal("")` union member (date) and the `.transform` (location), so behavior
is correct — but the `?? undefined` is misleading dead defensiveness suggesting a
null path that does not occur for rendered form fields.
**Fix:** Remove `?? undefined` (the schema already normalizes `""`), or keep it
only as a guard for the field-absent case and add a one-line comment that empty
strings are handled by the schema, not here.

### IN-02: `z.coerce.date()` accepts more input shapes than the `datetime-local` control emits

**File:** `src/lib/validation/tournament.ts:30`
**Issue:** The server validates `date` with `z.coerce.date()`, which will coerce
arbitrary parseable strings/numbers (e.g. `"2026"`, a bare timestamp) — not just
the `YYYY-MM-DDTHH:mm` shape the `datetime-local` input produces. Since this is
the security boundary for a forged POST, an attacker could store an oddly-parsed
date. Not a vulnerability (date is display-only, `toLocaleString` is safe), but
the server accepts a wider domain than the UI implies.
**Fix:** Acceptable as-is for a thesis. If tightening is desired, validate against
an ISO/`datetime-local` regex before coercion, or reject dates outside a sane
range.

### IN-03: `setsPerMatch`/`gamesPerSet` are selected and returned but unused in this phase

**File:** `src/lib/services/tournament.ts:14-15`
**Issue:** `tournamentSelect` includes `setsPerMatch`/`gamesPerSet`, and they ride
through `listTournaments`/`getTournament` to the public pages, which never render
them. Harmless (the values are non-sensitive defaults and the comment explains
they exist for Phase 5), just dead data on the wire for now.
**Fix:** No action needed; flagged for awareness. Optionally drop them from the
select until Phase 5 consumes them.

---

_Reviewed: 2026-06-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
