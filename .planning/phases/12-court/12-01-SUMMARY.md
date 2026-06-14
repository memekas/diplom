---
phase: 12-court
plan: 01
subsystem: ui-foundation
tags: [css, theme, tokens, tailwind, fonts, container-queries]
requires: []
provides:
  - "Court design tokens on :root (surfaces/text/brand/status/type/shape) in globals.css"
  - "_base component layer (.card/.btn/.field/.badge/.pill/.avatar/.meta/.progress/.empty + type helpers) in @layer components, names 1:1 with sketches"
  - "next/font bridge vars --next-oswald/--next-inter/--next-jetbrains on <html>"
  - ".cq container-query wrapper utility (container-type: inline-size)"
  - "liveDot keyframes + .badge-reg::before pulse"
affects:
  - src/app/layout.tsx
  - src/app/globals.css
tech-stack:
  added: []
  patterns:
    - "next/font/google with cyrillic subset, exposed as CSS vars"
    - "Tailwind 4 CSS-first @layer components, token-driven"
    - "container queries (@container) over media queries"
key-files:
  created: []
  modified:
    - src/app/layout.tsx
    - src/app/globals.css
decisions:
  - "Container-query wrapper utility named .cq (phases 13/14 attach it to per-screen wrappers)"
  - "Inter loaded without explicit weight (variable axis); Oswald 500/600/700, JetBrains Mono 500/700 mirror sketch @imports"
  - "Component layer + body shell + keyframes live in globals.css single file (no separate _base.css extraction needed)"
metrics:
  duration: "~6 min"
  completed: 2026-06-14
  tasks: 2
  files: 2
---

# Phase 12 Plan 01: Court Design Foundation Summary

Ported the full Court design-token contract and the `_base` component layer 1:1 into `src/app/globals.css`, loaded Oswald/Inter/JetBrains Mono via `next/font/google` (cyrillic subset) bridged into `--font-display/-body/-mono`, switched the global `body` to the Court court-field, and established the container-query convention plus the live-dot reg badge.

## What Was Built

**Task 1 — Fonts (`src/app/layout.tsx`)** `8913464`
- Three module-level loaders from `next/font/google`: `Oswald` (weights 500/600/700, var `--next-oswald`), `Inter` (variable axis, no explicit weight, var `--next-inter`), `JetBrains_Mono` (weights 500/700, var `--next-jetbrains`). All with `subsets: ["latin","cyrillic"]` and `display: "swap"`.
- Wired all three `.variable` onto `<html className={... h-full antialiased}>`. `<body className="min-h-full flex flex-col"><Nav/>{children}` left unchanged.

**Task 2 — Tokens + component layer (`src/app/globals.css`)** `0345382`
- `:root`: full Court token contract copied verbatim from `court.css` (surfaces/text/brand/status/type/shape), retained existing `--background/--foreground` pair. Hex lives ONLY here.
- Font tokens overridden to consume the next/font bridge vars: `--font-display: var(--next-oswald), …`, `--font-body: var(--next-inter), …`, `--font-mono: var(--next-jetbrains), …`.
- `@theme inline` mapping kept as-is.
- `@layer components`: `_base.css` lines 51–219 ported verbatim — typography (`h1/h2/h3`, `.eyebrow/.muted/.faint/.mono`, `a`), `.card/.card-pad/.surface-2`, `.btn/.btn-primary/.btn-ghost/.btn-block`, `.field/.label/.input/.hint/.error`, `.badge/.badge-reg/-prog/-fin`, `.pill/.pill-accent`, `.avatar`, `.meta/.meta-row/.meta-key/.meta-val`, `.progress`, `.empty`.
- Global shell: `*` box-sizing reset + `body` on `--page` / `--text` / `--font-body` (no `padding-top: 52px` sketch hack).
- `@keyframes liveDot` + `.badge-reg::before { animation: liveDot 1.8s … }`.

## Container-Query Wrapper Utility

**Name: `.cq`** — `.cq { container-type: inline-size; }` (in `@layer components`).

Phases 13/14 MUST attach `.cq` to each per-screen wrapper and use `@container (max-width: …)` (NOT `@media`). The root layout intentionally does not apply it.

## Deviations from Plan

None — plan executed exactly as written. Both tasks completed against the specified acceptance criteria. nav.tsx and tournament-status-badge.tsx restyles are scoped to later plans (per 12-PATTERNS), not this plan's `<tasks>`.

## Verification

- `npx tsc --noEmit` — clean (exit 0).
- `npx next build` — succeeds; all 11 routes compile, CSS compiled by Tailwind 4.
- grep confirms `--page`, `container-type: inline-size`, `@keyframes liveDot`, `var(--next-oswald)`, `@layer components` all present.
- No sketch-chrome (`#variant-nav`/`#sketch-tools`/`.variant`), no `--app-max`/`.app` preview hack, no googleapis `@import` ported.
- No raw hex literals outside the `:root` token block (awk scan after `@theme inline` returned empty).

## Self-Check: PASSED
- src/app/layout.tsx — FOUND
- src/app/globals.css — FOUND
- commit 8913464 — FOUND
- commit 0345382 — FOUND
