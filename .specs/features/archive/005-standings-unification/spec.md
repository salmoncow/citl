# Feature: Standings Unification — One Derivation, Publish Rewrites Week Docs

**Feature ID**: 005-standings-unification
**Created**: 2026-07-13
**Status**: Shipped ([PR #224](https://github.com/salmoncow/citl/pull/224), merged 2026-07-13)
**Source**: Backlog item [FU-01](../../../reviews/2026-07-deep-review/backlog.md) (promotion of the
spec 003 [DD-4](../003-service-decomposition/spec.md) deferral); original incident
context [F-05](../../../reviews/2026-07-deep-review/report.md).

---

## Overview

Season standings currently have **three coexisting derivations** that can disagree on
identical season state:

1. **`computeStandings`** (`src/services/standings.ts`) — sums the engine pass over draft
   *entries*; feeds `season.standings` in the publish path
   (`score-service.ts` `_publishWeekInner`).
2. **`recomputeStandingsFromWeeks`** (`src/services/standings.ts`) — sums stored *week docs*;
   feeds `season.standings` in the `deleteTeam` path.
3. **`home-standings.ts` `_renderTable`** — a client-side cumulative sum over week docs for
   the historical-week view.

This feature collapses them to **one** canonical derivation — sum of stored week docs — and
changes the publish pipeline so the stored week docs are always what that derivation needs
them to be. **This is a storage-model behavior change, not a pure refactor** (spec 003 DD-4
deferred it for exactly that reason): write volume per publish changes, and stale week docs
on the current season are deliberately healed. What is verified *equivalent* is the rendered
output of all read surfaces on already-consistent seasons (all seven archived seasons, and
the current season wherever its stored docs already agree).

### The live divergence path (verified 2026-07-13 — this is not theoretical)

Bonus points depend on going-in averages, which depend on **all earlier weeks' scores**
(see [.specs/domain/scoring-rules.md](../../../domain/scoring-rules.md)). When an admin edits
week 2's entries and republishes week 2 while the season stands at week 5:

- `_publishWeekInner` (post-F-05 fix) correctly recomputes `season.standings` from entries
  through `maxWeek = 5`, **but only rewrites the week-2 week doc**.
- Week docs 3–5 keep their old `bonusPoints` (computed from pre-edit going-in averages) —
  and week 2's own doc-level `rankPoints`/`targets` change without weeks 3–5 knowing.
- Derivations 2 and 3 (sum-of-week-docs) now disagree with derivation 1
  (`season.standings`): the home page's "Week 5" view and "Season" view show different
  totals for the same teams.

Two further divergence paths exist today and are closed by the same design:

- **After `deleteTeam`**: the delete patch preserves remaining teams' stored rank points
  (derivation 2), but the *next* publish recomputes `season.standings` from entries — in
  which the deleted team no longer exists — silently re-ranking history in one stored
  representation but not the other.
- **Publish gaps** (weeks 1, 2, 4 published; 3 not): derivation 1 sums the engine pass over
  *all* entries ≤ maxWeek, including never-published week 3; derivations 2/3 exclude it.

### Current-state notes (verified 2026-07-13, do not re-plan)

- `src/services/standings.ts` is 93 lines, pure, with the DD-4 header note and the import
  rule "only `@/types/*` + `@/services/scoring-engine`".
- `src/services/score-service.ts` is **749 lines** — one under the §II.3 hard cap. The plan
  must not grow it net (see Architecture Approach: the pipeline's pure parts land in
  `standings.ts`).
- `_publishWeekInner` already carries the F-05 (maxWeek), F-08 (`resolveTeamId`), F-09
  (no-throw), and F-51 (name normalization) fixes; all must survive verbatim in behavior.
- Entries for all weeks ≤ maxWeek are **already fetched** in the publish path
  (`repository.getEntries(year, maxWeek)`), so rewriting every published week doc requires
  no new entry reads.
- `removeShooterFromRoster` edits entries + patches week-doc *accolades* only; it does not
  touch `teamResults` or `season.standings` (sums are unchanged, so the invariant holds
  through it without action — but the test suite must assert that).
- Awards (spec 004) consume **published** data only — `season.standings` + week docs via
  `buildScorecardData` — never entries. Archived seasons' awards are already written to
  their season docs and are untouched by this feature.
- `firestore.rules` grants `seasons/{year}/weeks/{weekNumber}` **create + update** to
  owner/admin (no delete). Rewriting docs 1..maxWeek via `batch.set` is permitted under
  current rules with no rules change.

## User Stories

- As a league member, I want the "Season" view and any "Week N" view on the home page to
  always agree, so that standings are trustworthy regardless of which admin corrections
  happened mid-season.
- As the league admin, I want republishing an earlier week after a scoring correction to
  transparently update every downstream week's bonus points and the season standings in one
  action, so a correction never leaves half-stale public data.
- As the maintainer, I want exactly one standings computation in `src/`, so a future scoring
  change cannot silently update one derivation and miss another.

## Acceptance Criteria (non-negotiable, from FU-01)

- [x] **AC-1 (invariant)**: identical season states can never yield disagreeing
      `season.standings` vs. week-doc standings rows. Unit tests assert, after each of
      **publish**, **republish-earlier-week**, **deleteTeam**, and
      **removeShooterFromRoster**: `season.standings` (as written) deep-equals
      `computeStandingsFromWeeks(<week docs as stored after the operation>)`.
- [x] **AC-2 (one derivation)**: the number of standings derivations in `src/` drops from
      three to one. `computeStandings` is deleted; `home-standings.ts` contains no local
      cumulative-summing loop — it imports the one canonical function (importing the single
      canonical function at a second call site still counts as one derivation).
- [x] **AC-3 (F-05 residual closed)**: emulator flow — publish weeks 1–5, edit week 2's
      entries, republish week 2 → week docs 2–5 **and** `season.standings` update
      consistently; the home page's Week 3/4/5 views and Season view agree.
- [x] **AC-4 (behavior-change honesty)**: this spec's Behavior Changes table (DD-3/DD-6) is
      accurate to what ships; read surfaces on already-consistent seasons are verified
      equivalent by dual preview-channel SHA-256 DOM-hash comparison (the PR #203/#204 /
      spec 003 AC-2 technique).
- [x] **AC-5 (size discipline)**: `wc -l src/services/score-service.ts` ≤ 749 (no net
      growth; expected to shrink); no file touched by this feature exceeds 750 lines and no
      **new** file exceeds 500.
- [x] **AC-6 (no new surface)**: no new Cloud Functions, no Firestore schema shape change,
      no rules change, no new indexes.

## Constitutional Constraints

- **§II.3 / §II.4 (layering, composition root)**: dependency direction preserved.
  `standings.ts` stays pure and keeps its import rule (only `@/types/*` +
  `scoring-engine`). `home-standings.ts` importing a pure function from
  `@/services/standings` is a downward `components → services` import (same precedent as
  its existing `compareStandings` import from `scoring-engine`). The composition root
  (`src/services/app-services.ts`) is untouched.
- **§III.3**: no loading-state changes; `home-standings` skeleton behavior is unchanged.
- **§III.4 / §VI.1 (cost)**: quantified in DD-2 — worst case 16 writes + ~17 reads per
  publish against daily ceilings of 20,000 writes / 50,000 reads. No new Cloud Functions →
  the `firebase-deploy-runbook` post-deploy steps are **N/A**.
- **§IV.2 (forbidden patterns)**: the ruleset in
  [`scripts/forbidden-patterns.json`](../../../../scripts/forbidden-patterns.json) is active
  via the PostToolUse hook and CI lint gate — notably the 750-line cap (AC-5) and the
  bounded-`getDocs` rule (the publish path's new week-doc read reuses the existing bounded
  `getAllWeekResults`; no new query shapes).
- **§VIII.1 (version bumps)**: no constitution change is needed — no new standard is
  introduced. The deleteTeam business rule lands in
  [.specs/domain/scoring-rules.md](../../../domain/scoring-rules.md) (living domain reference,
  its designated home).

## Architecture Approach

### Layer assignments

| File | Layer | Action |
|---|---|---|
| `src/services/standings.ts` | services (pure) | `recomputeStandingsFromWeeks` → renamed **`computeStandingsFromWeeks(weekResults, throughWeek?)`** (optional cutoff); new pure **`buildWeekResults(...)`** (per-week `TeamResult[]` construction moved out of `_publishWeekInner`); **`computeStandings` deleted**; header rewritten to describe the unified model (~93 → ~200 lines) |
| `src/services/score-service.ts` | services | `_publishWeekInner` becomes the rewrite pipeline orchestrator (reads existing week docs, calls `buildWeekResults`, derives standings from the docs it is about to write); `deleteTeam` switches to the renamed function; net line count decreases (AC-5) |
| `src/repositories/score-repository.ts` | repositories | `publishWeek` signature generalizes to accept `WeekResult[]` (one atomic batch: N week-doc `set`s + season merge; ≤ 16 ops, far under the 500-op batch limit) |
| `src/components/home-standings.ts` | components | `_renderTable`'s cumulative-sum loop replaced by a call to `computeStandingsFromWeeks(weeks, N)` + a thin join of week-N doc rows for the per-week columns |
| `.specs/domain/scoring-rules.md` | domain docs | New "Team deletion & published history" rule (DD-4) |
| `.specs/technical/firestore-schema.md` | technical docs | "Denormalized standings" and week-doc `publishedAt` wording updated to the rewrite-all model |

### Explicitly out of scope (non-goals)

- No change to the scoring engine's rules or math (`computeSeasonTotals`,
  `computeRankPoints`, bonus rules) — this feature changes *where computed values are
  stored and how aggregates are derived*, not what is computed.
- No schema shape change: week docs and `season.standings` keep their exact stored shapes
  (see DD-6). No migration script.
- No admin-UI redesign; at most an optional confirmation dialog (Open Question 3).
- FU-02 (score-service API splitting) stays separate.

## Design Decisions

### DD-1: The canonical derivation is sum-of-stored-week-docs — `computeStandingsFromWeeks`

**Decision**: adopt the sum-of-stored-week-docs derivation as the single canonical
standings function. `recomputeStandingsFromWeeks` is generalized to
`computeStandingsFromWeeks(weekResults: WeekResult[], throughWeek?: number)` (cutoff
filters `weekNumber <= throughWeek`; omitted = all weeks) and becomes the **only**
standings derivation in `src/`. `computeStandings` (entries-side) is deleted. All three
call sites use it:

- **Publish**: `season.standings = computeStandingsFromWeeks(<the week docs this publish
  writes>, maxWeek)` — the invariant holds *by construction* because the aggregate is
  computed from the exact docs in the same write batch.
- **deleteTeam**: unchanged flow, renamed function — patch week docs, then
  `season.standings = computeStandingsFromWeeks(<remaining docs>)`.
- **Home historical view**: the component imports the same function over the same cached
  week docs (DD-5).

**Rationale**: week docs are the *published record* — the thing the public actually sees
per week — so the season aggregate should be defined as their sum, making
"Season = Σ Weeks" a tautology instead of an invariant to police. The entries-side
derivation can never be canonical for the aggregate because entries are admin-only drafts:
deriving public standings from them is what produces the gap-week and post-delete
divergences today.

**Rejected alternatives**:
- *Entries-derivation canonical* (`computeStandings` stays; week docs follow): still needs
  the week-doc rewrite to keep view 3 consistent, but defines the aggregate off data the
  public can't see, and leaves the deleteTeam path (which has no entries to derive from —
  they're deleted) needing a second derivation anyway. Strictly worse.
- *Keep three derivations, add cross-checking tests*: tests can only sample states; the
  republish scenario above proves the invariant is violable in ordinary admin flows. The
  divergence is structural — testing it is treating the symptom.

### DD-2: Publish rewrites previously published week docs — scope and cost

**Decision**: publishing week *k* writes, in **one atomic batch**:

- the week-*k* doc (created or overwritten), plus
- **every week doc in 1..maxWeek that already exists** (rewritten from the same engine
  pass), plus
- the season doc (`currentWeek: maxWeek`, `standings`, `status`).

Weeks that have entries but were **never published are not auto-published** — gaps stay
gaps. The rewrite set is determined by reading the season's existing week docs (fresh via
`repository.getAllWeekResults`, bypassing the service cache), which also supplies each
rewritten week's original `publishedAt` for preservation (DD-3).

