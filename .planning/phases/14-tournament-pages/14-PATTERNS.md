# Phase 14: Страницы турниров - Pattern Map

**Mapped:** 2026-06-14
**Files analyzed:** 13 (1 hub + 6 sub-forms + 3 view components + 1 create-form; new co-located `.css` + client leaves)
**Analogs found:** 13 / 13 (every target is an in-place v2.0 restyle; sketch source is the design analog, Phase 13 the structural analog)

> **Restyle-only contract (applies to EVERY file below):** port Court markup + `_base`/screen classes 1:1 from the sketch sources. Do **NOT** touch Server Actions, format-engine logic, Zod validation, `format`/`participantMode` branching, the `renderEntry` gate (`isAdmin && in_progress`), or `readOnly` (`!isAdmin || finished`). No hardcoded hex — tokens / `color-mix` only. `@container` not `@media`. Every screen wrapper gets `.cq`.

## Component-layer inventory (what `_base`/globals already provides vs. what each screen `.css` must add)

Confirmed present in `src/app/globals.css` (port-as-is, do NOT redefine):
`.cq .card .card-pad .meta .meta-row .meta-key .meta-val .badge .badge-reg .badge-prog .badge-fin .progress .avatar .pill .empty .eyebrow .mono .field .input .label .hint .error .btn .btn-primary .btn-block .btn-ghost`

**Absent from globals → must live in the screen's co-located `.css`** (sketch gives exact rules):
`.net-rule .seg .seg-lock .sel-wrap/.select-wrap (chevron) .tip .plist .pair .pair-seed .pair-players .player .player-sub .vs .you-tag .cap-head .cap-count .cta-stack .cta-row .cta-price .admin-box` (002); `.bracket-scroll .bracket .round .is-final .round-label .match .slot .sl-name .sl-tally .winmark .has-detail .sd-pop .sd-grid .sd-col .connectors .elbow .spine .out .champ-banner .ch-name` (003); `.t-head .meta-strip .round-prog .round-block .round-label .rl-tag .matches .matches.live .mrow .court .matchup .side .mdash .score .await .standings-wrap .standings-scroll table.standings .rank .leader .podium .diff .unit-cell` (009); `.sec/.fset .cond` size-swap (007).

## Phase 13 structural pattern (the load-bearing precedent — `src/app/(app)/profile/`)

