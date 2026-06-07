# Phase 9: Движки форматов и подсчёта - Research

**Researched:** 2026-06-07
**Domain:** Tournament-format scheduling algorithms (round-robin circle method, americano/mexicano rotation), individual scoring, mode-dispatched result entry — backend services + tests, no UI
**Confidence:** HIGH (algorithms from FORMATS.md verified across sources; all schema/code claims grepped from the live repo this session)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Старт format-dispatch:** обобщить `startTournamentAction`/сервис по `tournament.format`:
  - `playoff` → существующий `generateBracket` (НЕ трогать).
  - `round_robin` → `generateRoundRobin`: circle-method (FORMATS.md §1) на units (units = Pair для `participantMode=pairs`, TournamentPlayer для singles). ВСЕ Round + RoundMatch сразу (stateless), single RR (D5). Нечётное N → BYE (sit-out, матч не создаётся). Shuffle units один раз.
  - `americano` → `generateAmericano`: circle-method на ИГРОКАХ (FORMATS.md §2), партнёр-once, ВСЕ раунды сразу; teamA1/teamA2 = партнёрство vs teamB1/teamB2; courtNumber = индекс корта; sit-outs по чётности/кратности 4.
  - `mexicano` → `generateMexicanoRound1`: раунд 1 случайный (shuffle → четвёрки → A=(p0,p1),B=(p2,p3)); последующие раунды НЕ на старте.
  - Все генераторы — одна транзакция как `generateBracket`; статус registration→in_progress через `transitionTournament`; generate-once (не пересоздавать при существующих Round/RoundMatch).
- **Ротация:** americano = фиксированное расписание (от результатов не зависит). mexicano = после полного завершения раунда r пересчитать кумулятивную таблицу, отсортировать (детерминированный тай-брейк), нарезать последовательные четвёрки по рейтингу, кросс-разведение **«1+4 vs 2+3»** (LOCKED: A=(s0,s3), B=(s1,s2) — ровные команды 5=5) → создать Round r+1 + его RoundMatch.
- **Ввод результата mode-dispatch (SCORE-01):** обобщить `recordResultAction` по `tournament.format`:
  - playoff → `recordResult` (НЕ трогать).
  - round-based → НОВЫЙ `recordRoundResult` (НЕ переиспользовать `recordResult` — авто-финиш по nextMatchId=null сломал бы round-based, FORMATS.md §5). Без playoff-advancement.
  - Ветвление по `scoringMode`: `points` = два целых на RoundMatch (pointsA/pointsB), без лимита, победитель = больше очков; для americano/mexicano опц. проверка суммы == targetPoints; равные очки в round_robin запрещены; для americano/mexicano ничья допустима (12:12). `sets` = произвольное число сетов/геймов, правило победы под настраиваемый gamesPerSet (win-by-2, тай-брейк gamesPerSet+1:gamesPerSet-1, gamesPerSet+1:gamesPerSet), победитель = большинство сетов.
- **Хранение sets-результата round-based:** проверить фактические поля RoundMatch; если хватает — использовать; иначе минимальная аддитивная миграция (флагнуть deviation), т.к. americano/mexicano points-каноничны (D3). НЕ ломать playoff SetScore.
- **PlayerMatchScore:** после записи результата писать строку для каждого участника; оба партнёра команды получают ОДНО командное `pointsFor`, `pointsAgainst` = очки соперника.
- **computeStandings:** americano/mexicano = рейтинг игроков (сумма личных очков desc; тай-брейк сумма → point diff → побед → стабильный фолбэк по id/нику). round_robin = таблица единиц (победы → set/game diff или point diff → личная встреча → id).
- **Завершение:** round_robin/americano = все RoundMatch всех раундов записаны → авто-finished. mexicano = след. раунд по gate (все RoundMatch текущего записаны); после roundNumber == totalRounds → finished. Ручной `finishTournament` доступен.
- **Carry-forward WR-02:** оценить `@@unique([roundId, courtNumber])` на RoundMatch (миграция минимальна); НЕ обязательно если генерация гарантирует уникальность.

### Claude's Discretion
- Выбор ОДНОЙ метрики вклада игрока для sets-режима round-based (геймы пары vs сеты пары) — задокументировать.
- Раскладка сервисных файлов (round-robin.ts / americano.ts / mexicano.ts / round-result.ts / standings.ts vs объединение).
- Общий код (setWinner/matchWinnerFromSets) выносить аккуратно без регрессии playoff.
- Точные тай-брейк-цепочки в пределах FORMATS.md §1-3.

