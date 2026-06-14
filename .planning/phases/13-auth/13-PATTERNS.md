# Phase 13: Auth, аккаунт и обзор - Pattern Map

**Mapped:** 2026-06-14
**Files analyzed:** 8 (5 page files + 3 client form leaves) + likely 3 new client leaves
**Analogs found:** 5 / 5 screens (each has a 1:1 sketch source; this is a restyle phase, so the "analog" is the sketch HTML, not another app file)

**Phase type:** UI restyle. Each target is an EXISTING v2.0 file restyled in place. The "pattern to copy from" is the sketch `index.html` (markup + class names) + its `reference/*.md` contract. The Court component layer (`.card/.field/.input/.btn/.badge/.pill/.meta/.progress/.avatar/.eyebrow/.hint/.error` …), tokens, and `.cq` already exist in `src/app/globals.css` (Phase 12, verified below). DO NOT change server logic, Server Actions, form field `name`s, Zod validation, RU messages, or role/readOnly gates.

---

## File Classification

| Target file | Role | Data flow | Closest analog (sketch) | Match |
|-------------|------|-----------|-------------------------|-------|
| `src/app/(auth)/login/page.tsx` | route/page (Server Component shell) | request-response | `sources/008-auth/index.html` Variant A (login mode) | exact |
| `src/app/(auth)/login/login-form.tsx` | client form leaf | request-response | 008 `.authform` login fields + `.pw` reveal | exact |
| `src/app/(auth)/register/page.tsx` | route/page (Server Component shell) | request-response | `sources/008-auth/index.html` Variant A (register mode) | exact |
| `src/app/(auth)/register/register-form.tsx` | client form leaf | request-response | 008 `.reg-only` block | exact |
| `src/app/(app)/profile/page.tsx` | route/page (Server Component) | request-response | `sources/006-profile/index.html` Variant A (`.idcard`) | exact |
| `src/app/(app)/profile/profile-form.tsx` | client form leaf | CRUD (update) | 006 Variant A edit form + edit-toggle/diff JS | exact |
| `src/app/(public)/tournaments/page.tsx` | route/page (Server Component, reads searchParams) | CRUD-read + server-side filter | `sources/004-tournaments-list/index.html` Variant B (`.list`/`.trow`) | exact |
| `src/app/(app)/dashboard/page.tsx` | route/page (Server Component) | CRUD-read (player tournaments) | `sources/005-dashboard/index.html` Variant A (`.lkA`/`.tcard`) | exact (markup) / **NO DATA ANALOG — see Risks** |

**New client leaves to create** (`"use client"`, granularity at planner discretion):
- Auth password reveal-eye — wrap the password `<input>` in `.pw` with a `.reveal` button toggling `type`. Belongs inside `login-form.tsx` / `register-form.tsx` (already client) OR a tiny shared `PasswordInput` leaf.
- Tournaments filter popover — open/close + outside-click + `.fcount` active-count badge + facet submit into searchParams. New leaf e.g. `tournaments/filter-bar.tsx`. The PAGE stays a Server Component; this leaf only manages popover UI and pushes selected facets to the URL.
- Profile edit-toggle + diff-gated Save + per-field `changed-dot` + courtSide `.seg` mirror. Lives inside `profile-form.tsx` (already the client leaf).

---

## Pattern Assignments

### `src/app/(auth)/login/page.tsx` + `login-form.tsx` (008 Variant A, login)

**Analog:** `sources/008-auth/index.html` lines 253–364 (Variant A card), CSS lines 70–130, JS 542–609.
**Reference:** `references/forms-and-auth.md` §008 (lines 72–78), CSS patterns 187–204.

**CURRENT page (login/page.tsx 1-17):** raw `<main className="flex … p-8"><h1>Вход</h1><LoginForm/>` + link to /register.

**CURRENT form (login-form.tsx 51-89):** Tailwind utility classes (`rounded-md border border-current/30 px-3 py-2`), inline `<label className="flex flex-col …">Почта<input…/></label>`. **Server logic to PRESERVE verbatim:** `loginSchema.safeParse`, `authClient.signIn.email`, error mapping → `setErrors({ form: "Неверная почта или пароль" })`, `router.push("/dashboard")` + `router.refresh()`. Field names `email`, `password`. `noValidate`.

