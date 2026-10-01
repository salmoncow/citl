/**
 * setAccountStatus — self-only callable that deactivates or reactivates
 * the caller's own account (spec 008 F5, DD-1, DD-7, DD-9).
 *
 * Sequence:
 *   1. App Check enforced in production (relaxed under FUNCTIONS_EMULATOR).
 *   2. Caller must be authenticated.
 *   3. zod-validated input ({ status: 'active' | 'deactivated' }).
 *   4. Owners and admins are refused (DD-7): they must be demoted first.
 *   5. Inside one Firestore transaction:
 *      - Read users/{uid}; missing → not-found.
 *      - No-op (already in the requested status) → return, write nothing.
 *      - Captain guard on deactivate (M1 no-op seam, DD-5).
 *      - Rate limit: <=10 calls/hour/uid, counter bumped in this TX.
 *      - Update the mirror and queue an `account-status` audit entry.
 *
 * Deactivation does not disable the Auth user (DD-9): the member must be
 * able to sign in to reactivate.
 *
 * Failure modes:
 *   - unauthenticated: no caller
 *   - invalid-argument: bad input
 *   - failed-precondition: caller is owner/admin, or a captain (M2+)
 *   - not-found: users/{uid} mirror missing
 *   - resource-exhausted: rate limit hit
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { setAccountStatusInput, type AccountStatus } from './lib/validate.js';
import { checkAndBumpInTransaction, RATE_LIMITS } from './lib/rateLimit.js';
import { queueAuditEntry } from './lib/audit.js';
import { assertNotCaptain } from './lib/captainGuard.js';

if (getApps().length === 0) {
  initializeApp();
}

const isEmulator = process.env['FUNCTIONS_EMULATOR'] === 'true';

export interface SetAccountStatusResult {
  ok: true;
  status: AccountStatus;
  changed: boolean;
}

export const PRIVILEGED_ROLE_MESSAGE =
  'Owners and admins cannot change their own account status. Ask an owner to change your role first.';

/**
 * Handler factory. The captain guard is injectable so tests can exercise
 * the "guard throws" path before M2 gives the guard a body.
 */
export function makeSetAccountStatusHandler(guard: typeof assertNotCaptain = assertNotCaptain) {
  return async (req: CallableRequest<unknown>): Promise<SetAccountStatusResult> => {
    if (!req.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const uid = req.auth.uid;

    const parsed = setAccountStatusInput.safeParse(req.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const { status: toStatus } = parsed.data;

    const role = req.auth.token['role'];
    if (role === 'owner' || role === 'admin') {
      throw new HttpsError('failed-precondition', PRIVILEGED_ROLE_MESSAGE);
    }

    const db = getFirestore();
    const userRef = db.doc(`users/${uid}`);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) {
        throw new HttpsError('not-found', 'Account record not found.');
      }
      const fromStatus = (snap.data()?.['status'] as AccountStatus | undefined) ?? 'active';
      if (fromStatus === toStatus) {
        return { ok: true as const, status: toStatus, changed: false };
      }

      if (toStatus === 'deactivated') {
        await guard(db, uid);
      }
      await checkAndBumpInTransaction(tx, db, uid, RATE_LIMITS.setAccountStatus);

      tx.update(userRef, {
        status: toStatus,
        deactivatedAt: toStatus === 'deactivated' ? FieldValue.serverTimestamp() : null,
        statusChangedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      queueAuditEntry(tx, db, {
        kind: 'account-status',
        actorUid: uid,
        targetUid: uid,
        fromStatus,
        toStatus,
      });

      return { ok: true as const, status: toStatus, changed: true };
    });
  };
}

export const setAccountStatus = onCall(
  {
    enforceAppCheck: !isEmulator,
    region: 'us-central1',
  },
  makeSetAccountStatusHandler(),
);
