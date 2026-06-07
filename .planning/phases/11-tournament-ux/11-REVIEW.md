---
phase: 11-tournament-ux
reviewed: 2026-06-07T19:50:03Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - src/app/(app)/admin/tournaments/new/create-tournament-form.tsx
  - src/lib/auth.ts
  - src/lib/validation/auth.ts
  - src/app/(auth)/register/register-form.tsx
  - src/app/(app)/profile/profile-form.tsx
  - src/app/(app)/profile/page.tsx
  - src/app/(public)/tournaments/[id]/page.tsx
  - src/app/(public)/tournaments/[id]/participate-form.tsx
  - src/app/(public)/tournaments/[id]/round-score-form.tsx
  - src/app/(public)/tournaments/[id]/remove-registration-form.tsx
  - src/app/(public)/tournaments/[id]/finish-tournament-form.tsx
  - src/components/round-robin-view.tsx
  - src/components/rotation-view.tsx
  - src/lib/services/rounds.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: resolved
resolved:
  - WR-01  # birthDate signup persistence runtime-verified (persists as Date); regression check added
  - WR-02  # dead existingSets prop removed
accepted:
  - WR-03  # cosmetic, single-admin thesis (seed admin never banned) — server guard rejects
---

# Phase 11: Code Review Report

**Reviewed:** 2026-06-07T19:50:03Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed all Phase 11 (final v2.0) UX-wiring source: extended create-tournament form (forced-singles hidden inputs + conditional fields), register/profile/auth birthDate wiring, the format-dispatched + mode-branched tournament detail page, the three new form leaves, the two per-format view components, and the round-based read helpers.

**No BLOCKER-class defects.** The high-risk mechanisms hold under tracing:

- **Forced-singles hidden-input mechanism is correct.** For americano/mexicano the visible `participantMode`/`scoringMode` selects drop their `name=` (rendered disabled / nameless) and a paired hidden input carries `singles`/`points`. There is no double-field collision — the `name` attribute is mutually exclusive between the disabled select and the hidden input (`create-tournament-form.tsx:100-104,161-167`). FormData submits exactly one value per field, matching `parseTournamentForm` and the `superRefine` mode/scoring constraints.
- **FormData field names match the parsers.** `points_a`/`points_b` and `set{n}_a`/`set{n}_b` in `round-score-form.tsx:66,74,90,98` match `parseRoundResultForm` (`round-result.ts:27-28,48-49`); create-form names match `parseTournamentForm` (`tournament.ts:118-133`); profile/register names match their schemas.
- **roundMatchId binds correctly.** `recordResultAction.bind(null, tournamentId, roundMatchId, setsPerMatch)` passes the `RoundMatch.id`; the server dispatcher re-reads format/scoringMode from the DB (`format-engine.ts:69-72,84-92`) so a tampered client value cannot misroute the write.
- **Standings union is unwrapped by `kind` before reaching the views** (`page.tsx:305,313`): `units` → RoundRobinView, `players` → RotationView, `[]` otherwise. The raw union is never passed.
- **Access control boundary holds.** Every write control routes through a `requireAdmin()`/`requireUser()`-guarded action with ids `.bind()`-supplied from the RSC; UI hiding is cosmetic. No action is reachable that lacks a server guard.
- **Reads expose only safe fields.** `listRounds`/`listTournamentPlayers` use explicit selects (`{id,name}` team slots; `{id,name,skillLevel,courtSide}` players) — no email/birthDate/credential columns (`rounds.ts:14,55`). The page's `tournamentSelect` and `listTournamentPairs` projections carry no PII.
- **Playoff path is byte-for-byte unchanged.** `git diff a249e46^..HEAD` shows zero changes to `bracket-view.tsx`, `score-form.tsx`, `result.ts`, `bracket.ts`.
- **birthDate/email round-trip is wired** end-to-end on the profile path (getProfile selects → page slices to `yyyy-MM-dd` → profileSchema date-union → updateProfile persists). Email self-compare prevents a spurious changeEmail on an unchanged address.

Findings are robustness/quality issues plus one runtime-unverified persistence assumption.

## Warnings

### WR-01: signup `birthDate` persistence is runtime-unverified (A1 assumption)

**File:** `src/lib/auth.ts:29`, `src/app/(auth)/register/register-form.tsx:60`
**Issue:** `birthDate` is declared as a Better Auth `additionalField` of `type: "string"` (the A1-safe fallback), but the register form writes a **full ISO datetime** string (`birthDate.toISOString()` → e.g. `2000-05-01T00:00:00.000Z`) into a Prisma `DateTime?` column via the Better Auth → prismaAdapter write path. Whether the SQLite/Prisma adapter coerces that ISO string into the `birthDate DateTime?` column (vs. storing a string, throwing, or nulling) at signup time is **not covered by any test** — `registration.test.ts` exercises the service layer, and `rounds.test.ts`/`profile.test.ts` only touch reads/schema. If coercion fails silently, `User.birthDate` stays null after signup despite a filled field (the exact A1 warning sign in RESEARCH Pitfall 1).
**Fix:** Add a focused runtime check before sign-off: register a user with a birthDate via the actual signup flow and assert `prisma.user.findUnique(...).birthDate` is a non-null `Date`. If it does not persist, send a date-only ISO (`birthDate.toISOString().slice(0,10)`) or switch the additionalField to `type: "date"`. This is a 5-minute verification, not necessarily a code change — but it must be confirmed, not assumed, since it is the only PII-write path the milestone introduces.