**Court target (port from sketch):**
- Page shell renders the `.cq` wrapper → `.card cardA` court card (≤440px) with the field-court motif background, `.brand-lockup` + `.ball`, and a `.modeseg role="tablist"`. The two tabs are `<Link href="/login">Вход` (active, `.on`) and `<Link href="/register">Регистрация` — NOT the sketch's in-place `setMode()` (CONTEXT decision: two routes preserved).
- Replace utility classes with `_base`: `<div class="field"><label class="label">…<input class="input">…<span class="error">`. Submit = `.btn .btn-primary .btn-block`, label swap `Войти`→`Вход…` keyed off existing `submitting`.
- Form error → `.error` (toggle display, `pop` keyframe — sketch CSS exists as `.error` in globals; sketch local pop is `.toast-pop` 129-130).
- Password field wrapped in `.pw` with the `.reveal` eye button (sketch 300-310; CSS in reference 187-197). `autocomplete=current-password`.
- select-chevron not needed on login (no select). On register it IS (see below) — use the CSS-mask token chevron, NOT hardcoded.

**Field/error excerpt to keep (login-form.tsx 36-48):**
```ts
const { error } = await authClient.signIn.email({ email: parsed.data.email, password: parsed.data.password });
if (error) { setSubmitting(false); setErrors({ form: "Неверная почта или пароль" }); return; }
router.push("/dashboard"); router.refresh();
```

---

### `src/app/(auth)/register/page.tsx` + `register-form.tsx` (008 Variant A, register)

**Analog:** `sources/008-auth/index.html` register `.reg-only` block lines 291-346, CSS chevron 108-119.
**Reference:** `references/forms-and-auth.md` §008 (lines 75-77) — register field set.

**CURRENT form (register-form.tsx 83-187):** field order email, password, name, nickname, phone, birthDate, skillLevel. **PRESERVE:** `registerSchema.safeParse` (all fields), `authClient.signUp.email({ email, password, name, nickname, skillLevel, ...phone, ...birthDate })`, the `error.code` branch mapping (`FAILED_TO_CREATE_USER`→"Никнейм уже занят", `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`→…). `skillLevel` REQUIRED. **courtSide is NOT collected here** (sketch 76, CONTEXT) — do not add it. `skillLevels`/`skillLevelLabels` come from `@/lib/validation/auth` — reuse for the `<option>`s.

**Court target:** same `.card cardA` + `.modeseg` (Регистрация tab active). Wrap fields in `.field`/`.label`/`.input`. Optional markers `<span class="opt">(необязательно)</span>` inside the label (sketch 323, 327). Password hint `Минимум 8 символов` as `.hint`. Skill `<select class="input">` inside `.sel-wrap` (border-square chevron, sketch 111-119) OR `.select-wrap` (mask chevron, 006) — both token-driven, pick one and stay 1:1. Nickname hint `Уникальный, 3–30 символов: буквы, цифры, _ и -`. CTA `.btn .btn-primary .btn-block` "Зарегистрироваться".

**Skill select excerpt to keep (register-form.tsx 158-176):** `skillLevels.map((lvl)=><option value={lvl}>{skillLevelLabels[lvl]}</option>)`, `defaultValue=""`, disabled placeholder option, `required`.

---

### `src/app/(app)/profile/page.tsx` + `profile-form.tsx` (006 Variant A)

**Analog:** `sources/006-profile/index.html` Variant A: idcard 214-241, form 255-320, JS toggle/diff 491-610.
**Reference:** `references/forms-and-auth.md` §006 (lines 65-70), CSS 176-185, HTML 306-327.

**CURRENT page (profile/page.tsx 7-46):** `requireUser()` guard with the redirect-only-on-Unauthorized/Forbidden pattern → `getProfile(prisma, user.id)` → passes `initial` to `ProfileForm`. **PRESERVE the guard + getProfile call exactly.** `getProfile` returns `{ id, name, email, courtSide, phone, skillLevel, nickname, birthDate }` (safeProfileSelect). birthDate sliced to `yyyy-MM-dd` (page line 42).

**CURRENT form (profile-form.tsx):** `useActionState` → `updateProfileAction`; client pre-validate via shared `parseProfileForm`. Fields: name(req), courtSide(select), phone, skillLevel(select), birthDate, nickname(req), email. **PRESERVE:** `formAction`, `parseProfileForm`, `updateProfileAction`, all `name` attrs, `errors` mapping, `pending` label swap.

