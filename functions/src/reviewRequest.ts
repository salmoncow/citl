/**
 * reviewRequest — the coordinator's decision on a member request (spec
 * 010 F11 – F14; DD-1). Owner/admin only.
 *
 * Types and actions:
 *   - proposal:     approve (publish the roster) | reject | request-changes
 *   - registration: place (on a season team) | decline
 *   - link:         approve (one account per scorecard name) | decline
 *   - captain:      approve | decline an accepted handoff; clear a captain
 *
 * Sequence: App Check in production; auth; role claim owner|admin; zod
 * input; rate limit (200/hour/admin, its own transaction); then one
 * transaction per call in review/*.ts, ending in an audit entry.
 *
 * Failure modes (details.reason): permission-denied (not an admin);
 * invalid-argument (bad input, note-required, team-required, or a roster
 * rule: missing-average, roster-too-long, duplicate-name, and RosterError
 * reasons); failed-precondition (bad-status, not-eligible,
 * team-has-captain, already-captain, not-captain, stale-handoff,
 * shooter-has-scores, unknown-dependent, no-captain); already-exists
 * (league-team-exists, name-taken); not-found (no-request, no-team,
 * no-league-team); resource-exhausted.
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { isPrivileged, reviewRequestInput } from './lib/validate.js';
import { checkAndBumpInTransaction, RATE_LIMITS } from './lib/rateLimit.js';
import { RosterError } from './lib/roster.js';
import { PublishError } from './lib/publish.js';
import { reviewProposal } from './review/proposal.js';
import { reviewRegistration } from './review/registration.js';
import { reviewLink } from './review/link.js';
import { reviewCaptain } from './review/captain.js';
import type { ReviewResult } from './review/types.js';

if (getApps().length === 0) {
  initializeApp();
}

const isEmulator = process.env['FUNCTIONS_EMULATOR'] === 'true';

export async function handleReviewRequest(req: CallableRequest<unknown>): Promise<ReviewResult> {
  if (!req.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  if (!isPrivileged(req.auth.token['role'])) {
    throw new HttpsError('permission-denied', 'Only the league coordinator can review requests.');
  }
  const actorUid = req.auth.uid;

  const parsed = reviewRequestInput.safeParse(req.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'The review is not valid.');
  }
  const input = parsed.data;
  const note = input.note ? input.note : null;

  const db = getFirestore();
  await db.runTransaction((tx) => checkAndBumpInTransaction(tx, db, actorUid, RATE_LIMITS.reviewRequest));

  try {
    switch (input.type) {
      case 'proposal':
        return await reviewProposal(db, { id: input.id, action: input.action, settings: input.settings, note }, actorUid);
      case 'registration':
        return await reviewRegistration(db, {
          id: input.id, action: input.action, teamId: input.teamId ?? null, settings: input.settings, note,
        }, actorUid);
      case 'link':
        return await reviewLink(db, { uid: input.uid, action: input.action, shooterName: input.shooterName ?? null, note }, actorUid);
      case 'captain':
        return await reviewCaptain(db, { leagueTeamId: input.leagueTeamId, action: input.action, note }, actorUid);
    }
  } catch (err) {
    if (err instanceof RosterError || err instanceof PublishError) {
      const code = err instanceof PublishError && err.reason === 'shooter-has-scores' ? 'failed-precondition' : 'invalid-argument';
      throw new HttpsError(code, err.message, { reason: err.reason });
    }
    throw err;
  }
}

export const reviewRequest = onCall(
  {
    enforceAppCheck: !isEmulator,
    region: 'us-central1',
  },
  handleReviewRequest,
);
