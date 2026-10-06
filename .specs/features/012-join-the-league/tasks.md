# Task Breakdown: Join the League

**Feature**: 012-join-the-league
**Spec**: [spec.md](./spec.md)
**Status**: Groups 0–3 done (2026-10-06)

**Complexity legend**: S = <30min · M = 30min–2h · L = >2h

## Group 0 — Spec
- [x] **0.1 (S)** `spec.md`, `tasks.md`.

## Group 1 — Join intent and gate
**AC**: AC-4, AC-5
- [x] **1.1 (S)** `src/utils/join-intent.ts` (mark / isFresh / clear) with unit tests.
- [x] **1.2 (S)** `/join` in `GATE_ALLOWED_PATHS`; boot URL rewrite to `/#/join` for a fresh intent.

## Group 2 — Join page and entry points
**AC**: AC-1, AC-2, AC-3, AC-6, AC-7, AC-8
- [x] **2.1 (M)** `src/views/join.ts` shell + lazy `src/components/join-page.ts`.
- [x] **2.2 (S)** Nav CTA label/href by flag and sign-in state; hero href; About copy.
- [x] **2.3 (S)** Shared status labels moved to `src/components/league-labels.ts`.

## Group 3 — Coordinator marker
**AC**: AC-9
- [x] **3.1 (S)** `RegistrationItem.pendingLinkName` in `league-review-service.ts` + test.
- [x] **3.2 (S)** Warning line on the registration card.
