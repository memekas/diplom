# Sketch Wrap-Up Summary

**Date:** 2026-06-14
**Sketches processed:** 9 (9 included, 0 excluded)
**Design areas:** Foundation · Forms & Auth · Browse (lists/cards/filters) · Tournament pages & data display
**Skill output:** `./.claude/skills/sketch-findings-diplom/`

## Included Sketches
| # | Name | Winner | Design Area |
|---|------|--------|-------------|
| 001 | pair-registration | B — Guided slot | Forms & Auth |
| 002 | tournament-info | A — Programme column | Tournament pages |
| 003 | playoff-bracket | A — Classic columns | Tournament pages |
| 004 | tournaments-list | B — Dense list (collapsed filters; phone cards) | Browse |
| 005 | dashboard | A — Мои турниры | Browse |
| 006 | profile | A — Карточка + форма | Forms & Auth |
| 007 | create-tournament | A — Секционная форма | Forms & Auth |
| 008 | auth | A — Карточка с вкладками | Forms & Auth |
| 009 | tournament-formats | both A (Круговой) + B (Американо/Мексикано) | Tournament pages |

## Excluded Sketches
_None._

## Design Direction
**Court** — dark, sporty-neon (deep teal court field + ball-green primary). Display Oswald, body Inter, scores
JetBrains Mono (tabular). All colour via theme tokens; two token-compatible alternates exist (Editorial light
serif, Glass frosted dark) but Court ships. Token-driven `_base.css` component layer; **container-query**
responsive (`.app` is a container; `@container` not `@media`) so layout tracks the box width on any device.

## Key Decisions
- **Theme/tokens:** one token contract, three themes, Court chosen. Never hardcode colour (recurring bug:
  hardcoded SVG select-chevron — replaced with a token-tinted CSS mask).
- **Responsive:** container queries everywhere; cards/forms reflow on box width. Intentional horizontal scroll
  only for the playoff bracket (003) and wide standings tables (009).
- **Forms:** `_base` field primitives + radio-pill segmented controls; the create-tournament form is
  format-conditional and mirrors `createTournamentSchema` (americano/mexicano force Одиночный + Очки + Число
  раундов; playoff/round_robin keep Тип & Подсчёт selectable).
- **Lists:** tournaments list = dense table on desktop, card-per-row on phone; filters collapsed into a
  «Фильтры» button + popover with an active-count badge; fixed-width table columns (an `auto` column misaligns
  independent row grids).
- **Bracket score:** set-tally stacked as a column + per-set games in a hover/tap popover; **no final score**;
  next-round cards centred on their feeder midpoint (transform transition removed to keep geometry reads sync).
- **Format pages:** round-robin = schedule + standings table; americano/mexicano = current/past games + player
  rating (no knockout cut-line).
- **Data fidelity:** real RU label vocabulary and real field names throughout (verified against the codebase).