> **Amendment (2026-07-13, during implementation)**: the rewrite set additionally requires
> **ledger coverage** — a stored week doc with **no entries** is a *pre-ledger import* (the
> migrated 2019–2025 seasons are week docs only, and the emulator seed reproduces that
> shape) that the ledger cannot regenerate; rewriting it would wipe it to no-show zeros.
> Such weeks are **preserved verbatim** and summed into `season.standings` alongside the
> rewritten docs, keeping AC-1 as "standings ≡ canonical function over the post-write
> stored state". Implemented as the pure `planPublishRewrite` in `standings.ts`
> (rewrite set = `{k} ∪ {stored weeks ≤ maxWeek with ≥1 entry}`; `preservedWeeks` = the
> rest); pinned by unit tests at both the planner and pipeline levels. The published week
> *k* itself keeps today's semantics (always rebuilt wholly from its entries).

**Write volume (real numbers, vs. §VI.1)**. A week doc is **one document per week**
(`teamResults` is an array inside it), so team count does not multiply writes:

| Scenario | Today | After |
|---|---|---|
| Publish week 1 (first of season) | 2 writes | 2 writes |
| Publish week 8 mid-season | 2 writes | 9 writes (8 week docs + season) |
| Worst case: (re)publish at week 15 | 2 writes | 16 writes |
| Full 15-week season (first publishes only) | 30 writes | ~135 writes |
| Reads added per publish | — | ≤ 15 doc reads (one bounded query) |

