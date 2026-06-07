# Phase 7: Модель данных мультиформата - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — grey areas pre-resolved from `.planning/research/FORMATS.md` decisions D1–D7 (locked with user during milestone setup); per project directive [[padel-autonomous-no-questions]] no re-asking.

<domain>
## Phase Boundary

Слой 1 (модель данных) милстоуна v2.0. Эта фаза описывает Prisma-схему, миграцию и сиды, поддерживающие все четыре формата (playoff/round_robin/americano/mexicano), одиночных и парных участников, обязательный уровень игры (5 RU) + дату рождения, и настраиваемый режим подсчёта (sets/points без лимитов) — БЕЗ поломки существующих playoff-данных (Match/Pair/SetScore).

**В scope (DATA-01…07):** изменения схемы, миграция, сиды, генерация Prisma-клиента, юнит-проверки инвариантов схемы.
**НЕ в scope:** бизнес-логика создания/регистрации/генерации (Фаза 8–9), любой UI (Фаза 10–11). Эта фаза — только данные и их форма.
</domain>

<decisions>
## Implementation Decisions

### Архитектура моделей (решение D4 — изоляция playoff от регрессии)
- НЕ перегружать существующий `Match` под ротационные форматы. `Match`/`Pair`/`SetScore` остаются строго playoff (single-elim) — не трогаем их инварианты (`pairAId/pairBId/winnerId` = FK на `Pair`, `nextMatchId/nextSlot/position`, `@@unique([tournamentId,round,position])`).
- Для round-based / индивидуальных форматов завести ОТДЕЛЬНЫЕ модели:
  - `TournamentPlayer` — одиночная заявка: `tournamentId`, `userId`, `@@unique([tournamentId, userId])`. (`Pair` остаётся для парных форматов.)
  - `Round` — `tournamentId`, `roundNumber`, `status` (`pending|in_progress|finished`), `@@unique([tournamentId, roundNumber])`. Нужна, т.к. мексикано материализует раунды по одному.
  - `RoundMatch` — матч раунда: `roundId`, `courtNumber`, две команды как 4 nullable FK на `User` (`teamA1Id/teamA2Id/teamB1Id/teamB2Id`; для одиночного RR — заполнены только A1/B1), результат. Отдельно от playoff-`Match`.
  - `PlayerMatchScore` — `roundMatchId`, `userId`, `teamSlot`, `pointsFor`, `pointsAgainst`. Оба партнёра команды получают ОДНО командное `pointsFor`. `pointsAgainst` обязателен (тай-брейк #2 + детерминизм мексикано-нарезки).
- Альтернатива (обобщённый `Match` + дискриминатор) ОТКЛОНЕНА для диплома — хрупко (взаимоисключающие nullable-поля, конфликт `@@unique`, ветвление `recordResult`).

### Поля `Tournament` (DATA-02, DATA-07)
- `format` String @default("playoff") — `playoff|round_robin|americano|mexicano` (без Prisma-enum, String + zod-union, «Pitfall 9»).
- `participantMode` String @default("pairs") — `pairs|singles`.
- `level` String — уровень участников, одно из 5 RU (для матчинга в Фазе 8).
- `price` — цена (отображение; оплата в клубе). Тип: Int (минимальные ед. валюты) или Decimal — на усмотрение планнера; nullable/optional допустимо.
- `scoringMode` String @default("sets") — `sets|points`.
- `targetPoints` Int? — целевая сумма очков на матч для points-режима американо/мексикано (дефолт 24, настраиваемый, без жёсткого набора {16,24,32}).
- `totalRounds` Int? — число раундов для американо/мексикано.
- `setsPerMatch`/`gamesPerSet` — сделать настраиваемыми БЕЗ верхнего лимита (снять зашитость; сейчас @default(3)/(6)). Семантика «size» становится format-зависимой (валидация — Фаза 8, не в схеме).
- Для points-результата хранить два целых на матч (`pointsA`/`pointsB` на `RoundMatch`); НЕ прогонять через `SetScore`/`isValidSet`.

### Поля `User` (DATA-01)
- `skillLevel` → ОБЯЗАТЕЛЕН, одно из 5 RU-значений: `новичок|прогрессирующий|средний|высокий|профессиональный`. Хранение — String (не enum). Значения-идентификаторы: на усмотрение планнера допустимо хранить латинские ключи (`beginner|progressing|intermediate|advanced|pro`) с RU-лейблами на UI, ЛИБО прямо RU-строки — выбрать ОДИН подход и задокументировать. ВАЖНО: текущие 4 англ. значения (`beginner|intermediate|advanced|pro`) расширяются до 5 — добавляется тир «прогрессирующий/progressing» между beginner и intermediate.
- `birthDate` DateTime? — опциональная дата рождения.
- `courtSide` — существующее поле, остаётся (не в требованиях, безвредно).
- Поскольку `skillLevel` был nullable, а станет обязательным — миграция требует backfill ИЛИ reset (см. ниже).

### Миграция и сиды (DATA-06)
- Для диплома допустим `prisma migrate reset` + reseed (БД пересоздаётся из сидов) — это снимает проблему backfill обязательного `skillLevel` для существующих строк.
- Сиды (`prisma/seed.ts` админ + `scripts/seed-test-users.ts` тестовые игроки) обновить: каждый юзер получает валидный `skillLevel` (5 RU) и опц. `birthDate`; сохранить идемпотентность и уникальность ника.
- Существующие playoff-данные после reset воссоздаются сидами; структура Match/SetScore не меняется.

### Locked-решения форматов (из FORMATS.md, контекст для схемы)
- D1: американо/мексикано = одиночная регистрация (`participantMode=singles`) + системная ротация; индивидуальные очки → `TournamentPlayer` + `PlayerMatchScore`.
- D2: RR в points — равные очки запрещены (правило валидации — Фаза 8/9; схема просто хранит два целых).
- D3: американо/мексикано по умолчанию только `points`; `sets` — нестандартное расширение (схема допускает оба).
- D5: round-robin — single, чистая таблица (без доп. финала).
- D6: `targetPoints` дефолт 24, настраиваемый.
- D7: мягкий cap участников (≤~24) — валидация в Фазе 8.

### Claude's Discretion
- Точные имена полей/моделей, типы (Int vs Decimal для price, DateTime для birthDate), nullable-стратегия, индексы — на усмотрение планнера, следуя конвенциям существующей `schema.prisma`.
- Конкретное имя slug-ключей уровня (латиница vs RU) — выбрать и задокументировать.
- Нужна ли отдельная модель для round-robin парных матчей или переиспользовать `RoundMatch` с парными слотами — на усмотрение планнера (главное — не ломать playoff `Match`).
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `prisma/schema.prisma` — модели User, Session, Account, Verification, Tournament, Pair, Match, SetScore. Без Prisma-enum (все «enum» = String + zod-union).
- `prisma/seed.ts` — идемпотентный seed админа из env (ADMIN_EMAIL/ADMIN_PASSWORD), nickname='admin'.
- `scripts/seed-test-users.ts` — N тестовых игроков, детерминированные ники playerN, варьируемые courtSide/skillLevel/phone.
- `src/lib/validation/auth.ts` — `skillLevels` константа (сейчас 4 англ. значения) — единая точка определения уровней, переиспользуется register + profile.

### Established Patterns
- SQLite + Prisma 6 (`prisma-client-js`), datasource через env DATABASE_URL.
- Значения-перечисления: String-колонка + zod `z.enum([...])` + TS-union. Комментарий схемы «Pitfall 9».
- Пароль в `Account.password` (scrypt, Better Auth) — НЕ на User. Доменные поля User висят через Better Auth `additionalFields`.
- Миграции в `prisma/migrations/` (7 применённых, последняя `20260606180646_add_user_nickname`).

### Integration Points
- `skillLevels` в `src/lib/validation/auth.ts` — расширение 4→5 значений отразится здесь (потребляется Фазой 8 register/profile и Better Auth additionalFields в `src/lib/auth.ts`).
- Better Auth `additionalFields` (`src/lib/auth.ts`) — `skillLevel` станет required; `birthDate` — новый optional additionalField (если собирается на регистрации — но это Фаза 8/11; в схеме поле добавляется сейчас).
- `prisma migrate reset` затронет `dev.db` — после фазы запускается reseed.

### Полный технический разбор форматов
- **`.planning/research/FORMATS.md`** — §4 «Выводы для модели данных» (что схема обязана вместить), §6 решения D1–D7. ОБЯЗАТЕЛЬНО к прочтению планнером: содержит точную привязку к схеме и архитектурное обоснование отдельных моделей.
</code_context>

<specifics>
## Specific Ideas

- Schema-дизайн ведётся «наперёд» под все 4 формата и оба режима подсчёта, чтобы Фаза 9 (движки) не потребовала миграции — это смысл горизонтальной нарезки (БД сначала).
- Главный инвариант фазы: playoff (Match/Pair/SetScore, тесты bracket/result) НЕ ломается; новые модели аддитивны.
- Реализация-готовые детали и edge-cases (odd N, byes, ротация, тай-брейкеры) — в FORMATS.md §1–§3; в этой фазе из них берутся только ТРЕБОВАНИЯ К ХРАНЕНИЮ, сама логика — Фаза 9.
</specifics>

<deferred>
## Deferred Ideas

- Бизнес-логика создания/валидации/генерации/подсчёта — Фаза 8 (ядро) и Фаза 9 (движки).
- UI (формы, визуализация, локализация, тема) — Фазы 10–11.
- Точные правила валидации size/level/ничьих — Фаза 8 (схема лишь хранит).
</deferred>
