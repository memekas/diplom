# Phase 11: UX турниров (формы, ввод счёта, визуализация) — Research

**Researched:** 2026-06-07
**Domain:** Next.js 16 App Router UI wiring — Server Components (reads) + client form leaves (writes) onto already-shipped Phase 8–9 actions/services. Per-format tournament visualization (Tailwind 4, no UI-kit, no new deps).
**Confidence:** HIGH (entire backend verified shipped; this is presentation + thin read helpers; all claims grounded in `file:line` of the current codebase)

## Summary

Phase 11 is pure frontend wiring. The backend (Phases 8–9) is verified complete: every Server Action (`participateAction`, `participateSingleAction`, `removeRegistrationAction`, `finishTournamentAction`, `recordResultAction`, `startTournamentAction`, `createTournamentAction`, `updateProfileAction`) exists, is role-guarded, parses via zod, binds ids from the leaf, and calls a transactional service. `computeStandings` and the four format engines (`generateBracket`/`generateRoundRobin`/`generateAmericano`/`generateMexicanoRound1` + `recordRoundResult`) are shipped and tested (354 assertions green). **No backend logic changes are in scope.**

The work is: (1) extend three forms (create-tournament, register, profile) to expose the fields the schemas already accept; (2) branch the tournament detail page by `participantMode` (singles/pairs registration) and by `format` (playoff `BracketView` untouched vs new `RoundRobinView`/`RotationView`); (3) add the per-mode round-match score form; (4) wire admin remove/finish controls; (5) add **thin read-only helpers** (`listRounds` returning Round→RoundMatch→4 user FKs + scores, and `listTournamentPlayers`) because none exist yet; (6) read-only per-format rendering for finished tournaments (VIS-02).

**Two confirmed gaps requiring code (not just UI):** `birthDate` is NOT wired through Better Auth `additionalFields` in `auth.ts` (must add as `input: true` field + `registerSchema` field + form date input), and the register form's `skillLevel ?? "beginner"` default-slip (`register-form.tsx:52`) violates the "explicit required level" carry-forward (Phase 7 WR-01/IN-01) — make it a required `<select>` with a placeholder and drop the fallback.

