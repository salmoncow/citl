/**
 * Require a recent sign-in for sensitive operations (account delete).
 *
 * `auth_time` is the epoch-seconds time of the user's last real sign-in,
 * not of the last token refresh, so it measures how long ago the user
 * proved who they are.
 */

import { HttpsError } from 'firebase-functions/v2/https';

export const RECENT_AUTH_MAX_AGE_SEC = 300;

export function assertRecentAuth(
  token: { auth_time?: number } | undefined,
  maxAgeSec: number = RECENT_AUTH_MAX_AGE_SEC,
  nowSec: number = Math.floor(Date.now() / 1000),
): void {
  const authTime = token?.auth_time;
  if (typeof authTime !== 'number' || nowSec - authTime > maxAgeSec) {
    throw new HttpsError(
      'failed-precondition',
      'Please sign in again to confirm this action.',
      { reason: 'requires-recent-login' },
    );
  }
}
