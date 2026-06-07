---
type: quick
status: complete
created: 2026-06-07
---

# Quick: Configurable level + random count for test-user seed

## Objective

Add two configurable inputs to `scripts/seed-test-users.ts`:

1. **Skill level** — `TEST_USER_LEVEL`. If set, validate against `SKILL_LEVELS`
   (beginner|progressing|intermediate|advanced|pro) and apply to EVERY player;
   invalid → clear error + non-zero exit. If unset → each player gets a random level.
2. **Count** — from `argv[2]` OR `TEST_USER_COUNT`; if neither set → random integer
   4..16 inclusive. Existing positive-integer validation preserved for explicit values.

Update header/Usage/Done docs. Password untouched. No new deps.

## Verification

- `npx tsc --noEmit` exits 0.
- Runtime smoke on fresh temp DBs (env moved aside): random count yields varied levels,
  fixed level applies to all, no-count yields random 4..16, invalid level errors out.