### Deferred Ideas (OUT OF SCOPE)
- Визуализация (bracket/таблица RR/standings, панели текущие/прошедшие игры) — Фаза 11 (VIS-01).
- UI форм ввода результата по режиму (N сет-строк vs два поля очков) — Фаза 11 (SCORE-02).
- Локализация/тема/адаптив/главная/шапка — Фаза 10.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FMT-01 | При старте round-robin генерируется расписание «каждый-с-каждым» | Circle-method algorithm (FORMATS.md §1, reproduced below) mapped to Round/RoundMatch; `generateRoundRobin` mirrors `generateBracket` transaction pattern (Architecture Pattern 1 + 2) |
| FMT-02 | При старте/продвижении американо/мексикано — формирование+ротация составов + накопление индивидуальных очков | `generateAmericano` (circle on players, partner-once), `generateMexicanoRound1` + `materializeNextMexicanoRound` (gate + re-sort + 1+4vs2+3 cut). `PlayerMatchScore` written per result (Pattern 4) |
| FMT-03 | Админ вводит результаты → формируется след. раунд / обновляется standings — для каждого формата | `recordRoundResult` (separate from playoff `recordResult`), `computeStandings`, mexicano gate, round-based finish condition (Pattern 3 + 5) |
| SCORE-01 | Ввод/валидация результата ветвятся по scoringMode (sets / points); победитель по режиму | `points` = two ints on `RoundMatch.pointsA/pointsB`; `sets` = reuse generalized `setWinner`/`matchWinnerFromSets` (gamesPerSet param already exists). Storage decision below (no migration) |
</phase_requirements>

---

## Summary

Phase 9 is a **pure backend / services + tests** phase. Phase 7 already shipped the entire data model (`Round`, `RoundMatch` with 4 nullable User FKs, `PlayerMatchScore`, `TournamentPlayer`) and Phase 8 shipped registration + the config fields (`format`, `participantMode`, `scoringMode`, `targetPoints`, `totalRounds`, `gamesPerSet`, `setsPerMatch`). All the scoring primitives needed (`setWinner`, `matchWinnerFromSets` — already parameterized on `gamesPerSet`/`setsPerMatch`) exist in `result.ts`. **This phase writes no schema and ideally zero migrations** — it composes existing models and pure functions into format engines.

The work decomposes into: (1) three generators mirroring `generateBracket`'s transactional generate-once pattern; (2) one `recordRoundResult` service deliberately **separate** from playoff `recordResult` (whose `nextMatchId==null → finish` step would mis-fire on every round-based match — FORMATS.md §5); (3) `computeStandings` derived (not materialized) from `RoundMatch`/`PlayerMatchScore`; (4) the mexicano gate that materializes round r+1 only after round r is complete; (5) dispatch branches added to `startTournamentAction`/`recordResultAction` keyed on `tournament.format`, leaving the playoff path byte-for-byte untouched.

**Primary recommendation:** Store round-based results in BOTH modes as the existing `RoundMatch.pointsA`/`pointsB` integer pair (points = points; sets = **sets-won** by each side). No migration. Reuse `setWinner`/`matchWinnerFromSets` only to *validate the per-set games and derive sets-won counts* inside `recordRoundResult`, then collapse to the two integers. Per-set granularity (6:4 3:6) stays a playoff-only feature via `SetScore` — that is acceptable because americano/mexicano are points-canonical (D3) and the gap touches only `round_robin`+`sets`, where the standings tiebreaker degrades from game-diff to set-diff (documented, acceptable for a thesis).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Format generation (RR/americano/mexicano) | API/Backend (service) | DB (transaction) | Same tier as `generateBracket`; pure scheduling logic + one `$transaction` write |
| Rotation / next-round materialization (mexicano) | API/Backend (service) | DB | Depends on prior standings read from DB; deterministic compute then write |
| Result recording (round-based) | API/Backend (service) | DB | Mirror of `recordResult`; transactional write of `RoundMatch` + `PlayerMatchScore` |
| Standings computation | API/Backend (service) | DB (read) | Derived read, never materialized; pure aggregation over fetched rows |
| Format/mode dispatch | API/Backend (Server Action) | — | Thin branch on `tournament.format`/`scoringMode` in existing actions |
| Pure scheduling math (circle method, cut, cross-pair) | API/Backend (pure fn) | — | Prisma-free, exhaustively unit-tested like `advance`/`setWinner` |

---

## Standard Stack

No new packages. This phase is composed entirely from the existing stack.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @prisma/client | ^6.19.3 | DB access, `$transaction` | Already the project ORM [VERIFIED: package.json:19] |
| zod | ^4.4.3 | Result-form parsing/validation | Already used in `validation/result.ts`, `validation/tournament.ts` [VERIFIED: package.json:25] |
| tsx | ^4.22.4 | Test runner for `*.test.ts` | Established test convention (`npx tsx <file>.test.ts`) [VERIFIED: package.json:36, result.test.ts:2] |

### Supporting
None. No charting/bracket/scheduling library — the circle method and quad cut are ~20 lines of pure TS (CLAUDE.md "What NOT to Use": no bracket/charting library).

**Installation:** None required.

---

## Package Legitimacy Audit

No external packages are installed in this phase. Audit not applicable.

---

## Architecture Patterns

### System Architecture Diagram

