# Retrospective — Padel Tournaments

## Milestone: v2.0 — Мультиформатные турниры + полный UX

**Shipped:** 2026-06-07
**Phases:** 5 (7–11) | **Plans:** 20 | **Requirements:** 24/24

### What Was Built
Расширение движка с единственного playoff-для-пар до четырёх форматов (Олимпийская / Раунд-робин / Американо / Мексикано) с одиночной и парной регистрацией, матчингом по уровню (5 RU), настраиваемым режимом подсчёта (сеты/геймы или очки, без лимитов), расширенным ЛК (правка всех полей включая email/ник), админ-управлением (удаление регистраций, ручное завершение) и полным UX (только русский, принудительная тёмная тема, адаптив, главная со списком открытых турниров, шапка с ЛК, per-format визуализация, прошедшие турниры).

### What Worked
- **Глубокий ресёрч форматов наперёд** (`research/FORMATS.md`, 9 агентов + состязательная верификация) до фазы 1 — снял риск горизонтальной нарезки (модель данных фазы 7 вместила все нужды движков фазы 9 без миграций).
- **Горизонтальные слои (БД→бэк→фронт)** — каждая фаза верифицировалась изолированно; playoff-стек (v1.0) сохранён байт-в-байт через аддитивные модели + dispatch.
- **Состязательное code-review каждой фазы** поймало реальные баги: CR-01 (RR points target-sum протекал), email регистрозависимость (WR-01), IDOR в remove (WR-02), misleading finish-ошибка (WR-03) — все исправлены до закрытия.
- **Самодостаточные tsx-тесты** (361 assertion, 17 скриптов) как регрессионный инвариант — playoff не сломан ни разу за 20 планов.

### What Was Inefficient
- Pattern-mapper падал по transient socket-ошибке (фаза 7) — пропущен как non-blocking; CONTEXT+RESEARCH компенсировали.
- Несколько `state.record-metric` CLI-вызовов отклоняли позиционные аргументы — исполнители писали метрики в STATE.md вручную.
- Авто-извлечённые accomplishments в MILESTONES.md шумноваты (тянут deviation-заметки из SUMMARY).

### Patterns Established
- **format-engine dispatch** (startFormat/recordFormatResult по `tournament.format`) — playoff через тот же путь, не тронут.
- **Отдельные модели для round-based** (Round/RoundMatch/PlayerMatchScore) вместо перегрузки playoff Match.
- **scoringMode ортогонален формату**; sets-результат round-based = sets-won в pointsA/pointsB (без миграции).
- **RU label-maps** (skillLevelLabels/formatLabels/tournamentKindLabels/courtSideLabels) — единая точка локализации значений.

### Key Lessons
- Для «design-DB-first» нарезки критичен ресёрч доменных правил ДО схемы — иначе фаза данных не вмещает нужды движков.
- Мексикано-детерминизм держится на стабильном тай-брейке (userId) — иначе нарезка четвёрок невоспроизводима.
- Better Auth `changeEmail` молча no-op на дубле → pre-check уникальности обязателен.

### Cost Observations
- Полностью автономный прогон (`/gsd-autonomous`): discuss→research→plan→check→execute→verify→review+fix на фазу.
- Модель: Opus (inherit) на оркестрации и агентах.
- Отложен только визуальный UAT (≈11 браузерных пунктов фаз 10–11) — код-гэпов нет.

## Milestone: v3.0 — UI Redesign (Court)

**Shipped:** 2026-06-14
**Phases:** 3 (12–14) | **Plans:** 10

### What Was Built
Визуальный рестайл всех экранов под дизайн-язык Court: фундамент (токены `@theme` + `_base` слой + шрифты + `.cq` container-query), экраны аккаунта/обзора (auth таб-карточка, профиль, список+фильтры, дашборд), страницы турниров (programme, создание, плей-офф сетка с set-tally+games-popover без счёта финала, форматные страницы). Функциональность v2.0 сохранена байт-в-байт.

### What Worked
- Sketch-фаза как дизайн-контракт: skill `sketch-findings-diplom` (references + sources HTML + `_base.css`/`court.css`) дал 1:1 токены/классы — переносить разметку без переименований, минимум grey-area-решений в discuss.
- Фундамент-первый (Phase 12): один раз перенесли `_base` слой + `.cq` → фазы 13/14 только потребляли. Co-located `.css` на экран + disjoint files_modified → планы шли параллельными планами в одной волне (сериализованы на main, но без конфликтов).
- pattern-mapper заранее вскрывал data-gaps (дашборд «Мои турнири», capacity списка) ДО планирования → решение «read-only Server-Component запросы» зафиксировано в CONTEXT, не всплыло сюрпризом при исполнении.

### What Was Inefficient
- Roadmap предполагал, что экраны существуют для рестайла, но дашборд v2.0 был заглушкой («Добро пожаловать») — пришлось добавлять read-only слой данных (в рамках, но не «чистый рестайл»).
- Сетка плей-офф (connector-геометрия) — самый дорогой план; заложили деградацию, но исполнитель довёл измеренные коннекторы (useLayoutEffect + fonts.ready).

### Patterns Established
- **Co-located screen `.css` + `.cq` обёртка + анонимные `@container`** (не media) — конвенция адаптива.
- **READ-ONLY исключение из «no backend»**: Server-Component запросы по существующим моделям, когда экран-заглушка не читал данные — без схемы/Server Actions/записи.
- Визуальный UAT отложен на совместный milestone-прогон (паттерн с v2.0).

### Key Lessons
- При рестайл-майлстоуне проверять, что целевые экраны реально имеют данные для рендера (pattern-mapper), иначе «рестайл» тихо превращается в фичу.
- code-review находки сверять с locked CONTEXT-решениями: часть «warnings» (`.cq` vs `.app`, retention `--background`) были by-design, авто-фикс сломал бы контракт.

### Cost Observations
- Model mix: ~100% Opus (inherit) на оркестрации + всех агентах (pattern-mapper/planner/checker/executor/reviewer/fixer/verifier/integration).
- Полностью автономный прогон (`/gsd-autonomous`): per-phase discuss(smart)→pattern-map→plan→check→execute(serial)→code-review→fix→verify; milestone audit→complete.

## Cross-Milestone Trends

| Milestone | Phases | Plans | Reqs | Note |
|-----------|--------|-------|------|------|
| v1.0 | 5 | 13 | 21 | MVP: playoff для пар |
| v1.1 | 1 | 1 | 3 | Никнеймы + запись по нику |
| v2.0 | 5 | 20 | 24 | 4 формата + полный UX (горизонтальные слои) |
| v3.0 | 3 | 10 | 10 | UI Redesign (Court): чистый рестайл + read-only исключение |
