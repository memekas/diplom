# Pitfalls Research

**Domain:** Single-elimination padel PAIRS tournament web app (Next.js TS full-stack + Prisma + SQLite, thesis-scope)
**Researched:** 2026-06-06
**Confidence:** HIGH (bracket/state-machine/partner-integrity from domain reasoning; stack gotchas verified against Prisma + Next.js docs)

> Scope reminder: thesis, no real load, single seeded admin, registration locks at exactly 4/8/16 pairs (no byes). Many "scale" pitfalls do NOT apply — flagged as such so they don't drive over-engineering.

## Critical Pitfalls

### Pitfall 1: Winner-advancement wiring (the slot-math bug)

**What goes wrong:**
Admin enters a winner for match `m` in round `r`, but the winner lands in the wrong slot of round `r+1` — or overwrites the other semifinalist. Classic symptom: in an 8-pair bracket, winners of matches 0 and 1 both get written into the same next-round slot, so one finalist silently disappears.

**Why it happens:**
The parent-match index is computed ad hoc. The correct relation is fixed: match index `i` in round `r` feeds match `floor(i / 2)` in round `r+1`, occupying slot `i % 2` (0 = top/home, 1 = bottom/away). Developers reinvent this per-handler and get the `/2` vs `%2` swapped, or use 1-based indices and break the math.

**How to avoid:**
- Store the bracket as a flat list of `Match` rows with explicit `round` (0-based) and `position` (0-based within round). Derive parent slot once in a single pure function `advance(round, position) => { round+1, floor(position/2), position % 2 }`. Unit-test it for 4/8/16.
- Persist `slot1PairId`/`slot2PairId` on the next match (two nullable FKs), not a single ambiguous "advanced pair" column.
- Generate ALL match rows up front at tournament start (round 0 filled with pairs, later rounds with null slots). Advancement is then an UPDATE into a pre-existing row, never an insert — removes the "where does this go" ambiguity.

**Warning signs:**
A final with only one pair; a pair appearing in two next-round matches; "winner button does nothing" because the target row didn't exist.

**Phase to address:**
Bracket generation + result-entry phase. Write `advance()` as a tested pure function before wiring any UI.

---

### Pitfall 2: Off-by-one in round count and bracket size

**What goes wrong:**
For 16 pairs the app renders 3 rounds instead of 4, or computes round 0 with 7 matches instead of 8. Final round never resolves a champion.

**Why it happens:**
`rounds = log2(pairs)` is correct (16 → 4, 8 → 3, 4 → 2), but people write `log2(pairs) - 1` or count matches as `pairs - 1` total and then mis-distribute per round. Floating-point `Math.log2(8)` can also return `2.9999...`.

**How to avoid:**
- Because sizes are constrained to {4, 8, 16}, just hardcode/lookup: `{4:2, 8:3, 16:4}` rounds and `pairs/2` matches in round 0. Don't compute what you can table-drive.
- Round `r` has `pairs / 2^(r+1)` matches. Assert total matches `= pairs - 1`.
- Use `Math.round(Math.log2(n))` if computing, never bare `Math.log2`.

**Warning signs:**
No champion after the last entered result; a round rendered with 1.5 matches; total match count not equal to `pairs - 1`.

**Phase to address:**
Bracket generation phase. Unit-test sizes 4/8/16 against expected round/match counts.

---

### Pitfall 3: Mutating / re-shuffling a started bracket

**What goes wrong:**
Admin (or a stray code path) edits pairs, re-seeds, or regenerates the bracket after matches have results — wiping progression, or a result entered then "re-generate bracket" nukes everything.

**Why it happens:**
No status gate. Bracket generation is exposed as a re-runnable action. Seeding/shuffle runs on every save instead of once at lock.

