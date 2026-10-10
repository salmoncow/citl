---
name: deploy-preview
description: Prepare and execute a preview deployment to the citl-preview Hosting site. Triggers on phrases like "deploy preview", "preview deploy", "test deployment", "Firebase preview".
---

Prepare and execute a preview deployment to the `citl-preview` Hosting site.

## Steps

### 1. Build
Run `npm run build`. If it fails, report the error and stop.

### 2. Typecheck
Run `npm run typecheck`. If it fails, report the error and stop.

### 3. Run tests
Run `npm run test`. If it fails, report the error and stop.

### 4. Deploy to the preview site
Run `npm run deploy:preview:site` (the build from step 1 is reused).

The preview URL is always https://citl-preview.web.app. Do NOT use
`firebase hosting:channel:deploy`: channel URLs aren't on the reCAPTCHA key's
allowlist, so App Check fails there (Firestore, sign-in, and callables all break).

### 5. Post-deploy verification checklist
Remind the user to verify (from `.specs/technical/firebase-deployment.md`):
- Home page loads (standings/results feed)
- Navigation works (About, Rules, Downloads, Scorecards)
- Scorecards accordion expands all 7 seasons
- PDF links download
- Google Maps embed loads (About page)
- Browser console: zero errors, zero CSP violations

## Important notes
- Firestore security rules are NOT deployed to preview channels — production only
- The preview site is a single slot: CI deploys from PRs overwrite it, and the last deploy wins
- Never set an App Check debug token for a build; the predeploy guard fails the deploy
- If any pre-deploy step fails, do NOT proceed with deployment