- **Co-located `.css` per screen**, imported in the Server Component: `import "./profile.css";` (profile/page.tsx:8). `profile.css` header explicitly states it carries ONLY classes absent from globals (net-rule, seg, select-wrap, ro-tag…). **Replicate exactly**: one `.css` per surface, globals untouched.
- **Server Component stays the shell**; the single `"use client"` boundary is the interactive leaf (`profile-form.tsx`). All Phase 14 sub-forms are already `"use client"` leaves — keep them so.
- `.net-rule` rule already authored in `profile.css:11` — copy it into the new screen `.css` files verbatim (or factor; Claude's discretion).

---

## File Classification

| File | Role | Data Flow | Closest Analog | Match |
|------|------|-----------|----------------|-------|
| `(public)/tournaments/[id]/page.tsx` (352) | page/server-component | request-response (read) | sketch 002 detail + profile/page.tsx structure | restyle-in-place |
| `[id]/participate-form.tsx` | client form leaf | Server Action write | `_base` form primitives + 001/008 | restyle-in-place |
| `[id]/start-tournament-form.tsx` | client form leaf | Server Action write | `_base` btn + 002 admin-box | restyle-in-place |
| `[id]/score-form.tsx` | client form leaf | Server Action write | `_base` field/input rows | restyle-in-place |
| `[id]/round-score-form.tsx` | client form leaf | Server Action write | `_base` field/input rows | restyle-in-place |
| `[id]/remove-registration-form.tsx` | client form leaf | Server Action write | `_base` btn-ghost | restyle-in-place |
| `[id]/finish-tournament-form.tsx` | client form leaf | Server Action write | `_base` btn | restyle-in-place |
| `components/bracket-view.tsx` (118) | view component | transform/display | sketch 003 A | restyle + new client leaf |
| `components/round-robin-view.tsx` (108) | view component | display | sketch 009 A | restyle-in-place |
| `components/rotation-view.tsx` (149) | view component | display | sketch 009 B | restyle-in-place |
| `(app)/admin/tournaments/new/create-tournament-form.tsx` (219) | client form leaf | Server Action write | sketch 007 A | restyle-in-place (already client) |

---

## Pattern Assignments

### `(public)/tournaments/[id]/page.tsx` — detail hub (002, UI-06)

**Analog:** sketch `sources/002-tournament-info/index.html` + `references/tournament-pages.md` "Programme" + `forms-and-auth.md`. Structural precedent: `profile/page.tsx`.

**Preserve unchanged (load-bearing — DO NOT TOUCH):**
- Lines 46–128: all data reads (`getTournament`, `getOptionalSession`→`userId`/`isAdmin`, `listTournamentPairs`/`listTournamentPlayers`, `listBracket`/`listRounds`, `computeStandings`, `nameById` build), `isPairsMode`/`isPlayoff` branches, `registrantCount`/`isFull`/`alreadyRegistered`, `readOnly` (104), `renderEntry` gate (108–128).
- Lines 291–349: visualization dispatch (playoff→BracketView else round_robin→RoundRobinView / RotationView), playoff ScoreForm entry block (filter `pairAId&&pairBId&&pairAName&&pairBName`), finish block. Keep ALL gates verbatim; only swap presentation classes.

**Restyle (markup/class swap only):**
- Replace `<main className="mx-auto … max-w-2xl …">` (131) with `.cq` wrapper + editorial column ≤720px, `import "./tournament.css"`.
- **Hero** (132–137 → 002 §"hero"): `eyebrow` «Турнир · {formatLabels[format]}» + `<TournamentStatusBadge>` (already a component — restyle it to emit `.badge .badge-reg/-prog/-fin` with live dot via `::before` keyframe) + `<h1>` + `.lede` (dot-separated spans; **`&nbsp;` around price**, dates/price in `.mono`). GOTCHA: flex `.lede` trims whitespace → use `&nbsp;`.
- **РЕГЛАМЕНТ** (`<dl>` 139–182 → `.card.card-pad` + `.meta`/`.meta-row`): rows Размер/Формат/Состав/Уровень/Подсчёт/Взнос[/Дата/Место]. Формат value wrapped in `.tip[tabindex=0][data-tip="…"]`. Уровень lowercase (already via `skillLevelLabel`). Взнос `.mono`. Keep existing `tournament.*` values + label maps (`formatLabels`, `tournamentKindLabels`, `skillLevelLabel`, `courtSideLabel`).
- **СТАРТОВЫЙ ЛИСТ** (`<section>` 184–253 → `.cap-head`+`.cap-count`«<b>{registrantCount}</b> / {size} пар» + `.progress` (width %) + `.plist`/`.pair`). Each `.pair` = `.pair-seed` (1-based index) + two `.player` (`.avatar` initials + name + `.player-sub` «{courtSideLabel} сторона · {skillLevelLabel}»), `.vs` divider. **`.is-you`** replaces the existing `mine`-driven `border-foreground` (keep the `userId` comparison at 199–201/230). `.empty` «Осталось N мест». Keep the singles branch (228–252) using the same primitives.
- **CTA** (255–275 → `.card.card-pad.cta-stack` with `.cta-price` + the `<ParticipateForm>`/`<SingleParticipateForm>`). Keep the `userId===null`/`alreadyRegistered`/`isFull`/pairs-vs-singles ladder exactly.
- **Admin block** (277–287 → `.admin-box` dashed): keep `<StartTournamentForm>` + its props.

**RISK — data the design wants that the hub already passes:** `courtSide`/`skillLevel` per player ARE available (used at 213–216/241–243). `userId` is-you ✅. courtNumber lives inside view components, not hub. **No new reads needed for the hub.**

---

### Sub-forms (`[id]/*.tsx`) — restyle to `_base` form primitives

**Analog:** `_base` `.field/.label/.input/.hint/.error/.btn.btn-primary.btn-block` (forms-and-auth.md §"Form primitives"). All are ALREADY `"use client"` `useActionState` leaves — keep the hook, the `.bind(null, …)` action binding, the `{ok:false}` error branch, and pending-label swap. **Only swap Tailwind utility classes → Court classes.**

- **participate-form.tsx** (both `ParticipateForm` + `SingleParticipateForm`): label/input → `.field`+`.label`+`.input`; error `<p className="…bg-red-900/40…">` → `.error`; submit → `.btn.btn-primary.btn-block` (pending → `:disabled`, label «Регистрация…»). Keep `name="player2Nickname"` (REG-04). 001 gives an optional `@`-prefix treatment if desired (Claude's discretion — not required).
- **start-tournament-form.tsx**: the `!canStart` hint (28–34) → `.empty`/muted note; submit → `.btn.btn-primary`. Keep `canStart`/`pairCount`/`size` props + the disabled-when-not-full UX (cosmetic; engine guard authoritative).
- **score-form.tsx** + **round-score-form.tsx**: the add/remove set-row `useState` machinery and dynamic `name={`set${n}_a`}` / `points_a`/`points_b` and `scoringMode` branch are **engine-coupled — DO NOT TOUCH**. Restyle only: row inputs → `.input` (narrow), labels → `.label`, error → `.error`, «+ Добавить сет»/«✕» → `.btn-ghost`, submit → `.btn.btn-primary`.
- **remove-registration-form.tsx**: button → `.btn-ghost` small; error → `.error`. Keep `kind`/`id` binding.
- **finish-tournament-form.tsx**: submit → `.btn.btn-primary` (or danger-tinted ghost); error → `.error`.

---

### `components/bracket-view.tsx` — playoff bracket (003, UI-08)

**Analog:** sketch `sources/003-playoff-bracket/index.html` (Variant A) + `references/tournament-pages.md` §"Playoff bracket" + JS notes. **Currently a pure Server Component** (line 1: "no use client, no prisma"). It receives `BracketMatch[]` (id, round, position, pairA/BId, pairA/BName, winnerId, nextMatchId, setsWonA/B, **`sets:{gamesPair1,gamesPair2}[]`**).

**Preserve unchanged:** champion derivation from final (`nextMatchId===null`, 60–69) — banner shows **name only, NO score**; `byRound` grouping + position sort (72–92); `BracketMatch` prop shape (do not add props — `sets` already carries per-set games; set-tally is **derived**, not stored).

**Restyle + split:**
- Round columns → `.bracket-scroll > .bracket > .round` (final round `.is-final`). **Round label by depth-from-final**: replace current `roundLabel(round, totalRounds)` (23–28) with depth = `totalRounds - round` mapping 0→Финал,1→Полуфинал,2→Четвертьфинал,3→«1/8 финала»,else «1/2^depth финала» + `×N` when >1 match (003 JS `roundLabel`/`buildRounds`). Current labels stop at Четвертьфинал — extend.
- `.match` = two `.slot` (`.win` on `pairId===winnerId` → `--winner-bg` + 3px primary bar + checkmark; TBD slot italic faint). **Names NEVER truncate** (`.sl-name { white-space: normal }`). Replace `Slot` (30–49).
- **Set-tally** (replaces the inline `setsLabel` join at 51–54/106–108): per pair show ONE `.sl-tally` = count of sets where that pair's games > opponent's, **derived from `m.sets`** (003 JS `tallyOf`: `s.gamesPair1 > s.gamesPair2`). Winner tally `--primary`. **NO «6:4 3:6» inline anywhere; NO final score.**
- **Games popover** = `.sd-pop` (`position:fixed`), one `.sd-col` per set (odd-tinted, `.w` on winning game), revealed on hover(desktop)/tap(mobile); match gets `.has-detail` + dotted underline on tally.

**RISK — popover + connectors require a CLIENT leaf.** Recommend splitting an interactive `"use client"` child (e.g. `bracket-scroll-client.tsx`) that owns: popover render/place/dismiss + connector geometry; the parent `bracket-view.tsx` stays a Server Component computing tally/labels and passing serializable data.
- **Connector-elbows are DEGRADABLE (per CONTEXT 14:41):** core UI-08 = tally + popover + no-final-score + champion-banner + correct column alignment — shippable WITHOUT measured elbows. If implemented, port 003 `positionConnectors` (index.html:781–828) faithfully: (1) `useLayoutEffect`; (2) pass-1 `translateY`-center each next card on its two feeders' midpoint, cascading L→R; (3) pass-2 size each `.elbow` from feeder `getBoundingClientRect`, aligning the `.out` stub to the ACTUAL next-card center; (4) **re-measure on `resize` AND `document.fonts.ready`** (Oswald swap drifts geometry); (5) **never measure a card mid-`transform`-transition** — the sketch removed the transition for this reason. If fragile in React → ship static columns, note in SUMMARY.

---

### `components/round-robin-view.tsx` — круговой (009 A, UI-09)

**Analog:** sketch `sources/009-tournament-formats/index.html` (A) + references §"A — Круговой". Pure Server Component; props `rounds/standings/nameById/readOnly/renderEntry`. **Preserve:** `teamLabel`, `isRecorded`, `showEntry = !readOnly && renderEntry`, the per-round map, `renderEntry!(m)` call for unrecorded matches, standings map over `computeStandings` units (NEVER recompute).

**Restyle:**
- «Матчи» → `.round-block` (`.round-label` «Раунд N» + optional `.rl-tag`) wrapping `.matches > .mrow`. Each `.mrow` = `.court`«Корт {m.courtNumber}» (glyph `<i>`) · `.matchup` (`.side .win`/`.lose` + `.mdash`) · `.score` (losing number `.dim`) OR `.await` «Ожидает счёта» (replaces the `isRecorded` ternary at 57–63; keep `renderEntry` injection for admin path). Winner side highlight: derive from points (display-only — do NOT compute new winners; the existing code shows raw `pointsA:pointsB` — apply `.win`/`.lose` by comparing the two display points, no engine change).
- «Турнирная таблица» (76–103 → `.standings-wrap > .standings-scroll > table.standings`): columns Место/Участник/Игр/Победы/Поражения/Очки/Разница (already exact). `.rank` chip; row 1 `.leader`, rows 2–3 `.podium`; Разница `.diff.pos/.neg/.zero`. Keep `nameById[u.unitId]` + all `u.*` fields.

---

### `components/rotation-view.tsx` — американо/мексикано (009 B, UI-09)

**Analog:** sketch 009 (B) + references §"B". **Preserve:** `roundsWith`, `current`(unrecorded)/`past`(recorded) split, `showEntry`, player standings map. **NO cut-line / qualification styling** (pure rating ladder).

**Restyle:**
- «Текущие игры» → `.matches.live` box; unplayed → `.await` target pill (e.g. «До N» if a target is available, else «Ожидает счёта»); keep `renderEntry` injection (74).
- «Прошедшие игры» → `.matches > .mrow` with real `.score` (102–104).
- Both reuse `.court`«Корт {courtNumber}» · `.matchup` (transient pairings via `teamLabel`) · `.score`/`.await`.
- «Рейтинг игроков» (116–146 → `.standings-wrap > .standings-scroll > table.standings`): columns Место/Игрок/Сыграно/Победы/Очки/Разница (already exact). Игрок cell → `.unit-cell` (`.avatar` initials + name). `.leader`/`.podium`, `.diff` coloring. Keep `nameById[p.userId]` + `p.*`.

---

### `(app)/admin/tournaments/new/create-tournament-form.tsx` — create form (007, UI-07)

**Analog:** sketch `sources/007-create-tournament/index.html` + `forms-and-auth.md` §"007 Conditional create form". **Already `"use client"` with the conditional `useState` logic** (`format`/`scoringMode`, `isRoundFormat`, `effectiveMode`/`effectiveScoring`). The branching mirrors `createTournamentSchema`.

**Preserve unchanged (load-bearing):**
- `useActionState` wrapping `parseTournamentForm` pre-check → `createTournamentAction` (44–55); all field `name=` attributes; the size element-swap (`select` for playoff ↔ `number` with `min={sizeMinByFormat[format]}` else, 130–150) — **only the visible control carries `name="size"`** (forms-and-auth §"Double-submitting size"); forced singles+points lock for americano/mexicano via hidden inputs + disabled selects (99–113, 160–174); `totalRounds` shown only `isRoundFormat`, `required={format==="mexicano"}` (182–196). **No `setsPerMatch`/`gamesPerSet`/`targetPoints`** (the comment at 178–180 is correct — keep absent).

**Restyle (markup/class swap only):**
- Section the form into three `<fieldset class="fset sec">` (1 Основное · 2 Формат и подсчёт · 3 Время и место) separated by `.net-rule`, ≤640px column, `.cq`, `import "./create-tournament.css"`.
- Все `<label className="flex …">` → `.field`+`.label`+`.input`; `errors.* span` → keep but style as `.error`/field error; `(необязательно)` → `.opt-tag`.
- **Format/Тип/Подсчёт** → `.seg` radio pills with `:has(input:checked)` (forms-and-auth §"Segmented control" 007 flavour) **only if** the value still submits natively — BUT current impl uses controlled `<select>` + hidden inputs for locking. **Lower-risk: keep `<select>` controls, just add `.sel-wrap` chevron + `.input` styling**, OR migrate to `.seg` radios while preserving the hidden-input forced values. Claude's discretion; if migrating to `.seg`, the locked state = `.is-locked` + `.seg-lock` caption «Формат играется только одиночно».
- `<select>` → wrap in `.sel-wrap`/`.select-wrap` for the token chevron (prefer CSS-mask flavour; arrow color = `var(--text-muted)`, focus `var(--ring)`). Submit → `.btn.btn-primary.btn-block`.
- Conditional fields (`totalRounds`, size-swap) → `.cond` fade-in + `[hidden]` hard-hide pattern.

**RISK:** the `.seg`-with-`:has()` migration could break native submission of locked forced values. Safest path: retain the existing controlled-select + hidden-input mechanism (proven to submit forced values) and only restyle; adopt `.seg` only for the freely-selectable cases if confident. Do NOT auto-lock playoff/round_robin Тип.

---

## Shared Patterns

### Co-located screen CSS (Phase 13)
**Source:** `src/app/(app)/profile/profile.css` + `profile/page.tsx:8`. **Apply to:** all 4 surfaces. One `.css` per screen importing nothing, holding ONLY non-globals classes; `import "./x.css"` at top of the Server Component. Do not write to `globals.css`.

### `.net-rule` divider
**Source:** `profile.css:11` (already authored) + `references/tournament-pages.md` §"Court-net rule". **Apply to:** 002 sections, 007 fieldset separators, 009 `.t-head`/standings divider. Copy the `repeating-linear-gradient` rule verbatim.

### Live status badge
**Source:** `references/tournament-pages.md` §"Status badge". **Apply to:** 002 hero, 003 head, 009 `.t-head`. `.badge-reg`/`.badge-prog` get a pulsing `::before` dot (`liveDot` keyframe); restyle the existing `<TournamentStatusBadge>` component to emit these classes.

### Standings table (009)
**Source:** references §"Match rows + standings". **Apply to:** both round-robin-view + rotation-view. Identical `.standings-wrap > .standings-scroll > table.standings` shell — factor the shared rules into one `.css` (or duplicate; discretion). `.rank`/`.leader`/`.podium`/`.diff.pos/neg/zero`. Horizontal scroll stays **inside `.standings-scroll`**, never the body.

### Intentional horizontal scroll
**Apply to:** `.bracket-scroll` (bracket) + `.standings-scroll` (wide tables) only — never `<body>`/`<main>`.

---

## No Analog Found
None. Every target file exists in v2.0 and maps to a specific sketch source. No new backend reads required (all data — `courtNumber`, `SetScore.gamesPair1/2`, `userId`, `computeStandings`, champion-from-final — already flows; confirmed by CONTEXT scout).

## Metadata
- **Analog search scope:** `src/app/(public)/tournaments/[id]/`, `src/components/`, `src/app/(app)/admin/tournaments/new/`, `src/app/(app)/profile/` (Phase 13 precedent), `src/app/globals.css`, sketch sources 002/003/007/009.
- **Files scanned:** 11 target `.tsx` + globals.css + profile.css + 003 sketch (876 lines, JS geometry extracted).
- **Pattern extraction date:** 2026-06-14
