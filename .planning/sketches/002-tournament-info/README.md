---
sketch: 002
name: tournament-info
question: "What layout makes the tournament page read at a glance — meta, capacity, participant pairs, status, CTA?"
winner: null
tags: [tournament-detail, public-page, participants, capacity, cta, two-column, hero]
---

# Sketch 002: tournament-info

## Design Question
What layout makes the tournament page read at a glance — meta, capacity, participant pairs, status, CTA?

## How to View
open .planning/sketches/002-tournament-info/index.html
(toolbar bottom-right: switch theme Court/Editorial/Glass + viewport; tabs top: switch layout A/B)

## Variants
- **A: Programme column** — elegant single editorial column: title hero with eyebrow + status badge, regulation as a refined meta list, capacity progress, full participant pairs list, then CTA and admin block stacked at the bottom — reads top-to-bottom like a tournament programme.
- **B: Hero dashboard** — bold hero band with the name, status, and four stat tiles (8 пар / Плей-офф / 5·8 занято / 1500 ₽), then a two-column body: wide participants list on the left and a sticky side card holding meta + Участвовать CTA + admin controls.

## What to Look For
- Scan speed: do the four stat tiles in B let you read size/format/capacity/price instantly, vs. having to read A's meta rows in order?
- Capacity legibility: the 5/8 count + progress bar appears in both — which placement (inline header in B vs. dedicated section in A) communicates "almost full" faster?
- "Your pair" highlight: the seed-1 row uses the primary-soft fill, inset bar, and «Ваша пара» tag — verify it stays obviously distinct in all three themes without looking broken.
- CTA reachability: A puts «Участвовать» after the full list (commit after reading); B keeps it sticky in the side rail (always one click away). Click it to see the idle → submitting → «Вы уже зарегистрированы.» loop.
- Theme hold: condensed neon Court, light serif Editorial, frosted Glass — check that pair rows, tiles, the dashed admin block, and the disabled «Старт турнира · 5/8» button all keep contrast and spacing, and that B's sticky side card doesn't crowd the list on tablet/phone (collapses to one column under 860px).
