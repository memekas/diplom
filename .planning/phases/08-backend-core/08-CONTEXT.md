# Phase 8: Ядро бэкенда (создание, регистрация, админ, ЛК) - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — решения выведены из `.planning/research/FORMATS.md` (D1–D7) + locked-решений ROADMAP + существующих паттернов кода; per [[padel-autonomous-no-questions]] без переспрашивания.

<domain>
## Phase Boundary

Слой 2 (бэкенд), часть 1 из 2. Server Actions + сервисы + Zod-валидация для: создания турнира любого формата (format-зависимая валидация размера), регистрации одиночно/парой ТОЛЬКО своего уровня, админ-удаления регистраций, ручного завершения турнира, и правки всех полей профиля (включая ник и email).

**В scope (TOUR-05, REG-05, REG-06, ADMN-01, ADMN-02, USR-03):** валидация + сервисы + actions + authz-гварды.
**НЕ в scope:** генерация сетки/расписания/ротации и ввод результатов по форматам — Фаза 9 (FMT-01..03, SCORE-01). Любой UI/формы — Фазы 10–11. Эта фаза готовит данные и правила, на которых Фаза 9 строит движки.
</domain>

<decisions>
## Implementation Decisions

### Создание турнира (TOUR-05)
- Расширить `createTournamentSchema` (`src/lib/validation/tournament.ts`) новыми полями: `format` (playoff|round_robin|americano|mexicano), `participantMode` (pairs|singles), `level` (одно из 5 латинских уровней — переиспользовать `skillLevels` из validation/auth.ts), `price` (число ≥0, опц./0=бесплатно — отображение), `scoringMode` (sets|points), `targetPoints` (Int>0, для points; дефолт 24 применяется сервером), `totalRounds` (Int>0, для americano/mexicano), `setsPerMatch`/`gamesPerSet` (для sets; настраиваемые, БЕЗ верхнего лимита — нижняя граница ≥1).
- **Format-зависимая валидация размера/режима** (zod superRefine или сервисная):
  - playoff: size ∈ {4,8,16} (как сейчас); participantMode = pairs ИЛИ singles (по выбору админа).
  - round_robin: size = свободное число участников, ≥3 (рекоменд. cap ≤24 — матчей N(N-1)/2); pairs ИЛИ singles.
  - americano: size ≥4, participantMode ПРИНУДИТЕЛЬНО singles (D1).
  - mexicano: size ≥8, participantMode ПРИНУДИТЕЛЬНО singles (D1).
- `createTournament` (services/tournament.ts) пишет новые поля; `status='registration'` остаётся серверным. Бизнес-семантика «size» для не-playoff = число участников (игроков для singles, пар для pairs).

### Регистрация по уровню (REG-05)
- Строгое равенство (D2): для регистрации `player.skillLevel === tournament.level`. Для ПАРЫ — ОБА игрока (player1 и player2) должны совпадать с уровнем турнира, иначе отклонить с понятной RU-ошибкой (новый код ошибки, напр. `level_mismatch` → «Уровень игрока не совпадает с уровнем турнира»).
- Проверка добавляется ВНУТРИ существующей транзакции `registerPair` (не нарушая текущую целостность/лимит) и в новый `registerSingle`.

### Одиночная регистрация (REG-06)
- Новый путь `registerSingle` (сервис + action `participateSingleAction`): пишет `TournamentPlayer` (модель из Фазы 7) внутри транзакции с проверками статуса/уровня/лимита/дубля (аналог `registerPair`). Лимит для singles считается по `TournamentPlayer` count vs size.
- Парный путь (`registerPair`/`participateAction` по нику партнёра) остаётся для playoff/round_robin с participantMode=pairs.
- americano/mexicano → только singles (UI-выбор пути — Фаза 11; бэкенд: action для singles + отклонять парную регистрацию на singles-турнир и наоборот по `tournament.participantMode`).

### Админ-действия (ADMN-01, ADMN-02)
- **Удаление регистрации** (ADMN-01): новый `removeRegistrationAction` (requireAdmin) — удаляет `Pair` ИЛИ `TournamentPlayer` по id, ТОЛЬКО при `status='registration'`; `revalidatePath`. Сервис `removePair`/`removeParticipant`.
- **Ручное завершение** (ADMN-02): новый `finishTournamentAction` (requireAdmin) — переход `in_progress→finished` через существующий `transitionTournament` (forward-only машина не меняется). Для playoff авто-финиш на финале сохраняется; ручной — дополнительный (идемпотентно: если уже finished — no-op). Для round-robin/americano/mexicano ручной финиш — основной путь («финала» нет).

