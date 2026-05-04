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
 */

import { getApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { useEmulator } from '@/firebase-config';

let initialized = false;

export function initAppCheck(): void {
  if (initialized) return;

  if (useEmulator) {
    initialized = true;
    return;
  }

  const siteKey = import.meta.env['VITE_RECAPTCHA_ENTERPRISE_SITE_KEY'];
  if (!siteKey) {
    // eslint-disable-next-line no-console
    console.warn(
      '[appcheck] VITE_RECAPTCHA_ENTERPRISE_SITE_KEY not set; App Check init skipped. ' +
        'setUserRole and other enforced callables will reject this client.',
    );
    initialized = true;
    return;
  }

  initializeAppCheck(getApp(), {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
  initialized = true;
}
