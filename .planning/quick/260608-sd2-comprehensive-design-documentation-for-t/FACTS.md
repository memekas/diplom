# FACTS — выверенный бриф системы «Padel Tournaments» (источник правды для doc-агентов)

> Этот файл — единый, проверенный по актуальному коду свод фактов и соглашений.
> Каждый doc-агент ОБЯЗАН прочитать его перед написанием своего документа в `docs/`.
> Факты выверены 2026-06-08 по `prisma/schema.prisma` и `src/**` (после free-form scoring rewrite).

## 0. Назначение брифа

Документы в `docs/` — исходный материал для главы 2 «Проектирование» дипломной работы.
Их будут читать другие ИИ-агенты и диалоги, чтобы писать связный текст главы. Поэтому:
факты должны быть точными, диаграммы — корректными, термины — едиными во всех файлах.

## 1. Соглашения для всех документов

- **Язык:** русский. Технические идентификаторы (имена моделей, полей, функций, статусов) —
  латиницей как в коде: `Tournament`, `scoringMode`, `recordResult`, `"in_progress"`.
- **Формат:** Markdown. Заголовок `# <Номер> — <Название>` в начале каждого файла.
- **Диаграммы:** только Mermaid в блоках ```mermaid```. Использовать:
  `erDiagram` (модель данных), `flowchart TD/LR` (алгоритмы, потоки, навигация),
  `sequenceDiagram` (сценарии), `stateDiagram-v2` (жизненные циклы), `graph` (карта сайта).
  Подписи на диаграммах — по-русски, где это читабельно; идентификаторы сущностей — латиницей.
- **Кросс-ссылки:** ссылаться на другие документы по имени файла, напр. `[модель данных](04-model-dannyh.md)`.
- **Без кода реализации.** Это глава «Проектирование»: описываем ЧТО и КАК спроектировано,
  приводим сигнатуры/псевдокод/алгоритмы, но НЕ копируем тела функций целиком. Псевдокод и
  схемы — да; листинги production-кода — нет.
- **Тон:** инженерно-нейтральный, пригодный для академического текста. Обосновывать решения
  («почему так»), а не только перечислять.
- **Длина:** исчерпывающе. Лучше подробнее. Каждый раздел — с обоснованием проектного решения.

## 2. Краткое описание продукта

Веб-приложение для организации турниров по паделу для ОДНОЙ организации-клуба (единственный
администратор). Игроки регистрируются (с указанием уровня), участвуют одиночно или парами,
смотрят визуализацию турнира и результаты. Дипломная работа — приоритет простоты и скорости,
без реальной нагрузки. Только русский язык, тёмная тема, адаптив.

**Четыре формата турниров:**
- `playoff` (олимпийская / single-elimination) — только 4/8/16 участников, без bye.
- `round_robin` (круговой) — свободное число участников (soft-cap 24).
- `americano` — ротационный, одиночная регистрация, система ротирует пары, индивидуальные очки.
- `mexicano` — ротационный, как американо, но пары формируются по текущему рейтингу (по раундам).

**Режим подсчёта (`scoringMode`), ортогонален формату:**
- `sets` — счёт по сетам/геймам (теннисный стиль).
- `points` — два произвольных целых очка за матч.
- **Free-form (после v2.0):** без верхних лимитов — любое число сетов, любые геймы, любые очки.
  Поля `setsPerMatch`/`gamesPerSet`/`targetPoints` остались в БД с дефолтами, но НЕ читаются и
  убраны из формы создания. Победитель вычисляется по геймам/сетам; ничья допустима во всех
  форматах, КРОМЕ playoff (там ничья → типизированная ошибка, без продвижения).

## 3. Технологический стек (выверено по package.json)

