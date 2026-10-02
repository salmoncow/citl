/**
 * Terms of Use / Privacy Policy constants (spec 008).
 *
 * Bump TERMS_VERSION whenever the wording on /privacy changes in a way
 * members must accept again. Members whose stored profile termsVersion
 * differs are asked to re-accept on their next visit (AC-12). Must be
 * 1–20 characters (firestore.rules).
 */

export const TERMS_VERSION = '2026-10';

/** Stable anchor ids on the /privacy page. */
export const LEGAL_ANCHORS = {
  terms: 'terms-of-use',
  privacy: 'privacy-policy',
} as const;