```
                         Server Action (existing, +branch)
   ┌──────────────────────────────────────────────────────────────────┐
   │ startTournamentAction(format dispatch)   recordResultAction(format │
   │                                          + scoringMode dispatch)   │
   └───────────────┬──────────────────────────────────┬────────────────┘
                   │                                   │
        ┌──────────┴──────────┐              ┌─────────┴───────────┐
   format=='playoff'    format in            format=='playoff'   format in
        │              {rr,amer,mex}              │           {rr,amer,mex}
        ▼                   ▼                      ▼                 ▼
  generateBracket   generateRoundRobin       recordResult     recordRoundResult
   (UNCHANGED)      generateAmericano         (UNCHANGED)       (NEW)
                    generateMexicanoRound1                          │
                          │                                         │
                          │ reads participants                      │ scoringMode branch
                          ▼                                         ▼
              participantMode=='pairs'              ┌─── points: write pointsA/pointsB
                  → Pair rows (units)               │     winner = more points
              participantMode=='singles'            └─── sets: setWinner×N → matchWinnerFromSets
                  → TournamentPlayer rows                   → write sets-won to pointsA/pointsB
                          │                                         │
                          ▼                                         ▼
              circle-method / quad-cut             write PlayerMatchScore (2-4 rows,
              → Round + RoundMatch rows            both partners share team pointsFor)
                          │                                         │
                          └────────────┬────────────────────────────┘
                                       ▼
                          finish gate / mexicano materialize gate
                          - rr/amer: ALL RoundMatch recorded → transitionTournament→finished
                          - mex: round r complete → computeStandings → materializeNextMexicanoRound
                                 (or roundNumber==totalRounds → finished)
                                       │
                                       ▼
                       computeStandings(tournamentId)  [derived, called by Phase 11 UI]
                       reads RoundMatch + PlayerMatchScore, never materialized
```

### Recommended Project Structure
```
src/lib/services/
├── bracket.ts              # playoff generation (EXISTING, untouched)
├── result.ts               # playoff recordResult + setWinner/matchWinnerFromSets (EXISTING)
├── tournament-status.ts    # transitionTournament (EXISTING, reused as-is)
├── registration.ts         # registerPair/registerSingle (EXISTING — participant source)
├── format-engine.ts        # NEW — dispatch helpers: startFormat(), recordFormatResult()
├── round-robin.ts          # NEW — generateRoundRobin + circle-method pure fn
├── americano.ts            # NEW — generateAmericano + partner-once circle pure fn
├── mexicano.ts             # NEW — generateMexicanoRound1 + materializeNextMexicanoRound + quad cut/cross-pair pure fns
├── round-result.ts         # NEW — recordRoundResult (sets/points branch), shared sets-win helper
└── standings.ts            # NEW — computeStandings (player-rating + unit-table)
```
Discretion: the 5 NEW service files may be merged, but **keep pure scheduling math (circle method, quad cut, cross-pair) as exported Prisma-free functions** so they are unit-testable without a DB — this is the established `advance()`/`setWinner()` discipline [VERIFIED: bracket.ts:34-43, result.ts:44].

### Pattern 1: Generate-once transactional generator (mirror `generateBracket`)
**What:** Every generator runs in one `prisma.$transaction`, re-reads status inside the tx, guards generate-once via existing-row count, and flips status via `transitionTournament`.
**When to use:** All three generators.
**Example (verified shape from the live codebase):**
```typescript
// Source: src/lib/services/bracket.ts:74-170 (pattern to mirror)
export async function generateRoundRobin(prisma: PrismaClient, tournamentId: string) {
  return prisma.$transaction(async (tx) => {
    const t = await tx.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
      select: { id: true, status: true, format: true, participantMode: true, size: true },
    });
    if (t.status !== "registration") throw new FormatError("not_open", "...");
    if (t.format !== "round_robin") throw new FormatError("wrong_format", "...");
    // generate-once guard: any existing Round means already generated
    const existing = await tx.round.count({ where: { tournamentId } });
    if (existing > 0) throw new FormatError("already_generated", "...");

    // read participants by mode
    const units =
      t.participantMode === "pairs"
        ? (await tx.pair.findMany({ where: { tournamentId }, select: { id: true } })).map(p => ({ kind: "pair", id: p.id }))
        : (await tx.tournamentPlayer.findMany({ where: { tournamentId }, select: { userId: true } })).map(tp => ({ kind: "user", id: tp.userId }));

    const schedule = circleMethodSchedule(shuffle(units)); // pure fn, BYE-aware
    for (const round of schedule) {
      const r = await tx.round.create({ data: { tournamentId, roundNumber: round.number }, select: { id: true } });
      for (const m of round.matches) {
        await tx.roundMatch.create({ data: roundMatchData(t.participantMode, r.id, m) });
      }
    }
    await transitionTournament(tx as unknown as PrismaClient, tournamentId, "registration", "in_progress");
    return { tournamentId, roundsCreated: schedule.length };
  });
}
```

