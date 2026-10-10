# Firebase Deployment — citl.club

**Firebase Project**: `citl-baed2`
**Project Number**: `983886495824`
**Hosting Region**: Global CDN (Hosting) / Functions `us-central1` (see below)
**Plan**: Blaze (pay-as-you-go; usage targets Spark-equivalent quotas)
**Last Updated**: 2026-10-01

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

# Preview deploy to the citl-preview site (https://citl-preview.web.app)
npm run deploy:preview
# equivalent to: npm run build && npm run deploy:preview:site
# (writes .firebase-preview.json from firebase.json's hosting block with
#  site: citl-preview, then `firebase deploy --only hosting --config ...`)
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

citl-baed2 has Cloud Functions deployed in **`us-central1`**: the RBAC `setUserRole`
callable and the on-create user-mirror trigger (first deploy 2026-05-04), the spec 008
account callables `setAccountStatus` and `deleteAccount`, the spec 009/010 league callables,
and the spec 011 email functions (below).

**Region**: earlier revisions of this doc said `us-east1`. The deployed region is whatever
the `region` option in `functions/src/*.ts` says, and the browser client
(`src/infrastructure/functions.ts`) calls `us-central1`; `setUserRole` working in production
means it runs there. Confirm once with
`gcloud run services list --project=citl-baed2` (spec 008 task 1.7) — not yet run from a
credentialed shell.

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
  --region=us-central1 \
  --member=allUsers \
  --role=roles/run.invoker \
  --project=citl-baed2
```

Bindings in place / required:

| Cloud Run service | Callable | Binding |
|-------------------|----------|---------|
| `setuserrole` | `setUserRole` (spec 002) | Applied at first deploy (2026-05-04) |
| `setaccountstatus` | `setAccountStatus` (spec 008) | **Run once after the spec 008 deploy** |
| `deleteaccount` | `deleteAccount` (spec 008) | **Run once after the spec 008 deploy** |
| `teamproposal` | `teamProposal` (spec 009) | **Run once after the spec 009 deploy** |
| `reviewrequest` | `reviewRequest` (spec 010) | **Run once after the spec 010 deploy** |
| `captainhandoff` | `captainHandoff` (spec 010) | **Run once after the spec 010 deploy** |
| `unsubscribe` | `unsubscribe` (spec 011, HTTP via the `/unsubscribe` rewrite) | **Run once after the spec 011 deploy** |

Without the binding, browser calls fail with a CORS / 403 error.

This is **not** an authorization weakening — the in-function checks (`req.auth`, the
`role` claim, recent sign-in for delete) are the actual boundary. See the global
`firebase-deploy-runbook` skill (Gotcha 2) for the full rationale.

### Email notifications (spec 011)

Six functions: `sendMail` (Firestore `mail/{id}` created), `onAnnouncementCreated`,
`onWeekPublished`, `onSeasonUpdated` (Firestore triggers), `requestDigest` (Cloud
Scheduler, 07:00 America/Chicago), and `unsubscribe` (HTTP). Only `unsubscribe` needs the
invoker binding above; event and scheduled functions are invoked by Google's own service
agents.

Configuration:

| Name | Kind | Value |
|------|------|-------|
| `SES_ROLE_ARN` | Param (`functions/.env.citl-baed2`, committed) | `SenderRoleArn` output of the `citl-mail` stack. Not a secret: the role trusts only this project's compute service account ([aws-infrastructure.md](aws-infrastructure.md)) |
| `UNSUBSCRIBE_SECRET` | Secret Manager | Random HMAC key for unsubscribe links. Rotating it invalidates links in mail already sent |

The sender has no AWS keys: it exchanges a Google ID token from the metadata server for
temporary credentials on `citl-ses-sender` (ADR-015). In the emulator, mail is logged, not
sent.

**First deploy** (owner credentials, before merging the build PR; the CI service account
cannot set the invoker policy, enable APIs, or create the secret):

```bash
# 1. Create the secret (paste a random value, e.g. from: openssl rand -base64 32)
firebase functions:secrets:set UNSUBSCRIBE_SECRET --project citl-baed2

