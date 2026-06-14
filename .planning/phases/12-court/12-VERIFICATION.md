---
phase: 12-court
verified: 2026-06-14T00:00:00Z
status: human_needed
score: 6/6 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open http://localhost:3000 and /tournaments at 375px (iPhone SE) in DevTools device toolbar"
    expected: "Court dark court-field background (teal gradient --page, not monochrome black), light --text, Inter body / Oswald headings; Nav border + ball-green Регистрация CTA; status badges in Court colors with pulsing reg dot; no unintended horizontal scroll; nav wraps correctly"
    why_human: "Visual appearance + responsive ≤375px rendering cannot be confirmed by static code inspection. Deliberately deferred to the collective v3.0 visual UAT after Phase 14 (STATE.md Deferred Items / 12-02-SUMMARY) — NOT a gap; the code side (container-query convention .cq + base shell) is verified below."
---

# Phase 12: Дизайн-фундамент (Court) Verification Report

**Phase Goal:** Дизайн-язык Court живёт в реальном Tailwind 4 — токены и компонентный слой доступны всем экранам, вёрстка реагирует на ширину контейнера через container-queries; глобальная оболочка (фон-поле, шапка, типографика) переведена на Court. Per-screen restyle OUT of scope (phases 13/14).
**Verified:** 2026-06-14
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1   | App shell renders Court (dark `--page` field, `--text`, Oswald/Inter/JetBrains Mono) instead of monochrome | ✓ VERIFIED | `globals.css:248-258` body uses `background: var(--page)`, `color: var(--text)`, `font-family: var(--font-body)`. Fonts loaded `layout.tsx:6-22` via next/font. (Live visual deferred — human item.) |
| 2   | All Court tokens (surfaces/text/brand/status/type/shape) on `:root`, available to all screens | ✓ VERIFIED | `globals.css:3-61` full token contract 1:1 from court.css; 91 token references; all SC-required tokens present (`--page --surface --border --ring --primary --accent --badge-*-fg --radius* --shadow* --fw-strong` etc.) |
| 3   | `_base` component layer (.card/.btn/.field/.badge/.meta/.progress/...) available as `@layer components`, names 1:1 | ✓ VERIFIED | `globals.css:68-244` — all 29 component classes present and confirmed (card/card-pad/surface-2/btn/btn-primary/btn-ghost/btn-block/field/label/input/hint/error/badge/badge-reg/-prog/-fin/pill/pill-accent/avatar/meta/meta-row/meta-key/meta-val/progress/empty/eyebrow/muted/faint/mono) |
| 4   | Oswald/Inter/JetBrains Mono via next/font/google, cyrillic subset, bridged to `--font-display/-body/-mono` | ✓ VERIFIED | `layout.tsx:6-22` three loaders all `subsets:["latin","cyrillic"]`, `variable:--next-*`; `globals.css:47-49` font tokens consume `var(--next-oswald/-inter/-jetbrains)`. Build green = fonts resolve. |
| 5   | container-query convention (`container-type: inline-size` + `@container`, not `@media`) established for 13/14 | ✓ VERIFIED | `globals.css:243` `.cq { container-type: inline-size; }` + comment documenting 13/14 usage. Convention established (live ≤375px = human item). |
| 6   | No hardcoded hex in code — all colors via `var(--token)` | ✓ VERIFIED | awk scan lines 62+ of globals.css: NONE. nav.tsx / badge.tsx / logout-button.tsx: no `bg-foreground`/`text-background`/`border-current`/hex. Hex lives only in `:root`. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/app/layout.tsx` | next/font 3 families + var-bridge on `<html>` | ✓ VERIFIED | Oswald/Inter/JetBrains_Mono imported; all `.variable` on `<html>`; cyrillic subset; `<body>` + `<Nav/>{children}` unchanged |
| `src/app/globals.css` | token :root + @layer components + body shell + container-query + liveDot | ✓ VERIFIED | 264 lines (>200 min); all required blocks present; liveDot keyframes `260-263` + `.badge-reg::before` animation `184` |
| `src/components/nav.tsx` | Nav restyled to Court, structure unchanged | ✓ VERIFIED | `border-[var(--border)]`, `.btn .btn-primary` CTA, `.muted/.faint` links; getOptionalSession + all `<Link href>` + LogoutButton unchanged |
| `src/components/tournament-status-badge.tsx` | status → .badge-* map; type-guard kept | ✓ VERIFIED | STATUS_CLASSES → `badge badge-reg/-prog/-fin`; `isKnownStatus` + STATUS_LABELS kept; fallback `"badge"`; no Tailwind color literals |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| globals.css | layout.tsx | `var(--next-oswald/-inter/-jetbrains)` | ✓ WIRED | `globals.css:47-49` consume the exact `--next-*` vars set in `layout.tsx:6-22` |
| globals.css body | `--page` | `background: var(--page)` | ✓ WIRED | `globals.css:251` |
| tournament-status-badge.tsx | globals.css `.badge-reg/-prog/-fin` | STATUS_CLASSES → ported classes | ✓ WIRED | `badge badge-reg|prog|fin` present + consumed in 2 pages (tournaments, [id]) |
| nav.tsx | globals.css `.btn .btn-primary` | Регистрация CTA className | ✓ WIRED | `nav.tsx:58` `className="btn btn-primary"` |
| layout.tsx | nav.tsx | `<Nav/>` | ✓ WIRED | imported + rendered `layout.tsx:4,40` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| TypeScript clean | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Production build green | `npx next build` | Compiled successfully, 11 routes generated | ✓ PASS |
| Fonts resolve at build | (implicit in build) | no font-data error | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| UI-01 | 12-01, 12-02 | Court theme (tokens + component layer) in Tailwind 4, available to all screens; responsive via container-queries | ✓ SATISFIED | Full token contract + `@layer components` in globals.css; applied on Nav + badge; `.cq` container-query convention established |
| UI-10 | 12-01, 12-02 | All screens render on phone (~375px) without breaks / unintended horizontal scroll | ? NEEDS HUMAN | CODE side satisfied (`.cq` convention + flex-wrap nav shell); live ≤375px visual check deferred to collective v3.0 UAT after Phase 14 (per STATE.md / 12-02-SUMMARY) |

No orphaned requirements — both UI-01 and UI-10 map to Phase 12 in REQUIREMENTS.md and appear in both plans' frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| globals.css | 4-6, 63-66 | Dead `--background/--foreground` + `@theme inline` retained | ℹ️ Info | By-design per CONTEXT (kept as part of set); REVIEW WR-02. Not a defect — guidance lists as known non-defect. |
| nav.tsx | 5 | `placeholder` comment (CLUB_NAME) | ℹ️ Info | Pre-existing v2.0 content, not a stub; renders real text. Out of restyle scope. |

No `TBD`/`FIXME`/`XXX` debt markers in phase-modified files. No blocker anti-patterns.

### Human Verification Required

#### 1. Court shell visual + responsive ≤375px (UI-10)

**Test:** Run `npm run dev`, open http://localhost:3000 and /tournaments. In DevTools device toolbar set width to 375px (iPhone SE).
**Expected:** Dark Court court-field (teal gradient `--page`, not monochrome black); light text; Inter body + Oswald headings/wordmark. Nav: thin token border, ball-green «Регистрация» CTA with soft shadow, readable links. Status badges: Court pill colors, pulsing dot on «Регистрация открыта». At 375px: no unintended horizontal scroll, nav wraps correctly, content readable.
**Why human:** Visual rendering and responsive layout cannot be confirmed by static code inspection. Deliberately batched into the collective v3.0 visual UAT after Phase 14 (STATE.md Deferred Items). This is a deferred human-verify item, not a gap — the code-level foundation (container-query convention, base shell, flex-wrap nav) is verified.

### Gaps Summary

No gaps. All 6 observable truths are VERIFIED in the codebase, all 4 artifacts pass existence/substantive/wiring checks, all 5 key links are WIRED, `tsc` and `next build` are green (11 routes), and no hardcoded hex exists outside the `:root` token block. The component-class layer ports all 29 `_base` names 1:1 and the status badge / nav consume them on live surfaces.

The single open item (UI-10 live ≤375px visual confirmation) is an intentionally-deferred human-verification item per STATE.md and the phase plan, not a missed deliverable — the CODE side of UI-10 (the `.cq` container-query convention + flex-wrap base shell) is present and verified. Per the status decision tree, the presence of a non-empty human-verification section forces `status: human_needed` even though the score is 6/6.

REVIEW findings WR-01 (`.cq` naming), WR-02 (retained `--background/--foreground`) are confirmed by-design per CONTEXT and the verification guidance (explicit known non-defects). IN-04 (logout-button) is already resolved — `logout-button.tsx:19` now uses `className="btn btn-ghost"`.

---

_Verified: 2026-06-14_
_Verifier: Claude (gsd-verifier)_
