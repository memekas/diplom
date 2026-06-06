---
status: partial
phase: 05-results-advancement
source: [05-VERIFICATION.md]
started: "2026-06-06"
updated: "2026-06-06"
---

## Current Test

[awaiting human testing]

## Tests

### 1. Record result → advance
expected: Admin на идущем турнире вводит счёт матча по сетам (напр. 6:4, 6:3) → победитель определяется, попадает в следующий матч (слот A/B); публичная сетка обновляется сразу (на `npm run build && npm start`).
result: [pending]

### 2. Final → finished + champion
expected: Ввод результата финала → турнир «Завершён», чемпион отображается баннером. Правка результата (MATCH-04) переопределяет победителя и чемпиона. Незалогиненный видит сетку только для чтения.
result: [pending]

### 3. Invalid score rejected
expected: Недопустимый сет (напр. 6:5 без тай-брейка) или недостаточно сетов → понятная RU-ошибка, ничего не сохраняется.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
