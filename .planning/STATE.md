---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Мультиформатные турниры + полный UX
status: planning
last_updated: "2026-06-07T16:10:00.000Z"
last_activity: 2026-06-07
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-07)

**Core value:** Организация создаёт турнир для пар/одиночек в одном из четырёх форматов, игроки регистрируются (по уровню), и все видят сетку/таблицу/standings с результатами.
**Current focus:** Phase 7 — Модель данных мультиформата (v2.0, Слой 1)

## Current Position

Phase: 7 — Модель данных мультиформата (not started)
Plan: —
Status: Roadmap created — ready to plan Phase 7
Last activity: 2026-06-07 — Roadmap v2.0 создан (5 фаз, 24/24 требований замаплено)

## v2.0 Phase Map (горизонтальные слои, строгий порядок)

| Phase | Слой | Goal | Requirements |
|-------|------|------|--------------|
| 7 | 1 — Данные | Prisma-схема + миграция + сиды под все форматы | DATA-01..07 (7) |
| 8 | 2 — Бэкенд | Создание/регистрация/админ/ЛК | TOUR-05, REG-05/06, ADMN-01/02, USR-03 (6) |
| 9 | 2 — Бэкенд | Движки форматов + подсчёт | FMT-01..03, SCORE-01 (4) |
| 10 | 3 — UX | Локализация/тема/адаптив/главная/шапка | SITE-01..03, HOME-01, HDR-01 (5) |
| 11 | 3 — UX | Формы/ввод счёта/визуализация | FORM-01..03, SCORE-02, VIS-01/02 (6) |

Строгий порядок слоёв: 7 (Слой 1) → 8,9 (Слой 2) → 10,11 (Слой 3).

## Performance Metrics

**Velocity:**

- Total plans completed: 14 (v1.0 + v1.1)
- Average duration: — min
- Total execution time: 0.0 hours

**By Phase (shipped):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3 | - | - |
| 02 | 3 | - | - |
| 03 | 2 | - | - |
| 04 | 2 | - | - |
| 05 | 3 | - | - |
| 06 | 1 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work (v2.0):

- [v2.0]: Американо/мексикано = одиночная регистрация + системная ротация пар по раундам; индивидуальные очки; итог = рейтинг игроков. Парная-по-нику только playoff + round-robin.
- [v2.0]: Матчинг уровня = строгое равенство (5 RU-уровней: новичок/прогрессирующий/средний/высокий/профессиональный).
- [v2.0]: Playoff = ровно 4/8/16 (без bye); round-robin/американо/мексикано = свободное число участников.
- [v2.0]: ЛК правит всё, включая email (флоу смены email Better Auth) и ник (проверка уникальности).
- [v2.0]: scoringMode (`sets` | `points`) — настройка турнира, ортогональна формату; без верхнего лимита на сеты/геймы/очки.
- [v2.0]: Завершение турнира — ручное действие админа (для всех форматов); авто-финиш playoff дополняется кнопкой.
- [v2.0]: Структура фаз — строгие горизонтальные слои (модель данных → бэкенд → фронтенд/UX), НЕ вертикальные фичи.
- [Stack]: Next.js 16 (App Router, TS) + Prisma ≥6.2 (NOT 7, SQLite) + Tailwind 4 + Zod + Better Auth ^1.6, single repo. Без Prisma-enums (String + zod-union). Пароль в `Account.password` (scrypt).
- [v1.1]: `nickname` — обязательное уникальное поле `User` (`@@unique`), собирается через Better Auth `additionalFields`; дубль ловится по `error.code`.
- [v1.0]: PLAYOFF полностью реализован — pre-generated match tree (size-1 матчей), final-first, wired via nextMatchId/nextSlot; иммутабельна; теннисный счёт сеты/геймы + авто-продвижение + авто-финиш. v2.0 расширяет, не ломая.

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 7]: Существующая БД (`dev.db`) имеет пользователей; добавление обязательного `skillLevel` (5 RU) + новых полей Tournament/моделей форматов потребует миграции. Для диплома допустим `migrate reset` + reseed (DATA-06). Подтвердить в плане Phase 7.
- [Phase 7→8]: DATA-05 (участник = игрок ИЛИ пара) и модели round-robin/американо-мексикано не должны ломать существующее playoff Match-дерево — спроектировать аддитивно.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Known limitation | Phase 3 WR-01: registerPair capacity TOCTOU race under concurrent distinct registrations (could exceed size). Accepted — concurrency/load explicitly out of scope (PROJECT.md); SQLite single-writer + single-user thesis demo makes it unreachable in practice. Fix if ever multi-user: insert-then-verify count (SQLite has no isolationLevel support). | Accepted | Phase 3 |

## Session Continuity

Last session: 2026-06-07T16:10:00.000Z
Stopped at: Roadmap v2.0 создан — 5 фаз (горизонтальные слои), 24/24 требований замаплено. Готово к `/gsd-plan-phase 7` (или `/gsd-discuss-phase 7`).
Resume file: None