Against §VI.1's daily targets (20,000 writes / 50,000 reads), the worst-case publish is
**0.08 % of one day's write budget**; a whole season of publishing plus a dozen
republishes stays under ~350 writes. Cost is a non-issue; the tradeoff is accepted for the
by-construction invariant. Firestore rules already permit it (weeks: create + update for
owner/admin; `batch.set` needs nothing more — no rules change).

**Cache invalidation**: publish now invalidates `weeks:{year}`, `week:{year}:{w}` for
every rewritten week, `latest:{year}`, and `season:{year}` (the loop pattern `deleteTeam`
already uses), instead of the single-week invalidation today.

**Rejected alternatives**:
- *Rewrite only the published week + patch later weeks' `bonusPoints`*: see DD-3's
  rejected carve-out — same write count, more code, partial-consistency semantics.
- *Rewrite all 15 weeks unconditionally*: would auto-publish never-published weeks,
  turning "publish week k" into "publish everything" — surprising and wrong for gaps.

### DD-3: Rewrite content — full engine pass from entries ("entries are the ledger; publish = sync")

**Decision**: every rewritten week doc is regenerated in full from the single
`computeSeasonTotals` engine pass over entries ≤ maxWeek — the same pass, the same
`buildSeasonData`, the same `resolveTeamId` (F-08) and normalization (F-51) as the week
being published. Concretely, per rewritten week *w*:

