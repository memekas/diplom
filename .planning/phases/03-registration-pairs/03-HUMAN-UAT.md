---
status: partial
phase: 03-registration-pairs
source: [03-VERIFICATION.md]
started: "2026-06-06"
updated: "2026-06-06"
---

## Current Test

[awaiting human testing]

## Tests

### 1. Participate happy path
expected: Залогиненный игрок на /tournaments/[id] (статус «Регистрация открыта») выбирает партнёра из select → пара создаётся, появляется в списке участников (оба имени + сторона корта + уровень), счётчик N/size растёт.
result: [pending]

### 2. Anon branch
expected: Аноним на странице турнира видит «Войдите, чтобы участвовать» (ссылка /login), не форму.
result: [pending]

### 3. Already-registered branch
expected: Игрок, уже состоящий в паре турнира, видит свою пару, форма «Участвовать» скрыта.
result: [pending]

### 4. Full + integrity errors
expected: При size зарегистрированных пар — «Турнир заполнен», формы нет. Попытки само-партнёрства / дубля показывают понятные RU-ошибки.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
