---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Мультиформатные турниры + полный UX
status: planning
last_updated: "2026-06-07T15:47:55.056Z"
last_activity: 2026-06-07
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-06)

**Core value:** Организация создаёт playoff-турнир для пар, игроки регистрируются парами, и все видят турнирную сетку с результатами.
**Current focus:** Phase 6 — Nicknames & Partner-by-Nick (v1.1)

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-06-07 — Milestone v2.0 started

## Performance Metrics

**Velocity:**

- Total plans completed: 14
- Average duration: — min
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3 | - | - |
| 02 | 3 | - | - |
| 03 | 2 | - | - |
| 04 | 2 | - | - |
| 05 | 3 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01 P01-01 | 38 | 5 tasks | 33 files |
| Phase 01 P01-03 | 6 | 3 tasks | 6 files |
| Phase 02 P02-01 | 4m | 3 tasks | 7 files |
| Phase 02 P02-02 | 5m | 2 tasks | 4 files |
| Phase 02 P02-03 | 5m | 3 tasks | 3 files |
| Phase 03 P02 | 10m | 3 tasks | 4 files |
| Phase 04 P02 | 6 | 2 tasks | 5 files |
| Phase 05 P01 | 2 | 1 tasks | 2 files |
| Phase 05 P02 | ~6 min | 1 tasks | 4 files |
| Phase 05 P05-03 | 12 min | 2 tasks | 7 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Stack]: Next.js 16 (App Router, TS) + Prisma ≥6.2 (NOT 7, SQLite) + Tailwind 4 + Zod, single repo
- [Phase 1]: Auth = Better Auth ^1.6 (research/AUTH.md overrides STACK.md) — register/login/logout, Prisma+SQLite adapter, `admin()` plugin для роли; password hashing внутри библиотеки (bcryptjs/iron-session не нужны)
- [Phase 1]: Админ = идемпотентный seed-аккаунт из env (`role: "admin"`); email-верификация выключена для офлайн-демо
- [Phase 3]: Партнёр — Variant B (выбор из зарегистрированных пользователей), без consent/invite flow
- [Phase 4]: Bracket — pre-generated match tree (size-1 матчей), final-first создание, wired via nextMatchId/nextSlot; иммутабельна после генерации
- [Phase 6 (v1.1)]: `nickname` — новое обязательное уникальное поле `User` (`@@unique`). Собирается на кастомной форме регистрации и протекает через Better Auth signup (`additionalFields` `nickname` с `input:true` + `required:true`, как phone/skillLevel) — НЕ post-signup update, чтобы дубль ника отклонял создание аккаунта целиком.
- [Phase 6 (v1.1)]: Уникальность ника — defense-in-depth: `@@unique` в схеме (источник истины) + понятная RU-ошибка при регистрации (маппинг конфликта на сообщение, не падение).
- [Phase 6 (v1.1)]: REG-04 переделывает партнёра с `<select player2Id>` на текстовый ввод ника → точный lookup (`findUnique({ where: { nickname } })`) → разрешённый `userId`. Затрагивает `participate-form.tsx`, `registration.ts` (новый lookup-хелпер вместо `listEligiblePartners`), `validation/registration.ts` (`player2Nickname` вместо `player2Id`). Существующая транзакционная целостность `registerPair` сохраняется — резолвится `player2Id` ДО неё.
- [Phase 6 (v1.1)]: Бэкфилл ников в обоих сидах — `prisma/seed.ts` (админ) и `scripts/seed-test-users.ts` (тестовые игроки, детерминированные уникальные ники в стиле существующих пулов имён).

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 6 (v1.1)]: Существующая БД (`dev.db`) имеет пользователей БЕЗ ника — добавление required `nickname` потребует миграции с backfill ИЛИ пересоздания БД из сидов (для диплома допустимо `migrate reset` + reseed; подтвердить в плане).

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Known limitation | Phase 3 WR-01: registerPair capacity TOCTOU race under concurrent distinct registrations (could exceed size). Accepted — concurrency/load explicitly out of scope (PROJECT.md); SQLite single-writer + single-user thesis demo makes it unreachable in practice. Fix if ever multi-user: insert-then-verify count (SQLite has no isolationLevel support). | Accepted | Phase 3 |

## Session Continuity

Last session: 2026-06-06T18:12:14.476Z
Stopped at: v1.1 roadmap created — Phase 6 (Nicknames & Partner-by-Nick) defined, 3/3 requirements mapped. Ready for `/gsd-plan-phase 6`.
Resume file: None
