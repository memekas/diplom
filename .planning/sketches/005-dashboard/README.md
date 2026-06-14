---
sketch: 005
name: dashboard
question: What does a player see in their dashboard (ЛК) — their tournaments, partners, what is next?
winner: null
tags: [dashboard, личный-кабинет, player, tournaments, partners, stats]
---

# Sketch 005: dashboard

## Design Question

What does a logged-in player see in their personal dashboard (ЛК) — the tournaments they are
registered in (grouped by state), who their partners are, and what is coming up next?

## How to View

Open `/Users/memeka/diplom/.planning/sketches/005-dashboard/index.html` in a browser.
- **Theme** switcher (bottom-right): Court (default) / Editorial / Glass — the screen reskins live.
- **View** switcher (bottom-right): Phone (375px) / Tablet (768px) / Full.
- **Layout** tabs (top): A / B switch between the two variants. CTAs fire a toast to close the loop.

## Variants

- **A: Мои турниры** — sectioned single column («Активные» / «Предстоящие» / «Завершённые»), each tournament a card with format + status, the player's role (пара с … / одиночный зачёт) and a state-appropriate CTA (к раунду / открыть / результаты).
- **B: Обзор + статистика** — hero greeting, four honest KPI tiles (всего 4 · идёт 1 · предстоит 2 · лучший результат 2-е место), a «Следующий турнир» highlight, a compact «Мои турниры» list and a sticky rail with «Мои партнёры» + the profile card.

## What to Look For

1. **State grouping vs. overview** — does the explicit «Активные / Предстоящие / Завершённые» sectioning (A) read clearer than the stat-tiles + flat list (B)?
2. **Role legibility** — paired registrations show the partner avatar + "пара с …"; singles formats (Американо/Мексикано) show a "одиночный" treatment. Is the pair/solo distinction obvious at a glance?
3. **"What's next" prominence** — A leans on the live «Идёт» card at the top; B promotes a dedicated «Следующий турнир» block. Which surfaces the next action faster?
4. **Honest stats** — every tile/figure is derivable from User + Pair + TournamentPlayer + registrations (no invented win-rate/rating). Confirm nothing fabricates a feature the schema lacks.
5. **Theme + responsive hold** — status colours (badge-reg/prog/fin) and the left accent rail stay coherent in all 3 themes; cards reflow to single column and the rail unsticks below 860px / 560px with no overflow.
