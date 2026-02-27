# CI/CD Pipeline — citl.club

**Status**: Phase 1 — Manual deployment only
**Phase 6 target**: GitHub Actions automated deployment (deferred until after DNS cutover)
**Last Updated**: 2026-02-27

---

## Overview

citl.club currently uses manual Firebase CLI deployment (`npm run deploy`).
GitHub Actions CI/CD is intentionally deferred until Phase 6, after the DNS cutover from
AWS to Firebase Hosting is validated. This avoids automating against a target that is not yet live.

See [.specs/technical/firebase-deployment.md](./firebase-deployment.md) for current manual
deployment process.

---

## Current State (Phase 1: Manual)

```bash
# Production deploy (manual)
npm run build && firebase deploy --only hosting

# Preview channel deploy (7-day expiry)
npm run build && firebase hosting:channel:deploy preview
```

**Trigger**: Developer runs locally after validating with `npm run preview`.
**Authentication**: Developer is logged in via `firebase login`.

---

## Target State (Phase 6: GitHub Actions)

### Phase 6 Prerequisites

Before implementing GitHub Actions automation:

- [ ] DNS cutover complete — `citl.club` is live on Firebase Hosting
- [ ] Firebase Hosting validated in production (all routes, CSP, PDFs)
- [ ] Firebase service account created and stored as GitHub secret
- [ ] All `VITE_FIREBASE_*` values stored as GitHub secrets
- [ ] At least one full manual deploy cycle completed successfully post-cutover

### Target Workflow Architecture

| Trigger | Workflow | Action |
|---------|----------|--------|
| Push to `main` | `deploy-production.yml` | Build → Deploy to Firebase Hosting (live) |
| PR opened/updated | `deploy-preview.yml` | Build → Firebase preview channel (7-day link in PR) |
| Manual (`workflow_dispatch`) | Either workflow | On-demand deploy |

---

## Phase 6 Implementation Plan

### Workflow Files to Create

```
.github/workflows/
├── deploy-production.yml   # push to main → live site
└── deploy-preview.yml      # PR → preview channel
```

### `deploy-production.yml` (target)

```yaml
name: Deploy to Firebase Hosting (Production)

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
          VITE_FIREBASE_MEASUREMENT_ID: ${{ secrets.VITE_FIREBASE_MEASUREMENT_ID }}

      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          projectId: citl
          channelId: live
```

### `deploy-preview.yml` (target)

```yaml
name: Deploy to Firebase Hosting (Preview)

on:
  pull_request:
    branches: [main]

jobs:
  build-and-preview:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
          VITE_FIREBASE_MEASUREMENT_ID: ${{ secrets.VITE_FIREBASE_MEASUREMENT_ID }}

      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          projectId: citl
          expires: 7d
```

The preview deploy action automatically posts the preview URL as a PR comment.

---

## GitHub Secrets Configuration (Phase 6)

### Required Secrets

| Secret Name | Value | Source |
|-------------|-------|--------|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase service account JSON | Firebase console → Project Settings → Service accounts |
| `VITE_FIREBASE_API_KEY` | Firebase API key | Firebase console → Project Settings → Your apps |
| `VITE_FIREBASE_AUTH_DOMAIN` | `citl-baed2.firebaseapp.com` | Firebase console |
| `VITE_FIREBASE_PROJECT_ID` | `citl-baed2` | Firebase console |
| `VITE_FIREBASE_STORAGE_BUCKET` | `citl-baed2.firebasestorage.app` | Firebase console |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Sender ID | Firebase console |
| `VITE_FIREBASE_APP_ID` | App ID | Firebase console |
| `VITE_FIREBASE_MEASUREMENT_ID` | Measurement ID | Firebase console |

### Secret Setup Process (Phase 6)

```bash
# 1. Create Firebase service account
#    Firebase console → Project Settings → Service accounts → Generate new private key
#    Download the JSON file

# 2. Add to GitHub repository secrets
#    GitHub repo → Settings → Secrets and variables → Actions → New repository secret
#    Name: FIREBASE_SERVICE_ACCOUNT
#    Value: (paste entire JSON content)

# 3. Repeat for each VITE_FIREBASE_* variable

# 4. Verify: push a commit to main and check Actions tab
```

---

## Performance Targets (Phase 6)

| Metric | Target |
|--------|--------|
| Build time | <2 minutes |
| Deploy time | <1 minute |
| Total pipeline time | <3 minutes |
| Concurrent PR previews | Up to 10 |

GitHub Actions free tier provides 2,000 minutes/month on free plan — well within budget
for a single-developer project with infrequent deploys.

---

## Branch Protection (Phase 6)

When CI/CD is active, enable branch protection on `main`:

```
GitHub repo → Settings → Branches → Add rule → main

Rules to enable:
  ✅ Require pull request reviews before merging
  ✅ Require status checks to pass before merging
       → Select: build-and-preview (from deploy-preview.yml)
  ✅ Require branches to be up to date before merging
  ✅ Do not allow bypassing the above settings
```

---

## Rollback Strategy

### Via Git (preferred)

```bash
# Revert the bad commit
git revert HEAD
git push origin main
# GitHub Actions deploys the revert automatically
```

### Via Firebase Console

Firebase console → Hosting → Release history → select previous release → Rollback

---

## Implementation Checklist (Phase 6)

- [ ] DNS cutover complete and validated
- [ ] Firebase service account created and downloaded
- [ ] All `VITE_FIREBASE_*` secrets added to GitHub
- [ ] `FIREBASE_SERVICE_ACCOUNT` secret added to GitHub
- [ ] `.github/workflows/deploy-production.yml` created
- [ ] `.github/workflows/deploy-preview.yml` created
- [ ] Branch protection rules enabled on `main`
- [ ] Test: push to `main` → verify production deploy
- [ ] Test: open PR → verify preview channel URL in PR comment
- [ ] Update `constitution.md` §II.1 Deployment phase to Phase 2

---

## References

- [FirebaseExtended/action-hosting-deploy](https://github.com/FirebaseExtended/action-hosting-deploy)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [.specs/technical/firebase-deployment.md](./firebase-deployment.md) — Hosting config
- [.specs/constitution.md](../constitution.md) — §II.1 Deployment phase, §VII Migration Milestones
- [.prompts/core/development/git-best-practices.md](../../.prompts/core/development/git-best-practices.md)
