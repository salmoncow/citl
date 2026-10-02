/**
 * Captain guard: refuse to deactivate or delete a team captain.
 *
 * M1 (spec 008 DD-5): a seam with its final signature and no body.
 * Captaincy does not exist yet, so this returns immediately and costs no
 * read. M2/M3 fill it in with a
 * `where('captainUid', '==', uid).limit(1)` read on the persistent team
 * collection and throw `failed-precondition` when it matches.
 *
 * Callers invoke it before any write.
 */

import type { Firestore } from 'firebase-admin/firestore';

export async function assertNotCaptain(_db: Firestore, _uid: string): Promise<void> {
  // Intentionally empty until captaincy ships (M2/M3).
}
