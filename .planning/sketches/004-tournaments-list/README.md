---
sketch: 004
name: tournaments-list
question: "How does the public tournaments browse page read — cards/list of tournaments with filters by status / format / level?"
winner: "B"
tags: [tournaments-list, public-page, landing, filters, search, card-grid, dense-list, status-badge, capacity]
---

# Sketch 004: tournaments-list

## Design Question
How does the public tournaments browse page read — cards/list of tournaments with filters by status / format / level?

## How to View
open .planning/sketches/004-tournaments-list/index.html
(toolbar bottom-right: switch theme Court/Editorial/Glass + viewport Phone/Tablet/Full; tabs top: switch layout A/B)

## Variants
- **A: Card grid** — responsive 2–3 column grid of rich tournament tiles, each with a status seam, format tag + status badge, title, дата · место, вид/уровень pills, a capacity X/size + progress bar, and a footer pairing цена with an «Открыть» affordance; a filter bar (search + статус chips + формат/уровень/вид selects) sits on top.
- **B: Dense list** — one aligned, scannable row per tournament with table-ish columns (Турнир · Формат/вид · Уровень · Места · Взнос · статус), a left status seam, and an all-chips filter panel on top (статус · формат · уровень); collapses to a stacked two-line row under 880px.

## What to Look For
- Scan speed vs. richness: A's tiles surface дата/место/pills/progress at a glance per card; B fits far more tournaments per screen in aligned columns — which reads faster for "find an open турнир at my level"?
- Filter ergonomics: A mixes статус chips with формат/уровень/вид **selects**; B is **all chips** (more taps visible, no dropdowns). Try filtering Статус→Регистрация, Формат→Круговой, then search «арена» — the result count + «найдено N» update live and an empty-state appears when nothing matches.
- Status legibility: Регистрация (pulsing dot) / Идёт / Завершён must stay distinct via badge + the left status seam in all three themes; check «Кубок Лета» 0/8 (empty bar) and «Мексикано Вечер» 8/8 (full bar) read correctly.
- Price treatment: «бесплатно» (Новички Weekend) renders in the success token, paid взносы in mono/display — verify both stay readable on light Editorial and frosted Glass.
- Theme hold + responsive: condensed neon Court, light serif Editorial, frosted Glass — confirm cards, the dashed net-rule divider, chips, selects, and the dense-list column grid keep contrast and alignment, and that A collapses 3→2→1 column and B stacks rows without horizontal overflow at 375px.
