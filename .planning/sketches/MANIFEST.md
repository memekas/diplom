# Sketch Manifest — Padel Tournaments UI

## Design Direction

Visual/UX direction is **OPEN and unlocked**. The current app ships a bare monochrome
dark shell (black bg, gray text, system font, no accent) — design was never actually
considered, so nothing here treats prior UI/UX decisions as fixed. We explore freely for
a polished, distinctive look. Locked items are *stack* constraints only (Next 16 + Tailwind 4,
no component library, bracket via flex/grid), not aesthetics.

The exploration runs on **two independent axes** so a non-designer can react by comparison:

1. **Aesthetic direction** (swap live via the toolbar theme switcher) — three coherent
   design languages sharing one token contract:
   - **Court** — sporty neon, dark, scoreboard energy (teal court + ball-green accent, condensed Oswald).
   - **Editorial** — premium light, magazine / tournament programme (warm paper, ink, clay accent, Playfair serif).
   - **Glass** — modern dashboard, dark slate, frosted glass (violet→cyan gradient, Manrope).
2. **Layout** (variant tabs within each sketch) — 2 structurally different compositions per screen.

Pick a theme that feels right (global) + a layout per screen. Both reskin/relayout instantly.

## Reference Points

- Live-sport scoreboards / broadcast graphics (Court)
- Print tournament programmes & editorial sport magazines (Editorial)
- Linear / Vercel / modern SaaS dashboards (Glass)
- Real data shapes: Prisma `Tournament` / `Pair` / `Match` / `SetScore`; RU labels from the live app
  (Размер, Формат, Вид, Уровень, Цена, Режим подсчёта; statuses registration/in_progress/finished;
  round labels Финал/Полуфинал/Четвертьфинал; scores "6:4 3:6 6:2").

## Sketches

**Chosen aesthetic: `Court`** (sporty neon, dark, Oswald) — applies to all screens.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 001 | pair-registration | How should joining a tournament as a pair feel — entering a partner by nickname, plus the "full / already in / log in" states? | **B — Guided slot** | form, registration |
| 002 | tournament-info | What layout makes the tournament page read at a glance — meta, capacity, participant pairs, status, CTA? | **A — Programme column** | layout, detail, hero |
| 003 | playoff-bracket | How should the single-elimination bracket read across 4/8/16 pairs — round columns, match cards, scores, champion? | **A — Classic columns** | bracket, dataviz |
| 004 | tournaments-list | How does the public tournaments browse page read — list of tournaments with filters? | **B — Dense list** (filters collapsed into a button + popover; phone = A-style cards) | list, filters, landing |
| 005 | dashboard | What does a player see in their ЛК — their tournaments, partners, what is next? | **A — Мои турниры** (sectioned by status) | dashboard, лк |
| 006 | profile | How does a player view and edit their profile? | **A — Карточка + форма** | profile, form |
| 007 | create-tournament | How does the admin create a tournament — fields change by format? | **A — Секционная форма** (format-conditional fields verified vs validation) | admin, form, conditional |
| 008 | auth | How do login and registration look? | **A — Карточка с вкладками** | auth, login, register |
| 009 | tournament-formats | How do the non-playoff tournament pages read? | **both** — A (Круговой) + B (Американо/Мексикано) are distinct format pages, both ship | round-robin, rotation, standings |

## Responsive
All sketches use **container queries** (`.app` is `container-type: inline-size`; `@container` not `@media`),
so the layout reacts to the box width — the toolbar Phone/Tablet preview works the same as a real device.
Intentional horizontal scroll: the playoff bracket (003) and wide standings tables (009).

## Shared assets
- `themes/court.css`, `themes/editorial.css`, `themes/glass.css` — token contract (see `_base.css` header).
- `_base.css` — token-driven component layer (cards, buttons, fields, badges, meta rows, progress, sketch chrome).
