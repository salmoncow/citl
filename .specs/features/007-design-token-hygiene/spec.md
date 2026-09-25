# Feature: Design-Token Hygiene

**Feature ID**: 007-design-token-hygiene
**Created**: 2026-09-25
**Status**: Implemented (2026-09-25, branch `claude/wonderful-babbage-qzoupz`)
**Follows**: [006-site-redesign](../006-site-redesign/spec.md), which recorded AC-G5 as not met
and the dark-mode parity test (task 1.x) as not built.

---

## Problem

After 006 the token contract in `src/styles/tokens.css` ("components reference semantic
`--c-*` tokens only; colours belong in `tokens.css`") was a convention, not a check. On merge
(`c472f69`) component CSS held 51 hex literals, 17 `rgba()` literals and 6 direct primitive
(`--color-*`) references. The two dark-mode blocks, which must stay identical, were kept in
step by hand.

## Goal

Make the contract true and keep it true, with **no visual change**.

## Scope

1. **New tokens** in `tokens.css`, each carrying the value it replaces:
   - Primitives: `--color-frost`, `--color-navy-chip`, `--color-navy-edge`,
     `--color-navy-steel`, `--color-navy-tint`, `--color-red`.
   - Shell group (always dark): `--c-shell-text-bright`, `-chip`, `-outline`, `-progress`,
     `-hover`, `-wash`, `-skeleton`, `-fill`, `-rings`, `-panel`, and the `--c-shell-paper*`
     set for light chips placed on the shell (hero date block, first-night CTA).
   - Status: `--c-danger` (fill) and `--c-danger-text` (text; lighter in dark mode).
   - Shadows and overlays: `--shadow-sm`, `-sheet`, `-tooltip`, `-popover`, `-modal`,
     `--c-scrim`.
   - White text uses the existing `--c-text-inverse`.
2. **Component CSS** references only those tokens. The Rules hero's print override moves from
   `rules.css` to `print.css`, which stays exempt because print forces black on white.
3. **Enforcement**: `src/styles/tokens.test.ts` (runs in `npm test` and CI):
   - the two dark blocks are identical;
   - dark mode redefines only tokens the light `:root` declares, and never a primitive;
   - no hex, `rgb[a]()`, `hsl[a]()` or `white`/`black` value appears in a stylesheet other
     than `tokens.css` and `print.css`;
   - `var(--color-*)` appears only in `tokens.css`;
   - every `var(--x)` in `src/` resolves to a declared custom property.

## Intended behaviour changes

Only these two, both in admin date overrides and the scoresheet:

- `.ap-date-badge` text on the orange accent is ink (`--c-on-accent`) instead of white. White
  on `#FF8000` is 2.9:1, below AA and against the rule in `buttons.css`.
- Cancelled-date text uses `--c-danger-text`: unchanged `#DC2626` in light mode, `#FCA5A5` in
  dark mode, where `#DC2626` on the dark card was below 4.5:1.

## Acceptance criteria

- [x] **AC-1** `grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(' src/styles/*.css` matches only
      `tokens.css` and `print.css`.
- [x] **AC-2** `tokens.test.ts` passes, and fails when either a colour literal is added to a
      component sheet or a token is dropped from one dark block (verified by mutation).
- [x] **AC-3** Visual regression: full-page screenshots of `/`, `/scorecards`, `/rules`,
      `/about`, `/downloads` at 1440 and 390 px, light and dark, plus the admin score-entry
      tab light and dark (22 images), are byte-identical before and after against the
      seeded emulator.
- [x] **AC-4** `npm run typecheck && npm run lint && npm test && npm run build` and
      `scripts/check-csp-hash.js` pass.