- `targets` / `rankPoints` / `bonusPoints`: from the engine pass (`totals[w-1]`).
- `shooterScores`: reconstructed from week *w*'s entry + computed extras — the identical
  construction `_publishWeekInner` performs for the published week today, extracted into
  the pure `buildWeekResults` and applied to each week. Entries for all weeks are already
  fetched (`getEntries(year, maxWeek)`), so this costs no new reads.
- `accolades`: **recomputed** (not preserved) via `computeAccolades` over the regenerated
  `shooterScores`. This is deterministic: accolades are per-week straight-25/50 detections
  on that week's `score1`/`score2`/`total` values, so unchanged entries reproduce the
  stored accolades exactly, and changed entries produce the *correct* accolades — which
  preservation would get wrong. `removeShooterFromRoster`'s accolade patches remain
  consistent because that operation edits the entries too.
- `publishedAt`: **preserved** from the stored doc for weeks ≠ k (it records when the week
  was first published, and rewrites are derivations, not publications); week k gets a
  fresh timestamp.

**Mental model this pins**: the `entries` collection is the single editable ledger; week
docs and `season.standings` are derived, published snapshots of it; **publish = "sync all
published weeks to the ledger."** The pipeline is one pure function of
`(entries, teams, rewrite-set, stored publishedAt map)`.

