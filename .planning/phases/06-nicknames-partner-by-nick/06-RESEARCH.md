# Phase 6: Nicknames & Partner-by-Nick - Research

**Researched:** 2026-06-06
**Domain:** Better Auth additionalFields signup, Prisma 6 + SQLite migration, nickname→userId lookup integration
**Confidence:** HIGH (Better Auth behavior verified against installed source v1.6.14)

## Summary

This is a tightly-scoped phase. The implementation approach is fully locked in `06-CONTEXT.md`; this research confirms only the three mechanics needed to plan accurately and surfaces one non-obvious gotcha the planner MUST account for.

The headline finding: a `nickname @@unique` violation at signup surfaces as Better Auth error code **`FAILED_TO_CREATE_USER`** (message `"Failed to create user"`, HTTP 422), **not** a nickname-specific code. The current `register-form.tsx` renders `error.message` verbatim — that would show the user "Failed to create user", which is wrong. The plan must map `error.code === "FAILED_TO_CREATE_USER"` → RU "Никнейм уже занят". Atomicity is preserved: the collision aborts the `createUser` insert itself, so no orphan User or Account row is created.

**Primary recommendation:** Declare `nickname { type: "string", required: true, input: true }` in `user.additionalFields`; rely on the DB `@@unique([nickname])` as source of truth; in `register-form.tsx` switch from `error.message` passthrough to a `error.code`-based map. Use `prisma migrate reset` + reseed (no NOT-NULL-on-populated-table problem). SQLite TEXT unique is case-sensitive by default — matches the locked exact-match decision, no `COLLATE` needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Хранение и сбор ника (USER-01)**
- `nickname` — новое обязательное поле `User` в `prisma/schema.prisma`, `@@unique([nickname])`.
- Сбор при регистрации через Better Auth `additionalFields.nickname { type: "string", required: true, input: true }` (как `phone`/`skillLevel`), чтобы дубль рубил весь signup атомарно, а не пост-update.
- `register-form.tsx`: добавить обязательное поле «никнейм» рядом с email/password/name; прокидывать в `authClient.signUp.email({ ..., nickname })`.

**Гарантия уникальности (USER-02)**
- Источник истины — `@@unique` на уровне БД.
- Ошибку нарушения уникальности от Better Auth signUp маппим в понятное сообщение формы («Никнейм уже занят»), аккаунт при этом не создаётся (атомарность signUp).
- Формат ника: trim, 3–30 символов, разрешены `[A-Za-z0-9_-]` (без пробелов). Zod в `registerSchema`.
- Сравнение точное (регистрозависимое) — нормализованный матчинг вне scope.

**Запись по нику (REG-04)**
- `participate-form.tsx`: `<select>` партнёра → текстовое поле `player2Nickname`. Список пользователей не предлагается (убрать `listEligiblePartners`-загрузку из страницы).
- `validation/registration.ts`: схема `player2Nickname` (trim, непустой) вместо `player2Id`.
- `services/registration.ts`: новый хелпер `findUserIdByNickname(nickname)` → резолв в `userId` ДО входа в существующий транзакционный `registerPair`. Несуществующий ник → типизированная ошибка (расширить существующий union кодов), пара не создаётся. Самопаринг (свой ник) ловится существующим guard player1≠player2.

**Существующая dev.db / миграция**
- Добавление обязательного `nickname`: `prisma migrate reset` + reseed (диплом, `dev.db` в .gitignore). Миграция добавляет `nickname TEXT NOT NULL UNIQUE`.

**Сид-бэкфилл**
- `prisma/seed.ts`: админ получает ник (напр. `admin`).
- `scripts/seed-test-users.ts`: каждый тестовый игрок — уникальный детерминированный ник.

### Claude's Discretion
- Точные тексты сообщений об ошибках (RU), верстка нового поля — по существующим паттернам формы.
- Имя кода ошибки lookup в union (`partner-not-found` или аналог).

