# Deep Review Backlog — citl.club (2026-07)

Derived from [report.md](report.md) (63 findings: 0 P0 / 13 P1 / 28 P2 / 22 P3). Every item is written to be executable by a future agent session **without reading the report** — each carries file paths, finding cross-refs, and acceptance criteria.

## Ordering rationale (dependency-driven, not severity-driven)

- **WS-1 Truth reconciliation first**: the constitution, CLAUDE.md, ADR log, and feature-spec statuses are what every later agent session reads to orient. Executing code work against docs that say "pre-launch on AWS, permanent JSON data layer" multiplies error; fixing the narrative is cheap and de-risks everything after it.
- **WS-2 Agent-framework repair second**: the remaining backlog items will be executed via agent sessions (/implement, hook, @reviewer). The hook must bind, /implement must resolve specs, agent files must be scoped, and the ruleset must be single-sourced *before* those tools are trusted to carry WS-3/WS-4.
- **WS-3 Correctness hardening third**: behavior fixes and the tests that pin them land before structural moves, so refactors in WS-4 are protected by tests and behavior changes are never entangled with file moves in the same diff.
- **WS-4 Structural refactors fourth**: the composition root, score-service split, CSS split, and CI gates reshape files; they are safest once behavior is pinned. (Exception: WS4-03, the CI build gate, is independent and P1 — it may be pulled forward any time.)
- **WS-5 opportunistic sweep last**: one cleanup session for dead exports, links, and small config trims — all P3 except the P2 season-awards decision item (WS5-02), grouped here because it is a standalone finish-or-delete decision; nothing depends on it and it depends on nothing.

Severity and effort below are exactly the final (post-refutation) values from the report.

---

## WS-1 — Truth reconciliation

### WS1-01 · P1 · S · Rewrite constitution §II.1/§II.2 to the live-production state (F-11)
Edit `.specs/constitution.md`:
- §II.1 "Key Metrics": replace "Active Users: 0 (pre-launch — still on AWS/CloudFront)" (line ~80) and "DNS not yet cutover" (~87) with the live state: site live at https://citl.club on Firebase Hosting since ~2026-05; AWS decommissioned.
- §II.1 "Deployment Context (current)" (~92-93): delete the "Hosted on AWS S3 + CloudFront (legacy)" text; describe Firebase Hosting + Firestore + Cloud Functions (Blaze).
- §II.2: delete/close the "CI/CD: Trigger at DNS cutover decision" trigger — CI/CD is Active.
- Bump version to 1.5.1 and add BOTH missing Version History lines: 1.5.0 (2026-05-03, Blaze + RBAC amendment — currently absent, see F-57) and 1.5.1 (this change).
- Edit `.specs/technical/firebase-deployment.md`: replace the future-tense "DNS Cutover" section (~:399-431), including the live `terraform destroy` instruction, with a 2-3 line historical note ("cutover completed ~2026-05; AWS decommissioned"); fix the preview-URL example at ~:357 from `citl--preview-[hash].web.app` to `citl-baed2--preview-[hash].web.app`.

**Acceptance**: grep of constitution.md for "pre-launch", "AWS", "CloudFront", "DNS" returns only historical-context mentions (if any) clearly marked as history; no "terraform destroy" remains as a live instruction; version history ends at 1.5.1 and matches the header.

### WS1-02 · P1 · M · ADR-010 supersedes ADR-003; purge the static-JSON scorecard narrative (F-12)
- Append ADR-010 to `.prompts/meta/architectural-decision-log.md`: "Scorecards are Firestore-driven (supersedes ADR-003)" — decision effective 2026-02-28 (commits c1274e1, 36114d0), rationale: single data path, no dual JSON/Firestore maintenance.
- Mark ADR-003's Status line "Superseded by ADR-010 (2026-02-28)".
- Fix the agent-guidance line at decision-log ~:550-551 that says "ADR-003 explains why scorecard data is JSON, not Firestore" to point at ADR-010's actual state.
- `.specs/constitution.md`: rewrite §II.4/§II.5 (lines ~135, ~141-149) — remove `src/data/` from the layout and the "JSON scorecard data is never replaced by Firestore" clause; describe the single Firestore data layer; also fix §II.1's "Data files: 7 JSON scorecard seasons" metric (~:85).
- `.specs/technical/build-system.md`: delete the `src/data/scorecards/` tree entry (:34), the JSON-bundling passages (:188-189, :205), and the `downloads.js` reference (:218); fix the dead link at :48 from `vite.config.ts` to `vite.config.js`; change "Vite 7.x" (:3, :313) to 8.x or "see package.json".

**Acceptance**: `grep -rn "src/data" .specs/ .prompts/` returns nothing presented as current; ADR-003 shows Superseded; ADR-010 exists; build-system.md has no reference to files absent from the repo.

### WS1-03 · P2 · S · Recount constitution §II.1 inventory metrics and §III.4 bundle figure (F-34)
In `.specs/constitution.md` §II.1: recount from `ls src/…` — components (10 + 6 admin-tabs), modules (auth, navigation, role, router, ui — delete the phantom `standings-service`), repositories (3), types (6); §III.4 (~:246): replace "~34 kB gzipped" with the current measured figure (~157 kB gz as of 2026-07, target 250 kB); re-date the metrics block (it self-dates 2026-03-10 inside a section headed 2026-05-03). Prefer replacing hard counts with a pointer to the src/ layout to end recurring drift.

**Acceptance**: `grep -rn "standings-service" .specs/` returns nothing; every remaining count in §II.1 matches `ls` output at execution time (or counts are replaced by pointers).

### WS1-04 · P2 · S · ADR log status/addendum sweep (F-35)
In `.prompts/meta/architectural-decision-log.md`, WITHOUT rewriting historical Context/Decision text:
- ADR-001: add "Superseded in part by ADR-009 (billing: Spark → Blaze, 2026-05-03)".
- ADR-004: add a dated addendum: factory is Firestore-only (`src/repositories/repository-factory.ts`, no backend switch); `standings-service.js` never existed in the .ts era.
- ADR-006: addendum: `csv-parser.js` and `localstorage-score-repository.js` removed; current utils are markdown/schedule/yardage.
- ADR-009: strike or check off the "admin-panel.ts is now a known violation (1781 lines); follow-up task tracked" note — admin-panel.ts is 232 lines; the admin-tabs/ split is complete.

