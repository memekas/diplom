---
type: quick
status: complete
created: 2026-06-08
---

# Quick: seed-tournament-fill script

## Objective

Dev/demo script `scripts/seed-tournament-registrations.ts` that registers random
ELIGIBLE players/pairs onto a tournament by id (raw cuid or full `/tournaments/<id>`
URL), reusing the existing registration services.

## Tasks

- [x] Create `scripts/seed-tournament-registrations.ts` (url-or-id parsing, eligibility,
      capacity-bounded fill via `registerPair`/`registerSingle`, RU logging + hints).
- [x] Add `seed:tournament-fill` npm script (mirror `seed:test-users`).
- [x] Verify `tsc --noEmit` + smoke test on a real tournament; clean up throwaway state.
- [x] One atomic commit + SUMMARY.

## Constraints

- Reuse existing services — duplicate NO registration rules.
- No new deps. Sequential on `main`.
