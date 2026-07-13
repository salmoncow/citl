# Tasks: 005-standings-unification

**Spec**: [spec.md](./spec.md)
**Status**: Implemented — [PR #224](https://github.com/salmoncow/citl/pull/224) (2026-07-13)
**PR**: single PR per DD-7 — `feat(standings): unify standings derivations; publish rewrites week docs`
(branch `claude/compassionate-turing-5432ec`)

Task sizing: S ≈ ≤30 min, M ≈ ≤2 h. Each group maps to one reviewable commit.

---

## Group 0 — Preflight

- [x] **0.1 (S)** Confirm all five Open Questions in spec.md are answered by the
      maintainer; record the resolutions in spec.md (spec 003 style: a dated
      "Resolved" block above the questions). **Hard gate — no code before this.**
- [x] **0.2 (S)** Back up `.emulator-data/` (copy aside) so write-path demos are
      restorable; note the `test:rules`-vs-dev-emulator port-8080 conflict for the
      session.

---

## Group 1 — Pure derivation module (`src/services/standings.ts`)

**Goal**: one canonical function + the pure week-doc builder; the entries-side derivation
deleted. **AC**: AC-2 (module half), AC-5 (new-file budget).
**Commit**: `feat(standings): canonical computeStandingsFromWeeks + pure buildWeekResults`

- [x] **1.1 (S)** Rename `recomputeStandingsFromWeeks` → `computeStandingsFromWeeks` and
      add the optional `throughWeek?: number` parameter (filter
      `wr.weekNumber <= throughWeek` before summing; omitted = all weeks). Update the
      `deleteTeam` call site mechanically (no `throughWeek`, behavior identical).
- [x] **1.2 (M)** Extract the per-week `TeamResult[]` construction from
      `_publishWeekInner` (the `teamResults` mapping over `computed.teams`: entry lookup,
      normalized extra-scores merge per F-51, `resolveTeamId` per F-08, `totals[wi]`
      reads) into a pure exported `buildWeekResults(...)` in `standings.ts` that, given
      the engine pass output, entries, a teamId resolver, and a set/list of week numbers,
      returns the complete `WeekResult[]` — including `computeAccolades` per week and a
      caller-supplied `publishedAt` per week (DD-3). Imports stay within the module's
      rule: `@/types/*` + `@/services/scoring-engine` (which exports `computeAccolades`,
      `normalizeShooterName`, `isDummyName`).
      **Acceptance**: `head -30 src/services/standings.ts` shows the import rule intact;
      no import from repositories/modules/components.
- [x] **1.3 (S)** **Equivalence pin, then delete**: add a unit test proving, on a
      multi-week fixture, `computeStandings(computed, maxWeek, resolve)` ≡
      `computeStandingsFromWeeks(buildWeekResults(...all weeks...), maxWeek)`; run it;
      then delete `computeStandings` and keep the test asserting only the canonical side
      (retain the fixture — it documents why the entries-side derivation was redundant).
      **Acceptance**: `grep -rn "computeStandings\b" src/ | grep -v FromWeeks` returns
      nothing.
- [x] **1.4 (S)** Rewrite the file header: replace the DD-4 deferral note with the unified
      model — entries are the ledger; publish rewrites all published week docs from one
      engine pass; `season.standings` is by construction
      `computeStandingsFromWeeks(stored week docs)`; `home-standings` imports the same
      function. Reference this spec's archive path.
- [x] **1.5 (S)** Unit tests for `computeStandingsFromWeeks` cutoff semantics (throughWeek
      boundary, gaps excluded, omitted = all) and `buildWeekResults` determinism
      (unchanged entries → identical `shooterScores` + accolades).
      **Acceptance**: `npm test` green; `wc -l src/services/standings.ts` ≤ 500.

---

## Group 2 — Repository batch (`src/repositories/score-repository.ts`)

**Goal**: atomic multi-week publish. **AC**: AC-1 (atomicity precondition), AC-6.
**Commit**: `feat(repository): publishWeek writes N week docs + season in one batch`

- [x] **2.1 (M)** Change `publishWeek` to accept `weekResults: WeekResult[]`:
      `batch.set` each `seasons/{year}/weeks/{weekNumber}` + the existing season merge.
      Keep the Result contract and validation (non-empty array, every element has
      `weekNumber`). ≤ 16 ops — no batch-limit handling needed (limit 500); note that in
      a comment.
- [x] **2.2 (S)** Update repository/service tests' stubs for the new signature; add one
      test asserting all provided week docs and the season update land in a single
      batch/commit (stub-level call accounting, per the existing publish test pattern).
- [x] **2.3 (S)** Confirm no rules change needed: `tests/rules` suite passes unmodified
      (weeks create/update already granted; no delete used).
      **Acceptance**: `npm run test:rules` green (dev emulator stopped first).

---

## Group 3 — Service pipeline + invariant tests (`src/services/score-service.ts`)

**Goal**: publish = sync-from-ledger; invariant by construction; no net line growth.
**AC**: AC-1, AC-5. **Commit**: `feat(service): publish pipeline rewrites published weeks; standings = sum of written docs`

- [x] **3.1 (M)** Rework `_publishWeekInner`: after the existing maxWeek/entries/teams
      reads, fetch current week docs fresh via `this.repository.getAllWeekResults(year)`
      (not the cache); rewrite set = weeks with existing docs ∪ {k} (never-published
      weeks stay unpublished, DD-2); build all docs via `buildWeekResults` with
      `publishedAt` preserved from stored docs for w ≠ k and fresh for k (DD-3);
      `standings = computeStandingsFromWeeks(docsToWrite, maxWeek)`; single repository
      call. Preserve the F-05/F-08/F-09/F-51 behaviors verbatim (dummy-count validation,
      no-throw wrapper, resolver, normalization).
- [x] **3.2 (S)** Widen publish cache invalidation: `weeks:{year}`, `week:{year}:{w}` for
      every rewritten w, `latest:{year}`, `season:{year}`.
      **Acceptance**: a cache-hit-count test shows a post-publish `getAllWeekResults` +
      `getWeekResult(w≠k)` re-fetch.
- [x] **3.3 (M)** **AC-1 invariant tests** (stub repository capturing writes) asserting
      written/updated `season.standings` deep-equals
      `computeStandingsFromWeeks(<stored week docs after the operation>)` after each of:
      (a) first publish; (b) republish week 2 with edited entries at season week 5 —
      also asserting week docs 3–5's `bonusPoints` were rewritten (the F-05 residual,
      AC-3's unit half); (c) `deleteTeam`; (d) `removeShooterFromRoster` (no standings
      write occurs and the invariant still holds — sums unchanged).