**Behavior changes this introduces (deliberate, documented)**:

| # | Change | Assessment |
|---|---|---|
| 1 | Republishing an earlier week updates all later published weeks' `bonusPoints` (and the edited week's `targets`/`rankPoints`) | The F-05 residual fix — the point of the feature |
| 2 | Saved-but-unpublished edits to an *already-published* week's entries become published on the next publish of **any** week | New visible behavior — but today those edits already leak into `season.standings` (derivation 1 reads all entries ≤ maxWeek) while week docs lag; the ledger model makes an existing half-leak whole and consistent. Flagged as Open Question 4 |
| 3 | After deleteTeam / removeShooterFromRoster, the next publish re-derives prior weeks from the surgically edited ledger | See DD-4 |
| 4 | Gap weeks (entries, never published) no longer contribute rows to `season.standings` | Divergence fix: today they inflate derivation 1 only. Their scores still feed going-in averages (shooting history is real regardless of publication) — unchanged from today's engine input |

**Rejected alternative — the "settled history" carve-out**: rewrite weeks ≠ k updating
`bonusPoints` only, carrying forward stored `targets`/`rankPoints`/`shooterScores`/
`accolades`. It preserves cross-team results as immutable once published and narrows
change #2/#3. Rejected because: (a) it makes week docs a two-source blend (engine +
stored), so the pipeline is no longer a pure function of the ledger and self-healing is
lost; (b) it produces *internally inconsistent* docs after roster surgery —
`shooterScores` retaining a removed shooter while recomputed `bonusPoints` exclude them,
or `targets` disagreeing with the sum of `shooterScores`; (c) draft scores still leak into
the bonus recompute via going-in averages, so it doesn't even fully deliver its promise.
If the maintainer prefers preserved history, the answer is Open Question 3, not this
carve-out.

### DD-4: deleteTeam / removeShooterFromRoster semantics — pin the business rule

**Decision (recommended, pending Open Question 3)**: two-part rule, to be added to
`.specs/domain/scoring-rules.md`:

1. **The delete operation itself preserves history**: `deleteTeam` keeps its current
   semantics — the team's rows are removed from published week docs *without re-ranking*
   the remaining teams (they keep the rank points they earned against the deleted team),
   and `season.standings` becomes the sum of the patched docs (canonical function,
   invariant preserved by construction).
2. **Published weeks are re-derived from the ledger on every publish**: because
   `deleteTeam` also deletes the team's entries, the *next* publish recomputes prior weeks
   as if the deleted team never participated — re-ranking those weeks among the remaining
   teams. Likewise, removing a shooter who shot published weeks flows into recomputed
   `targets`/`rankPoints`/`bonusPoints` at the next publish. **Data surgery rewrites
   published history once the season continues.** These operations exist to fix
   data-entry mistakes; a team that folds or a shooter who leaves should simply stop
   appearing in future entries (forfeit/no-show rules apply), not be deleted.