**RESOLVED (2026-06-07):** Runtime-verified against the real `auth.api.signUpEmail` path + DB. A full ISO-datetime string (`new Date("2000-05-01").toISOString()` → `2000-05-01T00:00:00.000Z`, exactly what `register-form.tsx:60` sends) persists correctly: `User.birthDate` comes back as a non-null `Date` with the exact round-trip value (`birthDate instanceof Date === true`). No silent null, no string storage, no throw. The `type: "string"` additionalField (A1-safe fallback) is confirmed correct — **no code change needed**. Added permanent regression guard `scripts/check-signup-birthdate.ts` (asserts the Date round-trip; exits non-zero on failure) so the assumption stays verified.

### WR-02: `existingSets` prop on `RoundScoreForm` is structurally unsupplyable — sets-mode re-entry silently loses prior games

**File:** `src/app/(public)/tournaments/[id]/round-score-form.tsx:38,47`; `src/app/(public)/tournaments/[id]/page.tsx:116-125`
**Issue:** `RoundScoreForm` accepts an optional `existingSets` prop and prefills set rows from it (`row?.gamesPair1 ?? ""`). But `RoundMatch` stores **no per-set rows** — only `pointsA`/`pointsB` (sets-won collapsed by `scoreSetsMode`, `round-result.ts:130`), and `listRounds` cannot read what does not exist. The page never passes `existingSets` (`page.tsx:116-125`), so for a round_robin sets-mode match the form is always blank, even though the views only inject the entry form for **unrecorded** matches (`round-robin-view.tsx:61`, `rotation-view.tsx:74`) — recorded matches render score text with no editor. Net effect: the prop is dead, and sets-mode results are effectively write-once via the UI. Not a data-loss bug (no re-edit path is exposed), but the prop advertises a capability the data model cannot back.
**Fix:** Drop the `existingSets` parameter and the `rows`-from-`existingSets` branch; build the sets rows purely from `setsPerMatch` (`Array.from({length: setsPerMatch})`). This removes the misleading prop and the implication that prior set scores can be re-shown.

**RESOLVED (2026-06-07):** Removed the `existingSets` prop and its type from `RoundScoreForm`. Sets rows are now built purely from `setsPerMatch` (`const setCount = scoringMode === "sets" ? setsPerMatch : 0;` → `Array.from({ length: setCount })`), inputs render blank (no `defaultValue` from non-existent per-set data). The `page.tsx` call site never passed `existingSets`, so no call-site change. `pointsA`/`pointsB` still drive the points-mode current-value display. tsc 0, build green.

### WR-03: banned-admin sees admin controls (cosmetic, but UI/guard divergence)

**File:** `src/app/(public)/tournaments/[id]/page.tsx:60`
**Issue:** The page computes `isAdmin = session?.user?.role === "admin"` via `getOptionalSession()`, which does **not** apply the `isBanned()` check that `requireAdmin()` enforces (`auth-guards.ts:49`). A banned admin therefore renders remove/finish/score controls. This is not exploitable — every action re-checks `requireAdmin()` (including `isBanned`) server-side, so clicks fail with "Forbidden" — but the UI shows controls the server will reject, an inconsistency with the rest of the cosmetic-gating contract.
**Fix:** Acceptable to leave for a single-admin thesis demo (the only admin is the seed account and is never banned). If tightening: reuse the guard's ban predicate when deriving the `isAdmin` UI flag, or note explicitly that ban-state is out of scope for UI gating.

## Info

### IN-01: RoundRobinView "Очки" column shows `pointsFor` only

**File:** `src/components/round-robin-view.tsx:97`
**Issue:** The standings table header «Очки» renders `u.pointsFor` with no `pointsAgainst` column, while «Разница» shows `pointDiff`. Readers cannot see goals-against directly. Display choice, internally consistent (RotationView does the same, `rotation-view.tsx:138`).
**Fix:** Optional — add a «Пропущено» (`pointsAgainst`) column if a fuller table is wanted; otherwise leave as-is.

### IN-02: `nameById` for round_robin pairs accumulates redundant per-user entries

**File:** `src/app/(public)/tournaments/[id]/page.tsx:80-92`
**Issue:** For a pairs round_robin the standings `unitId` is a `Pair.id`, resolved from the `pairs` loop (`:90-92`). The team-slot loop (`:80-86`) also writes per-user `nameById[userId]` entries that are never consulted by the unit standings table (which keys on `unitId`/`pairId`). Harmless dead map entries — they make the map slightly larger and the intent less obvious.
**Fix:** Optional — gate the team-slot loop to singles formats, or add a comment that per-user entries serve only the singles/player-rating path. No behavioral impact.

### IN-03: register vs profile skill-level treatment differs (intended, undocumented at the seam)

**File:** `src/app/(auth)/register/register-form.tsx:160-176` vs `src/app/(app)/profile/profile-form.tsx:94-105`
**Issue:** Register makes `skillLevel` a required select with a disabled placeholder (closes Phase 7 WR-01/IN-01), while profile keeps it optional with an `—` empty option. This divergence is correct (registration must force an explicit level; profile edit must not wipe it), but nothing at either call site notes the asymmetry, inviting a "fix" that re-introduces the default-slip.
**Fix:** Optional — one-line comment on the profile select noting the optionality is deliberate and distinct from the register requirement.

---

_Reviewed: 2026-06-07T19:50:03Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
