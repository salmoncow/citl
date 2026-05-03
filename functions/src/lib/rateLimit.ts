/**
 * Sliding 1-hour window rate limit for setUserRole.
 *
 * Counter at rateLimits/setUserRole/actors/{actorUid} with shape:
 *   { windowStart: number (ms epoch), count: number }
 *
 * Reads + bumps run inside the caller's Firestore transaction so the
 * counter is consistent with the role write. If the counter is missing
 * or its windowStart is older than WINDOW_MS, the window resets.
 */

import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

export const WINDOW_MS = 60 * 60 * 1000;
export const LIMIT = 20;

interface RateCounter {
  windowStart: number;
  count: number;
}

export function rateLimitRef(db: Firestore, actorUid: string) {
  return db.doc(`rateLimits/setUserRole/actors/${actorUid}`);
}

/**
 * Inside the given transaction, check that actorUid has not exceeded the
 * rate limit, then queue the write to bump the counter. Throws
 * HttpsError('resource-exhausted') if at or above the limit in the
 * current window.
 */
export async function checkAndBumpInTransaction(
  tx: Transaction,
  db: Firestore,
  actorUid: string,
  now: number = Date.now(),
): Promise<void> {
  const ref = rateLimitRef(db, actorUid);
  const snap = await tx.get(ref);

  if (!snap.exists) {
    tx.set(ref, { windowStart: now, count: 1 });
    return;
  }

  const data = snap.data() as RateCounter;
  const windowExpired = now - data.windowStart >= WINDOW_MS;

  if (windowExpired) {
    tx.set(ref, { windowStart: now, count: 1 });
    return;
  }

  if (data.count >= LIMIT) {
    throw new HttpsError(
      'resource-exhausted',
      `Rate limit exceeded: ${LIMIT} role changes per hour per actor.`,
    );
  }

  tx.update(ref, { count: data.count + 1 });
}