### Deferred Ideas (OUT OF SCOPE)
- Автодополнение/поиск по нику (предложение списка) — отложено (REG-04 = точный ввод).
- Редактирование ника в профиле — вне scope v1.1.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| USER-01 | Игрок задаёт уникальный никнейм при регистрации | `additionalFields.nickname` is passed through `signUp.email` and persisted on the User row (verified — see Finding 1) |
| USER-02 | Уникальность гарантирована на уровне БД + проверяется при регистрации (дубль → понятная ошибка) | `@@unique([nickname])` (SQLite BINARY/case-sensitive); collision → `error.code === "FAILED_TO_CREATE_USER"` mapped to RU message; signup atomic, no orphan rows (Finding 1) |
| REG-04 | Партнёр указывается вводом никнейма (точный lookup), не выбором | `findUserIdByNickname` resolves before `registerPair`; new typed error code in `RegistrationError` union (Finding 3) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Tech stack fixed: Next.js 16 App Router, Prisma 6.x (installed 6.19.3), SQLite, Better Auth `^1.6` (installed 1.6.14), Zod 4 (installed 4.4.3). No new deps without asking.
- SQLite: no native enum — keep `nickname` as `String`. Prisma singleton already in `lib/db`.
- `dev.db` is gitignored; graders recreate via migrations + seed → `migrate reset` is safe.
- Thesis: simplest working path, no premature optimization. No new libraries needed for this phase.
- Follow existing form/service/validation patterns (terse, typed-error union, explicit safe `select`).

## Finding 1: Better Auth nickname signup + duplicate handling

**Source:** installed `node_modules/better-auth@1.6.14/dist/api/routes/sign-up.mjs` and `@better-auth/core/dist/error/{index,codes}.mjs` — authoritative for the pinned version (stronger than docs).

### (a) Field accepted + persisted — VERIFIED
`sign-up.mjs` reads `Object.keys(ctx.context.options.user.additionalFields)`, picks matching keys off the request body, and spreads them into `internalAdapter.createUser({ email, name, image, ...additionalUserFields, emailVerified: false })`. So declaring:
```ts
user: {
  additionalFields: {
    phone:      { type: "string", required: false, input: true },
    skillLevel: { type: "string", required: false, input: true },
    nickname:   { type: "string", required: true,  input: true }, // NEW
  },
},
```
makes `authClient.signUp.email({ email, password, name, nickname })` accept `nickname` and persist it onto the User row. `required: true` adds it to the inferred client param type (TS will require it) and Better Auth validates presence. `input: true` allows it to be set from the signup request. Matches the existing `phone`/`skillLevel` pattern in `src/lib/auth.ts`. **[VERIFIED: better-auth dist source]**

> Schema note: the generated Prisma `User` model must gain `nickname String` + `@@unique([nickname])`. Better Auth maps additionalFields to existing columns; it does NOT create the column. The migration (Finding 2) does.

### (b) Duplicate error shape — VERIFIED, with a gotcha
`createUser` → `createWithHooks(..., "user", ...)` is a **single Prisma `create`**, NOT wrapped in `$transaction`. On a `nickname` unique-constraint hit, Prisma throws `P2002`, which propagates to the `try/catch` around `createUser` (sign-up.mjs lines 219–233):
```js
} catch (e) {
  if (isAPIError(e)) throw e;                 // Prisma error is NOT an APIError → skip
  throw APIError.from("UNPROCESSABLE_ENTITY", BASE_ERROR_CODES.FAILED_TO_CREATE_USER);
}
```
The client therefore receives:
```ts
{ error: { code: "FAILED_TO_CREATE_USER", message: "Failed to create user", status: 422, statusText: "UNPROCESSABLE_ENTITY" } }
```
**[VERIFIED: better-auth dist source — codes.mjs `FAILED_TO_CREATE_USER: "Failed to create user"`]**

**GOTCHA (must plan for):** the duplicate-email case returns a *different, earlier* code — `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` ("User already exists. Use another email.", 422) — checked before user creation. So at the form layer:
- `error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"` → "Этот email уже зарегистрирован" (existing behavior territory).
- `error.code === "FAILED_TO_CREATE_USER"` → "Никнейм уже занят" (the only realistic create-time unique violation in this schema, since email is pre-checked).

