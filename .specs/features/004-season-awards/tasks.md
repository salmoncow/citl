# Task Breakdown: Season Awards

**Feature**: 004-season-awards
**Spec**: [spec.md](./spec.md)
**Status**: Approved (Tyler, 2026-07-12) — in implementation

Each numbered group is one prospective commit; commit only when every box is checked and the
group's validation gate passes. AC refs map to spec.md §"Acceptance Criteria"; DD refs to
§"Design Decisions". Single PR (`feat/season-awards`), branched from `main`.

**Complexity legend**: S = <30min · M = 30min–2h · L = >2h

---

## Group 1 — Canonical type + engine placements + guard + adapter

**Goal**: one flat `SeasonAwards` type; `computeSeasonAwards` takes flat shooter inputs and
returns complete awards; no NaN edge; pure adapter from scorecard blocks.
**Commit**: `feat(engine): compute team placements in season awards; adopt flat SeasonAwards shape`
**AC**: AC-1, AC-2, AC-3 · **DD**: DD-1, DD-3 (engine + adapter), DD-4

- [ ] **1.1 (S)** `src/types/season.ts`: replace the nested `SeasonAwards` with the flat
      ten-field shape (today's `ComputedAwards` field set, all fields nullable); delete
      `ComputedAwards`; add `AwardShooterInput` (`{ name, teamName, isDummy, rookie,
      startingAvg, scores }` — see DD-3); rewrite the doc comments — note the shape matches
      all seven prod documents (verified 2026-07-12, spec.md §"Verified Production
      Evidence") and that `improvement` is a formatted percent string by prod precedent
      (DD-1 quirk note). `Season.awards` stays `SeasonAwards | null`.
- [ ] **1.2 (S)** `src/services/scoring-engine.ts` — `computeMostImprovedScore`: add the
      guard `if (startingAvg >= 50) return 0;` with a one-line comment referencing DD-4.
- [ ] **1.3 (M)** `src/services/scoring-engine.ts` — rework `computeSeasonAwards` to
      `computeSeasonAwards(shooters: AwardShooterInput[], finalStandings:
      SeasonStandings[]): SeasonAwards` (DD-3): the eligibility loop runs over the flat
      input list (dummy exclusion, `weeksShot` from `scores`, `MIN_WEEKS = 6`, full-precision
      `finalAvg` via `computeShooterAverage(startingAvg, scores, 14)` — all unchanged logic,
      no `SeasonData` traversal). Derive `firstPlaceTeam`/`firstPlacePoints` from the rank-1
      standings row and `secondPlaceTeam`/`secondPlacePoints` from the rank-2 row
      (points = `totalRankPoints + totalBonusPoints`); nulls when the rows don't exist.
      **Both** return branches (empty-eligible and normal) carry the derived placements.
      Type-only imports for `SeasonStandings` / `AwardShooterInput` / `SeasonAwards`.
- [ ] **1.4 (S)** `src/services/scorecard-builder.ts`: add exported pure
      `toAwardShooterInputs(blocks: ScorecardTeamBlock[]): AwardShooterInput[]` (DD-3):
      per row map `w0Display` → `startingAvg`, carry `name`/`rookie`/`isDummy`/`scores` and
      the block's `teamName`; **skip** rows with non-numeric `w0Display` (dummy/padding
      rows only — comment why); ignore the row's display-oriented `finalAvg`/`weeksShot`.
      Header import rule (types-only) unchanged.
- [ ] **1.5 (M)** Tests — `src/services/scoring-engine.test.ts` (and the adapter's test
      home per the spec's Architecture table):
      - update all `computeSeasonAwards` call sites to flat inputs + standings;
      - placements from a 2+-team standings fixture (assert names + point sums);
      - 1-team standings → second-place fields null; empty standings → all four null;
      - empty-eligible branch (no shooter with ≥ 6 weeks) still returns placements;
      - `computeMostImprovedScore(50, 45) === 0`, `(55, 40) === 0`, existing improvement
        cases unchanged; a `startingAvg = 50` shooter in the pool scores 0 and loses to any
        positive improvement;
      - award `finalAvg` full-precision (not 1-decimal rounded);
      - adapter: field mapping, `'-'`-W0 row skipped, `isDummy` passed through, `teamName`
        attached from the block.
- [ ] **1.6 (S)** Grep gate: no `ComputedAwards` anywhere in `src/` or `scripts/`.

**Validation**:
```
npm run typecheck && npm test
grep -rn "ComputedAwards" src/ scripts/        # empty (AC-3)
wc -l src/services/scoring-engine.ts           # < 600 (AC-9)
wc -l src/services/scorecard-builder.ts        # < 320 (AC-9)
```

---

## Group 2 — SeasonAwardsService + composition root

**Goal**: preview/finalize orchestration over PUBLISHED data behind the composition root;
fully unit-tested.
**Commit**: `feat(services): add SeasonAwardsService (preview + finalize season)`
**AC**: AC-4 (service half), AC-9 · **DD**: DD-3

- [ ] **2.1 (M)** Create `src/services/season-awards-service.ts` (≤ 150 lines):
      `SeasonAwardsService` with `constructor(repository: ScoreRepository, scoreService:
      ScoreService)`; header comment states the import rule (types, scoring-engine,
      scorecard-builder, score-service, repositories — never components/modules), that the
      class is constructed only in `app-services.ts` (tests construct directly), and that
      the awards path reads **published data only — never `entries`** (DD-3).
      - `previewAwards(year): Promise<Result<SeasonAwards>>` — `scoreService.getSeason`;
        failure `NO_DATA` if season null or `currentWeek < 1`; then
        `scoreService.buildScorecardData(year)` (cached; already performs the prior-year
        rookie/W0 derivation and roster-removed-shooter rules) →
        `toAwardShooterInputs(viewData.teams)` →
        `computeSeasonAwards(inputs, season.standings ?? [])`. Propagate every failed
        `Result` unchanged (no throws — F-09 convention).
      - `finalizeSeason(year): Promise<Result<SeasonAwards>>` — `previewAwards`, then
        `repository.updateSeason(year, { awards, status: 'complete' })`, then
        `scoreService.clearCache()`, return the awards.
- [ ] **2.2 (M)** Create `src/services/season-awards-service.test.ts` (stub repository
      pattern from `score-service.test.ts`; **never** import `app-services`). Stubs serve:
      season doc (with standings), teams + published week docs for the target year, and
      teams/weeks for the two prior years (may be empty) so the real `buildScorecardData`
      runs over them. Cases:
      - preview happy path (fixture teams/weeks/standings → full flat awards);
      - consistency property: the award winners agree with the scorecard rows
        `scoreService.buildScorecardData(year)` returns for the same stubs;
      - `NO_DATA` on missing season; `NO_DATA` on `currentWeek: 0`;
      - failure propagation from `buildScorecardData` (e.g. teams + weeks both failing);
      - stub asserts `getEntries` is **never called** in the awards path (AC-4);
      - finalize: `updateSeason` called with `{ awards, status: 'complete' }`;
        `clearCache` observed (spy); failure from `updateSeason` propagates (no cache-clear
        after a failed write);
      - idempotency: second finalize recomputes and rewrites without error.
- [ ] **2.3 (S)** `src/services/app-services.ts`: add `seasonAwardsService:
      SeasonAwardsService` to `AppServices`, constructed in `getServices()` from the same
      repository + the shared `scoreService`.

**Validation**:
```
npm run typecheck && npm test
grep -rn "new SeasonAwardsService" src/ | grep -v test   # only app-services.ts
grep -n "getEntries" src/services/season-awards-service.ts   # empty (AC-4)
wc -l src/services/season-awards-service.ts              # <= 150
wc -l src/services/score-service.ts                      # still 749 — MUST be untouched (AC-9)
```

---

## Group 3 — Admin "Season End" tab

**Goal**: two-phase preview → finalize UX in the admin panel.
**Commit**: `feat(admin): add Season End tab — preview and finalize season awards`
**AC**: AC-4, AC-7 · **DD**: DD-3

- [ ] **3.1 (L)** Create `src/components/admin-tabs/season-end-tab.ts` (≤ 250 lines):
      `SeasonEndTab implements AdminTab`, `constructor(seasonAwardsService)`.
      - `mount(host, ctx)`: static innerHTML skeleton of the section (status line, preview
        button, empty preview container, disabled `btn-danger` finalize button, `aria-live`
        status element per the `setStatus` pattern in `admin-shared.ts`). All dynamic values
        rendered via `textContent`/`escapeHtml` (component contract,
        `src/components/README.md`).
      - Status line from `ctx.getSeasonData()`: year, `status`, `currentWeek`, whether
        `awards` already exist ("Awards last written: yes/no").
      - Preview click → `previewAwards(ctx.getYear())`; render the ten fields in a read-only
        table; show the non-blocking `currentWeek < 15` warning ("only N of 15 weeks
        published") when applicable; enable finalize on success; render failure message on
        failed `Result`.
      - Finalize click → confirm dialog (standard confirm — resolved Open Question 1) →
        `finalizeSeason(year)` → on success:
        `ctx.refreshSeason()`, success toast, re-render status line; on failure: status
        message, finalize stays enabled.
      - `onYearChange`/`onSeasonChanged`: clear preview, disable finalize, refresh status
        line. Re-entrancy: disable buttons while a call is in flight.
- [ ] **3.2 (S)** `src/components/admin-panel.ts`: import + construct `SeasonEndTab`
      (service from `getServices().seasonAwardsService`); add the tab button
      (`data-tab="season-end"`, label "Season End") after Announcements; add the panel div;
      extend `TabName`, `_switchTab` list, and `_lifecycleTabs`; mount with the shared ctx.
      Year row stays visible for this tab.
- [ ] **3.3 (S)** Styling: reuse existing admin classes (`admin-form-row`, `admin-status`,
      `btn-danger`, table classes); add minimal new rules only if needed, in the styles
      partial that owns admin styling.

**Validation**:
```
npm run typecheck && npm test && npm run test:rules   # rules suite unmodified (AC-7)
wc -l src/components/admin-tabs/season-end-tab.ts     # <= 250
wc -l src/components/admin-panel.ts                   # < 260
```
Hook must pass on every edit (`scripts/check-constitution.sh` via PostToolUse).

---

## Group 4 — Home-page awards display

**Goal**: awards visible for the selected season, historical years included; nothing shown
when absent.
**Commit**: `feat(home): show season awards for the selected season`
**AC**: AC-5, AC-6 · **DD**: DD-2

- [ ] **4.1 (M)** `src/components/home-standings.ts`: add `_renderAwards(awards:
      SeasonAwards): string` (private, mirrors `_renderAccolades` structure). In
      `_renderTable`, when `weekKey === 'season'` and `this._season?.awards != null`,
      prepend the awards section to the `#hs-table` innerHTML. Rows per DD-2: First/Second
      Place (team — N pts), Highest Average (name — `avg.toFixed(2)`), Rookie of the Year
      (omit when null), Most Improved (omit when null; improvement string rendered as-is).
      Null-guard **every** field independently (unvalidated repository casts, F-09); omit
      the whole section if no field renders. `escapeHtml()` on every string.
- [ ] **4.2 (S)** Styles: add `awards-section` styling in the partial that owns
      home-standings/accolades styles, reusing the `accolades-*` visual language and design
      tokens (`--c-*`); dark mode via tokens (no extra work).
- [ ] **4.3 (S)** Confirm zero new reads: no new service/repository calls in
      `home-standings.ts` — awards come from the already-fetched `this._season` (AC-6);
      skeleton flow unchanged (§III.3 satisfied by the existing `_standingsSkeleton`).

**Validation**:
```
npm run typecheck && npm test
wc -l src/components/home-standings.ts                # < 420
grep -n "scoreService\." src/components/home-standings.ts   # same call set as before (AC-6)
```

---

## Group 5 — Seed fixtures to canonical shape

**Goal**: emulator data matches prod's shape; UI verifiable locally.
**Commit**: `fix(seed): emit canonical flat SeasonAwards in emulator fixtures`
**AC**: AC-8 · **DD**: DD-6

- [ ] **5.1 (M)** `scripts/fixtures/seed-data.js` — rewrite `buildAwards` to return the flat
      ten-field shape: placements from the fixture standings (rank 1/2 rows,
      `totalRankPoints + totalBonusPoints`); highest-average and rookie logic as today but
      emitting `highestAvgShooter`/`highestAvg`/`rookieOfYear`/`rookieAvg` flat fields;
      most-improved computed with the same formula + `>= 50 → 0` guard + `"NN.NN%"`
      formatting (plain JS mirror — do not import the TS engine). Update `buildSeason`
      call sites/signature as needed so seeded 2025 (complete) carries full awards and
      seeded 2024 (active) carries **no** awards field.
- [ ] **5.2 (S)** Reseed and inspect: `npm run seed:emulator -- clear` then seed; verify the
      2025 season doc's `awards` has all ten fields non-null and 2024 has none (Emulator UI
      or a read via the seeding script's status mode).

**Validation**:
```
npm run seed:emulator -- status    # or manual Emulator UI check of seasons/2025 + seasons/2024
```

---

## Group 6 — Emulator E2E verification (no commit — gate before PR)

**Goal**: whole pipeline proven end-to-end locally. Note the seeded data split (DD-3):
2025 is complete with 15 published weeks and **zero entries docs** — exactly the case that
would have broken an entries-based computation and now must succeed; 2024 is active with
5 published weeks (no shooter reaches the 6-week minimum).
**AC**: AC-4, AC-5, AC-8

- [ ] **6.1** `npm run dev:seeded` → Home → select 2025 + "Season" view → awards section
      renders with all five rows (seeded fixture values); select 2024 → **no** awards
      section; week views never show awards.
- [ ] **6.2** Sign in as admin (see the emulator auth-popup workaround notes) → Admin →
      Season End tab, year **2025** → status line shows `complete`, awards exist → preview
      renders ten fields computed from the 15 published weeks (real shooter awards — proves
      the published-data path works with no entries docs) → finalize + confirm → toast;
      Home 2025 "Season" view now shows the engine-computed awards (values may differ from
      the seed fixture's approximations — that overwrite is expected and correct).
- [ ] **6.3** Season End tab, year **2024** → status `active`, week 5, no awards → preview
      shows the "only 5 of 15 weeks" warning, placements filled from standings, shooter
      awards null (zero-eligible branch — AC-1) → finalize → Home 2024 "Season" view shows
      the awards section with placement rows and the null shooter rows omitted (DD-2
      row-omission behavior exercised).
- [ ] **6.4** Navigate Home **without reload** after each finalize → updated awards visible
      (cache invalidation proof). Re-run preview + finalize on 2025 → identical result, no
      error (idempotency).
- [ ] **6.5** Full gate: `npm run typecheck && npm test && npm run test:rules &&
      npm run test:functions && npm run build`, then `/check`.

---

## Group 7 — Docs + review-ledger close-out

**Goal**: sources of truth updated; F-26 / WS5-02 closed.
**Commit**: `docs(specs): update awards shape docs; close F-26 / WS5-02 in review ledger`
**AC**: AC-10

- [ ] **7.1 (S)** `.specs/technical/firestore-schema.md`: update the `seasons/{year}`
      `awards` row — flat shape (reference `SeasonAwards` in `src/types/season.ts`), note
      "verified against prod 2026-07-12; all seven historical seasons populated"; remove
      `ComputedAwards` from the TypeScript-interfaces line.
- [ ] **7.2 (S)** `.specs/features/scoring-engine.md` §"Outputs — computeSeasonAwards":
      rewrite to the new flat-input signature — `computeSeasonAwards(shooters:
      AwardShooterInput[], finalStandings)` returns the complete flat `SeasonAwards`;
      placements from the caller-supplied final standings; inputs adapted from the
      scorecard-page derivation (`toAwardShooterInputs`) so awards always match the public
      scorecards. **Do not touch** the §"Season Awards" rules section (authoritative
      business rules).
- [ ] **7.3 (S)** `.specs/reviews/2026-07-deep-review/report.md` §0 remediation ledger: add
      a row — F-26 → this feature's PR, note "finished (not deleted) per WS5-02 decision;
      placements computed, shape reconciled flat, NaN edge guarded, admin finalize flow
      computing from published week docs + historical display shipped; backfill closed
      (prod already populated)".
- [ ] **7.4 (S)** `.specs/reviews/2026-07-deep-review/backlog.md` WS5-02: mark done with a
      pointer to `features/004-season-awards/` (or its archive path) and the PR number.
- [ ] **7.5 (S)** Set spec.md + tasks.md Status to "Implemented — PR #NNN" (archive move to
      `features/archive/` happens after merge per `.specs/README.md` lifecycle).

**Validation**: link-check the four edited docs' relative links; `/check` clean.

---

## Post-merge / post-deploy

- [ ] Deploy via the normal pipeline (no new Cloud Function → no runbook IAM steps, spec
      §"Constitutional Constraints").
- [ ] Prod spot-check: citl.club → 2025 "Season" view → awards match the prod doc values
      (Sights Impaired 433 / Full Choke Artists 415 / Randy Jones 44.43 / Micheal Benjamin
      43.29 / "55.24%"); 2026 shows no awards section until finalized.
- [ ] When the 2026 season ends: admin runs Season End → preview → finalize on prod; verify
      Home shows 2026 awards.
