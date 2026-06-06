# Roadmap: Padel Tournaments

## Overview

Веб-приложение для организации single-elimination турниров по паделу (пары). Путь от пустого репозитория до рабочей демонстрации Core Value строится строгой цепочкой зависимостей: сначала фундамент (схема БД + сидируемый админ) и аутентификация как защитный хребет, затем корневая сущность (турниры со state machine), регистрация пар, генерация сетки + публичный просмотр (это и есть Core Value — видимая сетка), и наконец ввод результатов с авто-продвижением победителей. Каждая фаза — вертикальный демонстрируемый срез (БД + сервер + фронт), не горизонтальный слой. Стек залочен: Next.js 16 (App Router, TS), Prisma ≥6.2 (SQLite), Better Auth ^1.6, Tailwind 4, Zod. Bracket-генерация и продвижение — самая рискованная и ценная работа: алгоритм слот-арифметики (`advance(round, position)`) пишется как протестированная чистая функция до любой UI-обвязки.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Auth** - Схема БД + сидируемый админ + регистрация/вход/выход (Better Auth) с серверными гвардами роли (completed 2026-06-06)
- [x] **Phase 2: Tournaments & Status Machine** - Админ создаёт турнир (4/8/16); все видят список и страницу со статусом; статусные переходы защищены на сервере (completed 2026-06-06)
- [x] **Phase 3: Registration & Pairs** - Игрок участвует, выбирает партнёра из пользователей; атомарная проверка целостности; регистрация закрывается на вместимости (completed 2026-06-06)
- [x] **Phase 4: Bracket Generation & Public View** - Кнопка «Старт» → случайная жеребьёвка в иммутабельную сетку; любой видит сетку с раундами/парами/TBD (Core Value) (completed 2026-06-06)
- [ ] **Phase 5: Results & Advancement** - Админ вводит счёт по сетам (геймы) → победитель сета/матча вычисляется → авто-продвижение в транзакции; финал → завершён/чемпион; правка свободная

## Phase Details

### Phase 1: Foundation & Auth

**Goal**: Запустить проект на залоченном стеке со схемой БД, сидируемым админом и работающей аутентификацией (регистрация/вход/выход + серверные гварды роли) — защитный хребет для всех последующих мутаций.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, PLAYER-01, PLAYER-03
**Success Criteria** (what must be TRUE):

  1. Новый игрок регистрируется (email, пароль, имя; опционально телефон и уровень игры) и сразу входит в систему; сторона корта при регистрации НЕ запрашивается (дефолт `either`)
  2. Игрок входит и его сессия сохраняется между перезагрузками страницы; выход доступен с любой страницы
  3. Игрок открывает профиль и меняет сторону корта (левая/правая/оба), телефон, уровень игры — изменения сохраняются и видны в профиле
  4. После инициализации БД (idempotent seed из env) существует ровно один админ-аккаунт с ролью `admin`; повторный запуск seed не дублирует его
  5. Server Action, защищённый `requireAdmin`, отклоняет вызов от не-админа при прямом обращении (не только скрытием UI), `requireUser` отклоняет анонима
  6. Учётные данные/секреты не утекают в клиентский payload (пароль хранится Better Auth, не отдаётся клиенту)

**Schema note**: Аутентификационные таблицы (User/Session/Account/Verification) генерируются Better Auth (`npx @better-auth/cli generate`); на модель `User` добавляются ДОМЕННЫЕ поля: `name`, `role`(default player, admin-плагин), `courtSide`(default `either`), `phone String?`, `skillLevel String?` (всё display-only кроме role). Пароль — в Account-таблице Better Auth, отдельной `passwordHash` колонки нет. См. research/AUTH.md + ARCHITECTURE.md.
**Plans**: 3 plans
Plans:

- [x] 01-01-PLAN.md — Walking Skeleton: scaffold stack + schema + register/login/dashboard/logout (AUTH-01/02/03, PLAYER-01)
- [x] 01-02-PLAN.md — Server-side guards (requireUser/requireAdmin) + idempotent admin seed (AUTH-04, AUTH-05)
- [x] 01-03-PLAN.md — Profile view + edit (courtSide/phone/skillLevel) (PLAYER-03)

