/**
 * Firebase App Check initialization.
 *
 * Skipped entirely under VITE_USE_EMULATOR (the emulator suite does
 * not implement the App Check exchange endpoint, and the Cloud
 * Function gates enforceAppCheck on FUNCTIONS_EMULATOR server-side).
 *
 * In staging/prod, requires VITE_RECAPTCHA_ENTERPRISE_SITE_KEY to be a registered
 * reCAPTCHA Enterprise site key for the project's hostnames. Without
 * it, App Check init is skipped and a console warning is emitted —
 * the deployed Cloud Function will reject calls without an App Check
 * token, so the warning is operational, not silent.
 *
 * For Firebase Hosting preview channels: reCAPTCHA Enterprise doesn't
 * support mid-label wildcards (citl-baed2--*.web.app is invalid) and
 * preview URLs are siblings of citl-baed2.web.app, not subdomains —
 * so real reCAPTCHA tokens can't be minted from preview origins.
 * Set VITE_APP_CHECK_DEBUG_TOKEN in preview-channel deploys (CI
 * injects from a secret) and register the same token under Firebase
 * Console → App Check → Apps → Manage debug tokens. The SDK then
 * exchanges the debug token for a real App Check token from Firebase's
 * service, bypassing reCAPTCHA on the client.
 *
 * Production builds MUST NOT set VITE_APP_CHECK_DEBUG_TOKEN — only the
 * preview-channel deploy workflow injects it.
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

  const siteKey = import.meta.env['VITE_RECAPTCHA_ENTERPRISE_SITE_KEY'];
  if (!siteKey) {
    console.warn(
      '[appcheck] VITE_RECAPTCHA_ENTERPRISE_SITE_KEY not set; App Check init skipped. ' +
        'setUserRole and other enforced callables will reject this client.',
    );
    initialized = true;
    return;
  }

  // Debug token for non-production builds (Firebase Hosting preview
  // channels, occasional local-against-prod testing). MUST be set
  // BEFORE initializeAppCheck() so the SDK picks it up. The token must
  // also be registered in Firebase Console → App Check → Apps →
  // Manage debug tokens for the citl web app. Production deploys never
  // inject this env var; see deploy-production.yml vs deploy-preview.yml.
  const debugToken = import.meta.env['VITE_APP_CHECK_DEBUG_TOKEN'];
  if (debugToken) {
    window.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
    console.warn(
      '[appcheck] DEBUG TOKEN MODE — reCAPTCHA bypassed. ' +
        'Production builds must NEVER set VITE_APP_CHECK_DEBUG_TOKEN.',
    );
  }

  initializeAppCheck(getApp(), {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
  initialized = true;
}
