---
phase: 03-registration-pairs
reviewed: 2026-06-06T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - prisma/schema.prisma
  - src/lib/services/registration.ts
  - src/lib/validation/registration.ts
  - src/app/(public)/tournaments/[id]/actions.ts
  - src/app/(public)/tournaments/[id]/participate-form.tsx
  - src/app/(public)/tournaments/[id]/page.tsx
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-06-06
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the Phase 3 registration + pairs slice: the `registerPair` integrity gate,
the `participateAction` server boundary, the public detail page, validation, and the
client form leaf. The security boundary is correct and the PII discipline is clean.

Verified positives (no findings warranted):
- `participateAction` calls `requireUser()` on its first line; `player1Id` is taken
  from `user.id` (session) only and never from the form. Only `player2Id` is
  client-supplied (validated by `parseRegisterPairForm`). `tournamentId` is bound via
  `.bind(null, tournamentId)`, never trusted from the form body. `RegistrationError` is
  mapped to user-facing messages; `revalidatePath` is present.
- All five integrity checks (status, self-partner, capacity, cross-slot duplicate,
  insert) run inside ONE `prisma.$transaction` using the `tx` client throughout — no
  use of the outer `prisma` instance inside the transaction, so the check-and-insert is
  atomic with respect to its own reads.
- Detail page is anonymous-viewable (uses `getOptionalSession`, no `requireUser`). The
  four branches (anon / already-registered / full / eligible) are correct. Participant
  list and eligible-partners query select only `name`/`courtSide`/`skillLevel` — no
  email/credential leak. `listEligiblePartners` excludes self (`id: { not: excludeUserId }`)
  and anyone already paired in either slot.
- `@@unique([tournamentId, player1Id])` and `@@unique([tournamentId, player2Id])` are
  present as DB-level defense-in-depth; the cross-slot duplicate (player as p1 here / p2
  there) is caught at runtime by the transactional `findFirst`.
- Server/client boundary is intact: `participate-form.tsx` is a `"use client"` leaf that
  imports only the action type, never prisma/db or server-only modules.

The two warnings concern a concurrency window on the capacity gate and an
inconsistency between the page's eligibility branch and the form's own empty-state.

## Warnings

### WR-01: Capacity gate can be exceeded by one under concurrent registration (TOCTOU)

**File:** `src/lib/services/registration.ts:58-85`
**Issue:** The capacity check reads `tx.pair.count(...)` and compares against
`tournament.size`, then inserts. Prisma's interactive `$transaction` on SQLite opens
with `BEGIN DEFERRED`, which acquires the database write lock only at the first write
(the `create`), not at the initial `count`/`findFirst` reads. Two concurrent
registrations for *distinct* pairs of players can therefore both read `count = size - 1`,
both pass the `count >= size` gate, then serialize their inserts — producing `size + 1`
pairs. The `@@unique` constraints are on `(tournamentId, player1Id)` and
`(tournamentId, player2Id)`; they prevent the *same* player being inserted twice but do
NOT prevent two *different* over-capacity pairs, so the constraint is not a backstop for
this case. The cross-slot `findFirst` has the identical read-then-write window, but its
write IS protected by the per-slot `@@unique` constraints (a true concurrent duplicate
fails on insert with P2002 and lands in the generic catch), so only the capacity
invariant is actually exposed.

For a low-concurrency thesis SQLite app this is a narrow window, but it is a correctness
gap in the stated `count < size` invariant, not a performance concern.

**Fix:** Force the transaction to take the write lock before the capacity read so the
two reads serialize, or have the gate observe a write. Simplest with SQLite/Prisma is to
raise the isolation so the transaction begins immediately. Either set it per-call:
```ts
return prisma.$transaction(async (tx) => { /* ... */ }, {
  isolationLevel: "Serializable",
});
```
or, if Prisma does not promote SQLite to `BEGIN IMMEDIATE` for this, emit an explicit
write-lock acquisition at the top of the transaction (e.g. a no-op `$executeRaw` that
takes the reserved lock) before the `count`. The goal: the capacity read and the insert
must sit behind the same write lock so a second registration blocks until the first
commits and then re-reads the higher count.

### WR-02: Detail page shows the form section for an eligible user even when no partners exist, duplicating the empty-state in two places

**File:** `src/app/(public)/tournaments/[id]/page.tsx:62-65,156-158` and `src/app/(public)/tournaments/[id]/participate-form.tsx:23-29`
**Issue:** When a logged-in, unregistered, non-full tournament has no eligible partners
(e.g. every other registered user is already paired), `canRegister` is true, so
`listEligiblePartners` returns `[]` and `<ParticipateForm partners={[]}>` is rendered.
The form then handles the empty case itself with its own "Нет доступных партнёров"
message (lines 23-29). This works, but the "no partners" empty state now lives in the
client leaf rather than alongside the page's other branch messages, which is easy to
break later (a refactor that early-returns differently in the form would silently drop
the message). Not a bug today; flagged as a robustness/consistency concern because the
branch logic for "eligible to register" and "actually has someone to register with" are
split across the server and client components.

**Fix:** Decide the empty-partners branch on the server next to the other status
branches and keep the form a pure renderer:
```tsx
) : partners.length === 0 ? (
  <p className="rounded-md border border-current/15 px-4 py-3 text-sm opacity-70">
    Нет доступных партнёров для регистрации.
  </p>
) : (
  <ParticipateForm tournamentId={id} partners={partners} />
)
```
and remove the early-return block from `participate-form.tsx`.

## Info

### IN-01: Foreign-key / non-existent `player2Id` rejects via the generic catch rather than a typed error

**File:** `src/app/(public)/tournaments/[id]/actions.ts:34-45`, `src/lib/services/registration.ts:82-85`
**Issue:** `player2Id` is validated only for non-empty string shape
(`registerPairSchema`). It is never confirmed to reference a real user before the insert.
A crafted POST with a syntactically valid but non-existent `player2Id` reaches
`tx.pair.create`, which fails the `player2` foreign key (Prisma P2003). That error is
not a `RegistrationError`, so it falls to the generic catch and returns the fallback
"Не удалось зарегистрироваться" message. Behavior is safe (no bad row is written), so
this is not a vulnerability — only a slightly misleading error path. The honest UI list
only ever offers eligible ids, so this is reachable solely by a tampered request.

**Fix (optional):** If a precise message is desired, add an existence check inside the
transaction before the cross-slot query and throw a `RegistrationError`, e.g.
`await tx.user.findUniqueOrThrow({ where: { id: player2Id }, select: { id: true } })`
wrapped to map to an "invalid partner" code. Otherwise leave as-is — the generic
rejection is acceptable.

### IN-02: `tournamentId` falsy check returns "not found" but a non-empty invalid id is handled later by `findUniqueOrThrow`

**File:** `src/app/(public)/tournaments/[id]/actions.ts:25-27`, `src/lib/services/registration.ts:44-47`
**Issue:** The action guards `if (!tournamentId)` and returns "Турнир не найден". A
non-empty but non-existent `tournamentId` passes that guard and is rejected inside the
transaction by `findUniqueOrThrow`, which throws a Prisma `P2025` (not a
`RegistrationError`) and surfaces as the generic fallback message rather than "not
found". Consistent, safe rejection — just an inconsistent message between the two
not-found paths.

**Fix (optional):** Catch `findUniqueOrThrow` and rethrow as
`new RegistrationError("not_open", "Турнир не найден")`, or use `findUnique` + explicit
null check inside the transaction for a uniform message. Low priority.

---

_Reviewed: 2026-06-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
