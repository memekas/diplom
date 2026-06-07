---
type: quick
status: complete
completed: 2026-06-08
---

# Quick Summary: seed-tournament-fill script

## What was built

`scripts/seed-tournament-registrations.ts` — a dev/demo script that fills an OPEN
tournament (`status="registration"`) with random eligible players, reusing the real
registration services so it duplicates none of the registration rules.

- **Input:** `process.argv[2]` accepts a raw cuid OR a full URL — if it contains `/`,
  takes the last non-empty path segment after stripping `?query`/`#hash`.
- **No-arg / not-found:** prints all open tournaments (`id name format mode level size`)
  and exits 1.
- **Status guard:** non-`registration` status → RU error "записываться можно только в
  открытую регистрацию", exits 1.
- **Eligibility:** `User` where `skillLevel === tournament.level`, `role !== "admin"`,
  and NOT already registered in this tournament (not in any `Pair.player1Id/player2Id`,
  not in `TournamentPlayer`). Fisher–Yates shuffle for variety.
- **Capacity:** `remaining = size − current` (pairs: `Pair.count`; singles:
  `TournamentPlayer.count`).
- **Registration:** `participantMode === "pairs"` → eligible 2-at-a-time via
  `registerPair(prisma, { tournamentId, player1Id, player2Id })`; `singles` (incl.
  americano/mexicano) → one-by-one via `registerSingle(prisma, { tournamentId, userId })`.
  Each registration wrapped in try/catch on `RegistrationError` → log code+message and
  continue (the service enforces level/capacity/dup/mode in a transaction).
- **Logging:** each registration (pair as "nickA + nickB"); final registered/filled/free
  counts; insufficient-eligible hint: `TEST_USER_LEVEL=<level> npm run seed:test-users`.
- **package.json:** added `"seed:tournament-fill": "tsx scripts/seed-tournament-registrations.ts"`.

**Note on signatures:** `registerPair`/`registerSingle` take user ids directly (the
nickname->id resolution `findUserIdByNickname` is a separate app-layer helper). Since
eligibility already resolves user ids, the script passes ids directly — no nickname
round-trip needed.

## Verification

- `npx tsc --noEmit` → exit 0.
- Smoke (throwaway `pro` pairs tournament size 4, 13 pro test players):
  - URL parse (`http://.../tournaments/<id>?foo=bar#x`) → filled 4/4 pairs;
    `prisma.pair.count` confirmed 4.
  - No-arg → listed open tournaments correctly.
  - Re-run on full tournament → "уже заполнен".
  - Nonexistent id → "не найден".
  - `finished` status → RU not-open error.
  - Size-16 pro tournament → partial fill 6/16 + insufficient-level hint shown.
- Cleanup: both `SMOKE-*` throwaway tournaments deleted (cascade removed their pairs);
  `dev.db` left clean. Seeded `pro` test players (player32–39) retained — intentional,
  harmless dev data per the `seed-test-users` contract.

## Usage

    npx tsx scripts/seed-tournament-registrations.ts <cuid>
    npx tsx scripts/seed-tournament-registrations.ts http://localhost:3000/tournaments/<cuid>
    npm run seed:tournament-fill -- <cuid>
    npx tsx scripts/seed-tournament-registrations.ts        # no arg -> lists open tournaments
