---
sketch: 007
name: create-tournament
question: "How does the admin create a tournament — a form whose fields change by format?"
winner: "A"
tags: [admin, create-tournament, form, conditional-fields, format-driven, live-preview, segmented-control]
---

# Sketch 007: create-tournament

## Design Question
How does the admin create a tournament — a form whose fields change by format?

## How to View
open .planning/sketches/007-create-tournament/index.html
(toolbar bottom-right: switch theme Court/Editorial/Glass + viewport Phone/Tablet/Full; tabs top: switch layout A/B)

## Variants
- **A: Секционная форма** — one clean single column grouped into three numbered sections (Основное · Формат и подсчёт · Время и место); changing Формат rewrites the size field (сетка-select ↔ число-input), locks Тип/Подсчёт via segmented controls, and reveals «Число раундов» for round formats — all inline, top-to-bottom.
- **B: Форма + превью** — denser two-up form on the left with a sticky live PREVIEW card on the right that reproduces the home-list tournament card (name, badge «Регистрация», format/level/size/score chips, capacity, price), flashing and updating on every keystroke and field change.

## What to Look For
- Conditional logic: switch Формат to Американо/Мексикано — Тип snaps to «Одиночный» and Подсчёт to «Очки», both lock with a lock-hint, and «Число раундов» appears (required+red «обязательно» only for Мексикано). Back to Олимпийская — the size control flips to the «4/8/16 пар» select and your previous Тип/Подсчёт choice is restored.
- Size control swap: playoff = a select (4/8/16 пар); круговой/американо/мексикано = a number input with the right min (3/4/8) and label «Количество участников» vs «Размер сетки».
- Live preview fidelity (B): does the right card read like the real list card, and does the flash-on-update make cause→effect obvious without being noisy?
- Forced-state affordance: is it clear *why* Тип/Подсчёт are disabled (the lock chip + dimmed segmented pills), so the admin doesn't think the control is broken?
- Theme hold: condensed neon Court, light-serif Editorial, frosted Glass — verify the segmented controls, select arrows, ₽ adornment, section numbers, and B's sticky preview card all keep contrast/spacing and reflow to one column under 880px (form) / 480px (fields stack).
