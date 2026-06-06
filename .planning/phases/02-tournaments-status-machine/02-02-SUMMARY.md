---
phase: 02-tournaments-status-machine
plan: 02
subsystem: tournaments
tags: [server-actions, admin-authz, rsc-guard, client-form, nav]
requires:
  - createTournament service (Plan 01)
  - createTournamentSchema / parseTournamentForm validation (Plan 01)
  - requireAdmin / getOptionalSession guards (Phase 1)
provides:
  - createTournamentAction (guarded write path — TOUR-01 producer side)
  - /admin/tournaments/new guarded create page + client form
  - admin-only "Создать турнир" + public "Турниры" nav links
affects:
  - src/components/nav.tsx
tech-stack:
  added: []
  patterns:
    - thin-action→requireAdmin(first line)→zod→service→revalidate→redirect (reused from profile/admin)
    - RSC guard try/requireAdmin/catch→redirect("/login") (reused from admin/page.tsx)
    - client "use client" leaf via useActionState (reused from profile-form.tsx)
key-files:
  created:
    - src/app/(app)/admin/tournaments/actions.ts
    - src/app/(app)/admin/tournaments/new/page.tsx
    - src/app/(app)/admin/tournaments/new/create-tournament-form.tsx
  modified:
    - src/components/nav.tsx
decisions:
  - "createTournamentAction does NOT catch the requireAdmin throw — the Forbidden throw IS the rejection (caller sees it); page guard owns the UX redirect (per plan Task 1)"
  - "redirect() placed after revalidatePath, outside any try/catch (NEXT_REDIRECT must propagate)"
  - "size select defaults to tournamentSizes[0] (4); RU labels '<n> пар' — STATUS labels (Plan 03) are the only mandated RU strings, form labels RU by choice"
metrics:
  duration: ~5m
  completed: 2026-06-06
  tasks: 2
  files: 4
---

# Phase 2 Plan 02: Admin Create Vertical Slice Summary

The producer side of the phase (TOUR-01): a guarded `createTournamentAction` whose FIRST line is `await requireAdmin()`, an admin-guarded `/admin/tournaments/new` page, a `"use client"` form leaf, and role-gated nav links. The action validates with the Plan-01 zod schema, calls the Plan-01 `createTournament` service (which hard-sets status `registration`), revalidates `/tournaments`, and redirects to the new tournament page. The server-side guard — not the hidden nav link — is the real boundary (AUTH-05, Pitfall 8).

## What Was Built

- **Action** (`src/app/(app)/admin/tournaments/actions.ts`): `createTournamentAction(prev, formData)` mirroring `updateProfileAction`. First executable line `await requireAdmin()`; then `parseTournamentForm` (`!ok` → `{ ok: false, errors }`, no DB write); on ok `createTournament(prisma, parsed.data)` → `revalidatePath("/tournaments")` → `redirect("/tournaments/${created.id}")`. Exports `CreateTournamentActionState` discriminated type (`{ ok: true } | { ok: false; errors } | null`). The requireAdmin throw is intentionally uncaught — it is the rejection. Status never read from the form.
- **Page** (`src/app/(app)/admin/tournaments/new/page.tsx`): Server Component guarded exactly like `admin/page.tsx` — try `requireAdmin()`, catch → `redirect("/login")` on "Unauthorized"/"Forbidden", else rethrow. Renders heading + form.
- **Form** (`src/app/(app)/admin/tournaments/new/create-tournament-form.tsx`): `"use client"` leaf via `useActionState` over `createTournamentAction`; fields `name` (required text), `size` (select over `tournamentSizes` → "4/8/16 пар"), `date` (datetime-local, optional), `location` (text, optional); pending button state; per-field error rendering. Client `parseTournamentForm` pre-check is UX-only (shares schema with the action so they cannot drift).
- **Nav** (`src/components/nav.tsx`): public `<Link href="/tournaments">` ("Турниры") for everyone; admin-only `<Link href="/admin/tournaments/new">` ("Создать турнир") rendered only when `session.user.role === "admin"`.

## Tasks & Commits

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Guarded createTournamentAction | `34b1211` |
| 2 | Guarded create page + client form + admin nav link | `fede64a` |

## Verification Output

- `npx tsc --noEmit` → clean (exit 0), after both tasks.
- `npm run build` → "Compiled successfully in 2.1s", TypeScript finished, 10/10 static pages generated. New route `ƒ /admin/tournaments/new` present in the route table. No kysely build blocker (the documented 01-01 risk did not recur).
- **Static guard proof:** `await requireAdmin()` is line 26 — the first executable line of `createTournamentAction`; `requireAdmin` throws `"Forbidden"` when `role !== "admin"` (auth-guards.ts:50). A non-admin/anon direct invocation is rejected before any parse/DB work (T-02-04).
- Phase-1 auth-guards and the kysely override → unchanged.

## Deviations from Plan

None — plan executed exactly as written. (Rules 1–4: none triggered.)

## Threat Coverage

- **T-02-04 (EoP):** `requireAdmin()` first line — confirmed line 26, before parse/DB.
- **T-02-05 (Tampering, size/status):** size validated to {4,8,16} via Plan-01 zod; status never read from form (service hard-sets "registration").
- **T-02-06 (Spoofing, role):** role read from signed session via requireAdmin / getOptionalSession, never from form or props.
- **T-02-SC:** no new packages installed.

## Deferred Manual Checks (browser-only, AUTO_MODE)

- **Runtime rejection of a logged-in non-admin / anonymous direct call** to `createTournamentAction`: `requireAdmin` calls `next/headers`, so it cannot be exercised outside a Next request scope via `tsx` (same constraint as the Phase-1 adminPing guard). Proven statically + by unchanged guard primitive; browser/E2E confirmation deferred.
- **Admin create round-trip** (submit form → row persists at status "registration" → redirect to detail page): requires a browser session with an admin role; detail page lands in Plan 03. Deferred to manual/E2E run.
- **Nav link visibility** (admin sees "Создать турнир", anon does not; everyone sees "Турниры"): role-gated render confirmed in code + build; visual check deferred.

## Self-Check: PASSED

- FOUND: src/app/(app)/admin/tournaments/actions.ts
- FOUND: src/app/(app)/admin/tournaments/new/page.tsx
- FOUND: src/app/(app)/admin/tournaments/new/create-tournament-form.tsx
- FOUND (modified): src/components/nav.tsx
- FOUND commits: 34b1211, fede64a