**Primary recommendation:** Keep the detail page a Server Component; add `listRounds`/`listTournamentPlayers` to `tournament.ts` (or a new `rounds.ts`); render `format`-dispatched view components that all accept a `readOnly` prop so VIS-01 (active, with admin score forms) and VIS-02 (finished, no controls) reuse the same components. Do not touch `BracketView`, playoff `ScoreForm`, `bracket.ts`, `result.ts`, or any service write-path.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tournament detail render (metadata, participants, bracket/table/rounds) | Frontend Server (RSC) | Database (services) | `page.tsx` is `async` RSC querying Prisma via services directly; no API layer |
| Per-format visualization (BracketView / RoundRobinView / RotationView) | Frontend Server (RSC) | — | Pure presentational components fed flattened read shapes; no client state needed |
| Create / register / profile forms | Browser/Client (`"use client"` leaf) | API/Backend (Server Action) | Forms are `"use client"` leaves; submit to Server Actions which are the real boundary |
| Conditional create-form fields (show/hide by format+mode) | Browser/Client | — | Pure client `useState` on the selected format/scoringMode; no server round-trip |
| Score entry by mode (sets rows vs points pair) | Browser/Client (leaf) | API/Backend (`recordResultAction`) | Client renders inputs by mode; action re-reads mode from DB (authoritative) |
| Admin remove/finish controls | Browser/Client (leaf) | API/Backend (guarded actions) | Buttons bind ids from RSC; `requireAdmin()` is the boundary |
| `birthDate` at signup | Browser/Client (register form) | API/Backend (Better Auth `additionalFields`) | Signup goes through `authClient.signUp.email`; field must be declared `input:true` in `auth.ts` |
| Round/participant reads | Database (services) | Frontend Server | New thin `listRounds`/`listTournamentPlayers` read helpers; RSC consumes |

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Create form (FORM-01 + SCORE-02):** extend `create-tournament-form.tsx` for the extended `createTournamentSchema`: `format` select (`formatLabels`), `participantMode` select (`tournamentKindLabels`) — but americano/mexicano force singles (disabled/auto), `level` select (`skillLevelLabels`), participant count (playoff → select 4/8/16; others → number input), `price` (number, ₽), `scoringMode` select (sets/points). Conditional fields (SCORE-02): sets → `setsPerMatch`/`gamesPerSet` number inputs with NO upper cap; points → `targetPoints` number; americano/mexicano → `totalRounds` number. Client-side dynamic field visibility by format/scoringMode. Wire to existing `createTournamentAction`.
- **Participation UI (FORM-02b):** branch detail page + `participate-form.tsx` by `tournament.participantMode`: `pairs` → existing partner-nickname form → `participateAction`; `singles` → "Участвовать" button → `participateSingleAction`. Show RU errors (level_mismatch → «Ваш уровень не совпадает с уровнем турнира», wrong_mode, tournament_full, etc.). Render registered pairs (as now) + singles participants (`TournamentPlayer`).
- **Account registration (FORM-02a):** `register-form.tsx` — skill level is a REQUIRED select (5 RU, remove the «beginner» default-slip, placeholder «Выберите уровень»); add optional date-of-birth date input → wire through signup `additionalFields` (`birthDate`). Closes Phase 7 WR-01/IN-01.
- **Profile form (FORM-03a):** `profile-form.tsx` — expand to all `updateProfileAction` fields: ФИО (name), level (select), phone, birthDate (date), court side (`courtSideLabels`), nickname (with taken-error), email (with taken-error). RU labels.
- **Admin controls (FORM-03b):** detail page — for admin at `registration` stage: delete button per pair/participant → `removeRegistrationAction` (kind+id); at `in_progress`: «Завершить турнир» button → `finishTournamentAction`. RU, optional confirmation.
- **Result entry by mode (SCORE-02b):** `score-form.tsx` (or new round-score-form): branch by `tournament.format` + `scoringMode`: playoff → existing tennis-by-sets entry (`recordResultAction`) — DON'T break; round-based RoundMatch — sets mode → N score rows (number a/b), points mode → two point fields (a/b). Submit → `recordResultAction` (Phase 9 dispatcher already branches to `recordRoundResult`). Identifier = `roundMatchId`.
- **Visualization by format (VIS-01):** detail page renders by `tournament.format`: playoff → existing `BracketView` (via `listBracket`) — DON'T break; round_robin → match table (rounds × courts) + standings table (`computeStandings` unit table); americano/mexicano → rounds (current + past) + player rating (`computeStandings` player rating). Panels «Текущие игры» (unrecorded matches of latest/active round) and «Прошедшие игры» (recorded). Thin read-only helpers `listRounds`/`listRoundMatches` + `computeStandings`. This is READING, not engine logic.
- **Finished tournaments (VIS-02):** `/tournaments?status=finished` (filter shipped Phase 10) → finished list; finished detail page → match history by format (same per-format visualization in read-only mode, no entry controls). Optional `/tournaments/past` page — but filter + detail suffices.

### Claude's Discretion

- Exact layout of forms/tables/panels, client dynamics of conditional fields, mobile adaptation, RU wording, whether a separate round-score-form vs extending `score-form`, whether separate read functions vs inline queries — implementer's choice (Tailwind 4, Server Components + client leaves for forms, no UI-kit).

### Deferred Ideas (OUT OF SCOPE)

- Real realtime (websockets) — out of scope (`revalidatePath` suffices, PROJECT out-of-scope).
- Real club branding/logo — placeholder (Phase 10).
- Accumulated Phase 10 human-verify visual items — close in final UAT together with Phase 11.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FORM-01 | Create form: format, singles/pairs, participant level, count, price | `createTournamentSchema` + `parseTournamentForm` already accept all fields (`validation/tournament.ts:28-145`); `createTournamentAction` already wired (`admin/tournaments/actions.ts:43`). Form currently renders only name/size/date/location (`create-tournament-form.tsx:36-81`) — add the rest. Labels in `formatLabels`/`tournamentKindLabels`/`skillLevelLabels` (`validation/auth.ts:7-29`). |
| FORM-02 | Register: required level (5 RU) + birthDate; singles + pairs UI by tournament kind | Register: skillLevel required + birthDate need code (auth.ts + registerSchema). Participation branch on `tournament.participantMode`; `participateSingleAction` exists (`actions.ts:92`). |
| FORM-03 | Profile edits all fields + admin remove/finish controls | `updateProfileAction` + `profileSchema` accept all fields incl. email/birthDate (`validation/profile.ts:19-49`); form renders only courtSide/phone/skillLevel (`profile-form.tsx`). `removeRegistrationAction`/`finishTournamentAction` exist (`actions.ts:169,210`). |
| SCORE-02 | Create has scoringMode selector + (sets) counts no cap; entry branches by mode; score visualized by mode | `scoringMode`/`setsPerMatch`/`gamesPerSet`/`targetPoints`/`totalRounds` in schema. `parseRoundResultForm` expects `points_a`/`points_b` (points) or `set{n}_a`/`set{n}_b` (sets) (`validation/round-result.ts:22-73`). `recordResultAction` dispatches by DB format/mode (`format-engine.ts:63-94`). |
| VIS-01 | Active per-format visualization: playoff bracket, RR table, americano/mexicano standings/rounds; current/past panels | `BracketView` + `listBracket` exist. RR/americano/mexicano need new view components + new `listRounds` read helper (none exists). `computeStandings` shipped (`standings.ts:98`). |
| VIS-02 | Finished tournament view with per-format match history | Reuse the same view components in `readOnly` mode on finished detail page. `listTournaments({status:"finished"})` shipped (`tournament.ts:59`). |

