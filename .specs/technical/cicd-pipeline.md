# CI/CD Pipeline — citl.club

**Last Updated**: 2026-03-10

---

## Overview

citl.club uses GitHub Actions for CI/CD. Three workflows cover type checking, unit tests,
production deploys, and PR preview channels.

See [.specs/technical/firebase-deployment.md](./firebase-deployment.md) for hosting configuration.

---

## Workflow Architecture

| Trigger | Workflow | Action |
|---------|----------|--------|
| Push to `main` or PR | `ci.yml` | Typecheck + unit tests (parallel jobs) |
| Push to `main` | `deploy-production.yml` | Build → Firestore rules → Firebase Hosting (live) |
| Manual (`workflow_dispatch`) | `deploy-production.yml` | On-demand production deploy |
| PR opened/updated/reopened | `deploy-preview.yml` | Build → Firebase preview channel (7-day link in PR comment) |

---

## Workflow Files

```
.github/workflows/
├── ci.yml                  # typecheck + unit tests (parallel jobs)
├── deploy-production.yml   # push to main → live site + Firestore rules
└── deploy-preview.yml      # PR → Firebase preview channel (7-day URL in PR comment)
```

---

### `ci.yml`

Runs on every push to `main` and every PR targeting `main`. No Firebase credentials needed —
tests are pure in-memory (`vitest` with `environment: 'node'`). Two parallel jobs:
`Type Check` and `Unit Tests` — these names are the exact strings used in branch protection
status checks.

See [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml).

---

### `deploy-production.yml`

Deploys Firestore security rules first (via `GOOGLE_APPLICATION_CREDENTIALS` written to a
temp file), then deploys Firebase Hosting via `FirebaseExtended/action-hosting-deploy@v0`.
`firebase-tools` is in `devDependencies` so `npx firebase` resolves from the local install
after `npm ci` — no download on every run. Triggers on push to `main` and `workflow_dispatch`.

See [`.github/workflows/deploy-production.yml`](../../.github/workflows/deploy-production.yml).

---

### `deploy-preview.yml`

Firestore rules are NOT deployed in preview — rules changes only go live on production.
The `permissions` block grants `pull-requests: write` (required for GitHub's restrictive
default token permissions so the action can post the preview URL as a PR comment). Preview
channels expire after 7 days. Triggers on PR open, synchronize, and reopen.

See [`.github/workflows/deploy-preview.yml`](../../.github/workflows/deploy-preview.yml).

---

## Firebase Service Account IAM Setup

Minimum IAM roles (principle of least privilege):
- `roles/firebasehosting.admin` — upload files, create/finalize channels
- `roles/firebaserulesadmin` — deploy Firestore security rules only (no data access)

```bash
export PROJECT_ID=citl-baed2

# Create the service account
gcloud iam service-accounts create github-actions-deploy \
  --project=$PROJECT_ID \
  --display-name="GitHub Actions Deploy" \
  --description="CI/CD deployments for citl.club"

export SA_EMAIL="github-actions-deploy@${PROJECT_ID}.iam.gserviceaccount.com"

# Grant minimum roles
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/firebasehosting.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/firebaserulesadmin"

# Download JSON key
gcloud iam service-accounts keys create ./github-actions-sa.json \
  --iam-account=$SA_EMAIL --project=$PROJECT_ID

# After uploading to GitHub Secrets, delete the local file:
rm ./github-actions-sa.json
```

---

## GitHub Secrets Configuration

Navigate to: `GitHub repo → Settings → Secrets and variables → Actions → New repository secret`

| Secret Name | Value |
|-------------|-------|
| `FIREBASE_SERVICE_ACCOUNT` | Full JSON content of `github-actions-sa.json` |
| `VITE_FIREBASE_API_KEY` | From Firebase console → Project Settings → Your apps |
| `VITE_FIREBASE_AUTH_DOMAIN` | `citl-baed2.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `citl-baed2` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `citl-baed2.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | From Firebase console |
| `VITE_FIREBASE_APP_ID` | From Firebase console |
| `VITE_FIREBASE_MEASUREMENT_ID` | From Firebase console |

Values for `VITE_FIREBASE_*` can be copied from your local `.env` file.

---

## Branch Protection

```
GitHub repo → Settings → Branches → Add rule → Branch: main
```

Required status checks (must match job `name:` fields exactly):
- `Type Check`
- `Unit Tests`
- `Build & Deploy (Preview Channel)` — optional (can block merges during Firebase outages)

Also enable:
- Require a pull request before merging
- Require branches to be up to date before merging
- Do not allow bypassing the above settings

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
# Revert the bad commit
git revert HEAD
git push origin main
# GitHub Actions deploys the revert automatically
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
- [ ] Branch protection rules enabled on `main`
- [ ] Test: push to `main` → verify production deploy in Firebase console
- [ ] Test: open PR → verify preview channel URL posts as PR comment
- [ ] Test: typecheck failure on a branch blocks merge

---

## References

- [FirebaseExtended/action-hosting-deploy](https://github.com/FirebaseExtended/action-hosting-deploy)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [.specs/technical/firebase-deployment.md](./firebase-deployment.md) — Hosting config
- [.specs/constitution.md](../constitution.md) — §II.1 Current Architectural State