The current form renders `error.message` raw (`setErrors({ form: error.message ?? ... })`), which for a nickname dup shows "Failed to create user". **The plan must switch to an `error.code` map** so the user sees the RU nickname message. `error.code` is the stable contract; `error.message` is the English fallback. **[VERIFIED]**

### (c) Atomicity — no orphan row — VERIFIED
User creation (line 220) precedes `linkAccount` (line 235) as two separate non-transactional calls. A nickname collision throws **inside** `createUser`, before the User row commits and before `linkAccount` runs. Result: **no User row, no Account row** — signup fails clean. The locked "дубль рубит весь signup атомарно" assumption holds *for the nickname-collision path specifically* (the collision is what aborts the insert). **[VERIFIED: control flow in sign-up.mjs]**

## Finding 2: Prisma 6 + SQLite migration (add required UNIQUE column)

**Source:** Prisma migrate troubleshooting docs + locked decision. **[CITED: prisma.io/docs/orm/prisma-migrate/workflows/troubleshooting]**

- Adding a **required column with no default to a populated table** fails: `prisma migrate dev` errors *"Added the required column ... without a default value. There are N rows..."*. Prisma has no auto-backfill.
- **Locked path avoids this entirely:** `prisma migrate reset` drops + recreates the DB from scratch, applies all migrations (the new one creating `nickname TEXT NOT NULL`), then re-runs seed. Because there are zero rows at apply time, `NOT NULL` + `UNIQUE` apply with no backfill step. Safe here: `dev.db` gitignored, no real data, thesis. **[VERIFIED: matches CONTEXT decision]**
- **Schema annotation:** locked decision says `@@unique([nickname])`. A single-field index works identically as `@unique` on the field or `@@unique([nickname])` on the model — both emit a `CREATE UNIQUE INDEX`. Existing model already uses `@@unique([email])`, so `@@unique([nickname])` is the consistent choice. No functional difference for a single column. **[VERIFIED]**
- **SQLite case-sensitivity:** a TEXT `UNIQUE` index uses **BINARY collation by default → case-sensitive**. `"Bob"` and `"bob"` are distinct and both insertable. This **exactly matches** the locked USER-02 "сравнение точное (регистрозависимое)" decision — do **NOT** add `COLLATE NOCASE`. The same case-sensitivity governs the REG-04 lookup `where: { nickname }` (exact match). **[VERIFIED: SQLite docs — default BINARY collation on TEXT]**

**Migration name (suggested):** `add_user_nickname`. Generated SQL: recreate `user` table (SQLite ALTER limitations make Prisma rebuild-and-copy) with `nickname TEXT NOT NULL` + `CREATE UNIQUE INDEX user_nickname_key ON user(nickname)`. Since reset starts empty, the table-rebuild copy is a no-op on data.

## Finding 3: REG-04 lookup integration point

**Source:** `src/lib/services/registration.ts`, `src/lib/validation/registration.ts` (read this session). **[VERIFIED: codebase]**

The existing transactional gate is `registerPair(prisma, { tournamentId, player1Id, player2Id })` — a `prisma.$transaction` that re-reads status, runs the self-partner guard (`player1Id === player2Id`), capacity lock, cross-slot duplicate check, then inserts. It rejects via the typed `RegistrationError` whose code union is:
```ts
"self_partner" | "already_registered" | "tournament_full" | "not_open"
```

