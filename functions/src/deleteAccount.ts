/**
 * deleteAccount — self-only callable that permanently deletes the
 * caller's account (spec 008 F5, DD-1, DD-7, DD-8).
 *
 * Order (DD-8: retry-safe, Auth last):
 *   1. Guards: App Check, auth, zod ({ confirm: 'DELETE' }), recent
 *      sign-in (auth_time within 5 min), owner/admin refused (DD-7),
 *      captain guard (M1 no-op seam, DD-5).
 *   2. recursiveDelete(profiles/{uid}) — covers the future dependents
 *      subcollection.
 *   3. One batch: delete notificationSettings/{uid} and users/{uid}, and
 *      create one `account-status` audit entry (toStatus 'deleted', uids
 *      only, no PII).
 *   4. revokeRefreshTokens(uid), then deleteUser(uid).
 *
 * Every step tolerates already-deleted state, so a retry after a partial
 * failure succeeds. A retry after a step-4 failure may write a second
 * audit entry, which is accepted. Deleting Auth first was rejected: it
 * would leave PII with no owner able to retry.
 *
 * Never reads or writes seasons/**: scores are keyed by shooter name, so
 * a deleted member's name stays on published scorecards (AC-17).
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { deleteAccountInput, type AccountStatus } from './lib/validate.js';
import { queueAuditEntry } from './lib/audit.js';
import { assertNotCaptain } from './lib/captainGuard.js';
import { assertRecentAuth } from './lib/recentAuth.js';

if (getApps().length === 0) {
  initializeApp();
}

const isEmulator = process.env['FUNCTIONS_EMULATOR'] === 'true';

export const PRIVILEGED_ROLE_MESSAGE =
  'Owners and admins cannot delete their own account. Ask an owner to change your role first.';

function isUserNotFound(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === 'auth/user-not-found';
}

/** Handler factory; the captain guard is injectable for tests. */
export function makeDeleteAccountHandler(guard: typeof assertNotCaptain = assertNotCaptain) {
  return async (req: CallableRequest<unknown>): Promise<{ ok: true }> => {
    if (!req.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const uid = req.auth.uid;

    const parsed = deleteAccountInput.safeParse(req.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', 'Type DELETE to confirm.');
    }

    assertRecentAuth(req.auth.token);

    const role = req.auth.token['role'];
    if (role === 'owner' || role === 'admin') {
      throw new HttpsError('failed-precondition', PRIVILEGED_ROLE_MESSAGE);
    }

    const db = getFirestore();
    await guard(db, uid);

    // 2. Profile and any subcollections (no-op if already gone).
    await db.recursiveDelete(db.doc(`profiles/${uid}`));

    // 3. Mirror, reserved settings doc, and audit entry, atomically.
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    const fromStatus = (userSnap.data()?.['status'] as AccountStatus | undefined) ?? 'active';
    const batch = db.batch();
    batch.delete(db.doc(`notificationSettings/${uid}`));
    batch.delete(userRef);
    queueAuditEntry(batch, db, {
      kind: 'account-status',
      actorUid: uid,
      targetUid: uid,
      fromStatus,
      toStatus: 'deleted',
    });
    await batch.commit();

    // 4. Auth last.
    const adminAuth = getAuth();
    try {
      await adminAuth.revokeRefreshTokens(uid);
      await adminAuth.deleteUser(uid);
    } catch (err) {
      if (!isUserNotFound(err)) throw err;
    }

    return { ok: true };
  };
}

export const deleteAccount = onCall(
  {
    enforceAppCheck: !isEmulator,
    region: 'us-central1',
  },
  makeDeleteAccountHandler(),
);
