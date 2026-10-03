/**
 * Sliding 1-hour window rate limit for callables.
 *
 * Counter at rateLimits/{name}/actors/{actorUid} with shape:
 *   { windowStart: number (ms epoch), count: number }
 *
 * Reads + bumps run inside the caller's Firestore transaction so the
 * counter is consistent with the guarded write. If the counter is missing
 * or its windowStart is older than WINDOW_MS, the window resets.
 *
 * Counters in use:
 *   - setUserRole      20/hour/actor (RATE_LIMITS.setUserRole)
 *   - setAccountStatus 10/hour/uid   (RATE_LIMITS.setAccountStatus)
 *   - teamProposal     60/hour/uid   (RATE_LIMITS.teamProposal)
 */

import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

export const WINDOW_MS = 60 * 60 * 1000;

export interface RateLimitSpec {
  /** Counter name; the path segment under rateLimits/. */
  name: string;
  /** Maximum calls per actor per WINDOW_MS. */
  limit: number;
}

export const RATE_LIMITS = {
  setUserRole: { name: 'setUserRole', limit: 20 },
  setAccountStatus: { name: 'setAccountStatus', limit: 10 },
  teamProposal: { name: 'teamProposal', limit: 60 },
} as const satisfies Record<string, RateLimitSpec>;

/** Kept for existing callers: the setUserRole limit. */
export const LIMIT = RATE_LIMITS.setUserRole.limit;

interface RateCounter {
  windowStart: number;
  count: number;
}

export function rateLimitRef(db: Firestore, actorUid: string, name: string = RATE_LIMITS.setUserRole.name) {
  return db.doc(`rateLimits/${name}/actors/${actorUid}`);
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
  spec: RateLimitSpec = RATE_LIMITS.setUserRole,
  now: number = Date.now(),
): Promise<void> {
  const ref = rateLimitRef(db, actorUid, spec.name);
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

  if (data.count >= spec.limit) {
    throw new HttpsError(
      'resource-exhausted',
      `Rate limit exceeded: ${spec.limit} ${spec.name} calls per hour.`,
    );
  }

  tx.update(ref, { count: data.count + 1 });
}