## Standard Stack

### Core (already in project — NO new deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.x | App Router; RSC reads + Server Actions writes | [CITED: CLAUDE.md] Project stack; detail page is RSC, forms are `"use client"` leaves |
| React | 19.x | `useActionState`, `useState` for conditional fields | [CITED: CLAUDE.md] Bundled with Next 16 |
| Prisma 6.x / @prisma/client | 6.x | Read helpers query Round/RoundMatch/PlayerMatchScore | [CITED: CLAUDE.md] Existing services pattern |
| zod | 4.x | Client-side pre-validation (shares schema with action) | Existing forms call `parseProfileForm`/`parseTournamentForm` client-side for UX (`profile-form.tsx:27`, `create-tournament-form.tsx:19`) |
| Tailwind CSS 4 | 4.x | All layout (tables, round panels, forms) | [CITED: CLAUDE.md] No UI-kit; `BracketView` uses plain flex/grid (`bracket-view.tsx`) |
| better-auth | ^1.6 | `authClient.signUp.email` carries `additionalFields` incl. new `birthDate` | [CITED: CLAUDE.md] register flow uses `authClient` (`register-form.tsx:47`) |

**Installation:** None. No new packages. [VERIFIED: package.json — no install required; all deps present]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain Tailwind table/flex for standings & rounds | A bracket/table library | [CITED: CLAUDE.md "What NOT to Use"] explicitly forbids charting/bracket libs and UI kits for fixed layouts — do NOT add |
| New `listRounds` read helper | Inline `prisma.round.findMany` in `page.tsx` | CONTEXT marks this as discretion; a thin helper mirrors `listBracket`/`listTournamentPairs` convention and is testable. Recommend the helper. |

## Package Legitimacy Audit

No external packages are installed in this phase. All work uses dependencies already present and verified in prior phases. **Disposition: N/A — no installs.**

## Architecture Patterns

### System Architecture Diagram

```
                         Tournament Detail Page  (async RSC, public, no guard)
                                    │
          ┌─────────────────────────┼─────────────────────────────────┐
          │ getTournament(id)       │ getOptionalSession()             │
          │ (format/mode/scoring)   │ (userId, isAdmin)                │
          ▼                         ▼                                  ▼
   ┌──────────────┐   participants read by mode          format-dispatched VIEW
   │  metadata    │   ├ pairs   → listTournamentPairs ───┐  switch(tournament.format)
   │  (RU labels) │   └ singles → listTournamentPlayers* │  ├ playoff     → BracketView(listBracket)   [UNCHANGED]
   └──────────────┘                                      │  ├ round_robin → RoundRobinView(listRounds*, computeStandings units)
                                                          │  ├ americano   → RotationView(listRounds*, computeStandings players)
                                                          │  └ mexicano    → RotationView(listRounds*, computeStandings players)
                                                          │
   ADMIN controls (isAdmin):                              │  current games = matches of max(roundNumber) with pointsA/B null
   ├ registration: remove btn per pair/player ────────────┘  past games    = matches with pointsA/B non-null
   │    → removeRegistrationAction(tid, kind, id)
   ├ registration: StartTournamentForm → startTournamentAction
   ├ in_progress: score entry per format/mode
   │    playoff      → ScoreForm (sets) → recordResultAction        [UNCHANGED]
   │    round-based  → RoundScoreForm (mode) → recordResultAction
   │       points → points_a / points_b
   │       sets   → set{n}_a / set{n}_b
   │    → recordFormatResult dispatches by DB format/mode
   └ in_progress: «Завершить турнир» → finishTournamentAction

   * = NEW thin read helper to add (none exists today)

   FORMS (separate routes, "use client" leaves):
   register-form → authClient.signUp.email({..., skillLevel(required), birthDate*})  (*needs auth.ts wiring)
   profile-form  → updateProfileAction (all fields)
   create-form   → createTournamentAction (conditional fields by format/scoringMode)
```

