---
phase: 09-format-engines
plan: 03
subsystem: format-engines
tags: [standings, FMT-02, FMT-03, tiebreak, determinism, player-rating, unit-table, prisma-read]
requires:
  - "prisma/schema.prisma (Round, RoundMatch, PlayerMatchScore, Pair)"
provides:
  - "rankPlayers — pure deterministic player-rating sort (mexicano-cut input)"
  - "computeStandings(prisma, tournamentId) — derived player-rating | unit-table"
  - "PlayerStanding / UnitStanding exported types"
affects:
  - "09-04 mexicano (materializeNextMexicanoRound consumes rankPlayers determinism)"
  - "09-05 round-result (finish/standings consumer)"
  - "Phase 11 VIS (standings render)"
tech-stack:
  added: []
  patterns:
    - "pure-fn-first: tiebreak sort solved once (rankPlayers/rankUnits), tested without DB"
    - "derived-not-materialized: standings recomputed every call from RoundMatch/PlayerMatchScore"
    - "stable terminal key (userId/unitId asc) for deterministic sort (mexicano invariant)"
    - "pair identity recovered by (tournamentId, player1Id) map (A2)"
key-files:
  created:
    - "src/lib/services/standings.ts"
    - "src/lib/services/standings.test.ts"
  modified: []
decisions:
  - "americano/mexicano = player rating from PlayerMatchScore; round_robin = unit table from RoundMatch"
  - "player tiebreak: sumFor desc → pointDiff desc → wins desc → userId asc (stable, mexicano-critical)"
  - "unit tiebreak: matchWins desc → pointDiff desc → pointsFor desc → unitId asc (h2h/per-game unavailable, A1)"
  - "sets-mode contribution = sets-won (pointsA/pointsB store sets-won, A1)"
  - "pairs-RR unit identity recovered via Pair.player1Id map (A2); unrecorded matches (pointsA/B null) ignored"
metrics:
  duration_min: 4
  completed: 2026-06-07
  tasks: 2
  files: 2
---

# Phase 09 Plan 03: computeStandings Summary

Derived standings engine (FMT-02/FMT-03): a pure deterministic `rankPlayers` (the load-bearing input for the mexicano quad cut) and `computeStandings` that branches by format — player rating (sum of personal points) for americano/mexicano from `PlayerMatchScore`, and a unit table (pair or player) for round_robin from `RoundMatch`. Nothing is materialized; everything recomputes from the schema on each call.

## What Was Built

- **`rankPlayers(rows): PlayerStanding[]`** — pure, non-mutating sort over a copy. Tiebreak chain: `sumFor desc → pointDiff (sumFor−sumAgainst) desc → wins desc → userId asc`. The terminal userId-asc key is the stable deterministic fallback the mexicano next-round cut relies on (Pitfall 2 / threat T-09-11) — two differently-shuffled copies of a fully-tied set sort identically. Assigns 1-based `rank`.
- **`computeStandings(prisma, tournamentId)`** — reads tournament `{format, participantMode, scoringMode}` + all rounds with matches and playerScores.
  - **americano/mexicano** → `{ kind: "players", format, players }`: aggregates per-userId from `PlayerMatchScore` (both partners share team pointsFor; `played++`, `wins += pointsFor>pointsAgainst`). Unrecorded matches carry no playerScores so contribute nothing. Sorted via `rankPlayers`.
  - **round_robin** → `{ kind: "units", format, units }`: unit = Pair (pairs) or player (singles). Pairs recover identity via a `(tournamentId, player1Id) → Pair.id` map (A2). Per recorded match (`pointsA != null && pointsB != null`): accrue played, pointsFor/Against (in sets mode pointsA/B = sets-won, A1), win/loss by larger points. Unit table sorted `matchWins desc → pointDiff desc → pointsFor desc → unitId asc` (per-game / head-to-head tiebreakers unavailable under the no-migration design — documented degradation, A1).
- **`PlayerStanding` / `UnitStanding`** exported types per the plan spec.
- **`standings.test.ts`** — 12 assertions: rankPlayers chain (sumFor / pointDiff / wins / stable userId), no-mutation, field mapping, determinism (two shuffles → identical order); computeStandings americano rating + unrecorded-match ignore, round_robin pairs (pairId recovery via player1Id), round_robin singles, stable unitId tiebreak.

## Deviations from Plan

None - plan executed exactly as written. Both TDD tasks (pure `rankPlayers` RED→GREEN, then `computeStandings` read+aggregate) target the same new file pair; committed as the canonical TDD gate sequence — one `test(...)` RED commit (full failing suite) followed by one `feat(...)` GREEN commit (implementation satisfying both tasks), mirroring the 09-01/09-02 single-file-pair pattern.

## Verification

- `npx tsx src/lib/services/standings.test.ts` → 12 assertions passed, exit 0 (includes determinism + stable userId/unitId tiebreaks).
- `npx tsc --noEmit` → exit 0.
- Regression: all 8 service `*.test.ts` green — admin 10, americano 29, bracket 40, registration 18, result 43, round-robin 28, standings 12, tournament-status 16. Playoff (`bracket.ts`/`result.ts`) untouched; no migrations; no new deps.

## TDD Gate Compliance

- RED gate: `c5cd80d test(09-03): add failing standings tests` (module-missing failure verified before impl).
- GREEN gate: `c025355 feat(09-03): computeStandings — player rating + unit table`.
- REFACTOR: none needed.

## Commits

- `c5cd80d` test(09-03): add failing standings tests (rankPlayers + computeStandings)
- `c025355` feat(09-03): computeStandings — player rating + unit table (FMT-02/FMT-03)

## Self-Check: PASSED

- FOUND: src/lib/services/standings.ts
- FOUND: src/lib/services/standings.test.ts
- FOUND commit: c5cd80d
- FOUND commit: c025355
