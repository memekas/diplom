# Feature Research

**Domain:** Padel doubles tournament organization web app (single-org admin, single-elimination playoff)
**Researched:** 2026-06-06
**Confidence:** HIGH (domain conventions verified; scope decisions already locked in PROJECT.md)

## Domain Background (verified)

### How single-elimination (playoff / "Olympic system") brackets work

A single-elimination bracket is a binary tree. With N participants (N = power of 2), there are
`log2(N)` rounds and `N-1` total matches. Each match has two slots; the winner advances to a
specific parent match (`nextMatchId`), the loser is eliminated.

- **4 pairs** → 2 rounds (Semifinals, Final), 3 matches.
- **8 pairs** → 3 rounds (Quarterfinals, Semifinals, Final), 7 matches.
- **16 pairs** → 4 rounds (Round of 16, QF, SF, Final), 15 matches.

**Seeding / placement** (verified, MEDIUM): the standard "seeded" layout pairs strongest vs
weakest so top seeds meet late — 8-bracket pairs are 1v8, 2v7, 3v6, 4v5. **For a thesis with no
ranking system, seeding is irrelevant — random placement of pairs into slots is the correct,
simplest choice.** No ELO, no prior results to seed from.

**Bracket data model** (the load-bearing shape downstream):
- `Match { id, tournamentId, round, slotIndex, pairAId?, pairBId?, winnerPairId?, score?, nextMatchId? }`
- A match slot is `TBD` until both feeder matches resolve. UI shows pair name or "TBD".
- Advancement = on result entry, set `winnerPairId`, then write that pair into the parent match's
  open slot (slot determined deterministically from `slotIndex`).
- Because N is always a power of 2, **there are no byes** — every first-round slot is filled. This
  is the single biggest simplification the 4/8/16 constraint buys (verified: byes only exist for
  non-power-of-2 counts).

**Generation strategy (recommended):** generate the full match tree empty at tournament start
(when registration closes / admin "starts" it), wire `nextMatchId` links, then drop the locked
pairs into round-1 slots in random order. First-round matches become playable; later rounds fill
as winners advance. This avoids any runtime bracket-shape computation in the UI.

### Padel scoring conventions (verified)

Real padel uses tennis-style scoring: points 15/30/40/game, 6 games (lead by 2) = set,
6-6 → tie-break, best of 3 sets, often a "golden point" at 40-40. This is rich and irrelevant
to the thesis core mechanic.

**Recommendation (matches the locked PROJECT.md decision):** store the result as a free-text
**score string + an explicit winner** (`score: "6-3, 6-4"`, `winnerPairId`). The winner field is
the source of truth for advancement; the score string is display-only and not parsed/validated.
This sidesteps set/game/tiebreak modeling entirely while still looking like real padel. Do **not**
build structured per-set scoring, golden-point logic, or score validation for v1.

### Pair / partner registration UX (verified + recommendation)

Mature platforms (USTA Serve Tennis, UTR, pickleballtournaments) use a **mutual** flow: player A
invites player B by ID, B gets an email and must **accept** before the team is valid; or one
player registers and pays for both. This exists to prevent people from being entered without
consent and to handle payment.

**Neither concern applies here** (no payments, notifications explicitly out of scope, single
trusted org, thesis). The mutual-confirmation flow would force building invitations, pending
states, accept/decline, and notifications — directly contradicting scope.

**SIMPLEST VIABLE MODEL (recommended): one-sided declaration.**
The registering player clicks "Participate" and names the partner. PROJECT.md already says
"указывает партнёра" — a one-sided declaration. Two viable sub-variants:

| Variant | How partner is named | Pros | Cons | Recommendation |
|---------|---------------------|------|------|----------------|
| **A. Partner is a free-text name** | Type partner's name string | Trivial; partner needs no account | Partner isn't a real user; can't log in / see "my tournaments" | Acceptable, leanest |
| **B. Partner picked from registered users** | Select existing user from dropdown/search | Both are real entities; data integrity | Partner must already have an account; no consent step | **Recommended** |