### Recommended Project Structure (additions only)

```
src/
├── components/
│   ├── bracket-view.tsx          # UNCHANGED (playoff)
│   ├── round-robin-view.tsx      # NEW: rounds×courts table + unit standings table; readOnly prop
│   └── rotation-view.tsx         # NEW: americano/mexicano rounds (current+past) + player rating; readOnly prop
├── app/(public)/tournaments/[id]/
│   ├── page.tsx                  # EDIT: branch participants by mode, views by format, admin controls
│   ├── participate-form.tsx      # EDIT or split: pairs (nick) vs singles (button)
│   ├── round-score-form.tsx      # NEW: round-match entry by scoringMode (recommend separate from score-form.tsx)
│   ├── remove-registration-form.tsx  # NEW: admin delete-pair/player leaf
│   └── finish-tournament-form.tsx    # NEW: admin finish leaf
├── lib/services/
│   └── tournament.ts (or new rounds.ts)  # NEW: listRounds(), listTournamentPlayers()
```

### Pattern 1: Server Component page + `"use client"` form leaf, action `.bind()` ids

**What:** The detail page stays RSC; each interactive control is its own `"use client"` leaf that binds `tournamentId` (and `matchId`/`kind`/`id`) into the action so they are never client-tamperable.
**When to use:** Every write control on the detail page.
**Example:**
```tsx
// Source: src/app/(public)/tournaments/[id]/score-form.tsx:27-30 (existing pattern)
const [state, formAction, pending] = useActionState<RecordResultActionState, FormData>(
  recordResultAction.bind(null, tournamentId, matchId, setsPerMatch),
  null,
);
```
For the new singles participation, points-mode entry, remove, and finish leaves, mirror this exactly. `removeRegistrationAction` binds three values: `removeRegistrationAction.bind(null, tournamentId, kind, id)` (signature `actions.ts:169-175`). `finishTournamentAction.bind(null, tournamentId)` (`actions.ts:210`).

### Pattern 2: Conditional create-form fields via client `useState`

**What:** Read the selected `format` and `scoringMode` into local state and show/hide dependent fields. No server round-trip.
**When to use:** Create-tournament form (SCORE-02 conditional fields).
**Field-visibility rules (from `createTournamentSchema` superRefine, `validation/tournament.ts:53-91`):**

| Selected | Show | Hide / force |
|----------|------|--------------|
| `format=playoff` | `size` as select {4,8,16}; `participantMode` selectable | — |
| `format=round_robin` | `size` as number (≥3, ≤24); `participantMode` selectable | — |
| `format=americano` | `size` number (≥4, ≤24); `totalRounds` number | force `participantMode=singles` (disabled), force `scoringMode=points` |
| `format=mexicano` | `size` number (≥8, ≤24); `totalRounds` number (**required** — superRefine `:89`) | force `participantMode=singles`, force `scoringMode=points` |
| `scoringMode=sets` (playoff/RR) | `setsPerMatch`, `gamesPerSet` number inputs, no max | hide `targetPoints` |
| `scoringMode=points` | `targetPoints` number (optional; server defaults 24 for amer/mex) | hide `setsPerMatch`/`gamesPerSet` |

**FormData field names `parseTournamentForm` reads** (`validation/tournament.ts:117-133`): `name`, `format`, `participantMode`, `level`, `size`, `price`, `scoringMode`, `targetPoints`, `totalRounds`, `setsPerMatch`, `gamesPerSet`, `date`, `location`. Optional numerics use `formData.get(x) || undefined` — render them as empty-string-default inputs so blanks coerce to undefined.

**Note:** `createTournamentAction` calls `redirect()` on success (`admin/tournaments/actions.ts`), so the form does not need a success state — it navigates away.

### Pattern 3: Format-dispatched view + `readOnly` for VIS-01/VIS-02 reuse

**What:** One switch on `tournament.format` selects the view component. Each view takes `readOnly` (true on finished tournaments → no admin entry controls). VIS-01 (active) renders with `readOnly={!isAdmin}` semantics; VIS-02 (finished) renders `readOnly`.
**Example shape the views consume** (from `computeStandings`, `standings.ts:13-33,98-104`):
```ts
// players (americano/mexicano): { kind:"players"; format; players: PlayerStanding[] }
//   PlayerStanding = { userId; rank; played; wins; pointsFor; pointsAgainst; pointDiff }
// units (round_robin): { kind:"units"; format; units: UnitStanding[] }
//   UnitStanding = { unitId; kind:"pair"|"user"; rank; played; wins; losses; pointsFor; pointsAgainst; pointDiff }
```
`computeStandings(prisma, tournamentId)` is the ONLY standings call needed — it derives everything from RoundMatch + PlayerMatchScore on each call. `PlayerStanding.userId`/`UnitStanding.unitId` are ids only — to show names, join against the round read (which carries the 4 user FKs) or a small `userId→name` map from the new `listRounds`/`listTournamentPlayers` helper.

