# Firebase Deployment — citl.club

**Firebase Project**: `citl-baed2`
**Project Number**: `983886495824`
**Hosting Region**: Global CDN (Hosting) / `us-east1` (Firestore + Functions)
**Plan**: Blaze (pay-as-you-go; usage targets Spark-equivalent quotas)
**Last Updated**: 2026-07-10

> **First-time deploy to a new Firebase project?** Operational gotchas (IAM
> propagation for the GCF source bucket, 2nd-gen callable invoker binding,
> Artifact Registry cleanup policy, reCAPTCHA Enterprise key wildcard caveat)
> are documented in the global `firebase-deploy-runbook` skill at
> `~/.claude/skills/firebase-deploy-runbook/SKILL.md`. This file documents
> only the citl-specific values + decisions.

---

## Overview

citl.club is deployed to Firebase Hosting. The `dist/` folder (Vite build output) is deployed
as a static SPA with a universal rewrite rule that sends all routes to `index.html`.

**Deployment**: GitHub Actions CI/CD (automated on push to `main`).
See [.specs/technical/cicd-pipeline.md](./cicd-pipeline.md).

---

## Firebase Project Configuration

### Project Binding

```
Firebase project ID: citl-baed2
Default alias:       default → citl-baed2
Config file:         .firebaserc
```

### Authentication Setup

```bash
# Authenticate Firebase CLI (one-time)
firebase login

# Verify project binding
firebase use citl-baed2
firebase projects:list    # confirm 'citl-baed2' appears
```

---

## Admin User Provisioning

Admin portal access is gated on a Firebase custom claim (`admin: true`).
Use `scripts/grant-admin.js` to grant or revoke the claim by email.

### One-time developer setup

```bash
# Install gcloud CLI, then authenticate with the project owner account
gcloud auth application-default login
gcloud auth application-default set-quota-project citl-baed2
```

### Grant / revoke admin access

```bash
# Grant admin claim — user can now sign into #/admin
node scripts/grant-admin.js grant user@example.com

# Revoke admin claim — user sees "no access" message on next sign-in
node scripts/grant-admin.js revoke user@example.com
```

The user must sign out and back in after a grant/revoke for the new token to take effect
(Firebase ID tokens have a 1-hour TTL).

**Required**: the developer running this script must have the **Firebase Authentication Admin**
IAM role on the `citl-baed2` project.

---

### Configuration Principles

`firebase.json` governs:
- **Hosting source**: `dist/` (Vite build output)
- **SPA rewrite**: All routes → `index.html`
- **Cache headers**: Long-lived for fingerprinted assets, no-cache for `index.html`
- **Security headers**: CSP, X-Frame-Options, HSTS, X-Content-Type-Options
- **Custom domain**: `citl.club` and `www.citl.club` (see DNS Cutover section below)

See [firebase.json](../../firebase.json) for full configuration.

---

## Deployment Process

### Manual Deployment

```bash
# Full deploy: build → deploy
npm run deploy
# equivalent to: npm run build && firebase deploy --only hosting

# Preview channel deploy (7-day expiry, shareable URL)
npm run deploy:preview
# equivalent to: npm run build && firebase hosting:channel:deploy preview
```

### Pre-Deployment Checklist

Before running `npm run deploy` or `npm run deploy:preview`:

