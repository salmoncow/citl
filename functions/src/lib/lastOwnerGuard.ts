/**
 * Refuse to demote the last `owner` in the system.
 *
 * Runs inside the setUserRole transaction so the owner count is read
 * consistently with the role write.
 */

import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import type { Role } from './validate.js';

export async function assertNotLastOwner(
  tx: Transaction,
  db: Firestore,
  currentTargetRole: Role,
  newRole: Role,
): Promise<void> {
  // Only relevant when demoting an owner.
  if (currentTargetRole !== 'owner' || newRole === 'owner') {
    return;
  }

  const owners = await tx.get(db.collection('users').where('role', '==', 'owner'));
  if (owners.size <= 1) {
    throw new HttpsError(
      'failed-precondition',
      'Cannot demote the last owner. Promote another user to owner first.',
    );
  }
}