**Decision gate**: Better Auth ^1.6 (per research/AUTH.md, overrides STACK.md) — подтверждено, hand-roll не нужен.

### Phase 2: Tournaments & Status Machine

**Goal**: Админ создаёт playoff-турнир для пар (размер 4/8/16); любой пользователь видит список турниров и страницу турнира со статусом; статус (`registration → in_progress → finished`) управляется единственной серверной функцией перехода с гвардами.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: TOUR-01, TOUR-02, TOUR-03, TOUR-04
**Success Criteria** (what must be TRUE):

  1. Админ создаёт турнир (название, размер 4/8/16, формат single-elimination; опц. дата/место) и видит его в списке со статусом `registration`
  2. Любой (в т.ч. анонимный) пользователь видит список турниров с бейджем статуса (регистрация открыта / идёт / завершён)
  3. Любой пользователь открывает страницу турнира и видит информацию, статус и (пока пустой) список зарегистрированных пар
  4. Недопустимый статусный переход, переданный напрямую в Server Action, отклоняется на сервере; клиентское значение статуса не принимается

**Schema note**: Модель `Tournament` создаётся здесь — включить поля `setsPerMatch Int @default(3)` и `gamesPerSet Int @default(6)` (теннисный счёт; в v1 не настраиваются через UI, используются дефолты), чтобы Phase 5 не требовала миграции Tournament. См. research/ARCHITECTURE.md «SCORING MODEL OVERRIDE».
**Plans**: 3 plans
Plans:

- [x] 02-01-PLAN.md — Foundation: Tournament model + migration, status-machine (transitionTournament + guards, TDD) + tournament service + validation (TOUR-01, TOUR-04)
- [x] 02-02-PLAN.md — Admin create vertical slice: guarded createTournamentAction + create page/form + admin nav link (TOUR-01)
- [x] 02-03-PLAN.md — Public view vertical slice: /tournaments list + /tournaments/[id] detail + RU status badge + empty/not-found states (TOUR-02, TOUR-03)

**UI hint**: yes

### Phase 3: Registration & Pairs

**Goal**: Авторизованный игрок нажимает «Участвовать» и регистрируется в турнире (статус `registration`), выбирая партнёра из зарегистрированных пользователей (Variant B); система атомарно гарантирует целостность пар и закрывает регистрацию на вместимости.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: REG-01, REG-02, REG-03, PLAYER-02
**Success Criteria** (what must be TRUE):

  1. Авторизованный игрок выбирает партнёра из списка пользователей и создаёт пару (`player1`/`player2`), видимую в списке участников турнира
  2. Система отклоняет партнёрство с самим собой, игрока, уже состоящего в паре этого турнира, и регистрацию сверх вместимости — проверка и вставка в одной транзакции
  3. По достижении вместимости (4/8/16 пар) регистрация закрывается, добавить ещё пару нельзя, и пользователю показан понятный статус «турнир заполнен/закрыт»
  4. Предпочитаемая сторона корта каждого участника отображается в списке участников и профиле (display-only)

**Plans**: 2 plans
Plans:

- [x] 03-01-PLAN.md — Pair model + migration + transactional registerPair integrity service (TDD) (REG-01, REG-02, REG-03)
- [x] 03-02-PLAN.md — End-to-end participation slice: guarded participateAction + partner-select form + participant list (name/court side/level) + entry-state branches (REG-01, REG-02, REG-03, PLAYER-02)

**UI hint**: yes

### Phase 4: Bracket Generation & Public View

**Goal**: Админ нажимает «Старт» (ровно при 4/8/16 парах) → генерируется полная иммутабельная single-elimination сетка случайной жеребьёвкой (Fisher–Yates) в одной транзакции, турнир переходит в `in_progress`; любой пользователь видит сетку (раунды, матчи, пары, TBD-слоты). Это Core Value.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: BRKT-01, BRKT-02, BRKT-03
**Success Criteria** (what must be TRUE):

  1. При заполненном турнире админ нажимает «Старт» → создаётся ровно `size-1` матчей с корректным числом раундов ({4:2, 8:3, 16:4}), round-1 заполнен перемешанными парами, турнир в статусе `in_progress`
  2. Любой пользователь видит турнирную сетку: раунды по порядку, матчи с парами и ещё не определёнными (TBD) слотами будущих раундов
  3. Повторная генерация невозможна: «Старт» отклоняется, если матчи уже существуют или статус ≠ `registration` (сетка иммутабельна, без повторной жеребьёвки)

