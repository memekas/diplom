# Phase 6: Nicknames & Partner-by-Nick - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (decisions auto-accepted per project directive — thesis, simplicity-first)

<domain>
## Phase Boundary

У каждого игрока есть уникальный никнейм, заданный при регистрации; партнёр на турнир указывается вводом ника (точный lookup), а не выбором из списка. Покрывает USER-01, USER-02, REG-04.

</domain>

<decisions>
## Implementation Decisions

### Хранение и сбор ника (USER-01)
- `nickname` — новое обязательное поле `User` в `prisma/schema.prisma`, `@@unique([nickname])`.
- Сбор при регистрации через Better Auth `additionalFields.nickname { type: "string", required: true, input: true }` (как `phone`/`skillLevel`), чтобы дубль рубил весь signup атомарно, а не пост-update.
- `register-form.tsx`: добавить обязательное поле «никнейм» рядом с email/password/name; прокидывать в `authClient.signUp.email({ ..., nickname })`.

### Гарантия уникальности (USER-02)
- Источник истины — `@@unique` на уровне БД.
- Ошибку нарушения уникальности от Better Auth signUp маппим в понятное сообщение формы («Никнейм уже занят»), аккаунт при этом не создаётся (атомарность signUp).
- Формат ника: trim, 3–30 символов, разрешены `[A-Za-z0-9_-]` (без пробелов). Zod в `registerSchema`.
- Сравнение точное (регистрозависимое) — нормализованный матчинг вне scope (см. REQUIREMENTS Out of Scope).

### Запись по нику (REG-04)
- `participate-form.tsx`: `<select>` партнёра → текстовое поле `player2Nickname`. Список пользователей не предлагается (убрать `listEligiblePartners`-загрузку из страницы).
- `validation/registration.ts`: схема `player2Nickname` (trim, непустой) вместо `player2Id`.
- `services/registration.ts`: новый хелпер `findUserIdByNickname(nickname)` → резолв в `userId` ДО входа в существующий транзакционный `registerPair`. Несуществующий ник → типизированная ошибка (расширить существующий union кодов), пара не создаётся. Самопаринг (свой ник) ловится существующим guard player1≠player2.

### Существующая dev.db / миграция
- Добавление обязательного `nickname` к таблице с существующими строками: `prisma migrate reset` + reseed (диплом, `dev.db` в .gitignore, реальных данных нет). Миграция добавляет `nickname TEXT NOT NULL UNIQUE`.

### Сид-бэкфилл
- `prisma/seed.ts`: админ получает ник (напр. `admin`).
- `scripts/seed-test-users.ts`: каждый тестовый игрок — уникальный детерминированный ник.

### Claude's Discretion
- Точные тексты сообщений об ошибках (RU), верстка нового поля — по существующим паттернам формы.
- Имя кода ошибки lookup в union (`partner-not-found` или аналог).

</decisions>

<code_context>
## Existing Code Insights

- `src/lib/auth.ts` — Better Auth, `user.additionalFields` уже содержит `phone`/`skillLevel` (паттерн для `nickname`).
- `src/app/(auth)/register/register-form.tsx` — client form, `registerSchema.safeParse` → `authClient.signUp.email(...)`; `error.message` уже выводится в `errors.form`.
- `src/lib/validation/auth.ts` — `registerSchema` (добавить `nickname`).
- `src/app/(public)/tournaments/[id]/participate-form.tsx` — `<select name="player2Id">`.
- `src/lib/services/registration.ts` — `registerPair` транзакционный + `listEligiblePartners`.
- `src/lib/validation/registration.ts` — `registerPairSchema` (`player2Id`), `parseRegisterPairForm`.
- `prisma/schema.prisma` — `model User` (id, name, email, role, courtSide, phone, skillLevel, pairsAsP1/P2).
- `prisma/seed.ts`, `scripts/seed-test-users.ts` — сид-аккаунты.
- Tests: `src/lib/services/registration.test.ts` — обновить под nickname-lookup.

</code_context>

<specifics>
## Specific Ideas

Ник как стабильный человекочитаемый идентификатор для записи партнёра — заменяет техн. `player2Id` в UI, но внутри всё так же резолвится в `userId` перед транзакцией (целостность v1.0 сохраняется).

</specifics>

<deferred>
## Deferred Ideas

- Автодополнение/поиск по нику (предложение списка) — отложено (REG-04 = точный ввод).
- Редактирование ника в профиле — вне scope v1.1.

</deferred>
