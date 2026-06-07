---
phase: 07-multiformat-data-model
reviewed: 2026-06-07T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - prisma/schema.prisma
  - prisma/migrations/20260607163701_multiformat_data_model/migration.sql
  - src/lib/validation/auth.ts
  - src/lib/auth.ts
  - src/lib/services/profile.ts
  - src/app/(public)/tournaments/[id]/page.tsx
  - src/app/(auth)/register/register-form.tsx
  - prisma/seed.ts
  - scripts/seed-test-users.ts
  - scripts/e2e-record-result.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: findings
---

# Phase 07: Code Review Report

**Reviewed:** 2026-06-07
**Depth:** standard
**Files Reviewed:** 9 (+2 cross-referenced: src/lib/validation/profile.ts, scripts/e2e-record-result.ts)
**Status:** findings (2 warnings, 2 info — all low-stakes for a thesis; no blockers)

## Summary

Phase 07 is a data-model-only phase: 4 new additive Prisma models (TournamentPlayer/Round/RoundMatch/PlayerMatchScore), 7 new nullable/defaulted Tournament columns, a User `skillLevel` nullable→NOT-NULL promotion plus optional `birthDate`, and a 4→5 skill-tier expansion with an RU label map. The phase invariant — **playoff stack (Pair/Match/SetScore) untouched** — holds: `git diff 14b71fb..73f07c7` shows zero changes inside those model bodies, and all 7 existing test scripts pass.

**Correctness verdict — strong.** The cascade discipline is consistent and correct: ownership chain cascades (Tournament→Round→RoundMatch→PlayerMatchScore, TournamentPlayer→Tournament), and every User FK is non-cascading (RESTRICT for required FKs in tournament_player/player_match_score; SET NULL for the 4 nullable RoundMatch team FKs — which matches the `String?` schema declaration). The generated migration faithfully reproduces the schema: every preserved column is carried in both table-rebuild `INSERT … SELECT` statements, no data column is dropped, and `skillLevel` lands NOT NULL only after a `migrate reset` (CONTEXT D6), so the "fail on existing NULL" warning is moot.

**skillLevel ripple — clean.** The `skillLevels` const in `validation/auth.ts` is the single source of truth, consumed by both `registerSchema` and `profileSchema` via `z.enum(skillLevels)`. Every write path is gated: register-form and profile go through the zod enum; `seed.ts` ("pro"), `seed-test-users.ts` (5-key round-robin), and `e2e-record-result.ts` ("intermediate") use hardcoded valid tiers. No code path can persist an invalid level. `skillLevelLabels` covers all 5 keys; the page's `skillLevelLabel()` safely falls back to "—" for unknown/null.

No injection, authz, or secret-handling regressions — this phase adds no Server Actions, and `profile.ts` keeps the `safeProfileSelect` (no credential columns) and the requireUser-sourced `userId`.

The two warnings are data-quality issues that the plan explicitly defers full UX for (Phase 8/11); they are recorded for the fixer's awareness, not as scope violations.

## Warnings

### WR-01: Empty skill-level selection silently persists "beginner" instead of the user's actual tier

**File:** `src/app/(auth)/register/register-form.tsx:52`
**Issue:** `skillLevel` is required server-side (Better Auth `required:true`, DB NOT NULL) but `registerSchema.skillLevel` is `.optional()` and the `<select>` defaults to the empty option. When a user submits without choosing a tier, the form writes `skillLevel: skillLevel ?? "beginner"` — silently recording a definite skill level the user never selected. Since `level` matching is a Phase-8 feature keyed on this field, every "didn't bother to pick" user becomes a real "beginner" in the matching pool. This is a data-integrity hazard, not just cosmetics.
**Fix:** This is a documented Phase 8/11 UX deferral, so no change is required *in this phase*. When the field UX is built, make the select `required` (remove the empty option, or add zod `.refine`) so the value is an explicit user choice rather than a silent fallback. Flagged so it is not lost.
```tsx
// Phase 8/11: drop the optional+fallback, make selection mandatory
skillLevel: z.enum(skillLevels), // no .optional()
// and remove the `<option value="">—</option>` placeholder
```

### WR-02: RoundMatch allows two matches on the same court within one round (no uniqueness guard)

**File:** `prisma/schema.prisma:278-297`
**Issue:** `RoundMatch` has `@@index([roundId])` but no `@@unique([roundId, courtNumber])`. Nothing at the DB layer prevents two matches in the same round being assigned the same `courtNumber`, and equally nothing prevents the same player being slotted into two concurrent matches of one round (no `@@unique` covering team FKs per round). For round-based formats (americano/mexicano), a player double-booked in one round is a correctness bug the schema cannot catch. Compare with playoff `Match`, which carries `@@unique([tournamentId, round, position])` as a structural backstop.
**Fix:** Court/player-per-round invariants are enforced by the Phase-9 generator (CONTEXT defers rotation logic), so this is a deliberate "schema stores, engine validates" choice — acceptable for the thesis. If a cheap DB backstop is wanted later, add:
```prisma
@@unique([roundId, courtNumber])
```
(A per-round per-player guard cannot be expressed with a single composite unique across 4 nullable FKs, so that stays an engine-level invariant.)

## Info

### IN-01: `registerSchema.skillLevel` optionality contradicts the now-required field — type/intent drift

**File:** `src/lib/validation/auth.ts:30`
**Issue:** `skillLevel: z.enum(skillLevels).optional()` no longer reflects reality: the field is required at the auth layer and in the DB. The optionality only exists to keep the placeholder-fallback in WR-01 compiling. This makes the schema lie about the contract and is the root enabler of WR-01.
**Fix:** Tighten to `z.enum(skillLevels)` once the form makes the select mandatory (Phase 8/11). No change needed now; tracked alongside WR-01.

### IN-02: Seed idempotency keyed on email leaves the `nickname` unique constraint uncovered

**File:** `prisma/seed.ts:25`, `scripts/seed-test-users.ts:58`
**Issue:** Both seeds guard on `findUnique({ where: { email } })` but the `@@unique([nickname])` constraint is not covered by that check. If re-run against a non-empty DB where a nickname ("admin" / "playerN") already exists under a *different* email, `signUpEmail` throws `FAILED_TO_CREATE_USER`. This is already documented in-code and mitigated: `seed-test-users.ts` wraps the create in try/catch (log-and-skip, WR-01 from a prior phase), and the canonical flow is `migrate reset` + reseed against an empty DB. `seed.ts` (admin) is *not* wrapped, so a nickname collision there would abort — but that scenario only arises outside the reset flow.
**Fix:** None required for the thesis reset-based workflow (the comments correctly describe the boundary). If hardening is desired, key the admin guard on `nickname` as well, or catch P2002 in `seed.ts`.

---

_Reviewed: 2026-06-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
