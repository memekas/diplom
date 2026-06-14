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

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 001 | pair-registration | How should joining a tournament as a pair feel — entering a partner by nickname, plus the "full / already in / log in" states? | _tbd_ | form, registration |
| 002 | tournament-info | What layout makes the tournament page read at a glance — meta, capacity, participant pairs, status, CTA? | _tbd_ | layout, detail, hero |
| 003 | playoff-bracket | How should the single-elimination bracket read across 4/8/16 pairs — round columns, match cards, scores, champion? | _tbd_ | bracket, dataviz |

## Shared assets
- `themes/court.css`, `themes/editorial.css`, `themes/glass.css` — token contract (see `_base.css` header).
- `_base.css` — token-driven component layer (cards, buttons, fields, badges, meta rows, progress, sketch chrome).
