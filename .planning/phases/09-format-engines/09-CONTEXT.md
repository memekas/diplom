# Phase 9: Движки форматов и подсчёта - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — алгоритмы и решения из `.planning/research/FORMATS.md` (§1–3 пошаговые алгоритмы, §5 backend-интеграция, §6 D1–D7); per [[padel-autonomous-no-questions]] без переспрашивания.

<domain>
## Phase Boundary

Слой 2 (бэкенд), часть 2 из 2 — ДВИЖКИ форматов. При старте/продвижении каждый формат генерирует и обновляет свою структуру; ввод результата ветвится по режиму подсчёта (sets/points) с корректным вычислением победителя и индивидуальных/командных очков.

**В scope (FMT-01, FMT-02, FMT-03, SCORE-01):** генерация round-robin, генерация+ротация американо/мексикано, индивидуальные очки/standings, ввод результата по режиму, материализация следующего раунда (мексикано), условие завершения round-based. Сервисы + тесты (без UI).
**НЕ в scope:** UI/визуализация (Фаза 11), локализация/тема (Фаза 10). Playoff-движок (generateBracket/recordResult) — УЖЕ готов, его НЕ переписывать.
</domain>

<decisions>
## Implementation Decisions

### Старт турнира — format-dispatch
- Обобщить точку старта (`startTournamentAction`/сервис) по `tournament.format`:
  - `playoff` → существующий `generateBracket` (НЕ трогать).
  - `round_robin` → новый `generateRoundRobin`: circle-method (FORMATS.md §1) на units (units = Pair для participantMode=pairs, TournamentPlayer для singles). Сгенерировать ВСЕ Round + RoundMatch сразу (stateless), single round-robin (D5). Нечётное N → BYE (sit-out, матч не создаётся). Перемешать units один раз (как shuffle в bracket.ts).
  - `americano` → новый `generateAmericano`: circle-method на ИГРОКАХ (FORMATS.md §2), партнёр-once, ВСЕ раунды сразу; teamA1/teamA2 = партнёрство, vs teamB1/teamB2; courtNumber = индекс корта. sit-outs по чётности/кратности 4.
  - `mexicano` → новый `generateMexicanoRound1`: раунд 1 случайный (shuffle → четвёрки → A=(p0,p1),B=(p2,p3)); последующие раунды НЕ генерятся на старте.
- Все генераторы — в одной транзакции, как generateBracket; статус registration→in_progress через `transitionTournament`; generate-once (не пересоздавать при существующих Round/RoundMatch).

### Ротация (FORMATS.md §2–3)
- americano: фиксированное расписание (circle-method), от результатов не зависит.
- mexicano: после полного завершения раунда r пересчитать кумулятивную таблицу, отсортировать игроков (детерминированный тай-брейк — см. standings), нарезать на последовательные четвёрки по рейтингу, внутри четвёрки кросс-разведение по паттерну **«1+4 vs 2+3»** (locked: A=(s0,s3), B=(s1,s2) — ровные команды 5=5; зафиксировано в коде/доке) → создать Round r+1 + его RoundMatch.

### Ввод результата — mode-dispatch (SCORE-01)
- Обобщить точку ввода (`recordResultAction`) по `tournament.format`:
  - playoff → существующий `recordResult` (теннисные сеты, продвижение, авто-финиш на финале) — НЕ трогать.
  - round-based (rr/americano/mexicano) → новый `recordRoundResult` (НЕ переиспользовать recordResult: его шаг авто-финиша по nextMatchId=null сломал бы round-based — см. FORMATS.md §5). Без playoff-advancement.
- Ветвление по `scoringMode`:
  - `points`: результат = два целых на RoundMatch (`pointsA`/`pointsB`, поля из Фазы 7), без верхнего лимита; победитель = больше очков; для americano/мексикано опц. проверка суммы == `targetPoints`; равные очки в round_robin запрещены (D2-аналог для очков — валидация), для americano/mexicano ничья допустима (12:12).
  - `sets`: произвольное число сетов/геймов без лимита; правило победы сета обобщено под настраиваемый `gamesPerSet` (win-by-2 при gamesPerSet, тай-брейк gamesPerSet+1 : gamesPerSet-1). Победитель матча = большинство сетов.
- **Хранение sets-результата для round-based:** сначала проверить фактические поля `RoundMatch` (из Фазы 7). Если их хватает (setsWonA/B/games) — использовать. Если нет — для round-based в sets-режиме хранить АГРЕГАТ (setsWonA/setsWonB + опц. gamesA/gamesB) на RoundMatch; гранулярная per-set детализация для round-based НЕ требуется (только playoff её имеет). Если нужно минимальное доп. поле на RoundMatch — допустима МИНИМАЛЬНАЯ аддитивная миграция в этой фазе (флагнуть как deviation), т.к. americano/мексикано points-каноничны (D3) и пробел касается в основном round_robin+sets. НЕ ломать playoff SetScore.

