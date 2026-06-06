---
phase: 04-bracket-generation-public-view
reviewed: 2026-06-06T00:00:00Z
depth: deep
files_reviewed: 6
files_reviewed_list:
  - src/lib/services/bracket.ts
  - prisma/schema.prisma
  - src/app/(public)/tournaments/[id]/actions.ts
  - src/app/(public)/tournaments/[id]/start-tournament-form.tsx
  - src/app/(public)/tournaments/[id]/page.tsx
  - src/components/bracket-view.tsx
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-06-06
**Depth:** deep
**Files Reviewed:** 6
**Status:** issues_found

## Summary

The highest-risk surface — the bracket slot arithmetic — is **correct**. I verified the
final-first creation + `advance()` wiring exhaustively for sizes 4/8/16 (simulated the full
generation):

- `matchCount = size - 1` and per-round counts (`ROUNDS` table) are correct for all sizes.
- Every parent slot is filled **exactly once** — no double-fill, no dropped child, no
  off-by-one in `round`/`position`.
- Round-1 pair assignment (`shuffled[pos*2]`, `shuffled[pos*2+1]`) consumes each shuffled
  index exactly once across `0..size-1` — no pair placed twice, none dropped.
- `advance(round, position)` → `{round+1, floor(position/2), even→A/odd→B}` is consistent
  with the creation loop and with the final-having-null-parent invariant.

Security boundaries are sound: `requireAdmin()` is the first line of `startTournamentAction`
and its throw is intentionally uncaught; `tournamentId` is bound server-side, never trusted
from the client; `generateBracket` re-reads status, pair count, and existing-match guards
**inside** the same `$transaction` using the `tx` client throughout; `revalidatePath` is
called. `listBracket` selects only player display names (no email/credential) and has no auth
guard, matching the BRKT-02 anon-viewable requirement. The `Match` model correctly omits the
Phase-5 fields (no `SetScore`, no `setsWonA/B`). Server/client boundary is clean — the form is
the single `"use client"` leaf and never imports prisma.

Two warnings concern the generate-once atomicity backstop and the absence of a structural
uniqueness guard. Two info items are minor.

## Warnings

### WR-01: Generate-once relies on SQLite write-lock serialization, not the count guard — concurrent double-Старт surfaces a raw busy error, not the clean RU reject

**File:** `src/lib/services/bracket.ts:78-81` (guard) + `:118-129` (write)

**Issue:** The immutability guard reads `tx.match.count(...)` and rejects if `> 0`. This is
correctly *inside* the `$transaction` and uses `tx`, so a single caller is safe. But under
SQLite the interactive transaction begins `DEFERRED`: the `count()` takes only a SHARED lock.
Two genuinely concurrent `startTournamentAction` invocations can **both** read `count === 0`
and pass the guard before either writes. They are then serialized only at the first
`match.create` (RESERVED-lock upgrade), where the second transaction fails with a
`SQLITE_BUSY` / write-conflict error and rolls back.

Consequences:
1. A double bracket is *prevented* (good — the write conflict aborts the loser), but the
   protection comes from SQLite's writer serialization, **not** from the count guard the code
   is trusting.
2. The losing admin sees a raw Prisma/SQLite error string (e.g. "database is locked" /
   write-conflict) instead of the intended RU message "Сетка уже сгенерирована…", because the
   busy error is thrown from `create`, not from the guard. `startTournamentAction` passes
   `e.message` straight through (`actions.ts:78-82`), leaking the low-level message to the UI.

In a single-admin thesis app the probability is low, but the guard does not do what the
comment at `:76-77` claims ("enforced at the data layer").

**Fix:** Add a structural backstop so the guard is authoritative regardless of timing, and/or
take a write lock early. Cheapest correct option — make the bracket structurally
single-instance via a unique constraint, then map the constraint error:

```prisma
// schema.prisma — Match
@@unique([tournamentId, round, position])
```

A `(tournamentId, round, position)` unique index makes a second concurrent generation fail
deterministically on the very first `create` with a Prisma `P2002` you can catch and remap to
the RU message — and it also defends round/position integrity. Alternatively (or additionally)
catch the busy/`P2002` error in `startTournamentAction` and map it to
`"Сетка уже сгенерирована — повторная генерация запрещена"` instead of forwarding `e.message`.

### WR-02: Server Action forwards raw error messages to the client

**File:** `src/app/(public)/tournaments/[id]/actions.ts:78-82`

**Issue:** `startTournamentAction` returns `e.message` verbatim for any `Error`. The
intentional RU rejects from `generateBracket` are fine, but unexpected errors (the
`SQLITE_BUSY`/write-conflict above, `findUniqueOrThrow` "No record found", or any Prisma
internal) are surfaced directly to the admin UI. This conflates "expected business reject"
with "unexpected internal failure" and leaks implementation detail in the error text.

**Fix:** Distinguish a dedicated business-error type from unexpected errors, mirroring
`participateAction`'s `RegistrationError` pattern (`actions.ts:42-45`). Throw a typed
`BracketError` from `generateBracket` for the three intended rejects, forward only that
message, and return a generic RU fallback for everything else:

```ts
} catch (e) {
  if (e instanceof BracketError) return { ok: false, error: e.message };
  return { ok: false, error: "Не удалось сгенерировать сетку. Попробуйте ещё раз." };
}
```

## Info

### IN-01: `nextSlot` is a free String with no DB/type constraint

**File:** `prisma/schema.prisma:172` and `src/lib/services/bracket.ts:104-105`

**Issue:** `nextSlot` is typed `String?` in both the schema and the local `let nextSlot: string`
in `generateBracket`, even though the only valid values are the `Slot` union `"A" | "B"`. The
generation code is correct, but the type does not prevent a future writer from storing an
invalid slot, and it discards the `Slot` type that already exists at `bracket.ts:9`.

**Fix:** Type the local as `Slot | null` (`advance` already returns `Slot`), so any drift is a
compile error. The schema column can stay `String?` (SQLite has no enums) but the app-layer
type should be the union.

### IN-02: `BracketView.totalRounds` derives from key count, not max round

**File:** `src/components/bracket-view.tsx:57-58`

**Issue:** `totalRounds = rounds.length` (count of distinct round numbers present). For a
fully-generated bracket the rounds are always contiguous `1..N`, so `length === max round` and
`roundLabel` is correct today. It is only robust because generation guarantees contiguity; if a
partial/sparse match set were ever passed, the "Финал/Полуфинал" labels would mis-compute.

**Fix:** Optional hardening — derive from the actual max: `Math.max(...rounds)`. Not a defect
for the data this component receives in Phase 4.

---

_Reviewed: 2026-06-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
