---
sketch: 009
name: tournament-formats
question: How do the NON-playoff tournament pages read — round-robin (schedule + standings) vs rotation (americano/mexicano: current/past games + player rating)?
winner: null
tags: [tournament, round-robin, americano, mexicano, standings, rating, rounds, table]
---

# Sketch 009: tournament-formats

Round-based tournament pages (playoff is sketch 003). Same header/meta idea as sketch 002
— name + status badge + compact meta strip + round progress — then a format-specific
visualization: per-round match list and a standings/rating table.

## Design Question

How do the NON-playoff tournament pages read — round-robin (schedule + standings) vs
rotation (americano/mexicano: current/past games + player rating)?

## How to View

Open `/Users/memeka/diplom/.planning/sketches/009-tournament-formats/index.html` in a browser.
- Bottom-right toolbar: switch **Theme** (Court / Editorial / Glass) and **View** (Phone / Tablet / Full).
- Top tabs: **A: Круговой** and **B: Американо / Мексикано**.

## Variants

- **A: Круговой** — round_robin pairs page: «Матчи» grouped by round (Корт N · пара — пара · счёт, with unplayed rows showing «Ожидает счёта») + «Турнирная таблица» (Место · Участник · Игр · Победы · Поражения · Очки · Разница), leader row highlighted.
- **B: Американо / Мексикано** — rotation singles page split into «Текущие игры» (live round, no score, «До 24»), «Прошедшие игры» (recorded rounds with scores), and «Рейтинг игроков» (Место · Игрок · Сыграно · Победы · Очки · Разница) with avatar names and a qualification cut line.

## What to Look For

- **Schedule legibility:** does the per-round grouping + court chip + winner-dot read as a clean match list, or does it feel like a raw table?
- **Standings vs rating shape:** round-robin shows Поражения (UnitStanding); rotation drops it for the player rating (PlayerStanding) — the two tables intentionally differ by one column.
- **Leader / cut emphasis:** the gold leader row and the dashed americano cut line should stay readable and on-theme across all three skins.
- **Live state:** rotation «Текущие игры» uses a tinted live block + «До 24» pills instead of scores — compare against round-robin's «Ожидает счёта» treatment.
- **Theme hold:** tabular-nums alignment, the net-rule divider, and the diff +/− colors should survive Court (neon dark), Editorial (light serif), and Glass (frosted) without overflow down to 375px.