### Индивидуальные очки и standings (FMT-02/03)
- После записи результата RoundMatch писать `PlayerMatchScore` для каждого из участников: оба партнёра команды получают ОДНО командное число `pointsFor` (для points = очки пары; для sets = выигранные геймы пары или сеты — выбрать ОДНУ метрику вклада для sets-режима round-based и задокументировать), `pointsAgainst` = очки соперника.
- Сервис `computeStandings(tournamentId)`:
  - americano/mexicano: рейтинг ИГРОКОВ = сумма личных очков по раундам, desc; тай-брейк: сумма → point diff (pointsFor−pointsAgainst) → число побед → стабильный фолбэк по userId/нику (детерминированно — критично для mexicano-нарезки).
  - round_robin: таблица единиц (пара/игрок) — победы в матчах → (sets: set diff → game diff; points: point diff → total) → личная встреча → id (FORMATS.md §1 тай-брейкеры).
- Standings ВЫЧИСЛЯЕТСЯ из RoundMatch/PlayerMatchScore (не хранится материализованно); для game/set-тай-брейка грузить связанные данные.

### Завершение round-based (FMT-03)
- round_robin/americano: когда у ВСЕХ RoundMatch всех раундов есть результат → авто-переход in_progress→finished (через transitionTournament), аналог playoff авто-финиша. Ручной `finishTournament` (Фаза 8) тоже доступен (досрочно).
- mexicano: следующий раунд материализуется только когда ВСЕ RoundMatch текущего раунда записаны (gate); после последнего раунда (roundNumber == totalRounds) → finished. Ручной финиш доступен.

### Carry-forward из ревью Фазы 7/8
- WR-02 (Phase 7 review): добавить `@@unique([roundId, courtNumber])` на RoundMatch если требуется детерминизм — оценить в этой фазе (миграция минимальна); НЕ обязательно если генерация гарантирует уникальность.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/services/bracket.ts` — `generateBracket` (transaction, shuffle Fisher–Yates, generate-once, transitionTournament). Образец для generateRoundRobin/Americano.
- `src/lib/services/result.ts` — `recordResult`, `setWinner` (win-by-2/7:5/7:6), `matchWinnerFromSets`. ПЕРЕИСПОЛЬЗОВАТЬ setWinner/matchWinnerFromSets-логику для sets-режима (обобщить под gamesPerSet), но НЕ ломать playoff-путь. Авто-финиш playoff здесь — не трогать.
- `src/lib/services/tournament-status.ts` — transitionTournament (forward-only, DB source of truth).
- Phase 7 models: `Round`, `RoundMatch` (teamA1/A2/B1/B2 User FK, courtNumber, pointsA/pointsB), `PlayerMatchScore` (pointsFor/pointsAgainst, teamSlot), `TournamentPlayer`. Клиент уже сгенерирован.
- Phase 8: `tournament.format/participantMode/scoringMode/targetPoints/totalRounds`, registerSingle/registerPair (участники готовы), finishTournament.
- `src/app/(public)/tournaments/[id]/actions.ts` — startTournamentAction, recordResultAction (точки dispatch).

### Established Patterns
- Генерация в одной $transaction, generate-once (existing-rows guard), shuffle один раз.
- Тесты: self-contained `*.test.ts` через `npx tsx`, fake-prisma; 224 assertions baseline (8 скриптов) — инвариант.
- transitionTournament — единственный путь смены статуса.

### Integration Points
- Точные алгоритмы (пошагово) — `.planning/research/FORMATS.md` §1 (round-robin circle method), §2 (americano), §3 (mexicano нарезка/кросс-разведение). ОБЯЗАТЕЛЬНО планнеру/исполнителю.
- Standings/recordRoundResult будут вызываться из UI визуализации Фазы 11.
- Старт/ввод результата dispatch'атся из существующих actions — добавить ветки по format, не ломая playoff.
</code_context>

<specifics>
## Specific Ideas
- Инвариант: все существующие тесты (playoff bracket/result + phase-8) остаются зелёными. Новые тесты на: circle-method round-robin (каждый-с-каждым, нечётное N bye), americano партнёр-once, mexicano нарезка 1+4vs2+3 + детерминизм тай-брейка, recordRoundResult points/sets, standings, авто-финиш round-based, mexicano gate материализации след. раунда.
- recordRoundResult ОТДЕЛЕН от playoff recordResult — общий код (setWinner) выносить аккуратно, без регрессии playoff.
- Минимизировать миграции: предпочесть поля, уже добавленные в Фазе 7; доп. поле — только если sets-режим round-based реально требует, флагнуть.
</specifics>

<deferred>
## Deferred Ideas
- Визуализация (bracket/таблица RR/standings американо-мексикано, панели текущие/прошедшие игры) — Фаза 11 (VIS-01).
- UI форм ввода результата по режиму (N сет-строк vs два поля очков) — Фаза 11 (SCORE-02).
- Локализация/тема/адаптив/главная/шапка — Фаза 10.
</deferred>