### ЛК — правка всех полей (USR-03)
- Расширить `profileSchema` (`src/lib/validation/profile.ts`) + `updateProfile` (services/profile.ts) + `updateProfileAction`: править `name` (ФИО), `skillLevel` (5 уровней, теперь обязателен), `phone`, `birthDate`, `courtSide` (остаётся), `nickname` (с проверкой уникальности — маппинг конфликта на RU-ошибку, как при регистрации), `email` (через флоу смены email Better Auth — `authClient.changeEmail`/`auth.api`; email-верификация ВЫКЛючена, разобраться в API в research).
- Идентичность всегда из `requireUser()` (никогда из формы). Ник/email — уникальные, конфликт → понятная ошибка, не падение.

### Авторизация
- Все админ-мутации (create/remove/finish) открываются `requireAdmin()` первой строкой (как существующие). Регистрация/профиль — `requireUser()`. Роль не из клиента.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/services/registration.ts` — `registerPair` (транзакция: статус/self/лимит/дубль, partner-by-nick lookup `findUserIdByNickname`). Образец для `registerSingle` + level-check.
- `src/lib/services/tournament.ts` — `createTournament`, `listTournaments`. Расширить createTournament.
- `src/lib/services/tournament-status.ts` — `ALLOWED_TRANSITIONS`, `transitionTournament` (DB source of truth, forward-only). Переиспользовать для finish.
- `src/lib/services/result.ts` — содержит авто-финиш playoff на финале (не трогать логику playoff, но finish-action сосуществует).
- `src/lib/services/profile.ts` + `validation/profile.ts` — текущая правка courtSide/phone/skillLevel. Расширить.
- `src/lib/validation/tournament.ts` — `tournamentSizes=[4,8,16]`, `createTournamentSchema`. Расширить format-зависимо.
- `src/lib/validation/auth.ts` — `skillLevels` (5 значений, Фаза 7), переиспользовать для level/skill.
- `src/lib/auth-guards.ts` — `requireUser`/`requireAdmin`.
- `src/app/(public)/tournaments/[id]/actions.ts` — `participateAction`, `startTournamentAction`, `recordResultAction` (образцы action + RU error mapping + revalidatePath).
- `src/lib/auth.ts` / `src/lib/auth-client.ts` — Better Auth (для email-change API в USR-03).

### Established Patterns
- Server Action: requireUser/requireAdmin первой строкой → zod parse → сервис в `$transaction` → revalidatePath → типизированный {ok}/{ok:false,error} с RU-сообщением. tournamentId через `.bind()`, не из формы.
- Ошибки: класс `RegistrationError`/`ResultError` с code → маппинг на RU-строку в action.
- Уникальность (ник): полагаться на `@@unique` + ловить конфликт, не pre-check.
- Транзакционная целостность регистрации (count+insert в одной $transaction).

### Integration Points
- Новые поля Tournament/модели (TournamentPlayer) из Фазы 7 уже в схеме/клиенте.
- Фаза 9 (движки) будет читать `format`/`scoringMode`/`participantMode`/`targetPoints`/`totalRounds` + участников (Pair/TournamentPlayer) для генерации.
- Эти сервисы/actions вызываются из UI Фаз 10–11; здесь — только серверная логика + (при необходимости) минимальные точки вызова, без вёрстки.
</code_context>

<specifics>
## Specific Ideas
- Не ломать существующие playoff-флоу (registerPair pairs, start, recordResult, авто-финиш) — расширять аддитивно, гонять существующие тесты как инвариант.
- Юнит-тесты в стиле существующих (`*.test.ts` для registration/tournament/tournament-status) на новые правила: format-валидация размера, level-mismatch, singles-регистрация, remove, finish.
- Carry-forward из Phase 7 review (адресовать в своих слоях, не здесь): WR-01/IN-01 (register-form required level) — Фаза 11 (FORM-02); WR-02 (RoundMatch court @@unique) — Фаза 9.
</specifics>

<deferred>
## Deferred Ideas
- Генерация round-robin/американо/мексикано, ротация, ввод результатов и standings — Фаза 9.
- UI форм создания/регистрации/ЛК, выбор singles/pairs в интерфейсе — Фаза 11.
- Локализация/тема/адаптив/главная/шапка — Фаза 10.
</deferred>