### Anti-Patterns to Avoid

- **Touching playoff path:** Do NOT modify `BracketView`, `score-form.tsx`, `listBracket`, `bracket.ts`, or `result.ts`. The playoff branch must remain byte-for-byte (Phase 9 verified `result.ts`/`bracket.ts` last touched Phases 04/05). Branch beside it.
- **Trusting client-supplied format/mode:** Don't send `format`/`scoringMode`/`setsPerMatch` to drive server logic — `recordFormatResult` re-reads them from the DB (`format-engine.ts:69-72`). The `_setsPerMatch` action param is intentionally unused (`actions.ts:253-255`); keep passing it only for positional bind compatibility.
- **Calling engine functions from UI:** Views are READ-only. Never call `materializeNextMexicanoRound`/`generateX` from a view — the next mexicano round is materialized inside `recordRoundResult` automatically (`round-result.ts:263-269`).
- **Importing prisma into a `"use client"` leaf:** Forms never import `@/lib/db` (existing rule, `participate-form.tsx:8` comment). Reads happen in the RSC.
- **Re-implementing "winner" in the UI:** match winner is derived server-side; for round-based, compare `pointsA`/`pointsB` for display only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Standings/ranking | Custom sort in the view | `computeStandings` (`standings.ts:98`) | Deterministic tiebreak chain is load-bearing for mexicano; already tested (12 assertions) |
| Mexicano next-round generation | UI trigger to build round r+1 | Automatic inside `recordRoundResult` (`round-result.ts:254-269`) | Materialization is transactional + gated; UI just re-renders after `revalidatePath` |
| Score validity (win-by-2, draw rules, target sum) | Client validation of game/point rules | `scorePointsMode`/`scoreSetsMode` server-side (`round-result.ts:63-131`) | Parser only shapes+integer-coerces (`validation/round-result.ts:9-11`); validity is the service's job |
| Email change | `prisma.user.update({email})` | `auth.api.changeEmail` (already in `updateProfileAction:68`) | Better Auth owns email + session cookie |
| Nickname-taken detection | Pre-check query | Catch P2002 → RU message (already in `updateProfileAction:48-49`) | No TOCTOU pre-check |

**Key insight:** Every domain rule already lives in a tested service. Phase 11 must only present results and collect input in the exact FormData shapes the parsers expect.

## Runtime State Inventory

Not a rename/refactor/migration phase. **N/A.**

## Common Pitfalls

### Pitfall 1: `birthDate` not wired through Better Auth signup
**What goes wrong:** Adding a `birthDate` `<input>` to the register form and passing it to `authClient.signUp.email` silently drops it — Better Auth only forwards declared `additionalFields`.
**Why it happens:** `auth.ts:18-25` declares `phone`/`skillLevel`/`nickname` only; `birthDate` is absent. `registerSchema` (`validation/auth.ts:31-48`) also lacks it.
**How to avoid:** Add `birthDate: { type: "date", required: false, input: true }` (or `type:"string"` if BA date coercion is unreliable for the SQLite adapter — verify) to `auth.ts` `user.additionalFields`; add `birthDate` to `registerSchema` using the same `z.union([z.literal(""), z.coerce.date()]).optional().transform(...)` trick already proven in `profileSchema` (`validation/profile.ts:45-48`) and `createTournamentSchema` (`validation/tournament.ts:42-45`); add a `<input type="date" name="birthDate">` to the form and pass it (spread conditionally like `phone`). [ASSUMED] BA `additionalFields` accepts `type:"date"` for the Prisma SQLite adapter — confirm against Better Auth docs before locking the `type`.
**Warning signs:** `prisma.user.birthDate` stays null after signup despite the form field.

### Pitfall 2: skillLevel default-slip on register (Phase 7 WR-01/IN-01)
**What goes wrong:** `register-form.tsx:52` sends `skillLevel: skillLevel ?? "beginner"` and the `<select>` (`:142-156`) is labeled «(необязательно)» with an `—` empty option — a user who doesn't choose silently becomes "beginner", which then fails level-equality at registration for any non-beginner tournament.
**How to avoid:** Make the `<select>` required, drop the `—`/empty option in favor of a disabled placeholder «Выберите уровень», make `registerSchema.skillLevel` required (`z.enum(skillLevels)` without `.optional()`), and remove the `?? "beginner"` fallback. CONTEXT locks this.
**Warning signs:** New users default to beginner; level mismatch errors at registration time.