**How to avoid:**
- Generate the bracket exactly once on the `registration → in_progress` transition, inside a single transaction. After that, bracket structure is immutable; only `score`/`winnerId`/slot fills change.
- Guard generation: refuse if any `Match` rows already exist or status != `registration`.
- No "regenerate" button. If a redo is truly needed, it's a delete-tournament-and-recreate operation, not an in-place reshuffle.

**Warning signs:**
Results disappearing after an admin edit; pairs order changing between page loads; generation endpoint callable while `in_progress`.

**Phase to address:**
State-machine / tournament-status phase (transition guards) + bracket-generation phase.

---

### Pitfall 4: Status transitions not enforced server-side (state machine)

**What goes wrong:**
Registration accepted after start; results entered while still in `registration`; tournament jumps `draft → finished`. UI hides buttons but the server action still accepts the request.

**Why it happens:**
Status is treated as a display flag, not a guard. Transition logic lives only in React conditionals.

**How to avoid:**
- Model status as `draft → registration → in_progress → finished` and define allowed transitions in ONE server-side function. Every mutating server action re-checks current status from the DB inside its transaction (`draft` blocks joins, `registration` blocks results, `in_progress` blocks new joins, `finished` blocks all writes).
- Derive `finished` automatically when the final match gets a winner — don't rely on the admin to click "finish."
- Use a Prisma enum for status (supported on SQLite since Prisma 6.2.0 — see Pitfall 9).

**Warning signs:**
A pair joining a tournament that's already in progress; score saved on a draft tournament; status set by client-provided value.

**Phase to address:**
State-machine phase — build this before result entry and registration so both can lean on it.

---

### Pitfall 5: Results entered out of order

**What goes wrong:**
Admin enters a final/semifinal result before the feeding matches are decided — winner advances from an empty slot, or `winnerId` doesn't match either slot pair.

**Why it happens:**
Each match's result form is independent and doesn't check that both `slot1PairId` and `slot2PairId` are populated.

**How to avoid:**
- Reject a result unless both slots are filled AND `winnerId ∈ {slot1PairId, slot2PairId}`. Validate server-side.
- Optionally disable the form for matches with empty slots (UI nicety, not the guard).
- Allow editing a recorded result, but if you do, define whether it re-propagates downstream — simplest thesis choice: results are only editable while the next match has no result yet.

**Warning signs:**
`winnerId` not in either slot; advancement into a match whose own result already exists; a champion before the semifinals.

**Phase to address:**
Result-entry phase (validation lives next to `advance()`).

---

### Pitfall 6: Partner / pair registration integrity

**What goes wrong:**
- A player is in two different pairs in the same tournament.
- A player names a partner who isn't a registered user (or doesn't exist).
- A player partners themselves.
- Same pair registers twice.
- Partner is enrolled without consent (named unilaterally).

**Why it happens:**
Registration writes a `Pair` row from form input without uniqueness/identity checks. "Partner by email" with no existence check. No `player != partner` guard. Consent isn't modeled.

**How to avoid:**
- Enforce identity in the schema where possible: `Pair` has `tournamentId`, `playerAId`, `playerBId`. Add a DB-level uniqueness so a player can't appear twice in one tournament. SQLite/Prisma can't easily express "either column unique," so enforce it in the join transaction: `SELECT` existing pairs for the tournament, reject if `playerA` or `playerB` already participates.
- Validate `playerAId !== playerBId` (no self-partner) server-side.
- Resolve partner to an existing `User` (by email/id); reject unknown partner rather than silently creating.
- Wrap join in a transaction and re-check capacity + duplicates atomically (see Pitfall 7).
- Consent: thesis-acceptable to treat the registering player as authoritative for both (document this as a scope decision). If consent matters, model `Pair.status = pending → confirmed` with the partner confirming — but this is creep; default to no-consent and note it.

**Warning signs:**
Same player name in two bracket slots; a pair with identical playerA/playerB; partner field accepting free text; pair count exceeding capacity.

**Phase to address:**
Pair-registration phase. Build the duplicate/identity checks as a single validated transaction.

