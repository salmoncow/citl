# Component Contract

Every Web Component in this directory follows these five rules. Canon lives in
[.specs/constitution.md](../../.specs/constitution.md) (§ refs below) and
[scripts/forbidden-patterns.json](../../scripts/forbidden-patterns.json) (rule ids below) —
this file states the contract and points there; it does not restate full rules.
Adopted by spec [003-service-decomposition](../../.specs/features/archive/003-service-decomposition/spec.md).

## 1. Shared services via the composition root

Import the shared instances from the composition root:

```ts
import { getServices } from '@/services/app-services';

const { scoreService } = getServices();
```

Never construct `new ScoreService(...)` or `createRepositoryFactory(...)` in a component —
a private instance gets a private 1-hour cache, which is exactly the stale-standings bug
(F-01) the composition root removed. Hook-enforced: ruleset rule
`no-private-service-in-component` (severity: forbid).

Exception that is already correct: admin-tabs receive the service by **constructor
injection** from `admin-panel.ts` — keep that pattern for child widgets.

## 2. innerHTML for static markup only

User- or Firestore-sourced strings go through `textContent` or `escapeHtml()`
(`@/modules/ui`) — never raw `${...}` interpolation into `innerHTML`. Constitution §III.5 /
§IV.2; ruleset rule `innerhtml-interpolation`.

## 3. Teardown in `disconnectedCallback`

Every listener, timer, and subscription registered by the component is removed/cleared in
`disconnectedCallback`. Unsubscribe functions returned by `onSnapshot`/`onRoleChange` are
stored and called (ruleset rule `leaked-onsnapshot`).

## 4. Loading states: skeleton → data → error

Async renders show `.skeleton` shimmer placeholders, then data, with a distinct error state —
no plain "Loading…" text. Constitution §III.3; ruleset rule `loading-text`.

## 5. Re-entrancy guards on async loads

Any `async` load driven by a user-selectable input (year/team dropdowns) carries a
generation counter so a stale response can never render over a newer selection
(F-23 precedent):

```ts
const gen = ++this._loadGen;
const result = await scoreService.get…(…);
if (gen !== this._loadGen) return; // a newer selection superseded this load
```
