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
 *      - Rate limit: <=20 calls/hour/actor (sliding window). Counter
 *        write is queued in this same TX so a failed commit doesn't
 *        bump the count.
 *      - **setCustomUserClaims (Auth API)** — called BEFORE the queued
 *        Firestore writes. The claim is the security boundary that
 *        Firestore rules read; ordering it ahead of the mirror+audit
 *        commit gives fail-closed-on-revocation semantics if the TX
 *        commit later fails. See spec.md §VI Design Decisions for the
 *        full failure-mode table and rationale.
 *      - Queued writes: update users/{targetUid} (role + roleChangedAt
 *        + updatedAt), create audit/{auto}, bump rateLimits counter.
 *   5. TX commits → all four Firestore writes apply atomically.
 *
 * Failure modes:
 *   - permission-denied: caller missing or not owner
 *   - invalid-argument: bad input
 *   - not-found: target user doc doesn't exist
 *   - failed-precondition: would demote last owner
 *   - resource-exhausted: rate limit hit
 *
 * TX retry note: Firestore retries the TX function on contention.
 * setCustomUserClaims is therefore called once per attempt with the
 * same payload — idempotent, no security impact, marginal extra Auth
 * API cost only on contention.
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
      // Reads first (Firestore TX rule: all reads before any writes).
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        throw new HttpsError('not-found', `User ${targetUid} not found.`);
      }
      const currentRole = (userSnap.data()?.['role'] as Role | undefined) ?? 'user';

      await assertNotLastOwner(tx, db, currentRole, newRole);
      await checkAndBumpInTransaction(tx, db, actorUid);

      // Claim-first: set the auth custom claim BEFORE queueing the
      // Firestore writes. Two failure-mode reasons (see spec §VI):
      //   - If this throws, the queued writes never apply (TX returns
      //     before commit). Safe.
      //   - If this succeeds and the TX commit later fails, the claim
      //     is set but mirror+audit are not. The claim is the rules-
      //     engine source of truth, so revocation has already taken
      //     effect — fail-closed for the security-critical path.
      //     Mirror+audit drift is recoverable by retry.
      await getAuth().setCustomUserClaims(targetUid, { role: newRole });

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

    return { ok: true, ...result };
  },
);