---

### Pitfall 7: Join race — over-capacity and double-register

**What goes wrong:**
Two pairs join simultaneously when one slot remains → 17th pair sneaks into a 16-cap tournament. Or the same player double-submits the join form and lands in two pairs.

**Why it happens:**
Check-then-insert without a transaction: `count pairs → if < cap → insert`. The count is stale by insert time.

**How to avoid:**
- Do the capacity check AND insert in one `prisma.$transaction`. Re-count inside the transaction; reject if at capacity.
- SQLite serializes writes (single-writer), which actually helps here — but only if both the count and insert are in the same transaction. A check in one request and insert in another still races.
- For double-submit, enforce the per-player-per-tournament uniqueness from Pitfall 6 inside the same transaction.

**Warning signs:**
Pair count > capacity; identical pair rows; intermittent "extra pair" only under fast clicking.

**Phase to address:**
Pair-registration phase. (Low real risk at thesis scale, but the transaction is cheap insurance and demonstrates correctness for the thesis.)

---

### Pitfall 8: Admin authorization checked only in the UI, not in server actions

**What goes wrong:**
Admin-only operations (create tournament, enter results, lock registration) are protected by hiding buttons. A logged-in non-admin POSTs directly to the server action / route handler and mutates data.

**Why it happens:**
Next.js App Router makes it easy to gate rendering (`if (role !== 'admin') return null`) and forget that server actions are publicly invocable endpoints. Auth is treated as a view concern.

**How to avoid:**
- Every mutating server action / route handler re-reads the session server-side and asserts `role === 'admin'` as its FIRST line — before any DB work. Centralize as `requireAdmin()` that throws/redirects.
- Don't trust any role/id coming from the client; derive identity from the session cookie only.
- Treat hidden UI as cosmetic, never as the security boundary.

**Warning signs:**
A server action with no session check; role read from form data or props; ability to curl a mutation with a non-admin cookie.

**Phase to address:**
Auth phase (build `requireAdmin()` / `requireUser()` helpers first) — then every later mutating action uses them.

---

### Pitfall 9: Prisma + SQLite specific gotchas

**What goes wrong:**
- Enums silently differ from Postgres expectations.
- `prisma migrate` in dev resets data unexpectedly, or schema drifts because someone hand-edited `dev.db`.
- Deleting a tournament fails or orphans `Match`/`Pair` rows (FK constraint / no cascade).
- "Concurrent writes" assumptions from Postgres don't hold.
- Storing score as a wrong type.

**Why it happens:**
SQLite has narrower capabilities than the Postgres mental model most Prisma tutorials assume.

**How to avoid:**
- **Enums:** Native enum support on SQLite exists since **Prisma ORM 6.2.0** (HIGH confidence, verified). Pin `prisma` ≥ 6.2 and use enums for `Role`, `TournamentStatus`, `CourtSide`. On older versions enums aren't supported on SQLite — would need `String` + app-level validation. Just use a current Prisma.
- **Migrations:** Use `prisma migrate dev` and commit the migration files; never hand-edit the SQLite file. Expect `migrate reset` to wipe data — keep a `seed` script (admin account) so reset is painless. For a thesis, this is fine.
- **Cascade deletes:** SQLite enforces FKs only when `PRAGMA foreign_keys=ON` (Prisma sets this per connection). Declare `onDelete: Cascade` on `Match.tournament`, `Pair.tournament` relations so deleting a tournament removes its matches/pairs in one go. Without it, delete throws an FK error or leaves orphans.
- **Concurrent writes:** SQLite is single-writer; concurrent write transactions can throw `SQLITE_BUSY`. At thesis load this is effectively never hit. Don't build retry/queue machinery for it — just keep write transactions short.
- **Score type:** Use `Int` for set/games counts or store the score as a `String` like `"6-3, 6-4"` plus a separate `winnerId`. **Avoid `Decimal`/`Float`** — Prisma `Decimal` on SQLite is stored as a numeric/REAL and brings precision quirks for no benefit here. Padel scores are integers/text.

