# Firebase Deployment — citl.club

**Firebase Project**: `citl-baed2`
**Hosting Region**: `us-east1` (Firestore) / Global CDN (Hosting)
**Plan**: Spark (free tier)
**Last Updated**: 2026-02-27

---

## Overview

citl.club is deployed to Firebase Hosting. The `dist/` folder (Vite build output) is deployed
as a static SPA with a universal rewrite rule that sends all routes to `index.html`.

**Current deployment state**: Manual via Firebase CLI.
GitHub Actions CI/CD is deferred to Phase 6 (post-DNS cutover).
See [.specs/technical/cicd-pipeline.md](./cicd-pipeline.md).

---

## Firebase Project Configuration

### Project Binding

```
Firebase project ID: citl-baed2
Default alias:       default → citl-baed2
Config file:         .firebaserc
```

`.firebaserc` content:
```json
{
  "projects": {
    "default": "citl-baed2"
  }
}
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
- **Custom domain**: `citl.club` and `www.citl.club` (pending DNS cutover, Phase 7)

See [firebase.json](../../firebase.json) for full configuration.

---

## Deployment Process

### Manual Deployment (Current — Phase 1)

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
- [ ] Firebase Hosting quota not near 70% of 360 MB/day limit

### Post-Deployment Verification

After every deploy, verify at `https://citl-baed2.web.app` (or preview channel URL):

- [ ] Home page loads and displays standings / results feed
- [ ] Navigation works: About, Rules, Downloads, Scorecards
- [ ] Scorecards accordion expands all 7 seasons
- [ ] PDF score sheet links download correctly
- [ ] Google Maps embed loads on About page (tests CSP `frame-src`)
- [ ] Font Awesome icons render (tests CSP `style-src`/`font-src`)
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
- `style-src cdnjs.cloudflare.com` — Font Awesome CSS
- `font-src cdnjs.cloudflare.com` — Font Awesome fonts

---

## Hosting Metrics and Limits (Spark Plan)

| Resource | Limit | Alert at 70% |
|----------|-------|--------------|
| Hosting storage | 10 GB total | 7 GB |
| Daily transfer | 360 MB/day | 252 MB/day |
| SSL certificate | Included | — |

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
- CSP violations blocking Maps embed or Font Awesome
- PDF downloads return 404
- JavaScript console errors on initial load

---

## Preview Channels

Preview channels create isolated deployments with 7-day expiry:

```bash
npm run deploy:preview
# Creates: https://citl--preview-[hash].web.app
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

## DNS Cutover (Phase 7)

When ready to move `citl.club` from AWS CloudFront to Firebase Hosting:

### Step 1 — Add custom domains in Firebase console
```
Firebase console → Hosting → Add custom domain
  → citl.club
  → www.citl.club
```

### Step 2 — Update DNS records
```
# Remove: CNAME/A records pointing to CloudFront distribution
# Add:    A records pointing to Firebase Hosting IPs
#         (Firebase console provides the IPs during domain setup)
```

### Step 3 — Wait for SSL provisioning
Firebase automatically provisions SSL via Let's Encrypt (typically 24–48 hours).

### Step 4 — Verify
- [ ] `https://citl.club` loads correctly
- [ ] `https://www.citl.club` redirects to `https://citl.club`
- [ ] SSL certificate is valid (no browser warnings)
- [ ] All post-deployment verification steps pass on the live domain

### Step 5 — Decommission AWS
```bash
# After confirming citl.club is fully live on Firebase:
terraform destroy    # in the Terraform directory
```

**See constitution §VII for the full DNS cutover prerequisite checklist.**

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
- [.specs/technical/cicd-pipeline.md](./cicd-pipeline.md) — Automated deployment (Phase 6)
- [.prompts/platforms/firebase/firebase-best-practices.md](../../.prompts/platforms/firebase/firebase-best-practices.md)
- [.prompts/platforms/firebase/firebase-finops.md](../../.prompts/platforms/firebase/firebase-finops.md)
