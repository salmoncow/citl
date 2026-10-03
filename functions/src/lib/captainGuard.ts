/**
 * Captain guard: refuse to deactivate or delete a team captain.
 *
 * Spec 009 AC-17 (the spec 008 DD-5 seam, now filled in): one
 * `leagueTeams where captainUid == uid limit 1` read. Captaincy is set by
 * M3 approval and handoff; the captain must hand off first.
 *
 * Callers invoke it before any write.
 */

import type { Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

export const CAPTAIN_REASON = 'captain';

export const CAPTAIN_MESSAGE =
  'You are a team captain. Hand off the captaincy, or ask the league coordinator to, before you continue.';

export async function assertNotCaptain(db: Firestore, uid: string): Promise<void> {
  const snap = await db.collection('leagueTeams').where('captainUid', '==', uid).limit(1).get();
  if (!snap.empty) {
    throw new HttpsError('failed-precondition', CAPTAIN_MESSAGE, { reason: CAPTAIN_REASON });
  }
}