**Warning signs:**
Migration prompts to reset on every run (drift); delete-tournament throwing FK errors; `Float` score showing `6.0000001`; enum value rejected at runtime on old Prisma.

**Phase to address:**
Schema/foundation phase (set Prisma version, FK cascade, enum decision, score type up front — these are expensive to change later).

---

### Pitfall 10: Stale bracket after entering a result (Next.js caching)

**What goes wrong:**
Admin saves a result; the public tournament/bracket page still shows the old state (winner not advanced) because the route was cached. Refreshes don't help until the cache window expires.

**Why it happens:**
App Router aggressively caches server-rendered data and the client Router Cache. A mutation in a server action doesn't automatically invalidate the read path.

**How to avoid:**
- Call `revalidatePath('/tournaments/[id]')` (or a `revalidateTag`) **inside the server action** right after the write commits. `revalidatePath` purges both the data cache and the client Router Cache, so the next load is fresh (HIGH confidence, verified against Next.js docs).
- Prefer doing mutations via server actions (form actions) so revalidation co-locates with the write.
- For genuinely live data you can also opt the bracket route out of caching (`export const dynamic = 'force-dynamic'` or `fetchCache`), but explicit `revalidatePath` after each result is the cleaner thesis approach.

**Warning signs:**
Bracket updates only after a hard reload / time delay; works locally (dev disables some caching) but stale in `next build && next start`. ALWAYS test caching against a production build, not dev.

**Phase to address:**
Result-entry phase (revalidation lives in the same action as the write). Add a "test against `next start`" item to verification.

---

### Pitfall 11: Server/Client component boundary mistakes

**What goes wrong:**
- Secrets / Prisma client imported into a Client Component → bundling error or leaked server code.
- The whole bracket marked `'use client'` to attach one button → loses server rendering, and now needs client-side data fetching.
- `useState`/`onClick` in a Server Component → runtime error.

**Why it happens:**
Unclear where the boundary should sit; defaulting everything to client to "make interactivity work."

**How to avoid:**
- Keep pages/bracket as Server Components that read via Prisma directly. Push only the interactive leaves (result-entry form, join form) into small Client Components, wired to server actions.
- Never import `@/lib/prisma` or anything reading env secrets into a `'use client'` file.

**Warning signs:**
"You're importing a component that needs useState…"; Prisma in a client bundle; data-fetching `useEffect` where a server read would do.

**Phase to address:**
Foundation / first-page phase (establish the boundary convention early).

---

### Pitfall 12: Leaking password hashes / unsafe admin seed

**What goes wrong:**
User queries return the `passwordHash` field to the client (in props or JSON). Or the admin is seeded with a plaintext/weak password, or credentials hardcoded in committed source.

**Why it happens:**
`prisma.user.findMany()` returns all columns by default; server components pass the whole object to the client. Seed scripts take shortcuts.

**How to avoid:**
- Always `select` explicit safe fields (never `passwordHash`) when data crosses to the client. Consider a `publicUser` mapper.
- Hash with bcrypt/argon2; never store plaintext.
- Seed admin from **env vars** (`ADMIN_EMAIL`, `ADMIN_PASSWORD`), hash in the seed script, and don't commit real credentials. Make the seed idempotent (`upsert`) so re-running doesn't duplicate the admin.
- Compare passwords with the hashing lib's `compare`, not `===`.

**Warning signs:**
`passwordHash` visible in page source / network response; admin password literal in the repo; seed creating duplicate admins on re-run.

