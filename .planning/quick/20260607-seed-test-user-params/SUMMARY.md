---
type: quick
status: complete
completed: 2026-06-07
commit: 08c0a79
files-modified:
  - scripts/seed-test-users.ts
---

# Summary: Configurable level + random count for test-user seed

Two configurable inputs added to `scripts/seed-test-users.ts`; no new deps, existing style preserved (Better Auth signUpEmail, idempotent email skip, deterministic playerN nicknames, birthDate/courtSide unchanged, password default 12345678 untouched).

## What changed
- **Skill level:** `TEST_USER_LEVEL` validated against `SKILL_LEVELS`; invalid → stderr error + exit 1; valid → applied to every player; unset → random per-player (`randomLevel()`, replaced the old cyclic selection).
- **Count:** `argv[2]` OR `TEST_USER_COUNT`; neither → random 4..16. Removed `DEFAULT_COUNT=20`; preserved integer 1..500 validation for explicit values.
- **Docs:** header/Usage/Done updated; Done line reports `Count=N, level=<fixed|random>`.

## Verification
- `npx tsc --noEmit` → exit 0.
- Fresh-DB smoke: random count → varied levels; `TEST_USER_LEVEL=advanced` → all match; no count → 15 (within 4..16); `TEST_USER_LEVEL=bogus` → clean error + exit 1.

## Self-Check: PASSED