**Court target:**
- Page renders `.cq` → top `.card card-pad idcard` "player-pass": `.id-avatar` (initials from name), `.eyebrow`Личный кабинет, `<h1>{name}`, `.id-handle` mono `@{nickname}`, `.id-chips` (`.id-chip accent` Уровень=`skillLevelLabels[skillLevel]` + `.id-chip` Сторона=`courtSideLabels[courtSide]`), then `.id-contact meta`: Email row with `<span class="ro-tag">логин</span>`, Phone row with `<span class="ro-tag">скрыт от соперников</span>`. Then `.net-rule`.
- **Email read-only** (sketch 69, CONTEXT 35): render in the idcard contact strip; the existing `email` form input stays present but rendered read-only/`disabled` (`.input[readonly]` styling exists, sketch 116) — do NOT remove it (the action still routes it via changeEmail) but it must not be an enabled editable input. Confirm with planner whether to keep it as a hidden/readonly field to avoid changing the action contract.
- Form: `.field`/`.label`/`.input`; courtSide becomes the 006 `.seg` (3 `<button aria-pressed>` + hidden `<input name="courtSide">`, sketch 291-302, CSS 118-133) replacing the current `<select name="courtSide">` — **the hidden input keeps `name="courtSide"` so the Server Action payload is unchanged.** skillLevel select inside `.select-wrap` (mask chevron). Per-field `data-init` + `.changed-dot` + edit-toggle (`Редактировать`→enable inputs+seg; `Сохранить` disabled until diff; re-lock on save). Map this onto the existing `useActionState` flow — `pending` drives "Сохраняем…", `state.ok` drives the saved state + re-lock.

**Guard excerpt to keep (profile/page.tsx 10-21):**
```ts
try { user = await requireUser(); }
catch (e) {
  if (e instanceof Error && (e.message === "Unauthorized" || e.message === "Forbidden")) redirect("/login");
  throw e;
}
```

**courtSide label source:** `courtSides`/`courtSideLabels` from `@/lib/validation/profile` (left/right/either → Левая/Правая/Любая).

---

### `src/app/(public)/tournaments/page.tsx` (004 Variant B "Плотный список")

**Analog:** `sources/004-tournaments-list/index.html` Variant B: list-head/trow CSS 238-330, HTML rows 694-810, filter popover CSS 130-163, HTML 629-689, engine JS 845-943.
**Reference:** `references/lists-and-filters.md` §004 + collapsed-filters (lines 9-43), CSS 60-200, HTML 247-335.

**CURRENT page (tournaments/page.tsx 13-54):** Server Component, `searchParams: Promise<{ status?: string }>`, validates `status` against `tournamentStatuses`, calls `listTournaments(prisma, { status })`. Renders `<ul>` of `<Link>` rows with name + `{size} пар` + `<TournamentStatusBadge>`. **PRESERVE: the `?status=` param must keep working** (CONTEXT 42).

**Court target (KEY CONSTRAINTS):**
- **Server-side filtering** (CONTEXT 42, reference 241): extend `searchParams` to read `q`, `status`, `format`, `level`, `mode`; widen the `where` in the query path. The sketch's client `applyFilters`/`[hidden]` engine (JS 859-888) is **sketch-only — DO NOT port it.** Existing `status` validation against `tournamentStatuses` stays. Discretion (CONTEXT 51): where to put the extended Prisma `where` (likely a new opts shape on `listTournaments` or filtering in the page) — but do not break the `status` opt.
- Data: `listTournaments` returns `{ id, name, size, status, date, location, format, participantMode, level, price, … }` (tournamentSelect). Map labels with `formatLabels` (playoff→Олимпийская …), `tournamentKindLabels` (pairs→Парный/singles→Одиночный), `skillLevelLabels` for level — all in `@/lib/validation/*` (verified). **Note:** sketch facet `<option>` values for format/level/mode are the RU labels; for server filtering map RU label → DB enum value, or use DB values directly in `<option value>` (reference 334-336 says status options use raw DB strings, format/level/mode use RU). Planner decides the mapping; keep `status` values as DB strings (`registration`/`in_progress`/`finished`).
- Markup: `.cq` wrapper → `.page-head` (eyebrow + `<h1>Турниры` + `.ph-count` "**N** из M"), `.filters` containing `.filterbar` (`.search` + `.filter-btn` with `.fcount`), `.filter-panel` (2×2 `.sel-field` selects: Статус/Формат/Уровень/Вид + `.filter-foot`). Then `.list` → `.list-head` + `.list-rows` of `<Link class="trow s-reg|s-prog|s-fin">` using the **fixed grid `1.7fr 1fr .9fr 1.1fr .9fr 118px 30px`** (reference 16-18, status 118px / chevron 30px FIXED). Cells: `.tr-main`(name+`.tr-sub` mono date·dot·location), `.tr-fmt`(`.fmt-tag`+`.tr-mode`), `.tr-lvl`, `.tr-cap`(frac + `.progress`), `.tr-price`("NNN ₽"/`.price-free`"бесплатно"), `.tr-status-cell` (reuse `<TournamentStatusBadge>` if it emits `.badge .badge-*`), `.tr-go` chevron. Phone reflow via `@container (max-width:780px)` `grid-template-areas` (CSS 300-322) — keep ALL fields (reference "What to Avoid" 366-371). Capacity X/size: current rows lack a registered-count; if no count is queried, show size only or add a count to the service (planner discretion — flag below).