| Слой | Технология | Версия | Роль |
|------|------------|--------|------|
| Фреймворк | Next.js (App Router) | 16.2.7 | Full-stack: RSC (чтение) + Server Actions (запись) |
| UI | React | 19.2.4 | Server/Client Components |
| Язык | TypeScript | ^5 | Типобезопасность сквозная |
| ORM | Prisma + @prisma/client | ^6.19.3 | Доступ к БД, миграции, генерация типов |
| БД | SQLite | (файл) | Без enum-типов → строки + zod-union |
| Валидация | Zod | ^4.4.3 | Парсинг FormData, бизнес-правила |
| Auth | Better Auth | ^1.6.14 | email+password, `admin()` plugin, Prisma-адаптер, Node runtime |
| Стили | Tailwind CSS + @tailwindcss/postcss | ^4 | Без JS-конфига, тёмная тема |
| Прочее | tsx (dev) | ^4 | Запуск seed/тест-скриптов |

Менеджер пакетов — npm (`package.json` scripts). Email-верификация ВЫКЛючена (офлайн-демо).

## 4. Архитектурные слои (выверено по дереву src/)

```
Браузер (форма) ─► Server Action (тонкий, auth-guard + parse*Form) ─► Service (бизнес-логика, Prisma) ─► SQLite
RSC (страница) ──► Service (read-функция) ─► Prisma ─► SQLite ─► HTML
```

- **`src/lib/services/*.ts`** — «толстый» слой бизнес-логики. Принимают `prisma` параметром
  (actions остаются тонкими). Кидают ТИПИЗИРОВАННЫЕ ошибки с `code`-дискриминантом
  (`ResultError`, `RegistrationError`, `AdminError`, `BracketError`, `FormatError`, `RoundResultError`,
  `RecordResult? `). Транзакции (`prisma.$transaction`) для целостности; на reject — полный откат.
- **`src/lib/validation/*.ts`** — zod-схемы + `parse*Form(formData)` функции. Один источник правды
  для формы и для серверной границы (не могут разойтись).
- **`src/app/**/actions.ts`** — Server Actions (`"use server"`). Паттерн: `requireUser()/requireAdmin()`
  → `parse*Form` → вызов service → `revalidatePath`. Возвращают `{ ok, fieldErrors?/error? }`, без redirect.
- **`src/app/**/page.tsx`** — RSC, читают через service-функции, рендерят. Защита — внутри (не middleware).
- **`src/components/*.tsx`** — презентационные компоненты визуализации.
- **`src/lib/auth.ts`** — конфиг Better Auth. **`src/lib/auth-guards.ts`** — `getOptionalSession`,
  `requireUser`, `requireAdmin`. **`src/lib/db.ts`** — singleton PrismaClient.

## 5. Модель данных — 9 моделей (выверено по schema.prisma)

**Auth (генерируются Better Auth):** `User`, `Session`, `Account`, `Verification`.
**Домен playoff/пары:** `Tournament`, `Pair`, `Match`, `SetScore`.
**Домен round-based (round_robin/americano/mexicano):** `TournamentPlayer`, `Round`, `RoundMatch`, `PlayerMatchScore`.

Ключевые факты:
- Пароль — в `Account.password` (scrypt, Better Auth). У `User` НЕТ колонки пароля.
- `User` домен-поля: `role` ("player"|"admin"), `courtSide` ("left"|"right"|"either", дефолт "either",
  НЕ собирается при регистрации), `nickname` (обязателен, `@@unique`, регистрозависимый exact-match),
  `phone?`, `skillLevel` (обязателен: beginner|progressing|intermediate|advanced|pro), `birthDate?`.
  `@@unique([email])`, `@@unique([nickname])`.
- `Tournament`: `size` (Int, для playoff 4/8/16), `status` ("registration"|"in_progress"|"finished"),
  `date?`, `location?`, `format`, `participantMode` ("pairs"|"singles"), `level` (один из 5), `price?` (Int,
  minor units, null=free), `scoringMode`, `targetPoints?`/`setsPerMatch`/`gamesPerSet`/`totalRounds?`
  (последние — legacy/частично не читаются после free-form). Связи: `pairs`, `matches`,
  `tournamentPlayers`, `rounds`.
