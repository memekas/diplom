---
status: partial
phase: 01-foundation-auth
source: [01-VERIFICATION.md]
started: "2026-06-06"
updated: "2026-06-06"
---

## Current Test

[awaiting human testing]

## Tests

### 1. Register click-through
expected: На /register ввод email+пароль+имя (опц. телефон, уровень) создаёт аккаунт и сразу логинит; редирект на /dashboard.
result: [pending]

### 2. Session persists across reload
expected: После входа перезагрузка страницы сохраняет сессию (остаёшься залогинен).
result: [pending]

### 3. Logout from nav
expected: Кнопка выхода в nav доступна с любой страницы и завершает сессию.
result: [pending]

### 4. Profile save + reload
expected: На /profile смена courtSide (left/right/either), телефона, уровня → «Saved.»; после reload значения сохранены; name/email/role не редактируются.
result: [pending]

### 5. Admin-page redirect
expected: Не-админ/аноним на /admin редиректится на /login; админ видит страницу.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
