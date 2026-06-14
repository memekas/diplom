---
status: deferred
phase: 13-auth
source: [13-VERIFICATION.md]
started: "2026-06-14T15:00:00.000Z"
updated: "2026-06-14T15:00:00.000Z"
note: Batched into the collective v3.0 visual UAT after Phase 14 (see STATE.md Deferred Items). Code side of UI-02/03/04/05 verified 4/4; only live visual/responsive checks outstanding.
---

## Current Test

number: 1
name: Court account/browse screens — visual + ≤375px responsive (UI-02/03/04/05)
expected: |
  Open at desktop and 375px:
  - `/login` + `/register`: Court tab-card, Вход/Регистрация tabs switch routes, reveal-eye works, error/disabled states readable.
  - `/profile`: player-pass idcard, edit-toggle enables form, changed-dot shows per changed field, Save diff-gated, Email read-only.
  - `/tournaments`: dense list desktop → card-per-row ≤780px, «Фильтры» popover (Статус/Формат/Уровень/Вид) + search, .fcount badge, server-side filtering, no unintended ≤375px scroll.
  - `/dashboard`: identity header + Активные/Предстоящие/Завершённые sections + role-aware cards + CTAs.
awaiting: collective v3.0 visual UAT (post Phase 14)

## Tests

### 1. Auth screens (UI-02) — Court tab-card, states, ≤375px
expected: tab-card, route-switching tabs, reveal-eye, readable errors/disabled at 375px
result: [pending — deferred to collective v3.0 UAT]

### 2. Profile (UI-05) — player-pass + edit form + read-only email, ≤375px
expected: idcard, edit-toggle, changed-dot, diff-gated Save, Email read-only
result: [pending — deferred to collective v3.0 UAT]

### 3. Tournaments list (UI-03) — dense→card reflow + filter popover, ≤375px
expected: dense grid desktop, card reflow ≤780px, filter popover + count badge, server-side filter, no ≤375px scroll
result: [pending — deferred to collective v3.0 UAT]

### 4. Dashboard (UI-04) — sections + role cards + CTAs, ≤375px
expected: identity header + 3 sections + role-aware tcards + state CTAs
result: [pending — deferred to collective v3.0 UAT]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

None — all code-level must-haves verified (4/4). Only live visual confirmation is outstanding, intentionally batched to the collective v3.0 visual UAT after Phase 14. Documented graceful-degradation items (playoff round-progress N/M, finished-card medal, capacity fraction) are out-of-scope read-only-restyle deferrals, not gaps.