- `Pair`: `tournamentId`, `player1Id` (регистрирующий), `player2Id` (партнёр), `seed?` (заполняется при
  генерации сетки 1..size). `@@unique([tournamentId, player1Id])`, `@@unique([tournamentId, player2Id])`.
  onDelete Cascade с турниром; FK на User — НЕ cascade.
- `Match`: узел дерева single-elimination. `round`, `position`, `pairAId?`, `pairBId?`, `winnerId?`,
  `setsWonA?`, `setsWonB?`, `setScores[]`, `nextMatchId?` + `nextSlot?` ("A"|"B") — указатель
  продвижения (self-relation "Bracket"). Финал: nextMatchId/nextSlot = null.
  `@@unique([tournamentId, round, position])` — backstop против двойного «Старта».
- `SetScore`: одна строка на сет. `matchId`, `setNumber`, `gamesPair1`, `gamesPair2`.
  `@@unique([matchId, setNumber])`. На каждую (пере)запись результата строки delete+recreate.
- `TournamentPlayer`: одиночная регистрация. `tournamentId`, `userId`. `@@unique([tournamentId, userId])`.
- `Round`: контейнер раунда. `roundNumber`, `status` ("pending"|"in_progress"|"finished"), `matches[]`.
  `@@unique([tournamentId, roundNumber])`. Mexicano материализует раунды по одному.
- `RoundMatch`: матч на корте. `courtNumber`, 4 nullable FK на User: `teamA1/teamA2/teamB1/teamB2`
  (singles 1v1 — только A1/B1; pairs round_robin переиспользует слоты A1+A2 vs B1+B2), `pointsA?`,
  `pointsB?` (points-режим), `playerScores[]`.
- `PlayerMatchScore`: индивидуальные очки. `roundMatchId`, `userId`, `teamSlot` ("A"|"B"),
  `pointsFor`, `pointsAgainst` (оба обязательны — тай-брейк + детерминизм мексикано).
  Оба партнёра получают ОДИНАКОВЫЙ командный `pointsFor`. `@@unique([roundMatchId, userId])`.
- Enum-ов Prisma нет (SQLite) → все «перечисления» хранятся как String, валидируются zod-union/TS-union.

## 6. Сервисы и их функции (выверено)

- `tournament.ts`: `createTournament`, `listTournaments`, `getTournament`.
- `bracket.ts`: `advance` (чистая математика дерева), `matchCount(size)=size-1`, `generateBracket`
  (создаёт все size-1 матчей, wired nextMatchId/nextSlot, Fisher–Yates посев), `listBracket`. `BracketError`.
- `round-robin.ts`: `circleMethodSchedule<T>` (круговой метод, фикс. позиция + ротация), `generateRoundRobin`. `FormatError`.
- `americano.ts`: `americanoSchedule<T>` (circle method НА ИГРОКАХ → гарантия «партнёр-once» за N-1 раундов;
  корт k = партнёрство (2k)vs(2k+1); sit-outs: N≡0mod4→0, нечёт→1, N≡2mod4→2), `generateAmericano`. `FormatError`.
- `mexicano.ts`: `quadCut`, `crossPairQuad` (выбрано «1+4 vs 2+3»), `round1Cut`, `crossPairCut`,
  `generateMexicanoRound1`, `materializeNextMexicanoRound` (следующий раунд по текущему рейтингу;
  на последнем раунде НЕ материализует — финиширует). `FormatError` ("round_incomplete" — gate).
- `rounds.ts`: `listRounds`, `listTournamentPlayers` (read, типы через Prisma payload inference).
- `result.ts` (playoff scoring): `setWinner(gamesA,gamesB)` (больше геймов; равно→null=ничья сета),
  `matchWinnerFromSets(sets)` (больше выигранных сетов; тай по сумме геймов; равно→null=ничья),
  `tallySetsWon`, `recordResult` (любое число сетов, на ничьей → `ResultError("draw", "Ничья недопустима
  в playoff — введите решающий счёт")`, без продвижения/финиша; SetScore delete+recreate). `ResultError`.