- [x] **3.4 (S)** Update existing publishWeek tests deliberately: each changed assertion
      must cite a DD in a comment (e.g. rewrite-set expectations per DD-2, `publishedAt`
      preservation per DD-3). No unrelated test edits.
- [x] **3.5 (S)** If Open Question 3's optional admin-UI confirmation was accepted: add
      the confirm prompt in the delete flow of the relevant admin tab (team appears in
      any published week doc → warn). Otherwise skip and note "declined" here.
      **Acceptance**: `wc -l src/services/score-service.ts` ≤ 749; `npm test` green;
      `/check` clean.

---

## Group 4 — Home historical view (`src/components/home-standings.ts`)

**Goal**: third derivation deleted; component renders from the canonical function.
**AC**: AC-2 (component half). **Commit**: `refactor(home): historical week view uses canonical computeStandingsFromWeeks`

- [x] **4.1 (M)** Replace `_renderTable`'s cumulative-sum loop with
      `computeStandingsFromWeeks(this._allWeekResults, weekNum)`; join week-N doc rows by
      `teamId` for the per-week columns; keep row set (week-N participants), ordering
      (`compareStandings` on cumulative), and place numbering identical (DD-5).
- [x] **4.2 (S)** Acceptance: `grep -n "rankPoints +=" src/components/home-standings.ts`
      returns nothing (no local accumulation); rendered Week-N and Season views on a
      consistent fixture/emulator season are identical pre/post change; skeleton behavior
      untouched (§III.3).