**Phase to address:**
Auth phase + seed setup.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode round/match counts for {4,8,16} instead of general bracket algo | Simpler, fewer bugs | Can't support arbitrary sizes / byes | **Acceptable** — sizes are constrained by design |
| No partner-consent flow (registering player enrolls both) | Skips a whole confirm cycle | Partner can be enrolled unwillingly | Acceptable for thesis — document it as a decision |
| Score stored as free String `"6-3, 6-4"` | Trivial entry, flexible | Not queryable/validatable | Acceptable — winner is tracked separately and that's what advances |
| `select` everything from Prisma in server reads | Fast to write | Risk of leaking hash to client | **Never** for user records crossing to client |
| Auth check only in UI | Looks done in demo | Direct server-action exploit | **Never** |
| Skipping the join transaction | Less code | Over-capacity / double-register races | Borderline — transaction is cheap, just do it |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Prisma ↔ SQLite | Assuming Postgres features (enum on old version, true concurrency) | Pin Prisma ≥ 6.2 for enums; treat SQLite as single-writer; short write transactions |
| Prisma cascade | Expecting deletes to cascade automatically | Declare `onDelete: Cascade` on Match/Pair → Tournament relations |
| Next.js server action ↔ cache | Mutate without revalidating the read path | `revalidatePath` inside the action after commit |
| Auth lib ↔ server actions | Gate only the rendered page | `requireAdmin()` at the top of every mutating action |

## Performance Traps

> Thesis has no real load. These are listed only to explicitly say: **do not over-engineer for them.**

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N+1 queries loading bracket | Many small queries per match | One query with `include` for pairs/matches | Irrelevant at ≤16 pairs; ignore |
| SQLite single-writer contention | `SQLITE_BUSY` under concurrent writes | Short transactions | Effectively never at thesis scale — do NOT add retry queues |
| Forcing whole app dynamic to fix one stale page | Slower than needed | Use targeted `revalidatePath` instead | N/A — correctness > perf here |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Admin authz only in UI | Non-admin mutates tournaments via direct server-action call | `requireAdmin()` server-side in every mutating action |
| Returning `passwordHash` to client | Credential exposure | Explicit `select` of safe fields / public mapper |
| Hardcoded/committed admin credentials | Anyone reading repo is admin | Seed from env vars, hash, idempotent upsert |
| Trusting client-supplied role/userId | Privilege escalation | Derive identity from session only |
| Plaintext or `===` password compare | Account compromise | bcrypt/argon2 hash + lib `compare` |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Bracket shows stale state after result | Viewers think nothing happened | Revalidate after write; test on prod build |
| No feedback when registration is full | Player thinks join is broken | Explicit "tournament full / closed" state from server |
| Free-text partner field | Typos create phantom partners | Pick partner from existing users (resolve to a real account) |
| No visible tournament status | Confusion about whether it started | Show `draft/registration/in_progress/finished` badge |

## "Looks Done But Isn't" Checklist

