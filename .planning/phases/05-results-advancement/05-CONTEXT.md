# Phase 5: Results & Advancement - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Админ вводит счёт матча по сетам (геймы каждой пары в каждом сете); система валидирует сеты и вычисляет победителя сета и матча (теннисная модель: `setsPerMatch`/`gamesPerSet`, v1 фикс 3/6, win-by-2 или тай-брейк 7:6, матч = 2 сета из 3); победитель автоматически продвигается в следующий матч (слот A/B) в одной транзакции; когда у финала есть победитель — турнир `finished` и отображается чемпион; результат свободно правится.

Доставляет: MATCH-01, MATCH-02, MATCH-03, MATCH-04, MATCH-05.

Финальная фаза. После неё милстоун v1.0 завершён.
</domain>

<decisions>
## Implementation Decisions

### Schema (this phase) — structured scoring
- Добавить модель `SetScore { id, matchId (+onDelete Cascade), setNumber Int, gamesPair1 Int, gamesPair2 Int, @@unique([matchId, setNumber]) }`. Back-relation `Match.setScores SetScore[]`.
- Добавить на `Match`: `setsWonA Int?`, `setsWonB Int?` (кэш выигранных сетов для отображения; источник истины продвижения — `winnerId`, уже есть с Phase 4).
- `Tournament.setsPerMatch`(=3) / `gamesPerSet`(=6) уже существуют (Phase 2). Число сетов/геймов берётся ОТТУДА (MATCH-05) — UI настройки нет (v2 SCOR-01).
- [BLOCKING] `npx prisma migrate dev --name add_setscore`.

### Pure scoring functions (TDD — high-risk, test-first)
- `setWinner(gamesA, gamesB, gamesPerSet) -> "A" | "B"` (throws/invalid on недопустимый счёт сета). Валидный сет: победитель достиг `gamesPerSet` с маржой ≥2 (напр. 6:4, 6:0), ЛИБО тай-брейк `gamesPerSet+1 : gamesPerSet` (напр. 7:6). Иначе — невалидный сет (6:5 без тай-брейка, 4:4, отрицательные, оба < gamesPerSet и т.п.).
- `matchWinnerFromSets(setWins: ("A"|"B")[], setsPerMatch) -> "A" | "B" | null` — первый, кто взял `Math.ceil(setsPerMatch/2)` сетов (2 из 3 при дефолте); null если ещё не решено / счёт не даёт большинства.
- Чистые, Prisma-free, тестируются для дефолта 3/6 и кейсов: 6:4, 7:5, 7:6, 6:7, 0:6, невалидные; матч 2:0, 2:1, незавершённый, лишние сеты.

### recordResult (transactional) — MATCH-01/02/03/04
- `recordResult(prisma, matchId, sets: {gamesPair1, gamesPair2}[])` в ОДНОЙ `$transaction`:
  1. Загрузить матч + его турнир (`setsPerMatch`, `gamesPerSet`); reject если pairAId/pairBId не заполнены (нельзя вводить результат до определения соперников).
  2. Валидировать каждый сет через `setWinner` (число сетов ≤ setsPerMatch; reject пустой ввод).
  3. Подсчитать setsWonA/setsWonB; вычислить победителя матча через `matchWinnerFromSets`; reject если нет решающего победителя (недостаточно сетов / не большинство).
  4. Удалить существующие `SetScore` матча и вставить новые (свободная правка — MATCH-04); записать `setsWonA/B` + `winnerId`.
  5. Продвижение (MATCH-02): записать `winnerId` в родительский матч (`nextMatchId`) в слот `nextSlot` (A/B). При правке — перезаписать слот новым победителем.
  6. Если у матча нет `nextMatchId` (финал) и есть победитель → турнир → `finished` (MATCH-03).
- Свободная правка (MATCH-04): без ограничений на повторный ввод. Перепропагация — только в НЕПОСРЕДСТВЕННЫЙ родительский слот; если старый победитель уже прошёл дальше и сыграл, нижестоящие матчи могут остаться неконсистентными — это ПРИНЯТО (минимум ограничений, проще; out-of-scope каскадная очистка).

### Access & UI
- Ввод/правка результата — admin-only (Server Action первой строкой `requireAdmin`). Guarded.
- На странице турнира / в сетке: для матча с обоими заполненными слотами админ видит форму ввода счёта по сетам (setsPerMatch строк, в каждой — gamesPair1/gamesPair2); кнопка «Сохранить счёт». Существующий счёт показывается и доступен к правке.
- Все видят итоговый счёт матча (по сетам) и победителя в сетке; чемпион турнира отображается, когда `finished`.
- `revalidatePath` после записи (публичная сетка обновляется сразу; проверить на prod-сборке).

### Claude's Discretion
- Форма ввода: фиксированные `setsPerMatch` рядов или динамическое добавление сетов (достаточно ≤ setsPerMatch; матч может закончиться за 2 сета — пустые/лишние сеты игнорировать/валидировать). Простой подход.
- Где рендерить форму (инлайн в BracketView для админа vs отдельная секция) — на усмотрение, просто.
- Точные RU-тексты ошибок валидации сетов.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 1: db, auth-guards (requireAdmin), tsx test harness, action→service[$transaction]→revalidate pattern.
- Phase 2: tournament-status.ts transitionTournament (→ "finished"; terminal canonical "finished").
- Phase 4: src/lib/services/bracket.ts (advance/Slot, listBracket, Match model with winnerId/nextMatchId/nextSlot), src/components/bracket-view.tsx (winner-highlight hook already present, currently inert), src/app/(public)/tournaments/[id]/page.tsx + actions.ts.

### Established Patterns
- Server Action (requireAdmin) → service $transaction → revalidatePath. RSC reads. Next 16 await params. Tailwind 4, npm. kysely 0.28.17 (do not touch).

### Integration Points
- Add SetScore model + Match.setsWonA/B + Match.setScores → migrate. New service src/lib/services/result.ts (setWinner, matchWinnerFromSets, recordResult) + tests. Result-entry action + admin form. Extend BracketView to show set scores + winner highlight + champion.
</code_context>

<specifics>
## Specific Ideas

- Spec: research/ARCHITECTURE.md «SCORING MODEL OVERRIDE» (SetScore model, recordResult contract, setsPerMatch/gamesPerSet) — authoritative. winnerId is advancement source of truth (set in Phase 4 schema). Terminal status "finished".
- PITFALLS.md: winner-advancement slot math (reuse advance()/nextSlot already wired in Phase 4 — recordResult writes winner into the pre-existing parent slot, an UPDATE not insert), results out of order (reject if slots unfilled), stale bracket caching (revalidatePath in the action, verify on prod build), winner ∈ {pairA,pairB}.
- Champion = winner of the final match (match with nextMatchId null).
</specifics>

<deferred>
## Deferred Ideas

- UI настройки setsPerMatch/gamesPerSet на турнир — v2 (SCOR-01).
- Очки внутри гейма (15/30/40, golden point), супер-тай-брейк — out of scope (v2 SCOR-02).
- Каскадная переочистка нижестоящих матчей при правке уже-продвинувшегося результата — out of scope (минимум ограничений).
- Рейтинги/посев — v2.
</deferred>
