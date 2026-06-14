---
status: ready
phase: 14-tournament-pages
source: [14-VERIFICATION.md, 13-VERIFICATION.md, 12-VERIFICATION.md]
started: "2026-06-14T16:00:00.000Z"
updated: "2026-06-14T16:00:00.000Z"
note: COLLECTIVE v3.0 visual UAT — consolidates the deferred visual checks of phases 12, 13, 14. All code-level must-haves verified (12: 6/6, 13: 4/4, 14: 22/22, 0 gaps). Run with `npm run dev` across desktop + ≤375px.
---

## Current Test

number: 1
name: v3.0 Court collective visual UAT (phases 12–14)
expected: |
  Run `npm run dev`; check at desktop and ≤375px (and bracket at sizes 4/8/16):
  Court dark court-field, Oswald/Inter/JetBrains fonts, ball-green/court-cyan, no unintended page scroll.
awaiting: developer run

## Tests

### 1. Foundation shell (UI-01/UI-10, Phase 12)
expected: Court body field + Nav (Court tokens, .btn-primary CTA) + status badges (.badge-* + pulsing reg/prog dot) + LogoutButton (.btn-ghost); ≤375px no unintended horizontal scroll on `/` and `/tournaments`.
result: [pending]

### 2. Auth (UI-02, Phase 13)
expected: `/login` + `/register` Court tab-card; Вход/Регистрация tabs switch routes; reveal-eye; error/disabled states readable at 375px.
result: [pending]

### 3. Profile (UI-05, Phase 13)
expected: `/profile` player-pass idcard; edit-toggle enables form; per-field changed-dot shows; Save diff-gated; Email read-only (логин tag).
result: [pending]

### 4. Tournaments list (UI-03, Phase 13)
expected: `/tournaments` dense grid desktop → card-per-row ≤780px; «Фильтры» popover (Статус/Формат/Уровень/Вид) + search; .fcount badge; server-side filtering; `?status=finished` works; no ≤375px scroll.
result: [pending]

### 5. Dashboard (UI-04, Phase 13)
expected: `/dashboard` identity header + Активные/Предстоящие/Завершённые sections + role-aware cards + state CTAs.
result: [pending]

### 6. Tournament detail (UI-06, Phase 14)
expected: `/tournaments/[id]` hero + РЕГЛАМЕНТ (.tip tooltip) + СТАРТОВЫЙ ЛИСТ with seed + «ваша пара» highlight + capacity progress + CTA + admin-box; sub-forms (participate/score/start/finish/remove) Court-styled; score entry only for admin+in_progress; finished read-only.
result: [pending]

### 7. Create form (UI-07, Phase 14)
expected: `/admin/tournaments/new` sectioned Court form; fields change by format (playoff→4/8/16; round_robin→number; американо/мексикано→Одиночный+Очки locked + Число раундов); submit creates tournament (forced values post correctly).
result: [pending]

### 8. Playoff bracket (UI-08, Phase 14)
expected: round columns, full names (no truncation), set-tally per pair, games-on-hover/tap popover, NO final score, champion banner (name only); columns + connectors align on 4/8/16; intentional horizontal scroll inside .bracket-scroll.
result: [pending]

### 9. Format pages (UI-09, Phase 14)
expected: Круговой — «Матчи» by round + «Турнирная таблица»; Американо/Мексикано — «Текущие/Прошедшие игры» + «Рейтинг игроков» (no cut-line); wide tables scroll inside .standings-scroll on phone.
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0
blocked: 0

## Gaps

None — all code-level must-haves across phases 12–14 verified (0 gaps). This is the live visual confirmation pass. Known intentional out-of-scope deferrals (read-only restyle): dashboard playoff round-progress «N/M» + finished-card medal (tech-debt note in STATE — needs format-engine reads, future backend work).
