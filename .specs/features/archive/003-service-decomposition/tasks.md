# Task Breakdown: Service Decomposition

**Feature**: 003-service-decomposition
**Spec**: [spec.md](./spec.md)
**Status**: Approved (maintainer, 2026-07-11) — implementation in progress

Each numbered group below is one prospective commit. Commit only when every box is checked
and the group's validation gate passes. AC refs map to [spec.md](./spec.md) §"Acceptance
Criteria". Design-decision refs (DD-x) map to spec.md §"Design Decisions".

**Complexity legend**: S = <30min · M = 30min–2h · L = >2h

**PR slicing (DD-5)**: Groups 1–3 = **PR-1** (`refactor/composition-root`); Groups 4–6 =
**PR-2** (`refactor/score-service-split`, branched after PR-1 merges). Run the full-suite
gate (Group 3.4 / Group 6.4) before opening each PR.

---

## PR-1 · Group 1 — Composition root

**Goal**: one shared factory + ScoreService behind a lazy `getServices()`.
**Commit**: `refactor(services): add app-services composition root`
**AC**: AC-3 (partial) · **DD**: DD-1

- [ ] **1.1 (S)** Create `src/services/app-services.ts` (~30 lines): interface
      `AppServices { repositoryFactory: RepositoryFactory; scoreService: ScoreService }`;
      memoized `getServices()` building `createRepositoryFactory({ db })` (db from
      `@/firebase-config`) + one `ScoreService` on first call. No module-level construction,
      no reset API. Header comment: why lazy (DD-1), and that tests construct `ScoreService`
      directly and must never import this file.
- [ ] **1.2 (S)** Typecheck passes with the new file unused.

**Validation**:
```
npm run typecheck
wc -l src/services/app-services.ts        # ~30, must be < 100
```

---

## PR-1 · Group 2 — Migrate the seven components

**Goal**: zero private ScoreService/factory construction in components.
**Commit**: `refactor(components): share ScoreService via composition root`
**AC**: AC-3, AC-4, AC-10

- [ ] **2.1 (M)** In each of `home-standings.ts`, `home-announcements.ts`, `site-banner.ts`,
      `season-scorecards.ts`, `season-calendar.ts`, `scoresheet-generator.ts`,
      `admin-panel.ts`: delete the module-level `createRepositoryFactory({ db })` +
      `new ScoreService(...)` pair and the now-unused `db` / `createRepositoryFactory` /
      `ScoreService` imports; replace with
      `const { scoreService } = getServices();` (module level — safe per DD-1). Keep type-only
      imports where still needed. **No other edits** to these files.
- [ ] **2.2 (S)** Confirm admin-tab constructor injection unchanged: `admin-panel.ts` still
      passes its (now shared) service into `admin-tabs/` exactly as before.
- [ ] **2.3 (S)** Grep gate.

**Validation**:
```
npm run typecheck && npm test
grep -rn "new ScoreService" src/ | grep -v test | grep -v app-services.ts   # empty (AC-3)
grep -rln "createRepositoryFactory" src/components/                          # empty
```
Emulator (AC-4): `npm run dev:seeded` → sign in as admin → publish a week → navigate Home
**without reload** → new week in dropdown + standings. Create an announcement → visible on
Home; set a banner → renders. (Browser-driving note: same-URL `navigate` does not reload —
use in-app nav links.)

---

## PR-1 · Group 3 — Component contract + enforcement + PR-1 gate

**Goal**: the pattern is written down and machine-enforced; PR-1 verified and opened.
**Commit**: `docs(components): add component contract; enforce via forbidden-patterns rule`
**AC**: AC-5, AC-1, AC-2 · **DD**: DD-2

- [ ] **3.1 (M)** Write `src/components/README.md`: the five contract items from DD-2
      (shared services via `getServices()`; innerHTML static-only + escapeHtml/textContent;
      disconnectedCallback teardown; skeleton→data→error per §III.3; `_loadGen` re-entrancy
      guard). Reference the constitution/ruleset for each — do not restate full rules
      (per spec-authoring-guidelines).
- [ ] **3.2 (S)** `scripts/forbidden-patterns.json`: add rule `no-private-service-in-component`
      — `severity: forbid`, `kind: regex`, pattern matching `new ScoreService(` or
      `createRepositoryFactory(`, `scope: ["src/components/**"]` (`*.ts`),
      `enforcedBy: hook`, message pointing at `src/components/README.md`.
- [ ] **3.3 (S)** Constitution: one pointer line in §II.4 to `src/components/README.md`;
      bump 1.5.1 → 1.6.0 + Version History line (Open Question 2 — confirm with Tyler first).
- [ ] **3.4 (M)** **Full PR-1 gate**: all suites + preview hash comparison, then open PR-1.

**Validation**:
```
npm run typecheck && npm test && npm run test:rules && npm run test:functions
# Hook enforcement: temporarily add `const s = new ScoreService(x);` to a component,
# save via an agent edit → hook BLOCKS; revert.
```
Then `/deploy-preview` and run the prod-vs-preview SHA-256 DOM-equivalence comparison
(AC-2) across at least: Home (2–3 seasons, several week selections), Scorecards, Calendar.
Byte-identical → open PR-1 with Summary / Changes / Testing / Constitutional Compliance.

---

## PR-2 · Group 4 — Extract scorecard-builder.ts and standings.ts (pure moves)

