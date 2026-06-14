# Milestones

## v3.0 UI Redesign (Court) (Shipped: 2026-06-14)

**Phases completed:** 3 phases, 10 plans, 8 tasks

**Key accomplishments:**

- **Phase 12 — Дизайн-фундамент:** Court token contract + `_base` component layer ported into Tailwind 4 `globals.css` (`@theme` + `@layer components`, class names 1:1 со скетчами), Oswald/Inter/JetBrains Mono via `next/font` (cyrillic), `.cq` container-query convention, и глобальная оболочка (body/Nav/badge/logout) переведена на Court — без захардкоженных hex.
- **Phase 13 — Auth/аккаунт/обзор:** таб-карточка входа/регистрации (две сохранённые роуты, `<Link>`-вкладки), профиль player-pass + diff-gated форма (Email read-only), плотный список турниров с поповер-фильтрами (СЕРВЕРНАЯ фильтрация через searchParams), ЛК-дашборд «Мои турниры» по секциям — все v2.0 Server Actions/гейты сохранены; добавлены только read-only запросы (без схемы/миграций/записи).
- **Phase 14 — Страницы турниров:** programme-страница турнира + 6 сабформ на `_base`, плей-офф сетка (set-tally из существующих SetScore + счёт по геймам в fixed-popover, БЕЗ счёта финала, баннер чемпиона по имени, измеренные connector-elbows), форматные страницы (круговой матчи+таблица / американо-мексикано текущие-прошедшие+рейтинг без cut-line), условная форма создания (forced/locked americano/mexicano) — функциональность v2.0 байт-в-байт сохранена.
- **Качество:** каждая фаза прошла code-review (0 блокеров; точечные фиксы: LogoutButton→.btn-ghost, profile changed-dot, bracket popover/connector hardening) + goal-verification (6/6, 4/4, 22/22 must-haves, 0 code-гэпов); milestone audit PASSED (10/10 требований, integration 10/10 wired); tsc чисто, `next build` зелёный (11 роутов).

**Known deferred items at close:** collective v3.0 visual UAT (phases 12–14, чек-лист `phases/14-tournament-pages/14-UAT.md`) — стандартный ручной приёмочный прогон, не код-гэп; + дашборд playoff round-progress/медаль (read-only restyle вне scope, future backend). Прочие open-artifact пункты — исторические human_needed-верификации/UAT уже отгруженных v1.0/v2.0 фаз. См. STATE.md → Deferred Items.

---

## v2.0 Мультиформатные турниры + полный UX (Shipped: 2026-06-07)

**Phases completed:** 5 phases, 20 plans, 8 tasks

**Key accomplishments:**

- 1. [Rule 3 - Blocking] required:true flip сломал типизацию двух callers
- 1. [Rule 3 - Blocking] regen @prisma/client surfaced 2 latent type errors от схемы 07-01
- Task 1 — auth.ts + profileSchema/parseProfileForm (commit 56a24d1)
- 1. [Rule 1 - Bug] Spurious round materialization on the final mexicano round
- 1. [Rule 3 - Blocking] Cast Prisma String columns to label-map key types
- `nav.tsx` now declares `const CLUB_NAME = "Падел Клуб"` (placeholder, renameable) and renders an inline SVG logo placeholder + club name on the left (link to `/`). Right side: Турниры, Прошедшие турниры (`/tournaments?status=finished`), admin-only Создать турнир, Личный кабинет (`/profile`, newly added), user name, Выйти. Guests see Войти/Регистрация. Layout uses `flex-wrap` + `gap-x/gap-y` so the header wraps on mobile without horizontal scroll. `getOptionalSession()` and admin role gating unchanged.
- 1. [Rule 1 - Bug] Disabled selects drop their value from FormData
- Task 1 — birthDate wiring + required register level
- Added the two missing read-only helpers (`listRounds`, `listTournamentPlayers`) and the two per-format presentational view components VIS-01 needs — pure reads + display, no engine logic, with a readOnly-gated per-match entry slot for Plan 04 to wire.

---
