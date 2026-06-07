---
phase: 07-multiformat-data-model
plan: 01
subsystem: data-model
tags: [prisma, schema, better-auth, multiformat, skill-levels]
requires: []
provides:
  - "Prisma models: TournamentPlayer, Round, RoundMatch, PlayerMatchScore"
  - "Extended User (skillLevel required, birthDate, 6 back-relations)"
  - "Extended Tournament (format/participantMode/level/price/scoringMode/targetPoints/totalRounds)"
  - "skillLevels 5-value constant + skillLevelLabels RU map"
  - "Better Auth skillLevel required:true"
affects:
  - prisma/schema.prisma
  - src/lib/validation/auth.ts
  - src/lib/auth.ts
  - "src/app/(public)/tournaments/[id]/page.tsx"
  - prisma/seed.ts
  - "src/app/(auth)/register/register-form.tsx"
tech-stack:
  added: []
  patterns:
    - "String + inline-comment enums (Pitfall 9 — no Prisma enum)"
    - "Cascade only down ownership chain; User FKs never cascaded"
    - "Co-located RU label-map for latin slug keys"
key-files:
  created: []
  modified:
    - prisma/schema.prisma
    - src/lib/validation/auth.ts
    - src/lib/auth.ts
    - "src/app/(public)/tournaments/[id]/page.tsx"
    - prisma/seed.ts
    - "src/app/(auth)/register/register-form.tsx"
decisions:
  - "RR-pairs reuse RoundMatch slots (teamA1/A2 = пара A, teamB1/B2 = пара B) — no 7th model (D4, Open Q1)"
  - "price as Int (minor units), level @default(intermediate), targetPoints no DB default"
  - "register-form/seed skillLevel fallback to satisfy now-required NOT NULL (Rule 3, blocking typecheck)"
metrics:
  duration: ~6m
  completed: 2026-06-07
requirements: [DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-07]
---

# Phase 07 Plan 01: Модель данных мультиформата Summary

Расширил Prisma-схему и app-слой уровней до мультиформатной модели v2.0: 4 новые round-based модели, 7 новых полей Tournament, обязательный 5-значный skillLevel с тиром `progressing` — строго аддитивно, playoff-стек нетронут.

## What Was Built

### Task 1 — Prisma schema (commit f184fed)
- **4 новые модели**: `TournamentPlayer` (singles registration), `Round` (round container), `RoundMatch` (4 nullable User FK = две динамические команды), `PlayerMatchScore` (per-player points, `pointsAgainst` обязателен).
- **User**: `skillLevel String?` → `String` (NOT NULL); добавлен `birthDate DateTime?`; 6 именованных back-relations (`tournamentPlayers`, `roundMatchesAsA1/A2/B1/B2`, `playerMatchScores`).
- **Tournament**: +`format`/`participantMode`/`level`/`price`/`scoringMode`/`targetPoints`/`totalRounds`; back-relations `tournamentPlayers`/`rounds`; setsPerMatch/gamesPerSet — комментарий «без верхнего лимита» (тип/дефолты не тронуты).
- Cascade только вниз по владению (Tournament→Round→RoundMatch→PlayerMatchScore, TournamentPlayer→Tournament); User-FK без cascade. Без Prisma enum (`grep -c '^enum '` == 0).

### Task 2 — app level layer (commit 6ffb899)
- `skillLevels` 4→5 (вставлен `progressing` между beginner и intermediate); новый экспорт `skillLevelLabels` (RU-map: новичок/прогрессирующий/средний/высокий/профессиональный).
- `auth.ts` additionalFields `skillLevel` `required:false` → `required:true` (Pitfall 2 — честность NOT NULL).
- `tournaments/[id]/page.tsx`: хардкод-switch `skillLevelLabel` заменён на использование импортированного `skillLevelLabels` (добавляет лейбл для progressing, приводит RU-формулировки к CONTEXT).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] required:true flip сломал типизацию двух callers**
- **Found during:** Task 2 (`npx tsc --noEmit`)
- **Issue:** После `skillLevel required:true` inferred тип `signUpEmail`/`signUp.email` требует `skillLevel`, которого не было в `prisma/seed.ts` (admin signUp) и `register-form.tsx` (skillLevel optional в форме). Дерево не компилировалось — блокирующая ошибка, прямо вызванная правкой Task 2; `<verify>` Task 2 = tsc, должен проходить.
- **Fix:** `seed.ts` — добавлен `skillLevel: "pro"` в admin signUp body (явно санкционировано RESEARCH §Seed updates). `register-form.tsx` — `skillLevel: skillLevel ?? "beginner"` (минимальная type-only правка; полный UX поля — Фаза 8/11, не вводилась). registerSchema/loginSchema не тронуты.
- **Files modified:** prisma/seed.ts, src/app/(auth)/register/register-form.tsx
- **Commit:** 6ffb899

## Verification

- `npx prisma validate` → exit 0 ("The schema is valid 🚀"); все 6 User back-relations связаны.
- `npx tsc --noEmit -p tsconfig.json` → exit 0, без ошибок.
- `grep -c '^enum ' prisma/schema.prisma` == 0 (нет Prisma enum).
- git diff hunks ограничены User / Tournament / append-after-SetScore — model Pair/Match/SetScore тела не изменены (locked D4).
- Все 4 новые модели присутствуют; skillLevel non-nullable; birthDate/scoringMode/participantMode/targetPoints на месте; `progressing` + skillLevelLabels в auth.ts; `required: true` в auth.ts; page без хардкод-«начинающий».

## Notes for Next Plan (07-02)

- Этот план НЕ запускал БД-операции. Миграция `multiformat_data_model`, `prisma migrate reset` + сиды — план 07-02.
- `skillLevel` nullable→NOT NULL потребует rebuild таблицы `user` при миграции (нормально, Prisma делает автоматически).
- `scripts/seed-test-users.ts` `SKILL_LEVELS` array нужно расширить до 5 латинских ключей в 07-02 (этот план его не трогал — вне scope статических правок; seed-test-users не ломал typecheck, т.к. уже передаёт skillLevel).

## Self-Check: PASSED
- prisma/schema.prisma: FOUND (4 new models + extended User/Tournament)
- src/lib/validation/auth.ts: FOUND (progressing + skillLevelLabels)
- src/lib/auth.ts: FOUND (required: true)
- src/app/(public)/tournaments/[id]/page.tsx: FOUND (imports skillLevelLabels)
- Commit f184fed: FOUND
- Commit 6ffb899: FOUND