**Goal**: the ~325 lines of module-level pure functions leave score-service.ts verbatim.
**Commit**: `refactor(services): extract scorecard-builder and standings modules`
**AC**: AC-1, AC-6 (partial), AC-10 · **DD**: DD-3, DD-4

- [ ] **4.1 (M)** Create `src/services/scorecard-builder.ts`: move `_buildSeasonData`
      (`score-service.ts:769`) and `_buildScorecardTeamBlock` (`:887`) **verbatim** (rename
      exports `buildSeasonData` / `buildScorecardTeamBlock`); header documents purity + the
      scoring-engine-style import rule (types/ + scoring-engine only). Update
      `score-service.ts` call sites and imports. No logic edits — `git diff --color-moved`
      should show moved blocks.
- [ ] **4.2 (M)** Create `src/services/standings.ts`: move `_computeStandings` (`:1060`) and
      `_recomputeStandingsFromWeeks` (`:1031`) **verbatim** (exports `computeStandings` /
      `recomputeStandingsFromWeeks`); header states the two-derivations invariant and the
      explicit DD-4 deferral note (unification is follow-up work requiring its own spec).
      Update call sites (`_publishWeekInner`, `deleteTeam` path at `:550`).
- [ ] **4.3 (S)** `_slugify` stays in score-service.ts (publish-path fallback only). Confirm
      no test edits beyond import paths were needed (there should be **zero** — the moved
      functions were module-private).

**Validation**:
```
npm run typecheck && npm test           # all tests pass UNMODIFIED (AC-1)
wc -l src/services/scorecard-builder.ts src/services/standings.ts   # each ≤ 500
grep -n "from '@/services" src/services/standings.ts src/services/scorecard-builder.ts
# → only scoring-engine (never score-service / repositories)
```

---

## PR-2 · Group 5 — Guard dedup + main.ts route table

**Goal**: one validation implementation; one route definition site.
**Commit**: `refactor(services): dedup year/week guards; data-driven route table`
**AC**: AC-7, AC-9

- [ ] **5.1 (M)** Add `assertValidYear(year): Result-failure | null` and
      `assertValidWeek(weekNumber): Result-failure | null` in `score-service.ts` (private,
      return the exact same failure messages/codes as today; never throw — preserves the F-09
      no-throw contract). Replace all 18 `year < 2019 || year > 2100` sites and all 4
      `weekNumber < 1 || weekNumber > 15` sites. Failure strings must be byte-identical to
      current ones (tests assert messages).
- [ ] **5.2 (M)** `main.ts`: replace the six `_showX` handlers (`:147-187`) with a route
      table `{ path, view, after? }` iterated in `_setupRoutes`; shared body = render +
      `setActiveLink` + close nav + `scrollTo`; `/admin` supplies
      `after: () => { this._wireAdminAuthButtons(); this._applyAdminViewState(); }`. Route
      guard (`onBeforeNavigate`) unchanged.

**Validation**:
```
npm run typecheck && npm test
grep -c "year < 2019" src/services/score-service.ts      # ≤ 1 (AC-7)
grep -c "weekNumber < 1" src/services/score-service.ts   # ≤ 1
grep -c "_showHome\|_showScorecards\|_showRules" src/main.ts   # 0 (AC-9)
```
Emulator: click through all six routes; verify /admin sign-in buttons + panel mount still
work signed-out → signed-in.

---

## PR-2 · Group 6 — De-grandfather + full PR-2 gate

**Goal**: the hook is strict again; PR-2 verified and opened.
**Commit**: `chore(hooks): remove score-service grandfather entry`
**AC**: AC-6, AC-8, AC-1, AC-2

- [ ] **6.1 (S)** Measure: `wc -l src/services/score-service.ts` — must be ≤ 750; record the
      figure in the PR description against Open Question 1 (expected ~700–725).
- [ ] **6.2 (S)** Remove `"src/services/score-service.ts"` from `grandfathered.file-size` in
      `scripts/forbidden-patterns.json`; if the list is now empty, keep the key with `[]` and
      its `$comment`.
- [ ] **6.3 (S)** Hook check: make a trivial whitespace edit to `score-service.ts` via an
      agent edit → hook must not block (size warn at >500 is acceptable per Open Question 1;
      note it in the PR).
- [ ] **6.4 (L)** **Full PR-2 gate**: all suites, emulator smoke (publish / delete-team /
      scorecards / scoresheet / calendar), `/deploy-preview`, prod-vs-preview SHA-256
      equivalence across seasons/weeks (AC-2). Byte-identical → open PR-2.

**Validation**:
```
npm run typecheck && npm test && npm run test:rules && npm run test:functions
wc -l src/services/score-service.ts                        # ≤ 750 (AC-6)
grep -n "score-service" scripts/forbidden-patterns.json    # no grandfather entry (AC-8)
grep -rn "new ScoreService" src/ | grep -v test | grep -v app-services.ts   # still empty
```

---

## Rollback notes

- PR-1 and PR-2 are independently revertable; neither touches Firestore data, rules,
  indexes, or Functions — `git revert` + redeploy hosting fully restores prior behavior.
- If the preview-hash gate fails at Group 3.4 or 6.4: do **not** patch forward. Bisect the
  moved blocks (`git diff --color-moved`) — a hash mismatch means a move was not pure.