Recommend **B** (select a registered user as partner) because it keeps a clean relational model
(`Pair { player1Id, player2Id }`), enables showing a player their tournaments, and adds almost no
complexity over free text — just a user picker. **No acceptance step, no invite, no notification.**
Enforce only: a player can't be in two pairs in the same tournament, and can't pick themselves.

### Court-side preference (left/right) (domain note)

In padel, players specialize in a court side (drive/right vs backhand/left). PROJECT.md requires
capturing it at player registration. **For v1 it is a stored, displayed attribute only** — it has
no effect on bracket generation, matchmaking, or scoring (those need random partner matching, which
is explicitly v2). Treat it as a profile field shown on the player/pair view. Building any logic
that *uses* side preference (auto-pairing complementary sides) is out of scope.

## Feature Landscape

### Table Stakes (Users Expect These)

Features without which the app does not deliver its Core Value ("org creates a pairs playoff,
players join in pairs, everyone sees the bracket with results").

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Player registration (email + password) + court-side preference | Can't join without an account; side is a domain-required field | LOW | Standard auth; side = enum field |
| Login + persisted session | Returning players must stay logged in | LOW | NextAuth/session cookie |
| Seeded admin account (role `admin`) | Only the org creates tournaments; created via DB seed | LOW | No admin self-registration |
| Admin creates a playoff tournament (size 4/8/16 + name/dates/location) | Core action; everything hangs off a tournament | LOW | Size constrained to power-of-2 |
| Player "Participate" → forms a pair by naming partner | The doubles entry mechanic; Core Value | LOW–MEDIUM | One-sided declaration, partner = registered user (Variant B) |
| Registration closes at exactly capacity (4/8/16 pairs) | Bracket can't generate without a full, locked field | LOW | Auto-lock when capacity hit, or admin "start" |
| Bracket generation (random placement into round-1 slots) | The playoff sketch is the product | MEDIUM | Full empty tree + random round-1 fill; power-of-2 → no byes |
| Public tournament page: name, dates, location, format, status, participant (pair) list, bracket | "Everyone can see the bracket/results" | MEDIUM | Read-only; status enum drives UI |
| Admin enters score + picks winner; winner auto-advances | The progression mechanic | MEDIUM | Set `winnerPairId`, write into parent slot; score = display string |
| Tournament status (registration-open / in-progress / finished) | Tells users what they can do and what they see | LOW | Enum; finished when final has a winner |
| Bracket shows TBD vs pair name vs winner highlight | A bracket with empty/decided nodes is the expected UX | LOW | Pure render logic from match data |

### Differentiators (Competitive Advantage)

Nice, but **defer** — none are needed to demonstrate the thesis. Listed so they're not mistaken
for table stakes.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Seeding (rank-based placement) | "Fairer" bracket | LOW (logic) / HIGH (needs ranking source) | Pointless without rankings — defer with ELO |
| Structured set-by-set score entry + validation | Authentic padel scorekeeping | MEDIUM | Replace free-text score later if desired |
| Player profile / "my tournaments" view | Player self-service | LOW–MEDIUM | Free if partner = real user (Variant B); add post-v1 |
| Mutual partner confirmation (invite/accept) | Consent, prevents misuse | MEDIUM–HIGH | Requires invites + states + notifications — explicitly avoid for v1 |
| Match schedule / court & time assignment | Real-event logistics | MEDIUM | Out of scope; pure bracket only |
| Live/auto-refreshing bracket | Spectator experience | MEDIUM | Static page + manual refresh is fine for a demo |

### Anti-Features (Commonly Requested, Often Problematic)

Things that look like "obvious" tournament features but must be deliberately **NOT built** for a
thesis. Most are already declared out-of-scope in PROJECT.md — restated here with the cheaper path.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Player rankings / ELO | "Tournaments rank players" | Needs cross-tournament history, formulas, decay — large scope, zero demo value | Random bracket placement; no ranking |
| Byes / non-power-of-2 brackets | "Real tournaments have odd counts" | Bye logic + auto-advance + asymmetric tree is the hardest bracket case | Lock sizes to 4/8/16; no byes possible |
| Double-elimination / round-robin / group stage | "More formats = more useful" | Each is a separate engine (losers bracket, standings, tiebreakers) | Single-elimination only; other formats are v2 |
| Singles with random partner matching | "Padel also played as singles/mixers" | Matchmaking algorithm + uses court-side logic | Pairs declared by players; v2 |
| Payments / entry fees | "Tournaments charge" | PCI, payment provider, refunds — huge, irrelevant to thesis | Free registration |
| Push / email notifications | "Notify players of matches/partner invites" | Email infra, queues, templates; also forces invite-accept flow | None; players check the public page |
| Mutual partner accept/decline | "Consent before being entered" | Pending states, invites, notifications | One-sided declaration (trusted single-org context) |
| Structured padel scoring engine (sets/games/golden point) | "Score it like real padel" | Set/tiebreak rules, validation, edge cases | Free-text score string + explicit winner |
| Multi-admin / org self-signup | "Other orgs could use it" | Tenancy, roles, permissions | Single seeded admin account |
| Mobile app | "Players are on phones" | Separate platform | Responsive web only |
| Caching / scaling / perf optimization | "Production-grade" | Premature for zero-load thesis | SQLite + plain queries |

## Feature Dependencies

```
Player registration (+ court side)
    └──requires──> Login / session
                       └──enables──> "Participate" / pair formation
                                          └──requires──> Tournament created by admin
                                          └──produces──> Pairs registered to a tournament
                                                             └──requires (full + locked)──> Bracket generation
                                                                                                 └──enables──> Result entry + auto-advance
                                                                                                                  └──drives──> Tournament status (finished)

Admin seed account ──enables──> Tournament creation
Public tournament page ──reads──> Tournament + Pairs + Bracket(Matches)  [no write deps]
Court-side preference ──enhances (display only)──> Player/Pair view  [no logic deps in v1]
Partner = registered user ──enables──> future "my tournaments" view
```

### Dependency Notes

- **Bracket generation requires a full, locked field of pairs (4/8/16):** the tree shape and
  round-1 slots can't be created until exactly capacity is reached. This is the central ordering
  constraint — registration is a *phase* that must complete before bracket logic exists. Capacity
  is fixed (power of 2), so locking = "Nth pair registered" or admin clicks "Start".
- **Result entry + auto-advance requires the generated bracket:** advancement writes the winner
  into the parent match's slot (`nextMatchId` + slot from `slotIndex`). No bracket → nothing to
  advance into.
- **Tournament status is derived/driven by the above:** `registration-open` (pairs < capacity) →
  `in-progress` (bracket exists, final not decided) → `finished` (final match has `winnerPairId`).
  Status gates what the UI offers (Participate vs view-only).
- **Pair formation requires login and a tournament:** a pair only exists in the context of a
  tournament; same player may pair differently in different tournaments.
- **Court-side preference has NO logic dependents in v1** (display only) — confirms it's safe to
  ship as a plain field early and never block on it.
- **Partner = registered user (Variant B) is a cheap enabler:** keeps a clean relational pair
  model and unlocks a future player-facing "my tournaments" view at no v1 cost.

## MVP Definition

### Launch With (v1) — exactly the PROJECT.md Active list

- [ ] Player registration (email + password) + court-side preference — entry point + domain field
- [ ] Login + persisted session — players must return
- [ ] Seeded admin account (role `admin`) — only the org creates tournaments
- [ ] Admin creates pairs playoff tournament (4/8/16, name/dates/location) — root entity
- [ ] "Participate": player names partner (registered user) → pair created — doubles mechanic
- [ ] Registration auto-locks at capacity — precondition for bracket
- [ ] Bracket generation (random round-1 placement, no byes) — the product
- [ ] Public tournament page (info + pair list + bracket + status) — visibility = Core Value
- [ ] Admin enters score (free text) + winner → auto-advance — progression
- [ ] Bracket renders TBD / pair names / winner highlight — expected bracket UX

### Add After Validation (v1.x)

- [ ] Player "my tournaments" view — trigger: players ask where their entries are
- [ ] Structured set-by-set scoring — trigger: org wants authentic padel scorecards
- [ ] Manual seeding control for admin — trigger: only once any ranking signal exists

### Future Consideration (v2+)

- [ ] Singles tournaments with random partner matching (uses court-side logic) — defer: needs matchmaking
- [ ] Other formats (round-robin, groups, double-elim) — defer: separate engines
- [ ] Rankings / ELO — defer: needs cross-tournament history
- [ ] Payments, notifications, mobile app — defer: explicitly out of thesis scope

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Player registration + court side | HIGH | LOW | P1 |
| Login / session | HIGH | LOW | P1 |
| Seeded admin account | HIGH | LOW | P1 |
| Admin create tournament (4/8/16) | HIGH | LOW | P1 |
| Pair formation (name partner, Variant B) | HIGH | LOW | P1 |
| Registration capacity lock | HIGH | LOW | P1 |
| Bracket generation (random, no byes) | HIGH | MEDIUM | P1 |
| Public tournament page + bracket render | HIGH | MEDIUM | P1 |
| Result entry + auto-advance | HIGH | MEDIUM | P1 |
| Tournament status states | MEDIUM | LOW | P1 |
| Player "my tournaments" view | MEDIUM | LOW | P2 |
| Structured set scoring | MEDIUM | MEDIUM | P2 |
| Seeding logic | LOW | LOW | P3 |
| Mutual partner confirmation | LOW | HIGH | P3 (anti) |
| Singles / random matching | MEDIUM | HIGH | P3 (v2) |
| Rankings / ELO, payments, notifications | LOW | HIGH | P3 (anti) |

**Priority key:** P1 must-have for launch · P2 add when possible · P3 future/avoid.

## Competitor Feature Analysis

| Feature | USTA Serve Tennis | Bracket platforms (Challonge/score7) | Our Approach |
|---------|-------------------|--------------------------------------|--------------|
| Doubles partner registration | Invite by ID + email accept (mutual) | Team created by one user | One-sided declaration; partner = registered user, no accept step |
| Bracket / seeding | Seeded, supports byes | Seeded, byes for non-power-of-2 | Random placement, 4/8/16 only, no byes |
| Scoring | Structured sets/games | Configurable score + winner | Free-text score string + explicit winner |
| Notifications | Email throughout | Optional | None |
| Rankings | National rankings drive seeds | Optional ELO | None |
| Multi-organizer | Many orgs | Self-serve | Single seeded admin |

## Sources

- Padel scoring (sets/games/golden point/tie-break): https://thepadelschool.com/post/learn-how-padel-scoring-works , https://www.ltapadel.org.uk/play/how-to-get-started-playing-padel/rules/ , https://padel-rules.com/
- Single-elimination structure, seeding (1v8 etc.), byes only for non-power-of-2: https://en.wikipedia.org/wiki/Single-elimination_tournament , https://kb.score7.io/blog/guides/single-elimination-tournament-how-it-works/ , https://turnio.net/elimination-bracket-tournament-guide/
- Doubles partner registration (mutual invite/accept) — what we deliberately simplify away: https://customercare.usta.com/hc/en-us/articles/4406587795220-Inviting-a-Doubles-Partner-Accepting-a-Doubles-Partner , https://support.universaltennis.com/en/support/solutions/articles/9000234067-how-to-register-for-a-UTR-Sports-Event
- Project scope and locked decisions: .planning/PROJECT.md

---
*Feature research for: Padel doubles single-elimination tournament app (thesis)*
*Researched: 2026-06-06*