### Pattern 2: Mapping circle-method units → RoundMatch slots
**What:** RoundMatch has 4 nullable User FKs + courtNumber. Slot fill rule depends on format/mode:
- **pairs round_robin (1v1 of pairs):** `RoundMatch` reuses slots — `teamA1=pairA.player1Id, teamA2=pairA.player2Id, teamB1=pairB.player1Id, teamB2=pairB.player2Id` (the schema comment confirms this exact reuse) [VERIFIED: schema.prisma:273-277].
- **singles round_robin (1v1):** `teamA1=playerX, teamB1=playerY`, `teamA2/teamB2 = null`.
- **americano/mexicano (partnership):** `teamA1+teamA2` = the two partnered players, `teamB1+teamB2` = opponents.
**When to use:** Inside every generator's RoundMatch create.
**Note:** For pairs RR you must load `Pair.player1Id`/`player2Id` to fill the 4 FKs; carry the `Pair.id` only if you also want unit-level standings keyed by pair (recommended — see Standings).

### Pattern 3: `recordRoundResult` separate from playoff `recordResult`
**What:** New transactional service. Branches on `scoringMode`; never advances a bracket; never auto-finishes on `nextMatchId==null` (round-based RoundMatch has no such field). Writes `RoundMatch.pointsA/pointsB` + `PlayerMatchScore` rows, then evaluates the format-specific finish/materialize gate.
**When to use:** All round-based result entry.
**Why separate (critical):** playoff `recordResult` step 9 (`if (!match.nextMatchId) → finish tournament`) would fire on the FIRST round-based match because none have a parent pointer (FORMATS.md §5) [VERIFIED: result.ts:204-220].

### Pattern 4: Per-player score fan-out (`PlayerMatchScore`)
**What:** After deriving team scores `(pointsForA, pointsForB)`, write one `PlayerMatchScore` per non-null team member: both A-side players get `pointsFor=pointsForA, pointsAgainst=pointsForB, teamSlot="A"`; both B-side get the mirror. `@@unique([roundMatchId, userId])` means a re-record must `deleteMany({roundMatchId})` first (mirror of `SetScore` delete+recreate) [VERIFIED: schema.prisma:313, result.ts:171].

### Pattern 5: Mexicano gate + finish condition
**What:**
- After recording any RoundMatch, count recorded vs total RoundMatch in the current round. If all recorded AND `roundNumber < totalRounds`: `computeStandings` → cut → cross-pair → create Round r+1. If `roundNumber == totalRounds`: `transitionTournament → finished`.
- round_robin/americano: after recording, if ALL RoundMatch of ALL rounds recorded → `transitionTournament → finished`.
**When to use:** Tail of `recordRoundResult`, branched by format.
**Guard:** materialize-once — check Round r+1 doesn't already exist (concurrent double-record). Use the existing `@@unique([tournamentId, roundNumber])` on Round as the backstop [VERIFIED: schema.prisma:268].

### Verified circle-method algorithm (round_robin — FORMATS.md §1)
```
INPUT: units[] length n0
shuffle(units) ONCE (Fisher–Yates, like bracket.ts shuffle — Math.random only here)
if (n0 odd) units.push(BYE)              // BYE sentinel = null
n = units.length; rounds = n-1; half = n/2
arr = units.slice()                       // arr[0] fixed FOREVER; only tail [1..n-1] rotates
for r in 0..rounds-1:
  for i in 0..half-1:
    home = arr[i]; away = arr[n-1-i]
    if (home==BYE || away==BYE): that side SITS OUT, no match created
    else: RoundMatch(round=r+1, courtNumber=i, unitA=home, unitB=away)
  // rotate: fixed=arr[0]; tail=arr.slice(1); tail.unshift(tail.pop()); arr=[fixed,...tail]
INVARIANT: each unit meets each other exactly once. total matches = n0*(n0-1)/2.
```

### Verified americano algorithm (circle on PLAYERS — partner-once — FORMATS.md §2)
```
index players 0..N-1; pad BYE if odd. arr[0] fixed, rest rotate.
for r in 0..N-2:
  arr = [fixed] + ring
  PARTNERSHIPS: positions (i, N-1-i): (arr[0],arr[N-1]),(arr[1],arr[N-2]),... → N/2 partnerships
  COURTS: court k = partnership(2k) vs partnership(2k+1) → N/4 courts
  rotate ring by 1
Example N=4: R1 (0&3 vs 1&2), R2 (0&2 vs 3&1), R3 (0&1 vs 2&3).
Partner-once IS guaranteed; opponent-uniqueness is NOT (normal, not a bug).
Sit-outs: N≡0 mod4 → 0; odd → 1; N≡2 mod4 → 2 (extra partnership sits).
```

