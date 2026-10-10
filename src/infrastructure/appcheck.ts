/**
 * Firebase App Check initialization.
 *
 * Skipped entirely under VITE_USE_EMULATOR (the emulator suite does
 * not implement the App Check exchange endpoint, and the Cloud
 * Function gates enforceAppCheck on FUNCTIONS_EMULATOR server-side).
 *
 * Deployed builds require VITE_RECAPTCHA_ENTERPRISE_SITE_KEY, the
 * reCAPTCHA Enterprise site key registered for this app. The key has
 * domain verification ON: it mints tokens only on its allowed-domains
 * list (citl.club, www.citl.club, citl-baed2.web.app,
 * citl-baed2.firebaseapp.com, citl-preview.web.app, localhost). Without
 * the key, App Check init is skipped and a console warning is emitted;
 * Firestore, Auth, and the callables enforce App Check, so the warning
 * is operational, not silent.
 *
 * PR previews deploy to the dedicated `citl-preview` Hosting site, a
 * fixed hostname on that list, so they mint real reCAPTCHA tokens.
 * Firebase Hosting preview channels (citl-baed2--*.web.app) are not on
 * the list and cannot be: the list has no mid-label wildcards.
 *
 * Debug tokens are honoured only by the Vite dev server
 * (import.meta.env.DEV), never by `vite build`. A debug token in a
 * built bundle is public, and anyone holding it can mint App Check
 * tokens for production. scripts/check-app-check-debug.js fails CI and
 * every deploy if a build contains the debug branch.
 */

import { getApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { useEmulator } from '@/firebase-config';

declare global {
  interface Window {
    FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean;
  }
}

let initialized = false;

export function initAppCheck(): void {
  if (initialized) return;

  if (useEmulator) {
    initialized = true;
    return;
  }

  const siteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;
  if (!siteKey) {
    console.warn(
      '[appcheck] VITE_RECAPTCHA_ENTERPRISE_SITE_KEY not set; App Check init skipped. ' +
        'setUserRole and other enforced callables will reject this client.',
    );
    initialized = true;
    return;
  }

  // Debug token for local dev against production (`vite` without
  // VITE_USE_EMULATOR on a non-allowlisted origin). Gated on DEV so
  // `vite build` replaces the condition with false and drops this
  // branch, whatever the environment holds. MUST be set BEFORE
  // initializeAppCheck() so the SDK picks it up. Register the token
  // under Firebase Console → App Check → Apps → Manage debug tokens,
  // and keep it in your local .env only.
  const debugToken = import.meta.env.DEV ? import.meta.env.VITE_APP_CHECK_DEBUG_TOKEN : undefined;
  if (debugToken) {
    window.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
    // scripts/check-app-check-debug.js searches built bundles for this
    // marker; keep the two in sync.
    console.warn('[appcheck] DEBUG TOKEN MODE — reCAPTCHA bypassed (dev server only).');
  }

  initializeAppCheck(getApp(), {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
  initialized = true;
}
