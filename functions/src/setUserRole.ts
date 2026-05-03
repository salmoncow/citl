/**
 * setUserRole — owner-only callable that writes a user's role.
 *
 * Defense in depth (in order):
 *   1. App Check enforced in production (relaxed under FUNCTIONS_EMULATOR
 *      so the emulator E2E walkthrough works).
 *   2. Caller must be authenticated AND have role:'owner' in their
 *      Firebase ID-token claim.
 *   3. zod-validated inputs ({ targetUid, role }).
 *   4. Inside a single Firestore transaction:
 *      - Target user doc exists.
 *      - Last-owner guard: cannot demote the only `owner`.
 *      - Rate limit: <=20 calls/hour/actor (sliding window).
 *      - Writes: update users/{targetUid} (role + roleChangedAt),
 *        create audit/{auto} entry, bump rateLimits counter.
 *   5. After TX commits: setCustomUserClaims with the new role.
 *
 * Failure modes:
 *   - permission-denied: caller missing or not owner
 *   - invalid-argument: bad input
 *   - not-found: target user doc doesn't exist
 *   - failed-precondition: would demote last owner
 *   - resource-exhausted: rate limit hit
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setUserRoleInput, type Role } from './lib/validate.js';
import { assertNotLastOwner } from './lib/lastOwnerGuard.js';
import { checkAndBumpInTransaction } from './lib/rateLimit.js';

if (getApps().length === 0) {
  initializeApp();
}

const isEmulator = process.env['FUNCTIONS_EMULATOR'] === 'true';

export const setUserRole = onCall(
  {
    enforceAppCheck: !isEmulator,
    region: 'us-central1',
  },
  async (req): Promise<{ ok: true; fromRole: Role; toRole: Role }> => {
    if (!req.auth || req.auth.token['role'] !== 'owner') {
      throw new HttpsError('permission-denied', 'Owner role required.');
    }
    const actorUid = req.auth.uid;

    const parsed = setUserRoleInput.safeParse(req.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const { targetUid, role: newRole } = parsed.data;

    const db = getFirestore();
    const userRef = db.doc(`users/${targetUid}`);

    const result = await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        throw new HttpsError('not-found', `User ${targetUid} not found.`);
      }
      const currentRole = (userSnap.data()?.['role'] as Role | undefined) ?? 'user';

      await assertNotLastOwner(tx, db, currentRole, newRole);
      await checkAndBumpInTransaction(tx, db, actorUid);

      tx.update(userRef, {
        role: newRole,
        roleChangedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      tx.create(db.collection('audit').doc(), {
        actorUid,
        targetUid,
        fromRole: currentRole,
        toRole: newRole,
        at: FieldValue.serverTimestamp(),
      });

      return { fromRole: currentRole, toRole: newRole };
    });

    // Claim is set after the TX commits. If this throws, the mirror has
    // the new role but the claim is stale; the caller can retry to
    // resync (the next TX will see currentRole == new role and short-
    // circuit the duplicate audit entry path is acceptable since the
    // last-owner guard still holds).
    await getAuth().setCustomUserClaims(targetUid, { role: newRole });

    return { ok: true, ...result };
  },
);