**Status-param excerpt to keep (page.tsx 18-22):**
```ts
const validStatus = (tournamentStatuses as readonly string[]).includes(status ?? "") ? (status as TournamentStatus) : undefined;
const tournaments = await listTournaments(prisma, validStatus ? { status: validStatus } : undefined);
```

**Filter leaf (new `"use client"`):** open/close popover, outside-click (sketch 898-907), `.fcount` non-`all` count, `.on` class, `aria-expanded`/`aria-controls`. Submits facets to the URL (form GET or `router.push`) so the Server Component re-queries. NO `[hidden]` row hiding.

---

### `src/app/(app)/dashboard/page.tsx` (005 Variant A "Мои турниры")

**Analog:** `sources/005-dashboard/index.html` Variant A: who/header 282-299, sec/tcard CSS 38-128, HTML sections 303-430.
**Reference:** `references/lists-and-filters.md` §005 (lines 45-58), CSS 202-217, HTML 338-364.

**CURRENT page (dashboard/page.tsx 4-25):** `requireUser()` (same guard pattern) then ONLY greets `Добро пожаловать, {user.name}`. **It does NOT query the player's tournaments, roles, or round progress.**

**Court target:** `.cq` → `.lkA` (≤760px): `.head` with `.who` (`.avatar` initials + `.who-name` + `.who-sub` `.pill` row `@USER-NN`/уровень/сторона) and `.head-cta` (`.btn .btn-ghost` Профиль `<Link href="/profile">` + `.btn .btn-primary` Найти турнир `<Link href="/tournaments">`). Then `.net-rule` and three `.sec` groups (Активные/Предстоящие/Завершённые), each `.sec-head` (eyebrow + `.sec-count` + `.sec-line`) and a `.tlist` of `.tcard is-active|is-upcoming|is-finished` (left accent bar `::before`: primary/accent/text-faint). Each `.tcard`: `.tc-main` (`.tc-top` name + `.badge`, `.tc-meta` format·вид·место, `.tc-role` "пара с **Имя**" + partner `.avatar` OR `.solo` glyph) + `.tc-side` (active→`.tc-round` "3/7"+`.progress`+primary "К текущему раунду"; upcoming→ghost "Открыть"; finished→`.place` medal+rank+ghost "Результаты"). CTAs `<Link>` to existing routes.

**RISK — no data analog (NOT a UI risk, a backend gap):** the markup is portable, but the v2.0 page never fetched the player's tournaments/roles/round progress. CONTEXT 46 says "Данные (турниры игрока, роли, прогресс раундов) — существующие v2.0-запросы," but no such dashboard query exists in `src/lib/services/` (verified: `registration.ts` has `findUserIdByNickname`, `registerPair`, `registerSingle`, `listTournamentPairs` — none returns "tournaments for a given user with role + round progress"). **The planner must decide:** (a) compose existing services into a new read (group the player's `TournamentPlayer`/pair rows + `tournament.status` + round progress), or (b) scope the dashboard restyle to the identity header + whatever minimal data exists. Round-progress ("3/7") needs `rounds`/`round-result` data; partner name needs the pair's other player. This is the one place "restyle-only, preserve v2.0 behavior" collides with the sketch's richer content. Flag to user if unscoped.

**Guard excerpt to keep (dashboard/page.tsx 9-17):** identical requireUser try/catch as profile.

---

## Shared Patterns

