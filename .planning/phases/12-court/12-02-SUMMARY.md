---
phase: 12-court
plan: 02
subsystem: ui-foundation
tags: [css, theme, tokens, nav, badge, responsive, container-queries]
requires:
  - "12-01 (Court tokens + _base component layer: .btn/.btn-primary/.badge/.badge-reg/-prog/-fin/.muted/.faint, var(--border))"
provides:
  - "Nav restyled to Court chrome (token border, .btn .btn-primary CTA, .muted/.faint links) — structure/links/session unchanged"
  - "TournamentStatusBadge renders .badge .badge-{reg|prog|fin}; reg pulse dot free from .badge-reg::before"
affects:
  - src/components/nav.tsx
  - src/components/tournament-status-badge.tsx
tech-stack:
  added: []
  patterns:
    - "Consume Plan 01 component-layer classes (.btn/.badge/.muted/.faint) instead of hardcoded Tailwind color literals"
key-files:
  created: []
  modified:
    - src/components/nav.tsx
    - src/components/tournament-status-badge.tsx
decisions:
  - "STATUS_LABELS текст v2.0 сохранён (class-map — load-bearing требование, текст — нет)"
  - "Nav username uses .faint, nav links use .muted token color classes"
  - "Unknown-status badge fallback = bare .badge (was bg-white/10)"
metrics:
  duration: "~3 min"
  completed: 2026-06-14
  tasks: 3
  files: 2
---

# Phase 12 Plan 02: Court Global Chrome Summary

Перевёл глобальную хрому (Nav + tournament-status-badge) на дизайн-язык Court, потребляя токены и компонентный слой из Plan 01: минимальный токен-рестайл Nav (граница, CTA, ссылки) без изменения структуры/ссылок/сессионной логики, и перевод статус-бейджа на `.badge .badge-{reg|prog|fin}` маппинг с бесплатной pulse-точкой для reg.

## What Was Built

**Task 1 — tournament-status-badge → `.badge-*` map (`src/components/tournament-status-badge.tsx`)** `33b2af5`
- `STATUS_CLASSES` → `{ registration: "badge badge-reg", in_progress: "badge badge-prog", finished: "badge badge-fin" }`.
- Убрана литеральная обёртка `inline-block rounded-full px-3 py-1 text-xs font-medium` — форма/тип/padding/uppercase/pill-радиус приходят из `.badge`.
- Рендер упрощён до `<span className={className}>{label}</span>`; fallback для неизвестного статуса = `"badge"` (вместо `bg-white/10 text-foreground/70`).
- `isKnownStatus` type-guard и `STATUS_LABELS` (тексты v2.0) сохранены без изменений.
- Reg-бейдж наследует пульсирующую точку из `.badge-reg::before` (Plan 01) — разметка не тронута.

**Task 2 — Nav token-restyle (`src/components/nav.tsx`)** `da51efc`
- Граница `<nav>`: `border-current/15` → `border-[var(--border)]`.
- CTA «Регистрация»: `rounded-md bg-foreground px-3 py-1 text-background hover:opacity-80` → `.btn .btn-primary` (Court ball-green с токен-тенью).
- Обычные ссылки → `.muted` token color (+ ненавязчивый `hover:opacity-80`); имя пользователя `<span className="opacity-70">` → `.faint`.
- SVG-логотип `fill/stroke="currentColor"` оставлен (токен-дружелюбен).
- `getOptionalSession`, admin/user/guest ветвление, все `<Link href>`, `LogoutButton` — неизменны (структура навигации сохранена).

## Deviations from Plan

None — plan executed exactly as written. Rules 1–3 не применялись: чистый presentational restyle, оба файла совпали с описанием плана.

## Checkpoint (Task 3 — UI-10 shell verification)

Автономный режим: визуальная часть `checkpoint:human-verify` авто-одобрена. Автоматическая часть выполнена:
- `npx tsc --noEmit` — clean (exit 0).
- `npx next build` — green; все 11 маршрутов компилируются, CSS собран Tailwind 4.
- grep: `badge badge-reg|-prog|-fin` присутствует в badge; `btn btn-primary` + `var(--border)` присутствует в nav.
- grep: НЕТ `bg-green|amber|white`, `rounded-full`, `inline-block` в badge; НЕТ `bg-foreground`, `text-background`, `border-current` в nav (no hardcoded color literals).

**Visual ≤375px confirmation deferred** to the collective v3.0 visual UAT after Phase 14 (per STATE.md Deferred Items — project's interactive/visual UAT is batched). `flex-wrap` на nav уже присутствует; адаптивная корректность оболочки будет подтверждена визуально в той коллективной UAT.

## Verification

- `npx tsc --noEmit` — clean (exit 0).
- `npx next build` — succeeds (11 routes).
- grep-assertions: `.badge-*` map in badge, `.btn .btn-primary` + `var(--border)` in nav, zero hardcoded Tailwind color literals in both files.

## Self-Check: PASSED
- src/components/tournament-status-badge.tsx — FOUND
- src/components/nav.tsx — FOUND
- commit 33b2af5 — FOUND
- commit da51efc — FOUND