- [ ] **Winner advancement:** Verify `advance()` against 4/8/16 brackets end-to-end to a single champion; assert no pair lands in two next-round slots.
- [ ] **Bracket caching:** Verify the public bracket updates immediately after a result on `next build && next start`, not just `next dev`.
- [ ] **Admin authz:** Verify each mutating server action rejects a non-admin session (test by calling it directly, not via the hidden UI).
- [ ] **Pair integrity:** Verify a player can't be in two pairs, can't self-partner, and an unknown partner is rejected.
- [ ] **Capacity:** Verify the (N+1)th pair is rejected, and the check+insert is transactional.
- [ ] **Status guards:** Verify joins rejected after start, results rejected before start, results rejected out of order.
- [ ] **Cascade delete:** Verify deleting a tournament removes its matches and pairs (no FK error, no orphans).
- [ ] **No hash leak:** Verify no `passwordHash` appears in any client payload.
- [ ] **Seed:** Verify re-running seed doesn't duplicate the admin and reads creds from env.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong advancement wiring | LOW (if `advance()` is isolated) | Fix the pure function, re-run; regenerate affected matches if structure was wrong |
| Over-capacity / duplicate pairs in DB | LOW at thesis scale | Manual delete of offending pair rows; add the missing transaction guard |
| Stale bracket caching | LOW | Add `revalidatePath` to the action; verify on prod build |
| Leaked password hash | MEDIUM | Add `select`, rotate any exposed credentials, re-seed admin |
| Mutated/corrupted started bracket | MEDIUM | Delete tournament (cascade) and recreate — cheap because no real data |
| Migration drift / hand-edited db | LOW (dev) | `prisma migrate reset` + re-seed |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Prisma/SQLite gotchas (enum, cascade, version, score type) | Foundation/schema | Schema declares cascade + enums; Prisma ≥6.2; delete-tournament test passes |
| Server/client boundary | Foundation/first page | No Prisma in client bundle; bracket renders server-side |
| Admin authz in server actions | Auth | `requireAdmin()` exists; direct-call test rejects non-admin |
| Password hash leak / safe seed | Auth | No hash in client payloads; idempotent env-based seed |
| Status state machine + transition guards | State-machine | Single transition fn; illegal transitions rejected server-side |
| Pair/partner integrity | Pair-registration | Self-partner/dup/unknown-partner all rejected |
| Join race / over-capacity | Pair-registration | (N+1)th rejected; check+insert in one transaction |
| Bracket generation: off-by-one, immutability, no reshuffle | Bracket-generation | 4/8/16 produce correct round/match counts; generation gated to once |
| Winner-advancement wiring | Result-entry | `advance()` unit-tested; full bracket resolves to one champion |
| Results out of order | Result-entry | Result rejected unless both slots filled and winner ∈ slots |
| Stale bracket after result | Result-entry | `revalidatePath` in action; fresh on prod build |
| Scope creep | All / planning | Out-of-scope list (PROJECT.md) enforced at each phase boundary |

## Scope-Creep Watchlist (thesis-specific)

These are explicitly out of scope per PROJECT.md — treat any of them appearing in a phase as a red flag:
- Byes / non-power-of-two seeding logic (registration locks at 4/8/16 — never needed).
- Other formats (round-robin, groups, double-elimination, singles random-pairing) — v2.
- Seeding/ranking, ratings, payments, notifications, mobile app.
- Caching/scaling infrastructure, `SQLITE_BUSY` retry machinery, generalized bracket engine.
- Partner-consent confirmation flow (default: registering player enrolls both; document the decision).
- Editable-result re-propagation logic beyond the simple "editable only while next match has no result" rule.

**Prevention:** At each phase boundary, check the work against PROJECT.md's Out-of-Scope list. Prefer table-driven {4,8,16} handling over any "general" algorithm. "Will this be reused in v2?" is NOT a reason to build it now.

## Sources

- Prisma Docs — SQLite connector & enum support (native enums since Prisma ORM 6.2.0): https://www.prisma.io/docs/orm/core-concepts/supported-databases/sqlite , https://www.prisma.io/docs/orm/reference/database-features (HIGH)
- Prisma issue history on SQLite enums (pre-6.2 workarounds): https://github.com/prisma/prisma/issues/2219 (MEDIUM, historical context)
- Next.js Docs — revalidatePath purges data + client Router Cache, call inside server actions: https://nextjs.org/docs/app/api-reference/functions/revalidatePath , https://nextjs.org/docs/app/getting-started/revalidating (HIGH)
- Next.js caching deep dive (App Router caching layers / stale-after-mutation): https://github.com/vercel/next.js/discussions/54075 (MEDIUM)
- Single-elimination bracket slot math (parent = floor(i/2), slot = i%2) — domain reasoning, verified against {4,8,16} arithmetic (HIGH)
- Pair-integrity and state-machine pitfalls — domain reasoning from the v1 requirements in PROJECT.md (HIGH)

---
*Pitfalls research for: single-elimination padel pairs tournament app (Next.js + Prisma + SQLite, thesis)*
*Researched: 2026-06-06*