**Acceptance**: each of the four ADRs carries a dated status/addendum line; no ADR speaks in present tense about a file that does not exist.

### WS1-05 · P2 · S · Mark shipped feature specs Shipped and execute the archive lifecycle once (F-15)
- `.specs/features/002-multi-user-rbac/spec.md:5` → "Status: Shipped (PR #157, deployed 2026-05-04)"; same for `tasks.md:6`.
- `.specs/features/scoring-engine.md` → "Status: Implemented".
- Create `.specs/features/archive/` and move both specs into it (making `.specs/README.md:54`'s documented lifecycle true) — OR, if archiving is rejected, update `.specs/README.md` and `speckit-integration-guide.md` to drop the archive step and declare the status header the lifecycle signal. Pick one; do not leave both docs and reality disagreeing.

**Acceptance**: no file under `.specs/features/` (excluding archive/) has an in-progress/ready status for shipped work; the documented lifecycle in .specs/README.md matches what was actually done.

### WS1-06 · P2 · S · Refresh cicd-pipeline.md to the real workflows (F-13)
Update `.specs/technical/cicd-pipeline.md` against `.github/workflows/`: (a) deploy-production deploys `firestore:rules,firestore:indexes,functions` plus hosting in a separate step; (b) ci.yml has FOUR jobs (Type Check, Unit Tests, Firestore Rules Tests, Cloud Functions Tests); (c) delete "No Firebase credentials needed" or scope it to the unit-test job; (d) replace the minimum-IAM section (currently firebasehosting.admin + firebaserulesadmin only) with the real role set for a functions deploy, or link the `firebase-deploy-runbook` global skill; (e) list all four job names as intended required branch-protection checks. Re-date the doc.

**Acceptance**: every workflow/job/flag named in the doc exists verbatim in .github/workflows/; nothing in the doc contradicts deploy-production.yml or ci.yml.

### WS1-07 · P2 · M · Refresh firestore-schema.md: add the four RBAC collections, reconcile indexes (F-14)
In `.specs/technical/firestore-schema.md`: document `/users/{uid}`, `/audit/{id}`, `/rateLimits/{id}`, `/config/{doc}` (shape, access rules, TS type locations — cross-check `firestore.rules` and `src/types/user.ts`); fix the index section (:41, :224-226): `firestore.indexes.json` is empty and CI deploys it — either declare the announcements year+postedAt composite index there (coordinate with WS3-11) or state explicitly that no composite indexes exist and the code sorts announcements in memory by design (score-repository.ts:459-464). Re-date.

**Acceptance**: every collection matched in firestore.rules appears in the schema doc; the doc's index claims match firestore.indexes.json exactly.

### WS1-08 · P2 · S · Rewrite .specs/README.md as a thin, truthful index (F-36)
Remove all `/speckit-*` command references (:24, :48, :78-88 — those skills do not exist; the real skills are check/constitution/deploy-preview/implement); link WORKFLOW-GUIDE.md as the canonical workflow; fix or delete dead links to `../AGENTS.md` and `../.prompts/README.md` (:97-99); add technical/firestore-schema.md to the directory tree; document the hybrid feature-spec convention (flat `<name>.md` for small features; `NNN-name/spec.md`+`tasks.md` for large ones, as 002 did).

**Acceptance**: every command, path, and link in .specs/README.md resolves/exists; the workflow described matches CLAUDE.md's "Feature Development Workflow".

### WS1-09 · P2 · S · Version/deploy-string sweep: Vite 8, deploy comment, Node runtime note (F-31)
- CLAUDE.md:47: change the comment for `npm run deploy` to name all four targets ("build + deploy hosting, Firestore rules, indexes, and Functions") or add/point to a hosting-only script.
- Grep-driven "Vite 7" → "Vite 8" (or "see package.json") in CLAUDE.md:14, README.md:7, constitution.md:300/471, build-system.md (if not already done in WS1-02).
- Note beside the Node 24 dev requirement (CLAUDE.md, CONTRIBUTING.md as applicable) that Functions run on nodejs22 in production; optionally change ci.yml's test-functions job to node-version 22.

**Acceptance**: `grep -rn "Vite 7" README.md CLAUDE.md .specs/` returns nothing; CLAUDE.md's deploy line matches package.json:18's actual targets.

### WS1-10 · P2 · S · Single-source the Firebase quota figures (F-38)
Constitution §VI keeps ONE quota table; delete the duplicate at constitution.md ~:414-415; replace figures in speckit-integration-guide.md:223, architectural-evolution-strategy.md:183 and :443 with links to constitution §VI; retitle firebase-deployment.md:307's table from "(Spark Plan)" to "Usage targets (Spark-equivalent, on Blaze)".

**Acceptance**: `grep -rn "50,000\|50K reads" .specs/ .prompts/` finds the figures in exactly one place (constitution §VI); all other sites are links.

### WS1-11 · P2 · S · Resolve the no-show rank-points contradiction in the scoring spec (F-32) — **requires maintainer decision**
Ask Tyler: should a no-show team receive last-place rank points (current shipped+tested behavior: scoring-engine.ts:324 feeds 0 targets; test at scoring-engine.test.ts:765-768) or null/no points (what scoring-engine.md:93/:145 promises)? Then make `.specs/features/scoring-engine.md` internally consistent: if current behavior is correct, reword lines 93 and 145 to match the forfeit row of its own edge-case table; if not, file a separate code-change task (do NOT change engine behavior inside this docs item). Also fix the spec's stale file references (scoring-engine.js, csv-parser.js → the real .ts paths).

**Acceptance**: scoring-engine.md contains no self-contradiction on no-shows and matches the tested engine behavior (or an explicit follow-up code task exists); no .js/csv-parser references remain.

### WS1-12 · P3 · S · Constitution §III.1 testing-state + bookkeeping touch-ups (F-33, F-57 remainder)
Rewrite constitution §III.1 "Current state" to enumerate the three real suites (203 unit / 45 rules-emulator / 15 functions-emulator) and their ci.yml jobs; mark the integration-testing trigger as fired (site live, 15+ modules) with a dated note, or replace the aspirational ≥80% coverage targets with the repo's actual bar; fix README.md:25's dead AGENTS.md link → CLAUDE.md (plus README's "Vite 7.x" if WS1-09 missed it).

**Acceptance**: §III.1 names the three suites and their CI jobs; README.md contains no dead links.

---

## WS-2 — Agent-framework repair

### WS2-01 · P1 · S · Retire prompt-gap-protocol.md; inline a working gap procedure (F-16)
Delete (or move to an archive/ folder) `.prompts/meta/prompt-gap-protocol.md` — its procedure targets the dismantled .prompts/core|platforms tree and a CLAUDE.md section that doesn't exist. Replace its live intent with ~6 lines in `.claude/agents/speckit.md` (and/or ~20 lines in constitution §V.2): "If the constitution, .specs/technical/, and global skills don't cover a decision: STOP, state what's missing, and ask whether to (a) add a constitution section, (b) add a .specs/technical/ doc, or (c) proceed with documented assumptions." Update ALL inbound refs: speckit.md:6 and :29-30, constitution.md:394/:399/:466, and constitution §V.2 step 2 (which currently points back circularly at the broken file).

**Acceptance**: `grep -rn "prompt-gap-protocol" .` (excluding this review dir) returns nothing; speckit.md's mandatory-reading list contains only files that exist; the gap procedure references only existing locations.

### WS2-02 · P1 · S · Fix the @scoring agent's drifted rules; single-source to the spec (F-17)
In `.claude/agents/scoring.md`: delete the "Critical business rules (quick reference)" + "Edge Cases" blocks (lines ~18-55, ~62% duplication of the spec), keeping mandatory-reading pointers, capabilities, and purity constraints; the "max 2 total" bonus heading (:34) is WRONG (real max = 7: 5 target + 2 rookie; the 2-cap applies only to the rookie component — scoring-engine.ts:210-211, :314-316). In `.specs/features/scoring-engine.md`: add the standings tie-breaker rule shipped in 49184f7 (points tie broken by total targets descending) so it has a spec home.

**Acceptance**: scoring.md contains zero restated scoring rules (pointers only) and no "max 2 total"; scoring-engine.md documents the tie-breaker; the spec's worked example (bonusPoints=7) remains authoritative.

### WS2-03 · P1 · S · Make the hook actually bind and actually detect (F-19, F-20, F-59, F-60)
Rewrite `scripts/check-constitution.sh`:
- **Binding**: on hard violations (>750 lines, `var` declaration) emit PostToolUse JSON (`{"decision":"block","reason":...}`) or exit 2 with the message on stderr; warnings go via `hookSpecificOutput.additionalContext`. Update the header comment to match the real contract. Grandfather current violators (score-service.ts until WS4-02 lands) via a small allowlist so the hook can be strict on new files.
- **Firestore grep** (also in `.claude/skills/check/SKILL.md:20` and `.claude/agents/reviewer.md:26`): replace `getDocs(collection(` with a check that flags any `getDocs(` in src/ whose file lacks a nearby `where(`/`limit(`, requiring an inline `// unbounded-ok: <reason>` annotation for deliberate scans (add that annotation to the intentional scan at score-repository.ts:357).
- **BSD-grep fixes**: replace `\s` in BRE with `[[:space:]]` or use `grep -E`; anchor the var check to declaration position; scope the handler grep to HTML-attribute context so `btn.onclick=handler` (JS listener assignment) stops false-positiving.
- **Fail loud**: `command -v jq >/dev/null || { echo '...jq missing, checks skipped' >&2; exit 0; }` (or drop jq via bash regex parsing); widen the extension gate to `*.ts|*.html` so src/index.html is checked.

**Acceptance**: piping a crafted file with `var x=1` through the hook produces a blocking response (nonzero exit or decision:block JSON); a file with `getDocs(query(collection(db,'x')))` and no where/limit is flagged; a file containing only `// var z = 3` and string/template mentions of var produces NO violation; running with jq removed from PATH prints a loud stderr warning (or, if the jq dependency was dropped for bash regex parsing, the script contains no jq invocation).

### WS2-04 · P2 · S · Commit the hook wiring (F-39)
Remove `.claude/settings.json` from `.gitignore` (keep `.claude/settings.local.json` ignored); commit the settings file containing the PostToolUse hook; change the hook command to `bash "$CLAUDE_PROJECT_DIR/scripts/check-constitution.sh"` so it survives cwd changes and worktrees.

**Acceptance**: `git ls-files .claude/settings.json` returns the file; a fresh worktree gets the hook; the command is $CLAUDE_PROJECT_DIR-anchored.

### WS2-05 · P2 · S · Add YAML frontmatter to the three agents (F-41)
Add to `.claude/agents/speckit.md`, `reviewer.md`, `scoring.md` (~10 lines each): `name`, a trigger-worthy `description`, `tools` allowlist — reviewer: Read/Grep/Glob + read-only Bash (its job is audit; it must NOT inherit Firebase MCP deploy/firestore-write tools); scoring: Read/Grep/Bash; speckit: those plus Write scoped to .specs/. Optional model pin.

**Acceptance**: all three files open with a valid `---` frontmatter block including name, description, and tools; reviewer's tool list contains no write/deploy-capable tools.

### WS2-06 · P2 · S · Fix /implement spec resolution + speckit output convention + trigger tightening (F-18, F-61)
- `.claude/skills/implement/SKILL.md`: resolve `<argument>/spec.md` first, then `<argument>.md`; change the no-argument fallback from "most recently modified file" to list-and-ask; require the skill to state which spec it resolved and get confirmation before editing.
- `.claude/agents/speckit.md:33`: emit the directory convention for multi-file specs (`.specs/features/<nnn>-<name>/spec.md` + `tasks.md`), matching what 002 actually did.
- Tighten skill trigger phrases: check ("constitutional check" not "run checks"/"validate changes"), constitution ("constitution dashboard" not "current state"), implement ("implement the spec"/"execute spec" not "build the feature").

**Acceptance**: `/implement 002-multi-user-rbac` (or any directory spec) resolves to its spec.md; no-arg invocation lists specs and asks; no skill description contains the over-broad phrases above.

### WS2-07 · P2 · M · Single-source the forbidden-pattern ruleset (F-40) — **recommend promotion to a full spec** (see end of file)
Create `scripts/forbidden-patterns.json` (or .yaml): one entry per rule with id, constitution §-ref, severity (warn/forbid), detector (regex/command), scope glob, and enforced-by. Rewrite check-constitution.sh (after WS2-03) to iterate it; make `/check` invoke the same script with a `--changed` mode; reduce the rule listings in reviewer.md, speckit.md, check/SKILL.md, and CLAUDE.md to pointers; fix the canon inconsistency (constitution §IV.2:336 ">500 lines forbidden" vs §II.3's 750-hard/500-warn — 750/500 wins); add an "Enforced-by" column to §IV.2; add the missing rules to the machine list where detectable (innerHTML-with-interpolation, client-side filtering as a documented-only rule if undetectable).

**Acceptance**: exactly one machine-readable ruleset file exists; hook and /check both execute it; grep shows reviewer.md/speckit.md/check/SKILL.md carry no independently-maintained rule regexes; the constitution names its enforcement layer.

### WS2-08 · P2 · S · Purge the phantom skill; surface the real one (F-42, F-57 roster)
In constitution §VII.1 (~:456-459): remove `firebase-best-practices` (does not exist in ~/.claude/skills/) and add `firebase-deploy-runbook` (exists, load-bearing in speckit.md:79) — or replace the hand-list with "see `ls ~/.claude/skills/`" plus the 2-3 project-critical skills (firebase-deploy-runbook, firebase-cost-resilience, firebase-security). Fix the same phantom at speckit-integration-guide.md:91/:117/:480 and architectural-evolution-strategy.md:204.

**Acceptance**: `grep -rn "firebase-best-practices" .specs/ .prompts/ .claude/` returns nothing; the constitution's skill roster matches `ls ~/.claude/skills/`.

### WS2-09 · P2/P3 · M · Consolidate the meta framework to its operational half (F-37, F-43, F-62, F-63)
End state for `.prompts/meta/`: exactly `architectural-decision-log.md`, `architectural-evolution-strategy.md` (optionally trimmed of Phase-3/4 enterprise tiers), `spec-authoring-guidelines.md`.
- Archive/delete `prompt-maintenance.md` (dead 358-line process for a prompt library dismantled 2026-04; replace with a ~15-line quarterly checklist in constitution §VIII.1 targeting what actually drifts: .specs/technical/*, .specs/README.md, constitution counts, feature statuses, with one "Next review due" date).
- Delete or drastically slim `speckit-integration-guide.md` (567 lines; its 80%-commit-citation metrics and archive rituals never happened — 3/635 commits): fold the ~60 live lines (what-goes-where boundary table §I.1, precedence rule §X) into .specs/README.md.
- WIRE `spec-authoring-guidelines.md` (keep as-is — it is correct): add to speckit.md's mandatory-reading list and constitution §VII.2; extend its scope note to cover agent files ("agents reference specs, never restate rules").
- Update constitution §VII.2 to list the surviving three docs. (prompt-gap-protocol.md already handled in WS2-01.)

**Acceptance**: `.prompts/meta/` contains three (or three + archive/) files; spec-authoring-guidelines has ≥2 inbound references including speckit.md; constitution §VII.2 lists only existing docs; no doc claims metrics or lifecycles that git history contradicts.

---

## WS-3 — Correctness hardening

### WS3-01 · P1 · M · Stop publishWeek from rewinding standings and currentWeek (F-05)
In `src/services/score-service.ts` publishWeek (~:196-264): read the existing season doc and write `currentWeek: Math.max(existing?.currentWeek ?? 0, weekNumber)`; compute standings via `_computeStandings(computed, maxWeek)` through that max (entries for all weeks are already fetched via getEntries). Fix the test at score-service.test.ts:1044-1056 that currently PINS the buggy overwrite ("currentWeek equals the published weekNumber") and add: publish week 5 then republish week 2 → season.currentWeek stays 5 and standings include weeks 1-5. Optionally add a UI confirm in score-entry-tab when publishing a week < currentWeek. Note for a follow-up (can fold into WS4-02): unify the three standings derivations (publishWeek-from-entries, deleteTeam-from-week-docs, home-standings client sums) so stored week docs and season.standings can never disagree.

**Acceptance**: the republish-earlier-week test passes; manual flow in the emulator: publish W5, edit + publish W2 → home page still shows weeks 1-5 and season standings through W5.

### WS3-02 · P1 · S · Derive teamId from the team document ID, not a re-slugified name (F-08)
In `src/services/score-service.ts`: publishWeek (:237) and `_computeStandings` (:1063) must resolve teamId from the fetched Team doc's `.id` (lookup against teamsResult.data by name) instead of `_slugify(team.name)`. Add a regression test: create team, rename via updateTeamMeta, publish a week → the week doc's teamResults[].teamId equals the team doc ID (schema contract at .specs/technical/firestore-schema.md:124). Optionally extend cascadeTeamRename (score-repository.ts:290-304) to normalize teamId in pre-existing week docs.

**Acceptance**: after a mid-season rename, publish → deleteTeam of another team → home standings show ONE row for the renamed team; scoresheet-generator (tr.teamId === team.id, :160) matches all weeks.

### WS3-03 · P1 · M · Deduplicate the starting-average blend rule (F-02)
Refactor `buildPriorAvgMap` (score-service.ts:977-1014) to accumulate per-shooter (startingAvg, scores[]) and delegate the final number to `computeShooterAverage` (scoring-engine.ts:125-134), deleting the inlined `< 2 weeks` arithmetic and the "Mirror computeShooterAverage" comment. Preserve the intentional adaptations explicitly and with comments: startingAvg 0→35 corrupt-data handling (tested at score-service.test.ts:148-156), cross-team name-keyed accumulation, toFixed(1) rounding; decide (and test) whether dummy shooters should be excluded (isDummyName filter currently missing at :992). Then move buildPriorAvgMap (pure, no I/O) into scoring-engine.ts next to the rule it depends on (coordinates with WS4-02's split). Add one equivalence test: for a single-team shooter, buildPriorAvgMap's output equals computeShooterAverage's.

**Acceptance**: exactly one implementation of the <2-weeks blend exists (grep for `(startingAvg + total)` in score-service.ts returns nothing); all existing tests pass; the equivalence test pins engine↔map agreement.

### WS3-04 · P1 · M · Validate Firestore doc shapes at the repository boundary; honor the no-throw contract (F-09)
In `src/repositories/score-repository.ts`: replace the five `as unknown as` double-casts (:131, :148, :168, :201, :215) with small plain-TS guard functions (no new deps) validating SeasonEntry/WeekResult/Team/Season — shooters is an array, total is a finite number, required strings present — returning `failure('MALFORMED_DOC')` on violation. Wrap `ScoreService.publishWeek`'s body in try/catch returning failure (its header at :7 promises "never throws across module boundaries" but entry.shooters.filter at :206 can throw and wedge the Publishing… button, score-entry-tab.ts:389-392). Tests: a doc with `total: "42"` (string) and a doc missing `shooters` both yield failure Results, never a throw and never published standings.

**Acceptance**: no `as unknown as` remains in score-repository.ts; the two malformed-doc tests pass; publishWeek returns a failure Result (button re-enables) on any malformed input.

### WS3-05 · P1 · S · Regression tests for the markdown sanitizer (F-10)
Add `src/utils/markdown.test.ts` (~30 lines) with `// @vitest-environment jsdom` (add jsdom devDep): assert renderMarkdown neutralizes the exact payload class from commit c11b79a (`<img src=x onerror=alert(1)>`), plus `<script>`, `javascript:` hrefs, and preserves the deliberate behaviors (images stripped, GFM line breaks). Purpose: a dependabot marked/dompurify major or an agent "simplification" that drops the DOMPurify.sanitize wrapper must fail CI.

**Acceptance**: test file exists and passes; temporarily removing the sanitize wrapper makes it fail.

### WS3-06 · P2 · S · Quote-safe escapeHtml, single implementation, tested (F-06)
Replace `escapeHtml` in `src/modules/ui.ts:5-9` (DOM textContent trick — quote-blind) with a replacement-table function covering `& < > " '`; delete the hand-rolled duplicate escaper in `src/components/home-announcements.ts:45-48` and import the shared one; add a unit test asserting quotes are encoded. In `src/components/admin-users-panel.ts:159`, prefer setting aria-label via setAttribute (or rely on the now-quote-safe escapeHtml) so a displayName like `x" autofocus onfocus="` cannot break out of the attribute.

**Acceptance**: one escapeHtml implementation repo-wide; test proves `"` → `&quot;`; a crafted displayName in the emulator renders inert in the Users tab.

### WS3-07 · P2 · S · Escape Firestore-sourced names in the three public components (F-07)
Route every interpolated name through escapeHtml (after WS3-06) or convert to DOM+textContent (the admin-tabs pattern): `home-standings.ts:228-229, :277-278` (accolade shooter/team names, standings teamName/captain), `season-scorecards.ts:125, :136`, `scoresheet-generator.ts:171, :193-198, :218`. Add the rule "no `${…}` interpolation of Firestore-typed values inside innerHTML templates" to the constitution's forbidden patterns / WS2-07 ruleset so the hook can detect recurrence.

**Acceptance**: a team named `<b>Bold</b> & "Co"` renders literally (no markup) on home standings, scorecards, and generated scoresheets; the pattern is in the ruleset.

### WS3-08 · P2 · S · Propagate Results in deleteTeam and removeShooterFromRoster (F-25)
`src/services/score-service.ts`: deleteTeam (:500-507) must check the getAllWeekResults and updateSeason Results — on failure return failure (or a documented success-with-warning code) instead of unconditional success; removeShooterFromRoster (:568-589) same for the accolade-cleanup weeks read. Update the admin UI toast path to surface "deleted, but standings recompute failed — retry" when applicable. Tests: stub the repository to fail the follow-up read and assert the returned Result is not a bare success.

**Acceptance**: with a failing weeks read stub, both methods return non-success (or warning-coded) Results and the tests pin it.

### WS3-09 · P2 · S · Restrict users/{uid} self-update to an allowlist (F-27)
`firestore.rules` (~:24-31): constrain self-update to `request.resource.data.diff(resource.data).affectedKeys().hasOnly(['lastSignInAt','updatedAt'])` (the only legitimate client write is touchLastSignIn, user-repository.ts:82-94); tighten or drop self-create (onUserCreate seeds the doc server-side with the real Google identity). Update tests/rules/users.test.ts: the existing "user can update own non-role fields" test (which currently PINS the vulnerability by updating displayName) must flip to assertFails for displayName/email self-edits; add assertSucceeds for the timestamp-only touch.

**Acceptance**: rules tests prove a signed-in user cannot change their own displayName/email mirror but touchLastSignIn still works; admin/owner paths unaffected.

### WS3-10 · P2 · S · Re-entrancy guards on async select handlers (F-23)
Add a per-method generation counter (`const gen = ++this._loadGen;` before the await; `if (gen !== this._loadGen) return;` after) in: `score-entry-tab.ts` `_populateShooterRows` (~:160-175), `home-standings.ts` `_loadYear` (~:78-118), `season-scorecards.ts` `_loadYear` (~:94-105), and any `_loadSeasons`. Three lines per site.

**Acceptance**: rapid team-switching with a throttled network in the emulator never renders merged rosters; last-selected team always wins; same for year dropdowns.

### WS3-11 · P2 · S · Bound getAnnouncements; make indexes.json the declared source of truth (F-24)
`src/repositories/score-repository.ts:455-464`: add `orderBy('postedAt', 'desc'), limit(20)` to the announcements query (dropping the in-memory sort); declare the required year+postedAt composite index in `firestore.indexes.json`; add a comment in that file noting the CI deploy uses `--force`, which deletes any console-created index absent from this file (coordinate with WS1-07's schema-doc index section). Deploy the index before/with the query change.

**Acceptance**: getAnnouncements carries orderBy+limit; firestore.indexes.json declares the matching composite index; announcements page works against prod after deploy.

### WS3-12 · P2 · S · Real cache tests: invalidation, hit, TTL (F-30)
`src/services/score-service.test.ts`: rework the two tests named "clears the teams cache on successful deletion" (:824-838, :855-868 — they currently assert only result.success) to count repository call totals across delete→getTeams, following the pattern already used by the publishWeek test (:1117-1142); add one cache-hit test (two getTeams calls → exactly 1 repo call) and one vi.useFakeTimers test advancing past CACHE_TTL_MS (1 hr, score-service.ts:18) asserting a re-fetch. ~40 lines.

**Acceptance**: deleting the `this.cache.delete('teams:…')` lines in score-service.ts makes at least one test fail; TTL expiry is covered by a fake-timer test.

### WS3-13 · P2 · M · Emulator tests for repository cascades; add coverage reporting (F-29)
Highest-value target: `score-repository.ts`'s cascadeTeamRename and deleteTeam multi-document batches (:280-390) — test against the Firestore emulator reusing the tests/rules harness pattern (tests/rules/_setup): rename cascades to entries + week docs; delete removes team, its entries, its teamResults and standings rows. Add `@vitest/coverage-v8` and a non-gating `test:coverage` script so the UI/repository gap (currently: zero tests under src/components, src/views, src/modules, src/repositories) is measurable. Do NOT chase a coverage percentage.

**Acceptance**: cascade tests run in CI (new or existing emulator job) and fail if the batch logic regresses; `npm run test:coverage` produces a report.

### WS3-14 · P3 · S · Close the three rules-test deny gaps (F-55)
`tests/rules/seasons.test.ts`: add ~6 assertions — asAnon setDoc against teams/weeks/entries (assertFails), asAnon getDocs(entries) (assertFails), and admin deleteDoc against a seasons/{year}/weeks doc (assertFails — rules grant weeks only create/update, delete is implicit-deny and currently untested). The asAnon helper pattern exists in users.test.ts.

**Acceptance**: the six assertions pass against current rules and would fail if a refactor accidentally opened anon writes or week deletes.

### WS3-15 · P3 · S · Normalize shooter-name matching in the publish path (F-51)
`src/services/score-service.ts`: apply normalizeShooterName to both sides at `_buildSeasonData` :768 (`shooters.find(...)`) and publishWeek :232 (roster-name Set), matching the five existing normalized comparison sites (:528-531, :854, scoresheet-generator.ts:163). Optionally canonicalize free-text substitute names to roster spelling at save time in score-entry-tab (:284). Test: an entry with "john smith" matches rostered "John Smith" (no phantom 35-average duplicate).

**Acceptance**: the case-variant test passes; no raw `s.name === entryShooter.name` comparison remains in the publish path.

### WS3-16 · P3 · S · Fix the getEntries implicit 10-team ceiling (F-47)
`src/repositories/score-repository.ts:212`: replace `limit(maxWeekNumber * 10)` with a constant derived from the real bound — `limit(15 * 20)` (MAX_WEEKS × the 20-team cap getTeams already uses at :101) — or drop the limit (≤300 docs, trivially bounded). Add an `// unbounded-ok`-style comment if dropping (coordinates with WS2-03's detector).

**Acceptance**: publishing with 11+ teams seeded in the emulator produces standings containing all teams.

### WS3-17 · P3 · S · Make ScoreService caching internally consistent (F-48)
`src/services/score-service.ts`: route computeRosterDefaults (:344-350) and computeShooterDefaults (:392-397) prior-year reads through the cached `this.getTeams`/`this.getAllWeekResults` (same Result shape — mechanical substitution); cache null single-doc results by relaxing the `result.success && result.data` guards in getSeason (:70), getWeekResult (:119), getLatestWeekResult (:147) to cache nulls too.

**Acceptance**: two consecutive computeRosterDefaults calls issue prior-year repo reads only once (call-count test); a getSeason for a nonexistent year hits the repo once across repeated calls within TTL.

---

## WS-4 — Structural refactors

### WS4-01 · P1 · M · Composition root + written component contract + migrate five components (F-01) — **recommend promotion to a full spec, combined with WS4-02** (see end of file)
Create `src/services/app-services.ts` (~30 lines): lazily-built `getServices()` returning ONE `createRepositoryFactory({ db })` + ONE shared ScoreService. Replace the seven module-level constructions (home-standings.ts:16-17, home-announcements.ts:15-16, site-banner.ts:13-14, season-scorecards.ts:15-16, season-calendar.ts:24-25, scoresheet-generator.ts:16-17, admin-panel.ts:31-32) with imports of the shared instance; admin-tab constructor injection stays as-is. Write the component contract into the codebase (constitution §III or a src/components/README): shared service via composition root; innerHTML only for static markup; user data via textContent/escapeHtml; disconnectedCallback teardown; skeleton→data→error states. Result: publishWeek's existing invalidation (score-service.ts:261-264) reaches the cache the home page reads, ending the up-to-1-hour stale-standings-after-publish window.

**Acceptance**: `grep -rn "new ScoreService" src/` matches only app-services.ts (and tests); emulator flow: publish a week, navigate Home without reload → new week visible immediately; same for a new announcement.

### WS4-02 · P2 · M · Three-way split of score-service.ts (F-21; enables F-02's final move) — **promotion candidate with WS4-01**
Split the 1,079-line file: (1) `src/services/score-service.ts` keeps the ScoreService class only, with `assertValidYear`/`assertValidWeek` helpers replacing the 18 copy-pasted `year < 2019 || year > 2100` guards (budget ≤450 lines); (2) new `src/services/scorecard-builder.ts` gets _buildSeasonData + _buildScorecardTeamBlock (~300 lines, pure); (3) scoring-engine.ts (or `src/services/standings.ts`) absorbs buildPriorAvgMap (per WS3-03), _computeStandings, _recomputeStandingsFromWeeks. Also collapse main.ts's six near-identical _showX handlers (:147-187) into a data-driven route table. Pure moves — no behavior change; run the full suite before/after. Remove the WS2-03 hook allowlist entry once under 750.

**Acceptance**: `wc -l src/services/score-service.ts` ≤ 750 (target ≤450); `grep -c "year < 2019" src/services/score-service.ts` ≤ 1; all 203+ unit tests pass unmodified (import paths aside); hook no longer flags the file.

### WS4-03 · P1 · S · CI build gate + gate the production deploy (F-03)
`.github/workflows/ci.yml`: add a `build` job running `npm ci && npm run build` (works without VITE_ secrets) and `npm --prefix functions ci && npm --prefix functions run build` (tsc — currently type errors in functions/ pass all CI). Branch protection/ruleset for main: mark all five jobs (typecheck, test, test-rules, test-functions, build) as required status checks — the current ruleset (id 13744523) requires NONE. Gate `deploy-production.yml` on CI success (workflow_run on CI completion, or move deploy jobs behind `needs:` in a combined workflow); add a `concurrency` group so rapid merges cannot deploy out of order. Note: deploy-preview.yml skips dependabot, which is fine once the build job runs on all PRs.

**Acceptance**: a PR with a functions type error or a vite build break cannot merge (red required check); a commit on main with failing tests does not reach `firebase deploy`.

### WS4-04 · P2 · S · index.html Cache-Control: no-cache (F-04)
`firebase.json` headers (~:55-60): change `**/*.html` from `public, max-age=3600, must-revalidate` to `no-cache` (revalidate every navigation; ~4 KB shell → one 304 per visit). Keep the immutable 1-year policy on hashed assets. Ends the up-to-1h stale shell after every deploy and the rare eviction-race blank page.

**Acceptance**: `curl -sI https://citl.club/ | grep -i cache-control` shows no-cache after the next deploy; hashed assets still serve immutable.

### WS4-05 · P2 · S · ESLint flat config + CI lint step (F-28)
Add eslint + typescript-eslint devDeps and a ~25-line `eslint.config.js` (typescript-eslint recommended; `no-console: ['error', {allow: ['warn','error']}]`; `no-var`) covering src/, functions/src/, tests/, scripts/; `"lint": "eslint ."` in package.json; `- run: npm run lint` appended to ci.yml's typecheck job (and to WS4-03's required checks). The orphaned eslint-disable comments in appcheck.ts/firebase-config.ts become live. Fix or annotate whatever the first run surfaces (keep the initial rule set small enough to land in one session).

**Acceptance**: `npm run lint` passes locally and in CI; removing an eslint-disable comment in appcheck.ts makes lint fail (proving the rules run).

### WS4-06 · P2 · M · Split main.css along its banner sections (F-22)
Split the 2,182-line `src/styles/main.css` along its existing ~25 banner sections into `src/styles/{tokens,base,nav,banner,layout,tables,buttons,forms,toast,admin,scoresheet,print}.css`; import the list from main.ts (Vite bundles into the same single CSS asset — zero runtime cost). Pure move: the concatenated output must byte-match (order-preserved) or visually verify all pages. Optional follow-up (separate PR): import admin.css from admin-panel.ts so Vite code-splits the ~1,020 admin-only lines out of the public payload.

**Acceptance**: no file under src/styles/ exceeds ~500 lines; built CSS renders identically on home, scorecards, calendar, rules, admin (visual check); admin selectors live only in admin.css.

---

## WS-5 — Opportunistic sweep (one cleanup session; P3 items plus the P2 decision item WS5-02)

### WS5-01 · P3 · S · Delete dead exports (F-50)
Remove `lookupYardage` from src/utils/yardage.ts (+ its test cases; the app renders YARDAGE_TABLE directly — keep the table), `StandingRow` (src/types/score.ts:33), `TeamTopShooter` (src/types/season.ts:48). If yardage automation is ever planned instead, make lookupYardage boundary-based (min thresholds only) — but default is delete.

**Acceptance**: typecheck + tests pass; grep for the three names returns nothing outside git history.

### WS5-02 · P2 · M · Decide the season-awards pipeline: finish or delete (F-26) — **requires maintainer decision**
`src/services/scoring-engine.ts` computeSeasonAwards (:421-487) + computeMostImprovedScore (:413-415) and `src/firebase-config.ts` validateFirebaseConfig (:35) are dead in the app. Ask Tyler: is a season-awards feature planned? If yes → finish (compute team placements from standings instead of hardcoded nulls, emit the Firestore SeasonAwards shape per types/season.ts, guard the startingAvg=50 divide-by-zero) as its own feature spec. If no → delete all three plus their tests, leaving a TODO in scoring-engine.md.

**Acceptance**: either a working, wired awards path with placements and no NaN edge, or zero dead awards/validateFirebaseConfig code remaining.

### WS5-03 · P3 · S · Dead-link sweep (F-58, remainder after WS-1)
Fix the constitution's repo-root-relative links to true relative paths (`../.prompts/meta/…`, `./technical/…`); in `.specs/features/002-multi-user-rbac/`: copy the still-relevant content of the machine-local "Plan of record" (/Users/ted/.claude/plans/i-recently-implemented-…mochi.md — unrecoverable on other machines; salvage from this machine if it still exists, else note it lost) into a plan.md beside the spec and delete the external link; adopt the rule ".specs/ files never link paths outside the repo"; convert tasks.md's `file.ts:22`-style markdown link targets to plain-text code spans. Then run a link check over all .md files.

**Acceptance**: a relative-link checker over the repo's markdown reports zero dead links (excluding archived files if any).

### WS5-04 · P3 · S · CSP trims and hash guard (F-56, F-46)
- Remove the dead `https://cdnjs.cloudflare.com` allowances from style-src and font-src in firebase.json:88 (Font Awesome removed per ADR-008; zero cdnjs references remain in src/); verify no stylesheet/font 404s on a preview channel.
- Add a ~5-line predeploy/CI script that extracts the single inline script from src/index.html, computes its base64 sha256, and diffs against the pin in firebase.json's script-src — fail loudly on mismatch; add a comment above the inline script in index.html naming the coupling.

**Acceptance**: CSP contains no cdnjs; whitespace-editing the theme snippet without updating firebase.json fails the new check before deploy.

### WS5-05 · P3 · S · Dev-environment functions fixes (F-49, F-54)
- package.json: prefix the dev/dev:seeded/emulators scripts (or add a predev script) with `npm --prefix functions ci --silent && npm --prefix functions run build` so a fresh checkout gets working onUserCreate/setUserRole in the emulator; add one line to CONTRIBUTING.md's fresh-checkout section.
- functions/package.json: delete or repoint the `test`/`test:watch` scripts (they find zero tests; real tests are repo-root tests/functions/ under the emulator wrapper) — e.g. `"test": "npm run test:functions --prefix .."` with a comment.

**Acceptance**: on a fresh clone (or after `rm -rf functions/lib functions/node_modules`), `npm run dev:seeded` yields a working emulator where signing in seeds users/{uid}; `npm test` inside functions/ either runs the real suite or clearly redirects.

### WS5-06 · P3 · S · Type-home and comment hygiene (F-44, F-45)
- Move Result/success/failure from src/repositories/score-repository.ts:38-49 to `src/types/result.ts`; update importers (score-repository, modules/auth.ts:34, any others); either convert user-repository.ts to the Result contract or add a header comment declaring its throwing convention intentional and why.
- src/services/admin-user-service.ts:8-9: either make the pagination cursor opaque (expose lastCreatedAt and re-query with startAfter, removing DocumentSnapshot from ListUsersPage and from admin-users-panel.ts:21/:42) or correct the header comment to say the cursor is a pass-through Firestore snapshot.

**Acceptance**: modules/ no longer imports types from a concrete repository; no file header makes a boundary claim its own exports violate.

### WS5-07 · P3 · S · Rules narrowing + revocation-window documentation (F-53, F-52)
- firestore.rules: narrow `match /config/{doc}` public read to `match /config/banner`; default-deny other config docs; add one rules test that config/other is unreadable anonymously.
- Document the ≤1h hostile-client revocation window (custom-claims token lifetime; setUserRole does not call revokeRefreshTokens) in .specs/features/002-multi-user-rbac/spec.md §VI; soften src/modules/auth.ts:134-141's comment from "immediately" to "immediately, for cooperative clients (hostile clients retain the claim until token expiry, ≤1h)".

**Acceptance**: rules test proves config/other denies anon read while config/banner allows; spec §VI and the auth.ts comment both state the residual window.

---

## Recommended promotions to full `.specs/features/NNN-*/` specs

Per the promotion bar (L-effort AND cross-cutting AND needs design decisions), two items qualify. **Do not create the spec files as part of this backlog — run @speckit for each when picked up.**

1. **Score-service decomposition + composition root (WS4-01 + WS4-02, absorbing the derivation-unification note in WS3-01 and the buildPriorAvgMap relocation in WS3-03)** — together this is L-effort and cross-cutting (touches all 7 components, the service layer, the scoring engine, main.ts routing, and the standings storage model) and needs real design decisions: where the composition root lives and its laziness semantics, what the written component contract mandates, which module owns the pure standings functions, and whether to unify the three standings derivations by rewriting week docs on every publish. Findings: F-01 (P1), F-21 (P2), plus F-02/F-05 interplay.

2. **Forbidden-pattern ruleset single-sourcing (WS2-07)** — borderline (M-effort) but cross-cutting across six locations (constitution ×2, hook, /check, reviewer, speckit) and needs design decisions: the machine-readable schema, warn-vs-block semantics per rule, the grandfathering/allowlist mechanism, and how /check and the hook share one detector without diverging again. Findings: F-40 (P2), enabling F-19/F-20 fixes to stay fixed.

Everything else in this backlog is S/M-effort and executable directly from the acceptance criteria above.

---

## Post-WS-4 follow-ups (added 2026-07-12, at spec 003 close-out)

Spec 003 ([archive/003-service-decomposition](../../features/archive/003-service-decomposition/spec.md), shipped in PRs [#214](https://github.com/salmoncow/citl/pull/214)/[#215](https://github.com/salmoncow/citl/pull/215)) deferred two items into this backlog:

### FU-01 · L · Unify the standings derivations in `src/services/standings.ts`; decide whether publish rewrites week docs — **requires its own spec**
Per spec 003 **DD-4** (deferral rationale recorded there): the two server-side derivations (`computeStandings` from entries in the publish path; `recomputeStandingsFromWeeks` in the deleteTeam/removeShooterFromRoster path) now sit side-by-side in `src/services/standings.ts` behind a shared header note documenting their invariant, and `home-standings.ts`'s client-side cumulative sum over week docs remains a third derivation. True unification (e.g., rewriting all previously published week docs on every publish so one derivation feeds both stored representations) is a **storage-model behavior change** — it alters write volume per publish and the stored shape — so it cannot ship as a pure refactor. Absorbs the WS3-01 follow-up note. Run @speckit when picked up; the design decisions are which derivation becomes canonical, whether publish rewrites week docs, and how the home-page historical-week view is fed afterward.

**Acceptance** (for the eventual spec): identical season states can never yield disagreeing `season.standings` vs. week-doc standings rows; the number of standings derivations in src/ drops from three to one (or a spec documents why a client-side view derivation intentionally remains).

### FU-02 · M · Optional API-splitting spec for `score-service.ts` (accepted at 749 lines, >500 advisory)
Per spec 003 **Open Question 1 resolution** (maintainer, 2026-07-11): PR-2's pure moves landed `score-service.ts` at 749 lines — under the 750 hard cap and de-grandfathered, but still in >500 warn territory. Going meaningfully lower requires extracting I/O-bearing service methods — announcements/banner into an `announcement-service.ts` and the roster-defaults orchestration into its own service — which changes the class's public API surface used by components (beyond pure moves), so it was deliberately kept out of PR-2. Decide whether the warn state is acceptable long-term or run @speckit for the API split; the extraction would take the file well under 500 lines.

**Acceptance** (if pursued): `wc -l src/services/score-service.ts` < 500; hook reports no size advisory; component call sites migrate to the new services via the composition root with no behavior change.
