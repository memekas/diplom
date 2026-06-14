---
sketch: 008
name: auth
question: How do login and registration look — entry into the app, matching the Court aesthetic?
winner: "A"
tags: [auth, login, register, form, onboarding, court]
---

# Sketch 008: auth

## Design Question

How do login and registration look — entry into the app, matching the Court aesthetic? Both flows live in one screen and switch in place (Вход / Регистрация), reusing the established tokens + `_base` components so all three themes reskin for free.

## How to View

Open `/Users/memeka/diplom/.planning/sketches/008-auth/index.html` in a browser.

- Toolbar (bottom-right): switch **Theme** (Court / Editorial / Glass) and **View** (Phone 375px / Tablet 768px / Full).
- Top bar: switch **Layout** tabs — **A: Карточка с вкладками** / **B: Сплит-панель бренда**.
- In either layout, use the **Вход / Регистрация** segmented toggle (or the footer cross-link) to swap the form in place — register reveals имя, ник, телефон, дата рождения, уровень. Try the password eye-toggle and a bad submit to see RU validation.

## Variants

- **A: Tabbed card** — one centered auth card; a segmented Вход/Регистрация toggle swaps the form in place under a brand + court-net seam.
- **B: Split brand panel** — full-height split: left brand panel with a padel court-line motif, product name + tagline + stats; the form (same toggle) sits on the right.

## What to Look For

1. **Mode switch** — does toggling Вход↔Регистрация feel instant and coherent (title, sub, button label, footer link, and the collapsing register-only fields all move together)?
2. **Field fidelity** — register collects exactly the real schema fields: имя, email, пароль (≥8), ник (3–30, `[A-Za-z0-9_-]`), телефон + дата рождения (optional), уровень (required, 5 levels). courtSide is intentionally absent.
3. **Distinctiveness vs. generic auth** — neither variant is a lonely default-blue card; the court-line motif (B) and net-rule seam (A) read as padel, not boilerplate.
4. **Theme hold** — Court (neon dark), Editorial (light serif), Glass (frosted): inputs, segmented toggle, level chips, error state, and the ball/court motif all stay legible and intentional.
5. **Responsive** — at 375px the split stacks (brand on top), the 2-up телефон/дата row collapses to one column, and nothing overflows.
