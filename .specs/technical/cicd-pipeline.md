# CI/CD Pipeline — citl.club

**Last Updated**: 2026-09-03

---

## Overview

citl.club uses GitHub Actions for CI/CD. Three workflows cover type checking, unit/rules/functions
tests, the production build, CI-gated production deploys, and PR preview channels.

See [.specs/technical/firebase-deployment.md](./firebase-deployment.md) for hosting configuration.

---

## Workflow Architecture

| Trigger | Workflow | Action |
|---------|----------|--------|
| Push to `main` or PR | `ci.yml` | Type Check + Unit Tests + Firestore Rules Tests + Cloud Functions Tests + Build (5 parallel jobs) |
| CI workflow completes successfully on `main` (`workflow_run`) | `deploy-production.yml` | Build → Firestore rules + indexes + Cloud Functions → Firebase Hosting (live) |
| Manual (`workflow_dispatch`) | `deploy-production.yml` | On-demand production deploy |
| PR opened/updated/reopened | `deploy-preview.yml` | Build → Firebase preview channel (7-day link in PR comment) |

---

## Workflow Files

```
.github/workflows/
├── ci.yml                  # typecheck + unit/rules/functions tests + build (5 parallel jobs)
├── deploy-production.yml   # CI success on main (workflow_run) → live site + rules/indexes/functions
└── deploy-preview.yml      # PR → Firebase preview channel (7-day URL in PR comment)
```

---

### `ci.yml`

Runs on every push to `main` and every PR targeting `main`. Five parallel jobs, whose `name:`
fields are the exact strings used in branch protection status checks:

- `Type Check` — `npm run typecheck`
- `Unit Tests` — `npm run test`
- `Firestore Rules Tests` — `npm run test:rules` (needs the Firestore emulator via Java/Temurin 21)
- `Cloud Functions Tests` — `npm run test:functions` (installs `functions/` deps; Java/Temurin 21)
- `Build` — `npm run build` + `npm --prefix functions run build`, exercising the production
  rollup/terser path and the Functions `tsc` build

The `Type Check`, `Unit Tests`, and `Build` jobs need no Firebase credentials — the unit tests are
pure in-memory (`vitest` with `environment: 'node'`) and the build succeeds with the `VITE_` env
vars undefined. The two emulator-backed test jobs run against the local Firestore emulator, not
production. (The production deploy job in `deploy-production.yml` *does* require credentials.)

See [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml).

---

### `deploy-production.yml`

**Does NOT trigger on push to `main`.** It is CI-gated: it runs via `workflow_run` when the `CI`
workflow completes on `main`, and the `build-and-deploy` job only proceeds when
`github.event.workflow_run.conclusion == 'success'` (or on manual `workflow_dispatch`). This keeps
a test- or build-failing commit — including a dependabot major that breaks the production build —
from shipping. The job checks out the exact commit that passed CI
(`github.event.workflow_run.head_sha`) and runs under a `deploy-production` concurrency group so
two deploys never overlap.

Deploy steps, in order:

1. Build the app (`npm run build`) with all `VITE_` values injected from GitHub secrets/vars.
2. Deploy `firestore:rules`, `firestore:indexes`, and `functions` via the Firebase CLI
   (`npx firebase deploy --only firestore:rules,firestore:indexes,functions`), authenticated with
   `GOOGLE_APPLICATION_CREDENTIALS` pointing at the service-account JSON written to a temp file.
3. Deploy Firebase Hosting to the `live` channel via `FirebaseExtended/action-hosting-deploy@v0.11.0`.

`firebase-tools` is in `devDependencies` so `npx firebase` resolves from the local install after
`npm ci` — no download on every run.

See [`.github/workflows/deploy-production.yml`](../../.github/workflows/deploy-production.yml).

---

### `deploy-preview.yml`

Runs the production vite build on PRs and deploys it to a preview channel. Skipped for dependabot
PRs (`if: github.actor != 'dependabot[bot]'`). Firestore rules/indexes and Cloud Functions are NOT
deployed in preview — those changes only go live on production. The `permissions` block grants
`pull-requests: write` (required for GitHub's restrictive default token permissions so the action
can post the preview URL as a PR comment). Preview channels expire after 7 days. Triggers on PR
open, synchronize, and reopen.