**Plans**: 2 plans
Plans:

- [x] 04-01-PLAN.md — Match model + migration + bracket core: advance() + ROUNDS + transactional generate-once generateBracket (TDD) (BRKT-01, BRKT-03)
- [x] 04-02-PLAN.md — User slice: guarded «Старт» action + admin entry + public BracketView (rounds/pairs/TBD) wired into the detail page (BRKT-01, BRKT-02, BRKT-03)

**Research flag**: Слот-арифметика (`advance(round, position)`, final-first создание, table-driven counts) — реализовать по готовому алгоритму research/ARCHITECTURE.md с unit-тестами для 4/8/16; новых исследований не требуется, но это высший риск.
**UI hint**: yes

### Phase 5: Results & Advancement

**Goal**: Админ вводит счёт матча по сетам (геймы каждой пары в каждом сете); система валидирует сеты и вычисляет победителя сета и матча (теннисная модель: `setsPerMatch`/`gamesPerSet`, v1 фикс 3/6, win-by-2 или тай-брейк 7:6, матч = 2 сета из 3); победитель автоматически продвигается в следующий матч (слот A/B) в одной транзакции; когда у финала есть победитель — турнир `finished` и отображается чемпион; результат свободно правится.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: MATCH-01, MATCH-02, MATCH-03, MATCH-04, MATCH-05
**Success Criteria** (what must be TRUE):

  1. Админ вводит счёт по сетам (для каждого сета — геймы пары A и пары B); каждый сет валидируется (достижение `gamesPerSet`, маржа ≥2 или тай-брейк 7:6), победитель сета определяется автоматически
  2. Победитель матча вычисляется как первый, взявший `ceil(setsPerMatch/2)` сетов (2 из 3 при дефолте), и автоматически появляется в нужном слоте (A/B) следующего матча; запись счёта + продвижение — в одной транзакции
  3. Результат отклоняется, если оба слота матча не заполнены или счёт не даёт решающего победителя (недостаточно сетов / некорректные сеты)
  4. После победителя финального матча турнир переходит в `finished` и чемпион отображается на странице турнира
  5. Админ правит ранее введённый результат (SetScores удаляются и пересоздаются, победитель и слот следующего матча пересчитываются); публичная сетка отражает изменение сразу (revalidatePath, проверено на prod-сборке)

**Schema note**: Эта фаза вводит структурный счёт — модель `SetScore { matchId, setNumber, gamesPair1, gamesPair2 }` (cascade-delete от Match) и поля `Tournament.setsPerMatch`(=3)/`gamesPerSet`(=6) (миграция Prisma, если ещё не добавлены при создании Tournament). `Match.winnerId` теперь вычисляется из сетов; `scoreA/scoreB` репокрываются как кэш выигранных сетов. См. research/ARCHITECTURE.md «SCORING MODEL OVERRIDE».
**Plans**: 3 plans
Plans:

- [ ] 05-01-PLAN.md — Pure tennis-scoring functions setWinner + matchWinnerFromSets (TDD) (MATCH-01, MATCH-02)
- [ ] 05-02-PLAN.md — SetScore schema + migration + recordResult transactional advancement (TDD) (MATCH-02, MATCH-03, MATCH-04, MATCH-05)
- [ ] 05-03-PLAN.md — Result-entry slice: guarded recordResultAction + admin score form + BracketView scores/winner/champion (MATCH-01..05)
**Research flag**: Валидация сетов + вычисление победителя сета/матча — реализовать чистыми протестированными функциями (`setWinner(gamesA,gamesB,gamesPerSet)`, `matchWinner(sets,setsPerMatch)`) до UI; покрыть кейсы 6:4, 7:5, 7:6, незавершённый матч.
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Auth | 3/3 | Complete    | 2026-06-06 |
| 2. Tournaments & Status Machine | 3/3 | Complete    | 2026-06-06 |
| 3. Registration & Pairs | 2/2 | Complete    | 2026-06-06 |
| 4. Bracket Generation & Public View | 2/2 | Complete    | 2026-06-06 |
| 5. Results & Advancement | 0/3 | Not started | - |