### Pitfall 3: participantMode branch in registration UI
**What goes wrong:** Showing the partner-nickname form on a singles tournament (or the singles button on a pairs tournament) → server rejects with `wrong_mode` after the user fills it.
**Why it happens:** `participantMode` drives two different flows: `participateAction` (pairs, reads `player2Nickname`, `actions.ts:42`) vs `participateSingleAction` (singles, empty form, `actions.ts:92`).
**How to avoid:** Branch the registration section on `tournament.participantMode`. Note round_robin can be EITHER mode; americano/mexicano are ALWAYS singles. Render the participant LIST in two shapes too: pairs via `listTournamentPairs` (exists), singles via new `listTournamentPlayers`.
**Warning signs:** `wrong_mode` RU error after submit.

### Pitfall 4: `recordResultAction` FormData contract differs by mode
**What goes wrong:** Submitting `set1_a`/`set1_b` for a points tournament (or `points_a`/`points_b` for sets) → parser returns `{ ok:false, error:"Проверьте..." }`.
**Why it happens:** `parseRoundResultForm` (`validation/round-result.ts:22-73`) branches on `scoringMode`: points reads `points_a`/`points_b`; sets reads `set{n}_a`/`set{n}_b` for n=1..setsPerMatch (empty rows skipped, partial rows error). The action binds `matchId` = the `RoundMatch.id` (not playoff Match.id).
**How to avoid:** The round score form must render inputs by `tournament.scoringMode`: points → exactly two inputs named `points_a`/`points_b`; sets → up to `setsPerMatch` rows named `set{n}_a`/`set{n}_b` (mirror the existing playoff `ScoreForm` row naming, `score-form.tsx:54,63`). Bind `recordResultAction.bind(null, tournamentId, roundMatch.id, tournament.setsPerMatch)`.
**Warning signs:** Generic "Проверьте введённый счёт" on every submit.

### Pitfall 5: Identifying "current" vs "past" round matches
**What goes wrong:** Showing all matches as enterable, or showing finished matches in the "current" panel.
**Why it happens:** There is no per-match status column — recorded-ness is `pointsA != null && pointsB != null` (`standings.ts:178`, `round-result.ts:272`).
**How to avoid:** Past games = matches with `pointsA`/`pointsB` both non-null. Current games = unrecorded matches; for mexicano the "active" round is `max(roundNumber)` (only one materialized at a time), so current = unrecorded matches of the highest round. For round_robin/americano (all rounds pre-generated) treat any unrecorded match as enterable; optionally surface the lowest-numbered round with unrecorded matches as "current". Admins can edit recorded matches too (re-record is idempotent, `round-result.ts:238`) EXCEPT mexicano rejects editing a round once its successor exists (`stale_pairings`, `round-result.ts:198-208`) — show that RU error.
**Warning signs:** Mexicano edit fails with «следующий раунд уже сформирован».

### Pitfall 6: No `listRounds`/`listTournamentPlayers` read helper exists
**What goes wrong:** Assuming a helper exists and importing it.
**Why it happens:** `grep` confirms only `listBracket`, `listTournamentPairs`, `computeStandings`, and the generate/record services exist — no round LIST read.
**How to avoid:** Add thin read-only helpers (mirror `listBracket`/`listTournamentPairs` safe-select discipline). Recommended `listRounds` select: per Round `{ roundNumber }`, per RoundMatch `{ id, courtNumber, pointsA, pointsB, teamA1/A2/B1/B2 with user { id, name } }`, ordered `roundNumber asc, courtNumber asc`. Add `listTournamentPlayers(prisma, tournamentId)` → `TournamentPlayer` with `user { id, name, skillLevel, courtSide }` (mirror `playerSelect`, `registration.ts:204-209`). These are pure reads — NOT engine logic (CONTEXT).
**Warning signs:** Import error / undefined function.

### Pitfall 7: Dark-theme regression on copied form markup
**What goes wrong:** New forms copy `bg-red-100 text-red-800` (light) error styles from `score-form.tsx:43`/`create-tournament-form.tsx:33` instead of the dark variants `bg-red-900/40 text-red-300` used in `register-form.tsx:79` / `profile-form.tsx:44`.
**How to avoid:** Phase 10 enforced forced dark theme (SITE-02). Use the dark error/success classes (`bg-red-900/40 text-red-300`, `bg-green-900/40 text-green-300`) for any new or edited form. The existing `score-form.tsx`/`create-tournament-form.tsx` light classes are a latent Phase-10 carry-forward — fixing them when you touch those files is in-scope cleanup.
**Warning signs:** White error boxes on the dark page.

