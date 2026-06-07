# Phase 11: UX турниров (формы, ввод счёта, визуализация) - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — проводка бэкенда Фаз 8–9 в UI по требованиям 3.4/3.5/3.6/3.7/2.1/2.3; per [[padel-autonomous-no-questions]] без вопросов.

<domain>
## Phase Boundary

Слой 3 (фронтенд/UX), часть 2 из 2 — ФИНАЛ милстоуна. Полный пользовательский путь по турнирам: админ создаёт турнир со всеми полями и режимом подсчёта; игрок регистрируется (одиночно/парой по виду) с уровнем и ДР; админ вводит результаты по режиму и управляет турниром; все видят визуализацию активного турнира по формату и историю прошедших.

**В scope (FORM-01, FORM-02, FORM-03, SCORE-02, VIS-01, VIS-02):** формы (создание/регистрация-аккаунта/ЛК), UI участия одиночно/парой, админ-контролы (удаление/завершение), ввод результата по режиму, per-format визуализация, прошедшие турниры. + тонкие read-хелперы для round-based данных.
**НЕ в scope:** новая бизнес-логика/движки (готовы в Фазах 8–9 — только вызываем). Фундамент (тема/локализация/главная/шапка) — Фаза 10 (готов).
</domain>

<decisions>
## Implementation Decisions

### Форма создания турнира (FORM-01 + SCORE-02)
- `src/app/(app)/admin/tournaments/new/create-tournament-form.tsx`: добавить поля под расширенный `createTournamentSchema` (Фаза 8): `format` select (formatLabels), `participantMode` toggle/select (tournamentKindLabels) — но для americano/mexicano принудительно singles (disabled/авто), `level` select (skillLevelLabels), кол-во участников (для playoff — select 4/8/16; для прочих — number input), `price` (number, ₽), `scoringMode` select (sets/points). Условные поля (SCORE-02): sets → `setsPerMatch`/`gamesPerSet` number inputs БЕЗ верхнего предела; points → `targetPoints` number; americano/mexicano → `totalRounds` number. Клиентская динамика показа полей по выбранному format/scoringMode. Wire к существующему `createTournamentAction` (уже принимает поля).

### UI участия (FORM-02 часть б)
- `participate-form.tsx` + страница детали: ветвить по `tournament.participantMode`:
  - `pairs` (playoff/round_robin): существующая форма ника партнёра → `participateAction`.
  - `singles` (все форматы, обязательно americano/mexicano): кнопка «Участвовать» → новый `participateSingleAction` (Фаза 8).
  - Показ ошибок RU (level_mismatch → «Ваш уровень не совпадает с уровнем турнира», wrong_mode, tournament_full, и т.д.).
- Отрисовать зарегистрированных: пары (как сейчас) + одиночные участники (TournamentPlayer) для singles-турниров.

### Регистрация аккаунта (FORM-02 часть а)
- `src/app/(auth)/register/register-form.tsx`: уровень игры — ОБЯЗАТЕЛЬНЫЙ select (5 RU через skillLevelLabels; убрать дефолт-проскок «beginner» — пользователь выбирает явно, плейсхолдер «Выберите уровень»); добавить поле дата рождения (опц., date input) → провести через signup additionalFields (`birthDate`). Закрывает carry-forward Phase 7 WR-01/IN-01. (Если для signup `birthDate` нужен в auth.ts additionalFields — добавить как input-поле.)

### ЛК-форма (FORM-03 часть а)
- `src/app/(app)/profile/profile-form.tsx`: расширить до всех полей `updateProfileAction` (Фаза 8): ФИО (name), уровень (select), телефон, дата рождения (date), сторона корта (courtSideLabels), никнейм (с показом ошибки занятости), email (с показом ошибки занятости). RU-лейблы.

### Админ-контролы (FORM-03 часть б)
- Страница детали турнира `[id]/page.tsx`: для админа на этапе `registration` — кнопка удаления у каждой пары/участника → `removeRegistrationAction` (kind+id); на этапе `in_progress` — кнопка «Завершить турнир» → `finishTournamentAction`. RU, подтверждение опц.

### Ввод результата по режиму (SCORE-02 часть б)
- `score-form.tsx` (или новый round-score-form): ветвить по `tournament.format` + `scoringMode`:
  - playoff → существующий теннисный ввод по сетам (recordResultAction) — не ломать.
  - round-based: для матча раунда (RoundMatch) — sets-режим → N строк счёта (number a/b), points-режим → два поля очков (a/b). Submit → `recordResultAction` (диспетчер Фазы 9 уже ветвит на recordRoundResult). Идентификатор — roundMatchId.

