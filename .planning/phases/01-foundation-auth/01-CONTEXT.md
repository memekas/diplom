# Phase 1: Foundation & Auth - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Запустить проект на залоченном стеке (Next.js 16 App Router + TS, Prisma 6 + SQLite, Better Auth ^1.6, Tailwind 4, Zod) со схемой БД, идемпотентным seed-аккаунтом админа и рабочей аутентификацией: регистрация игрока, вход, выход, серверные гварды роли (`requireUser`/`requireAdmin`), а также просмотр и редактирование собственного профиля.

Доставляет: AUTH-01..05, PLAYER-01, PLAYER-03. (PLAYER-02 — отображение в списках участников — реализуется в Phase 3 вместе со списком.)

НЕ входит: турниры, пары, сетка, результаты (последующие фазы).
</domain>

<decisions>
## Implementation Decisions

### Foundation setup
- **Пакетный менеджер:** npm (универсально доступен, без доп. установки на грейдер-машине).
- **Структура auth-роутов:** App Router group `app/(auth)/login` и `app/(auth)/register`; Better Auth catch-all route handler `app/api/auth/[...all]/route.ts`; гварды `requireUser()` / `requireAdmin()` в `lib/auth-guards.ts` (через `auth.api.getSession({ headers })`).
- **Доменный слой:** Server Components читают через сервисный слой, Server Actions выполняют все мутации (auth → zod → service → revalidate). Логика — в `lib/services/`.

### Registration & profile
- **Поля регистрации:** email, пароль, имя (обязательны); телефон и уровень игры (`beginner`|`intermediate`|`advanced`|`pro`) — опционально.
- **Сторона корта при регистрации НЕ запрашивается** — `User.courtSide` дефолт `either` («оба»).
- **Профиль редактируется** (PLAYER-03): сторона корта (`left`|`right`|`either`), телефон, уровень игры. Все доменные поля кроме `role` — display-only (без логики в v1).

### Auth (Better Auth ^1.6)
- Email+password провайдер; **email-верификация ВЫКЛЮЧЕНА** (офлайн-демо, нет SMTP).
- Сессия — дефолтная Better Auth (cookie), `nextCookies()` плагин.
- **Роль** — через Better Auth `admin()` plugin (`role` на User, дефолт `player`).
- Пароль хранится Better Auth (Account-таблица, scrypt). Отдельной `passwordHash` колонки на User НЕТ. Клиенту учётные данные не отдаются.

### Admin seed
- Идемпотентный seed-скрипт из env `ADMIN_EMAIL` / `ADMIN_PASSWORD`: если админ-аккаунта нет — создать через `auth.api.signUpEmail`, затем выставить `role: "admin"`. Повторный запуск не дублирует.

### Claude's Discretion
- Точные имена компонентов/файлов форм, верстка Tailwind (минимальные аккуратные формы).
- Использовать ли нативные Prisma enums (≥6.2) для `role`/`courtSide`/`skillLevel` или String + zod-union — на усмотрение (ARCHITECTURE.md допускает оба; String проще для Better Auth-генерируемой схемы).
- Конкретный способ слияния доменных полей с Better Auth-генерируемой User-моделью (`user.additionalFields` в конфиге Better Auth).
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Greenfield — пустой репозиторий, переиспользуемых ассетов нет. Эта фаза создаёт фундамент.

### Established Patterns
- Задаются здесь: Next.js 16 App Router (Server Components = чтение, Server Actions = запись), Prisma singleton `lib/db.ts`, сервисный слой `lib/services/`, Better Auth `lib/auth.ts` + `lib/auth-client.ts`, гварды `lib/auth-guards.ts`, Zod-валидация FormData, Tailwind 4 (CSS-first).

### Integration Points
- `app/api/auth/[...all]/route.ts` — Better Auth handler.
- Все последующие фазы зависят от схемы БД (User/Tournament/Pair/Match/SetScore) и гвардов, заложенных здесь.
</code_context>

<specifics>
## Specific Ideas

- Стек залочен в `.planning/research/STACK.md` + `AUTH.md`: Next.js 16, Prisma 6.x (≥6.2, НЕ 7), Better Auth ^1.6, Tailwind 4, Zod. Prisma singleton для dev hot-reload.
- Схема — по `.planning/research/ARCHITECTURE.md` (с учётом «SCORING MODEL OVERRIDE» и доменных полей User: name/role/courtSide/phone/skillLevel).
- `Tournament` модель создаётся в Phase 2 (с полями `setsPerMatch`=3 / `gamesPerSet`=6); `SetScore` — в Phase 5. В Phase 1 минимально достаточно User + (опц.) каркаса остальных моделей по решению планировщика.
</specifics>

<deferred>
## Deferred Ideas

- UI настройки числа сетов/геймов на турнир — v2 (SCOR-01).
- Рейтинги/посев по уровню игры — уровень в v1 только display-only (RANK-01 — v2).
- Email-верификация, восстановление пароля — вне scope (нет SMTP).
</deferred>
