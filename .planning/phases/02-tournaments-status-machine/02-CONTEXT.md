# Phase 2: Tournaments & Status Machine - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Админ создаёт playoff-турнир для пар (размер 4/8/16); любой пользователь (включая анонимного) видит список турниров и страницу турнира со статусом; статус (`registration → in_progress → finished`) управляется единственной серверной функцией перехода с гвардами.

Доставляет: TOUR-01, TOUR-02, TOUR-03, TOUR-04.

НЕ входит: регистрация пар на турнир (Phase 3), генерация сетки/кнопка «Старт» (Phase 4), результаты (Phase 5). В этой фазе только создание турнира (→ статус `registration`), просмотр списка/страницы, и каркас status-machine, который подключат P4/P5.
</domain>

<decisions>
## Implementation Decisions

### Tournament creation (admin only)
- Форма создания: `name` (обязательно), `size` (select 4 / 8 / 16 пар), `date` (опционально, datetime), `location` (опционально, строка). Формат фиксирован — single-elimination pairs (не выбирается).
- `setsPerMatch`(=3) и `gamesPerSet`(=6) НЕ в форме — задаются дефолтами схемы (теннисный счёт, настройка через UI — v2). Поля присутствуют в модели Tournament (чтобы Phase 5 не требовала миграции Tournament).
- Создание турнира → статус `registration`.

### Access
- Создание турнира и любые статус-переходы — только admin (Server Action первой строкой `requireAdmin()`). Кнопка «Создать турнир» и страница создания скрыты+защищены для не-админов.
- Список турниров и страница турнира — ПУБЛИЧНЫЕ (видят все, включая анонимов) — это путь к Core Value (видимая сетка позже).

### Tournament list
- Показываются все турниры, новые сверху (createdAt desc), бейдж статуса (Регистрация открыта / Идёт / Завершён). Понятный empty-state, если турниров нет.

### Tournament detail page
- Информация (название, размер, формат, дата/место если заданы), бейдж статуса, и (пока пустой) список зарегистрированных пар (наполнится в Phase 3). Кол-во зарегистрированных пар / вместимость (0/size).

### Status state machine (TOUR-04)
- Единая серверная функция перехода `transitionTournament(tournamentId, from, to)` (в lib/services) с гвардами: проверяет текущий статус в БД внутри операции, отклоняет недопустимые переходы, НЕ принимает клиентское значение статуса вслепую. Допустимые рёбра: `registration → in_progress → finished`.
- В Phase 2 фактически используется только инициализация в `registration` при создании. Переходы `→ in_progress` (Старт, P4) и `→ finished` (финал, P5) подключаются позже, но функция и гварды пишутся здесь.
- Статус хранится как String (Prisma SQLite), валидируется TS-union + zod.

### Claude's Discretion
- Точная верстка (Tailwind) — по UI-SPEC.
- Имена компонентов/файлов, структура services/validation.
- Использовать ли Prisma enum для status (≥6.2) или String — на усмотрение; String проще, согласуется с research.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (from Phase 1)
- `src/lib/db.ts` — Prisma singleton. `src/lib/auth-guards.ts` — `requireUser()`/`requireAdmin()`/`getOptionalSession()` (server-side boundary; reject banned). `src/lib/services/*` + `src/lib/validation/*` pattern (thin Server Action → zod → service → revalidatePath). Route groups `(app)`/`(auth)`. `src/components/nav.tsx`.
- Prisma schema already has User; Tournament/Pair/Match models per research/ARCHITECTURE.md may be partially present or need creation.

### Established Patterns
- Server Components read via service layer; Server Actions mutate (auth → zod → service → revalidatePath). Tailwind 4. npm. kysely pinned 0.28.17 (do not touch).

### Integration Points
- Add `Tournament` model (+ setsPerMatch/gamesPerSet) to prisma/schema.prisma → `npx prisma migrate dev`.
- Admin create action guarded by requireAdmin. New routes: tournaments list (public), tournament detail (public), admin create (guarded). Add nav link.
</code_context>

<specifics>
## Specific Ideas

- Data model per `.planning/research/ARCHITECTURE.md` (Tournament: id, name, size, status default "registration", date?, location?, setsPerMatch=3, gamesPerSet=6, createdAt; relations pairs/matches). onDelete cascade for child relations.
- Status labels in Russian UI: `registration`→«Регистрация открыта», `in_progress`→«Идёт», `finished`→«Завершён».
- size constrained to {4,8,16} via zod enum; reject other values server-side.
</specifics>

<deferred>
## Deferred Ideas

- Pairs registration UI/logic — Phase 3.
- «Старт» / bracket generation — Phase 4.
- Editing/deleting tournaments, admin status-override dropdown — not required for v1 (only the create→registration path + transition fn here).
- setsPerMatch/gamesPerSet configuration UI — v2 (SCOR-01).
</deferred>