---

## Group 5 — Verification gates

**Goal**: AC-3 and AC-4 demonstrated end-to-end. **Commit**: (no code — evidence in PR description)

- [x] **5.1 (M)** Emulator write-path demos (on the seeded emulator; restore
      `.emulator-data` backup afterward):
      (a) **AC-3**: publish weeks 1–5 → edit week 2 entries → republish week 2 → week
      docs 2–5 and season doc consistent; home Week 3/4/5 + Season views agree;
      (b) publish → `deleteTeam` → publish next week → observe DD-4 semantics
      (screenshot for PR);
      (c) gap: publish 1, 2, 4 → week 3 stays unpublished, standings exclude it.
- [x] **5.2 (S)** Prod-snapshot healing report (DD-6): run the new pipeline against a
      copy of current prod season data in the emulator; diff current-season week docs
      pre/post first publish; record the diff (or "no drift found") in the PR
      description for the maintainer.
- [x] **5.3 (M)** **AC-4**: deploy two preview channels (pre-change base, this branch) via
      `/deploy-preview`; SHA-256 DOM-hash equivalence over read surfaces on
      already-consistent seasons — home (Season + every week, all archived years),
      scorecards, scoresheet generator (PR #203/#204 technique; mind the
      same-URL-navigate-≠-reload gotcha).
- [x] **5.4 (S)** Full gate: `npm run typecheck && npm run lint && npm test &&
      npm run test:rules && npm run test:functions && npm run build`, then `/check`.

---

## Group 6 — Docs + close-out

**Goal**: sources of truth updated; FU-01 closed; lifecycle executed.
**Commit**: `docs(specs): standings unification rules + schema wording; close FU-01`

- [x] **6.1 (S)** `.specs/domain/scoring-rules.md`: add the DD-4 rule as resolved by Open
      Question 3 — "Team deletion & published history" (delete-time preservation;
      re-derivation from entries on subsequent publishes) — plus a one-line pointer that
      `season.standings` is defined as `computeStandingsFromWeeks(published week docs)`.
- [x] **6.2 (S)** `.specs/technical/firestore-schema.md`: update the "Denormalized
      standings" pattern text (rewritten on every publish **together with all published
      week docs from one engine pass**; invariant by construction) and the week-doc
      `publishedAt` note (first-publication timestamp, preserved across rewrites);
      re-date the doc.
- [x] **6.3 (S)** `.specs/reviews/2026-07-deep-review/report.md` §0 remediation ledger:
      add a row for this PR — FU-01 closed (derivations 3 → 1; publish rewrites published
      week docs; invariant test added); update the "Still open" line (FU-02 remains).
- [x] **6.4 (S)** `.specs/reviews/2026-07-deep-review/backlog.md` FU-01: mark **DONE**
      with PR number and a pointer to this spec's archive path.
- [x] **6.5 (S)** Set spec.md + this file's Status to "Implemented — PR #NNN"; after
      merge, move `005-standings-unification/` to `.specs/features/archive/` per the
      `.specs/README.md` lifecycle. Link-check all edited docs' relative links.

---

## Post-merge / post-deploy

- [ ] Deploy via the normal pipeline (no new Cloud Function → `firebase-deploy-runbook`
      IAM steps N/A, spec §Constitutional Constraints).
- [ ] Prod spot-check after the next real publish: home Week-N views vs Season view agree
      for the current season; archived seasons byte-identical (spot-check one).
