# Phase 3: Registration & Pairs - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Авторизованный игрок нажимает «Участвовать» на странице турнира (статус `registration`), выбирает партнёра из зарегистрированных пользователей (Variant B) → создаётся пара; система атомарно гарантирует целостность пар и закрывает регистрацию при достижении вместимости (4/8/16).

Доставляет: REG-01, REG-02, REG-03, PLAYER-02.

НЕ входит: генерация сетки / «Старт» (Phase 4), результаты (Phase 5). Пара получает поле `seed` (Int?), но оно заполняется только при генерации сетки в Phase 4.
</domain>

<decisions>
## Implementation Decisions

### Partner selection (Variant B)
- Выбор партнёра — `<select>` из зарегистрированных пользователей, ИСКЛЮЧАЯ себя. Сервер дополнительно валидирует (не сам себя; партнёр существует; ни регистрирующий, ни партнёр ещё не в паре этого турнира). Простой dropdown — достаточно для диплома (мало пользователей).
- Пара: `Pair { player1Id (регистрирующий), player2Id (выбранный партнёр) }`.

### «Участвовать» entry point
- Кнопка/форма «Участвовать» на `/tournaments/[id]`: показывается ЗАЛОГИНЕННОМУ игроку только если статус турнира = `registration`, турнир не заполнен, и игрок ещё не состоит в паре этого турнира.
- Аноним видит подсказку «Войдите, чтобы участвовать» (ссылка на /login). Если заполнен → «Турнир заполнен». Если уже в паре → показать его пару, скрыть форму.

### Pair integrity (REG-02) — transactional
- Регистрация в ОДНОЙ Prisma `$transaction`: (1) перечитать статус турнира (== registration), (2) посчитать пары (< size), (3) проверить, что ни player1, ни player2 не состоят уже в паре этого турнира (в ЛЮБОМ слоте: player1Id OR player2Id), (4) player1 != player2, (5) вставить пару. Любое нарушение → отклонить, без вставки.
- Схема: `@@unique([tournamentId, player1Id])` и `@@unique([tournamentId, player2Id])` как defense-in-depth (одна и та же пара не вставится дважды в один слот); но кросс-слотовую проверку (игрок как player1 в одной паре и player2 в другой) делает транзакционная проверка, т.к. unique-констрейнты её не ловят.

### Capacity lock (REG-03)
- Регистрация закрывается при `pairsCount >= size`. Сервер отклоняет сверх-вместимость в транзакции; UI показывает «Турнир заполнен» и скрывает форму. (Статус остаётся `registration` до «Старт» в Phase 4 — заполненность ≠ in_progress.)

### Participant list (PLAYER-02)
- Список участников на `/tournaments/[id]`: для каждой пары — имена обоих игроков + предпочитаемая сторона корта + уровень игры (display-only). Заменяет placeholder `0/size` из Phase 2 на реальный список + счётчик `N/size`.

### Access
- «Участвовать» — guarded Server Action первой строкой `requireUser()` (identity из сессии; player2 — из формы, валидируется). Просмотр списка участников — публичный (как страница турнира).

### Claude's Discretion
- Точная верстка (минимальный функциональный Tailwind, RU).
- Имена компонентов/файлов; структура service (следовать профилю/турниру).
- Удаление/выход из пары (unregister) — НЕ требуется для v1 (не в REG-*); опустить.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 1: src/lib/db.ts, src/lib/auth-guards.ts (requireUser/requireAdmin/getOptionalSession), services/validation pattern (thin action → zod → service[$transaction] → revalidatePath).
- Phase 2: src/lib/services/tournament.ts (getTournament), src/lib/services/tournament-status.ts, src/app/(public)/tournaments/[id]/page.tsx (detail page — ADD «Участвовать» + participant list here), src/components/tournament-status-badge.tsx.
- prisma/schema.prisma: User (with name/courtSide/skillLevel), Tournament (relation-less — ADD `pairs Pair[]` back-relation in this phase).

### Established Patterns
- Server Components read via service; Server Actions mutate in $transaction with guards. Next 16 `await params`. Tailwind 4, npm. kysely pinned 0.28.17 (do not touch).

### Integration Points
- Add `Pair` model + back-relations (Tournament.pairs, User.pairsAsP1/pairsAsP2) → `npx prisma migrate dev`. Do NOT add Match relations yet (Phase 4).
- Extend /tournaments/[id] detail page with «Участвовать» form (client leaf) + participant list (server-rendered). New service src/lib/services/registration.ts (or pair.ts) + validation.
</code_context>

<specifics>
## Specific Ideas

- Pair model per research/ARCHITECTURE.md (id, tournamentId+cascade, player1Id/player1, player2Id/player2, seed Int?, createdAt, two @@unique). Match relations on Pair (matchesAsA/B/Won) deferred to Phase 4.
- The partner `<select>` should list users by display name (and maybe court side) so the registering player can pick; exclude self client-side, validate server-side.
- Pitfalls to honor (research/PITFALLS.md): pair-integrity race → single transaction; over-capacity → count+insert in same tx; self-partner; partner not existing user; revalidatePath after registration.
</specifics>

<deferred>
## Deferred Ideas

- «Старт» / bracket generation — Phase 4 (consumes locked field of pairs; sets seed).
- Unregister / leave pair, edit pair — not in v1 scope.
- Mutual partner confirmation (invite/accept) — out of scope (PAIR-01, v2).
</deferred>