See [`.github/workflows/deploy-preview.yml`](../../.github/workflows/deploy-preview.yml).

---

## Firebase Service Account IAM Setup

The production deploy service account (`FIREBASE_SERVICE_ACCOUNT`) does more than deploy
Hosting: `deploy-production.yml` deploys Firestore rules **and indexes** **and Cloud Functions**.
A Functions deploy pulls in additional Google Cloud surfaces (Cloud Functions / Cloud Run,
Artifact Registry, the default compute service account, and the Cloud Billing API on the CI
project) that the two-role least-privilege set previously documented here
(`firebasehosting.admin` + `firebaserulesadmin`) does **not** cover.

The exact role set and the first-Functions-deploy IAM gotchas are not duplicated in-repo. Follow
the **`firebase-deploy-runbook`** global skill, which documents the IAM propagation for the
default compute service account, the 2nd-gen callable Cloud Run invoker binding, Artifact
Registry cleanup, and the Cloud Billing API enablement a CI service account needs to deploy
Functions.

---

## GitHub Secrets and Variables Configuration

Navigate to: `GitHub repo → Settings → Secrets and variables → Actions`

**Secrets** (sensitive — not visible after saving):

| Secret Name | Value |
|-------------|-------|
| `FIREBASE_SERVICE_ACCOUNT` | Full JSON content of `github-actions-sa.json` |
| `VITE_FIREBASE_API_KEY` | From Firebase console → Project Settings → Your apps |
| `VITE_FIREBASE_AUTH_DOMAIN` | `citl-baed2.firebaseapp.com` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `citl-baed2.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | From Firebase console |
| `VITE_FIREBASE_APP_ID` | From Firebase console |
| `VITE_FIREBASE_MEASUREMENT_ID` | From Firebase console |

**Variables** (non-sensitive — visible in UI and linkable):

| Variable Name | Value |
|---------------|-------|
| `VITE_FIREBASE_PROJECT_ID` | `citl-baed2` |

`VITE_FIREBASE_PROJECT_ID` is a variable (not a secret) because the project ID is not
sensitive and benefits from being visible in the GitHub UI with direct links to the Firebase
project. Referenced in workflows as `${{ vars.VITE_FIREBASE_PROJECT_ID }}`.

Values can be copied from your local `.env` file.

---

## Branch Protection

```
GitHub repo → Settings → Branches → Add rule → Branch: main
```

Required status checks (must match job `name:` fields exactly) — all five `ci.yml` jobs are
**required** in the `main` branch protection ruleset as of 2026-07-10; a PR cannot merge until
they pass:
- `Type Check`
- `Unit Tests`
- `Firestore Rules Tests`
- `Cloud Functions Tests`
- `Build`

`Build & Deploy (Preview Channel)` is intentionally NOT a required check (a Firebase outage
should not block merges).

Also enable:
- Require a pull request before merging
- Require branches to be up to date before merging
- Do not allow bypassing the above settings

---

## Dependency Automation

Two independent Dependabot mechanisms run against this repo. The distinction matters, because
relying on the first alone is what let the GitHub Actions Node 20 pins drift into a hard deadline
(see the `action-hosting-deploy` / `setup-java` bump).

| Mechanism | Enabled by | Fires when |
|-----------|-----------|------------|
| **Security updates** | Repo Security Alerts page (no config file) | A security advisory is published against a dependency |
| **Version updates** | [`.github/dependabot.yml`](../../.github/dependabot.yml) | On the configured weekly schedule, regardless of advisories |

Security updates are advisory-driven only. A GitHub Actions **runner-runtime deprecation is never
published as an advisory**, so no amount of security scanning surfaces one — version updates are
the only mechanism that catches it. Before `dependabot.yml` existed, the `github-actions` ecosystem
was not watched at all.

Configured version-update targets:

| Ecosystem | Directory | Commit prefix |
|-----------|-----------|---------------|
| `github-actions` | `/` (all workflows) | `ci` |
| `npm` | `/` | `chore` |
| `npm` | `/functions` | `chore` |

**Grouping policy**: dev-dependency *minor and patch* bumps collapse into one PR per manifest to
keep weekly volume manageable. Production dependencies and **all majors stay as individual PRs**.
That is deliberate — `deploy-production.yml` is CI-gated specifically so a dependabot major that
breaks the build cannot ship, and batching majors into a grouped PR would undercut that gate.

Dependabot PRs get CI but no preview channel: `deploy-preview.yml` skips them via
`if: github.actor != 'dependabot[bot]'`. For a **production** dependency that only manifests in a
browser (the `firebase` client SDK, for instance) that means no in-browser check before it
reaches production — verify against the live site after the deploy, or open a throwaway
non-dependabot PR to get a preview channel.

**Ignored majors**: three packages have major-version bumps suppressed in `dependabot.yml`, each
for a specific reason rather than as general noise reduction. Minor and patch bumps still flow.

| Package | Manifest | Why | Tracking |
|---------|----------|-----|----------|
| `typescript` | root | `typescript-eslint` caps its `typescript` peer at `<6.1.0` in every published release | #262 |
| `firebase-admin` | both | `firebase-functions-test` caps its `firebase-admin` peer at `^13` | #261 |
| `@types/node` | `/functions` | must track the deployed `nodejs22` runtime, not the newest release | — |

The `@types/node` case is the one worth internalising: bumping type definitions past the runtime
is invisible to CI. Types only widen what the compiler accepts and are never executed, so Node
23+ APIs would typecheck, build, pass every job, and then throw in production. Bump it only
alongside a deliberate change to `firebase.json`'s `runtime` and `functions/package.json`'s
`engines.node`.

To verify the config is live: **Insights → Dependency graph → Dependabot** lists each configured
ecosystem with its last-checked time, and surfaces schema errors there.

---

## Performance Targets

| Metric | Target |
|--------|--------|
| CI (typecheck + tests) | <2 minutes |
| Build time | <2 minutes |
| Deploy time | <1 minute |
| Total pipeline time | <3 minutes |
| Concurrent PR previews | Up to 10 |

GitHub Actions free tier provides 2,000 minutes/month — well within budget for infrequent deploys.

---

## Rollback Strategy

### Via Git (preferred)

```bash
# Revert the bad commit on a branch, then open a PR (no direct pushes to main)
git checkout -b revert/bad-commit
git revert HEAD
git push origin revert/bad-commit
# Merge the PR → CI runs → a successful CI run triggers the production deploy
# (deploy-production.yml via workflow_run), shipping the revert automatically
```

### Via Firebase Console

Firebase console → Hosting → Release history → select previous release → Rollback

---

## Implementation Checklist

- [x] DNS cutover complete and validated
- [x] Firebase service account created with least-privilege IAM roles
- [x] All `VITE_FIREBASE_*` secrets added to GitHub
- [x] `FIREBASE_SERVICE_ACCOUNT` secret added to GitHub
- [x] `firebase-tools` added to `devDependencies` in `package.json`
- [x] `.github/workflows/ci.yml` created
- [x] `.github/workflows/deploy-production.yml` created
- [x] `.github/workflows/deploy-preview.yml` created
- [x] Branch protection rules enabled on `main` (all five CI jobs required as of 2026-07-10)
- [x] `.github/dependabot.yml` created (version updates for `github-actions` + both npm manifests)
- [x] Test: merge to `main` → CI passes → `workflow_run` triggers production deploy
- [x] Test: open PR → verify preview channel URL posts as PR comment
- [x] Test: typecheck failure on a branch blocks merge

---

## References

- [FirebaseExtended/action-hosting-deploy](https://github.com/FirebaseExtended/action-hosting-deploy)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Dependabot version update options](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference)
- [.specs/technical/firebase-deployment.md](./firebase-deployment.md) — Hosting config
- [.specs/constitution.md](../constitution.md) — §II.1 Current Architectural State