### Court component layer (Phase 12, VERIFIED present in `src/app/globals.css`)
**Apply to:** all 5 screens. Classes confirmed in `@layer components`: `.eyebrow .muted .faint .mono .card .card-pad .surface-2 .btn .btn-primary .btn-ghost .btn-block .field .label .input .hint .error .badge(.badge-reg/.badge-prog/.badge-fin) .pill .pill-accent .avatar .meta .meta-row .meta-key .meta-val .progress .empty`. Utility `.cq { container-type: inline-size }` (line 243). **Screen-specific classes NOT in globals** (`.idcard .id-avatar .id-chip .modeseg .pw .reveal .seg .trow .list-head .tr-* .filter-panel .fcount .tcard .sec .who .net-rule .sel-wrap/.select-wrap` etc.) must be ported from each sketch's `<style>` block into co-located CSS or globals — at planner discretion, but **1:1 class names** and **token-only colors**.

### Tokens (VERIFIED in `:root`)
`--primary #c6f24e, --accent #2fd6c4, --danger, --success, --text/-muted/-faint, --border/-strong, --ring, --surface/-2/-input, --primary-soft, --badge-*-bg/-fg, --btn-primary-bg, --radius/-lg/-pill, --font-display/-body/-mono, --fw-strong/-display`. **No hardcoded hex anywhere** (CONTEXT 23) — status seams, chevron masks, price/lookup cues all via tokens + `color-mix`.

### Auth guard (request-response gate)
**Source:** `requireUser()` from `@/lib/auth-guards` (profile/page.tsx 10-21, dashboard 9-17).
**Apply to:** profile + dashboard. Redirect ONLY on `Unauthorized`/`Forbidden`; rethrow operational errors. PRESERVE verbatim — it is the security boundary, not UI.

### Form contract (preserve, restyle only)
**Source:** login-form (`loginSchema`+`authClient.signIn`), register-form (`registerSchema`+`authClient.signUp`+`error.code` map), profile-form (`useActionState`+`parseProfileForm`+`updateProfileAction`).
**Apply to:** all 3 form leaves. Restyle markup/classes ONLY; do not touch field `name`s, Zod schemas, RU messages, submit/router/action calls.

### Label maps (reuse, do not re-derive)
`skillLevels`/`skillLevelLabels` (`@/lib/validation/auth`), `courtSides`/`courtSideLabels` (`@/lib/validation/profile`), `formatLabels`/`tournamentKindLabels` (`@/lib/validation/auth`, verified lines 18-29). Use these for all RU `<option>`/chip/tag text.

### Token-driven select chevron
**Source:** sketch 006 `.select-wrap::after` CSS mask (reference 81-93) OR 008 `.sel-wrap::after` border-square (008 CSS 111-119).
**Apply to:** register skill select, profile skill select, tournaments filter selects. Chevron color = `var(--text-muted)`→`var(--ring)` on focus. Never bake color into SVG.

---

## No Analog / Risks

| Target | Issue | Planner action |
|--------|-------|----------------|
| `dashboard/page.tsx` | Sketch 005 needs player's tournaments + role (partner name) + round progress; **no such query exists** in `src/lib/services/`. v2.0 page only greets the user. | Decide: compose a new read from existing `registration.ts`/`rounds`/`round-result` services, OR scope restyle to the identity header + minimal available data. Backend gap, not a CSS gap — likely flag to user. |
| `tournaments/page.tsx` capacity "X/size" | `listTournaments`/tournamentSelect returns `size` but no registered-count. | Show size only, or add a count to the service/query (discretion); progress bar then derives from count/size. |
| `profile` email field | Sketch makes email read-only in the idcard; current form has an editable `email` `<input>` the action routes via changeEmail. | Render read-only/disabled but keep the field present so the action contract is unchanged; do not delete it. |
| Auth tabs | Sketch uses in-place `setMode()` (`body.is-login`); CONTEXT mandates TWO routes with `<Link>` tabs. | Use `<Link>` between `/login` and `/register`, active = current route. Do not port `setMode`/`is-login` JS. |

## Metadata

**Analog search scope:** sketch sources (008/006/004/005), `src/app/(auth|app|public)/…`, co-located `*-form.tsx`, `src/lib/services/`, `src/lib/validation/`, `src/app/globals.css`.
**Files scanned:** 8 targets + globals.css + 3 services + 3 validation modules.
**Pattern extraction date:** 2026-06-14
