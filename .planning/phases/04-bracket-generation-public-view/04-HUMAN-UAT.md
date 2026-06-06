---
status: partial
phase: 04-bracket-generation-public-view
source: [04-VERIFICATION.md]
started: "2026-06-06"
updated: "2026-06-06"
---

## Current Test

[awaiting human testing]

## Tests

### 1. Admin «Старт» enablement
expected: Admin видит «Старт турнира» на /tournaments/[id] только при статусе registration; кнопка активна лишь когда зарегистрировано ровно N (size) пар, иначе подсказка «нужно ровно N пар».
result: [pending]

### 2. Start → generate → render
expected: Клик «Старт» → сетка генерируется, турнир → «Идёт», секция «Сетка» показывает раунды (R1 заполнен парами, дальше TBD).
result: [pending]

### 3. Anon bracket visibility
expected: Аноним открывает /tournaments/[id] идущего турнира и видит сетку (без входа).
result: [pending]

### 4. Re-generation + admin guard
expected: Повторный «Старт» отклоняется с RU-сообщением «Сетка уже сгенерирована…». Прямой POST start-action не-админом отклоняется на сервере (Forbidden).
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
