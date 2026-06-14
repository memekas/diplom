---
sketch: 003
name: playoff-bracket
question: "How should the single-elimination bracket read across 4/8/16 pairs — round columns, match cards, scores, champion?"
winner: null
tags: [bracket, playoff, single-elimination, tournament, scores, champion]
---

# Sketch 003: playoff-bracket

## Design Question
How should the single-elimination bracket read across 4/8/16 pairs — round columns, match cards, scores, champion?

## How to View
open .planning/sketches/003-playoff-bracket/index.html
(toolbar bottom-right: switch theme Court/Editorial/Glass + viewport; tabs top: switch layout A/B)

## Variants
- **A: Classic columns** — established left→right bracket: round-labeled columns, two-slot match cards with mono per-set scores, winner slot highlighted, champion banner above; scrolls horizontally for the 16-draw.
- **B: Final spotlight** — the Финал + champion blown up as a hero (trophy, big pair names, final score), with all earlier rounds collapsed into a compact horizontal feeder rail beneath.

## What to Look For
- **Winner legibility** — the highlighted (`--winner-bg`) slot + mono score + check-mark should make the advancing pair obvious at a glance in all three themes (neon Court, serif Editorial, frosted Glass).
- **Score line** — per-set `6:4 6:3` / 3-set `7:5 4:6 6:2` in tabular mono; check it stays aligned and doesn't crowd long Russian names.
- **Scale & scroll** — toggle 4 / 8 / 16: 4 shows Полуфинал→Финал, 8 is fully decided, 16 prepends a TBD-heavy "8 раунд" round to demo horizontal scroll; verify round labels relabel correctly by depth.
- **Champion treatment** — compare A's slim banner vs B's hero: which reads more like a tournament result?
- **TBD / dimmed slots** — placeholder "Победитель пары" slots in the 16-draw should recede without looking broken.
- **375px hold** — both variants must stay usable on phone (hero stacks, columns scroll).
