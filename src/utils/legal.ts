/**
 * Terms of Use / Privacy Policy constants (spec 008).
 *
 * Bump TERMS_VERSION whenever the wording on /privacy changes in a way
 * members must accept again. Members whose stored profile termsVersion
 * differs are asked to re-accept on their next visit (AC-12). Must be
 * 1–20 characters (firestore.rules).
 */

import { leagueRequestsEnabled } from '@/utils/features';

/** Terms before league requests (spec 008). */
export const BASE_TERMS_VERSION = '2026-10';

/**
 * Terms once league requests are on (spec 010 AC-22, DD-7): /privacy adds
 * dependents, league requests, scorecard links, and captain handoffs.
 */
export const LEAGUE_TERMS_VERSION = '2026-10.2';

/** Turning VITE_LEAGUE_REQUESTS on raises the version, so every member re-accepts. */
export const TERMS_VERSION = leagueRequestsEnabled ? LEAGUE_TERMS_VERSION : BASE_TERMS_VERSION;

/** Stable anchor ids on the /privacy page. */
export const LEGAL_ANCHORS = {
  terms: 'terms-of-use',
  privacy: 'privacy-policy',
} as const;

/** Date the /privacy wording was last changed, shown on the page. */
export const PRIVACY_UPDATED = 'October 6, 2026';
