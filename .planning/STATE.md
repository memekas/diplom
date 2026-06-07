---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: — Мультиформатные турниры + полный UX
status: verifying
stopped_at: Completed 09-05-PLAN.md — recordRoundResult (FMT-03/SCORE-01). 13 test files green (344 assertions), tsc clean. Playoff untouched.
last_updated: "2026-06-07T18:22:11.160Z"
last_activity: 2026-06-07 -- Completed 09-05 (recordRoundResult)
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 13
  completed_plans: 13
  percent: 60
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-07)

**Core value:** Организация создаёт турнир для пар/одиночек в одном из четырёх форматов, игроки регистрируются (по уровню), и все видят сетку/таблицу/standings с результатами.
**Current focus:** Phase 9 — Движки форматов и подсчёта

## Current Position

Phase: 9 (Движки форматов и подсчёта) — EXECUTING
Plan: 6 of 6
Status: Phase complete — ready for verification
Last activity: 2026-06-07 -- Completed 09-05 (recordRoundResult)

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
| Phase 07 P01 | 6m | 2 tasks | 6 files |
| Phase 07 P02 | 8m | 3 tasks | 5 files |
| Phase 08 P01 | ~8m | 3 tasks | 4 files |
| Phase 08 P02 | 6m | 3 tasks | 3 files |
| Phase 08 P04 | 2m | 3 tasks | 5 files |
| Phase 08 P05 | 1m | 3 tasks | 1 file |
| Phase 09 P01 | 2 | 2 tasks | 2 files |
| Phase 09 P02 | 2m | 2 tasks | 2 files |
| Phase 09 P03 | 4m | 2 tasks | 2 files |
| Phase 09 P04 | 5 | 2 tasks | 2 files |
| Phase 09 P05 | 4m | 2 tasks | 4 files |
| Phase 09 P06 | 25m | 3 tasks | 3 files |

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
- [Phase ?]: RR-pairs reuse RoundMatch slots (teamA1/A2=пара A, teamB1/B2=пара B) — no 7th model (D4)
- [Phase ?]: Tournament price as Int minor units; level @default(intermediate); targetPoints no DB default
- [Phase 9]: Американо — circle-on-PLAYERS, partner-once (каждый партнёрит каждого ровно раз за N-1 раундов); singles-only (TournamentPlayer); партнёрство=teamA1/A2 vs teamB1/B2, корт k=партнёрство(2k)vs(2k+1); sit-outs N≡0mod4→0/нечёт→1/N≡2mod4→2; FormatError локально на сервис
- [Phase 9]: recordRoundResult (FMT-03/SCORE-01) — ОТДЕЛЁН от playoff recordResult (playoff→not_round_based, нет nextMatchId-авто-финиша). scoringMode dispatch: points (round_robin запрещает ничью D2; americano/mexicano допускают winner=null; targetPoints advisory A5), sets (reuse setWinner/matchWinnerFromSets→два sets-won). PlayerMatchScore fan-out deleteMany→create, оба партнёра одно командное pointsFor. Финиш: round_robin/americano авто при полноте всех RoundMatch; mexicano — materialize next round по gate, на последнем раунде (roundNumber>=totalRounds) НЕ материализует (helper не знает totalRounds), а финиширует.
- [Phase 9]: computeStandings — DERIVED (не материализуется), пересчёт каждый вызов. americano/mexicano=рейтинг игроков из PlayerMatchScore (sumFor desc→pointDiff→wins→userId asc, стабильный фолбэк критичен для нарезки мексикано). round_robin=таблица единиц из RoundMatch (matchWins→pointDiff→pointsFor→unitId asc). sets-режим: вклад=sets-won (A1); per-game/h2h тай-брейк недоступен в no-migration дизайне. pairs-RR: идентичность пары восстанавливается по (tournamentId, player1Id) (A2)

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

Last session: 2026-06-07T18:22:05.831Z
Stopped at: Completed 09-05-PLAN.md — recordRoundResult (FMT-03/SCORE-01). 13 test files green (344 assertions), tsc clean. Playoff untouched.
Resume file: None
