---
phase: 10-ux-foundation
verified: 2026-06-07T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Открыть сайт при светлой системной теме ОС (macOS/Windows light) и любой странице."
    expected: "Сайт остаётся тёмным (фон #0a0a0a, текст светлый); ОС-тема не переключает на светлый."
    why_human: "Фактический рендеринг палитры и реакция на prefers-color-scheme проверяются только в браузере; статически подтверждено отсутствие медиа-запроса и тёмный :root."
  - test: "Проверить контраст тёмных статус-пилюль и алертов: бейджи registration/in_progress/finished, ошибки форм (bg-red-900/40), success профиля (bg-green-900/40)."
    expected: "Текст читаем на тёмном фоне, достаточный контраст, нет светлых пятен."
    why_human: "Визуальная читаемость/контраст — субъективная оценка в браузере; статически подтверждено отсутствие светлых *-100/200 классов."
  - test: "Адаптив: открыть главную, шапку, список турниров, формы входа/регистрации/профиля на мобильной ширине (~375px) и desktop."
    expected: "Нет горизонтального скролла и обрезки ключевых блоков; шапка переносится (flex-wrap); формы остаются в пределах экрана."
    why_human: "Фактическая отрисовка breakpoint-классов и отсутствие overflow проверяются только в браузере/devtools; статически подтверждено наличие flex-wrap/w-full/max-w/sm: классов."
  - test: "Кликнуть «Прошедшие турниры» в шапке и карточку турнира на главной."
    expected: "«Прошедшие турниры» → /tournaments?status=finished показывает только завершённые; карточка главной ведёт на /tournaments/[id]."
    why_human: "End-to-end навигация с реальными данными подтверждается в работающем приложении; код-путь (searchParams.status → listTournaments(where.status), Link href) статически подтверждён."
  - test: "Залогиниться и проверить шапку на нескольких страницах; разлогиниться и проверить гостевой вид."
    expected: "Залогиненный: «Личный кабинет»(/profile), имя, «Выйти»; admin дополнительно «Создать турнир»; гость: «Войти»/«Регистрация». Шапка одинакова на всех страницах."
    why_human: "Зависит от живой сессии (getOptionalSession) и роли; статически подтверждены ветвления и ссылки, но реальный рендер по сессии — браузер."
---

# Phase 10: UX-фундамент Verification Report