### Verified mexicano algorithm (FORMATS.md §3, D1 locked 1+4vs2+3)
```
ROUND 1: shuffle players; cut into consecutive quads [p0,p1,p2,p3];
         team A=(p0,p1), B=(p2,p3); court = quad index.
ROUNDS 2..R:
  1. recompute cumulative standings (sum of personal points over played rounds)
  2. sort all players desc by points, DETERMINISTIC tiebreak (mandatory — see Standings)
  3. cut into consecutive quads: group g = ranks[4g..4g+3]
  4. cross-pair "1+4 vs 2+3": A=(s0,s3), B=(s1,s2)   [LOCKED D1]
  5. assign group to court (g+1)
```

### Anti-Patterns to Avoid
- **Rotating arr[0] in the circle method** → duplicate/missing pairings. Fix: arr[0] is fixed forever (FORMATS.md §1 ⚠️).
- **Creating a real match for a BYE** → garbage row in standings. Do not create it (FORMATS.md §1 ⚠️).
- **Reusing playoff `recordResult`** → false auto-finish on first round match (FORMATS.md §5).
- **Materializing mexicano standings to a table** → drift; recompute every round (CONTEXT: standings computed, not stored).
- **Non-deterministic mexicano sort** → non-reproducible quad cut. Always append stable `id` fallback (CONTEXT).
- **Counting Pair for singles capacity/units** (Pitfall: registerSingle already counts `TournamentPlayer`, not `Pair` [VERIFIED: registration.ts:180]) — generators must read the same source.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Set validity (win-by-2 / 7:5 / 7:6, gamesPerSet param) | A new set-scoring rule for sets-mode round-based | `setWinner(gamesA, gamesB, gamesPerSet)` from result.ts | Already parameterized on gamesPerSet, exhaustively tested [VERIFIED: result.ts:44, result.test.ts:21-49] |
| Match winner from set list | New majority logic | `matchWinnerFromSets(setWins, setsPerMatch)` | Already handles even setsPerMatch reject + needed=ceil [VERIFIED: result.ts:63] |
| Status transition | Direct `tournament.update({status})` | `transitionTournament(...)` | Single forward-only guarded edge; re-reads DB [VERIFIED: tournament-status.ts:26] |
| Fisher–Yates shuffle | New shuffle | Copy the existing `shuffle<T>` from bracket.ts:60 | Same draw semantics; Math.random acceptable in a runtime service |
| Manual finish | New finish path | `finishTournament(...)` (already idempotent, format-agnostic) | Works for all formats — just another path to terminal state [VERIFIED: admin.ts:89-103] |

**Key insight:** The scoring primitives and the transactional generate-once skeleton already exist and are tested. Phase 9 is assembly, not invention — the only genuinely new logic is the three scheduling algorithms (all given step-by-step in FORMATS.md) and the standings aggregation.

---

## Runtime State Inventory

Not a rename/refactor/migration phase. Section omitted (greenfield service additions on an existing schema). No stored data, OS state, secrets, or build artifacts are renamed.

**Migration note:** The recommended design requires **NO Prisma migration** (results stored in existing `RoundMatch.pointsA/pointsB`; `PlayerMatchScore` exists). The only *optional* additive migration is WR-02's `@@unique([roundId, courtNumber])` on RoundMatch — **recommend SKIP**: generators assign `courtNumber` deterministically per round, so uniqueness is guaranteed by construction; adding the constraint is defense-in-depth only and is not required for correctness. If the planner wants the backstop, it is a single `@@unique` line + one `migrate dev` (flag as minimal additive deviation).

---

## Common Pitfalls

### Pitfall 1: Reusing playoff `recordResult` for round-based
**What goes wrong:** Tournament finishes after the first recorded round-based match.
**Why:** `recordResult` step 9 finishes the tournament whenever `match.nextMatchId == null`; round-based matches have no parent pointer [VERIFIED: result.ts:204-220].
**How to avoid:** Separate `recordRoundResult`. **Warning sign:** a 2-round americano going `finished` after match 1.

### Pitfall 2: Mexicano non-determinism in the quad cut
**What goes wrong:** Equal-points players sort differently across calls → different quads → non-reproducible bracket.
**Why:** Sort without a stable final key.
**How to avoid:** Tiebreaker chain MUST end in a stable `id` (userId) comparison. **Warning sign:** test that records identical results twice and re-cuts produces different teams.

### Pitfall 3: Units/capacity source mismatch (pairs vs singles)
**What goes wrong:** Generator reads `Pair` for a singles tournament (or vice versa) → 0 units or wrong count.
**Why:** Two participant tables (`Pair`, `TournamentPlayer`); registration picks by `participantMode` [VERIFIED: registration.ts:82,166].
**How to avoid:** Branch unit-loading on `tournament.participantMode`, exactly as registerPair/registerSingle do. **Warning sign:** RR generates 0 rounds.

### Pitfall 4: Points-mode draw in round_robin
**What goes wrong:** `21:21` produces no winner; standings "wins" count breaks.
**Why:** Two arbitrary ints can be equal; `setWinner` cannot return a draw.
**How to avoid:** Validate in zod / `recordRoundResult`: reject equal points for round_robin+points (D2); ALLOW equal for americano/mexicano (12:12 is canonical, FORMATS.md §2). **Warning sign:** standings with a unit that has neither win nor loss for a recorded match.

