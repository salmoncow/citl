# Project Constitution: citl.club (Central Illinois Trap League)

**Version:** 1.12.1
**Last Updated:** 2026-10-10
**Scope:** All development on the citl-static project
**Review Frequency:** Quarterly (next review: 2026-10-10)

---

## Introduction

This constitutional spec establishes the governing principles, standards, and constraints for
citl.club. It is the single source of truth for project-specific requirements.

Foundational guidance for architecture, security, testing, and Firebase patterns is provided
by global Claude Code skills (`~/.claude/skills/`) that auto-activate based on context.
Project-specific strategic frameworks remain in `.prompts/meta/`.

---

## I. Core Principles

### I.1 Progressive Complexity

**Philosophy**: Start simple, add complexity only when justified by measurable pain.

**Principles:**
- Measure before evolving — use decision triggers from `architectural-evolution-strategy.md`
- Avoid premature optimization and over-engineering

**Reference**: [.prompts/meta/architectural-evolution-strategy.md](../.prompts/meta/architectural-evolution-strategy.md)

### I.2 Platform Simplification

**Philosophy**: Minimize platforms and dependencies to reduce operational overhead.

**Constraints:**
- **Maximum platforms**: 2–3 total
- **Current platforms**: Firebase + GitHub + AWS (3 platforms — at the maximum).
  AWS is limited to Route 53 DNS and SES email (ADR-015); any other AWS service needs its
  own ADR.
- **New platform addition requires**:
  - All decision triggers met (see `operations-principles` global skill)
  - Explicit justification why existing platforms are insufficient
  - Documented evaluation of extending current platforms first

### I.3 AI-Assisted Evolution

**Philosophy**: Choose technologies that support future AI-assisted migrations.

**Requirements:**
- Select technologies with ≥80% AI migration capability
- Document patterns clearly for future AI refactoring
- Maintain clear migration paths between architectural states
- Current technology choices:
  - TypeScript + Web Components → Lit (95% AI-assisted migration)
  - Lit → React (80% AI-assisted migration)

**Reference**: [.prompts/meta/architectural-evolution-strategy.md](../.prompts/meta/architectural-evolution-strategy.md) §II.1

---

## II. Architectural Standards

### II.1 Current Architectural State

**Last Updated**: 2026-10-06
**Last Architecture Review**: 2026-10-06

| Domain | Current State | Status |
|--------|---------------|--------|
| **UI Components** | Web Components under `src/components/` (24 custom elements + 5 helper modules + 11 `admin-tabs/` modules); hash router + page-level views under `src/views/`. See the `src/` tree for the current inventory. | Live |
| **Security** | Firebase Auth (Google, email link; optional public member accounts, spec 008 / ADR-012) + Firestore rules + App Check + custom-claim RBAC (`role: 'owner' \| 'admin' \| 'user'`); Cloud Functions are sole writer of role claim, mirror and account status | Complete |
| **Data** | Firestore is the single data layer — drives home page, scorecards, RBAC user mirror, member profiles, member league requests and coordinator review (specs 009–010), email preferences and the outbound mail queue (spec 011), and audit log | Live |
| **Testing** | Vitest unit tests (scoring engine, score service, standings/highlights/preview services, schedule/yardage/heat/sparkline/markdown utils, rules-text regression); rules-unit-testing matrix (155 cases); function unit tests (140 cases). See §III.1. | Active |
| **Deployment** | GitHub Actions CI/CD: PR/push runs typecheck + build + three test suites; production deploy is gated on CI success (`workflow_run`) → Firebase Hosting + Firestore rules/indexes + Functions | Active |
| **Monitoring** | Manual Firebase console checks | Active |
| **Cost** | Firebase Blaze (pay-as-you-go); usage discipline targets Spark-equivalent quotas | Near 0% usage |
| **Infrastructure** | Firebase config as code (`firebase.json`, rules, indexes); AWS as CloudFormation in `infra/aws/` (ADR-015), linted in CI, deployed by the owner | Active |
| **Platform** | 3 platforms (Firebase + GitHub + AWS: Route 53, SES) | Maximum; no additions |

**Key Metrics** (as of 2026-10-06):
- **Status**: Live in production at https://citl.club (Firebase Hosting); AWS/CloudFront decommissioned
- **SPA Views**: 9 (`home`, `scorecards`, `rules`, `about`, `downloads`, `admin`, `account`, `account-team`, `privacy`)
- **Components**: 24 custom elements + 5 helper modules (`home-standings-parts`, `scorecard-render`, `league-dialog`, `registration-form`, `shooter-link-form`) under `src/components/`; 11 `admin-tabs/` modules
- **Services**: 16 (`account-service`, `admin-user-service`, `app-services`, `league-review-service`, `league-validation`, `member-league-service`, `notification-service`, `profile-validation`, `shooter-directory`, `score-entry-preview`, `score-service`, `scorecard-builder`, `scoring-engine`, `season-awards-service`, `season-highlights`, `standings`)
- **Modules**: 8 (`account-context`, `account-gate`, `auth`, `auth-providers`, `navigation`, `role`, `router`, `ui`)
- **Repositories**: 8 (`dependent-repository`, `league-repository`, `league-review-repository`, `notification-repository`, `profile-repository`, `score-repository`, `user-repository`, `repository-factory`)
- **Types**: 9 (`account`, `announcement`, `league`, `notifications`, `score`, `scorecard`, `season`, `shooter`, `user`)
- **Team Size**: 1 developer
- **Firebase Usage**: Hosting live; Firestore live (scorecards + weekly results); Cloud Functions deployed (RBAC role-writer + auth trigger; account status + delete callables, spec 008; `teamProposal` callable, spec 009; `reviewRequest` + `captainHandoff` callables, spec 010; six email functions on SES, spec 011); Blaze plan, near-zero spend

