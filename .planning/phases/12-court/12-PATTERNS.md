# Phase 12: Дизайн-фундамент (Court) - Pattern Map

**Mapped:** 2026-06-14
**Files analyzed:** 4 (modify) + 0–1 optional (Claude's discretion)
**Analogs found:** 4 / 4 (all modify-in-place; analog = current file + sketch source as target)

> Special case: this is a restyle-foundation phase. There is no sibling file to copy from — each target file is **modified in place**, and the authoritative *pattern source* is the validated sketch (`_base.css` / `court.css` / `foundation.md`), NOT another app file. "Analog" below = (current app file to modify) + (sketch source that defines the target shape). The port must be **1:1 on token names and class names** so phases 13/14 can paste markup from `sources/NNN-*/index.html` without renaming.

## File Classification

| Target File | Action | Role | Data Flow | Pattern Source (target) | Current Analog | Match Quality |
|-------------|--------|------|-----------|-------------------------|----------------|---------------|
| `src/app/globals.css` | modify | config (theme tokens + component layer) | transform (CSS) | `sources/themes/court.css` + `sources/_base.css` | current `globals.css` (`@import "tailwindcss"` + `:root` vars + `@theme inline`) | exact (same role) |
| `src/app/layout.tsx` | modify | provider (root shell + fonts) | request-response (RSC) | `foundation.md` font contract + Next `next/font/google` idiom | current `layout.tsx` (`<html lang="ru">` shell, no fonts) | exact |
| `src/components/nav.tsx` | modify | component (global chrome) | request-response (RSC) | `_base.css` tokens (no nav sketch — restyle classes only) | current `nav.tsx` (Tailwind utilities, `border-current/15`, `bg-foreground`) | exact |
| `src/components/tournament-status-badge.tsx` | modify | component (reusable) | transform (status→label/class) | `_base.css` `.badge*` + `foundation.md` status mapping | current `tournament-status-badge.tsx` (`bg-green-900/40` etc.) | exact |
| `src/app/_base.css` (optional, Claude's discretion) | create | config (component layer) | transform (CSS) | `sources/_base.css` (component block only) | none (new) | n/a |

## Pattern Assignments

### `src/app/globals.css` (config — theme tokens + component layer)

**Current state** (lines 1-17): bare monochrome.
```css
@import "tailwindcss";
:root { --background: #0a0a0a; --foreground: #ededed; }
@theme inline { --color-background: var(--background); --color-foreground: var(--foreground); }
body { background: var(--background); color: var(--foreground); font-family: system-ui,...; }
```

**Target — token block** (port verbatim from `court.css` lines 8-62, drop the `@import url(Oswald...)` line — fonts come from `next/font` instead). Keep the existing `--background/--foreground` pair as decided. Full token set to define on `:root` (token-contract from `foundation.md` lines 46-59 / `_base.css` header lines 9-21):
```
surfaces : --page --bg --surface --surface-2 --surface-input --border --border-strong --ring --card-blur
text     : --text --text-muted --text-faint --on-primary --on-accent
brand    : --primary --primary-2 --primary-soft --accent --accent-2 --danger --danger-soft
           --success --success-soft --winner-bg --winner-text --btn-primary-bg --btn-shadow
status   : --badge-reg-bg --badge-reg-fg --badge-prog-bg --badge-prog-fg --badge-fin-bg --badge-fin-fg
type     : --font-display --font-body --font-mono --fw-strong --fw-display --tracking-display --tracking-eyebrow
shape    : --radius --radius-lg --radius-pill --shadow --shadow-lg
```
Court values are in `court.css` lines 9-62 — copy exactly, do NOT inline hex anywhere else.

**Target — font tokens** override the three font families to consume the `next/font` CSS vars (instead of `court.css`'s hardcoded `'Oswald'`):
```css
--font-display: var(--next-oswald), system-ui, sans-serif;
--font-body:    var(--next-inter), system-ui, sans-serif;
--font-mono:    var(--next-jetbrains), monospace;
```
(Exact var names follow whatever `layout.tsx` exposes; keep names consistent across both files.)

**Target — `body`** (replace current `body` rule; from `_base.css` lines 30-41 minus the `padding-top: 52px` sketch-chrome hack):
```css
body { margin: 0; min-height: 100vh; background: var(--page); color: var(--text);
       font-family: var(--font-body); font-size: 15px; line-height: 1.5;
       -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
* , *::before, *::after { box-sizing: border-box; }
```

**Target — component layer** wrap `_base.css` lines 51-219 in `@layer components { … }` (typography helpers, `.card/.card-pad/.surface-2`, `.btn*`, `.field/.label/.input/.hint/.error`, `.badge*/.pill*`, `.avatar`, `.meta*`, `.progress`, `.empty`, `.eyebrow/.muted/.faint/.mono`). Port verbatim — token-driven.
- **DO NOT port** `_base.css` lines 24 (`@import Inter/JetBrains` — fonts via `next/font`), 43-49 (`.app` preview-frame `max-width` toolbar hack — but DO keep `container-type: inline-size` convention separately, see below), and 221-266 (`#variant-nav`, `#sketch-tools`, `.variant` — sketch chrome, per CONTEXT line 31).
- **Container-query convention** (`foundation.md` lines 215-231): provide `container-type: inline-size` on the page wrapper utility; phases 13/14 attach it per screen. Use `@container`, never `@media`.
- **Live-dot** for reg badge (`foundation.md` lines 249-252): add `.badge-reg::before { animation: liveDot 1.8s ... }` + `@keyframes liveDot`.

**Tailwind 4 note:** `@theme inline` already present (lines 8-11). CSS-first only — confirmed `@tailwindcss/postcss` in `postcss.config.mjs`, no `tailwind.config.js`. Tailwind utilities OK for raw layout; semantic color must come from tokens (`foundation.md` lines 39-41).

---

### `src/app/layout.tsx` (provider — root shell + fonts)

**Current state** (lines 1-23): no fonts (system-ui), `<html lang="ru" className="h-full antialiased">`, `<body className="min-h-full flex flex-col">`, `<Nav/>{children}`.

**Target — fonts via `next/font/google`** (Next idiom, no FOUT; CONTEXT lines 26-27). Add at top of file:
```tsx
import { Oswald, Inter, JetBrains_Mono } from "next/font/google";

const display = Oswald({ subsets: ["latin", "cyrillic"], weight: ["500","600","700"], variable: "--next-oswald", display: "swap" });
const body    = Inter({ subsets: ["latin", "cyrillic"], variable: "--next-inter", display: "swap" });
const mono    = JetBrains_Mono({ subsets: ["latin", "cyrillic"], weight: ["500","700"], variable: "--next-jetbrains", display: "swap" });
```
Weights mirror the sketch `@import` lines (Oswald 500/600/700 from `court.css` line 6; Inter 400-700 + JetBrains 500/700 from `_base.css` line 24). **Cyrillic subset required** (CONTEXT line 27).

**Target — wire vars onto `<html>`** so tokens in `globals.css` resolve:
```tsx
<html lang="ru" className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}>
```
Keep `<body className="min-h-full flex flex-col">` and `<Nav/>{children}` structure unchanged (no structural change in scope).

---

### `src/components/nav.tsx` (component — global chrome)

**Current state** (lines 1-69): RSC, `getOptionalSession()`, inline SVG logo, monochrome Tailwind: `border-current/15` (line 16), `hover:opacity-80`, `bg-foreground text-background` register button (line 60).

**Target — minimal token restyle only** (CONTEXT line 38: no structural / link changes). Replace monochrome utilities with Court tokens:
- `<nav>` border: `border-current/15` → `border-b border-[var(--border)]`; background may stay transparent over `--page`.
- Register CTA (line 58-63): `bg-foreground text-background` → `.btn .btn-primary` class (from ported component layer).
- Plain links: keep utilities or use `.muted`/token color; hover stays subtle.
- Logo SVG `fill="currentColor"` already token-friendly — leave; ensure surrounding text uses `--text` / `--font-display` if a wordmark treatment is wanted.
- No hardcoded hex (anti-pattern, `foundation.md` lines 330-331). All color via tokens or ported classes.

---

### `src/components/tournament-status-badge.tsx` (component — status → label/class)

**Current state** (lines 8-37): `STATUS_LABELS` (registration "Регистрация открыта", in_progress "Идёт", finished "Завершён"), `STATUS_CLASSES` using `bg-green-900/40` / `bg-amber-900/40` / `bg-white/10` (hardcoded Tailwind literals), renders `inline-block rounded-full px-3 py-1 text-xs font-medium`.

**Target — map to `.badge-*` classes** (`foundation.md` lines 237-259 status mapping + `_base.css` lines 149-165). Keep the `Record<TournamentStatus,...>` + `isKnownStatus` type-guard structure (clean, keep it). Change only the class map:
```ts
const STATUS_CLASSES: Record<TournamentStatus, string> = {
  registration: "badge badge-reg",
  in_progress:  "badge badge-prog",
  finished:     "badge badge-fin",
};
```
- Drop the `inline-block rounded-full px-3 py-1 text-xs font-medium` literal wrapper — `.badge` (lines 149-161) already provides shape/type/padding/uppercase. Render `<span className={className}>{label}</span>`.
- Fallback (unknown status): use `"badge"` alone (or a neutral pill) instead of `bg-white/10`.
- Label note: sketch RU label for registration is **"Регистрация"** (`foundation.md` line 245); current uses "Регистрация открыта". Keep current app labels unless planner decides to align — the badge *class* mapping is the load-bearing requirement, not the label text.
- Live pulsing dot comes free from the `.badge-reg::before` animation added in `globals.css` — no markup change.

## Shared Patterns

### Token-only color (no hardcoded hex)
**Source:** `court.css` lines 8-62 (the only place hex lives), `foundation.md` lines 6-7, 330-331.
**Apply to:** all four files. Every color = `var(--token)` or a ported `.class`. The recurring sketch bug was a hardcoded select-chevron stroke — fixed via token-tinted CSS mask (`foundation.md` lines 278-300); relevant when forms land in phase 13, not this phase.

### Component layer ordering (theme tokens first, components second)
**Source:** `foundation.md` lines 261-276. Components read tokens, so in `globals.css`: `@import "tailwindcss"` → `:root` token block → `@theme inline` mapping → `@layer components { _base… }` → `body`. One import in root layout (already the case via `import "./globals.css"`).

### Container queries, never media queries
**Source:** `foundation.md` lines 215-235.
**Apply to:** convention established here; consumed in phases 13/14. `container-type: inline-size` on page wrapper, `@container (max-width: …)` for all breakpoints (common: ~860px two→one col, ~480px phone). Intentional horizontal scroll allowed for bracket (003) and standings (009).

### `next/font` CSS-variable bridge
**Source:** Next idiom + `foundation.md` type tokens.
**Apply to:** `layout.tsx` exposes `--next-oswald/-inter/-jetbrains`; `globals.css` `--font-display/-body/-mono` consume them. Names must stay consistent across the two files — single source of truth.

## No Analog Found

None — all targets are modify-in-place with a sketch source as the design contract. The optional new component-CSS file (`_base.css` import) is pure extraction from `sources/_base.css` and needs no codebase analog.

## Metadata

**Analog search scope:** `src/app/`, `src/components/`, `.claude/skills/sketch-findings-diplom/{references,sources,sources/themes}`
**Files scanned:** 9 (4 app files, 5 design sources) + `postcss.config.mjs`, `package.json`
**Pattern extraction date:** 2026-06-14
**Verified stack:** next 16.2.7, tailwindcss ^4 via `@tailwindcss/postcss` (CSS-first, no `tailwind.config.js`)
