---
phase: 09-format-engines
verified: 2026-06-07T00:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 9: Движки форматов и подсчёта — Verification Report

**Phase Goal:** При старте/продвижении каждый формат генерирует и обновляет свою структуру (round-robin-расписание, ротация и индивидуальные очки американо/мексикано, существующее playoff-дерево), а ввод результата ветвится по режиму подсчёта (`sets` без лимитов либо `points` — два произвольных целых) с корректным вычислением победителя.
**Verified:** 2026-06-07
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Старт round-robin → полное «каждый-с-каждым» + standings | ✓ VERIFIED | `round-robin.ts:58-91` circle method (arr[0] fixed, tail rotates, BYE skip), n0·(n0-1)/2 matches; `:104-193` generateRoundRobin reads Pair (pairs) / TournamentPlayer (singles), generate-once guard (`round.count>0`→FormatError), `transitionTournament` registration→in_progress. `standings.ts:68-77,156-203` units branch + deterministic `rankUnits` (wins→pointDiff→pointsFor→unitId asc). Tests: round-robin 28 + standings 12, green. |
| 2 | Старт/продвижение американо/мексикано → ротация + индивид. очки → рейтинг | ✓ VERIFIED | `americano.ts:62-105` circle-on-players, partner-once proven (test `americano.test.ts:49-57` asserts C(N,2) partnerships, 0 dup for N=4/8/12/16); full schedule at start. `mexicano.ts:111-170` Round-1 baseline only; `:180-271` materializeNextMexicanoRound gated (round-complete via null-score count + materialize-once + P2002), 1+4vs2+3 via `crossPairQuad:77-85` (teamA=[s0,s3], teamB=[s1,s2]), ranking via shared `rankPlayers`. Individual points → `rankPlayers` (standings.ts:39-61). Tests: americano 29 + mexicano 16, green. |
| 3 | sets (произвольно, generalized gamesPerSet) / points (два целых) — победитель по режиму | ✓ VERIFIED | `round-result.ts:59-81` scorePointsMode: int≥0 validation, RR draw rejected (`draw_not_allowed`), amer/mex draw→winner null, winner = greater. `:89-119` scoreSetsMode reuses shared `setWinner`/`matchWinnerFromSets` (no per-set limit; generalized gamesPerSet), collapses to two sets-won ints. Dispatch by DB `scoringMode` `:183-198`. Tests: round-result 11 (service) + 24 (validation), green. |
| 4 | Следующий раунд / standings per format + playoff без регрессии | ✓ VERIFIED | `round-result.ts:209-219` PlayerMatchScore fan-out (deleteMany→create; both partners share team pointsFor — test asserts 4 rows, equal); `:221-262` per-format finish: RR/americano auto-finish when all RoundMatch recorded, mexicano materialize-next + last-round finish guard (`isLastRound` prevents spurious round). Playoff UNCHANGED: bracket.ts/result.ts last commits = Phase 04/05 (`git log`); bracket 40 + result 43 assertions intact. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/lib/services/round-robin.ts` | circle-method RR generator | ✓ VERIFIED | 193 lines; pure `circleMethodSchedule` + transactional `generateRoundRobin`; FormatError typed |
| `src/lib/services/americano.ts` | partner-once schedule, full at start | ✓ VERIFIED | 176 lines; `americanoSchedule` circle-on-players; singles-only (TournamentPlayer) |
| `src/lib/services/mexicano.ts` | Round-1 + materialize-next | ✓ VERIFIED | 271 lines; quadCut/crossPairQuad/round1Cut/crossPairCut pure fns + 2 transactional entry points |
| `src/lib/services/standings.ts` | player rating + unit table | ✓ VERIFIED | 203 lines; `rankPlayers`/`rankUnits` deterministic; `computeStandings` derived (not stored) |
| `src/lib/services/round-result.ts` | sets/points recorder + fan-out | ✓ VERIFIED | 290 lines; scorePointsMode/scoreSetsMode + recordRoundResult txn; separate from playoff recordResult |
| `src/lib/services/format-engine.ts` | start/record dispatch | ✓ VERIFIED | 94 lines; startFormat + recordFormatResult branch by DB format; playoff path threads same parser/recorder |
| `src/lib/services/bracket.ts` | playoff (UNCHANGED) | ✓ VERIFIED | 221 lines; last touched Phase 04 (`16daf9d`) — no Phase-09 modification |
| `src/lib/services/result.ts` | playoff result (UNCHANGED) | ✓ VERIFIED | 224 lines; last touched Phase 05 (`32661b1`) — no Phase-09 modification |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| actions.ts | format-engine.startFormat | import + call | ✓ WIRED | `actions.ts:13` import, `:142` `await startFormat(prisma, tournamentId)` |
| actions.ts | format-engine.recordFormatResult | import + call | ✓ WIRED | `:269` `await recordFormatResult(prisma, tournamentId, matchId, formData)` |
| format-engine | 4 generators | switch on format | ✓ WIRED | `:36-47` playoff→generateBracket, RR→generateRoundRobin, amer→generateAmericano, mex→generateMexicanoRound1 |
| format-engine | recordResult/recordRoundResult | branch on format | ✓ WIRED | `:74-92` playoff→parseRecordResultForm+recordResult; round-based→parseRoundResultForm+recordRoundResult |
| round-result | mexicano.materializeNextMexicanoRound | import + call in txn | ✓ WIRED | `round-result.ts:9` import, `:235` called inside txn (non-last round) |
| round-result | result.setWinner/matchWinnerFromSets | shared pure core | ✓ WIRED | `:2-8` import; reused in scoreSetsMode (no duplication) |
| mexicano | standings.rankPlayers | import + call | ✓ WIRED | `mexicano.ts:3` import, `:241` ranks cumulative scores for cut |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Full service test suite (11 scripts) | `npx tsx src/lib/services/*.test.ts` | 0 failing scripts | ✓ PASS |
| Full suite incl. validation (15 scripts) | run all `src/**/*.test.ts` | 354 assertions, 0 failures | ✓ PASS |
| Typecheck | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Playoff regression intact | bracket.test.ts / result.test.ts | 40 / 43 assertions green | ✓ PASS |
| Partner-once invariant | americano.test.ts N=4/8/12/16 | 0 duplicate partnerships | ✓ PASS |
| 1+4 vs 2+3 cross-pair | mexicano.test.ts crossPairQuad | A=(s0,s3) B=(s1,s2) | ✓ PASS |
| Fan-out both partners equal | round-result.test.ts points 15:9 | 4 PlayerMatchScore, equal pointsFor | ✓ PASS |

Self-reported per-script: admin 10, americano 29, bracket 40, format-engine 10, mexicano 16, registration(svc) 18, result 43, round-result(svc) 11, round-robin 28, standings 12, tournament-status 16, profile 33, tournament 56, round-result(val) 24, registration(val) 8 = **354**. Matches SUMMARY claim exactly.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| FMT-01 | 09-01 | Round-robin schedule «каждый-с-каждым» at start | ✓ SATISFIED | generateRoundRobin + circleMethodSchedule; 28 tests |
| FMT-02 | 09-02/03/04 | Americano/mexicano rotation + individual points | ✓ SATISFIED | generateAmericano (partner-once) + mexicano Round1/materialize + rankPlayers; 29+16+12 tests |
| FMT-03 | 09-03/05/06 | Next round / standings per format | ✓ SATISFIED | recordRoundResult finish/materialize gate + computeStandings; format-engine dispatch |
| SCORE-01 | 09-05/06 | sets / points mode branching + mode-correct winner | ✓ SATISFIED | scorePointsMode/scoreSetsMode; dispatch by DB scoringMode; 11+24 tests |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| mexicano.ts | 193, 200 | `return null` | ℹ️ Info | Legitimate gate logic (nothing-to-materialize / round-incomplete), not a stub — caller branches on null. No impact. |

No TBD/FIXME/XXX/TODO/PLACEHOLDER in any Phase-09 file. No empty handlers, no hardcoded empty data flowing to output.

### Human Verification Required

None. All four success criteria are verifiable programmatically (pure-function determinism + transactional behavior + test assertions). UI rendering of brackets/standings is Phase 11 scope, not Phase 9.

### Gaps Summary

No gaps. All four ROADMAP success criteria and all four requirements (FMT-01/02/03, SCORE-01) are objectively met in the codebase:

- Each format generates/updates its own structure at start/advancement (RR full schedule, americano full schedule, mexicano one-round-at-a-time materialization, playoff tree preserved unchanged).
- Result entry branches by `scoringMode` with mode-correct winner (sets without limit via generalized `setWinner`; points as two arbitrary ints).
- Playoff path is byte-for-byte unchanged (bracket.ts/result.ts last modified in Phases 04/05; 40+43 assertions intact).
- 354 assertions across 15 test scripts pass; `tsc --noEmit` exits 0.

The phase-context expectation of "≥354 assertions" is met exactly (354), confirming the SUMMARY's count is accurate (initial under-count in verification was a grep-format artifact, resolved on re-tally).

---

_Verified: 2026-06-07_
_Verifier: Claude (gsd-verifier)_