> Prefer the live `src/` tree over hard counts above — recount at review time rather than trusting these numbers.

**TypeScript**: All source files are `.ts`; `allowJs: false`; `strict: true`; `noUncheckedIndexedAccess: true`.

### II.2 Evolution Triggers

**Before increasing architectural complexity**, consult `architectural-evolution-strategy.md` for domain-specific triggers.

**General Principle**: Don't add complexity until measurable pain justifies it.

**CITL-specific thresholds**:
- **Testing**: Broad integration/E2E testing trigger already met (site live, 15+ modules). Current suites documented in §III.1.
- **CI/CD**: Active — GitHub Actions gates production deploys on CI (see §II.1).
- **Cost optimization**: Alert at 70% of any Firebase free tier limit

**Reference**: [.prompts/meta/architectural-evolution-strategy.md](../.prompts/meta/architectural-evolution-strategy.md)

### II.3 Modularity Requirements

**Principles** (distilled from `modular-architecture-principles.md`):

1. **Single Responsibility**: Each module has one clear purpose
2. **Clear Interfaces**: Module contracts documented and stable
3. **Dependency Direction**: `components → modules → services → repositories` (never reverse)
4. **Module Size**: Target <500 lines per file; split at 750 lines hard limit

**Anti-Patterns (Forbidden)**:
- ❌ God modules (>750 lines hard limit; >500 is the target/warn threshold — multiple responsibilities)
- ❌ Circular dependencies between modules
- ❌ Components calling Firestore directly (must go through service layer)
- ❌ Repositories importing from services


### II.4 Code Structure Standards

**Layer Responsibilities**:
```
src/components/    Web Components — rendering, user events, no business logic
src/modules/       Orchestration — wires components + services, manages app state
src/services/      Business logic — validation, transformation, caching, rules
src/repositories/  Data access — Firestore reads/writes only
src/types/         TypeScript interfaces and types — no runtime code
src/views/         Page-level render functions (transitional — migrate to components)
```

**Component contract**: every Web Component under `src/components/` follows the contract in
[src/components/README.md](../src/components/README.md) — shared services via the
`app-services` composition root (never a private `ScoreService`/factory), static-only
innerHTML, teardown in `disconnectedCallback`, skeleton→data→error states, re-entrancy
guards. Item 1 is hook-enforced (`no-private-service-in-component` in
`scripts/forbidden-patterns.json`).


### II.5 CITL-Specific Data Architecture

Firestore is the **single data layer** (see ADR-010, which supersedes ADR-003). It drives
the home page results feed, standings, the Scorecards page, the RBAC user mirror, and the
audit log. There is no static JSON data layer — the historical scorecards were migrated
into Firestore on 2026-02-28.

**Firestore Schema**:
```
seasons/{year}                              → Season metadata + awards
seasons/{year}/teams/{teamId}              → Team roster + totals arrays
seasons/{year}/weeks/{weekNumber}          → Weekly results + standings snapshot + accolades
leagueTeams/{teamId}                       → Persistent team identity + captain (spec 009)
teamProposals/{year}_{uid}                 → Captain's proposed roster (callable-only writes)
registrations/{year}_{uid}                 → Individual "join a team" request
shooterLinkRequests/{uid}, shooterLinks/{uid} → Account-to-scorecard-name link (coordinator approves)
captainChanges/{leagueTeamId}              → Captain handoff: nominate, accept, coordinator approves (spec 010)
profiles/{uid}/dependents/{depId}          → Minors a member registers with them
notificationSettings/{uid}                 → Email topics a member chose (spec 011)
mail/{id}, notifications/{key}             → Outbound mail queue (30-day TTL) and fan-out dedupe; functions only
```

Season data (`seasons/**`) stays admin-written. Member requests never write it; the
coordinator's review (`reviewRequest`, spec 010) is the only path from a request into a season.