**Why not preserve rank points forever**: FU-01's framing recommended preservation, and it
*is* preserved at delete time — but preserving it across subsequent publishes under a
single entries-derived pipeline is impossible without the DD-3 carve-out (rejected for the
inconsistencies above) or soft-deleting entries (retaining a deleted team's drafts so the
engine still ranks against a ghost — rejected: it contradicts the deletion, resurrects the
team's rows on rewrite unless further special-cased, and grows schema semantics). Note the
status quo is *worse than either option*: today the next publish already re-ranks
`season.standings` while week docs keep the old numbers — the two stored representations
permanently disagree.

**Optional mitigation** (Open Question 3): a confirmation prompt in the admin UI when
deleting a team that appears in any published week doc ("this team has published results;
history will be recomputed without it on the next publish").

### DD-5: The home historical-week view imports the canonical function — safe by construction

**Decision**: `home-standings.ts` deletes its local cumulative-sum loop. For "Week N" it
calls `computeStandingsFromWeeks(this._allWeekResults, N)` for the cumulative columns
(season-to-date totals, place ordering), then joins week-N's own doc rows by `teamId` for
the per-week columns (`targets`, `rankPoints`, `bonusPoints` of that week — straight off
the stored row, as today). Row set and place numbering keep current behavior (teams
present in week N's doc, ordered by the shared `compareStandings` on cumulative totals —
the same comparator both paths already use, so rendered output is identical on consistent
data).

**Why a client-side call may remain**: it is not a second derivation — it is the same
imported pure function over the same stored docs that produce `season.standings`. For
week N = currentWeek it computes, by construction, exactly the stored
`season.standings`. Layering is clean per §II.3 (component → service pure module,
downward), matching the existing `compareStandings` import precedent. This satisfies
AC-2's "one derivation" criterion as FU-01 explicitly allows.

### DD-6: No schema change, no migration — the current season heals on first publish

**Decision**: the stored shapes of `seasons/{year}`, `seasons/{year}/weeks/{n}`, and
`season.standings` are **unchanged** (see
[firestore-schema.md](../../../technical/firestore-schema.md)); only prose in that doc
changes (the "Denormalized standings" pattern description and a `publishedAt`
preserved-on-rewrite note). No backfill script:

- **Archived seasons (2019–2025)**: complete; never publish again; untouched byte-for-byte.
  Their finalized awards (stored on the season docs, spec 004) are unaffected.
- **Current season**: the **first publish after this ships rewrites its published week
  docs from the ledger** — a deliberate, *visible* data correction. Any week docs carrying
  stale `bonusPoints`/`rankPoints` from past out-of-order republishes get healed to agree
  with `season.standings` and the entries. This is the intended behavior working once,
  retroactively (Open Question 5 confirms acceptability). Before shipping, the
  implementation session should run the publish pipeline against a prod-data snapshot in
  the emulator and report whether any current-season week doc actually changes, so the
  correction is announced, not discovered.

### DD-7: PR slicing — one PR

**Decision**: a single PR (`feat(standings): unify standings derivations; publish rewrites
week docs`). Unlike spec 003 (two independently verifiable refactors), the derivation swap
is not meaningfully splittable: the repository signature change, the service pipeline, the
canonical function, and the component import form one behavioral unit — splitting them
would ship intermediate states with *four* derivations or a dead-code pipeline, and the
verification gate (invariant tests + emulator demos + DOM-hash equivalence) only means
anything over the complete change. The diff is moderate (~5 source files + tests + 2 docs)
and reviewable in one pass. Docs/close-out ride the same PR (spec 003 precedent: docs in
the shipping PR, archive after merge).

## Implementation Plan

Ordered; full task detail with acceptance commands in [tasks.md](./tasks.md).

1. **Pure module** (`standings.ts`): rename + generalize `computeStandingsFromWeeks`
   (optional `throughWeek`); move the per-week `TeamResult[]` construction out of
   `_publishWeekInner` into pure `buildWeekResults`; delete `computeStandings`; rewrite the
   DD-4 header note to describe the unified model. Unit tests, including an equivalence
   test (old `computeStandings` output ≡ `computeStandingsFromWeeks` over docs built by
   `buildWeekResults` from the same engine pass) pinned before deletion.
2. **Repository**: `publishWeek(year, weekResults: WeekResult[], seasonUpdates)` — one
   batch, N `set`s + season merge.
3. **Service pipeline**: `_publishWeekInner` reads existing week docs (fresh), computes the
   rewrite set (existing ∪ {k}), builds all rewritten docs via `buildWeekResults`
   (preserving `publishedAt` for w ≠ k), derives `standings =
   computeStandingsFromWeeks(docsToWrite, maxWeek)`, writes atomically, widens cache
   invalidation. `deleteTeam` switches to the renamed function. Invariant tests for all
   four operations (AC-1).
4. **Component**: `home-standings.ts` swaps its cumulative loop for the imported function +
   join (DD-5).
5. **Verification**: emulator write-path demos (publish, republish-earlier-week,
   deleteTeam) with `.emulator-data` backup/restore; dual preview-channel SHA-256 DOM-hash
   equivalence on read surfaces over already-consistent seasons; full gate.
6. **Docs + close-out**: scoring-rules.md rule (DD-4), firestore-schema.md wording,
   report §0 ledger (FU-01), backlog mark-done, spec archive.

## Task Breakdown

See [tasks.md](./tasks.md) — 6 groups, 21 tasks, each with concrete acceptance commands.

## Testing Checklist

- [x] `npm run typecheck`, `npm test`, `npm run lint` clean. Existing publish-path tests
      updated deliberately (this is a behavior change — the spec 003 "tests unmodified"
      rule does not apply; every modified assertion must trace to a DD).
- [x] `npm run test:rules` + `npm run test:functions` pass (regression tripwire; neither
      is touched). **Note**: `test:rules` conflicts with a running dev emulator on port
      8080 — stop `npm run dev` first.
- [x] AC-1 invariant unit tests: after publish / republish-earlier-week / deleteTeam /
      removeShooterFromRoster, written `season.standings` ≡
      `computeStandingsFromWeeks(written week docs)` (stub repository captures writes).
- [x] Emulator demos (backup `.emulator-data` first, restore after): AC-3 republish flow;
      publish-after-deleteTeam (DD-4 semantics observed and screenshotted for the PR);
      gap-week scenario (unpublished week stays unpublished, standings exclude it).
- [x] `publishedAt` preserved on rewritten weeks; fresh on the published week.
- [x] Accolades on rewritten weeks with unchanged entries are identical pre/post
      (deterministic recompute proof).
- [x] Dual preview-channel SHA-256 DOM-hash equivalence (AC-4) across all archived seasons
      + consistent current-season views: home (Season + each week), scorecards, scoresheet
      generator.
- [x] `wc -l src/services/score-service.ts` ≤ 749; hook + `/check` clean.

## Open Questions for the Maintainer

> **Resolved 2026-07-13 (maintainer)**: all five questions answered with the recommended
> defaults — (1) sum-of-stored-week-docs canonical + ledger pipeline confirmed; (2) ≤16
> writes/publish accepted; (3) two-part data-surgery rule adopted **including** the optional
> admin-UI confirmation when deleting a team with published results (task 3.5 is in scope);
> (4) draft-sync semantics accepted; (5) current-season healing on first publish accepted,
> with the pre-deploy prod-snapshot diff report. Original questions retained below for context.

1. **Canonical derivation & pipeline (DD-1/DD-3)**: confirm sum-of-stored-week-docs as
   canonical, with publish = full re-derivation of all published weeks from entries
   ("entries are the ledger"). **Recommended default: yes** — it is the only option that
   makes the invariant structural rather than policed.
2. **Write volume (DD-2)**: publish grows from 2 writes to ≤ 16 writes + ≤ 15 reads
   (0.08 % of the §VI.1 daily write budget worst-case). **Recommended default: accept.**
3. **Data-surgery history semantics (DD-4)**: confirm the two-part rule — deleteTeam
   preserves rank points *at delete time*, but the next publish re-derives history without
   the deleted team/shooter (they exist to fix mistakes, not to retire real participants).
   Alternative (preserve forever) requires the rejected carve-out or soft-delete.
   **Recommended default: adopt the two-part rule** and pin it in scoring-rules.md; say
   whether you also want the optional admin-UI confirmation on deleting a team with
   published results (cheap, ~10 lines).
4. **Draft-sync semantics (DD-3 change #2)**: publishing any week also publishes
   saved-but-unpublished edits to other already-published weeks. **Recommended default:
   accept** (today those edits already half-leak into `season.standings`; the intended
   admin flow — edit, then republish that week — is unaffected).
5. **Current-season healing (DD-6)**: the first publish after shipping may visibly correct
   stale bonus/rank rows in current-season week docs. **Recommended default: accept** —
   it is the F-05 correction applied retroactively; the implementation session will report
   the actual pre/post diff from a prod-snapshot emulator run before deploy.