### Pitfall 5: Forgetting BYE for odd N
**What goes wrong:** Wrong round count, a unit never sits.
**Why:** Circle method needs even n.
**How to avoid:** `if (n0 odd) push BYE`; skip match creation when either side is BYE. **Warning sign:** test asserting each-meets-each fails for odd N.

### Pitfall 6: PlayerMatchScore re-record duplication
**What goes wrong:** Second result entry throws on `@@unique([roundMatchId, userId])` or doubles points.
**Why:** Free-edit must replace, not append [VERIFIED: schema.prisma:313].
**How to avoid:** `deleteMany({where:{roundMatchId}})` before recreating (mirror SetScore delete+recreate, result.ts:171).

---

## Code Examples

### Sets-mode round-based: validate via setWinner, collapse to two integers
```typescript
// Source: reuses src/lib/services/result.ts:44,63 (setWinner / matchWinnerFromSets)
// sets-mode round-based stores sets-won (not per-set rows) into RoundMatch.pointsA/pointsB
function scoreSetsMode(sets: SetInput[], gamesPerSet: number, setsPerMatch: number) {
  const perSet: Side[] = [];
  let setsWonA = 0, setsWonB = 0;
  for (const s of sets) {
    const side = setWinner(s.gamesPair1, s.gamesPair2, gamesPerSet); // throws invalid_set
    perSet.push(side);
    side === "A" ? setsWonA++ : setsWonB++;
  }
  const winner = matchWinnerFromSets(perSet, setsPerMatch); // null → reject no_winner
  return { pointsA: setsWonA, pointsB: setsWonB, winner }; // pointsA/B = sets-won
}
```

### Points-mode round-based winner
```typescript
// Source: FORMATS.md §1/§2 — two arbitrary non-negative ints
function scorePointsMode(pointsA: number, pointsB: number, format: string, targetPoints?: number) {
  if (pointsA < 0 || pointsB < 0) throw new RoundResultError("invalid_points", "...");
  if (format === "round_robin" && pointsA === pointsB)
    throw new RoundResultError("draw_not_allowed", "Ничья в round-robin не допускается"); // D2
  if (targetPoints !== undefined && pointsA + pointsB !== targetPoints)
    throw new RoundResultError("bad_sum", `Сумма очков должна быть ${targetPoints}`); // optional amer/mex check
  const winner = pointsA === pointsB ? null : pointsA > pointsB ? "A" : "B"; // null = draw (amer/mex ok)
  return { pointsA, pointsB, winner };
}
```

### Test harness (mirror existing fake-prisma)
```typescript
// Source: src/lib/services/result.test.ts:5-18, 155-158 — self-contained, npx tsx
import assert from "node:assert/strict";
let passed = 0;
function check(name: string, fn: () => void) { fn(); passed++; console.log(`  ok - ${name}`); }
// fake prisma: $transaction:(fn)=>fn(tx); tx implements only the methods the service calls.
// Run: npx tsx src/lib/services/round-robin.test.ts  (exits non-zero on assertion failure)
```

---

## State of the Art

Not applicable — no library-version churn in scope. Algorithms (round-robin circle method, americano/mexicano) are stable, well-documented social-padel formats; FORMATS.md verified them against multiple federation/community sources (confidence HIGH) [CITED: .planning/research/FORMATS.md §7].

**Deprecated/outdated:** None relevant to this phase.

---

## Standings tiebreaker chains (CONTEXT + FORMATS.md §1-3)

### americano / mexicano (player rating)
`sum of personal pointsFor (desc)` → `point diff (sum pointsFor − sum pointsAgainst)` → `number of wins` → **stable `userId` fallback** (mandatory for mexicano determinism).

### round_robin (unit table — pair or player)
- **sets mode:** `match wins` → `set diff (setsWonFor − setsWonAgainst)` → `personal head-to-head` → `id`.
  *(Note: per-game tiebreaker — FORMATS.md §1 levels 4-5 game diff/games won — is UNAVAILABLE under the no-migration design because round-based sets store only sets-won, not per-game. Acceptable degradation; document on defense.)*
- **points mode:** `match wins` → `point diff (pointsFor − pointsAgainst)` → `total points for` → `head-to-head` → `id`.

**Win/loss derivation for the unit table:** in sets mode, unit win = it took the majority of sets in that RoundMatch (`pointsA > pointsB` since pointsA/B store sets-won); in points mode, win = more points (draws rejected by D2). `computeStandings` reads `RoundMatch` (pointsA/pointsB + the 4 FKs to map to units) and/or `PlayerMatchScore`. For pairs RR, key units by `Pair.id` — recommend loading pair membership so two players map to one unit row.