Email (spec 011, ADR-015) goes out only through the `mail` queue: functions write a doc
(status emails inside the decision's own transaction), and `sendMail` re-checks the
recipient and sends through SES. No other code calls SES.

See [.specs/technical/firestore-schema.md](./technical/firestore-schema.md) for the full schema reference.

---

## III. Quality Standards

### III.1 Testing Requirements

**Current state**: three test suites and a template lint, all run in CI (see `.specs/technical/cicd-pipeline.md`):
- **Unit** (`src/**/*.test.ts`, Vitest): scoring engine, score service, schedule/yardage/markdown utils, UI helpers.
- **Firestore rules** (`tests/rules/`, `@firebase/rules-unit-testing` on the emulator): 150 cases covering the RBAC allow/deny matrix, member profiles, member league requests, and the review queue.
- **Infrastructure** (`infra/aws/*.yaml`): every CloudFormation template is linted (`cfn-lint`) and tag-checked (`scripts/check-aws-tags.py`) in CI.
- **Cloud Functions** (`tests/functions/`, emulator): 115 cases covering `setUserRole`, `onUserCreate`, `setAccountStatus`, `deleteAccount`, `teamProposal`, `reviewRequest`, `captainHandoff`, roster checks and publishing, and the league team backfill.

**Coverage posture**: business logic (scoring engine, score service) and security surfaces
(rules, functions, auth-adjacent utilities) are the priority for test coverage. The UI and
repository layers are largely untested — closing that gap is tracked in the review backlog,
not a hard gate.

**Test Pyramid target** (aspirational, if the suite grows):
- **70% Unit Tests**: Fast, isolated, individual functions / services
- **20% Integration Tests**: Service ↔ repository interactions
- **10% E2E Tests**: Full user workflows


### III.2 Security Standards

**Authentication & Authorization**:
- Public pages are unauthenticated; sign-in is **optional**. Any visitor may create a
  **member account** (Google or passwordless email link; spec 008, ADR-012).
  Accounts are adults only (18+ attestation and terms acceptance at first sign-in).
- Member-supplied data lives in `profiles/{uid}` under a rules field allowlist; the
  `users/{uid}` mirror (role, identity, account status) stays server-only. Status changes
  and deletion go through audited callables; owners/admins must be demoted first.
- Minors never hold accounts. A member registers them as dependents under their own
  profile; rosters show them as first name + last initial (spec 009, ADR-013).
- Member league requests (proposals, registrations, link requests) never write
  `seasons/**`; only the coordinator's review (`reviewRequest`, spec 010) turns a request into season data.
- Elevated access (owner/admin) is the `role` custom claim, set only by `setUserRole`.
- Never rely on client-side auth checks alone — enforce with Firestore security rules
- Scores/standings: public read, owner/admin-only write (custom claim `role`)

**Data Protection**:
- Validate all inputs before writing to Firestore
- Use `textContent` / `escapeHtml()` helper for any user-supplied content rendered to DOM
- Never commit secrets or API keys — all Firebase config in `.env` (gitignored)

**Cloud credentials and IAM** (ADR-015):
- No long-lived cross-cloud credentials. Functions reach AWS with short-lived credentials
  from `AssumeRoleWithWebIdentity` (Google-signed service-account token); no AWS access
  keys exist for the site.
- IAM is least privilege and lives in a reviewed template: named actions on named
  resources, trust limited to one principal. No `*` actions; no `*` resources on write
  actions.

**Transport / Headers**:
- `firebase.json` enforces: `X-Frame-Options`, `X-Content-Type-Options`,
  `Strict-Transport-Security`, `Content-Security-Policy`
- CSP must allow `maps.google.com` + `www.google.com` (Google Maps embed in about view)


### III.3 UX Loading States

**Requirement**: Every async Web Component that fetches Firestore data MUST show a shimmer skeleton placeholder while loading — never plain text such as `<p>Loading…</p>`.

**How to implement**:

1. At the top of any async load method (before the first `await`), set `this.innerHTML` to skeleton HTML built from the utility classes in `src/styles/admin-tables.css`.
2. Write the skeleton as a `private static` method on the component class so it can be called in both `connectedCallback` (initial render) and any year/week-change handler.
3. Shape the skeleton to match the real content — use the same number of rows, columns, and approximate widths. Exact pixel perfection is not required; structural resemblance is.

**Available CSS utilities** (`src/styles/admin-tables.css`, imported globally):

| Class | Purpose |
|-------|---------|
| `.skeleton` | Base shimmer block (apply to every placeholder element) |
| `.skeleton--sm` | 0.75 rem tall — body text / meta lines |
| `.skeleton--md` | 1.1 rem tall — normal text rows |
| `.skeleton--lg` | 1.75 rem tall — headings / table rows |
| `.skeleton--xl` | 2.5 rem tall — buttons / large controls |
| `.skeleton-group` | `flex-direction: column` container with consistent gap |
| `.skeleton-row` | `flex-direction: row` container for inline placeholder groups |

**Example pattern** (inline in `connectedCallback`):

```ts
connectedCallback(): void {
  this.innerHTML = MyComponent._skeleton();
  void this._load();
}

private static _skeleton(): string {
  return `
    <div class="skeleton-group" style="padding-top:var(--space-2)">
      <span class="skeleton skeleton--lg" style="width:50%"></span>
      <span class="skeleton skeleton--md" style="width:90%"></span>
      <span class="skeleton skeleton--md" style="width:75%"></span>
    </div>`;
}
```

**Dark mode**: The shimmer uses `--c-surface` and `--c-border` design tokens, which switch automatically — no additional dark-mode work is needed.

### III.4 Performance Standards

**Targets** (measurable at production launch):
- Page Load Time: <3 seconds (p95)
- Time to Interactive (TTI): <5 seconds (p95)
- First Contentful Paint (FCP): <1.5 seconds (p95)
- JS bundle: <250 kB gzipped (currently ~232 kB gzipped, measured 2026-10-06 ✅; the admin panel, account, sign-in, and league request UI are code-split)
- CSS: <20 kB gzipped (currently ~16 kB); fonts: self-hosted latin woff2 only, 9 files / ~187 kB if every weight loads, cached `immutable`. Figures and method: [build-system.md](technical/build-system.md#bundle-size-targets)

**Firebase Quota Constraints**: the daily target ceilings and 70% alert thresholds are
defined once in [§VI.1](#vi1-firebase-blaze-plan-with-spark-equivalent-discipline) — see that
table (do not duplicate the figures here).

**Optimization requirements**:
- Always use `limit()` + `where()` on Firestore queries — never read entire collections
- 1-hour in-memory TTL cache for season / team data (already implemented in `score-service.ts`)
- 5-minute TTL for `getLatestWeekResult()` (active-season data)
- Store and call `unsubscribe()` on any `onSnapshot()` listener


### III.5 Code Quality Standards

**Language standards (TypeScript):**
- Always `const` / `let`. Never `var`.
- Always ES6+ module syntax (`import`/`export`). No global function declarations.
- Arrow functions for callbacks; named `function` declarations for module-level exports.
- No inline event handlers in HTML (`onclick=`, `onload=`). Attach listeners in JS.
- Prefer `textContent` over `innerHTML`. Sanitize before any HTML insertion.
- Absolute imports using `@/` path alias (configured in `vite.config.js` and `tsconfig.json`)
- `noUncheckedIndexedAccess: true` — array/object access always returns `T | undefined`; use `!= null` not just `!== null` for array guard
- `strict: true` — no implicit `any`; all parameters and return types must be explicit
- Prefer `as unknown as T` over `as T` for Firestore snapshot casts
- TypeScript `interface` and `type` declarations in `src/types/*.ts` — no `@typedef` JSDoc comments

**Naming conventions**:
| Thing | Convention | Example |
|-------|-----------|---------|
| Files | kebab-case | `score-service.ts` |
| Classes / Web Components | PascalCase | `ScoreService` |
| Functions / methods | camelCase | `getStandings()` |
| Constants | SCREAMING_SNAKE_CASE | `CACHE_TTL_MS` |
| CSS custom properties | `--kebab-case` | `--color-primary` |
| Custom elements | `kebab-case` | `<standings-table>` |

**Git workflow** (see the `git-conventions` global skill):
- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `perf:`, `ci:`
- Branch naming: `feat/<desc>`, `fix/<desc>`, `chore/<desc>`, `ci/<desc>`
- All changes to `main` via Pull Request — no direct commits
- No force pushes to `main`

### III.6 Accessibility & Responsive Standards

Target **WCAG 2.x AA**. Every page, in light and dark mode:

- **Contrast**: text ≥ 4.5:1 (≥ 3:1 for large text) — SC 1.4.3; control boundaries, focus
  indicators, and other meaningful non-text UI ≥ 3:1 — SC 1.4.11. Set colors through tokens
  so both schemes are checked once (`tokens.css`).
- **Focus**: every interactive element shows a visible `:focus-visible` ring (`--c-focus`);
  keyboard operable with no traps (SC 2.1.1, 2.1.2, 2.4.7). Composite widgets (tabs, chip
  groups) follow the ARIA APG patterns.
- **Targets**: interactive controls ≥ 44px tall (`--control-height`).
- **Reflow**: no horizontal page scroll at any width ≥ 360px. Wide data scrolls inside a
  `.table-scroll` region that is labelled (`role="region"` + `aria-label`) and tabbable
  (`tabindex="0"`).
- **Motion**: honour `prefers-reduced-motion` — no shimmer, smooth scroll, or transitions.
- **Colour** is never the only signal (SC 1.4.1): pair it with text, a glyph, or an
  accessible name.

Reference implementation and rationale: spec 006 (DD-3, DD-13).

---

## IV. Technology Standards

### IV.1 Approved Technology Stack

**Frontend**:
- **Build Tool**: Vite 8.x (see `.specs/technical/build-system.md`)
- **Language**: TypeScript (strict mode, `allowJs: false`; Vite strips types via esbuild — no tsc emit)
- **UI Pattern**: SPA with hash-based router; views migrating to Web Components
- **Styling**: CSS design system ("Range Day", ADR-011) — two-layer custom properties (primitive palette `--color-*` + semantic tokens `--c-*`: grounds, text, brand/accent, focus, an always-dark `--c-shell-*` group, and a 5-step score heat ramp `--c-heat-{1..5}`); system-aware dark/light mode via `@media (prefers-color-scheme: dark)` plus the `data-color-scheme` toggle; colours belong in `tokens.css` — component CSS holds no colour literals and no `--color-*` references (only `print.css` is exempt), enforced with dark-block parity by `src/styles/tokens.test.ts` (spec 007); fonts self-hosted from `@fontsource` (Barlow, Barlow Condensed, IBM Plex Mono; latin subsets) under CSP `font-src 'self'` — no font CDN; no framework
- **Type checking**: `tsconfig.json` with `strict: true`, `allowJs: false`, `noUncheckedIndexedAccess: true` — full strict type checking; `src/vite-env.d.ts` types `ImportMetaEnv` for all VITE_* vars

**Backend / Platform**:
- **Platform**: Firebase (`citl-baed2` project, Blaze plan with Spark-equivalent usage discipline per §VI.1)
  - Firestore (NoSQL, `us-central1` region, production mode)
  - Hosting (SPA rewrite, security headers, cache rules)
  - Auth (Google, email link; role-based custom claims; optional member accounts)
  - Cloud Functions (TypeScript, Node 22, us-central1 — RBAC role-writer + auth trigger; `setAccountStatus` + `deleteAccount`, justified in spec 008 DD-1)
  - App Check (reCAPTCHA Enterprise): enforced in prod on Cloud Functions callables in code (`enforceAppCheck: !isEmulator`, relaxed under FUNCTIONS_EMULATOR) and on Firestore via the Firebase Console enforcement toggle (service-level, not `firestore.rules`)
- **SDK**: `firebase` npm package (installed; imported as ES modules); `firebase-admin` + `firebase-functions` in `functions/` package

**Email / AWS** (ADR-015):
- Amazon SES (`us-east-1`) from `mail.citl.club`; DNS in Route 53
- **Infrastructure as code**: every AWS resource is defined in `infra/aws/*.yaml`
  (CloudFormation). Changes go through a PR (CI runs `cfn-lint`), then the owner deploys
  from the merged branch with a change set (`.specs/technical/aws-infrastructure.md`).
  The console is read-only in practice; actions with no CloudFormation resource are
  listed in that doc. Stacks have termination protection; stateful resources
  (`AWS::SES::EmailIdentity`) are `DeletionPolicy: Retain`.
- **Tags**: every taggable AWS resource and stack carries `project=citl`,
  `repo=github.com/salmoncow/citl`, `source=<template path>`, `managed-by=cloudformation`,
  and `decision=<ADR or spec>`; `scripts/check-aws-tags.py` enforces it in CI.

**Development**:
- **Version Control**: Git + GitHub
- **Node.js**: 24.x (pinned in `.nvmrc`)
- **CI/CD**: GitHub Actions (see `.specs/technical/cicd-pipeline.md`)
- **Testing**: Vitest (unit tests for business logic)

### IV.2 Forbidden Patterns

**Firebase anti-patterns** (break free tier or cause errors):
```
❌  getDocs(collection(db, 'scores'))        Always add where() + limit()
❌  onSnapshot(...) without cleanup          Store and call unsubscribe()
❌  Client-side filtering of Firestore data  Use where() queries
❌  Hardcoded Firebase config in source      Use import.meta.env.VITE_*
```

**Architecture anti-patterns**:
```
❌  var x = ...                              Use const / let
❌  onclick="myFunction()"                   Attach listeners in JS
❌  element.innerHTML = userInput            Use textContent or escapeHtml()
❌  God modules > 750 lines (target < 500)   Split by responsibility (§II.3)
❌  Circular imports between modules         Dependencies flow inward only
❌  Components importing from firebase/      Go through services → repositories
❌  <p>Loading…</p> in async components      Use .skeleton shimmer classes (§III.3)
```

**Infrastructure anti-patterns** (ADR-015; checked by `@reviewer` from the ruleset below; `cfn-lint` in CI validates the templates themselves):
```
❌  Creating or editing AWS resources in the console   Change infra/aws/*.yaml, deploy the stack
❌  AWS access keys (IAM users) for the site           Web identity federation (§III.2)
❌  IAM "Action": "*" or write actions on "*"           Name actions and resource ARNs
❌  DNS records for a template-owned name by hand      The template owns those records
❌  A taggable AWS resource without the standard tags  project, repo, source, managed-by, decision (§IV.1)
```

**Process anti-patterns**:
```
❌  Direct commits to main                   Always open a PR
❌  git commit -m "wip" / "fix"             Use conventional commit format
❌  Force push to main                       Never
❌  Skipping security rules in Emulator      Test rules before deploying
```

**Enforcement**: this list is the human-readable canon; the machine-readable, executable
copy is [`scripts/forbidden-patterns.json`](../scripts/forbidden-patterns.json). The
PostToolUse hook (`scripts/check-constitution.sh`) and the `/check` skill both run that
ruleset — the hook **blocks** an edit on a hard (`forbid`) violation and warns on the rest.
Rules it cannot detect by grep (leaked `onSnapshot`, client-side filtering, components
importing the firebase SDK for runtime use, circular imports) are marked `enforcedBy: review`
and are checked by `@reviewer`. Change a rule in the JSON, not in a doc copy.


### IV.3 Technology Evaluation Criteria

Before adopting new technology, evaluate:
1. Does it fit within current platforms (Firebase, GitHub, AWS Route 53/SES)?
2. Can existing platforms provide this capability?
3. What complexity does it add?
4. What is AI migration capability? (target: ≥80%)
5. What are the long-term maintenance implications?


---

## V. Development Workflow

### V.1 Feature Development Process

1. **Consult Constitution**: Read this document for project constraints and current state
2. **Create Specification**: Invoke `@speckit` with the feature request
   - References constitutional constraints (current state, quality standards, forbidden patterns)
   - Creates spec + implementation plan + task breakdown
3. **Implement**: Run `/implement <feature-name>` to execute the spec
   - Global Claude Code skills auto-activate for architecture, security, testing, and Firebase guidance
   - Consider evolution triggers — does this feature justify increased complexity?
4. **Review**: Invoke `@reviewer` to audit changes and draft PR description
5. **Test**: Validate against constitutional standards (security, performance, Firestore queries)
6. **Commit**: Conventional commit format with constitutional references

**Example commit message**:
```
feat(standings): add standings-table Web Component

Implements live Firestore-backed standings for home view.

Constitutional compliance:
- §III.3: Firestore query uses where() + limit() to stay within free tier
- §III.2: Admin-write enforced via Firestore rules (not client-side only)
- §IV.2: onSnapshot() unsubscribed in disconnectedCallback()
```

### V.2 Guidance Gap Procedure

If this constitution, the `.specs/technical/` docs, and the global skills don't cover a
decision you need to make:

1. **STOP** — do not guess or proceed on an undocumented assumption.
2. State plainly what's missing and which of these it is:
   - a **constitutional gap** (a project rule/standard is absent) → propose a constitution section;
   - a **technical-spec gap** (a config/schema detail is absent) → propose a `.specs/technical/` doc;
   - a **skill gap** (foundational guidance is absent) → note it, then proceed with documented assumptions.
3. Ask the maintainer whether to (a) add the constitution section, (b) add the technical doc, or
   (c) proceed with the assumptions written down in the spec/PR.
4. Record the resolution where it belongs (constitution, `.specs/technical/`, or the feature spec) so
   the gap doesn't recur.

---

## VI. Cost Constraints

### VI.1 Firebase Blaze Plan with Spark-Equivalent Discipline

CITL is on Blaze (pay-as-you-go) but operates with usage discipline that
targets the former Spark free-tier quotas. The plan was upgraded as part
of the multi-user RBAC feature (002-multi-user-rbac, 2026-05-03) to
unlock Cloud Functions, which the RBAC role-writer pattern requires.

| Resource | Daily target ceiling | Alert at 70% |
|----------|---------------------|--------------|
| Firestore reads | 50,000 | 35,000 |
| Firestore writes | 20,000 | 14,000 |
| Firestore deletes | 20,000 | 14,000 |
| Hosting storage | 10 GB total | — |
| Hosting transfer | 360 MB/day | 252 MB |
| Authentication | Unlimited | — |
| Cloud Functions invocations | 2,000,000/month | 1,400,000/month |
| Cloud Functions GB-seconds | 400,000/month | 280,000/month |

**Hard constraints**:
- MUST stay within target ceilings above; spend should round to ~$0/mo at
  CITL's traffic volume. CITL is a hobby league with no operational
  budget — Blaze is enabled to unlock the Functions runtime, NOT to fund
  free-spending architecture.
- MUST implement caching before hitting 70% of any read/write limit.
- New Cloud Functions require justification documented in this section
  or a feature spec — they should solve a specific problem (e.g.
  privileged writes, atomic cross-system operations) that the client
  SDK + Firestore rules cannot satisfy alone.
- Set a Blaze budget alert at $5/mo as a safety net; investigate any
  spend above $1/mo immediately.
- AWS (ADR-015): SES spend has its own budget alert at $1/mo, defined in
  `infra/aws/ses.yaml`. Route 53 is a fixed $0.50/mo per hosted zone.

**Justified functions**: `setUserRole` + `onUserCreate` (spec 002);
`setAccountStatus` + `deleteAccount` (spec 008 DD-1: client-unwritable status with an
atomic audit entry, and a delete cascade over docs clients cannot delete; a few calls per
month); `teamProposal` (spec 009 DD-2: roster checks over a list, which rules can't
iterate, plus the one-captain-per-team and one-request-per-season checks, in one
transaction; a few dozen calls per season); `reviewRequest` + `captainHandoff` (spec 010
DD-1: approval writes the season team, league team, request, and audit entry atomically,
and handoff needs an email-to-account lookup only the Admin SDK can do; tens of calls per
season); `sendMail`, `onAnnouncementCreated`, `onWeekPublished`, `onSeasonUpdated`,
`requestDigest`, `unsubscribe` (spec 011 DD-1: sending email needs a server credential, and
fan-out reads other members' settings; one invocation per email plus one per topic event,
a few thousand a season).


### VI.2 Cost Optimization

**Mandatory optimizations** (already implemented):
- ✅ `score-service.ts` caches reads with 1-hour TTL
- ✅ All Firestore queries use `limit()` in `score-repository.ts`

**Ongoing monitoring**:
- Check Firebase console weekly (during active season: April–July)
- Alert at 70% of any daily limit
- Seasonal traffic pattern: peaks April–July (league season), near-zero off-season

---

## VII. References

### VII.1 Global Claude Code Skills (Auto-Activated)

Foundational guidance for architecture, security, testing, operations, and Firebase is provided
by global Claude Code skills at `~/.claude/skills/`. These auto-activate based on context — no
manual consultation needed. Run `ls ~/.claude/skills/` for the current roster; the
project-critical ones are `firebase-deploy-runbook` (first-deploy + preview-channel gotchas),
`firebase-cost-resilience`, `firebase-security`, `firebase-testing`, `software-architecture`,
`security-principles`, `testing-principles`, and `git-conventions`.

### VII.2 Strategic Frameworks

**Meta Guidance** (`.prompts/meta/`):
- [architectural-decision-log.md](../.prompts/meta/architectural-decision-log.md) — Historical decisions (ADRs) and current-state addenda
- [architectural-evolution-strategy.md](../.prompts/meta/architectural-evolution-strategy.md) — Evolution triggers, decision framework
- [spec-authoring-guidelines.md](../.prompts/meta/spec-authoring-guidelines.md) — How to write specs and agent files: reference the source of truth, never restate rules

The guidance-gap procedure lives in §V.2 above (formerly a separate `prompt-gap-protocol.md`).
Prompt-library maintenance is covered by the review checklist in §VIII.1.

### VII.3 Technical Specifications

- [.specs/technical/aws-infrastructure.md](./technical/aws-infrastructure.md) — AWS stacks (Route 53, SES) and deploy steps
- [.specs/technical/build-system.md](./technical/build-system.md) — Vite 8 configuration
- [.specs/technical/cicd-pipeline.md](./technical/cicd-pipeline.md) — GitHub Actions
- [.specs/technical/firebase-deployment.md](./technical/firebase-deployment.md) — Firebase Hosting deployment
- [.specs/technical/firestore-schema.md](./technical/firestore-schema.md) — Firestore collection/document reference

### VII.4 Agents & Skills

| Command | Description |
|---------|-------------|
| `@speckit` | Create feature spec + implementation plan + task breakdown |
| `@reviewer` | Audit branch changes, draft PR description |
| `@scoring` | Scoring engine domain expert |
| `/constitution` | Project state dashboard |
| `/implement <feature>` | Execute a feature spec |
| `/check` | Quick pre-commit compliance check |
| `/deploy-preview` | Build + test + Firebase preview deploy |

---

## VIII. Maintenance & Review

### VIII.1 Review Schedule

**Quarterly reviews** (every 3 months). Walk this checklist against reality (the things that
actually drift), then set the next "Last Updated"/"next review" dates at the top of this file:
- §II.1 Current Architectural State — recount from the `src/` tree; fix any stale counts.
- `.specs/technical/*` — do build-system / cicd-pipeline / firestore-schema / aws-infrastructure still match `package.json`, `.github/workflows/`, `firestore.rules`, `firestore.indexes.json`, and `infra/aws/`?
- `.specs/README.md` and feature-spec statuses — are shipped specs marked Shipped and archived?
- Evolution triggers — any domain approaching a complexity increase?
- Firebase quota targets (§VI.1) — verify the platform's limits are unchanged.
- AWS (ADR-015) — run CloudFormation drift detection on each stack in `infra/aws/`
  (`aws cloudformation detect-stack-drift`); fix drift in the template, not the console.
  Check the SES budget alert and sending reputation.

**Next review due**: 2026-10-10.

**When to amend**:
- **Minor** (metrics, current state): increment patch version (1.0.0 → 1.0.1), update date
- **Major** (new standards, changed principles): increment minor version (1.0.0 → 1.1.0), document in decision log
- **Breaking** (removed/incompatible standards): increment major version, migration plan required

### VIII.2 Quick Reference

**Mandatory before every commit**:
- ✅ `const`/`let` only — no `var`
- ✅ No inline HTML event handlers
- ✅ Firestore queries use `limit()` (if Firestore-related)
- ✅ `onSnapshot()` cleanup stored (if using real-time listeners)
- ✅ No secrets in code (`.env` only)
- ✅ Conventional commit format
- ✅ Any new async Web Component loading state uses `.skeleton` classes — no `<p>Loading…</p>` (§III.3)
- ✅ UI changes meet §III.6 (AA contrast, visible focus, 44px targets, no page overflow ≥360px, reduced motion)

**Mandatory before every PR**:
- ✅ PR description includes Summary, Changes, Testing, Constitutional Compliance
- ✅ No force push to main
- ✅ Build passes (`npm run build`)
- ✅ No merge conflicts

---

**Version History:**
- 1.0.0 (2026-02-27): Initial constitution established for CITL
- 1.0.1 (2026-02-28): Minor metrics update
- 1.1.0 (2026-03-01): TypeScript migration complete; CSS design system; dark mode; inline SVGs
- 1.2.0 (2026-03-10): Removed phase references throughout; constitution is now state-based and timing-agnostic
- 1.3.0 (2026-03-13): Added §III.3 UX Loading States — skeleton shimmer placeholders required for all async Web Components; added corresponding forbidden pattern and commit checklist item
- 1.4.0 (2026-04-12): Migrated foundational guidance to global Claude Code skills; removed `.prompts/core/` and `.prompts/platforms/` references; retained `.prompts/meta/` for project-specific strategic frameworks; updated §V.1 workflow and §VII references
- 1.5.0 (2026-05-03): Adopted Firebase Blaze plan and multi-user RBAC (002-multi-user-rbac); Cloud Functions role-writer + auth trigger; App Check enforcement; Security marked Complete (see ADR-009)
- 1.5.1 (2026-07-10): Truth-reconciliation pass (WS-1) — updated §II.1 to live-production state (AWS decommissioned, site live at citl.club); corrected inventory counts; removed the retired static-JSON data-layer narrative (ADR-010 supersedes ADR-003); refreshed §III.1 testing state and §III.4 bundle figure; single-sourced Firebase quota figures to §VI.1
- 1.6.0 (2026-07-11): Component contract adopted as a standard (spec 003-service-decomposition) — §II.4 points to src/components/README.md; composition root (`src/services/app-services.ts`) is the sole production construction site for ScoreService; new hook rule `no-private-service-in-component`
- 1.7.0 (2026-09-24): "Range Day" site redesign (spec 006, ADR-011) — added §III.6 Accessibility & Responsive Standards; §IV.1 styling line covers self-hosted `@fontsource` fonts and the new token groups/heat ramp; §III.3 skeleton path corrected to `admin-tables.css`; §III.4 JS figure re-measured (~242 kB) with CSS and font budgets; §II.1 inventory recounted
- 1.7.1 (2026-09-25): Design-token hygiene (spec 007) — §IV.1 styling line: the token contract is now enforced by `src/styles/tokens.test.ts` (no colour literals or primitive references in component CSS; identical dark blocks)
- 1.8.0 (2026-10-01): Public member accounts (spec 008, ADR-012 supersedes ADR-005) — §III.2 replaces admin-only auth with optional member accounts (Google, email link; adults only; server-authoritative status); §IV.1 Auth and Functions lines; §VI.1 lists the justified functions; §II.1 inventory and test counts recounted; §III.4 JS figure re-measured (~246 kB)
- 1.9.0 (2026-10-03): Team proposals and member requests (spec 009, ADR-013) — §II.5 lists the persistent `leagueTeams` and the member request collections; §VI.1 justifies `teamProposal`; §III.2 minors-as-dependents and requests-never-write-seasons notes; §II.1 inventory and test counts recounted; §III.4 JS figure re-measured (~249 kB, under 1 kB headroom)
- 1.11.0 (2026-10-04): AWS as the third platform, managed as code (ADR-015, spec 011) — §I.2 platform list (AWS limited to Route 53 + SES); §II.1 Infrastructure and Platform rows; §III.1 template lint; §III.2 no long-lived cross-cloud credentials, least-privilege IAM; §IV.1 Email/AWS, infrastructure-as-code, and tagging standards; §IV.2 infrastructure anti-patterns; §IV.3 platform list; §VI.1 SES budget alert; §VIII.1 quarterly drift detection
- 1.12.0 (2026-10-06): Email notifications (spec 011) — §II.5 adds `notificationSettings`, `mail`, `notifications` and the queue-only email rule; §VI.1 justifies the six email functions; §II.1 inventory and test counts recounted; §III.4 JS figure re-measured (~232 kB)
- 1.12.1 (2026-10-10): §IV.1 App Check line states enforcement per product (Functions in code, Firestore via console), matching `.specs/technical/firebase-deployment.md`
- 1.10.0 (2026-10-03): Coordinator review (spec 010, ADR-014) — §II.5 adds `captainChanges` and names `reviewRequest` as the request-to-season path; §VI.1 justifies `reviewRequest` and `captainHandoff`; §II.1 inventory and test counts recounted; §III.4 JS figure re-measured (~231 kB after lazy-loading the admin panel)