- `round-result.ts` (round-based scoring): `scorePointsMode(a,b)` (больше очков; равно→ничья, БЕЗ target),
  `scoreSetsMode(sets)` (free-form), `recordRoundResult` (ничья допустима всем round-based форматам;
  PlayerMatchScore fan-out deleteMany→create; финиш round_robin/americano авто при полноте;
  mexicano материализует следующий раунд или финиширует на последнем). `RoundResultError`.
- `standings.ts`: `rankPlayers` (сортировка-копия), `computeStandings` — DERIVED (пересчёт каждый вызов,
  не материализуется). Возвращает union по `kind`: `"players"` (americano/mexicano: из PlayerMatchScore,
  ключ sumFor desc→pointDiff→wins→userId asc) | `"units"` (round_robin: из RoundMatch, matchWins→
  pointDiff→pointsFor→unitId asc). Pairs-RR: идентичность пары — по (tournamentId, player1Id).
- `tournament-status.ts`: `isAllowedTransition(from,to)`, `transitionTournament` (проверяет заявленный `from`).
- `admin.ts`: `removePair`, `removeParticipant`, `finishTournament` (ручной финиш, все форматы). `AdminError`.
- `registration.ts`: `findUserIdByNickname`, `registerPair` (транзакция, capacity-close), `registerSingle`
  (capacity = count TournamentPlayer vs size), `listTournamentPairs`. `RegistrationError`.
- `format-engine.ts`: `startFormat` (диспетчер генерации по format), `recordFormatResult` (диспетчер записи).
- `profile.ts`: `getProfile`, `updateProfile`.

## 7. Server Actions — write-API (выверено)

- `admin/tournaments/actions.ts`: `createTournamentAction`.
- `profile/actions.ts`: `updateProfileAction` (email/nickname — через Better Auth, не прямой update).
- `tournaments/[id]/actions.ts`: `participateAction` (пара), `participateSingleAction` (одиночка),
  `startTournamentAction`, `removeRegistrationAction`, `finishTournamentAction`, `recordResultAction`.
- `admin/actions.ts`: `adminPing` (служебный).
- `api/auth/[...all]/route.ts` — Better Auth handler (единственный route-handler).

Все actions: guard → parse → service → `revalidatePath`. Без redirect. Сырой текст Prisma наружу не уходит.

## 8. Карта маршрутов / страниц (выверено по дереву app/)

| Маршрут | Группа | Доступ | Назначение |
|---------|--------|--------|------------|
| `/` | (root) | публ. | Главная: открытые турниры (HOME-01) |
| `/login` | (auth) | публ. | Вход |
| `/register` | (auth) | публ. | Регистрация игрока |
| `/tournaments` | (public) | публ. | Список турниров |
| `/tournaments/[id]` | (public) | публ. (формы — по роли/статусу) | Детальная страница турнира — ЕДИНЫЙ RSC-хаб |
| `/dashboard` | (app) | игрок+ | Кабинет/обзор |
| `/profile` | (app) | игрок+ | Личный кабинет (правка профиля) |
| `/admin` | (app) | admin | Админ-панель |
| `/admin/tournaments/new` | (app) | admin | Форма создания турнира |
| `/api/auth/[...all]` | api | — | Better Auth |

`layout.tsx` (корневой) — тёмная тема, шапка `nav.tsx` с ЛК (HDR-01).

## 9. Детальная страница `/tournaments/[id]` — единый хаб (выверено)

Ветвление: `isAdmin = role==="admin"`; `isPairsMode = participantMode==="pairs"`;
`isPlayoff = format==="playoff"`; `readOnly = !isAdmin || status==="finished"` (VIS-02).
- Шапка турнира: формат/режим/уровень/цена/дата/место/статус-бейдж.
- Список участников: пары (`listTournamentPairs`) ИЛИ одиночки (`listTournamentPlayers`).
- Запись: `participate-form` (пара по нику) / одиночка — только в статусе registration.
- Админ-кнопки: удалить регистрацию (registration), «Старт» (registration→in_progress),
  «Завершить» (in_progress, все форматы).
