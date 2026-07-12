# Feature: Service Decomposition — Composition Root + score-service Split

**Feature ID**: 003-service-decomposition
**Created**: 2026-07-11
**Status**: Shipped (PR [#214](https://github.com/salmoncow/citl/pull/214) / PR [#215](https://github.com/salmoncow/citl/pull/215), merged 2026-07-12)
**Source**: Promotion of backlog items [WS4-01 + WS4-02](../../../reviews/2026-07-deep-review/backlog.md)
(recommended promotion #1); findings [F-01 (P1) and F-21 (P2)](../../../reviews/2026-07-deep-review/report.md).
Absorbs the WS3-01 derivation-unification follow-up note (deferred — see Design Decision 4).

---

## Overview

Two structural refactors, both strictly behavior-preserving:

**Part A — Composition root (WS4-01 / F-01).** Seven components each construct a private
module-level `RepositoryFactory` + `ScoreService`, giving the app seven independent 1-hour
caches. `publishWeek`'s cache invalidation (`score-service.ts` `_publishWeekInner`, invalidation
block at the end) only ever reaches the admin-panel's instance, so after publishing Tuesday
scores the admin navigates Home and sees *last* week's standings for up to an hour unless they
hard-reload; same for new announcements and banner edits. This part introduces a single
composition root (`src/services/app-services.ts`) so all components share ONE `ScoreService`
and one cache, and writes the component contract down so the pattern cannot silently regress.

**Part B — score-service three-way split (WS4-02 / F-21).** `src/services/score-service.ts`
is 1,093 lines — the only entry in the `grandfathered.file-size` list in
[`scripts/forbidden-patterns.json`](../../../../scripts/forbidden-patterns.json) — because the
class hoards ~325 lines of module-level pure functions and 18 copy-pasted year guards. This
part moves the pure scorecard builders and standings functions into their own modules, dedups
the validation guards, collapses `main.ts`'s six clone `_showX` handlers into a route table,
and removes the grandfather entry.

**Current-state notes (verified 2026-07-11, do not re-plan):**
- `buildPriorAvgMap` has ALREADY moved to `scoring-engine.ts` (WS3-03, landed). Not in scope.
- `publishWeek` already carries the F-05 (max-week), F-08 (`resolveTeamId`), F-09 (no-throw
  try/catch), and F-51 (name normalization) fixes. Pure moves must preserve them verbatim.
- The module-level pure functions to move sit at `score-service.ts:769` (`_buildSeasonData`),
  `:887` (`_buildScorecardTeamBlock`), `:1031` (`_recomputeStandingsFromWeeks`), `:1060`
  (`_computeStandings`). `_slugify` (`:764`) stays — it is a publish-path fallback only.

## User Stories

- As the league admin, I want the Home page to show the week I just published without a
  hard reload, so that I can verify Tuesday-night results immediately after publishing.
- As a league member with a long-lived tab, I want announcements/banner/standings changes to
  appear on next navigation, not up to an hour later.
- As the maintainer (and every agent session), I want `score-service.ts` under the
  constitutional size limit and validation logic defined once, so the project's own guardrail
  stops flagging routine work and a valid-year policy change is a one-line edit.
- As a future contributor, I want a written component contract so new components copy the
  correct pattern instead of whichever generation they open first.

## Acceptance Criteria (non-negotiable)

**Behavior preservation (both parts):**
- [ ] AC-1: All existing unit tests (203+) pass **unmodified except import paths**. Pure
      moves; no logic edits. `npm test`, `npm run typecheck`, and the two emulator suites
      (`test:rules`, `test:functions`) pass before each PR.
- [ ] AC-2: **Prod-vs-preview hash comparison** as the final verification gate: pages rendered
      from a Firebase preview channel are byte-identical to https://citl.club (SHA-256 over
      canonical DOM extractions per tab, across seasons/weeks — the technique used to validate
      PRs #203/#204 in the deep-review session).

**Part A:**
- [ ] AC-3: `grep -rn "new ScoreService" src/` matches only `src/services/app-services.ts`
      (and `*.test.ts` files).
- [ ] AC-4: Emulator flow: publish a week, navigate Home **without reload** → the new week is
      visible immediately (dropdown + standings). Same for a newly created announcement and a
      banner change.
- [ ] AC-5: A written component contract exists in the codebase (see Design Decision 2) and
      the constitution points to it; a machine-enforceable rule preventing private service
      construction in components is added to `scripts/forbidden-patterns.json`.

**Part B:**
- [ ] AC-6: `wc -l src/services/score-service.ts` ≤ 750 (target ≤ 450 — see Open Question 1
      on feasibility); no NEW file exceeds 500 lines.
- [ ] AC-7: `grep -c "year < 2019" src/services/score-service.ts` ≤ 1 (the single
      `assertValidYear` helper); the parallel `weekNumber < 1 || weekNumber > 15` guard (4
      sites) is likewise deduplicated into `assertValidWeek`.
- [ ] AC-8: `src/services/score-service.ts` is removed from `grandfathered.file-size` in
      `scripts/forbidden-patterns.json`; the hook passes on edit without the grandfather.
- [ ] AC-9: `main.ts` registers routes from a data-driven table; the six near-identical
      `_showX` handlers (`main.ts:147-187`) are gone; `/admin`'s extra wiring
      (`_wireAdminAuthButtons` + `_applyAdminViewState`) is preserved via a per-route hook.

**Layering (both parts):**
- [ ] AC-10: Dependency direction preserved: `components → modules → services → repositories`,
      never reverse. New modules declare their import constraints in their header (the
      `scoring-engine.ts` pattern).

## Constitutional Constraints

- **§II.3 Modularity**: 500-line target / 750 hard limit — the entire motivation for Part B;
  every new file must respect the 500 target. Dependency direction rule applies to
  `app-services.ts` (services layer may import repositories + `firebase-config`; components
  import it downward).
- **§II.4 Code Structure**: `app-services.ts`, `scorecard-builder.ts`, `standings.ts` all
  belong in `src/services/` (business logic / wiring); no repository imports a service.
- **§III.3 Loading States**: unchanged — this refactor must not alter any skeleton behavior;
  the component contract restates the requirement by reference.
- **§III.4 Performance**: the 1-hour TTL cache design is unchanged; sharing one instance
  *reduces* duplicate reads (~10–15 per full visit per F-01, immaterial but positive).
- **§III.5 / §IV.2 Code Quality & Forbidden Patterns**: `@/` imports, strict TS, no
  `innerHTML` with unescaped user data; ruleset changes go in
  `scripts/forbidden-patterns.json` (the single source of truth), not doc copies.
- **§VI.1 Cost**: no new Cloud Functions; no new Firebase surface. Cloud Functions
  post-deploy runbook steps: **N/A** (no function added or renamed).
- **§VIII.1**: the constitution pointer to the component contract is a new standard →
  minor version bump (1.5.1 → 1.6.0) with a Version History line.

## Architecture Approach

### Layer assignments

| File | Layer | Action |
|---|---|---|
| `src/services/app-services.ts` | services (composition root) | **New** (~30 lines): lazy `getServices()` — see DD-1 |
| `src/services/scorecard-builder.ts` | services (pure) | **New** (~290 lines): `_buildSeasonData`, `_buildScorecardTeamBlock` moved verbatim, exported |
| `src/services/standings.ts` | services (pure) | **New** (~100 lines): `_computeStandings`, `_recomputeStandingsFromWeeks` moved verbatim, exported — see DD-3 |
| `src/services/score-service.ts` | services | Shrinks to the `ScoreService` class + cache helpers + `_slugify` + `assertValidYear`/`assertValidWeek` |
| `src/components/*.ts` (7 files) | components | Replace private factory+service construction with `getServices()` import |
| `src/components/README.md` | docs-in-code | **New**: the component contract — see DD-2 |
| `src/main.ts` | entry | Route table replaces `_showX` clones |
| `scripts/forbidden-patterns.json` | tooling | Add component-contract rule; remove grandfather entry |
| `.specs/constitution.md` | governance | One-line pointer to the contract in §II.4; version bump |

The seven construction sites to migrate (verified by grep, 2026-07-11):
`home-standings.ts:17-18`, `home-announcements.ts:16-17`, `site-banner.ts:13-14`,
`season-scorecards.ts:16-17`, `season-calendar.ts:24-25`, `scoresheet-generator.ts:17-18`,
`admin-panel.ts:31-32`. Admin-tab constructor injection (`admin-panel.ts` passing its service
into `admin-tabs/`) stays exactly as-is — it is the already-correct pattern.

### Explicitly out of scope (non-goals)

- `modules/auth.ts:48` and `services/admin-user-service.ts:19` also call
  `createRepositoryFactory({ db })`. **Not migrated**: repositories are stateless (only
  `ScoreService` caches), so these duplicates have zero correctness impact. Migrating them is
  optional hygiene for a later sweep (noted as Open Question 3).
- No changes to Firestore schema, rules, indexes, Functions, or any query shape.
- No behavior fixes of any kind — anything found broken during the move is filed, not fixed
  in these PRs (keeps the byte-identical verification gate meaningful).

## Design Decisions

### DD-1: Composition root = `src/services/app-services.ts` with a lazy, memoized `getServices()`

**Decision**: a module exporting `getServices(): AppServices` that builds
`createRepositoryFactory({ db })` + one `ScoreService` on **first call** and returns the same
frozen object thereafter. Shape: `{ repositoryFactory, scoreService }`. No reset API, no
module-level construction.

**Rationale** (vs. `export const scoreService = new ScoreService(...)` at module level):
- **Import-time purity**: importing `app-services` from any component must not construct
  Firestore-backed objects as a side effect of module evaluation. Today `firebase-config.ts`
  creates `db` (and connects emulators) at its own module eval, so eager construction would
  *work* — laziness removes the init-order coupling instead of relying on it.
- **Testability**: unit tests keep constructing `ScoreService` with stub repositories directly
  (all 60+ existing `new ScoreService(...)` test sites stay valid) and never call
  `getServices()`, so Vitest never initializes the Firebase app. No test seam or reset hook is
  needed — which is why the file stays ~30 lines.
- **Laziness semantics**: first caller wins; there is exactly one instance per page lifetime
  (matching the current module-singleton lifetime under the hash router's innerHTML swaps).
  Components call `getServices()` inside `connectedCallback`/methods or capture it at module
  top — both are safe; prefer a module-level `const { scoreService } = getServices()` in each
  component for the smallest diff, which is safe because component modules are imported by
  `main.ts` after `firebase-config` has evaluated.

### DD-2: Component contract lives in `src/components/README.md`; constitution gets a pointer

**Decision**: write the contract as `src/components/README.md`, add a single pointer line in
constitution §II.4, bump the constitution to 1.6.0. Rejected alternative: a full constitution
§III amendment — per
[spec-authoring-guidelines](../../../../.prompts/meta/spec-authoring-guidelines.md), detailed
rules next to the code they govern, referenced (not restated) from the canon; the constitution
stays the index, and agents editing components see the README in-tree.

**The contract mandates** (each item references its canon, no rule restated in full):
1. **Shared services via the composition root** — components import `getServices()` from
   `@/services/app-services`; never `new ScoreService(...)` or `createRepositoryFactory(...)`
   in a component (enforced by the new ruleset rule, see below).
2. **innerHTML only for static markup**; all user/Firestore-sourced strings via `textContent`
   or `escapeHtml()` (§III.5, ruleset `innerhtml-interpolation`).
3. **`disconnectedCallback` teardown** of listeners, timers, and subscriptions.
4. **skeleton → data → error** rendering states per §III.3.
5. **Re-entrancy guards** on async loads (`_loadGen` counter pattern, F-23 precedent already
   present in `home-standings.ts`).

**Machine enforcement**: add rule `no-private-service-in-component` to
`scripts/forbidden-patterns.json` — severity `forbid`, kind `regex`, pattern matching
`new ScoreService(` / `createRepositoryFactory(`, scope `src/components/**/*.ts`,
`enforcedBy: hook`. This makes the contract's item 1 self-enforcing the way `no-var` is.

### DD-3: Pure standings functions go to a NEW `src/services/standings.ts`, not scoring-engine.ts

**Decision**: `_computeStandings` and `_recomputeStandingsFromWeeks` (with their exports
renamed public, underscore dropped) move to a new `src/services/standings.ts`.

**Rationale**:
- **File-size budgets**: `scoring-engine.ts` is 546 lines — already over the 500 warn
  threshold. Absorbing ~70 more lines pushes it toward the pattern this very spec exists to
  end. A new ~100-line module keeps both files green.
- **Distinct responsibility**: scoring-engine owns *per-shooter/per-week scoring rules*
  (averages, bonuses, rank points); standings owns *season aggregation and ranking of already
  computed results*. Different change cadence, different consumers.
- **Future home**: the deferred derivation-unification work (DD-4) needs a single owner
  module; creating `standings.ts` now co-locates both derivations behind one header that
  documents their relationship, making the later unification a one-file change.
- **Purity rule**: `standings.ts` adopts the scoring-engine header convention — may import
  only from `types/` and `scoring-engine` (it needs `compareStandings`). Lateral
  service→service imports of a pure module are within §II.3's dependency direction.

### DD-4: Defer unification of the three standings derivations — with rationale

The three derivations: (a) `publishWeek` recomputes from entries via `_computeStandings`;
(b) `deleteTeam`/`removeShooterFromRoster` re-sum stored week docs via
`_recomputeStandingsFromWeeks`; (c) `home-standings.ts` client-side cumulative sums over week
docs for historical week selection (`home-standings.ts:179-201`).

**Decision: DEFER** true unification (e.g., rewriting all week docs on every publish so one
derivation feeds both stored representations).

**Rationale**:
1. Unification is a **storage-model behavior change** (rewrites of previously published week
   docs, extra Firestore writes per publish). This spec's hard constraint is
   behavior-preserving pure moves verified by byte-identical rendering — the two cannot ship
   in the same change without destroying the verification gate.
2. The disagreement risk that motivated the note is already **substantially closed**: F-05
   (max-week recompute) and F-08 (stable teamId) landed in WS-3, so (a) and (b) now agree on
   inputs; the WS3-13 emulator cascade tests pin (b).
3. This spec performs the **enabling step**: both server-side derivations become neighbors in
   `standings.ts` with a header note documenting the invariant they share and the residual
   risk ("these two must produce identical rows for identical season states").

**Follow-up**: recorded as a candidate backlog item (post-WS-4) — "unify standings derivations
in `standings.ts`; decide whether publish rewrites week docs" — requiring its own spec since
it changes write volume and storage shape.

### DD-5: PR slicing — two PRs, composition root first

**Decision**: **PR-1** = Part A (composition root + component migration + contract + ruleset
rule). **PR-2** = Part B (three-way split + guard dedup + route table + grandfather removal).

**Rationale**: the two parts have different risk profiles and different verification
emphases — PR-1 changes *runtime wiring* (verified chiefly by the emulator staleness flow,
AC-4), PR-2 is *pure moves* (verified chiefly by the unmodified test suite + hash equivalence,
AC-1/AC-2). Landing them separately keeps each diff mechanically reviewable, makes a hash
mismatch attributable to one change class, and lets PR-1's P1 payoff (stale-standings fix)
ship even if PR-2 review stalls. PR-1 has no dependency on PR-2; PR-2 rebases trivially on
PR-1 (component files are touched by both only at import lines).

## Implementation Plan

Ordered steps; full detail with per-task acceptance commands in [tasks.md](./tasks.md).

**PR-1 — `refactor(services): add composition root; share one ScoreService` (branch `refactor/composition-root`):**
1. Create `src/services/app-services.ts` (DD-1).
2. Migrate the seven components to `getServices()`; delete their private factory/service
   module constants. No other component changes.
3. Write `src/components/README.md` (DD-2); add the constitution §II.4 pointer + 1.6.0 bump.
4. Add `no-private-service-in-component` to `scripts/forbidden-patterns.json`.
5. Full gate: typecheck + 3 test suites + emulator staleness flow (AC-4) + preview-channel
   hash comparison (AC-2). Open PR-1.

**PR-2 — `refactor(services): split score-service; dedup guards; route table` (branch `refactor/score-service-split`, after PR-1 merges):**
6. Move `_buildSeasonData` + `_buildScorecardTeamBlock` verbatim to
   `src/services/scorecard-builder.ts`; export; update `score-service.ts` imports.
7. Move `_computeStandings` + `_recomputeStandingsFromWeeks` verbatim to
   `src/services/standings.ts` with the DD-4 header note; update imports.
8. Add `assertValidYear`/`assertValidWeek` (return a failure `Result` or `null` — never
   throw, preserving the class's no-throw contract) and replace all 18 + 4 guard sites.
9. Collapse `main.ts` `_showX` handlers into a route table with an optional per-route
   `after` hook for `/admin` (AC-9).
10. Remove the `grandfathered.file-size` entry; verify hook passes and line counts (AC-6–8).
11. Full gate: typecheck + 3 test suites + emulator smoke + preview-channel hash comparison.
    Open PR-2.

## Task Breakdown

See [tasks.md](./tasks.md) — 6 groups mapping to reviewable commits across the two PRs, each
task with concrete acceptance commands.

## Testing Checklist

- [ ] `npm run typecheck` clean (both PRs)
- [ ] `npm test` — all 203+ unit tests pass **unmodified except import paths**
- [ ] `npm run test:rules` and `npm run test:functions` (emulator suites) pass — no rules or
      functions are touched, this is a regression tripwire only
- [ ] Emulator (PR-1): publish week N+1 → navigate Home (no reload) → week N+1 in dropdown and
      standings; create announcement → Home shows it; set banner → banner renders
- [ ] Emulator (PR-2): publish, delete a team, scorecards page, scoresheet generator, calendar
      — spot-check identical rendering pre/post split
- [ ] Skeleton loading states unchanged on Home/Scorecards (visual)
- [ ] `/deploy-preview` + prod-vs-preview SHA-256 DOM equivalence across seasons/weeks (AC-2);
      note the same-URL-navigate-≠-reload gotcha when driving the browser
- [ ] Hook check: edit `score-service.ts` post-split → no size warning; add a
      `new ScoreService(...)` line to a component → hook **blocks**

## Open Questions for the Maintainer

> **Resolved 2026-07-11 (maintainer):** (1) accept ~700–725 lines — file a follow-up backlog
> item for a separate API-splitting spec rather than extend PR-2's scope; (2) constitution
> bump to 1.6.0 confirmed; (3) leave the two non-component `createRepositoryFactory` sites
> as-is. Original questions retained below for context.

1. **The ≤450-line target for `score-service.ts` is likely unreachable via pure moves.**
   Moving the ~325 helper lines and deduplicating guards lands the file at an estimated
   ~700–725 lines (the class itself grew during WS-3 hardening; it spans `:47-758` today).
   That satisfies the 750 hard cap (AC-6) and de-grandfathers the file, but it remains in
   warn territory (>500). Reaching ~450 would require extracting I/O-bearing service methods
   (e.g., announcements/banner into an `announcement-service.ts`, roster-defaults
   orchestration), which changes the class's public API surface used by components — beyond
   "pure moves". **Proposal**: accept ~700–725 + warn in PR-2, and decide separately whether
   a follow-up API-splitting spec is wanted. Confirm or redirect.
2. Constitution bump to **1.6.0** for the §II.4 contract pointer (new standard per §VIII.1) —
   confirm.
3. Migrate the two out-of-scope `createRepositoryFactory` call sites (`modules/auth.ts`,
   `services/admin-user-service.ts`) to the shared factory in PR-1 as optional hygiene, or
   leave for a later sweep? Default per this spec: **leave** (stateless, zero correctness
   impact, smaller diff).
