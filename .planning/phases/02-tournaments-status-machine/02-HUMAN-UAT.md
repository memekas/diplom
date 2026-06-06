---
status: partial
phase: 02-tournaments-status-machine
source: [02-VERIFICATION.md]
started: "2026-06-06"
updated: "2026-06-06"
---

## Current Test

[awaiting human testing]

## Tests

### 1. Admin create round-trip
expected: Залогиненный admin на /admin/tournaments/new создаёт турнир (name, size 4/8/16, опц. дата/место) → редирект на /tournaments/[id], статус «Регистрация открыта».

result: [pending]

### 2. Anonymous list/detail access
expected: Аноним (без входа) открывает /tournaments (список с бейджами статуса) и /tournaments/[id] — без редиректа на логин.

result: [pending]

### 3. Non-admin guard + nav
expected: Обычный игрок не видит ссылку «Создать турнир»; прямой заход на /admin/tournaments/new редиректит на /login.

result: [pending]

### 4. Not-found
expected: /tournaments/<несуществующий-id> рендерит страницу 404 (notFound).

result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