## Code Examples

### Round score form — mode branch (new component)
```tsx
// Field names MUST match parseRoundResultForm (validation/round-result.ts:26-66).
// points mode:
<input type="number" name="points_a" min={0} defaultValue={m.pointsA ?? ""} />
<input type="number" name="points_b" min={0} defaultValue={m.pointsB ?? ""} />
// sets mode (rows 1..setsPerMatch), mirroring score-form.tsx:54,63:
<input type="number" name={`set${n}_a`} min={0} />
<input type="number" name={`set${n}_b`} min={0} />
// bind:
recordResultAction.bind(null, tournamentId, roundMatch.id, tournament.setsPerMatch)
```

### Format dispatch in the RSC page
```tsx
// Source: pattern derived from page.tsx:166-191 + standings.ts:98
const standings = format !== "playoff" ? await computeStandings(prisma, id) : null;
const rounds   = format !== "playoff" ? await listRounds(prisma, id) : []; // NEW helper
// render:
{format === "playoff"     && <BracketView matches={await listBracket(prisma, id)} />}
{format === "round_robin" && <RoundRobinView rounds={rounds} standings={standings} readOnly={!isAdmin || finished} />}
{(format === "americano" || format === "mexicano") &&
   <RotationView rounds={rounds} standings={standings} readOnly={!isAdmin || finished} />}
```

### Admin remove control bind
```tsx
// removeRegistrationAction signature: (tournamentId, kind:"pair"|"player", id, prev, formData)
// actions.ts:169-175
removeRegistrationAction.bind(null, tournamentId, "pair", pair.id)    // pairs
removeRegistrationAction.bind(null, tournamentId, "player", tp.id)   // singles (TournamentPlayer.id)
```
**Note:** `removeParticipant` takes the `playerId` = `TournamentPlayer.id` (the row id), confirmed by `admin.ts:48-62` deleting `TournamentPlayer`. The action kind string for singles is `"player"` (`actions.ts:171,186`).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Detail page hardcodes "Single-elimination (пары)" + bracket only (`page.tsx:75,166-191`) | Format-dispatched views + mode-branched participation | Phase 11 | Replace hardcoded format label with `formatLabels[format]`; add metadata rows for level/price/scoringMode |
| Register form: optional skillLevel with beginner fallback | Required explicit level + birthDate | Phase 11 | Closes Phase 7 carry-forward |

**Deprecated/outdated:** none — all backend current as of Phases 8–9 (2026-06-07).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Better Auth `additionalFields` accepts `type:"date"` for the Prisma SQLite adapter (birthDate) | Pitfall 1 | If unsupported, birthDate must be `type:"string"` (ISO) and coerced; low risk — `profileSchema` already round-trips a Date through `birthDate` via prisma, so `type:"string"` is a safe fallback |
| A2 | `removeParticipant` expects `TournamentPlayer.id` (row id), not `userId` | Code Examples | Verified by `admin.ts:48-62` (deletes TournamentPlayer); pass the row id from `listTournamentPlayers`. Low risk. |
| A3 | "Current round" for mexicano = `max(roundNumber)` materialized | Pitfall 5 | Mexicano materializes one round at a time (`round-result.ts:254-269`); highest round is the active one. Low risk. |

## Open Questions

1. **Separate `round-score-form.tsx` vs extending `score-form.tsx`?**
   - What we know: CONTEXT marks this as Claude's discretion.
   - Recommendation: SEPARATE component. `score-form.tsx` is playoff-specific (sets only, playoff `Match.id`, MATCH-04 comments). A new `round-score-form.tsx` keeps the playoff path untouched and cleanly branches points/sets. Both call the same `recordResultAction`.

2. **Show participant/player names in standings tables?**
   - What we know: `computeStandings` returns ids only (`userId`/`unitId`).
   - Recommendation: build a `userId→name` (and pairId→"name1 / name2") map from the new `listRounds`/`listTournamentPlayers`/`listTournamentPairs` read and join in the view. No new service needed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node/Next dev+build | `next build`/`tsc` verification | ✓ | Next 16.2.x | — |
| Prisma client (generated) | read helpers | ✓ | 6.x | — |
| SQLite dev.db (seeded) | manual UAT | ✓ (reseedable) | — | `prisma migrate reset` + seed |

No external services. No missing dependencies.

## Security Domain