- [ ] `npm run build` succeeds with no errors
- [ ] `.env` is populated with valid `VITE_FIREBASE_*` values
- [ ] `firebase use citl-baed2` is active (`firebase use` to verify)
- [ ] All 5 SPA routes load correctly in `npm run preview`
- [ ] No CSP violations in browser console during preview
- [ ] Firebase Hosting daily-transfer usage not near its 70% alert threshold (see constitution [§VI.1](../constitution.md#vi1-firebase-blaze-plan-with-spark-equivalent-discipline))

---

## Cloud Functions Deployment

citl-baed2 has Cloud Functions deployed in `us-east1` (RBAC `setUserRole` callable
plus the on-create user-mirror trigger). The first deploy occurred on 2026-05-04.

### Subsequent deploys

```bash
firebase deploy --only functions --project citl-baed2
```

Routine deploys after the first one require no special handling. The IAM bindings
applied during the first deploy persist.

### Adding a new callable function

Each new 2nd-gen callable needs one one-time IAM binding after its first deploy
so the browser can reach it via Firebase's `httpsCallable` path. Use the
**lowercased** function name (Cloud Run service names are always lowercase):

```bash
gcloud run services add-iam-policy-binding {function-name} \
  --region=us-east1 \
  --member=allUsers \
  --role=roles/run.invoker \
  --project=citl-baed2
```

This is **not** an authorization weakening — the in-function check on
`req.auth.token.role` is the actual boundary. See the global
`firebase-deploy-runbook` skill (Gotcha 2) for the full rationale.

### First-time deploy to a different project

If we ever stand up a new Firebase project (preview environment, fork, etc.), the
first `firebase deploy --only functions` will fail with the well-known
`gcf-sources-{PROJECT_NUMBER}-{REGION}` permission error. The fix is one
`gcloud projects add-iam-policy-binding` command + a 30-60s wait, then retry.

**See the global `firebase-deploy-runbook` skill** (`~/.claude/skills/firebase-deploy-runbook/SKILL.md`)
for the full first-time-deploy checklist (IAM propagation, invoker binding,
Artifact Registry cleanup policy).

---

## Browser API Key Restrictions

citl-baed2's auto-created Browser API key has **HTTP referrer restrictions
cleared** (`browserKeyRestrictions: {}`). This is intentional.

### Why cleared

The auto-created restrictions only included production domains
(`https://citl.club/*`, `https://citl-baed2.web.app/*`), which broke:

- Firebase Hosting preview channels (`citl-baed2--*.web.app`) — sign-in
  failed with `auth/requests-from-referer-...-are-blocked` (HTTP 403 from
  `identitytoolkit.googleapis.com`)
- Local-against-prod testing (`npm run dev:prod`) on non-`localhost:3000` ports

Mid-host wildcards like `https://citl-baed2--*.web.app/*` **silently fail to
match** — Google API key referrer restrictions only support leading-subdomain
wildcards (`*.example.com`), not mid-host. There is no referrer-restriction
syntax that covers all preview-channel URLs.

### Why this is safe

The Browser API key is fundamentally public — it's embedded in the JS bundle
and visible to anyone reading the source. Referrer restrictions are a soft
control (referrers are client-controlled and trivial to spoof), not a real
defense. The actual security boundaries for citl are:

- **API target restrictions** on the key (Firestore, Identity Toolkit, App
  Check — keep these tight as the real boundary)
- **Firestore security rules** + custom-claim RBAC (`role: owner | admin | user`)
- **App Check** with reCAPTCHA Enterprise (configured but not yet enforced)
- **Cloud Functions** in-body `req.auth.token.role` checks

See `security-principles` skill section "Soft controls vs real boundaries"
and the `firebase-deploy-runbook` skill (Gotcha 4) for the full framing.

### How citl-baed2 was cleared

```bash
gcloud services api-keys update {KEY_ID} \
  --allowed-referrers="" \
  --project=citl-baed2
```

Find `{KEY_ID}` via `gcloud services api-keys list --project=citl-baed2`
(look for "Browser key (auto created by Firebase)").

> Note: `--clear-allowed-referrers` is **not** a valid flag despite gcloud's
> suggestion text. Pass an empty string instead.

---

## App Check Configuration

### Provider

App Check on web for citl-baed2 uses **reCAPTCHA Enterprise (Score-based)**, not
the legacy reCAPTCHA v3 product.

### Site key env var

The Vite-injected env var is **`VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`** (not
`VITE_APPCHECK_SITE_KEY` — provider-specific naming makes the key format obvious
in code review).

### Domain registration trade-off

reCAPTCHA Enterprise key registration does **not** support wildcard domains, so
Firebase preview-channel URLs (`citl-baed2--preview-{hash}.web.app`) cannot be
covered by a single domain entry.

citl currently uses **Option 1** from the runbook: one key with domain verification
disabled, valid for prod, dev, and preview channels. The risk (anyone with the key
can use it from any origin) is acceptable for citl because:

- The actual authorization boundary is Firestore rules + Cloud Functions custom-claim
  checks, not App Check
- The site is public-by-design (standings/scorecards are open-read)
- The user mirror collection is admin-only-write, enforced server-side

If user PII is ever added to the data model, revisit and switch to Option 2 (split
prod / dev keys with domain verification on the prod key).

**See the `firebase-deploy-runbook` skill** for the full trade-off discussion.

### Post-Deployment Verification

After every deploy, verify at `https://citl-baed2.web.app` (or preview channel URL):

- [ ] Home page loads and displays standings / results feed
- [ ] Navigation works: About, Rules, Downloads, Scorecards
- [ ] Scorecards accordion expands all 7 seasons
- [ ] PDF score sheet links download correctly
- [ ] Google Maps embed loads on About page (tests CSP `frame-src`)
- [ ] Browser console shows zero errors and zero CSP violations

---

## Hosting Features

### SPA Rewrite Rule

All non-file routes rewrite to `index.html`:
```json
{
  "hosting": {
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

This enables hash-based routing (`/#/about`, `/#/scorecards`) to work on direct
URL access and refresh.

### Cache Strategy

| Asset Pattern | Cache-Control | Rationale |
|---------------|--------------|-----------|
| `/assets/**` (fingerprinted) | `max-age=31536000, immutable` | Content-hashed — safe to cache forever |
| `*.pdf` (score sheets) | `max-age=31536000, immutable` | Static, versioned by filename |
| `index.html` | `no-cache` | Must always be fresh for SPA routing |
| Everything else | `max-age=3600` | 1-hour default |

### Security Headers

All routes receive these headers (configured in `firebase.json`):

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: [see firebase.json for full CSP]
```

**CSP requirements specific to CITL**:
- `frame-src maps.google.com www.google.com` — Google Maps embed on About page

---

## Hosting Metrics and Limits — Usage targets (Spark-equivalent discipline, on Blaze)

citl-baed2 is on the **Blaze** plan but operates with usage discipline that targets
the former Spark free-tier quotas. **The authoritative usage ceilings and 70% alert
thresholds — Firestore reads/writes/deletes, hosting storage/transfer, and Cloud
Functions invocations — live in the constitution at [§VI.1](../constitution.md#vi1-firebase-blaze-plan-with-spark-equivalent-discipline).**
That table is the single source of truth; do not duplicate the figures here.

**Seasonal traffic pattern**: CITL traffic peaks April–July (active league season).
Off-season traffic is near zero.

Monitor in Firebase console → Hosting → Usage tab (weekly during season).

---

## Rollback Process

### Via Firebase CLI

```bash
# List recent deploys
firebase hosting:releases:list

# Roll back to a specific release
firebase hosting:rollback

# Roll back to N-th previous release
firebase hosting:rollback --count 2
```

### Via Firebase Console

Firebase console → Hosting → Release history → select release → "Rollback to this version"

### Decision Criteria

Roll back immediately if post-deployment verification finds:
- Any SPA route returns a blank page or 404
- CSP violations blocking Maps embed
- PDF downloads return 404
- JavaScript console errors on initial load

---

## Preview Channels

Preview channels create isolated deployments with 7-day expiry:

```bash
npm run deploy:preview
# Creates: https://citl-baed2--preview-[hash].web.app
```

**Use preview channels for**:
- Testing new features before promoting to live
- Sharing with stakeholders (league captains, etc.) for review
- Validating CSP headers without affecting production

**Clean up old channels**:
```bash
firebase hosting:channel:list
firebase hosting:channel:delete preview --force
```

---

## Environment Configuration

### Variable Injection

`VITE_FIREBASE_*` variables are read from `.env` at build time and embedded
directly into the JS bundle by Vite. They are **not** secrets at runtime
(they're visible in the browser), but they are not committed to git.

```bash
# .env (gitignored — never commit)
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_PROJECT_ID=citl-baed2
# ...

# .env.example (committed — template only)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_PROJECT_ID=citl-baed2
# ...
```

**Security note**: Firebase security rules (Firestore) enforce authorization server-side.
The API key being visible in the bundle is acceptable by Firebase design — rules are the
enforcement layer, not the key.

---

## DNS Cutover (Historical — Completed ~2026-05)

The DNS cutover is **complete**. `citl.club` and `www.citl.club` moved from AWS
CloudFront to Firebase Hosting around 2026-05, and the legacy AWS S3 + CloudFront
stack has been decommissioned (`terraform destroy` was executed at that time). The
site is live in production at **https://citl.club**. No cutover action remains.

---

## Troubleshooting

### Permission denied when deploying

```bash
firebase login --reauth
firebase use citl-baed2
npm run deploy
```

### Stale version cached by browser

Vite content-hashes all bundles — a new `npm run build` always generates new filenames.
If users still see an old version, check if `index.html` is being cached:
```bash
# Verify cache headers on index.html
curl -I https://citl-baed2.web.app
# Should include: cache-control: no-cache
```

### 404 on SPA routes

Cause: SPA rewrite not configured, or `firebase.json` `public` dir mismatch.
```bash
# Verify firebase.json has:
# "public": "dist"
# "rewrites": [{ "source": "**", "destination": "/index.html" }]
npm run build && firebase serve   # test locally before deploying
```

### CSP violation in browser console

Find the blocked resource, then update `firebase.json` headers → `Content-Security-Policy`.
Test with `npm run preview` first (serves `dist/` locally without CSP headers), then deploy
to a preview channel and verify in browser dev tools before promoting to production.

---

## References

- [Firebase Hosting Documentation](https://firebase.google.com/docs/hosting)
- [.specs/constitution.md](../constitution.md) — §VI Cost Constraints, §VII Migration Milestones
- [.specs/technical/build-system.md](./build-system.md) — Vite build output details
- [.specs/technical/cicd-pipeline.md](./cicd-pipeline.md) — GitHub Actions CI/CD
