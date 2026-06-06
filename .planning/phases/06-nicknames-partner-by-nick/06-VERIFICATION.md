---
phase: 06-nicknames-partner-by-nick
verified: 2026-06-06T00:00:00Z
status: human_needed
score: 5/5 must-haves verified (code-level); 3 UI flows pending manual UAT
overrides_applied: 0
human_verification:
  - test: "Register a new account WITHOUT filling the nickname field (browser; submit attempt)."
    expected: "Form blocks submission — client shows «Минимум 3 символа» (or browser required-attr block); no account is created. With an invalid format (spaces / cyrillic) the regex message «Только буквы, цифры, _ и -» shows."
    why_human: "Client-side Zod validation + the HTML required attr only fire in a real browser DOM event; grep/tests confirm the schema and markup exist but not the rendered blocking behavior."
  - test: "Register two accounts (different emails) with the SAME nickname through the browser register form."
    expected: "Second submission shows «Никнейм уже занят»; Prisma Studio / DB shows only ONE user row for that nickname (no orphan User/Account)."
    why_human: "Requires the full Better Auth signUp.email HTTP round-trip to surface error.code === FAILED_TO_CREATE_USER and the atomic-abort guarantee; not exercised by the tsx unit tests (which stub prisma) and not by the build."
  - test: "On a tournament in registration status, log in as a player and submit the participate form typing (a) an existing partner's nickname, then (b) a nonexistent nickname."
    expected: "(a) Pair registers and appears in «Зарегистрированные пары»; (b) “Игрок с таким ником не найден” shows and no pair is created."
    why_human: "Requires the live participateAction Server Action with a real session cookie (requireUser) and revalidatePath re-render; the lookup + error path are verified against the seeded DB programmatically, but the end-to-end form-submit + UI update is browser-only."
---

# Phase 6: Nicknames & Partner-by-Nick Verification Report

**Phase Goal:** У каждого игрока есть уникальный никнейм, заданный при регистрации; партнёр на турнир указывается вводом ника (точный lookup), а не выбором из списка.
**Verified:** 2026-06-06
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Обязательное поле «никнейм» на форме регистрации; без него нет аккаунта; ник сохраняется в `User` | ✓ VERIFIED | `registerSchema.nickname` (trim, 3–30, `/^[A-Za-z0-9_-]+$/`, required, RU msgs) in `validation/auth.ts:10-15`; required `<input name="nickname" required>` in `register-form.tsx:117-127`; `nickname` parsed and passed (not spread-conditional) to `authClient.signUp.email({...nickname...})` at `register-form.tsx:42,46-53`; `auth.ts:24` declares `nickname { type:"string", required:true, input:true }`; schema `User.nickname String` at `schema.prisma:37`. DB query: all 21 seeded users have a non-null nickname (0 empty). **Browser-block behavior → human UAT.** |
| 2 | Дубль ника отклоняется RU-сообщением, аккаунт не создаётся (`@@unique` + `error.code` ветка) | ✓ VERIFIED | `@@unique([nickname])` at `schema.prisma:52`; migration creates `CREATE UNIQUE INDEX "user_nickname_key"` + `nickname TEXT NOT NULL`; `register-form.tsx:60-66` branches on `error.code === "FAILED_TO_CREATE_USER"` → «Никнейм уже занят» (and `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` → email msg), not `error.message`. DB: 21 users / 21 distinct nicknames (constraint live). **Atomic-abort + browser flow → human UAT.** |
| 3 | Форма участия: текстовое поле ника партнёра вместо `<select>`; список не предлагается | ✓ VERIFIED | `participate-form.tsx:24-32` is `<input name="player2Nickname" type="text" required>`; prop type narrowed to `{ tournamentId: string }`, no `partners` prop. `page.tsx` imports/calls NO `listEligiblePartners`, renders `<ParticipateForm tournamentId={id} />` (line 159). grep: zero `<select` / `listEligiblePartners` under `tournaments/[id]/`. |
| 4 | Существующий ник → точный lookup → пара; несуществующий → понятная ошибка, пара не создаётся | ✓ VERIFIED | `findUserIdByNickname` (`registration.ts:44-56`) does `prisma.user.findUnique({ where:{nickname}, select:{id} })`, throws `RegistrationError("partner_not_found", "Игрок с таким ником не найден")` on miss; `actions.ts:42` resolves nick → id BEFORE untouched `registerPair`; `actions.ts:48-53` surfaces RegistrationError msg, no pair. Behavioral run vs seeded DB: `player5`→32-char id; `no_such_nick`→throws `partner_not_found`; `PLAYER5`→not found (case-sensitive exact match confirmed). **Full form submit → human UAT.** |
| 5 | Сид-аккаунты (админ + тест-игроки) получают валидные уникальные ники; работает после reset+reseed | ✓ VERIFIED | `seed.ts:34` admin nickname `"admin"`; `seed-test-users.ts:49` `nickname = playerN`. Live run: `migrate reset --force` applied all 7 migrations + regenerated client + auto-seeded admin (nick `admin`); `npm run seed:test-users` created 20 players, skipped 0; DB confirms 21 users / 21 distinct nicknames / 0 null. App builds and seeds out of the box. |

