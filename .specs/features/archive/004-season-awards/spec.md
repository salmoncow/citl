# Feature: Season Awards — Finish the Pipeline and Display Trophies

**Feature ID**: 004-season-awards
**Created**: 2026-07-12
**Status**: Shipped (PR [#220](https://github.com/salmoncow/citl/pull/220), merged 2026-07-13)
**Source**: Maintainer decision (Tyler, 2026-07-12) recorded in
[backlog WS5-02](../../../reviews/2026-07-deep-review/backlog.md) — promotion of finding
[F-26 (P2)](../../../reviews/2026-07-deep-review/report.md) to a full feature.
**Authoritative business rules**: [scoring-engine.md §"Season Awards"](../../scoring-engine.md)
— Highest Average, Rookie of the Year, Most Improved; min 6 weeks shot; dummies excluded.
**Those rules are NOT restated here** — the engine already implements them correctly per its
tests; this spec finishes the placements, the shape, the guard, the trigger, and the display.

---

## Overview

The season-awards pipeline in `src/services/scoring-engine.ts` is half-built dead code
(F-26): `computeSeasonAwards` implements the three shooter awards correctly but hardcodes all
four team-placement fields to `null` in both return branches, nothing in the app calls it,
nothing writes `Season.awards`, its return type (`ComputedAwards`) differs from the
Firestore-stored `SeasonAwards` documented in `src/types/season.ts`, and its helper
`computeMostImprovedScore` divides by zero at `startingAvg = 50`.

The 2026 season is at week 12 of 15 and ends soon — trophies must be calculable. This feature:

1. Computes team placements (first/second place + points) from final season standings.
2. Reconciles the awards type to ONE canonical shape — the flat shape all seven historical
   prod documents already use (DD-1).
3. Guards the `startingAvg ≥ 50` divide-by-zero (DD-4).
4. Adds an admin-triggered season-end flow: preview awards, then finalize — writing `awards`
   and `status: 'complete'` to `seasons/{year}` (DD-3). Awards are computed from **published
   week documents** — the same public data the scorecards page renders — never from draft
   entries.
5. Displays awards on the home page for the selected season, including historical years (DD-2).
6. Closes the backfill question: **no backfill is needed** (DD-5) and corrects the emulator
   seed fixtures to the canonical shape (DD-6).

No Firestore rules change, no schema migration, no Cloud Functions.

## Verified Production Evidence (2026-07-12)

Read-only firebase-admin inspection of prod `citl-baed2` (gcloud ADC), 2026-07-12:

- `seasons/{2019..2025}` — all seven have `status: "complete"` AND a populated `awards`
  field in the **flat legacy shape** (migrated from the legacy AWS site):
  `{ firstPlaceTeam: string, firstPlacePoints: number, secondPlaceTeam: string,
  secondPlacePoints: number, highestAvgShooter: string, highestAvg: number,
  rookieOfYear: string, rookieAvg: number, mostImproved: string, improvement: string }`.
  Example (2025): firstPlaceTeam "Sights Impaired" 433 pts; secondPlaceTeam
  "Full Choke Artists" 415; highestAvgShooter "Randy Jones" 44.428…; rookieOfYear
  "Micheal Benjamin" 43.285…; mostImproved "Micheal Benjamin", improvement "55.24%".
- `improvement` is a **formatted percent string** (e.g. "66.15%"); `rookieOfYear` /
  `mostImproved` are plain name strings; there is **no team attribution** for shooter awards.
- `seasons/2026` — `status: "active"`, `currentWeek: 12`, `awards` entirely **absent**,
  12 week docs.
- **Consequence**: the nested `SeasonAwards` shape in `src/types/season.ts` (and in the
  emulator seed fixtures) exists **nowhere in prod**. Prod matches `ComputedAwards`
  (minus its nulls). Only 2026 ever needs computing; historical backfill is a non-issue.

## User Stories

- As a league member, I want to see the season trophies (team placements, Highest Average,
  Rookie of the Year, Most Improved) on the site when a season ends, so the winners are
  published the same place standings are.
- As a league member, I want to select a previous year and see that year's awards, so the
  seven seasons of league history stay browsable.
- As the league admin, I want a season-end action that computes the awards from published
  results, shows me a preview, and writes them once I confirm — so trophies come from the
  engine, not hand calculation.
- As the league admin, I want a re-runnable finalize action, so a scoring correction
  (republish) can't strand stale awards.
- As the maintainer, I want ONE awards type that matches what prod actually stores, and
  award numbers that agree with the scorecards page everyone can see, so no future agent
  wires up the shape mismatch (or the draft-data mismatch) F-26 warned about.

## Acceptance Criteria

- [ ] **AC-1**: `computeSeasonAwards` returns a complete flat `SeasonAwards` including
      `firstPlaceTeam`/`firstPlacePoints`/`secondPlaceTeam`/`secondPlacePoints` derived from
      the passed final standings (rank 1 and rank 2 rows; points =
      `totalRankPoints + totalBonusPoints`). Both return branches fill placements — a season
      with standings but zero award-eligible shooters still gets placements. Unit tests cover
      2-team, 1-team, and 0-team standings.
- [ ] **AC-2**: `computeMostImprovedScore(50, x)` and any `startingAvg > 50` return `0` —
      no `Infinity`/`NaN` is reachable in the awards path (unit tests pin the edge).
- [ ] **AC-3**: Exactly one awards type exists: `SeasonAwards` in `src/types/season.ts` with
      the flat prod field set (all fields nullable). `grep -rn "ComputedAwards" src/ scripts/`
      returns nothing; the nested shape is deleted. `npm run typecheck` passes.
- [ ] **AC-4**: In the admin panel, an admin can preview awards for the selected year and then
      finalize: `seasons/{year}` gains `awards` (canonical shape) and `status: 'complete'`.
      Re-running preview + finalize overwrites cleanly (idempotent). Preview/finalize read
      **only published data** (season doc, team docs, published week docs) — never the
      `entries` draft audit trail.
- [ ] **AC-5**: The home page shows an awards section for the selected season when
      `season.awards` is non-null — including all seven historical years — and renders **no
      awards section** (not an empty shell, not placeholder text) when `awards` is null/absent
      or the season is active. Every rendered string passes through `escapeHtml()`; every
      field is null-guarded (repository reads are unvalidated casts, F-09).
- [ ] **AC-6**: The home page issues **zero additional Firestore reads** for awards — they
      ride the season document `home-standings` already loads.
- [ ] **AC-7**: No changes to `firestore.rules` (`seasons/{year}` update is already
      admin-only); the existing rules suite passes unmodified.
- [ ] **AC-8**: Emulator seed fixtures emit the canonical flat shape; seeded 2025 has a full
      awards object (including a non-null `mostImproved`) so the UI is verifiable via
      `npm run dev:seeded`; the E2E steps in tasks.md Group 6 pass — including re-finalizing
      seeded 2025 (15 published weeks, real shooter awards) and finalizing seeded 2024
      (5 published weeks → warning + zero-eligible branch with placements).
- [ ] **AC-9**: File-size budgets hold: `score-service.ts` stays at ≤ 750 (it is at 749 —
      this feature adds **nothing** to it); every new file ≤ 500 lines; no touched file
      crosses 750.
- [ ] **AC-10**: `npm run typecheck`, `npm test`, `npm run test:rules`, and
      `npm run test:functions` pass; docs and the review ledger are updated (tasks Group 7).

## Constitutional Constraints

- **§I.1 Progressive Complexity**: no new platform, no Cloud Function, no schema migration.
  The one structural addition (a small dedicated service, DD-3) is forced by the 750-line
  hook limit on `score-service.ts`, following the spec-003 split precedent.
- **§II.3 / §II.4 Layering**: engine stays pure (compute in `scoring-engine.ts`, I/O in the
  service/repository); new service lives in `src/services/`; components reach it only via
  the composition root `getServices()` (constitution §II.4 → `src/components/README.md`
  contract, hook rule `no-private-service-in-component`).
- **§III.2 Security**: the finalize write is enforced by the existing
  `seasons/{year}` admin-only rule in [`firestore.rules`](../../../../firestore.rules) — not by
  client-side checks; existing rules tests (`tests/rules/`) already pin this authz. The
  awards computation itself depends only on **publicly readable** collections (seasons,
  teams, weeks) — no admin-only `entries` reads.
- **§III.3 Loading States**: the home-page awards render inside the existing
  `home-standings` skeleton→data→error flow — no new async component, no new loading text.
- **§III.4 / §VI.1 Cost**: zero added public-page reads (AC-6). Finalize is a once-a-year
  admin action whose reads go through the shared cached `ScoreService`
  (`buildScorecardData`: teams + published weeks for the year and its two prior years —
  well under 100 document reads). No new Cloud Function → the `firebase-deploy-runbook`
  post-deploy steps are **N/A**.
- **§III.5 / §IV.2 Code Quality & Forbidden Patterns**: strict TS, `@/` imports,
  `escapeHtml()` for all Firestore-sourced strings, no God modules; the machine ruleset in
  [`scripts/forbidden-patterns.json`](../../../../scripts/forbidden-patterns.json) is unchanged
  and must pass on every edit.

## Design Decisions

### DD-1: The canonical `SeasonAwards` type is the FLAT prod shape

**Decision**: Redefine `SeasonAwards` in `src/types/season.ts` as the flat field set prod
already stores (identical to today's `ComputedAwards`, all ten fields nullable). Delete the
nested `SeasonAwards` and the `ComputedAwards` name entirely. `improvement` remains a
formatted percent string (e.g. `"55.24%"`) and `highestAvg`/`rookieAvg` remain raw floats —
exactly what the seven prod docs contain; formatting/rounding is a display concern (DD-2).

**Rationale**: seven seasons of prod data already use the flat shape (verified 2026-07-12);
adopting it means **zero prod migration** and historical display works on day one. The engine
already returns this shape, so the "reconciliation" is a type rename plus deletions.

**Rejected — migrate prod to the nested shape**: would require a one-off admin script
touching seven production documents; would have to invent per-award `teamName` attribution
that the legacy data never captured (it does not exist and cannot be recovered for
2019–2024 without archaeology); and buys nothing — no UI requirement needs team attribution
on shooter awards. Rejected on §I.1 grounds.

**Known quirk, accepted**: `improvement` as a pre-formatted string is a modeling smell
(display data at rest), but changing it to a number means migrating seven prod docs for zero
functional gain. Documented here so nobody "fixes" it casually.

### DD-2: Display surface = `home-standings`, "Season" view; no-data = render nothing

> **Refinement (Tyler, 2026-07-12, pre-merge)**: the awards render as a design-system
> table (`.awards-table`, mirroring `.standing-table`: Award | Winner | Result) with
> plain-emoji trophy icons (🏆 🥈 🎯 ⭐ 📈 — no custom assets, consistent with ADR-008),
> replacing the initially shipped badge list. Row-omission and null-guard semantics
> below are unchanged.

**Decision**: Render the awards inside `src/components/home-standings.ts`, in `_renderTable`,
**only when the week selector is `"Season"`** and `this._season.awards != null` — a
"Season Awards" section above the standings table, structurally parallel to the existing
weekly-accolades section (`_renderAccolades`). Rows: First Place (team — points), Second
Place (team — points), Highest Average (name — avg, `toFixed(2)`), Rookie of the Year
(name — avg, `toFixed(2)`; row omitted when null), Most Improved (name — improvement string;
row omitted when null). Individual null fields are skipped, whole section omitted if every
field is null. **No-data behavior**: active seasons (2026 until finalized) and any season
without `awards` show no awards section at all — the standings view is unchanged.

**Rationale**: `home-standings` already owns the year selector and already loads the season
document via `getSeason` — awards ride along with **zero extra Firestore reads** (AC-6), and
the complete-season default view is already "Season", so historical years show awards
immediately on selection. The component is 310 lines; ~+80 keeps it under the 500 target.
The existing skeleton covers the load (§III.3) since awards render in the same
`#hs-table` innerHTML pass — no new async state exists.

**Rejected — a separate `<season-awards>` component**: it would either duplicate the season
fetch or need cross-component year-selection eventing; neither is justified for one section
(§I.1). **Rejected — Scorecards page**: awards are league-level results; the home page is
where league-level results (standings, accolades) live; scorecards are per-team detail.

### DD-3: Season-end trigger = admin "Season End" tab, two-phase (preview → finalize), via a new small service computing from PUBLISHED data

**Decision**: a new admin tab **"Season End"** (`src/components/admin-tabs/season-end-tab.ts`,
implementing the existing `AdminTab` lifecycle from `admin-tabs/types.ts`), registered in
`admin-panel.ts` after "Announcements". Flow:

1. **Preview** — button "Compute awards preview" calls
   `seasonAwardsService.previewAwards(year)` (read-only), renders the ten award fields in a
   read-only table via `textContent`/`escapeHtml`, and enables step 2. If
   `season.currentWeek < 15`, show a non-blocking warning ("only N of 15 weeks published")
   — the league can legitimately end short (weekDateOverrides supports cancelled weeks), so
   warn, never hard-block.
2. **Finalize** — `btn-danger` button "Finalize season" (enabled only after a successful
   preview for the currently selected year; disabled again on year change), guarded by a
   confirm dialog, calls `seasonAwardsService.finalizeSeason(year)`, then
   `ctx.refreshSeason()` and a success toast.

**Semantics**: idempotent and re-runnable — finalize always recomputes from current published
data and overwrites `awards` + `status: 'complete'`. This is deliberate: republishing a
corrected week resets `status` to `'active'` (the repository `publishWeek` always writes
`status: 'active'`) and leaves the previously written awards stale — the admin's recovery is
simply to re-run finalize. The tab surfaces this by showing the season's current status and
whether awards exist.

**Data source — published week documents, NOT draft entries.** The `entries/{week}_{teamId}`
docs are the raw pre-publish audit trail (see the `SeasonEntry` doc comment in
`src/types/score.ts`) and are admin-only readable; they may contain never-published edits,
and complete seasons may have **no** entry docs at all (seeded 2025 has zero; prod entry
coverage across 2026 weeks 1–12 is unverified). Awards must come from the same published
truth as everything else the public sees:

- **Placements** = the stored `season.standings` (the published, F-05-protected rows the
  public watched all season), NOT a fresh recompute — awards match the displayed final
  standings by construction.
- **Shooter awards** = per-shooter season lines assembled from `getTeams(year)` +
  `getAllWeekResults(year)` (+ the two prior years for rookie/W0 derivation) — exactly the
  path the public scorecards page already uses:
  `ScoreService.buildScorecardData(year)` → `buildScorecardTeamBlock(...)`, which produces
  per shooter: name, rookie, isDummy, W0/starting average, `scores[15]`, weeksShot. Note:
  rookie flags and starting averages are **derived from prior-year published data**
  (`isShooterRookie`, prior-avg maps, `computeShooterStartingAvg`) — roster docs are not the
  derivation source anywhere in the live paths — and `buildScorecardData` already handles
  that derivation plus the roster-removed-shooter rules.

**Consistency property (explicit rationale)**: because awards consume the *same* derivation
as the scorecards page, the trophies are guaranteed to agree with the scorecard lines every
member can inspect — a Highest Average award is always verifiable against the displayed
scorecard. Computing from drafts (or from a parallel roster-based derivation) could produce
trophies that contradict the public record.

**New service** — `src/services/season-awards-service.ts` (`SeasonAwardsService`, target
≤ 150 lines), because `score-service.ts` sits at 749/750 lines and must not grow (AC-9);
precedent: spec-003 decomposition. Constructed **only** in the composition root
(`src/services/app-services.ts`, added to `AppServices`); tests construct it directly with
stubs and never import `app-services`.

- `constructor(repository: ScoreRepository, scoreService: ScoreService)` — reads go through
  the shared `ScoreService` (cached, `Result`-typed: `getSeason`, `buildScorecardData`);
  the write uses `repository.updateSeason(year, { awards, status: 'complete' })` (already
  exists); after a successful write it calls `scoreService.clearCache()` so the home page and
  admin panel see the finalized season immediately. `clearCache()` is deliberately blunt —
  data volumes are tiny and it guarantees both `season:{year}` and `seasons:all` are fresh.
- `previewAwards(year): Promise<Result<SeasonAwards>>` — fail (`NO_DATA`) when the season
  doc is missing or `currentWeek < 1`; otherwise `scoreService.buildScorecardData(year)` →
  `toAwardShooterInputs(viewData.teams)` (pure adapter, below) →
  `computeSeasonAwards(inputs, season.standings ?? [])`. Every failed `Result` propagates
  unchanged (no throws — F-09 convention).
- `finalizeSeason(year): Promise<Result<SeasonAwards>>` — `previewAwards` + write +
  invalidate.

**Engine change**: `computeSeasonAwards(shooters: AwardShooterInput[], finalStandings:
SeasonStandings[]): SeasonAwards`, where `AwardShooterInput = { name, teamName, isDummy,
rookie, startingAvg, scores }` (declared in `src/types/season.ts`). The engine remains the
single authority for eligibility and averages: it still excludes dummies, still derives
`weeksShot` from `scores`, still applies `MIN_WEEKS = 6`, and still computes `finalAvg` at
full precision via `computeShooterAverage(startingAvg, scores, 14)` — the adapter passes raw
facts, never conclusions (the scorecard row's display-rounded `finalAvg`/`weeksShot` fields
are ignored; prod awards store full-precision averages, e.g. 44.428…, while the scorecard
displays 1-decimal rounding). Placements come from the rank-1/rank-2 standings rows
(points = `totalRankPoints + totalBonusPoints`), nulls when fewer than 2/1 teams exist,
filled in **both** return branches.

**Adapter** — `toAwardShooterInputs(blocks: ScorecardTeamBlock[]): AwardShooterInput[]`,
a pure exported function in `src/services/scorecard-builder.ts` (it owns the block shape;
its types-only import rule holds). Mapping per `ScorecardRowShooter`:
`w0Display: number | '-'` → `startingAvg`; rows whose `w0Display` is not numeric are
**skipped** — those are only dummy/padding rows (real rostered shooters always receive a
numeric derived W0), and the engine would exclude them via `isDummy` anyway; `isDummy` is
still passed through so the engine remains the exclusion authority for numeric-W0 dummies.
Unit-tested directly.

The [scoring-engine.md](../../scoring-engine.md) §"Outputs — computeSeasonAwards" paragraph
(which currently documents the null placements) is updated to the new flat-input signature;
the §"Season Awards" rules section is untouched.

**Rejected — computing shooter awards from `getEntries` + `buildSeasonData`** (the publish
path's assembly): entries are draft audit data — using them would contradict the F-05
argument this spec makes for placements, would break on complete seasons that have no entry
docs (seeded 2025 has none; prod coverage is unguaranteed), and would add an admin-only read
dependency to a computation over public results. **Rejected — extending the Score Entry
tab**: `score-entry-tab.ts` is 593 lines; adding preview UI pushes it toward the hard limit,
and season lifecycle is a distinct responsibility the `AdminTab` seam exists for.
**Rejected — a Cloud Function / scheduled trigger**: the client SDK + existing admin rules
fully cover this write (§VI.1 requires functions to solve problems they cannot); a
once-a-year human action needs human judgment (short seasons, corrections), not a scheduler.

### DD-4: Divide-by-zero guard — `startingAvg ≥ 50` → improvement score `0`

**Decision**: `computeMostImprovedScore` returns `0` whenever `startingAvg >= 50`.

**Rationale**: the formula `100 × (finalAvg − startingAvg) / (50 − startingAvg)` measures the
fraction of *possible* improvement achieved; a shooter starting at the 50 cap has no possible
improvement, so 0 is the semantically honest score (not an award-winning one — any genuinely
improved shooter scores > 0 and beats them; decliners score < 0 and lose to them, which is
correct). `startingAvg > 50` is impossible under the scoring rules (scores cap at 50) but is
guarded identically rather than letting a bad historical import produce a sign-flipped
denominator. Rejected: returning `-Infinity`/`null`/skipping the shooter — all three
complicate the reducer and the type for an edge whose correct value is simply "no
improvement possible".

### DD-5: Historical backfill — CLOSED, not needed

All seven historical seasons (2019–2025) already carry complete awards in the canonical flat
shape (verified in prod 2026-07-12 — see Evidence above). Only 2026 will ever be finalized
by the new flow. No backfill script, no migration, nothing to schedule. The WS5-02 backlog
question "subject to what historical award data exists" is answered: it all exists.

### DD-6: Seed fixtures corrected to the canonical shape

`scripts/fixtures/seed-data.js` `buildAwards` currently emits the nested shape (which exists
nowhere in prod) with `mostImproved: null`. It is rewritten to emit the flat canonical shape
with **all ten fields populated** for the seeded complete season (2025): placements derived
from the fixture standings (mirroring `totalRankPoints + totalBonusPoints` of ranks 1–2) and
a computed most-improved (same formula, same `"NN.NN%"` string format, same ≥ 50 guard). The
seeded active season (2024) keeps no `awards` field — that is the no-data display case. The
fixture stays plain JS mirroring the shape; it must not import the TS engine.

## Architecture Approach

Dependency direction throughout: `components → modules → services → repositories` (never
reverse); engine, `scorecard-builder`, and the adapter remain pure.

| File | Layer | Action |
|---|---|---|
| `src/types/season.ts` | types | **Modify**: flat `SeasonAwards` (DD-1); new `AwardShooterInput` (DD-3); delete nested shape + `ComputedAwards`; update the stale mismatch comments |
| `src/services/scoring-engine.ts` | services (pure) | **Modify**: `computeMostImprovedScore` guard (DD-4); `computeSeasonAwards(shooters, finalStandings)` — flat-input signature, placements filled in both branches (DD-3); imports `SeasonStandings`/`AwardShooterInput` as types only |
| `src/services/scoring-engine.test.ts` | tests | **Modify**: signature updates; new placement + ≥ 50 edge cases |
| `src/services/scorecard-builder.ts` | services (pure) | **Modify** (~+30 lines): exported pure `toAwardShooterInputs(blocks)` adapter (DD-3) |
| adapter tests (in the file that already tests `buildScorecardTeamBlock`, else a new `scorecard-builder.test.ts`) | tests | **Modify/New**: adapter mapping tests incl. `'-'`-W0 row skipping |
| `src/services/season-awards-service.ts` | services | **New** (≤ 150 lines): `SeasonAwardsService` — `previewAwards`, `finalizeSeason`, reads via `buildScorecardData` (DD-3) |
| `src/services/season-awards-service.test.ts` | tests | **New**: stub-repository tests (never imports `app-services`) |
| `src/services/app-services.ts` | services (composition root) | **Modify**: `AppServices` gains `seasonAwardsService` |
| `src/components/admin-tabs/season-end-tab.ts` | components | **New** (≤ 250 lines): `SeasonEndTab implements AdminTab` (DD-3) |
| `src/components/admin-panel.ts` | components | **Modify** (~+15 lines): register tab button/panel/lifecycle |
| `src/components/home-standings.ts` | components | **Modify** (~+80 lines): `_renderAwards` in the Season view (DD-2) |
| `src/styles/` (standings/home partial) | styles | **Modify**: `awards-section` styling (reuse `accolades-*` patterns/tokens where possible) |
| `scripts/fixtures/seed-data.js` | tooling | **Modify**: flat `buildAwards` (DD-6) |
| `.specs/technical/firestore-schema.md` | docs | **Modify**: `awards` field note (flat shape, verified 2026-07-12); drop `ComputedAwards` from the interfaces list |
| `.specs/features/scoring-engine.md` | docs | **Modify**: §"Outputs — computeSeasonAwards" only (new flat-input signature/complete output); rules sections untouched |
| `.specs/reviews/2026-07-deep-review/report.md` + `backlog.md` | docs | **Modify**: §0 remediation ledger row for F-26; WS5-02 marked done (final task) |

**Explicitly unchanged**: `firestore.rules` (+ indexes), `score-service.ts`,
`score-repository.ts` (`updateSeason` already exists), the `entries` collection and every
read path over it, Cloud Functions, `score-entry-tab.ts`.

## Implementation Plan

Ordered task groups with acceptance criteria and validation gates live in
[tasks.md](./tasks.md). Summary: (1) types + engine + guard + adapter with tests → (2)
`SeasonAwardsService` + composition-root wiring with tests → (3) Season End admin tab →
(4) home-page awards display → (5) seed-fixture correction → (6) emulator E2E verification →
(7) docs + review-ledger close-out. Single PR, one commit per group.

## Testing Checklist

- [ ] Engine: placements derived from 2-team/1-team/0-team standings; both return branches
      (eligible and empty-eligible) carry placements; points equal
      `totalRankPoints + totalBonusPoints` of ranks 1–2
- [ ] Engine: `computeMostImprovedScore(50, 45) === 0`, `(55, 40) === 0`; existing
      improvement cases unchanged; awards path never yields non-finite numbers
- [ ] Engine: existing shooter-award rules tests (min 6 weeks, dummy exclusion, rookie
      subset) still pass under the flat-input signature; award `finalAvg` is full-precision
      (not the scorecard's 1-decimal display rounding)
- [ ] Adapter: `toAwardShooterInputs` maps `ScorecardRowShooter` → `AwardShooterInput`
      (`w0Display` → `startingAvg`); skips non-numeric-W0 rows; passes `isDummy` through
- [ ] Service: `previewAwards` happy path over a stub repository serving teams + published
      weeks (prior years included so the real `buildScorecardData` exercises rookie/W0
      derivation over the stubs); `NO_DATA` on missing season / zero published weeks;
      failure propagation from `buildScorecardData`; **no `getEntries` call anywhere in the
      awards path**; `finalizeSeason` writes `{ awards, status: 'complete' }` via
      `updateSeason` and calls `clearCache()`; `app-services` never imported in tests
- [ ] Consistency property: for a fixture season, award winners agree with the scorecard
      rows `buildScorecardData` produces from the same stubs (same derivation; full
      precision vs. display rounding aside)
- [ ] Rules: existing suite passes unmodified (no rules change — AC-7)
- [ ] Emulator E2E (tasks.md Group 6): seeded 2025 shows awards on Home; 2024 shows none;
      re-finalizing 2025 (15 published weeks) computes real shooter awards; finalizing 2024
      (5 weeks) exercises the <15 warning + zero-eligible branch with placements; Home
      updates without a hard reload; re-finalize is idempotent
- [ ] Post-deploy prod spot-check: select 2025 on citl.club → awards match the prod doc
      (Sights Impaired 433 / Full Choke Artists 415 / Randy Jones 44.43 / Micheal Benjamin
      43.29 / Micheal Benjamin "55.24%")
- [ ] `npm run typecheck` + all three suites green; `/check` passes; no file > 750 lines

## Open Questions — RESOLVED (maintainer review, Tyler, 2026-07-12)

1. **Finalize confirmation strength** — **standard confirm dialog.** No type-the-year gate;
   finalize is non-destructive and re-runnable.
2. **"Reopen season" action** — **out of scope, confirmed.** Republishing any week already
   flips `status` back to `'active'` (existing behavior), and re-finalize recovers.
3. **Rounding on display** — **`toFixed(2)` confirmed** (stored floats untouched).