- Визуализация по формату: `bracket-view` (playoff) / `round-robin-view` (round_robin, standings kind=units) /
  `rotation-view` (americano/mexicano, standings kind=players).
- Ввод результата (admin + in_progress): playoff → `score-form` по матчам; round-based → `round-score-form`.
  Режим ввода зависит от `scoringMode`.

## 10. Компоненты визуализации (выверено)

- `bracket-view.tsx` — дерево playoff (колонки раундов).
- `round-robin-view.tsx` — таблица + матчи кругового.
- `rotation-view.tsx` — раунды/корты + рейтинг игроков (американо/мексикано).
- `tournament-status-badge.tsx`, `nav.tsx`, `logout-button.tsx`.

## 11. Безопасность (выверено)

- Auth: Better Auth, email+password, `admin()` plugin (`defaultRole:"player"`, `adminRoles:["admin"]`),
  `nextCookies()` последним плагином. additionalFields: phone/skillLevel/nickname/birthDate.
  changeEmail: enabled + updateEmailWithoutVerification (работает т.к. verification off).
- Guards: `getOptionalSession` (опц.), `requireUser` (редирект на login), `requireAdmin` (403/редирект).
  Авторизация — на границе Server Action и в RSC, НЕ в middleware (footgun edge/node).
- Админ — единственный, seed-аккаунт из env (идемпотентно, `prisma/seed.ts`), промоут роли скриптом.
- Типизированные ошибки сервисов: наружу — только безопасные RU-сообщения по `code`, без сырого Prisma.

## 12. Карта документов `docs/` (что в каком файле — для кросс-ссылок)

- `README.md` — индекс/навигатор + соответствие главе 2.
- `01-naznachenie-i-trebovaniya.md` — назначение, акторы, ФТ/НФТ, ограничения, scope.
- `02-glossariy.md` — глоссарий предметной области и системы.
- `03-arhitektura.md` — стек, App Router, слои, компоненты, потоки данных, структура каталогов.
- `04-model-dannyh.md` — ER-диаграмма, все модели/поля/связи/ограничения, нормализация.
- `05-formaty-i-algoritmy.md` — 4 формата и их алгоритмы (генерация, ротация, продвижение).
- `06-podschyot-i-standings.md` — режимы подсчёта, вычисление победителя, рейтинги, тай-брейкеры.
- `07-stsenarii-ispolzovaniya.md` — use-case + sequence-диаграммы основных сценариев.
- `08-mashiny-sostoyaniy.md` — жизненные циклы (турнир, раунд, матч), переходы.
- `09-polzovatelskiy-interfeys.md` — карта сайта, страницы, навигация, формы, визуализация, тема/адаптив.
- `10-autentifikatsiya-i-bezopasnost.md` — Better Auth, роли, guards, модель угроз.
- `11-servernye-deystviya-i-validatsiya.md` — server actions, zod-схемы, модель ошибок.

## 13. Дополнительные источники в репозитории (можно опираться, но ПРОВЕРЯТЬ по коду)

- `.planning/research/FORMATS.md` — глубокий ресёрч форматов (алгоритмы, тай-брейкеры).
- `.planning/research/ARCHITECTURE.md` — паттерны, потоки, anti-patterns, route map.
- `.planning/research/AUTH.md`, `STACK.md`, `PITFALLS.md`, `FEATURES.md`.
- `.planning/PROJECT.md`, `.planning/STATE.md` — требования, решения, текущее состояние.
- ⚠ Research-доки местами предшествуют финальному коду (особенно scoring: было «target/фикс. сеты»,
  стало free-form). При расхождении — ПРИОРИТЕТ у актуального кода и у раздела 2/5 этого брифа.
