---
sketch: 006
name: profile
question: "How does a player view and edit their profile — the identity (name, @handle, play-style) separated from the editable fields?"
winner: null
tags: [profile, account, player-card, edit-form, identity, read-only-fields, segmented-control, two-column]
---

# Sketch 006: profile

## Design Question
How does a player view and edit their profile — the identity (name, @handle, play-style) separated from the editable fields?

## How to View
open .planning/sketches/006-profile/index.html
(toolbar bottom-right: switch theme Court/Editorial/Glass + viewport Phone/Tablet/Full; tabs top: switch layout A/B)

## Variants
- **A: Карточка + форма** — a single centered column: a "player pass" card on top (big initials chip, name, locked @USER-01 handle, уровень + сторона chips, read-only email/телефон), a court-net rule, then the edit form stacked below with «Сохранить».
- **B: Две колонки** — a sticky identity pass + read-only contacts card pinned on the left, with the wider edit panel on the right; collapses to a single column under 820px.

## What to Look For
- Identity vs. editable split: both put name/@handle/play-style in a read-mostly "pass" and the mutable fields (ФИО, уровень, сторона, телефон, дата рождения) in the form — A reads top-to-bottom, B keeps the pass visible while you edit. Which makes the "what's just-display vs. what I can change" boundary clearer?
- Read-only handling: @USER-01 (lock icon) and email carry a «только просмотр» treatment and never become inputs. Confirm they look intentionally locked, not broken/disabled-by-accident, in all three themes.
- Edit lifecycle: click «Редактировать» → fields unlock + focus; edit something → per-field changed-dot lights, Save enables, status line turns "несохранённые изменения"; «Сохранить» → submitting → «Профиль сохранён» and re-locks; «Отмена» reverts to baseline. Walk the whole loop.
- Сторона корта as a segmented control (Левая / Правая / Любая with chevron glyphs) instead of a native select — does the three-way picker feel better than a dropdown, and does the live chip up top update as you switch?
- Theme hold: condensed neon Court, light serif Editorial, frosted Glass — check the gradient identity card, the primary-soft chips, the segmented control's pressed state, and the green «сохранён» confirmation all keep contrast and don't clip at 375px (телефон row stacks, side-button icons hide).
