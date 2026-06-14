---
sketch: 001
name: pair-registration
question: "How should joining a tournament as a pair feel — entering a partner by nickname, plus the full / already-in / login states?"
winner: null
tags: [registration, pair, form, lookup, states, partner-nickname]
---

# Sketch 001: pair-registration

## Design Question
How should joining a tournament as a pair feel — entering a partner by nickname, plus the full / already-in / login states?

## How to View
open .planning/sketches/001-pair-registration/index.html
(toolbar bottom-right: switch theme Court/Editorial/Glass + viewport; tabs top: switch layout A/B)

## Variants
- **A: Pair card** — Two player slots side by side (you filled from session, partner empty) with a VS divider; typing a known nick (try `USER-07`) flips the partner slot to a resolved player and enables "Участвовать" — joining literally completes the pair.
- **B: Guided slot** — A calmer wizard-style single column: big "Соберите пару" heading, your identity as a confirmed chip, and the nickname field as the hero control with an inline live lookup row that shows found / not-found / self-error states beneath it.

## What to Look For
- Type `USER-07` (found), `USER-99` (not found), or `USER-01` (yourself) in the partner field — compare how A (in-slot swap) vs B (lookup row) surface the resolved/error preview live.
- Submit feedback: the "Участвовать" button gates on a valid partner, runs a loading state, then fires a success toast — feel the full join loop in both variants.
- The five page states (not-found, self, already-registered, full, anonymous) as a compact gallery — check the error/info/warn icon coding stays legible.
- Theme hold: dark neon Court, light serif Editorial, frosted Glass — verify the VS badge, resolved-preview borders, progress bar, and badges all reskin cleanly (all colors come from tokens).
- Phone (375px): the side-by-side slots in A stack with the VS pivoting to horizontal; the context strip capacity bar wraps to a full-width row.
