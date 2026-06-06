# Phase 4: Bracket Generation & Public View - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Админ нажимает «Старт» (ровно при 4/8/16 зарегистрированных парах) → в одной транзакции генерируется полная иммутабельная single-elimination сетка случайной жеребьёвкой (Fisher–Yates), турнир переходит в `in_progress`; любой пользователь видит турнирную сетку (раунды, матчи, пары, TBD-слоты). Это Core Value проекта.

Доставляет: BRKT-01, BRKT-02, BRKT-03.

НЕ входит: ввод результатов / счёт по сетам / продвижение победителей (Phase 5). В этой фазе создаётся СТРУКТУРА сетки (пустые матчи раунда >1 с TBD-слотами) и публичный просмотр; матчи ещё без результатов.
</domain>

<decisions>
## Implementation Decisions

### Match model (schema, this phase)
- Добавить `Match` per research/ARCHITECTURE.md: id, tournamentId (+onDelete Cascade), round (Int, 1=первый), position (Int, 0-based в раунде), pairAId?/pairA, pairBId?/pairB (nullable — раунд 1 заполнен, дальше null до продвижения), winnerId?/winner (nullable, заполняется в Phase 5), nextMatchId?/nextMatch + feederMatches (self-relation "Bracket"), nextSlot? ("A"|"B"), @@index([tournamentId, round]). Back-relations на Pair: matchesAsA/matchesAsB/matchesWon.
- Поля результата по сетам (`setsWonA/setsWonB`) и модель `SetScore` — добавляются в Phase 5 (не здесь). В Phase 4 матч имеет только структуру + winnerId (nullable). [BLOCKING] `npx prisma migrate dev --name add_match`.

### Bracket generation algorithm (BRKT-01) — the high-risk core, TDD
- Чистая функция `advance(round, position) => { round: round+1, position: Math.floor(position/2), slot: position % 2 === 0 ? "A" : "B" }` — протестировать ДО любой обвязки.
- Table-driven число раундов: {4: 2, 8: 3, 16: 4}; число матчей = size-1. НЕ вычислять через log2 (float/off-by-one риск).
- `generateBracket(prisma, tournamentId)` в ОДНОЙ `$transaction`: (1) requireAdmin (в экшене), (2) re-read турнир: статус == registration, посчитать пары == size (ровно 4/8/16, иначе reject), (3) reject если матчи уже существуют (иммутабельность BRKT-03), (4) Fisher–Yates перемешать пары, присвоить seed 1..size (Pair.seed), (5) создать все size-1 матчей final-first (чтобы parent id существовал до детей), связать child→parent через nextMatchId+nextSlot, заполнить раунд-1 матчи парами по 2, (6) tournament → `in_progress`. Источник случайности — без Math.random в скрипте-неудобстве; обычный Math.random в рантайме сервиса допустим (это рантайм, не workflow-скрипт).
- Без bye-логики: size всегда степень двойки.

### Immutability (BRKT-03)
- «Старт» отклоняется на сервере, если матчи уже есть ИЛИ статус != registration. Повторная генерация/перемешивание невозможны.

### «Старт» entry point
- Кнопка «Старт турнира» — admin-only (Server Action первой строкой requireAdmin), на странице турнира /tournaments/[id] (или admin-вид), показывается когда статус=registration и пар ровно size. Если пар != size → кнопка неактивна/подсказка «нужно ровно N пар».

### Bracket view (BRKT-02) — public
- Сетка видна всем (вкл. анонимов) на /tournaments/[id] (секция «Сетка») или /tournaments/[id]/bracket. Рендер: раунды как колонки слева-направо (R1 → финал), каждый матч — пара A vs пара B (имена) или «TBD» для незаполненных будущих слотов. Один запрос findMany по матчам турнира, группировка по round, сортировка по position. Минимальный функциональный Tailwind (flex/grid колонки), без bracket-библиотек.

### Access
- Генерация — admin-only (requireAdmin). Просмотр сетки — публичный.

### Claude's Discretion
- Расположение секции сетки (на странице турнира vs отдельный роут) — на усмотрение, но публично и просто.
- Точная верстка дерева (колонки раундов), имена компонентов.
- Хранить ли seed на Pair или порядок в раунде-1 неявно — следовать ARCHITECTURE (seed на Pair).
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 1: src/lib/db.ts, src/lib/auth-guards.ts (requireAdmin), services/validation pattern, tsx test harness.
- Phase 2: src/lib/services/tournament.ts (getTournament), tournament-status.ts (transitionTournament — REUSE for →in_progress), src/app/(public)/tournaments/[id]/page.tsx (add «Старт» + bracket section), tournament-status-badge.tsx.
- Phase 3: src/lib/services/registration.ts (listTournamentPairs), Pair model (+ seed Int? to fill here).

### Established Patterns
- Server Action (requireAdmin) → service in $transaction → revalidatePath. RSC read for views. Next 16 await params. Tailwind 4, npm. kysely 0.28.17 (do not touch). Terminal status canonical "finished" (Phase 4 sets "in_progress").

### Integration Points
- Add Match model + Pair.matchesAsA/B/Won back-relations → migrate. New service src/lib/services/bracket.ts (advance + generateBracket) + tests. «Старт» action on tournament detail. Bracket view component.
</code_context>

<specifics>
## Specific Ideas

- ARCHITECTURE.md "Pattern 1" (pre-generated match tree) + generation algorithm (final-first creation, Fisher–Yates, wire nextMatchId/nextSlot) + the `advance` function are the spec. PITFALLS.md: bracket slot-math off-by-one, mutating started bracket, re-shuffle after start — all addressed by table-driven counts + immutability guard + TDD on advance().
- Unit tests MUST cover 4/8/16: correct match count (3/7/15), round counts (2/3/4), round-1 fully paired, every non-final match wired to a parent slot, no orphan/cycle, re-generation rejected.
</specifics>

<deferred>
## Deferred Ideas

- Match results / score by sets / winner advancement — Phase 5 (adds setsWonA/B + SetScore, fills winnerId, propagates via nextMatchId/nextSlot, sets "finished").
- Seeding by rating (RANK-01) — v2; v1 seeding is random (Fisher–Yates).
</deferred>