**Score:** 5/5 truths verified at code/data/behavioral level. UI-only behaviors deferred to human UAT (see below).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prisma/schema.prisma` | `nickname String` + `@@unique([nickname])` | ✓ VERIFIED | Lines 37, 52 |
| `prisma/migrations/.../migration.sql` | `nickname TEXT NOT NULL` + unique index | ✓ VERIFIED | `20260606180646_add_user_nickname` — `user_nickname_key` created; applied cleanly on empty table |
| `src/lib/auth.ts` | `additionalFields.nickname {required:true,input:true}` | ✓ VERIFIED | Line 24 |
| `src/lib/auth-client.ts` | `inferAdditionalFields<typeof auth>()` (deviation fix) | ✓ VERIFIED | Line 10 — required to type the literal `nickname` signUp param |
| `src/lib/validation/auth.ts` | `registerSchema.nickname` (3–30, `[A-Za-z0-9_-]`) | ✓ VERIFIED | Lines 10-15 |
| `src/app/(auth)/register/register-form.tsx` | required input + `error.code` mapping | ✓ VERIFIED | Lines 46-66, 117-127 |
| `src/lib/services/registration.ts` | `findUserIdByNickname` + `partner_not_found` in union | ✓ VERIFIED | Lines 13, 44-56 |
| `src/lib/validation/registration.ts` | `player2Nickname` (no `player2Id`) | ✓ VERIFIED | Lines 8-9; error key renamed |
| `src/app/(public)/tournaments/[id]/actions.ts` | resolve nick → id before `registerPair` | ✓ VERIFIED | Lines 33-47 |
| `src/app/(public)/tournaments/[id]/participate-form.tsx` | text input, select removed, no `partners` prop | ✓ VERIFIED | Lines 11, 24-32 |
| `src/app/(public)/tournaments/[id]/page.tsx` | no `listEligiblePartners`, `<ParticipateForm tournamentId>` | ✓ VERIFIED | Line 159; no partners computation |
| `scripts/e2e-record-result.ts` | raw `user.create` includes `nickname` (deviation fix) | ✓ VERIFIED | Build green confirms type-correct |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| register-form.tsx | `authClient.signUp.email` | nickname literal param + `error.code` → RU | ✓ WIRED | Literal `nickname` param now type-checks via inferred additionalFields; FAILED_TO_CREATE_USER mapped |
| actions.ts | `findUserIdByNickname → registerPair` | resolve player2Nickname → player2Id pre-tx | ✓ WIRED | `const player2Id = await findUserIdByNickname(...)` then `registerPair({...player2Id})` |
| registration.ts | `prisma.user.findUnique({where:{nickname}})` | exact case-sensitive lookup | ✓ WIRED | Confirmed live: case-sensitive (PLAYER5 rejected) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| validation test (`player2Nickname`) | `npx tsx src/lib/validation/registration.test.ts` | 8 assertions passed | ✓ PASS |
| service test (incl. lookup cases) | `npx tsx src/lib/services/registration.test.ts` | 8 assertions passed | ✓ PASS |
| typecheck/compile | `npm run build` | green, 11 routes built | ✓ PASS |
| DB recreate + seed | `migrate reset --force && seed:test-users` | 7 migrations applied; admin + 20 players; 0 skipped | ✓ PASS |
| nickname uniqueness in DB | tsx findMany | 21 users / 21 distinct / 0 null | ✓ PASS |
| known nick lookup | `findUserIdByNickname('player5')` | 32-char id returned | ✓ PASS |
| unknown nick lookup | `findUserIdByNickname('no_such_nick')` | throws `partner_not_found`, no create | ✓ PASS |
| case sensitivity | `findUserIdByNickname('PLAYER5')` | not found (BINARY/case-sensitive) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| USER-01 | 06-01 | Никнейм задаётся при регистрации (обязательное поле) | ✓ SATISFIED | Truths 1, 5 |
| USER-02 | 06-01 | Уникальность на уровне БД + проверка, дубль отклоняется | ✓ SATISFIED | Truth 2 (`@@unique`, error.code branch, DB 21/21 distinct) |
| REG-04 | 06-01 | Партнёр вводом ника, точный lookup, нет списка | ✓ SATISFIED | Truths 3, 4 |

No orphaned requirements: REQUIREMENTS.md maps USER-01/USER-02/REG-04 to Phase 6, all claimed by the single plan's `requirements` field.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| prisma/schema.prisma | 161 | `TBD` in comment | ℹ️ Info | Pre-existing Phase 5 comment describing TBD match slots filled as winners advance — not an unresolved debt marker for Phase 6 work, not on a nickname-modified line. No action. |

No stubs, no empty handlers, no hardcoded-empty render paths, no `return null`/placeholder UI in any phase artifact.

### Human Verification Required

The 5 success criteria are verified at the code, schema, migration, DB-data, and service-behavioral levels (above). The remaining gaps are purely browser/HTTP-flow behaviors that cannot be confirmed without running the app:

#### 1. Register form blocks on missing/invalid nickname

**Test:** In the browser register form, submit with the nickname field empty, then with an invalid value (spaces / cyrillic).
**Expected:** Submission blocked; «Минимум 3 символа» (empty) or «Только буквы, цифры, _ и -» (invalid format); no account created.
**Why human:** Client-side Zod + HTML `required` only fire on a real DOM submit event; code presence is verified but rendered blocking is browser-only.

#### 2. Duplicate-nickname register rejected, no account created

**Test:** Register two accounts (different emails) with the same nickname via the browser.
**Expected:** Second shows «Никнейм уже занят»; DB/Prisma Studio shows exactly one row for that nickname (no orphan User/Account).
**Why human:** Needs the full Better Auth `signUp.email` HTTP round-trip (`error.code === FAILED_TO_CREATE_USER`) + atomic-abort guarantee; the tsx tests stub prisma and don't exercise this path.

#### 3. Participate by nickname — existing vs nonexistent

**Test:** As a logged-in player on a registration-status tournament, submit the participate form with (a) an existing partner's nickname, then (b) a nonexistent nickname.
**Expected:** (a) pair registers and appears in the list; (b) «Игрок с таким ником не найден», no pair.
**Why human:** Requires the live `participateAction` Server Action with a real session cookie (`requireUser`) and `revalidatePath` re-render; lookup + error path verified programmatically but end-to-end form-submit + UI update is browser-only.

### Gaps Summary

No gaps. All 5 success criteria and all 3 requirements (USER-01, USER-02, REG-04) are satisfied in the codebase: schema/migration enforce a required unique nickname, signup collects and persists it with duplicate mapping via the stable `error.code`, the participate form is a text input resolving partner by exact case-sensitive lookup before the untouched transactional gate, and seeds (admin + 20 players) produce 21 distinct nicknames with the app working out of the box after `migrate reset` + reseed. Build, both unit test suites, and live DB/behavioral spot-checks all pass.

Status is `human_needed` (not `passed`) solely because three browser/HTTP user flows (form-level blocking, the duplicate-register atomic abort, and the live participate round-trip) require manual UAT to confirm rendered behavior — the underlying code, schema, and data are all verified.

Code-review note (non-blocking, from 06-REVIEW.md): `listEligiblePartners` in `registration.ts` is now dead code (REG-04 removed its consumer) — intentionally retained per the locked optional-deletion decision; not a defect.

---

_Verified: 2026-06-06_
_Verifier: Claude (gsd-verifier)_