### Визуализация по формату (VIS-01)
- Страница детали: рендер по `tournament.format`:
  - playoff → существующий `BracketView` (read через listBracket) — не ломать.
  - round_robin → таблица матчей (раунды × корты) + турнирная таблица (computeStandings — unit table).
  - americano/mexicano → раунды (текущий + прошедшие) + рейтинг игроков (computeStandings — player rating).
  - Панели «Текущие игры» (несыгранные матчи текущего/активного раунда) и «Прошедшие игры» (записанные).
- Тонкие read-хелперы (server, read-only): `listRounds`/`listRoundMatches` + использование `computeStandings` (Фаза 9). Это ЧТЕНИЕ, не движок.

### Прошедшие турниры (VIS-02)
- `/tournaments?status=finished` (фильтр готов в Фазе 10) → список завершённых; на странице детали завершённого турнира — история матчей по формату (та же per-format визуализация в режиме «только просмотр», без контролов ввода). Опц. отдельная страница `/tournaments/past` — но достаточно фильтра + детали.

### Claude's Discretion
- Точная компоновка форм/таблиц/панелей, client-динамика условных полей, мобильная адаптация, формулировки RU, нужен ли отдельный round-score-form vs расширение score-form, нужны ли отдельные read-функции vs inline-запросы — на усмотрение исполнителя (Tailwind 4, Server Components + client leaves для форм, без UI-kit).
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/(public)/tournaments/[id]/page.tsx` — детали турнира (метаданные, список пар, BracketView, админ-блоки start/score). Расширить per-format + админ-контролы.
- `src/components/bracket-view.tsx` — playoff-сетка (RU колонки). Не трогать playoff; добавить новые view-компоненты для RR/americano/mexicano.
- `participate-form.tsx`, `score-form.tsx`, `start-tournament-form.tsx` — образцы client-форм + bind tournamentId.
- `[id]/actions.ts` — participateAction, participateSingleAction, removeRegistrationAction, finishTournamentAction, recordResultAction (диспетчер по format), startTournamentAction — ВСЕ готовы (Фазы 8–9). UI их вызывает.
- `create-tournament-form.tsx` (admin/tournaments/new) — расширить.
- `register-form.tsx`, `profile-form.tsx` — расширить.
- `src/lib/services/standings.ts` (computeStandings), `tournament.ts` (listTournaments+filter, listBracket) — читать для визуализации; добавить listRounds/listRoundMatches при необходимости.
- Label-maps (Фаза 10): formatLabels/tournamentKindLabels/skillLevelLabels/courtSideLabels (validation/auth.ts, profile.ts).

### Established Patterns
- Server Component страница + 'use client' form-leaves; action bind tournamentId; typed {ok}/{error} RU mapping; revalidatePath.
- Tailwind 4, тёмная тема (Фаза 10), без UI-kit. Чтение — Server Components/сервисы.
- Тесты: сервисы покрыты tsx; UI — next build + tsc + ручная UAT (human-verify в конце).

### Integration Points
- Бэкенд полностью готов: создание (format-поля), participate single/pair, remove, finish, profile (все поля), recordResult dispatch, computeStandings. Фаза 11 = презентация + вызовы.
- birthDate на signup: проверить, проведён ли через additionalFields в auth.ts (если нет — добавить input-поле, как phone/skillLevel).
- Завершает carry-forward: Phase 7 WR-01/IN-01 (register required level) здесь закрываются.
</code_context>

<specifics>
## Specific Ideas
- Не ломать playoff UI/флоу (BracketView, теннисный score-form) — добавлять рядом, ветвить по format.
- Per-format view-компоненты: RoundRobinView (таблица + standings), RotationView (раунды + рейтинг) для americano/mexicano. Read-only режим для завершённых.
- Минимум новых read-функций; переиспользовать computeStandings/listBracket.
- Финальная проверка фазы и милстоуна: next build + tsc + полный прогон сервис-тестов зелёные; визуальная/функциональная UAT — список для пользователя (human-verify).
</specifics>

<deferred>
## Deferred Ideas
- Реальный realtime (websockets) — вне scope (revalidate достаточно, PROJECT out-of-scope).
- Брендинг/настоящий логотип клуба — placeholder (Фаза 10).
- Накопленные human-verify визуальные пункты Фазы 10 — закрыть в финальной UAT вместе с Фазой 11.
</deferred>