**Integration (matches locked plan):**
1. Add `findUserIdByNickname(prisma, nickname): Promise<string>` to `registration.ts`. Does `prisma.user.findUnique({ where: { nickname }, select: { id: true } })` (exact, case-sensitive — Finding 2). On miss, throw `new RegistrationError("partner_not_found", "Игрок с таким ником не найден")`.
2. Extend the `RegistrationError` code union with the new member (Claude's discretion on name — recommend `"partner_not_found"` for snake_case consistency with existing members).
3. The action calls `findUserIdByNickname` to resolve `player2Id` **before** `registerPair` (the transaction stays untouched — REG-01/02/03 integrity preserved). Self-pairing still caught by the existing `player1Id === player2Id` guard inside `registerPair` (resolving own nick → own id → `self_partner`). No need to special-case it in the lookup.
4. `listEligiblePartners` becomes dead code for the participate page (the page stops loading it and stops passing `partners` to the form). Decision: leave the function or delete it — it is still self-contained and harmless; deletion is cleaner but optional (planner's call; tests reference only `registerPair`).

**Validation change:** `registerPairSchema` swaps `player2Id` → `player2Nickname: z.string().trim().min(1, "Введите ник партнёра")`. `parseRegisterPairForm` reads `formData.get("player2Nickname")`. The `ParseRegisterPairFormResult` error key changes `"player2Id"` → `"player2Nickname"`.

**Form change:** `participate-form.tsx` — drop the `partners` prop and the `<select>`; render a text `<input name="player2Nickname" required>`. The `partners.length === 0` empty-state branch is removed (no list to be empty). The detail page (`tournaments/[id]/page.tsx`) stops calling `listEligiblePartners` and stops passing `partners`.

**Nickname format (USER-01/USER-02 client+server):** add to `registerSchema` in `validation/auth.ts`:
```ts
nickname: z.string().trim().min(3, "Минимум 3 символа").max(30, "Максимум 30 символов")
  .regex(/^[A-Za-z0-9_-]+$/, "Только буквы, цифры, _ и -"),
```
This is for the *register* form (where the nick is created). The *participate* form only needs non-empty trim (the partner's nick already exists and was format-validated at their registration).

## Common Pitfalls

### Pitfall 1: Rendering `error.message` for nickname collision
**What goes wrong:** Form shows English "Failed to create user" instead of "Никнейм уже занят".
**Root cause:** Better Auth maps the Prisma unique error to the generic `FAILED_TO_CREATE_USER` code; `message` is the English fallback.
**Avoid:** Branch on `error.code`, not `error.message`. `FAILED_TO_CREATE_USER` → nickname message; `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` → email message.
**Warning sign:** English text in the RU form on a duplicate nickname.

### Pitfall 2: Assuming nickname dup returns a nickname-specific code
**What goes wrong:** Planner writes a handler for a `code` like `"NICKNAME_TAKEN"` that never fires.
**Root cause:** Better Auth has no per-field unique code; any non-email create failure is `FAILED_TO_CREATE_USER`.
**Avoid:** In *this* schema the only create-time unique column besides email is `nickname`, so `FAILED_TO_CREATE_USER` ⇒ nickname. Document this assumption; if a future unique field is added, the mapping becomes ambiguous.

### Pitfall 3: Adding required column without reset → migrate error
**What goes wrong:** `prisma migrate dev` aborts on "required column without default, N rows".
**Avoid:** Use `prisma migrate reset` (locked) — empty table at apply time, no backfill needed. Reseed after.

### Pitfall 4: Stale duplicate type/error keys after the rename
**What goes wrong:** `player2Id` lingers in form `FieldErrors`, `ParseRegisterPairFormResult`, action state, or tests → TS/runtime mismatch.
**Avoid:** Grep for `player2Id` across `participate-form.tsx`, `actions.ts`, `validation/registration.ts`, `page.tsx`, `registration.test.ts` and update each. `registerPair`'s internal `player2Id` param name stays (it still receives a resolved id).

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `dev.db` User rows have no `nickname` column yet. Reset wipes them. | `migrate reset` + reseed (no data migration — thesis, gitignored). |
| Live service config | None — no external services hold nickname state. | None — verified: only SQLite + Better Auth (Prisma adapter), both local. |
| OS-registered state | None — verified: no schedulers/daemons reference user fields. | None. |
| Secrets/env vars | None new. `ADMIN_EMAIL`/`ADMIN_PASSWORD` unchanged; seed adds admin nickname (e.g. `admin`) in code only. | Update `prisma/seed.ts` to set admin nickname; no env change. |
| Build artifacts | Prisma client must regenerate after schema change to type `nickname` on `User`. | `prisma generate` runs automatically on `migrate reset`/`migrate dev`. |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| better-auth | signup additionalFields | ✓ | 1.6.14 | — |
| prisma / @prisma/client | migration + lookup | ✓ | 6.19.3 | — |
| zod | nickname validation | ✓ | 4.4.3 | — |
| SQLite (file dev.db) | storage | ✓ | bundled | — |

No new dependencies. **Step 2.6: all deps already installed.**

## Package Legitimacy Audit

Not applicable — this phase installs **no new external packages**. All libraries (better-auth, prisma, zod) are already in the project and verified installed at the versions above.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None — hand-written assertion scripts run via `tsx` (see `registration.test.ts` header) |
| Config file | none |
| Quick run command | `npx tsx src/lib/services/registration.test.ts` |
| Full suite command | same (single script) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REG-04 | `findUserIdByNickname` returns id for known nick; throws `partner_not_found` for unknown | unit | `npx tsx src/lib/services/registration.test.ts` | ✅ (extend existing) |
| REG-04 | resolving own nick → own id → `self_partner` via existing guard | unit | same | ✅ (existing guard, add case) |
| USER-02 | nickname collision → `FAILED_TO_CREATE_USER` mapped to RU msg | manual | manual register two users same nick | ❌ (auth flow not unit-tested; manual at defense) |
| USER-01 | nickname persisted on User | manual / Prisma Studio | `npx prisma studio` | ❌ manual |

### Sampling Rate
- **Per task commit:** `npx tsx src/lib/services/registration.test.ts` (extend fake prisma with a `user.findUnique` stub).
- **Phase gate:** test script green + manual register/duplicate-nick + participate-by-nick smoke before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] Extend `registration.test.ts` fake prisma with `user.findUnique` to cover `findUserIdByNickname` (known + unknown nick).
- [ ] No framework install needed.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | In this schema, `FAILED_TO_CREATE_USER` at signup ⇒ nickname collision (email dup returns a distinct earlier code) | Finding 1b | If another unique create-time field is later added, the RU message would mislabel a different collision. Low risk in v1.1 — nickname is the only new unique field. |
| A2 | `additionalFields required:true` is enforced by Better Auth at the API layer (presence) | Finding 1a | If only client-typed (not server-validated), a crafted request could omit nickname → NULL insert fails on NOT NULL anyway. Defense-in-depth via Zod + DB NOT NULL covers it regardless. |

## Sources

### Primary (HIGH confidence)
- `node_modules/better-auth@1.6.14/dist/api/routes/sign-up.mjs` — signup control flow, additionalFields spread, try/catch → `FAILED_TO_CREATE_USER`, User-before-Account ordering (atomicity).
- `node_modules/@better-auth/core/dist/error/{index,codes}.mjs` — `APIError.from` shape `{ message, code }` + code strings `FAILED_TO_CREATE_USER`, `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`.
- `node_modules/better-auth/dist/db/internal-adapter.mjs` — `createUser` is a single `createWithHooks` (no `$transaction`).
- Codebase: `src/lib/auth.ts`, `register-form.tsx`, `validation/auth.ts`, `services/registration.ts`, `validation/registration.ts`, `participate-form.tsx`, `prisma/schema.prisma`.

### Secondary (MEDIUM confidence)
- https://www.prisma.io/docs/orm/prisma-migrate/workflows/troubleshooting — required-column-without-default error + reset path.
- https://sqlite.org/lang_expr.html , https://github.com/prisma/prisma/discussions/20607 — SQLite default BINARY (case-sensitive) collation; migrate backfill discussion.

## Metadata

**Confidence breakdown:**
- Better Auth signup/error/atomicity: HIGH — read from installed source for the pinned version.
- Migration/SQLite: HIGH — locked reset path sidesteps the only gotcha; case-sensitivity matches the locked decision.
- REG-04 integration: HIGH — existing code read directly; integration point is the resolve-before-transaction seam.

**Research date:** 2026-06-06
**Valid until:** 30 days (stack pinned; findings tied to installed versions)