# 2. From the PR branch: deploy rules, the TTL index, and the six functions.
#    Enables the Eventarc and Cloud Scheduler APIs and grants the runtime
#    service account access to the secret.
firebase deploy --project citl-baed2 --only firestore:rules,firestore:indexes,functions:sendMail,functions:unsubscribe,functions:onAnnouncementCreated,functions:onWeekPublished,functions:onSeasonUpdated,functions:requestDigest

# 3. Public invoker for the unsubscribe endpoint
gcloud run services add-iam-policy-binding unsubscribe --region=us-central1 \
  --member=allUsers --role=roles/run.invoker --project=citl-baed2
```

The first deploy of the four Firestore-triggered functions failed on 2026-10-06 with
"Permission denied while using the Eventarc Service Agent" (first Eventarc use in the
project; the agent's role had not propagated). Deploying those four again a few minutes later
succeeded. If it persists, grant `roles/eventarc.serviceAgent` to
`service-590948706466@gcp-sa-eventarc.iam.gserviceaccount.com`.

If a later CI deploy fails reading the secret or the scheduler job, grant the CI service
account `roles/secretmanager.viewer` and `roles/cloudscheduler.admin` on the project.

### First-time deploy to a different project

If we ever stand up a new Firebase project (preview environment, fork, etc.), the
first `firebase deploy --only functions` will fail with the well-known
`gcf-sources-{PROJECT_NUMBER}-{REGION}` permission error. The fix is one
`gcloud projects add-iam-policy-binding` command + a 30-60s wait, then retry.

**See the global `firebase-deploy-runbook` skill** (`~/.claude/skills/firebase-deploy-runbook/SKILL.md`)
for the full first-time-deploy checklist (IAM propagation, invoker binding,
Artifact Registry cleanup policy).

---

## Sign-in Providers (spec 008)

Firebase console → Authentication → Sign-in method. Record the date each step is done.

| Provider | Setup | Status |
|----------|-------|--------|
| Google | Already enabled. Add `https://citl.club/privacy` as the privacy/terms URL on the Google OAuth consent screen. | Enabled; consent-screen URL: _pending_ |
| Email link | Enable Email/Password with **Email link (passwordless sign-in)**. Keep **email enumeration protection on** (the client never calls `fetchSignInMethodsForEmail`). Optional: custom sender domain (DNS verification for `citl.club`, records in Route 53). | Enabled 2026-10-01; enumeration protection: _confirm_ |
| Microsoft | Not enabled (owner decision 2026-10-02). | — |
| Apple | Not enabled (owner decision 2026-10-01: $99/yr developer fee is outside budget). | — |

**Authorized domains** (Authentication → Settings): `citl.club`, `citl-baed2.web.app`,
`citl-baed2.firebaseapp.com`, `localhost`, and `citl-preview.web.app` (the preview site) so
popups and email links work on preview deploys. The old `citl-baed2--preview-*.web.app` channel
entry can be removed; App Check fails on channel URLs anyway.
The email-link continue URL is the origin root (`<origin>/`), so the origin must be listed.

**Auth domain = the serving domain.** Production builds use `authDomain: citl.club`
(`VITE_FIREBASE_AUTH_DOMAIN` secret) and preview builds use `citl-preview.web.app`
(set in `deploy-preview.yml`). Each Hosting site serves its own `/__/auth/handler` and
`/__/auth/iframe`, so the sign-in frame is same-origin: CSP `frame-src 'self'` covers it and
browsers that partition third-party storage don't break the popup. Pointing a site at
another site's auth domain fails: CSP blocks framing it (seen on the first preview deploy).
Each auth domain's handler must be on the Google OAuth web client's **Authorized redirect
URIs** (Google Cloud console → APIs & Services → Credentials):
`https://citl.club/__/auth/handler`, `https://citl-preview.web.app/__/auth/handler`.