### Sets-mode contribution metric for round-based (Discretion → DECIDED)
**Use sets-won as the per-player `pointsFor` contribution** (not games-won) in sets mode, consistent with the `RoundMatch.pointsA/pointsB = sets-won` storage decision. This keeps `PlayerMatchScore.pointsFor` and `RoundMatch.pointsA` consistent and avoids loading per-game data that the no-migration design doesn't store. Document: "sets-mode americano/mexicano is a non-canonical project extension (D3); player contribution = sets won."

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Storing sets-mode round-based results as sets-won in `pointsA/pointsB` (no per-game rows) is acceptable | Summary / Storage | round_robin+sets loses game-diff tiebreaker; only affects tie resolution, not correctness. LOW — D3 makes amer/mex points-canonical |
| A2 | Pairs round_robin keys standings by `Pair.id` (not by reconstructing pairs from the 4 User FKs) | Standings | If planner prefers FK-derived grouping, standings code differs slightly. LOW |
| A3 | `@@unique([roundId, courtNumber])` (WR-02) is unnecessary because courtNumber is deterministic per round | Runtime State Inventory | If a concurrency backstop is desired, a 1-line additive migration is needed. LOW |
| A4 | americano `totalRounds` should equal N−1 (circle rounds); mexicano `totalRounds` is admin-set (Phase 8 field) | Generators | If admin's `totalRounds` disagrees with circle count for americano, generator must reconcile (recommend: derive americano rounds from N−1, ignore/validate totalRounds). MEDIUM — confirm in plan |
| A5 | Optional `sum == targetPoints` check for americano/mexicano points is advisory, not enforced | Code Examples | If enforced strictly, admins entering 15:9 for target 24 are blocked; recommend advisory only. LOW |

---

## Open Questions

1. **americano `totalRounds` vs circle-derived round count (A4)**
   - What we know: Phase 8 added `Tournament.totalRounds Int?`; circle method on N players yields exactly N−1 rounds (even N) for full partner-once.
   - What's unclear: whether admin's `totalRounds` should cap/override the schedule.
   - Recommendation: For americano, derive rounds = N−1 (full rotation) and treat `totalRounds` as informational; for mexicano, `totalRounds` is authoritative (admin chooses how many rounds to play). Confirm in plan.

2. **Pairs round_robin standings unit identity (A2)**
   - What we know: RoundMatch stores 4 User FKs; the original `Pair.id` is not stored on RoundMatch.
   - What's unclear: how to map a RoundMatch back to its two `Pair` rows for unit standings.
   - Recommendation: Either (a) for pairs RR also persist a lightweight mapping (e.g. derive pair from the (player1,player2) FK tuple by querying Pair), or (b) accept that for pairs RR standings are computed per the FK tuple. Recommend (a) — query `Pair` by `(tournamentId, player1Id)` to recover pair identity. Plan should pick one.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node + tsx | Running `*.test.ts` | ✓ | tsx ^4.22.4 | — |
| @prisma/client (generated) | All services | ✓ | ^6.19.3 (client generated, per Phase 7 note) | — |
| SQLite dev.db | Integration-style tests (optional) | ✓ (local file) | — | fake-prisma in-memory (preferred — no DB needed) |

No missing dependencies. Unit tests use the in-memory fake-prisma pattern and need no live DB.

---

## Validation Architecture

> `.planning/config.json` not inspected for `nyquist_validation`; treating as enabled (default). The project already uses self-contained `*.test.ts` assertion scripts as its validation mechanism.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None (self-contained `node:assert/strict` scripts via tsx) [VERIFIED: result.test.ts:1-18] |
| Config file | none |
| Quick run command | `npx tsx src/lib/services/<file>.test.ts` |
| Full suite command | run each `*.test.ts` (8 scripts today, 224 assertions baseline per CONTEXT) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FMT-01 | Circle method: each-meets-each, correct match count, odd-N BYE, no arr[0] rotation bug | unit (pure fn) | `npx tsx src/lib/services/round-robin.test.ts` | ❌ Wave 0 |
| FMT-02 | Americano partner-once (N=4/8/12/16, 0 dup partners); mexicano R1 cut; materialize gate | unit (pure fn + fake-prisma) | `npx tsx src/lib/services/americano.test.ts`, `.../mexicano.test.ts` | ❌ Wave 0 |
| FMT-02 | Mexicano cut determinism (equal points → stable quads via id fallback) | unit (fake-prisma) | `.../mexicano.test.ts` | ❌ Wave 0 |
| FMT-03 | round-based finish when all matches recorded; mexicano next-round materialization gate | unit (fake-prisma) | `.../round-result.test.ts` | ❌ Wave 0 |
| FMT-03 | computeStandings ordering + tiebreakers (player rating + unit table) | unit (fake-prisma/pure) | `.../standings.test.ts` | ❌ Wave 0 |
| SCORE-01 | points winner (more points), draw rejection (rr) / allowance (amer/mex); sets winner via setWinner/matchWinnerFromSets | unit | `.../round-result.test.ts` | ❌ Wave 0 |
| (regression) | playoff bracket + result + Phase 8 tests stay green (224 assertions) | unit | run existing 8 `*.test.ts` | ✅ exists |

