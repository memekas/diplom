---
status: deferred
phase: 12-court
source: [12-VERIFICATION.md]
started: "2026-06-14T14:00:00.000Z"
updated: "2026-06-14T14:00:00.000Z"
note: Batched into the collective v3.0 visual UAT after Phase 14 (see STATE.md Deferred Items). Code side of UI-01/UI-10 verified 6/6; only the live visual/responsive check is outstanding.
---

## Current Test

number: 1
name: Court shell visual + ≤375px responsive (UI-10)
expected: |
  Open `/` and `/tournaments` at 375px viewport width.
  - Court dark court-field background (--page), Court text color (--text)
  - Oswald (display) / Inter (body) fonts render, cyrillic correct
  - Ball-green primary CTA ("Регистрация" → .btn .btn-primary)
  - Reg-status badge shows pulsing live-dot (.badge-reg::before)
  - LogoutButton renders as ghost button (.btn .btn-ghost), consistent with nav
  - No unintended horizontal scroll at ≤375px
awaiting: collective v3.0 visual UAT (post Phase 14)

## Tests

### 1. Court shell visual + ≤375px responsive (UI-10)
expected: Court dark field + Oswald/Inter fonts + ball-green CTA + pulsing reg-dot + no unintended ≤375px horizontal scroll on `/` and `/tournaments`
result: [pending — deferred to collective v3.0 UAT]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps

None — all code-level must-haves verified (6/6). Only live visual confirmation is outstanding, intentionally batched to the collective v3.0 visual UAT after Phase 14.