**Client toggle**: `VITE_AUTH_PROVIDERS` (default `google,email`) controls which
buttons render. Enable a provider in the console before adding it to the list.

**CSP**: no change. The auth iframe and handler run on the site's own domain (`'self'`;
`*.firebaseapp.com` stays in `frame-src` for the default auth domain),
callables on `*.run.app` / `*.cloudfunctions.net` (`connect-src`); no provider avatars are
rendered. Verify on preview (spec 008 task 11.5).

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
- **App Check** with reCAPTCHA Enterprise — enforced on Cloud Functions callables in
  code (`enforceAppCheck: !isEmulator`) and on Firestore and Authentication via the
  Firebase Console (App Check → APIs → Enforce)
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

### Domain verification and previews

One Score-based key, `citl-login-main`, with **domain verification ON**
(`allowAllDomains: false`). Allowed domains:

- `citl.club`, `www.citl.club`
- `citl-baed2.web.app`, `citl-baed2.firebaseapp.com`
- `citl-preview.web.app` (PR previews, below)
- `localhost` (`npm run dev:prod`)

Check it with `gcloud recaptcha keys list --project=citl-baed2` (read-only).

**Enforcement**: Firebase Console → App Check → APIs enforces Cloud Firestore
and Authentication; every callable sets `enforceAppCheck: !isEmulator`. An
origin that can't mint a token can't read Firestore, sign in, or call a
function.

**Previews**: reCAPTCHA allowed domains have no mid-label wildcards, so
Hosting preview channels (`citl-baed2--<channel>-<hash>.web.app`) can never
be allowlisted. PR previews therefore deploy to a second Hosting site,
`citl-preview`, whose hostname is fixed and on the list
(`.github/workflows/deploy-preview.yml`, `npm run deploy:preview`). It is a
single slot: the most recent PR deploy wins. It runs against production
data, like the old preview channels.

**No debug tokens in builds.** Until 2026-10 the preview workflow injected
an App Check debug token, which was compiled into every public preview
bundle. Anyone could read it there and mint App Check tokens for production.
Now:

- `src/infrastructure/appcheck.ts` reads `VITE_APP_CHECK_DEBUG_TOKEN` only when
  `import.meta.env.DEV` (Vite dev server); `vite build` drops the branch.
- `scripts/check-app-check-debug.js` (CI build job and the hosting `predeploy`
  hook) fails if any workflow references a debug token, if a build contains
  the debug branch, or if a build inlines the whole `import.meta.env` object.
  (Bracket access such as `import.meta.env['X']` causes that and ships every
  `VITE_*` value.)
- A personal debug token for local dev lives only in your `.env`. Revoke it
  in Console → App Check → Apps → Manage debug tokens when you're done.

**Why not one key with verification off** (runbook Option 1): the key is public
in the bundle, so anyone could mint production App Check tokens from any
origin. That was tolerable for open-read standings. With member profiles,
email addresses, and dependents in the data model (specs 008–012), it isn't.
**Why not a second, permissive key** (runbook Option 2): App Check binds one
site key per web app, so that means a second web app whose permissive key
works from any origin. That leaves the same hole, just behind a different app ID.

**See the `firebase-deploy-runbook` skill** for the general trade-off.

### Post-Deployment Verification

After every deploy, verify at `https://citl-baed2.web.app` (or `https://citl-preview.web.app`):

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

## Preview Site

PR previews deploy to the `citl-preview` Hosting site, not to preview
channels (see App Check Configuration for why):

```bash
npm run deploy:preview
# Deploys to: https://citl-preview.web.app
```

CI does the same on every non-dependabot PR (`deploy-preview.yml`) and writes
the URL to the job summary. There's one slot, so the last deploy wins.

**Use the preview site for**:
- Testing new features before promoting to live
- Sharing with stakeholders (league captains, etc.) for review
- Validating CSP headers without affecting production

Don't use `firebase hosting:channel:deploy`. Channel URLs aren't on the
reCAPTCHA key's allowlist, so Firestore, sign-in, and callables all fail
App Check there.

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
