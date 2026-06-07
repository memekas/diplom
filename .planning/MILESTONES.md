# Milestones

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
