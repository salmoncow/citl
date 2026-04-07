---
name: deploy-preview
description: Prepare and execute a Firebase preview channel deployment. Triggers on phrases like "deploy preview", "preview deploy", "test deployment", "Firebase preview".
---

Prepare and execute a Firebase preview channel deployment.

## Steps

### 1. Build
Run `npm run build`. If it fails, report the error and stop.

### 2. Typecheck
Run `npm run typecheck`. If it fails, report the error and stop.

### 3. Run tests
Run `npm run test`. If it fails, report the error and stop.

### 4. Deploy to preview channel
Run `firebase hosting:channel:deploy preview --expires 7d`.

Report the preview URL from the output.

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
- Preview channels expire after 7 days
- If any pre-deploy step fails, do NOT proceed with deployment
