# Deep Review Report — citl.club

**Date**: 2026-07-09
**Scope**: Full-repo deep review across four dimensions (architecture, implementation, documentation, agent-framework), run as a multi-agent workflow: 12 specialized reviewers → claim merge → adversarial refutation pass → this synthesis.
**Repo state reviewed**: `main` @ a047a85.
**Companion document**: [backlog.md](backlog.md) — the actionable, dependency-ordered work plan derived from these findings.

---

## 0. Remediation Status

The findings below are a **frozen snapshot as of 2026-07-09**; they are not edited as work lands. This section is the running ledger of what has since been remediated. When a finding is fixed, its write-up in §2 stays as-is for the audit trail — check here for current status.

**All 13 P1 findings are resolved and deployed** (as of 2026-07-11). **WS-4 is complete** (as of 2026-07-12). Ledger by PR:

| PR | Workstream | Findings closed |
|----|-----------|-----------------|
| [#195](https://github.com/salmoncow/citl/pull/195) | Security trio | F-06, F-27, F-10 |
| [#198](https://github.com/salmoncow/citl/pull/198) | CI gate (WS4-03, pulled forward per the backlog's ordering note) | F-03 (+ required status checks on `main`) |
| [#200](https://github.com/salmoncow/citl/pull/200) | WS-1 truth reconciliation | F-11, F-12, F-13, F-14, F-31, F-32, F-33, F-34, F-35, F-36, F-38, F-57 |
| [#201](https://github.com/salmoncow/citl/pull/201) | WS-2 framework hygiene | F-16, F-17, F-18, F-37, F-41, F-42, F-43, F-61, F-62, F-63 |
| [#202](https://github.com/salmoncow/citl/pull/202) | WS-2 enforcement hook | F-19, F-20, F-39, F-40, F-59, F-60 |
| [#203](https://github.com/salmoncow/citl/pull/203) | WS-3 publish path | F-05, F-08 |
| [#204](https://github.com/salmoncow/citl/pull/204) | WS-3 blend + boundary | F-02, F-09 |
| [#205](https://github.com/salmoncow/citl/pull/205) | WS-3 rules | F-53, F-55 |
| [#206](https://github.com/salmoncow/citl/pull/206) | WS-3 escaping | F-07, F-23 |
| [#207](https://github.com/salmoncow/citl/pull/207) | WS-3 propagation | F-25, F-30, F-47, F-48, F-51 |
| [#208](https://github.com/salmoncow/citl/pull/208) | WS-3 announcements | F-24 |
| [#209](https://github.com/salmoncow/citl/pull/209) | WS-3 cascade tests | F-29 *(partial — repository cascades tested + coverage measurable; UI components remain untested, tracked for WS-4)* |
| [#211](https://github.com/salmoncow/citl/pull/211) | WS-4 no-cache shell (WS4-04) | F-04 *(follow-up [#216](https://github.com/salmoncow/citl/pull/216) extended no-cache to the `/` path)* |
| [#212](https://github.com/salmoncow/citl/pull/212) | WS-4 CSS split (WS4-06) | F-22 |
| [#213](https://github.com/salmoncow/citl/pull/213) | WS-4 lint gate (WS4-05) | F-28 |
| [#214](https://github.com/salmoncow/citl/pull/214) | WS-4 composition root (WS4-01, spec 003 PR-1) | F-01 |
| [#215](https://github.com/salmoncow/citl/pull/215) | WS-4 score-service split (WS4-02, spec 003 PR-2) | F-21 *(file accepted at 749 lines — see backlog FU-02 for the optional API-splitting follow-up)* |
| [#220](https://github.com/salmoncow/citl/pull/220) | Feature 004 season awards (WS5-02 — maintainer decided **finish**, not delete) | F-26 *(finished: placements computed from final standings, shape reconciled to the flat prod `SeasonAwards`, `startingAvg ≥ 50` NaN edge guarded, admin Season End preview→finalize flow computing from published week docs, historical awards displayed per selected season on Home; backfill closed — prod 2019–2025 already populated, verified 2026-07-12. `validateFirebaseConfig` remains in WS-5 sweep scope)* |

**Still open** (tracked in [backlog.md](backlog.md)): the WS-5 P3 sweep (F-44–F-46, F-49, F-50, F-52, F-54, F-56, F-58, plus the F-15 archive-lifecycle remainder and the `validateFirebaseConfig` half of F-26's finding text) and the two post-WS-4 follow-ups appended to the backlog 2026-07-12 (FU-01 standings-derivation unification per spec 003 DD-4; FU-02 optional score-service API split per spec 003 Open Question 1). F-63's meta-consolidation landed in #201; anything not listed above is open.

---

## 1. Executive Summary

This is a healthy codebase with an unhealthy narrative about itself. The core engineering — a cleanly layered no-framework SPA, a genuinely pure scoring engine, tight Firestore rules with deny-path-dominant tests, defense-in-depth Cloud Functions, and an unusually strong security-header posture — is better than hobby-site norm, and the refutation pass confirmed that repeatedly (zero findings were refuted outright; nine were downgraded, none dismissed). The problems cluster in five cross-cutting themes:

**Theme 1 — The single source of truth is no longer true.** The constitution (v1.5.0, the mandatory-read #1 for every agent session) still says the site is pre-launch on AWS with DNS not cut over, and that a "permanent" static-JSON scorecard layer is "never replaced by Firestore" — both inverted from reality since February–May 2026 (F-11, F-12). Every countable inventory metric is stale (F-34), four ADRs describe files and follow-ups that no longer exist (F-35), and the technical specs for CI/CD and the Firestore schema predate the RBAC epic that rewired both (F-13, F-14). The documentation is bimodal by age: everything touched after 2026-05-28 is accurate; everything asserting "current state" from before has drifted.

**Theme 2 — Rules and facts are hand-duplicated, and the copies have already drifted.** The prior-average blending rule lives in two hand-synchronized code copies (F-02); the forbidden-pattern ruleset lives in six locations with four measured divergences (F-40); Firebase quota figures live in five places, twice inside the constitution itself (F-38); the @scoring agent restates 62% of its authoritative spec and has drifted into a factual error about the bonus cap (F-17); HTML escaping has two half-duplicate implementations, both quote-blind (F-06). In an agentically maintained repo, duplicated rule text is the single largest latent-P0 generator found.

**Theme 3 — The guardrail layer was built, then never wired to bind.** The constitutional hook always exits 0, emits output the agent never sees, greps for a Firestore call shape the codebase never uses, and isn't even committed to the repo (F-19, F-20, F-39, F-59, F-60). The @speckit STOP-gate protocol targets directories deleted in April 2026 (F-16), `/implement` cannot resolve the repo's flagship directory-style spec (F-18), and the agents lack the frontmatter that would scope their tools (F-41). Enforcement exists as narrative, not mechanism — and the 1,079-line god file that grew under the hook's watch proves it (F-21).

**Theme 4 — The Firestore boundary and the identity model are trusted, not validated.** Repository reads are double-cast with zero shape validation and no rules-side field checks (F-09); `teamId` is re-derived by slugifying a mutable display name instead of using the document ID (F-08); shooter matching is exact-string in the publish path but normalized everywhere else (F-51); and re-publishing an earlier week silently rewinds public standings (F-05). This is the silent-wrong-standings failure class — the worst kind for a league site.

**Theme 5 — Nothing gates the production deploy.** No build is required pre-merge anywhere: ci.yml has no build job, the Functions tsc build never runs before the production deploy job, dependabot majors bypass the only PR-time vite build and one (vite 7→8) already merged unverified, deploy-production has no dependency on CI, and branch protection requires zero status checks (F-03). The shipped XSS sanitizer fix has no regression test (F-10), there is no linter despite eslint-disable comments implying one (F-28), and the entire UI/repository layer is untested (F-29).

**What is done well** deserves equal billing: the repository/service/engine layering with constructor injection is why 203 unit tests run without emulators; the rules test suite proves the role-escalation deny matrix exhaustively; setUserRole is textbook (App Check, owner claim, Zod, last-owner guard, transactional rate limiting); the admin-tabs refactor is a model component pattern; and the ADR log is the healthiest artifact of its kind the reviewers had seen in a solo repo.

### Finding counts by severity (post-refutation, final)

| Severity | Count | Notes |
|----------|-------|-------|
| P0 | 0 | Nothing requires a same-day fix |
| P1 | 13 | F-01, F-02, F-03, F-05, F-08, F-09, F-10, F-11, F-12, F-16, F-17, F-19, F-20 |
| P2 | 28 | Scheduled debt; several are one-line fixes |
| P3 | 22 | Opportunistic cleanup |
| **Total** | **63** | 54 CONFIRMED, 9 DOWNGRADED, 0 REFUTED, 0 UNVERIFIABLE |

---

## 2. Findings by Severity

Only CONFIRMED and DOWNGRADED findings appear here. Severities are final (post-refutation). Each entry: claim, evidence, impact, refuter verdict + note, fix sketch, effort.

## 2.1 P1 Findings

---

### F-01 — Seven private ScoreService instances; write-invalidation only ever reaches one cache
**Dimension**: architecture · **Merged from**: A1-01, A2-04, A3-04 · **Seed**: SEED-A3 · **Effort**: M

**Claim**: There is no composition root or written component contract: seven components each construct a private module-level ScoreService (7 independent 1-hr caches), so admin writes invalidate only the admin-panel's cache and the admin's own session shows stale standings/announcements on public views for up to 1 hour after publishing. The cost dimension of SEED-A3 is refuted at this site's scale — this is a correctness/staleness and hygiene problem, not a quota threat.

**Evidence**: Module-level singletons in home-standings.ts:16-17, home-announcements.ts:15-16, site-banner.ts:13-14, season-scorecards.ts:15-16, season-calendar.ts:24-25, scoresheet-generator.ts:16-17, admin-panel.ts:31-32 — each does `createRepositoryFactory({ db })` + `new ScoreService(...)`. publishWeek invalidation (score-service.ts:261-264) touches only `this.cache` — the admin-panel instance; CACHE_TTL_MS = 1 hr (:18). The hash router swaps innerHTML without reload (main.ts:210-214), so module singletons live for the tab lifetime. Admin tabs correctly share admin-panel's instance via constructor injection (admin-panel.ts:44-46) — proving the right pattern exists. Measured reads ~40/cold home view; at 30 full visits/day ≈ 9% of the 50k read quota — quota threat refuted.

**Impact**: The admin publishes Tuesday-night scores, clicks Home to verify, and sees *last* week's standings and a week dropdown missing the new week for up to an hour unless they hard-reload; same for a fresh announcement. Any member with a long-lived tab sees the same staleness. Every new component copies whichever generation an agent opens first, so divergence compounds.

**Refuter**: CONFIRMED — Independently reproduced all 7 construction sites and the instance-local invalidation; grep for dispatchEvent/CustomEvent/location.reload across src/ returns nothing, so no cross-component invalidation signal exists. The admin-verifies-publish-and-sees-stale scenario is real whenever the home caches were warmed within the prior hour. Quota-refutation half consistent with the single-bundle cache-first design.

**Fix sketch**: Add a ~30-line composition root (`src/services/app-services.ts` exporting a lazily-built `getServices()` with one factory + one ScoreService); components import it; admin-tab constructor injection stays. Write the component contract down (shared service, innerHTML only for static markup, disconnectedCallback teardown, skeleton→data→error states) and migrate the five older components mechanically.

---

### F-02 — buildPriorAvgMap re-implements the starting-average blend rule instead of calling computeShooterAverage
**Dimension**: architecture · **Merged from**: A1-03, B1-04 · **Seed**: SEED-A2 · **Effort**: M

**Claim**: buildPriorAvgMap in score-service.ts re-implements the scoring-engine's starting-average blending rule inline instead of calling computeShooterAverage — with edge divergences on zero-startingAvg handling, cross-team accumulation, and rounding + dummy-shooter inclusion — so the "Mirror" comment overstates the sync and a future engine edit forks the rule silently.

**Evidence**: score-service.ts:1004-1010 inlines the `< 2 weeks` blend under a `// Mirror computeShooterAverage` comment; the canonical rule is scoring-engine.ts:125-134. Output feeds next-season startingAvg/rookie determination (computeRosterDefaults :366-377, computeShooterDefaults :403-412, buildScorecardData :452-453). Edge differences: zero-startingAvg → 35 (:984), name-keyed cross-team accumulation (:994-996), `parseFloat(avg.toFixed(1))` (:1011), no isDummyName filter (:992).

**Impact**: Next-season startingAvg drives handicap yardage, rookie detection, and bonus points. Any future edit to the engine's blend that misses score-service.ts:1004 passes all scoring-engine tests while silently forking starting averages and rookie flags for every returning shooter — wrong bonus points, the exact latent-P0 drift class in an agentic repo.

**Refuter**: CONFIRMED, with a framing correction — the edge divergences are *intentional* adaptations, not accidental drift (score-service.test.ts:148-156 explicitly pins startingAvg:0→35 as corrupt-data handling), so "drift is ALREADY live" was overstated. But the core P1 mechanism survives intact: the business rule is duplicated, and buildPriorAvgMap's tests pin the *copy*, not equivalence with the engine — a future engine change passes every suite while silently forking next-season averages.

**Fix sketch**: Refactor buildPriorAvgMap to accumulate per-shooter (startingAvg, scores[]) and delegate the final number to computeShooterAverage, deleting the inlined arithmetic and the "Mirror" comment; then move buildPriorAvgMap (pure, no I/O) into scoring-engine.ts, resolving the three intentional edges explicitly in one place.

---

### F-03 — No pre-merge build gate anywhere; deploy-production ungated by CI; dependabot bypasses the only PR-time build
**Dimension**: architecture · **Merged from**: A3-01, B3-04 · **Seed**: NEW · **Effort**: S

**Claim**: Neither the production Vite build nor the Functions tsc build ever runs pre-merge in ci.yml (and the Functions tsc build runs pre-merge nowhere at all), and the only PR-time build (deploy-preview, not a required check) is explicitly skipped for dependabot — so the PRs most likely to break the build (vite/esbuild major bumps, which already merged unverified) compile for the first time during the production deploy job, where a failure blocks hosting, rules, AND functions from shipping. deploy-production also has no dependency on CI, so a test-failing commit on main still deploys.

**Evidence**: ci.yml has exactly four jobs (typecheck, test, test-rules, test-functions) — no `npm run build`, no functions tsc; root typecheck covers only `src/**/*` (tsconfig.json:23); functions tests import TS source via vitest transpile without typechecking (tests/functions/_helpers.ts:67). deploy-preview.yml:12 skips dependabot. Commit ee7e229 (dependabot) bumped vite 7.3.2→8.0.16 — a major merged with zero build verification. deploy-production.yml triggers on push to main with no needs/workflow_run gate.

**Impact**: A green dependabot major (or any functions type error — all four CI jobs pass it) breaks the pipeline post-merge; any rules or Functions fix queued behind it cannot deploy until repaired. Independently, a test-failing commit on main still deploys to production.

**Refuter**: CONFIRMED, and strengthened — verified via gh api (read-only) that main's ruleset (id 13744523) contains only deletion/non_fast_forward/pull_request rules, NO required status checks, so even existing CI jobs are not required to pass before merge. Minor mitigation: vitest exercises vite's dev-transform pipeline, giving partial incidental coverage of a vite major, but the production rollup/terser path is genuinely never run pre-merge.

**Fix sketch**: Add a build job to ci.yml (`npm run build` — succeeds without VITE_ secrets — plus `npm --prefix functions run build`); mark all jobs as required branch-protection checks or gate deploy-production on CI; optionally add a concurrency group to deploy-production.

---

### F-05 — Re-publishing an earlier week silently rewinds public standings and currentWeek
**Dimension**: implementation · **Merged from**: A1-02, B1-01 · **Seed**: NEW · **Effort**: M

**Claim**: Re-publishing an earlier week (a supported UI flow and the natural correction path) silently rewinds season standings and currentWeek to that week, because publishWeek overwrites season.standings computed only through the selected week — and season standings have three divergent derivation paths (publishWeek from entries, deleteTeam from stored week docs, home-standings client-side sums) that can user-visibly disagree.

**Evidence**: score-service.ts:253-259 writes `{ currentWeek: weekNumber, standings, status: 'active' }` unconditionally; _computeStandings (:1056) sums only `wi < throughWeek`; the admin week selector allows any week 1–15 with no warning (score-entry-tab.ts:51, :84). home-standings.ts:104-116 builds its week dropdown 1..currentWeek, so a regressed currentWeek hides already-published later weeks. Divergent path 2: deleteTeam recomputes standings from stored week docs without re-ranking (_recomputeStandingsFromWeeks :1021-1048). Path 3: home-standings sums stored week docs client-side (:174-199).

**Impact**: Season at week 5; admin fixes a week-2 entry and hits Publish on week 2 (the toast even says "standings updated"): the public home page now shows standings through week 2 only and weeks 3–5 vanish until the admin republishes week 5. Separately, after a mid-season deleteTeam, "Week N" and "Season" views can show different totals. League members see wrong standings with no error.

**Refuter**: CONFIRMED — all three derivation paths reproduced. The only related test (score-service.test.ts:1044-1056, "currentWeek equals the published weekNumber") actually *pins the buggy overwrite* rather than guarding against rewind; no rules-side or UI-side guard exists.

**Fix sketch**: In publishWeek, write `currentWeek: max(existing.currentWeek ?? 0, weekNumber)` and always compute standings through that max week (entries for all weeks are already fetched). Longer term, pick one derivation: on any publish, rewrite all affected week docs 1..maxWeek from the same computeSeasonTotals pass so stored weeks and season.standings can never disagree.

---

### F-08 — publishWeek re-slugifies the current team name into teamId, breaking the schema contract after a rename
**Dimension**: implementation · **Merged from**: B1-02 · **Seed**: NEW · **Effort**: S

**Claim**: publishWeek derives teamId by re-slugifying the CURRENT team name (`teamId: _slugify(team.name)`, score-service.ts:237) instead of using the team document ID, so after a team rename every later week doc carries a teamId that no longer matches the team doc — violating the documented schema contract and corrupting three downstream consumers.

**Evidence**: .specs/technical/firestore-schema.md:124 says teamId "Matches teams/{teamId} document ID"; updateTeamMeta keeps the doc ID and cascadeTeamRename patches only teamName, never teamId (score-repository.ts:291, :301-304). Consumers keyed on teamId: deleteTeam filters (:367, :380); _recomputeStandingsFromWeeks accumulator (score-service.ts:1025); scoresheet-generator match (:160).

**Impact**: After a mid-season rename: (a) deleting that team later leaves ghost teamResults/standings rows; (b) deleting ANY team splits the renamed team into two standings rows on the public home page; (c) printed scoresheets compute going-in averages missing all post-rename weeks — wrong handicaps at the range.

**Refuter**: CONFIRMED, end-to-end — additionally found home-standings' captain lookup (teamCaptainMap keyed by t.id, home-standings.ts:134-136, :147, :191) breaks the same way. No test, comment, or cascade path mitigates a mid-season rename.

**Fix sketch**: In publishWeek, resolve teamId from the fetched Team doc (lookup by name against teamsResult.data, using `.id`) instead of `_slugify(team.name)`; optionally extend cascadeTeamRename to also normalize teamId in existing week docs.

---

### F-09 — The Firestore boundary is fully trusted: double-casts, no shape validation, and a no-throw contract that throws
**Dimension**: implementation · **Merged from**: B1-03 · **Seed**: SEED-B1 · **Effort**: M

**Claim**: Five `as unknown as` double-casts plus plain casts, zero shape validation in repo or firestore.rules — a malformed doc produces silently wrong standings (string totals string-concatenate through the scoring engine) or an uncaught throw that violates the service's documented no-throw contract and wedges the publish button.

**Evidence**: score-repository.ts:131, 148, 168, 201, 215; firestore.rules:74-78 has no field validation for entries/weeks. Silent path: `total: "42"` flows into _buildSeasonData (score-service.ts:769) → computeTeamTargets (scoring-engine.ts:145 `sum + score`) string-concatenates; computeRankPoints sorts NaN comparisons — standings publish without error. Throw path: an entry missing `shooters` throws at score-service.ts:206 inside publishWeek (no try/catch despite the header contract "never throws across module boundaries", :7); score-entry-tab.ts:389-391 leaves the button stuck on "Publishing…".

**Impact**: Any manually edited doc, import-script drift, or future admin surface writing a slightly wrong shape turns into published wrong standings with no error. Trigger today requires out-of-band writes (UI validates 0–25), so latent rather than active.

**Refuter**: CONFIRMED — both paths reproduced by reading the code. buildPriorAvgMap DOES typeof-check totals (:993) but the publish path does not. Matches the review rubric's explicit P1 example verbatim.

**Fix sketch**: Add a small runtime validator (plain TS guard functions, no new deps) at the repository boundary for SeasonEntry/WeekResult/Team — check shooters is an array and total is a finite number, returning `failure('MALFORMED_DOC')` otherwise; wrap ScoreService.publishWeek body in try/catch returning failure.

---

### F-10 — The shipped stored-XSS fix in renderMarkdown has zero regression tests
**Dimension**: implementation · **Merged from**: B3-01 · **Seed**: NEW · **Effort**: S

**Claim**: The stored-XSS fix in renderMarkdown (commit c11b79a) has zero regression tests, so any future change to src/utils/markdown.ts — e.g. a dependabot marked/dompurify major bump or an agent "simplifying" the util — can silently reintroduce script injection on the public homepage with all suites staying green.

**Evidence**: src/utils/markdown.ts is 10 lines: `DOMPurify.sanitize(marked.parse(raw) as string)`. Commit c11b79a's message documents a live `<img src=x onerror>` payload path. Output is injected via innerHTML on the public homepage (home-announcements.ts:66). No test file anywhere touches markdown.ts.

**Impact**: Latent-P0 generator: an agent bumping majors or refactoring can drop the sanitize wrapper with all 203 unit tests, 45 rules tests, typecheck, and CI staying green — re-shipping stored XSS to every homepage visitor via admin-authored announcements.

**Refuter**: CONFIRMED — file has exactly two commits; only 11 test files exist, none touching markdown.ts; no jsdom-based test could cover it today; dependabot is active in this repo.

**Fix sketch**: Add src/utils/markdown.test.ts with `// @vitest-environment jsdom` (add jsdom devDep), asserting the exact payload class from c11b79a is neutralized (`<img src=x onerror=...>`, `<script>`, `javascript:` hrefs) plus the deliberate behaviors (images stripped, GFM breaks). ~30 lines.

---

### F-11 — Constitution §II.1 says the site is pre-launch on AWS; it has been live on Firebase since May
**Dimension**: documentation · **Merged from**: C1-01, C2-11 · **Seed**: SEED-C1 · **Effort**: S

**Claim**: Constitution §II.1 (v1.5.0, "Last Updated 2026-05-03") asserts the site is pre-launch on AWS/CloudFront with DNS not cut over — contradicted by CLAUDE.md and production-facing git history — and firebase-deployment.md still carries a full future-tense DNS-cutover section including a stale live-fire `terraform destroy` instruction, plus a wrong preview-channel URL pattern.

**Evidence**: constitution.md:80 "Active Users: 0 (pre-launch — still on AWS/CloudFront)"; :87 "DNS not yet cutover"; :92-93 "Hosted on AWS S3 + CloudFront (legacy)" under "Deployment Context (current)". CLAUDE.md:14 (2026-05-28): "The site is live at https://citl.club". Corroborating: prod App Check work 65b6809; live-season tie-breaker fix 49184f7/a047a85 (Jul 2026). firebase-deployment.md:399-431 future-tense cutover incl. `terraform destroy`; :357 wrong preview URL `citl--preview-*` (project is citl-baed2).

**Impact**: The constitution is the declared single source of truth and the data source for the /constitution dashboard every session starts with. Any agent orienting from it gets wrong risk calibration ("safe to break things, no users"), wrong CI/CD trigger state, and a direct CLAUDE.md contradiction forcing a guess about which doc wins; the terraform-destroy instruction targets infrastructure that presumably no longer exists.

**Refuter**: CONFIRMED — every quote reproduced. Partial mitigation: the §II.1 status table in the same section is current (CI/CD Active, Blaze, Functions deployed), so the doc is *internally contradictory* rather than uniformly pre-launch — which is exactly the rubric's named P1 case.

**Fix sketch**: Rewrite §II.1 Key Metrics + Deployment Context to reflect live production (Firebase Hosting only, AWS decommissioned), delete the DNS-cutover trigger in §II.2, bump constitution to 1.5.1; replace firebase-deployment.md's DNS Cutover section with a two-line historical note and fix the preview URL example.

---

### F-12 — Constitution and build spec describe a "permanent" static-JSON scorecard layer removed in February
**Dimension**: documentation · **Merged from**: C1-02, C2-07 · **Seed**: SEED-C2 · **Effort**: M

**Claim**: Constitution §II.1/§II.4/§II.5, ADR-003, and build-system.md all describe a "permanent" static-JSON scorecard data layer (`src/data/scorecards/*.json`, "never replaced by Firestore", "bundled at build time — no runtime fetch") that was removed on 2026-02-28 with no superseding ADR — an architecture description inverted from reality, re-affirmed in the 1.5.0 constitution two months after the reversal, with the ADR log pointing agents at ADR-003 as the canonical example.

**Evidence**: src/data/ does not exist; JSON deleted in c1274e1 (2026-02-28); scorecards Firestore-driven since 36114d0. Yet constitution.md:72, :135, :146-149 declare the layer permanent; ADR-003 Status "Accepted" and ADR-log :550-551 tells agents "ADR-003 explains why scorecard data is JSON, not Firestore". build-system.md:34, :188-189, :205 repeat the JSON-bundling story; :48 dead link to vite.config.ts; :3/:313 say Vite 7.x vs installed ^8.0.16.

**Impact**: An agent asked to touch scorecards would either recreate the static-JSON layer, refuse a Firestore approach as "constitutionally forbidden", or reason from "zero Firestore reads for the Scorecards page" which is now false.

**Refuter**: CONFIRMED — no mitigating text anywhere marks the JSON layer removed; grep for a superseding ADR finds only the template line. Inverted architecture in the single source of truth, read every session.

**Fix sketch**: Write ADR-010 superseding ADR-003 (scorecards Firestore-driven since phase-8), mark ADR-003 "Superseded by ADR-010", rewrite constitution §II.4/§II.5 to the single Firestore layer, fix the agent-guidance example at ADR-log ~:550; in build-system.md delete the src/data/scorecards, scorecards.js, downloads.js, and JSON-import passages, fix the vite.config link, and bump Vite references to 8.x.

---

### F-16 — prompt-gap-protocol.md is a mandatory STOP-gate for @speckit yet operationally unexecutable
**Dimension**: agent-framework · **Merged from**: C2-05, D3-01 · **Seed**: SEED-C6 · **Effort**: S

**Claim**: prompt-gap-protocol.md is mandatory reading and a STOP-gate for the @speckit agent (and wired into the constitution) yet is operationally unexecutable: its entire procedure targets the dismantled .prompts/core|platforms structure and a CLAUDE.md "When to Reference Which Prompt" section that does not exist — every @speckit session is fed 431 lines of instructions to consult and create files in directories deleted in April 2026.

**Evidence**: speckit.md:6 mandatory-reads the protocol; :29-30 "STOP and flag the gap per .prompts/meta/prompt-gap-protocol.md". Protocol step 1 (:24) checks a CLAUDE.md section that doesn't exist; gap-resolution mechanics (:120-176, :270-285) create files under core/ and platforms/firebase/ — `ls .prompts/` shows only meta/. Retirement commit ec69f96 (2026-04-12) claimed to update "all references" but missed this file and prompt-maintenance.md. Constitution wiring at :394, :399.

**Impact**: Every future @speckit invocation — the entry point of the documented feature workflow — loads broken procedure. When it hits a real guidance gap it will propose creating prompts in nonexistent directories, waste the session hunting phantom files, or silently skip the protocol.

**Refuter**: CONFIRMED — no superseded/historical disclaimer anywhere in the file (unlike speckit-integration-guide.md:8-11, which has one). Only mitigation found: constitution §V.2 carries a current 5-step distilled version — but its step 2 circularly points back to the broken file.

**Fix sketch**: Delete prompt-gap-protocol.md and replace its live intent with ~6 lines inside speckit.md (or ~20 lines in constitution §V.2): "If constitution/technical specs/global skills don't cover a decision, STOP, state what's missing, and ask whether to (a) add a constitution section, (b) add a .specs/technical/ doc, or (c) proceed with documented assumptions." Update the two inbound refs.

---

### F-17 — The @scoring agent duplicates 62% of its authoritative spec, and the copy is already wrong about the bonus cap
**Dimension**: agent-framework · **Merged from**: D1-01, D3-02 · **Seed**: SEED-D6 · **Effort**: S

**Claim**: The @scoring agent duplicates ~62% of its lines from the spec it declares authoritative, and the copy has already drifted wrong: its quick reference states a bonus-points cap of "max 2 total" contradicting both the spec's worked examples (max 7 = 5 target + 2 rookie) and the implementation — and both agent and spec omit the newly shipped standings tie-breaker rule.

**Evidence**: scoring.md:34 heading "Bonus Points (per team per week, max 2 total)"; spec example scoring-engine.md:77 "targetComponent=5, rookieComponent=2 → bonusPoints=7"; implementation caps only the rookie component (scoring-engine.ts:210-211) and sums to max 7 (:314-316). scoring.md lines 18-55 restate spec rules with zero net-new (~62% duplicated). The spec itself is stale (references scoring-engine.js, csv-parser.js — neither exists).

**Impact**: The @scoring agent's stated job is validating tests against business rules — a session leaning on its embedded quick reference would flag the correct bonusPoints=7 behavior as a bug, or "fix" tests/code toward a 2-point cap, producing user-visibly wrong standings.

**Refuter**: CONFIRMED — the "max 2" is a garbled hoist of the rookie-component cap. One evidence correction that does not change the verdict: the tie-breaker is NOT "only a code comment" — commit 49184f7 also documented it on the user-facing rules page and added unit tests; it is however absent from the authoritative spec and the agent, which is the load-bearing claim.

**Fix sketch**: Delete the "Critical business rules (quick reference)" block from scoring.md, keeping only mandatory-reading pointers, capabilities, and purity constraints; fix the "max 2 total" wording; add the standings points-tie-broken-by-targets rule to the spec so it has a single home; correct the spec's .js/csv-parser references.

---

### F-19 — The constitutional hook is unconditionally advisory and its output never reaches the agent
**Dimension**: agent-framework · **Merged from**: D2-02, D1-04 · **Seed**: SEED-D3 · **Effort**: S

**Claim**: The constitutional-compliance hook is unconditionally advisory (always exit 0) in contradiction of its own header contract, and its plain-text-on-stdout output never reaches the agent under Claude Code's PostToolUse feedback channels — a functional no-op for its stated audience, demonstrably never having changed an outcome (the 1,079-line god file grew under its watch).

**Evidence**: scripts/check-constitution.sh:51 `exit 0` unconditional; header line 7 claims exit-0-only-when-clean (never implemented); line 8 claims JSON output while :48 emits plain text via `echo -e`. Proof of non-enforcement: score-service.ts is 1,079 lines, so every edit fired the "Forbidden (§II.3): exceeds 750-line hard limit" message and the file stayed/grew. Also :11 depends on jq with no fallback.

**Impact**: The maintainer and every agent session believe (per CLAUDE.md "Automated guardrails") a compliance backstop exists; it does not bind, and its output is transcript-only — the entire enforcement layer is a silent no-op. Observed consequence: the god file.

**Refuter**: CONFIRMED — ran the script end-to-end against a crafted violating file: plain-text output, exit=0. score-service.ts grew under the hook (49184f7 added 16 lines, June 2026). The stdout-invisibility prong matches documented Claude Code hook semantics but is version-dependent; the verdict does not depend on it — unconditional exit 0 plus observed god-file growth independently establish the no-op.

**Fix sketch**: Decide the contract explicitly: emit hook JSON (`hookSpecificOutput.additionalContext` for warnings, `decision: block` or exit 2 + stderr for hard violations like >750 lines and `var`), update the header to match, grandfather current violators via an allowlist so the hook can be strict on new files; add a loud jq-missing guard.

---

### F-20 — The one quota-relevant automated guard greps for a call shape the codebase never uses
**Dimension**: agent-framework · **Merged from**: D2-01 · **Seed**: SEED-D3 · **Effort**: S

**Claim**: The hook's and /check skill's unfiltered-Firestore-read grep (`getDocs(collection(`) cannot match the query idiom this codebase actually uses (`getDocs(q)` on a pre-built query), so the one quota-relevant automated guard has ~zero detection power while CLAUDE.md tells agents the check exists.

**Evidence**: scripts/check-constitution.sh:33 and check/SKILL.md:20 grep `getDocs(collection(`. Every real read site builds a query first and calls `getDocs(q)` (score-repository.ts:84, 103, 147, 165, 214, 461; user-repository.ts:56) or bare refs (:296). Repo-wide, the grep matches exactly 1 line (a deliberate bounded scan at :357). Empirically verified that `getDocs(query(collection(db,'scores')))` does not match.

**Impact**: A future agent adding an unfiltered read via the repo's own idiom sails past hook, /check, AND reviewer silently — false assurance plus quota exposure against the constitution §VI.1 50k reads/day ceiling on a Blaze (real billing) plan.

**Refuter**: CONFIRMED — reproduced the 1-match grep and ran the hook against a file containing an unmatchable unfiltered read: no warning. Found the identical dead pattern in reviewer.md:26 as well, so all three advertised detection layers share the blind spot.

**Fix sketch**: Replace the string grep with a two-stage check: flag any `getDocs(` whose enclosing statement/file lacks a nearby `where(` AND `limit(`, or simpler, flag `getDocs(` in src/ and require an inline `// unbounded-ok: <reason>` annotation for deliberate scans. Apply the same fix to check/SKILL.md and reviewer.md.

---

## 2.2 P2 Findings

---

### F-04 — 1-hour cached index.html can reference deleted hashed bundles after a deploy
**Dimension**: architecture · **Merged from**: A3-02 · **Seed**: NEW · **Effort**: S · **DOWNGRADED (P1→P2)**

**Claim**: index.html is browser-cached for 1 hour (max-age=3600), but Firebase Hosting serves only the latest release, so after a production deploy a returning visitor's cached shell can request old hashed bundles that no longer exist — the SPA rewrite returns HTML for those .js URLs, yielding a blank page with a MIME-type error.

**Evidence**: firebase.json:55-60 (`**/*.html` → max-age=3600), :38-43 (`**` → /index.html rewrite), :46-52 (immutable 1y hashed assets). Live curl of citl.club confirms max-age=3600 on the shell.

**Impact**: A member who loaded citl.club within the hour before a deploy and reopens afterward can get a blank site until cache expiry or hard refresh — most plausible on Tuesday shoot nights.

**Refuter**: DOWNGRADED — the headline failure mode is mostly mitigated: a returning visitor's browser also cached the old hashed JS/CSS as immutable, so the old shell resolves its bundles from browser cache and yields a *working, up-to-1h code-stale* app (data still live from Firestore). The blank-page outage requires asymmetric cache eviction — possible under pressure but rare. Also verified zero dynamic imports, so no lazy-chunk-404 path. Remaining real cost: ~1h stale shell per deploy + a rare eviction-race blank page. Scheduled debt, not a per-deploy outage.

**Fix sketch**: Change the HTML header in firebase.json to `Cache-Control: no-cache` (one 304 per visit; index.html is ~4 KB). Keep the immutable asset policy.

---

### F-06 — escapeHtml is quote-blind and used in attribute position with any-Google-account-controlled data
**Dimension**: implementation · **Merged from**: A2-01, B2-03, A2-07 · **Seed**: NEW · **Effort**: S · **DOWNGRADED (P1→P2)**

**Claim**: escapeHtml does not escape quotes (and a second half-duplicate hand-rolled escaper in home-announcements shares the flaw), yet admin-users-panel interpolates a user-controlled displayName into a double-quoted attribute — so any signed-in Google account can inject attributes (including rendered style, via style-src 'unsafe-inline') into the owner's Users tab, one CSP relaxation away from stored XSS in the panel that grants admin.

**Evidence**: src/modules/ui.ts:5-9 (textContent→innerHTML trick escapes & < > but NOT quotes); admin-users-panel.ts:159 interpolates `escapeHtml(user.displayName)` into `aria-label="Role for ${display}"`. firestore.rules:20-33 lets any signed-in user self-create/update displayName. Second quote-blind escaper: home-announcements.ts:45-48.

**Impact**: Attribute injection into the privileged Users tab; CSP blocks inline handlers today, so current impact is UI redress/spoofing; any future CSP loosening or new attribute sink upgrades it.

**Refuter**: DOWNGRADED — mitigations confine the blast radius: `<` and `>` ARE escaped, so injection is limited to attributes on one existing element (no new elements; duplicate attributes ignored, so the earlier data-uid can't be overridden); CSP blocks inline handlers; escapeHtml is used in attribute context nowhere else. Marginal harm (restyle/autofocus of one's own row) is strictly less than F-27's identity spoofing, filed at P2 — consistency demands P2 here.

**Fix sketch**: Make escapeHtml a replacement-table function covering & < > " ' (drop the DOM trick), replace the hand-rolled copy in home-announcements with an import, add a unit test asserting quotes are encoded — or set aria-label via setAttribute and build user rows programmatically like team-management-tab.ts.

---

### F-07 — Three public components violate the documented textContent convention with Firestore-sourced names
**Dimension**: implementation · **Merged from**: A2-02, B2-02 · **Seed**: SEED-A6 · **Effort**: S · **DOWNGRADED (P1→P2)**

**Claim**: The documented innerHTML-static / textContent-user-data convention is real but violated: home-standings, season-scorecards, and scoresheet-generator interpolate Firestore-sourced team/shooter/captain names unescaped into innerHTML — a latent stored-XSS/defacement channel (injected `<style>` executes via style-src 'unsafe-inline') if an admin account is compromised, while the stated convention actively misleads future agent sessions.

**Evidence**: Convention stated at admin-panel.ts:14-15 and site-banner.ts:6 (and constitution.md:189, :269, forbidden pattern :335). Violations: home-standings.ts:228-229, :277-278; season-scorecards.ts:125, :136; scoresheet-generator.ts:171, :193-198, :218. Writers are owner/admin-only (firestore.rules:64-67).

**Impact**: A latent defacement channel on the public homepage if an admin Google account is compromised; the stated-but-violated convention misleads agents that grep the comment and assume compliance.

**Refuter**: DOWNGRADED on two mitigations — (1) a compromised admin can already deface standings *legitimately* through the same fields, so the style-tag channel adds little marginal capability (script XSS blocked by CSP); (2) the "mangles legal names" impact is narrower than claimed: HTML parsing treats `<`+non-letter and bare `&` as text, so "Team <3 Clay" and "Bucks & Does" render fine; only `<`+letter or accidental entity sequences mangle. Remains a real constitutional-forbidden-pattern violation across three public components.

**Fix sketch**: Route every interpolated name (~10-15 call sites) through the quote-safe escapeHtml (per F-06) at template-build time, or convert row builders to DOM+textContent like admin-tabs. Add the rule to the constitution's forbidden-pattern list so the hook can grep for `${` inside innerHTML templates fed by Firestore types.

---

### F-13 — cicd-pipeline.md materially misdescribes the current pipeline
**Dimension**: documentation · **Merged from**: C2-01 · **Seed**: NEW · **Effort**: S · **DOWNGRADED (P1→P2)**

**Claim**: .specs/technical/cicd-pipeline.md (Last Updated 2026-03-10) predates the Cloud Functions deploy, describes 2 CI jobs where 4 exist, claims CI needs no Firebase credentials, and lists a "minimum" IAM role set that cannot deploy what deploy-production.yml actually deploys.

**Evidence**: cicd-pipeline.md:21 vs deploy-production.yml:37 (`--only firestore:rules,firestore:indexes,functions` + separate hosting step); :41-44 "Two parallel jobs" vs four in ci.yml; :73-75 IAM lists only firebasehosting.admin + firebaserulesadmin — insufficient for functions; :143-146 branch-protection checks omit two job names. Commit c5bb405 (RBAC, ~2026-05) post-dates the doc.

**Impact**: An agent (or Tyler in six months) re-provisioning the deploy service account or reconstructing branch protection from this doc produces a CI that cannot deploy Functions and under-protected branches.

**Refuter**: DOWNGRADED — material mitigations: the workflows themselves are in-repo and are what any CI-touching agent reads; the sibling firebase-deployment.md (2026-05-04) correctly documents the Functions deploy and points at the firebase-deploy-runbook skill covering the exact IAM gotchas; an under-provisioned SA fails loudly at deploy. Harm requires a rare re-provisioning event that ignores three correct in-repo sources. Stale-mirror doc = P2.

**Fix sketch**: Update the workflow table, ci.yml job list, credentials note, and branch-protection check names; replace the IAM section with the actual role set for the full deploy target or link the firebase-deploy-runbook skill.

---

### F-14 — The "canonical" Firestore schema doc is missing four collections and asserts phantom indexes
**Dimension**: documentation · **Merged from**: C2-02 · **Seed**: NEW · **Effort**: M · **DOWNGRADED (P1→P2)**

**Claim**: firestore-schema.md, self-declared "the canonical reference", is missing four collections that exist in firestore.rules (users, audit, rateLimits, config) and asserts composite indexes that firestore.indexes.json (now deployed by CI) does not contain.

**Evidence**: firestore-schema.md:10-11 (canonical claim, dated 2026-03-10); firestore.rules matches /users (:20), /audit (:36), /rateLimits (:42), /config (:48) — none documented (landed with RBAC, post-doc). :41/:224-226 declare composite indexes; firestore.indexes.json is `{"indexes": [], "fieldOverrides": []}` and deploy-production deploys that empty set.

**Impact**: An agent implementing any user/RBAC/announcements-adjacent feature designs around a phantom index or collides with undocumented collections.

**Refuter**: DOWNGRADED — firestore.rules (the enforcement source) and indexes.json are in-repo and correct, and the 002-multi-user-rbac spec documents users/audit; additionally the code deliberately avoids the announcements index (score-repository.ts:459-463 filters then sorts in memory), so the doc misdescribes both config and code. The failure path requires trusting the stale doc over the code and rules the agent would also read. Materially stale canonical doc = P2.

**Fix sketch**: Add the four RBAC-era collections (shape, access, type locations); reconcile the index section with reality — either add the announcements composite index to firestore.indexes.json (and update the in-memory-sorting code) or correct the doc to state no composite indexes exist and why. Cross-check against firestore.rules.

---

### F-15 — Shipped features still presented as in-progress; the archive lifecycle has never executed
**Dimension**: documentation · **Merged from**: C2-03 · **Seed**: SEED-C5 · **Effort**: S · **DOWNGRADED (P1→P2)**

**Claim**: The shipped 002-multi-user-rbac feature is still presented as in-progress (spec "Approved — implementation in progress", tasks "Ready for implementation", 3 of 72 checkboxes done), and the documented spec lifecycle (archive after merge) has never been executed for any feature — dangerous because /implement defaults to "the most recently modified spec".

**Evidence**: spec.md:5, tasks.md:6, 3 [x] vs 69 [ ] — yet RBAC merged as PR #157 and Functions deployed 2026-05-04. Lifecycle rule at .specs/README.md:54; .specs/features/archive/ does not exist; scoring-engine.md (implemented long ago, still referencing nonexistent .js files) also sits active. WORKFLOW-GUIDE.md:44 documents the no-arg /implement default.

**Impact**: A future agent running /implement with no argument, or orienting on .specs/features/, sees two "ready/in-progress" specs that are actually shipped and can start re-executing a completed RBAC task list against production code.

**Refuter**: DOWNGRADED — the corruption path requires the unusual no-arg invocation, and step 1 of every task collides immediately with already-implemented code, so the session self-corrects with wasted turns rather than destructive edits. Real agent-mislead on stale status = P2.

**Fix sketch**: Mark both 002 files Status: Shipped (PR #157, 2026-05-04) and scoring-engine.md Status: Implemented; create .specs/features/archive/ and move them, making the documented lifecycle true — or drop the archive step from README/guide and make an explicit status header the lifecycle signal that /implement checks.

---

### F-18 — /implement cannot resolve the repo's only real completed feature spec
**Dimension**: agent-framework · **Merged from**: D1-02 · **Seed**: SEED-D2 · **Effort**: S · **DOWNGRADED (P1→P2)**

**Claim**: /implement's resolution rule constructs .specs/features/002-multi-user-rbac.md, which does not exist (the spec is a directory containing spec.md/tasks.md/bootstrap.md), and the speckit agent perpetuates the mismatch by writing flat files; the no-argument fallback silently selects the stale scoring-engine.md.

**Evidence**: implement/SKILL.md:9 resolves `<argument>.md`; ls shows the directory convention for 002; speckit.md:33 hardcodes the flat convention; the no-arg path (SKILL.md:10) selects scoring-engine.md — a stale spec referencing scoring-engine.js and csv-parser.js.

**Impact**: Any directory-style feature is unreachable by the documented workflow step '/implement <feature>'; an argument-less /implement executes against the wrong, stale spec.

**Refuter**: DOWNGRADED — SKILL.md step 1 (:15) explicitly handles the missing-file case ("list available specs and ask"), so `/implement 002-multi-user-rbac` degrades to a one-turn ask, not silent wrong execution; and the flat convention is internally consistent between author (speckit) and consumer (implement), so the documented workflow round-trips. The genuinely silent path (argument-less selection of the stale spec) is real but requires an undocumented invocation style. Convention drift + one narrow silent path = P2.

**Fix sketch**: In implement/SKILL.md, resolve `<argument>/spec.md` first, then `<argument>.md`, and make the no-arg fallback list-and-ask instead of guessing; update speckit.md step 4 to emit the directory convention (`<nnn>-<name>/spec.md` + `tasks.md`).

---

### F-21 — score-service.ts is a 1,079-line god file violating the repo's own 750-line hard limit
**Dimension**: architecture · **Merged from**: A1-04, B1-08 · **Seed**: SEED-A1 · **Effort**: M

**Claim**: score-service.ts is 1,079 lines — violating the constitutional 750-line hard limit — mixing cache plumbing, 18 copy-pasted year-validation guards, admin write orchestration, and ~370 lines of pure builder/standings functions; the same clone pattern shows in main.ts's six near-identical _showX route handlers.

**Evidence**: wc -l = 1,079; constitution.md:116 sets the 500 target / 750 hard limit; the hook flags it on every edit. The class spans :47-704; :706-1079 are module-level pure functions (_buildSeasonData, _buildScorecardTeamBlock, buildPriorAvgMap, _recomputeStandingsFromWeeks, _computeStandings). The `year < 2019 || year > 2100` guard is copy-pasted at 18 line numbers. main.ts:147-187 six near-identical handlers.

**Impact**: The single maintainer and every agent session work in a file the project's own guardrail flags as forbidden — normalizing hook noise and making the god file the template future agents extend. A valid-year policy change needs 18 synchronized edits.

**Refuter**: CONFIRMED — all 18 guard sites reproduced at exactly the cited lines; no exception/grandfather clause exists anywhere in the constitution; it is the largest source file by a wide margin (next is 589 lines).

**Fix sketch**: Three-way split: (1) score-service.ts keeps only the ScoreService class with assertValidYear/assertValidWeek helpers replacing the 18x guard (≤450 lines); (2) services/scorecard-builder.ts gets _buildSeasonData + _buildScorecardTeamBlock (~300 lines, pure); (3) scoring-engine.ts (or services/standings.ts) absorbs buildPriorAvgMap, _computeStandings, _recomputeStandingsFromWeeks. Collapse the main.ts _showX handlers into a data-driven route table.

---

### F-22 — main.css is a 2,182-line monolith shipping ~1,000 lines of admin-only CSS to every visitor
**Dimension**: architecture · **Merged from**: A2-05 · **Seed**: SEED-A5 · **Effort**: M

**Claim**: SEED-A5 confirmed on the numbers (main.css = 2,182 lines; score-entry-tab.ts = 589 lines) but only the CSS half is real debt — roughly 40% of the monolithic global stylesheet is admin-only UI shipped to every public visitor, with no ownership boundaries; score-entry-tab.ts is under the 750-line ceiling and cohesive, needing no action.

**Evidence**: main.css has ~25 banner-labeled sections; the admin block runs :872-1891 (~1,020 lines, ~47% of the file), with shared toast/dialog sections interleaved. No per-component CSS imports exist.

**Impact**: Agents append to the bottom; admin selectors can leak into public pages (class-name-disjoint today, but nothing enforces it); every visitor downloads admin CSS they can never render.

**Refuter**: CONFIRMED — measured the admin block boundaries precisely; agreed score-entry-tab.ts needs no action (over the 500 warn but under the 750 hard limit, cohesive coupling justified by its header).

**Fix sketch**: Split along the existing banner sections into src/styles/{tokens,base,nav,banner,layout,tables,buttons,forms,toast,admin,scoresheet,print}.css and import the list from main.ts (Vite bundles into one CSS asset — zero runtime cost). Optionally later: import admin.css from admin-panel.ts so Vite code-splits it out of the public payload.

---

### F-23 — Async select-change handlers have no re-entrancy guards; interleaved responses merge two teams' rosters
**Dimension**: implementation · **Merged from**: A2-03 · **Seed**: NEW · **Effort**: S

**Claim**: Interleaved responses in score-entry-tab can render the union of two teams' shooter rows, and Save then writes the merged roster under the currently selected team; the same unguarded pattern lets a stale year's response win in home-standings and season-scorecards.

**Evidence**: score-entry-tab.ts:100 fires `void this._populateShooterRows()` per team change with no cancellation; :166 clears tbody synchronously, :170 awaits getEntry (uncached — a real round-trip), then appends; two rapid switches leave both awaits in flight, both appending. _saveEntry (:281-317) harvests every `.ap-shooter-row` and saves under `teamSelect.value`. Same pattern: home-standings.ts:78-118, season-scorecards.ts:94-105.

**Impact**: An admin on a slow connection switching teams quickly sees doubled rows; Save writes another team's shooters into the selected team's draft — bad draft data feeding the publish pipeline (recoverable by re-save). Public year dropdown can show one year while the table shows another.

**Refuter**: CONFIRMED — verified getEntry is uncached so the await is a genuine race window; no generation counter, AbortController, or request-id anywhere in these components.

**Fix sketch**: Per-method generation counter (`const gen = ++this._populateGen;` before the await, `if (gen !== this._populateGen) return;` after) in _populateShooterRows, both _loadYear methods, and _loadSeasons. Three lines per site.

---

### F-24 — getAnnouncements is unbounded; the empty index file + `deploy --force` will delete console-created indexes
**Dimension**: implementation · **Merged from**: A3-03 · **Seed**: SEED-A7 · **Effort**: S

**Claim**: getAnnouncements is the codebase's only unbounded public Firestore query (where-only, no orderBy, no limit, sorted in memory), firestore.indexes.json is empty, and the CI deploy's --force flag will silently delete any composite index ever created through the Firestore console error-link flow.

**Evidence**: score-repository.ts:455-464; firestore.indexes.json:2 `"indexes": []`; deploy-production.yml:37 `firebase deploy --only firestore:rules,firestore:indexes,functions ... --force` (suppresses the delete-indexes confirmation).

**Impact**: The moment a query needing a composite index is added and the index is created via the console link (the natural flow), the next merge deletes it and the page starts erroring. The unbounded query also violates the constitution's own no-unfiltered-reads bar.

**Refuter**: CONFIRMED — one evidence overstatement corrected: not *every* other list query has a limit (cascadeTeamRename :287/:296 and deleteTeam :357 are unbounded admin cascade paths), but the public-read claim and the --force trap hold. No policy comment treats indexes.json as source of truth.

**Fix sketch**: Add `orderBy('postedAt', 'desc'), limit(20)` to getAnnouncements, declare the year+postedAt composite index in firestore.indexes.json, and add a comment noting --force deletes console-created indexes (indexes.json is the sole source of truth).

---

### F-25 — Result-monad discipline breaks in deleteTeam and removeShooterFromRoster: silent partial mutations return success
**Dimension**: implementation · **Merged from**: B1-05 · **Seed**: NEW · **Effort**: S

**Claim**: deleteTeam ignores the updateSeason Result entirely and silently skips standings recompute when the weeks read fails, and removeShooterFromRoster silently skips accolade cleanup when its weeks read fails — all while returning success.

**Evidence**: score-service.ts:500-505 (updateSeason return never checked; failed weeksResult falls through; `return result` at :507 reports success); :568-579 (accolade patches skipped on failure, success at :589).

**Impact**: Admin deletes a team, sees a success toast, but public standings still list the deleted team (or a removed shooter keeps 25-straight accolades) whenever a transient Firestore error hits the follow-up — silent partial mutation with no retry cue.

**Refuter**: CONFIRMED — one softener: deleteTeam's repository layer already filters standings in its batch (score-repository.ts:378-385), so that case is usually cleaned server-side; the recompute also re-derives totals though, and the accolade path has no backstop. Tests assert only result.success.

**Fix sketch**: Check and propagate both Results — return failure (or success-with-warning) when the cascade recompute cannot complete, so the admin UI can prompt a retry.

---

### F-26 — The season-awards pipeline is dead code that advertises completeness it does not have
**Dimension**: implementation · **Merged from**: B1-07 · **Seed**: SEED-B2 · **Effort**: M

**Claim**: validateFirebaseConfig is exported but never called, and the entire season-awards pipeline is dead in the app — computeSeasonAwards is imported nowhere outside its own tests, hardcodes all four team-placement fields to null, returns ComputedAwards whose shape differs from the Firestore-stored SeasonAwards, and divides by zero when startingAvg=50.

**Evidence**: grep: validateFirebaseConfig only at firebase-config.ts:35; computeSeasonAwards only in scoring-engine.ts and tests. Hardcoded nulls at scoring-engine.ts:483-487; computeMostImprovedScore (:414) → Infinity/NaN at startingAvg=50; nothing writes Season.awards; types/season.ts documents the shape mismatch.

**Impact**: A future agent asked to "show season awards" finds a tested, exported, official-looking function and wires it up, shipping null placements, a shape mismatch, and a NaN edge.

**Refuter**: CONFIRMED — reproduced all grep results, the null placements (including the empty-eligible branch :454-465), and the reachable divide-by-zero (a perfect 50 prior average).

**Fix sketch**: Either finish it (compute placements from standings, emit SeasonAwards shape, guard startingAvg>=50) or delete computeSeasonAwards/computeMostImprovedScore/validateFirebaseConfig and their tests, leaving a TODO in the spec.

---

### F-27 — Any signed-in user can rewrite their own displayName/email mirror — impersonation in the UI used to grant admin
**Dimension**: implementation · **Merged from**: B2-01 · **Seed**: NEW · **Effort**: S

**Claim**: firestore.rules lets any signed-in user rewrite their own users/{uid} mirror fields (email, displayName) that the owner's Users tab treats as identity, enabling impersonation in the exact UI used to grant admin.

**Evidence**: firestore.rules:29-31 allows self-update with any payload so long as role is absent/unchanged (pinned as intended by users.test.ts:117). The doc is seeded server-side with the real Google identity (onUserCreate.ts:42-51), but the only legitimate client write is touchLastSignIn (timestamps only) — so client-mutable email/displayName serves no feature. admin-users-panel.ts:151-172 renders these fields as row identity; :189 uses displayName in the owner's confirm dialog.

**Impact**: Any Google account holder can sign in, overwrite their mirror to mimic a known league member, and wait for the owner to promote "them" from the Users tab; downstream, admin can rewrite all scores/announcements.

**Refuter**: CONFIRMED — promotion targets the uid, not the name, and a ~dozen-member league owner may know everyone, but the spoof is precisely designed to exploit that trust. Self-create (:24) is also payload-unrestricted.

**Fix sketch**: Constrain self-update with `request.resource.data.diff(resource.data).affectedKeys().hasOnly(['lastSignInAt','updatedAt'])`; tighten or drop self-create (onUserCreate seeds the doc). Add rules tests for the rejected email/displayName self-edit.

---

### F-28 — No ESLint/Prettier config or lint job exists, yet source carries eslint-disable comments
**Dimension**: implementation · **Merged from**: B3-02 · **Seed**: SEED-B3 · **Effort**: S

**Claim**: No ESLint/Prettier configuration or lint script exists anywhere in the repo and CI has no lint job, yet source files carry eslint-disable comments referencing rules that never run.

**Evidence**: No eslint/prettier config files or deps (glob + grep confirm); ci.yml has exactly 4 jobs, no lint. Orphaned directives at src/infrastructure/appcheck.ts:33, :51, :69 and firebase-config.ts:52.

**Impact**: Constitution §III.5 code-quality rules are enforced only by the advisory grep hook; agents reading the eslint-disable comments reasonably assume a linter exists and self-report compliance that is never checked.

**Refuter**: CONFIRMED — all globs/greps reproduced.

**Fix sketch**: Flat config: eslint + typescript-eslint devDeps, ~25-line eslint.config.js (recommended rules, `no-console: ['error', {allow: ['warn','error']}]`, `no-var`) covering src/, functions/src/, tests/, scripts/; `"lint": "eslint ."` and a `- run: npm run lint` step in the existing CI typecheck job.

---

### F-29 — The entire UI/repository layer is untested and no coverage reporting makes the gap visible
**Dimension**: implementation · **Merged from**: B3-03 · **Seed**: SEED-B4 · **Effort**: M

**Claim**: SEED-B4 confirmed with a quality correction: the 203 unit + 45 rules + 15 functions tests are genuinely high quality (deny-path rules coverage is excellent), but the entire UI/integration layer — all 15 components, views, all 5 modules including auth, all 3 repositories, admin-user-service — has zero tests and there is no coverage reporting.

**Evidence**: Only 4 src test files (yardage 8, schedule 32, scoring-engine 107, score-service 56 it() blocks = 203); no tests under src/components, src/views, src/modules, src/repositories; no coverage config or @vitest/coverage-v8 dep. Counter-evidence to the seed's negative framing: users.test.ts:165-206 exhaustively tests the role-escalation DENY matrix; score-service tests pin regressions to bug numbers (#140, #141).

**Impact**: Top untested units by churn × complexity: score-entry-tab.ts (589 lines, the path where bad input becomes published standings); score-repository.ts (526 lines, cascade rename/delete multi-doc orchestration that can corrupt a season); main.ts route wiring; scoresheet-generator; auth.ts (the isAdmin gate).

**Refuter**: CONFIRMED — counts, absences, and the crediting counter-evidence all verified.

**Fix sketch**: Do not chase 80% — extract-and-test: score-repository's cascade rename/delete are the highest-value target (testable against the already-wired Firestore emulator using the existing tests/rules harness pattern). Add @vitest/coverage-v8 with a non-gating `test:coverage` script so the gap is measurable.

---

### F-30 — Two cache tests assert nothing about the cache; the constitution-mandated TTL cache is unverified
**Dimension**: implementation · **Merged from**: B3-05 · **Seed**: NEW · **Effort**: S

**Claim**: Two score-service tests named "clears the teams cache on successful deletion" assert nothing about the cache, and the constitution-mandated 1-hour TTL cache (§III.4 quota control) has no direct test of its hit or expiry behavior.

**Evidence**: score-service.test.ts:824-838 and :855-868 populate the cache then assert only `result.success` — deleting the cache.delete lines would not fail them. No two-calls-one-repo-hit test; no fake-timer TTL test. Contrast: the publishWeek test at :1117-1142 counts repo calls correctly.

**Impact**: The designated free-tier read control is effectively unverified, and the misleadingly-named tests give future agents false confidence that invalidation is regression-guarded.

**Refuter**: CONFIRMED — verified removing the cache.delete lines (score-service.ts:588, :493) would not fail the tests; no useFakeTimers anywhere in the file.

**Fix sketch**: Rework the two tests to count repo.getTeams calls across delete→getTeams like the publishWeek test; add one cache-hit test (two getTeams calls → 1 repo call) and one vi.useFakeTimers test advancing past CACHE_TTL_MS. ~40 lines.

---

### F-31 — Vite version, deploy-command comment, and Node runtime are misdocumented in the auto-loaded files
**Dimension**: documentation · **Merged from**: A3-05, C1-05 · **Seed**: SEED-A9 · **Effort**: S

**Claim**: CLAUDE.md, README.md, the constitution, and build-system.md all state Vite 7.x while the toolchain has been Vite 8.0.16 since 2026-06-12; CLAUDE.md documents `npm run deploy` as "build + firebase deploy --only hosting" while the script has deployed hosting + rules + indexes + Functions since 2026-05-03; and dev/CI run Node 24 while Functions execute on nodejs22 in production, so functions code is never tested on its runtime version.

**Evidence**: package.json:43 `"vite": "^8.0.16"` vs CLAUDE.md:14, README.md:7, constitution.md:300/:471, build-system.md:3/:313. CLAUDE.md:47 vs package.json:18 (deploy widened in 5ab19ba/c5bb405, before CLAUDE.md's last edit). firebase.json:10 nodejs22 + functions engines "22" vs .nvmrc 24 in the test-functions CI job.

**Impact**: The deploy comment understates the blast radius of the command by three targets — an agent running `npm run deploy` expecting hosting-only also ships security rules, indexes, and Cloud Functions.

**Refuter**: CONFIRMED — all three legs reproduced; the deploy-comment understatement is the sharpest edge since CLAUDE.md is auto-loaded into every session.

**Fix sketch**: Fix CLAUDE.md:47 to enumerate all four deploy targets (or point at a hosting-only script); one grep-driven "Vite 7"→"Vite 8" pass (or replace pinned versions with "see package.json"); note the intentional nodejs22 runtime beside the Node 24 dev requirement and optionally run the functions CI job on Node 22.

---

### F-32 — The authoritative scoring spec contradicts the shipped, tested engine on no-show rank points
**Dimension**: documentation · **Merged from**: B1-06 · **Seed**: NEW · **Effort**: S

**Claim**: The spec promises null rank points for non-participating teams, but computeSeasonTotals feeds 0 targets for no-shows so they always earn last-place points, and null rankPoints is unreachable — the spec even contradicts its own edge-case table.

**Evidence**: scoring-engine.md:93 and :145 (null promised) vs scoring-engine.ts:324 `weekTargets.push(anyoneShot ? targets : 0)` and scoring-engine.test.ts:765-768 ("no-show team in W2 (0 targets → rank 2 = 28)"). The spec's own edge-case table (:160) describes the code's behavior.

**Impact**: An agent told the spec is authoritative could "fix" the engine to emit null, changing every historical standing; alternatively, if the league rule really is no-points-for-no-shows, current standings over-credit absent teams weekly.

**Refuter**: CONFIRMED — the test suite locks current behavior, so a "fix" would see failures, but whether standings should credit no-shows is a genuine open business-rule question only the maintainer can settle.

**Fix sketch**: Confirm the league rule with the maintainer, then make the spec internally consistent (delete or reword lines 93/145 to match the forfeit row) so spec, code, and tests agree.

---

### F-34 — Constitution §II.1 inventory metrics wrong on every countable line; bundle figure 4.6x under
**Dimension**: documentation · **Merged from**: C1-03 · **Seed**: SEED-C2 · **Effort**: S

**Claim**: 4 components (actual 10 + admin-tabs/), 7 modules including a nonexistent standings-service, 2 repositories (actual 3), 4 types (actual 6), and §III.4's "~34 kB gzipped" bundle figure is ~4.6x under the current build.

**Evidence**: constitution.md:70, :82 (standings-service greps to nothing outside the constitution/ADR log), :83, :84, :246 vs measured dist bundle 161,133 B gzipped (~157 kB, still under the 250 kB target). Metrics block self-dates to 2026-03-10 inside a section headed "Last Updated 2026-05-03".

**Impact**: Agents sizing refactors or checking evolution triggers ("Testing: trigger at 10+ modules (currently 7)" — already crossed) reason from a four-month-old snapshot; the phantom standings-service sends agents hunting a file that never existed in the .ts era.

**Refuter**: CONFIRMED — every count independently reproduced, including the gzip measurement.

**Fix sketch**: One sweep over §II.1 + §III.4: recount from ls, delete standings-service, refresh the bundle figure, re-date the block. Consider replacing hard counts with "see src/ layout in CLAUDE.md" to end this class of drift.

---

### F-35 — Four ADRs carry stale present-tense facts: phantom files, an unsuperseded plan, a completed follow-up marked pending
**Dimension**: documentation · **Merged from**: C1-04 · **Seed**: SEED-C3 · **Effort**: S

**Claim**: ADR-001 (Spark plan, not marked superseded-in-part by ADR-009), ADR-004 ("firestore and stub backends", "standings-service.js"), ADR-006 ("csv-parser.js", "localstorage-score-repository.js"), ADR-009 ("admin-panel.ts is now a known violation (1781 lines)" — it is 232 lines with the refactor complete).

**Evidence**: decision-log.md:47-61, :210, :238-239, :311-313/:339, :540-542 vs Firestore-only factory, no such files, and wc -l admin-panel.ts = 232.

**Impact**: The log's header tells agents to check it before new architectural decisions; an agent doing so inherits a stub backend that doesn't exist, a refactor already completed, and a billing plan that changed — and could plausibly spawn the already-done admin-panel refactor.

**Refuter**: CONFIRMED — CLAUDE.md's key-files table partially corrects ADR-004 ("Factory: Firestore backend only"), but the present-tense "Current files"/follow-up passages stand. +1 mislead modifier on instructed reading = P2.

**Fix sketch**: Status/addendum sweep: mark ADR-001 "Superseded in part by ADR-009 (billing)"; add one-line "Status as of 2026-07" addenda to ADR-004/006; strike or check off the ADR-009 admin-panel follow-up. Do not rewrite historical Context/Decision sections.

---

### F-36 — .specs/README.md still instructs the removed /speckit-* command workflow
**Dimension**: documentation · **Merged from**: C2-04 · **Seed**: SEED-C4 · **Effort**: S

**Claim**: .specs/README.md is the one genuinely divergent workflow description — it instructs the removed /speckit-* command workflow and links two nonexistent docs — while CLAUDE.md, WORKFLOW-GUIDE.md, and speckit-integration-guide.md agree on the current agent-based workflow; the problem is one stale front door plus 4x duplication, not 4-way divergence.

**Evidence**: .specs/README.md:24, :48, :78-88 (full /speckit-constitution → /speckit-implement workflow; no such skills exist); dead links :98-99 (../AGENTS.md, ../.prompts/README.md); the tree omits firestore-schema.md and shows flat-file-only features.

**Impact**: An agent entering via the spec-kit's own README is instructed to invoke five slash commands that do not exist. Recoverable (auto-loaded CLAUDE.md is correct), hence P2 not P1.

**Refuter**: CONFIRMED — reproduced everything; AGENTS.md was renamed to CLAUDE.md in 4c3c70a.

**Fix sketch**: Nominate WORKFLOW-GUIDE.md as the canonical workflow description; rewrite .specs/README.md as a thin index that links it, fixes/removes dead links, adds firestore-schema.md to the tree, and documents the real hybrid feature-spec convention (flat file for small features, NNN-name/ directory for large ones).

---

### F-38 — Firebase quota figures hand-duplicated in five places, twice inside the constitution itself
**Dimension**: documentation · **Merged from**: C2-08 · **Seed**: SEED-C5 · **Effort**: S

**Claim**: Quota figures are duplicated in at least five places, and the hosting-limits table is duplicated under a wrong "(Spark Plan)" heading in a doc whose own header says Blaze.

**Evidence**: constitution.md:251-252 and again :414-415; speckit-integration-guide.md:223; architectural-evolution-strategy.md:183 and :443; firebase-deployment.md:307 "(Spark Plan)" vs :6 "Plan: Blaze".

**Impact**: When Google changes a quota or the plan posture shifts (it already did once, Spark→Blaze), five hand-copies must be found; any missed copy silently feeds a wrong budget number to the cost discipline agents are told to enforce.

**Refuter**: CONFIRMED — the drift risk is proven, not hypothetical: the Spark→Blaze shift already left the mislabeled heading behind.

**Fix sketch**: Constitution §VI owns the quota table once (delete the second internal copy); the other three docs replace figures with a link; retitle the firebase-deployment table "Usage targets (Spark-equivalent, on Blaze)".

---

### F-39 — The advertised hook wiring (.claude/settings.json) is gitignored and has never been committed
**Dimension**: agent-framework · **Merged from**: D1-03 · **Seed**: NEW · **Effort**: S

**Claim**: The constitutional-compliance hook advertised in CLAUDE.md is not in the repository at all: .gitignore excludes .claude/settings.json and it has never been committed, so the "automated guardrail" exists only on this one machine.

**Evidence**: .gitignore:79-80; `git ls-files .claude` returns only agents/ and skills/; git log for the file is empty. CLAUDE.md's framework table advertises the hook. The hook command is also the relative `bash scripts/check-constitution.sh` rather than $CLAUDE_PROJECT_DIR-anchored.

**Impact**: Any fresh clone, git worktree, CI runner, or second machine runs agent sessions with zero hook enforcement while CLAUDE.md says the guardrail exists. Claude Code convention is that settings.json (unlike settings.local.json) is the shared, committed tier.

**Refuter**: CONFIRMED — the .gitignore comment ("Claude Code user settings") is the closest thing to documented intent but directly contradicts CLAUDE.md's table; fresh worktrees (which this very tooling spawns) get no hook. The only softener: per F-19 the hook is advisory anyway — a severity interplay, not a refutation.

**Fix sketch**: Remove '.claude/settings.json' from .gitignore (keep settings.local.json ignored) and commit the hook config; anchor the command as `bash "$CLAUDE_PROJECT_DIR/scripts/check-constitution.sh"`.

---

### F-40 — The forbidden-pattern ruleset is hand-duplicated across six locations with four measured drifts
**Dimension**: agent-framework · **Merged from**: D2-03 · **Seed**: SEED-D4 · **Effort**: M

**Claim**: The ruleset is duplicated across constitution (x2), hook, reviewer agent, speckit agent, and /check skill, and has already drifted in at least four measurable ways, with no location aware of the others' coverage and the constitution unaware of which rules are machine-enforced.

**Evidence**: (1) size threshold — §IV.2:336 forbids ">500 lines" while §II.3 and all satellites use 750-hard/500-warn; (2) inline-handler event lists — reviewer/check grep 3 events, hook greps 5, and oninput/onkeydown/onmouseover match none; (3) innerHTML check absent from the hook entirely; (4) reviewer.md:35 invents check #12 appearing nowhere else, while §IV.2's "client-side filtering" appears in NO satellite. Constitution contains zero references to the hook. (See Appendix B for the full coverage matrix.)

**Impact**: Every rule change must be applied in six places; the observed 500-vs-750 and handler-list drift proves it's already failing. An agent reading only reviewer.md audits a different ruleset than one reading check/SKILL.md.

**Refuter**: CONFIRMED — all four drift items independently reproduced; a 600-line file is "forbidden" by one constitution section and merely a warning by five other locations.

**Fix sketch**: Single-source it: a machine-readable ruleset (scripts/forbidden-patterns.json: id, constitution ref, severity, detector, scope, enforced-by) that check-constitution.sh iterates; /check invokes the same script with --changed; speckit.md/reviewer.md/CLAUDE.md reduce to pointers; §IV.2 gains an Enforced-by column.

---

### F-41 — All three agent files lack YAML frontmatter: no delegation description, no tool restriction, no model pin
**Dimension**: agent-framework · **Merged from**: D1-05 · **Seed**: SEED-D1 · **Effort**: S

**Claim**: speckit.md, reviewer.md, and scoring.md have no frontmatter, so none can declare a description (delegation trigger), restrict tools, or pin a model — the agents, if they load at all, inherit the full toolset including Firebase MCP deploy and Firestore write/delete tools.

**Evidence**: All three open at line 1 with prose; every SKILL.md carries proper frontmatter (the maintainer knows the convention). Claude Code subagent definitions carry name/description/tools/model in frontmatter; with none present there is definitionally no tool allowlist.

**Impact**: The reviewer agent — whose entire job is read-only audit — can run firebase_deploy or firestore_delete_document if it hallucinates a "fix"; or the agents may simply not register, making the documented 6-step workflow silently fall back to the main agent improvising.

**Refuter**: CONFIRMED — textual evidence fully reproduced; the Firebase MCP plugin with live write/deploy tools is present in this environment. The registration-failure prong appropriately hedged (not runtime-verified); either failure mode is a real defect.

**Fix sketch**: Add frontmatter to each: name, a trigger-worthy description, tools (reviewer: Read/Grep/Glob/read-only Bash; scoring: Read/Grep/Bash; speckit: plus Write scoped to .specs/), optional model pin. ~10 lines per file.

---

### F-42 — Constitution §VII.1's skill roster lists a phantom skill and omits the load-bearing one
**Dimension**: agent-framework · **Merged from**: D1-06, D3-04 · **Seed**: SEED-D5 · **Effort**: S

**Claim**: §VII.1 lists 'firebase-best-practices', which does not exist in ~/.claude/skills/, and omits 'firebase-deploy-runbook', which exists and is load-bearing in speckit.md's hard constraints — with the same phantom skill cited three more times in speckit-integration-guide.md and once in evolution-strategy.

**Evidence**: constitution.md:456-459 vs ls ~/.claude/skills/ (11 skills, no firebase-best-practices; firebase-deploy-runbook present, required by speckit.md:79, cited 5+ times in firebase-deployment.md). Phantom echoes: speckit-integration-guide.md:91, :117, :480; evolution-strategy.md:204.

**Impact**: Agents directed to rely on a skill that can never auto-activate get no query-pattern guidance and may hallucinate it; conversely the deploy-runbook knowledge that prevents real deploy failures (IAM propagation, invoker bindings, API-key referrer gotchas — which bit this project before) is undiscoverable from the constitution.

**Refuter**: CONFIRMED — no doc marks the phantom as historical; the guide's :8-11 disclaimer covers only .prompts/core|platforms references, and these citations were post-migration content, i.e., wrong when written.

**Fix sketch**: Correct §VII.1 to the actual skills (or replace the hand-list with "see `ls ~/.claude/skills/`" plus the 2-3 project-critical ones: firebase-deploy-runbook, firebase-cost-resilience, firebase-security) and fix the three guide references plus evolution-strategy:204.

---

### F-43 — speckit-integration-guide.md documents a governance regime that never materialized
**Dimension**: agent-framework · **Merged from**: D3-05, C2-10 · **Seed**: SEED-D7 · **Effort**: M

**Claim**: The 567-line guide — the doc .specs/README.md points to as "full documentation" — documents governance whose observable practices never happened (0.5% of commits cite constitutional compliance vs its 80% success metric; the archive lifecycle never executed) and carries residual stale facts: the phantom skill, omission of firebase-deploy-runbook, a flat-file-only spec convention contradicting the real 002 directory, a dead git-best-practices path, and a 'citl-static/' project-root label.

**Evidence**: §VIII.1 (:393-396) claims "80%+ of commits cite constitutional compliance"; measured 3 of 635 commits. Archive lifecycle (:258, :351-357) never ran. :53 'citl-static/'; :61-62 flat-file convention; :91/:117/:480 phantom skill. Inbound refs: only .specs/README.md — no agent or skill loads it.

**Impact**: An agent auditing "are we following our process" gets false checkmarks and dead conventions; the guide is the primary carrier of the phantom-skill and flat-spec conventions other findings trace. Aspirational ceremony, not operational framework.

**Refuter**: CONFIRMED — one partial mitigation: the guide's own :8-11 disclaimer excuses the :141 git-best-practices dead link as marked-historical; the phantom skills, unexecuted lifecycle, false metrics, and stale conventions are post-migration content the disclaimer does not cover.

**Fix sketch**: Fold the ~60 genuinely-live lines (the what-goes-where boundary table §I.1, the 7-step workflow already in CLAUDE.md, precedence rule §X) into .specs/README.md, then delete or drastically slim the guide; if kept, correct the skills list, document the hybrid flat/directory convention, fix the git-best-practices line, and absorb the distilled gap protocol (F-16).

---

## 2.3 P3 Findings

---

### F-33 — Constitution §III.1 misdescribes the current testing state · documentation · S · DOWNGRADED (P2→P3)
**Claim**: §III.1 omits the 45 rules tests and 15 functions tests that run in CI, its integration-testing adoption trigger has already fired (site live, 15+ modules), and the promised coverage targets are unmeasurable (no coverage tooling).
**Evidence**: constitution.md:166 "Current state: Vitest unit tests for pure business logic functions"; :178 trigger fired; targets ("Overall: ≥80%") future-conditional; no coverage provider.
**Impact**: Agents doing test-strategy work under-credit existing suites and treat the fired trigger as un-fired.
**Refuter**: DOWNGRADED — the same constitution's §II.1 table (2026-05-03) explicitly lists the rules matrix and function tests as Active two sections earlier, so "agents will rebuild the suites" doesn't survive; what remains is one-section internal staleness. Cosmetic = P3.
**Fix**: Rewrite §III.1 current-state to enumerate the three real suites and their CI jobs; mark the trigger fired or replace the aspirational 80% with the actual bar; wire @vitest/coverage-v8.

### F-37 — prompt-maintenance.md is a dead 358-line enterprise process doc · documentation · S · DOWNGRADED (P2→P3)
**Claim**: It maintains a prompt library that no longer exists — checklists name ten files not in the repo, the quarterly review has been overdue since 2026-03-08, it prescribes team ceremony (Slack/Discord notifications) for a solo maintainer, and it contradicts the integration guide on cadence — yet the constitution still links it as live guidance (:467).
**Refuter**: DOWNGRADED — the rubric's literal "orphaned doc": its own git history (single import commit) proves the process never ran; the claimed harm requires invoking a ritual with zero historical invocations. The real gap it gestures at (no maintenance checklist for the docs that DO drift) is an absence, not this doc's severity.
**Fix**: Archive/delete; replace with a ~15-line quarterly checklist targeting what actually drifts (.specs/technical/*, .specs/README.md, constitution counts, feature statuses) with one "Next review due" date owned by constitution §VIII.1.

### F-44 — Result<T> vocabulary owned by a concrete repository; sibling repository throws instead · architecture · S
**Claim**: Result/success/failure is defined in score-repository.ts and imported from there by modules/auth.ts (a module reaching two layers down), while user-repository.ts uses a throwing contract — two incompatible repository error conventions and a shared type in the wrong home.
**Refuter**: CONFIRMED — user-repository's header documents responsibilities but never declares the throwing convention as intentional; no mitigating doc. No user-visible harm today.
**Fix**: Move Result/success/failure to src/types/result.ts and update the three importers; either convert UserRepository to Result or add a comment declaring why it throws.

### F-45 — admin-user-service's header claims a Firestore-type-free boundary its own API violates · architecture · S
**Claim**: The header says it "strips Firestore-specific types from its return shape", yet ListUsersPage exposes DocumentSnapshot and the consuming component imports it from firebase/firestore (admin-user-service.ts:8-9, :12, :27-30; admin-users-panel.ts:21, :42).
**Refuter**: CONFIRMED — the comment is half-true for the role-change path (FunctionsError mapping) but the pagination path plainly violates it. Agent-misleading, no runtime harm.
**Fix**: Make the cursor opaque (token or lastCreatedAt + startAfter), or correct the comment.

### F-46 — CSP hash-pins one inline script with no automated src↔firebase.json check · architecture · S
**Claim**: firebase.json:88 pins exactly one sha256 (independently recomputed; matches src/ and dist/ today), with no CI/predeploy check linking src/index.html to firebase.json — any whitespace edit to the theme-restore snippet ships a production-only CSP violation (light-mode flash + console error). style-src 'unsafe-inline' is currently load-bearing (inline style attributes in templates).
**Refuter**: CONFIRMED — hash recomputed and matched; grep confirms the hash appears only in firebase.json, nothing verifies it. Cosmetic blast radius, invisible-until-production.
**Fix**: 5-line predeploy/CI step extracting the inline script, recomputing the base64 sha256, and diffing against firebase.json; comment above the snippet naming the coupling. (Static hosting cannot do nonces; keep the hash approach.)

### F-47 — getEntries caps at limit(maxWeekNumber * 10): an implicit 10-team ceiling with undefined truncation · implementation · S
**Claim**: score-repository.ts:207-216 uses `limit(maxWeekNumber * 10)` with no orderBy while getTeams allows 20 teams; past 10 teams, publishWeek's recompute silently drops entries and publishes standings that omit teams.
**Refuter**: CONFIRMED — at 11+ teams a week-1 publish (limit 10) would silently drop a team. Latent, scale-gated (~7 teams today).
**Fix**: `limit(15 * 20)` (15 weeks × 20 teams, matching getTeams), or drop the limit — 300 docs max is trivially bounded.

### F-48 — ScoreService caching internally inconsistent: prior-year reads bypass the cache; nulls never cached · implementation · S
**Claim**: computeRosterDefaults/computeShooterDefaults call this.repository directly for prior-year data (score-service.ts:344-350, :392-397) while buildScorecardData fetches the identical data through cached wrappers; null single-doc results skip setCache (getSeason :70, getWeekResult :119, getLatestWeekResult :147), so nonexistent docs are re-read every call.
**Refuter**: CONFIRMED — mechanical fix, quota-only impact at admin-click frequency (~40-70 doc reads per defaults click).
**Fix**: Route prior-year reads through this.getTeams/this.getAllWeekResults; cache null results (only the `&& result.data` guard blocks it).

### F-49 — Fresh checkout: Functions emulator points at never-built functions/lib — triggers silently absent in dev · implementation · S
**Claim**: dev scripts run `firebase emulators:exec --only auth,firestore,functions` with no functions install/build; functions/lib is gitignored; emulators don't run the deploy predeploy hook; CONTRIBUTING's fresh-checkout flow never mentions it. onUserCreate and setUserRole are silently absent locally.
**Refuter**: CONFIRMED — works on this machine only because a stale functions/lib/index.js exists, exactly the "works on Tyler's machine" claim.
**Fix**: Prefix dev/dev:seeded/emulators scripts with `npm --prefix functions ci --silent && npm --prefix functions run build && ...`; one line in CONTRIBUTING.

### F-50 — Dead exports: lookupYardage (with real range gaps), StandingRow, TeamTopShooter · implementation · S
**Claim**: lookupYardage is imported only by its test (the app renders YARDAGE_TABLE directly); StandingRow and TeamTopShooter have zero import sites. The dead lookupYardage returns undefined for sums falling between rows (max 175.49 / min 175.50) if ever wired to unrounded going-in sums.
**Refuter**: CONFIRMED — precision note: gaps only bite sums with >2 decimal places, i.e., exactly the unrounded-mean wiring hypothesized.
**Fix**: Delete the three dead exports (or make lookupYardage boundary-based using only min thresholds if yardage automation is planned).

### F-51 — Publish path matches shooters by exact string; everywhere else is normalized · implementation · S
**Claim**: _buildSeasonData (:768) and publishWeek (:232) compare raw names while five other sites use normalizeShooterName — a case/whitespace variant in a saved entry creates a phantom duplicate shooter with startingAvg 35, rookie=false, silently skewing goingInSum and possibly the +5 target bonus.
**Refuter**: CONFIRMED — narrow trigger: roster rows are prefilled read-only, so the mismatch requires typing a variant into a free-text substitute row (no canonicalization at save).
**Fix**: normalizeShooterName on both sides of the find/Set; canonicalize entry names to roster spelling at save time.

### F-52 — Role revocation is only cooperatively enforced; docs overclaim "immediately" · implementation · S
**Claim**: The roleChangedAt snapshot listener runs in the demoted user's own client, so a hostile demoted admin keeps a valid admin-claim token up to ~1 hour (setUserRole never calls revokeRefreshTokens); auth.ts:134-141's comment and the RBAC spec imply instant revocation.
**Refuter**: CONFIRMED — inherent Firebase custom-claims behavior; trusted-insider threat; remedy is documentation.
**Fix**: Document the accepted ≤1h hostile-client window in spec §VI; soften the auth.ts comment ("immediately, for cooperative clients").

### F-53 — config collection grants public read via wildcard · implementation · S
**Claim**: `match /config/{doc} { allow read: if true; }` (firestore.rules:48-49) makes any future config doc world-readable by default; only the banner exists today, but the comment "banner + site config" invites more.
**Refuter**: CONFIRMED — preventive hardening only; no rules test pins non-banner config docs as unreadable.
**Fix**: Narrow to `match /config/banner`; default-deny other config docs; add one rules test for a hypothetical config/other doc.

### F-54 — functions/package.json's test script finds zero tests · implementation · S
**Claim**: `"test": "vitest run"` inside functions/ fails with "No test files found" — the real tests live at repo-root tests/functions/ under the emulator wrapper — misleading anyone working inside functions/.
**Refuter**: CONFIRMED — pure footgun script.
**Fix**: Delete the two scripts or repoint: `"test": "npm run test:functions --prefix .."` with a comment about the emulator wrapper.

### F-55 — Rules-test deny coverage misses three narrow paths · implementation · S
**Claim**: No anon-write tests against seasons subcollections, no anon read-deny test for entries, no test of the implicit delete-deny on seasons/{year}/weeks (rules give weeks only create/update).
**Refuter**: CONFIRMED — seasons.test.ts read in full; anon coverage exists in users.test.ts, so the pattern is available. Low stakes given the rules' simplicity.
**Fix**: ~6 assertions in seasons.test.ts: asAnon setDoc against teams/weeks/entries, asAnon getDocs(entries), admin deleteDoc against a week expecting assertFails.

### F-56 — ADR-008's CSP cleanup (remove cdnjs allowances) was never executed · implementation · S
**Claim**: decision-log.md:441 says to remove the style-src/font-src cdnjs.cloudflare.com allowances after dropping Font Awesome; firebase.json:88 still allowlists cdnjs in both, with zero remaining cdnjs/fontawesome references in src/.
**Refuter**: CONFIRMED — the allowances are dead; free attack-surface trim left undone.
**Fix**: Delete the two cdnjs allowances and verify no 404s on preview; or add an ADR-008 addendum if intentionally retained.

### F-57 — Constitution bookkeeping inconsistent: 1.5.0 header with a 1.4.0-ending history; README's dead AGENTS.md link · documentation · S
**Claim**: constitution.md:3 says 1.5.0 but Version History ends at 1.4.0; §VII.1 lists the phantom firebase-best-practices skill (substance owned by F-42); README.md:25 links AGENTS.md, renamed to CLAUDE.md 2026-04-05 (broken ~3 months).
**Refuter**: CONFIRMED — all reproduced; cosmetic-to-minor as claimed.
**Fix**: Add the 1.5.0 history line (Blaze + RBAC amendment, 2026-05-03); fix the skill roster per F-42; point README.md:25 at CLAUDE.md/CONTRIBUTING.md and fix its "Vite 7.x".

### F-58 — 35 of 89 relative markdown links are dead, in four families · documentation · S
**Claim**: (1) the constitution's repo-root-relative link convention makes all 14 of its links unresolvable from .specs/ (even to its own sibling firestore-schema.md); (2) genuinely missing targets (AGENTS.md, .prompts/README.md, vite.config.ts); (3) the committed 002 spec's "Plan of record" links a machine-local plan file (/Users/ted/.claude/plans/...) that exists on no checkout — while /implement step 2 instructs agents to read spec-referenced files; (4) tasks.md uses `file.ts:22`-style link targets that don't exist.
**Refuter**: CONFIRMED — all four families sampled and reproduced. One overstatement: Family-1 links still resolve for an agent Reading from repo root, so "every dead link is a failed Read" overstates impact; the genuinely lossy item is the unrecoverable plan-of-record link (absent even on this machine).
**Fix**: Fix constitution links to true relative paths; copy the plan's still-relevant content into the spec (or plan.md beside it) and adopt a rule that .specs/ files never reference paths outside the repo; convert tasks.md file:line links to plain-text code spans.

### F-59 — Hook's comment-exclusion filters are dead on BSD grep; handler grep flags the recommended fix · agent-framework · S
**Claim**: `grep -v '^\s*//'` doesn't honor `\s` in BSD BRE, so comments, strings, and template literals all false-positive as `var` violations; the handler grep flags `btn.onclick=handler` (the pattern's own recommended fix) while missing `el.onclick = handler` (spaced form).
**Refuter**: CONFIRMED — reproduced empirically on this machine (Darwin) by piping crafted files through the actual hook.
**Fix**: POSIX classes (`^[[:space:]]*//`) or grep -E; anchor the var check to declaration position; scope the handler grep to HTML-attribute context.

### F-60 — Hook fails silent-open: missing jq no-ops the script; src/index.html permanently out of scope · agent-framework · S
**Claim**: No `command -v jq` guard — if jq is absent, FILE is empty and the script exits 0 with effectively no diagnostic; the `*.ts` gate excludes src/index.html, the only real HTML file, where inline handlers would actually be written as attributes.
**Refuter**: CONFIRMED — minor overstatement (bash would emit "jq: command not found" on stderr, but with exit 0 it reaches nothing) — still silent-open in effect. Latent on this Mac (jq present).
**Fix**: Add a loud jq-missing guard (or parse file_path with a bash regex, dropping jq); widen the extension gate to `*.ts|*.html`.

### F-61 — Over-broad skill trigger phrases can hijack unrelated requests into the wrong spec · agent-framework · S
**Claim**: check triggers on "run checks"/"validate changes"; constitution on "current state"; implement on "build the feature" — and implement's no-arg fallback then acts on the most-recently-modified spec (the stale scoring-engine.md) without confirmation.
**Refuter**: CONFIRMED — trigger phrases verbatim; the hijack-to-stale-spec chain real. Speculative-routing severity correctly capped at P3.
**Fix**: Tighten descriptions to distinctive phrases ("constitutional check", "implement the spec"); make implement always confirm which spec it resolved before editing.

### F-62 — spec-authoring-guidelines.md — the cure for the duplication disease — is wired to nothing · agent-framework · S
**Claim**: The one meta doc whose rule ("Reference, Don't Reproduce") would have prevented the scoring.md duplication (F-17) is not loaded by speckit.md, not listed in constitution §VII.2, and reachable only via the moribund integration guide. (The seed's claim that .specs/README.md references it is refuted; the substance — orphaned wiring — is confirmed.)
**Refuter**: CONFIRMED — repo-wide grep shows only the integration guide references it; the 89-line doc itself is current and repo-accurate; single commit, never wired. Cheapest leverage point in the meta ecosystem.
**Fix**: Add it to speckit.md's mandatory-reading list and constitution §VII.2; extend its scope note to cover agent files ("agents reference specs, never restate rules"). Keep the doc as-is.

### F-63 — The minimum viable meta framework is roughly half the current one · agent-framework · M
**Claim**: Of 2,715 lines across six .prompts/meta/ docs, git evidence supports keeping ~1,350 (ADR log, evolution strategy, spec-authoring guidelines — all genuinely operational) and deleting/folding ~1,360 (gap protocol, maintenance guide, most of the integration guide) with no loss of operational capability.
**Refuter**: CONFIRMED — line counts and usage split reproduced: ADR log has real operational commits and 8 inbound refs; evolution strategy is loaded by speckit; the other three are single-commit imports or consumer-less. A consolidation recommendation whose factual predicates all check out.
**Fix**: End state: .prompts/meta/ contains exactly architectural-decision-log.md, architectural-evolution-strategy.md (optionally trimmed of enterprise tiers), spec-authoring-guidelines.md. Gap handling → a paragraph in speckit.md; maintenance obligations → constitution §VIII.1; the integration guide's boundary table → .specs/README.md; update §VII.2 to list the surviving three.

---

## 3. Per-Dimension Health

### Architecture
The core layering is genuinely good for a no-framework SPA — and that is the load-bearing fact of this review. ScoreRepository is a clean Firestore-only boundary with a consistent Result contract and carefully composed batched writes (the cascading rename/delete with accolade patching is careful work); scoring-engine.ts is truly pure with a documented import rule; ScoreService takes its repository via constructor injection, which is why 203 unit tests run without emulators; the admin-tabs already demonstrate the right dependency-injection pattern; firestore.rules, Functions, CI test matrix, security headers, and .gitignore discipline are all above hobby norm, and the Firestore cost story is a non-issue at this scale (~40 reads per cold home view, single-digit percent of free tier). The weaknesses are concentrated in *wiring*, not design intent: no composition root, so seven components mint private services and the well-written cache invalidation only ever reaches one of seven caches (F-01); season standings have two stored representations and three derivation paths that can disagree (F-05); score-service.ts breached the repo's own 750-line limit largely by hoarding pure functions that belong in the engine (F-21); and the infra gaps are pipeline-shaped — no pre-merge build, ungated production deploy, a stale-shell cache window, and the empty-index/--force trap (F-03, F-04, F-24). Every architecture P1 is a small-to-medium mechanical fix precisely because the underlying seams already exist.

### Implementation
The scoring core is strong at its center and soft at its seams. Center: a pure engine with careful tie handling, a recently shipped and well-documented standings tie-breaker, dense targeted tests (forfeits, ties, no-shows), defensive numeric checks in buildPriorAvgMap, and consistent Result usage with informative error codes; schedule and yardage utilities are small, correct, and tested. Security posture held up under a deliberately adversarial audit: rules read token claims everywhere, role is provably not client-writable, setUserRole is textbook defense-in-depth (App Check, owner claim, Zod, last-owner guard, transactional rate limiting with reasoned claim-first ordering), the announcement XSS pipeline (marked → DOMPurify → innerHTML) is sound on the designed path, and client role checks are demonstrably UX-only with rules as backstop. The seams: identity is stringly-typed and inconsistently normalized (F-08, F-51), the Firestore boundary is cast-trusted with no shape validation (F-09), re-publishing rewinds standings (F-05), two admin cascades swallow Results (F-25), and the residual security items are all one layer behind the wall (identity forgery in the promotion UI F-27, escaping-convention violations F-06/F-07, an undocumented revocation window F-52). Testing is bimodal: excellent where it exists (the role-escalation deny matrix, regression tests pinned to bug numbers) and absent across the entire UI/repository layer (F-29), with no sanitizer regression test (F-10), no lint (F-28), and two cache tests that assert nothing (F-30).

### Documentation
The corpus is bimodal by age, and the split is sharp: everything touched on or after 2026-05-28 is accurate — CONTRIBUTING.md is flawless against package.json and scripts/, ADR-009 is an excellent and self-aware record, firebase-deployment.md (May 2026) is a model of current, gotcha-aware operational writing, and WORKFLOW-GUIDE.md matches both reviewer.md and observed git practice. Everything asserting "current state" from before then has drifted badly, and the drift concentrates in the two documents agents are ordered to read first: the constitution's §II still describes a pre-launch AWS site with a permanent JSON data layer (F-11, F-12), its inventory metrics are wrong on every countable line (F-34), the older ADRs speak in present tense about files and follow-ups that no longer exist (F-35), and the technical specs for CI/CD and the schema predate the RBAC epic that rewired both (F-13, F-14). The root cause is not structure — the three-layer topology (constitution / technical specs / meta strategy / global skills) is coherent — but a broken update reflex: the May 2026 RBAC feature changed CI, the schema, and the workflow, and none of the specs describing them was touched. Add a 35/89 dead-link rate (F-58), shipped features still marked in-progress (F-15), and a spec-kit front door still teaching removed slash commands (F-36). The highest-leverage documentation fix in the repo is a single honest rewrite of constitution §II plus one superseding ADR.

### Agent framework
Intent and content quality are genuinely good; the framework fails at its joints. Credit first: all four skills have valid frontmatter and real procedures; deploy-preview and speckit encode hard-won operational knowledge (preview channels don't get rules deploys; run.invoker bindings; GCF bucket IAM) most hobby repos never write down; the ADR log is the healthiest artifact of its kind the reviewers had seen in a solo repo — actually updated when decisions happen and demonstrably shaping agent behavior; the April 2026 retirement of .prompts/core|platforms was the right consolidation, executed with a real reference sweep; and spec-authoring-guidelines.md shows the maintainer independently diagnosed the two-sources-of-truth disease and wrote a crisp 89-line cure. The joints: the flagship hook is uncommitted (F-39), unconditionally advisory, invisible to the agent it should correct (F-19), grep-blind to the codebase's actual query idiom (F-20), and noisy on BSD grep (F-59, F-60); the @speckit STOP-gate loads 431 lines targeting deleted directories (F-16); the scoring agent restates 62% of its spec and has drifted into a factual error about the bonus cap (F-17); the agents lack frontmatter entirely (F-41); the forbidden-pattern ruleset lives in six diverging copies (F-40); and roughly half the meta corpus is fossil (F-37, F-43, F-63) while the one doc that would prevent the disease is wired to nothing (F-62). For a repo maintained primarily through agent sessions, these are the highest-leverage fixes available — and the remedy is mostly deletion and rewiring, not new process.

---

## 4. Appendices

### Appendix A — Claims matrix (from C1, Truth reconciliation — claims audit; verbatim)

| # | Claim | Source | Verdict | Ground truth |
|---|-------|--------|---------|--------------|
| 1 | "Active Users: 0 (pre-launch — still on AWS/CloudFront)" | constitution.md:80 | CONTRADICTED | CLAUDE.md:14 (2026-05-28) "site is live at citl.club"; prod App Check work 65b6809 2026-05-28; live-season scoring fix a047a85 Jul 2026 |
| 2 | "Hosted on AWS S3 + CloudFront (legacy)… DNS not yet cut over" | constitution.md:87,92-93 | CONTRADICTED | Same as #1; §II.1 header claims "Last Updated 2026-05-03" yet retains pre-launch text |
| 3 | "UI Components: 4 Web Components" | constitution.md:70 | STALE | ls src/components: 10 components + admin-tabs/ (6 files) |
| 4 | "Modules: 7 (…score-service, standings-service)" | constitution.md:82 | CONTRADICTED | standings-service exists nowhere (grep hits only constitution); src/modules = auth, navigation, role, router, ui |
| 5 | "Repositories: 2" | constitution.md:83 | STALE | 3: score-, user-repository.ts, repository-factory.ts |
| 6 | "Types: 4" | constitution.md:84 | STALE | 6 files in src/types (announcement.ts, user.ts added) |
| 7 | "Data files: 7 JSON scorecard seasons (2019–2025)" | constitution.md:85 | CONTRADICTED | Deleted c1274e1 2026-02-28; src/data/ absent |
| 8 | "SPA Views: 6" | constitution.md:81 | VERIFIED | 6 files in src/views |
| 9 | "rules matrix (44 cases); function unit tests (15 cases)" | constitution.md:73 | STALE (minor) | 45 it() in tests/rules (one added post-1.5.0, 898ea7c 2026-05-08); 15 in tests/functions exact |
| 10 | §II.4 "src/data/ Static JSON data (2019–2025)" | constitution.md:135 | CONTRADICTED | Directory does not exist |
| 11 | §II.5 "JSON scorecard data is never replaced by Firestore" | constitution.md:141-149 | CONTRADICTED | 36114d0 2026-02-28 "scorecards page driven by Firestore" |
| 12 | "Testing: Trigger at 10+ modules (currently 7)" | constitution.md:104,177 | STALE | Testing already Active per constitution.md:73; three suites exist |
| 13 | "JS bundle… currently ~34 kB gzipped" | constitution.md:246 | STALE | dist main bundle 161,133 B gzipped (~157 kB); still under 250 kB target |
| 14 | "Build Tool: Vite 7.x" | constitution.md:300,471; README.md:7; CLAUDE.md:14; build-system.md:3 | STALE | package.json:43 vite ^8.0.16 (ee7e229, 2026-06-12) |
| 15 | "Cloud Functions (TypeScript, Node 22)" | constitution.md:311 | VERIFIED | firebase.json:10 nodejs22; functions/package.json engines "22" |
| 16 | "CSP must allow maps.google.com + www.google.com" | constitution.md:195 | VERIFIED | firebase.json:88 frame-src includes both |
| 17 | §VII.1 global skill "firebase-best-practices" | constitution.md:458; evolution-strategy.md:204 | CONTRADICTED | Not in ~/.claude/skills/ (11 skills; firebase-deploy-runbook present but unlisted) |
| 18 | Header "Version 1.5.0" vs history | constitution.md:3 vs :523-529 | CONTRADICTED (internal) | Version History ends at 1.4.0 (2026-04-12) |
| 19 | ADR-001 Status "Accepted" (Spark plan) | decision-log.md:47-61 | STALE | Blaze since ADR-009 (2026-05-03); not marked superseded-in-part |
| 20 | ADR-003 Status "Accepted" (permanent static JSON) | decision-log.md:140-186, agent guidance :550-551 | CONTRADICTED | Reversed 2026-02-28; no superseding ADR exists |
| 21 | ADR-004 factory "supports firestore and stub backends"; files incl. standings-service.js | decision-log.md:210,238-239 | STALE | repository-factory.ts is Firestore-only, no backend switch; standings-service never existed as .ts |
| 22 | ADR-006 csv-parser.js, localstorage-score-repository.js | decision-log.md:311-313,339 | STALE | Neither exists; src/utils = markdown, schedule, yardage |
| 23 | ADR-008 "remove style-src/font-src cdnjs allowances" | decision-log.md:441 | CONTRADICTED | firebase.json:88 still allowlists cdnjs.cloudflare.com in style-src and font-src |
| 24 | ADR-009 "admin-panel.ts… 1781 lines; follow-up tracked" | decision-log.md:540-542 | STALE | admin-panel.ts = 232 lines; admin-tabs/ refactor complete |
| 25 | "The site is live at https://citl.club… migration complete" | CLAUDE.md:14 | VERIFIED (best available) | Consistent with git history + prod App Check/key-restriction work; no offline counter-evidence |
| 26 | "npm run deploy # build + firebase deploy --only hosting" | CLAUDE.md:47 | CONTRADICTED | package.json:18 deploys hosting,firestore:rules,firestore:indexes,functions (since 5ab19ba 2026-05-03) |
| 27 | "See `[AGENTS.md](AGENTS.md)`" | README.md:25 | CONTRADICTED | AGENTS.md renamed to CLAUDE.md 4c3c70a 2026-04-05; link dead ~3 months |
| 28 | "@speckit… creates a spec in .specs/features/<name>.md" | WORKFLOW-GUIDE.md:31,44 | STALE | Convention is hybrid: flat scoring-engine.md AND directory 002-multi-user-rbac/{spec,tasks,bootstrap}.md |
| 29 | "Audit all 12 constitutional checks" | WORKFLOW-GUIDE.md:54 | VERIFIED | reviewer.md check table has 12 rows |
| 30 | CONTRIBUTING dev/seed commands, test accounts, idempotent seeding | CONTRIBUTING.md:11-58 | VERIFIED | Matches package.json:12-33 scripts exactly; seed script exists with emulator-host guard |
| 31 | "Firebase Usage near 0%"; "$5/mo budget alert" set; Blaze spend ~$0 | constitution.md:76,87,434 | UNVERIFIABLE | Firebase-console state; no repo ground truth — needs maintainer attestation, not a doc edit |
| 32 | Evolution-strategy phase frameworks (triggers, migration tables) | architectural-evolution-strategy.md | VERIFIED (evergreen) | Deliberately timeless framework; only stale item is the skill ref in row 17 |

### Appendix B — Pattern-coverage matrix (from D2, Enforcement & drift mechanics; verbatim)

| # | Forbidden pattern (canon: constitution §IV.2) | §IV.2 canon | CLAUDE.md | speckit.md (hard constraints) | reviewer.md (checklist) | check/SKILL.md | hook script |
|---|---|---|---|---|---|---|---|
| F1 | Unfiltered `getDocs(collection(...))` — need where()+limit() | present (:325) | present (hooks table :~119) | present (:74) | present (#3, :26) | MUTATED — grep `getDocs(collection(` misses repo's `getDocs(q)` idiom (:20) | MUTATED — same dead grep (:33); 0 real call sites match |
| F2 | `onSnapshot` without cleanup | present (:326) | absent | pointer-only (via §IV.2 ref :73) | present (#4, :27) | absent | absent |
| F3 | Client-side filtering of Firestore data | present (:327) | absent | pointer-only | **absent** | absent | absent |
| F4 | Hardcoded Firebase config | present (:328) | absent | pointer-only | present (#5, :28) | absent | absent |
| A1 | `var` declarations | present (:333) | present | pointer-only | present (#1, :24) | present (:18) | MUTATED — comment/string filter broken on BSD grep (:21-22) |
| A2 | Inline event handlers | present (onclick example :334) | present | pointer-only | MUTATED — 3 events only (:25) | MUTATED — 3 events only (:19) | MUTATED — 5 events; .ts files only, src/index.html never checked (:27) |
| A3 | `innerHTML = userInput` | present (:335) | absent | present (:83) | present (#6, :29) | present (:21) | **absent** |
| A4 | God modules / file size | MUTATED at source — '>500 lines' forbidden (:336) vs §II.3 750-hard (:116) | present (750 hard) | present (500/750, :76) | present (#8, 750/500, :31) | present (500/750, :23) | present (500 warn / 750 forbidden, cites §II.3 not §IV.2, :40-43) |
| A5 | Circular imports | present (:337) | absent | approximated (dependency direction :77) | present (#9, :32) | approximated (dep-direction step 3, :26-29) | absent |
| A6 | Components importing `firebase/` | present (:338) | absent | approximated (dep direction) | present (#10, :33) | present (:29) | absent |
| A7 | Plain `Loading…` text (use .skeleton) | present (:339) | absent | present (:75) | present (#7, :30) | present (:22) | absent |
| P1 | Direct commits to main | present (:344) | present (Git Conventions) | absent | absent | absent | absent |
| P2 | Conventional commit format | present (:345) | present | absent | present (#11, :34) | absent | absent |
| P3 | Force push to main | present (:346) | present | absent | absent | absent | absent |
| P4 | Skipping rules tests in Emulator | present (:347) | absent | absent | absent | absent | absent |
| X1 | Types in src/types/ (satellite-invented, not in §IV.2) | absent | absent | absent | present (#12, :35) | absent | absent |

Coverage score: hook enforces 4/15 (two mutated to near-uselessness); check skill 6/15 + dep-direction + typecheck/tests; reviewer 11/15 + 1 invented; CLAUDE.md 7/15; speckit 5 explicit + blanket pointer. No location enumerates F3. Constitution contains zero references to the hook — the canon does not know it is (nominally) enforced.

---

## 5. Verification Ledger

**REFUTED findings**: none. Every finding submitted to the refutation pass survived with its core mechanism intact.

**UNVERIFIABLE findings**: none at the finding level. Three individual *claims* inside the C1 audit (Appendix A row 31 — "Firebase Usage near 0%", the "$5/mo budget alert" being set, and the actual active-user count) are UNVERIFIABLE from the repo because they describe Firebase-console state; they need maintainer attestation, not a doc edit. Future reviews should not attempt to verify these from the repository.

**Refuter escalations**: none. No finding was escalated in severity; one finding was materially *strengthened* during verification (F-03: the refuter additionally discovered via read-only `gh api` that main's branch ruleset contains **zero required status checks**, so even the existing CI jobs are not required to pass before merge).

**Downgrades and partial refutations (audit trail so future reviews do not re-find them)**:

Nine findings were downgraded one severity level during refutation; rationales are recorded inline in Section 2 and summarized here:

| Finding | Downgrade | Key refuter reasoning (do not re-litigate without new evidence) |
|---------|-----------|------------------------------------------------------------------|
| F-04 | P1→P2 | Old shell resolves old bundles from browser cache (immutable), yielding a working stale app, not a blank page; blank page needs rare asymmetric eviction; zero dynamic imports so no lazy-chunk-404 path |
| F-06 | P1→P2 | `<`/`>` are escaped, so injection limited to attributes on one element; CSP blocks handlers; duplicate attributes ignored; marginal harm < F-27 which is P2 |
| F-07 | P1→P2 | A compromised admin can already deface legitimately via the same fields; "mangles legal names" narrower than claimed (HTML parses `<`+non-letter and bare `&` as text) |
| F-13 | P1→P2 | In-repo workflows + correct firebase-deployment.md + deploy-runbook skill cover the failure path; under-provisioned SA fails loudly |
| F-14 | P1→P2 | firestore.rules and indexes.json are in-repo and correct; 002 spec documents users/audit; code deliberately avoids the announcements index |
| F-15 | P1→P2 | Corruption path requires unusual no-arg /implement; task step 1 collides immediately with implemented code — wasted turns, not destructive edits |
| F-18 | P1→P2 | SKILL.md step 1 explicitly list-and-asks on a missing file; flat convention round-trips between speckit (author) and implement (consumer) |
| F-33 | P2→P3 | Constitution §II.1's own table lists the rules/functions suites as Active two sections earlier — the "agents rebuild suites" impact doesn't survive |
| F-37 | P2→P3 | Literal orphaned doc; git proves the quarterly ritual has zero historical invocations; harm requires invoking a process nobody runs |

Partial refutations recorded inside CONFIRMED verdicts (sub-claims future reviews should treat as settled):

- **F-01**: the *quota/cost* dimension of SEED-A3 is refuted — duplicate reads are ~10-15 per full visit, immaterial at this scale. The confirmed problem is staleness/hygiene only.
- **F-02**: the three edge divergences are *intentional, tested* adaptations, not accidental drift; the confirmed problem is the duplicated rule whose tests pin the copy rather than equivalence.
- **F-17**: the tie-breaker is NOT "only a code comment" — it is also on the user-facing rules page and in unit tests; it is absent only from the spec and agent.
- **F-19**: the stdout-invisibility prong is version-dependent and not runtime-verified; the verdict rests on the unconditional exit 0 + observed god-file growth.
- **F-24**: "every other list query carries a limit" is overstated — cascadeTeamRename and deleteTeam do unbounded (admin-path) reads; the public-read and --force-trap claims hold.
- **F-58**: the constitution's "100% dead-link rate" overstates agent impact — repo-root-relative links still resolve for an agent Reading from repo root; the genuinely lossy item is the machine-local plan-of-record link.
- **F-60**: a missing jq would emit "command not found" on stderr, so "no diagnostic" is slightly overstated; with exit 0 it is still silent-open in effect.
- **F-62**: SEED-D7's detail that .specs/README.md references spec-authoring-guidelines is refuted; the substance (orphaned wiring) is confirmed.
- **F-50**: yardage-table gaps only bite sums with >2 decimal places — exactly the unrounded-sum wiring the finding hypothesizes, not current behavior.

**Triage note**: with zero refuted findings, zero escalations, and nine one-level downgrades all on impact-calibration (never on evidence), the finding set should be treated as high-confidence. The severity distribution (0 P0 / 13 P1 / 28 P2 / 22 P3) reflects a repo with no fires but a dense layer of latent-wrongness generators, concentrated in documentation truth and framework wiring.