`security_enforcement: true`, ASVS L1, block on `high`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better Auth session cookie; `requireUser()`/`requireAdmin()` first line of every action (already shipped) |
| V3 Session Management | yes | Better Auth `nextCookies()`; `birthDate` addition does not alter session handling |
| V4 Access Control | yes | create/remove/finish/record = `requireAdmin()`; participate/profile = `requireUser()`; ids bound from leaf via `.bind()`, never from form body — all verified Phase 8 |
| V5 Input Validation | yes | zod on every action (`parseTournamentForm`/`parseProfileForm`/`parseRoundResultForm`/`registerSchema`); client pre-validation is UX-only, action re-validates |
| V6 Cryptography | no | No new crypto; password hashing owned by Better Auth |

### Known Threat Patterns for Next.js Server Actions + this UI

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tampered `format`/`scoringMode`/`setsPerMatch` to misroute write | Tampering | Server re-reads all three from DB (`format-engine.ts:69-72`); client value ignored (`_setsPerMatch` unused) |
| Tampered `matchId`/`pairId`/`playerId` to write/delete another row | Tampering / Elevation | ids bound from RSC via `.bind()`; services re-read status guards in-transaction |
| Non-admin POST to create/remove/finish/record | Elevation | `requireAdmin()` is the FIRST line; hidden UI is cosmetic |
| Raw Prisma error text leaking to client | Information Disclosure | Actions surface only typed RU messages; generic fallback otherwise (`actions.ts` throughout) |
| birthDate / PII exposure in reads | Information Disclosure | Read helpers use explicit safe `select` (no email/credential columns); mirror `playerSelect`/`safeProfileSelect`. Do NOT select birthDate into public participant lists. |
| Self/duplicate/level-mismatch registration | Business-logic / Tampering | Enforced transactionally in `registerPair`/`registerSingle`; UI only surfaces the typed RU errors |

**New-code security checklist for this phase:** new read helpers MUST use explicit safe `select` (never `*`, never email/password/birthDate into public lists); new form leaves MUST NOT import prisma; new admin leaves rely on the existing `requireAdmin()` actions (no new auth code); `birthDate` addition must keep `input:true` scoped to signup only and never expose it in `listTournamentPairs`/`listTournamentPlayers` public projections.

## Sources

### Primary (HIGH confidence)
- Codebase (`src/lib/services/*.ts`, `src/lib/validation/*.ts`, `src/app/**`, `prisma/schema.prisma`) — read directly this session, cited by `file:line` throughout
- `.planning/phases/08-backend-core/08-VERIFICATION.md`, `09-format-engines/09-VERIFICATION.md` — shipped action/service inventory (5/5 + 4/4 verified)
- `.planning/research/FORMATS.md` — per-format display semantics (RR table, americano/mexicano rating, points-to-target)
- `.planning/phases/11-tournament-ux/11-CONTEXT.md` — locked decisions
- `.planning/REQUIREMENTS.md` — FORM-01/02/03, SCORE-02, VIS-01/02 + traceability

### Secondary (MEDIUM confidence)
- `./CLAUDE.md` — stack constraints (no UI-kit, no new deps, RSC+Server Actions, Tailwind 4, Better Auth ^1.6)

### Tertiary (LOW confidence)
- A1 (Better Auth `type:"date"` additionalField) — not verified against live docs this session; safe `type:"string"` fallback documented

## Project Constraints (from CLAUDE.md)

- Tech stack fixed: Next.js 16 App Router (TS), Prisma 6.x, SQLite, Better Auth ^1.6, Tailwind 4. No new deps without asking.
- No UI component kit, no bracket/charting library — plain Tailwind flex/grid (explicit "What NOT to Use").
- Server Components for reads + Server Actions for writes; client only for interactive form leaves.
- Follow existing codebase patterns; check for reusable functions before writing new (here: `computeStandings`, `listBracket`, `listTournamentPairs`, label maps already exist).
- Simplicity / thesis scope — no premature optimization, no realtime, no caching.
- GSD workflow: edits must go through a GSD command.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; all components already in repo
- Architecture: HIGH — backend verified; pattern is the established RSC + client-leaf + bound-action
- Pitfalls: HIGH — each grounded in a specific `file:line` (birthDate gap, skillLevel slip, mode branch, FormData contract, missing read helper, dark-theme classes)
- Read helpers needed: HIGH — confirmed by grep that `listRounds`/`listTournamentPlayers` do not exist

**Research date:** 2026-06-07
**Valid until:** 2026-07-07 (stable internal codebase; only A1 Better-Auth date-field detail is external)