**Phase Goal:** Весь сайт на русском, в принудительной тёмной теме и адаптивен; пользователь попадает на главную со списком открытых для регистрации турниров и видит шапку с названием клуба, логотипом, кнопкой «Прошедшие турниры» и входом в личный кабинет.
**Verified:** 2026-06-07
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Все экраны (вход/регистрация, dashboard, профиль, навигация) на русском с `<html lang="ru">`, включая 5 RU-подписей уровня | ✓ VERIFIED | `layout.tsx:16` `<html lang="ru">`; RU metadata `layout.tsx:6-7`; login/register/dashboard/profile pages+forms все RU (read); grep EN user-facing strings across `(auth)`/`(app)`/nav/logout/page.tsx → NONE FOUND; 5 RU level labels in `auth.ts:8-12` (новичок/прогрессирующий/средний/высокий/профессиональный), wired in register-form & profile-form selects |
| 2 | Тёмная тема без захардкоженных светлых элементов (бейджи/алерты исправлены) | ✓ VERIFIED | `globals.css:3-6` `:root` dark (#0a0a0a/#ededed); `grep prefers-color-scheme src/` → NONE; `tournament-status-badge.tsx:14-18` translucent dark pills (bg-*-900/40, bg-white/10); form alerts bg-red-900/40 / bg-green-900/40; grep light `*-(50-300)` pills across `(auth)`/profile/badge → NO LIGHT PILLS |
| 3 | Адаптив desktop/mobile без горизонтального скролла ключевых блоков | ✓ VERIFIED (static) — visual = human | nav `flex flex-wrap gap-x/gap-y sm:px-6`; home `max-w-2xl flex-wrap sm:text-3xl`; forms `w-full max-w-sm`; profile `max-w-sm w-full`. Breakpoint/wrap classes present on all key blocks. Actual no-overflow rendering = human item #3 |
| 4 | Главная = список открытых для регистрации турниров с переходом на турнир | ✓ VERIFIED | `page.tsx:10-11` async Server Component → `listTournaments(prisma, { status: "registration" })`; cards `Link href={`/tournaments/${t.id}`}` (line 29); RU empty state «Сейчас нет открытых турниров» (line 22); build shows `/` as ƒ (Dynamic, server-rendered) |
| 5 | Шапка: клуб/логотип/«Прошедшие турниры»/вход в ЛК на всех страницах | ✓ VERIFIED | `nav.tsx`: `CLUB_NAME = "Падел Клуб"` (line 6), inline SVG logo (lines 19-29), «Прошедшие турниры» → `/tournaments?status=finished` (line 37), «Личный кабинет» → `/profile` for logged-in (line 47); Nav mounted in `layout.tsx:18` → present on all pages; `getOptionalSession` + admin role gating unchanged |

**Score:** 5/5 truths verified (static). All 5 ROADMAP success criteria objectively met; only browser-rendered visual/responsive/session confirmation remains (human items).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/globals.css` | Forced dark, no prefers-color-scheme | ✓ VERIFIED | gsd verify.artifacts passed; dark :root, no media query |
| `src/app/layout.tsx` | lang=ru + RU metadata + Nav | ✓ VERIFIED | lang="ru", RU title/desc, imports globals.css, mounts Nav |
| `src/lib/validation/auth.ts` | skillLevelLabels + formatLabels + tournamentKindLabels + RU zod | ✓ VERIFIED | All 3 maps present, typed vs zod tuples; RU zod messages |
| `src/components/tournament-status-badge.tsx` | Dark status pills | ✓ VERIFIED | STATUS_CLASSES dark; isKnownStatus intact |
| `src/lib/services/tournament.ts` | listTournaments status filter | ✓ VERIFIED | opts.status → where.status, backward-compatible |
| `src/lib/services/tournament.test.ts` | Filter unit test | ✓ VERIFIED | 3 assertions pass, exit 0 |
| `src/app/page.tsx` | Home Server Component (registration list) | ✓ VERIFIED | async SC, RU cards, empty state, links |
| `src/app/(public)/tournaments/page.tsx` | Honors ?status= | ✓ VERIFIED | validates searchParams.status vs tuple → listTournaments |
| `src/components/nav.tsx` | CLUB_NAME/logo/Прошедшие/ЛК | ✓ VERIFIED | all present, guards intact |
| `src/lib/validation/profile.ts` | courtSideLabels | ✓ VERIFIED | left/right/either RU, schema untouched |
| `src/app/(app)/profile/profile-form.tsx` | RU + courtSideLabels/skillLevelLabels + dark alerts | ✓ VERIFIED | both label maps wired, dark alerts, parseProfileForm untouched |
| login/register/dashboard pages+forms, logout-button | RU + dark alerts | ✓ VERIFIED | all RU (read), bg-red-900/40 alerts, error.code branching intact |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| layout.tsx | globals.css | `import "./globals.css"` | ✓ WIRED | Manually confirmed `layout.tsx:2` (gsd regex false-negative) |
| page.tsx | tournament.ts | listTournaments(status) | ✓ WIRED | gsd verified |
| page.tsx | /tournaments/[id] | Link href | ✓ WIRED | Manually confirmed `page.tsx:29` `href={`/tournaments/${t.id}`}` (gsd regex false-negative) |
| nav.tsx | /profile | Link ЛК | ✓ WIRED | gsd verified |
| nav.tsx | /tournaments?status=finished | Прошедшие link | ✓ WIRED | gsd verified; consumed by public page searchParams.status |
| (public)/tournaments | listTournaments | searchParams.status→where | ✓ WIRED | validates vs tournamentStatuses, passes filter |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| page.tsx (home) | `tournaments` | `listTournaments(prisma, {status:"registration"})` → `prisma.tournament.findMany({where:{status}})` | Yes (real Prisma query, server-side filter) | ✓ FLOWING |
| (public)/tournaments | `tournaments` | `listTournaments(prisma, validStatus?)` → findMany | Yes | ✓ FLOWING |
| nav.tsx | `session` | `getOptionalSession()` (signed cookie) | Yes (live session read) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Type safety | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Status filter logic | `npx tsx src/lib/services/tournament.test.ts` | 3 assertions, exit 0 | ✓ PASS |
| Production build | `npx next build` | exit 0, 11/11 routes, `/` dynamic | ✓ PASS |

### Probe Execution

Not applicable — presentational/UX phase, no probe scripts declared.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SITE-01 | 10-01, 10-03 | Весь UI на русском (lang=ru) + подписи уровня | ✓ SATISFIED | Truth 1 |
| SITE-02 | 10-01, 10-03 | Принудительная тёмная тема, исправлены светлые элементы | ✓ SATISFIED | Truth 2 |
| SITE-03 | 10-02, 10-03 | Адаптивная вёрстка | ✓ SATISFIED (static) | Truth 3 — visual = human #3 |
| HOME-01 | 10-02 | Главная = открытые турниры | ✓ SATISFIED | Truth 4 |
| HDR-01 | 10-03 | Шапка: клуб/логотип/Прошедшие/ЛК | ✓ SATISFIED | Truth 5 |

No orphaned requirements — all 5 phase requirements claimed by plans and verified.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None | — | No debt markers (TBD/FIXME/XXX), no light-pill hardcodes, no stub returns in phase files |

### Human Verification Required

1. **Forced dark under light OS theme** — open any page with OS light theme; expect site stays dark. (Static: no prefers-color-scheme, dark :root.)
2. **Pill/alert contrast** — visually confirm dark status badges + form alerts are readable. (Static: no light *-100/200.)
3. **Responsive no-overflow** — home/header/forms at ~375px and desktop; expect no horizontal scroll. (Static: flex-wrap/w-full/max-w/sm: present.)
4. **Navigation flow** — «Прошедшие турниры» → finished filter; home card → /tournaments/[id]. (Static: code path wired.)
5. **Session-based header** — logged-in vs guest header, admin extra link. (Static: branching + links present.)

### Gaps Summary

No blocking gaps. All 5 ROADMAP success criteria and all 5 requirements (SITE-01/02/03, HOME-01, HDR-01) are objectively confirmed in the codebase: forced dark theme (no prefers-color-scheme, dark :root), full RU localization (lang=ru, no EN user-facing strings, 5 RU level labels + format/kind/court-side label maps wired), home Server Component listing registration-open tournaments with detail links + empty state, header with club name/inline SVG logo/«Прошедшие турниры»/«Личный кабинет» mounted in the root layout (auth guards intact), and dark alert pills. tsc/test/build all green. The only outstanding items are inherently browser/session-rendered confirmations (visual dark rendering, contrast readability, responsive no-overflow, end-to-end navigation, session-dependent header) — listed as human_verification, not failures, per the verification brief.

---

_Verified: 2026-06-07_
_Verifier: Claude (gsd-verifier)_