### Sampling Rate
- **Per task commit:** run the new `*.test.ts` for the touched service.
- **Per wave merge:** run ALL `*.test.ts` (new + existing 8) — the 224-assertion baseline must remain green (CONTEXT invariant).
- **Phase gate:** full suite green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/lib/services/round-robin.test.ts` — FMT-01 circle method completeness + odd-N BYE
- [ ] `src/lib/services/americano.test.ts` — FMT-02 partner-once invariant
- [ ] `src/lib/services/mexicano.test.ts` — FMT-02 R1 cut, materialize gate, cut determinism
- [ ] `src/lib/services/round-result.test.ts` — FMT-03/SCORE-01 points & sets recording, finish gate
- [ ] `src/lib/services/standings.test.ts` — FMT-03 standings order + tiebreakers
- [ ] No framework install needed — reuse the fake-prisma harness from `result.test.ts`.

---

## Security Domain

> `security_enforcement` not found in config; treating as enabled. This phase adds no new auth surface — it extends two existing admin-guarded Server Actions.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | reuse | Better Auth session; unchanged |
| V4 Access Control | yes | `requireAdmin()` is FIRST line of `startTournamentAction`/`recordResultAction` and stays first line; format/mode branches run AFTER the guard [VERIFIED: actions.ts:123,243] |
| V5 Input Validation | yes | zod parse of result form before service; service re-validates (setWinner / points bounds) — DB-authoritative, never trusts client (mirror of recordResult T-05-06) |
| V6 Cryptography | no | none |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tampered `format`/`tournamentId` in form to misroute write | Tampering | `tournamentId` bound via `.bind(null, ...)` from leaf, never from body; `format`/`participantMode`/`scoringMode` re-read from DB inside the service tx, never trusted from client [VERIFIED: actions.ts:130,236; registration.ts:82] |
| Non-admin direct POST to start/record | Elevation of Privilege | `requireAdmin()` first line, throw NOT caught [VERIFIED: actions.ts:123,243] |
| Raw Prisma error text leaked to client | Information Disclosure | Typed error classes (`FormatError`/`RoundResultError` mirroring `BracketError`/`ResultError`) mapped to RU messages; generic fallback otherwise [VERIFIED: bracket.ts:14, result.ts:17] |
| Concurrent double-start / double-materialize | Tampering/race | generate-once via existing-row count + `@@unique([tournamentId, roundNumber])` backstop (mirror of WR-01) [VERIFIED: schema.prisma:268, bracket.ts:99] |

---

## Sources

### Primary (HIGH confidence)
- `prisma/schema.prisma` (lines 122-316) — Tournament config fields, Round, RoundMatch (4 nullable User FK + pointsA/pointsB), PlayerMatchScore (pointsFor/pointsAgainst + @@unique), TournamentPlayer
- `src/lib/services/bracket.ts` (34-170) — generate-once transactional pattern, shuffle, advance
- `src/lib/services/result.ts` (44-224) — setWinner (gamesPerSet param), matchWinnerFromSets, recordResult (incl. the nextMatchId==null auto-finish to avoid)
- `src/lib/services/tournament-status.ts` (26-53) — transitionTournament forward-only guard
- `src/lib/services/registration.ts` (65-200) — participant source by participantMode (Pair vs TournamentPlayer)
- `src/lib/services/admin.ts` (89-103) — finishTournament idempotent, format-agnostic
- `src/app/(public)/tournaments/[id]/actions.ts` (118-265) — startTournamentAction / recordResultAction dispatch points, admin guards
- `src/lib/validation/tournament.ts` (19-85) — format/mode tuples, size superRefine
- `src/lib/validation/result.ts` (25-62) — result-form parser shape
- `src/lib/services/result.test.ts` (1-168) — fake-prisma test harness pattern
- `.planning/research/FORMATS.md` §1-3, §5, §6 — verified algorithms + backend warnings + decisions D1-D7
- `.planning/phases/09-format-engines/09-CONTEXT.md` — locked decisions
- `package.json` — versions (Next 16.2.7, Prisma ^6.19.3, zod ^4.4.3, tsx ^4.22.4)

### Secondary (MEDIUM confidence)
- FORMATS.md §7 source list (federation / community padel sites) — algorithm cross-verification (already done by the FORMATS research workflow)

### Tertiary (LOW confidence)
- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all reused from grepped package.json
- Architecture: HIGH — mirrors existing, verified `generateBracket`/`recordResult` patterns line-by-line
- Algorithms: HIGH — FORMATS.md provides step-by-step verified pseudocode for all three formats
- Storage decision (sets-mode round-based): MEDIUM — A1 is a deliberate simplification; correct but degrades one tiebreaker
- Pitfalls: HIGH — derived from FORMATS.md §5 + live code reads

**Research date:** 2026-06-07
**Valid until:** 2026-07-07 (stable — internal algorithms + pinned deps; no fast-moving external dependency)
