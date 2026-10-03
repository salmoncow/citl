/**
 * captainHandoff — the member side of a captain handoff (spec 010 F14,
 * AC-17, AC-18; DD-5). The coordinator approves through reviewRequest.
 *
 * One handoff per league team at captainChanges/{leagueTeamId}; a new
 * nomination replaces a closed one.
 *
 * Actions:
 *   - nominate { leagueTeamId, email }: the team's active captain names
 *     another member by account email → nominated
 *   - cancel:  the nominating captain, while nominated | accepted → cancelled
 *   - accept:  the nominee, while nominated → accepted (awaits the coordinator)
 *   - decline: the nominee, while nominated → declined
 *
 * Sequence: App Check in production; auth; zod; rate limit (20/hour/uid,
 * its own transaction); for nominate, the Auth email lookup (outside the
 * transaction, read-only); then one transaction with an audit entry.
 *
 * Failure modes (details.reason): not-captain, no-member,
 * self-nomination, not-eligible, already-captain, handoff-open,
 * no-handoff, bad-status, not-nominee.
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { captainHandoffInput } from './lib/validate.js';
import { checkAndBumpInTransaction, RATE_LIMITS } from './lib/rateLimit.js';
import { queueAuditEntry } from './lib/audit.js';
import { assertNoOtherCaptaincy, fail, isEligible } from './lib/members.js';
import { OPEN_HANDOFF } from './review/captain.js';

if (getApps().length === 0) {
  initializeApp();
}

const isEmulator = process.env['FUNCTIONS_EMULATOR'] === 'true';

export type HandoffStatus = 'nominated' | 'accepted' | 'declined' | 'cancelled' | 'approved' | 'rejected';

export interface CaptainHandoffResult {
  ok: true;
  status: HandoffStatus;
  /** The nominee's profile name, after nominate (DD-5). */
  toName?: string;
}

async function uidForEmail(email: string): Promise<string> {
  try {
    return (await getAuth().getUserByEmail(email)).uid;
  } catch (err) {
    if ((err as { code?: string } | null)?.code === 'auth/user-not-found') {
      throw fail('not-found', 'no-member', 'No member account uses that email. Ask them to sign up first.');
    }
    throw err;
  }
}

export async function handleCaptainHandoff(req: CallableRequest<unknown>): Promise<CaptainHandoffResult> {
  if (!req.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  const uid = req.auth.uid;
  const parsed = captainHandoffInput.safeParse(req.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Check the team and email address.');
  }
  const input = parsed.data;

  const db = getFirestore();
  await db.runTransaction((tx) => checkAndBumpInTransaction(tx, db, uid, RATE_LIMITS.captainHandoff));

  const teamRef = db.doc(`leagueTeams/${input.leagueTeamId}`);
  const changeRef = db.doc(`captainChanges/${input.leagueTeamId}`);
  const subjectId = input.leagueTeamId;

  if (input.action === 'nominate') {
    const toUid = await uidForEmail(input.email);
    if (toUid === uid) throw fail('invalid-argument', 'self-nomination', 'Nominate someone other than yourself.');

    return db.runTransaction(async (tx) => {
      const [team, change, fromUser, fromProfile, toUser, toProfile] = await Promise.all([
        tx.get(teamRef),
        tx.get(changeRef),
        tx.get(db.doc(`users/${uid}`)),
        tx.get(db.doc(`profiles/${uid}`)),
        tx.get(db.doc(`users/${toUid}`)),
        tx.get(db.doc(`profiles/${toUid}`)),
      ]);
      if (!team.exists || team.data()?.['captainUid'] !== uid || !isEligible(fromUser, fromProfile)) {
        throw fail('permission-denied', 'not-captain', 'Only the team’s captain can nominate a successor.');
      }
      if (!isEligible(toUser, toProfile)) {
        throw fail('failed-precondition', 'not-eligible', 'That member’s account is deactivated or has no profile yet.');
      }
      if (change.exists && OPEN_HANDOFF.includes(String(change.data()?.['status']))) {
        throw fail('failed-precondition', 'handoff-open', 'There’s already an open handoff for this team. Cancel it first.');
      }
      await assertNoOtherCaptaincy(tx, db, toUid, null, 'That member already captains a team.');

      const now = FieldValue.serverTimestamp();
      const toName = String(toProfile.data()?.['displayName'] ?? '');
      tx.set(changeRef, {
        leagueTeamId: input.leagueTeamId,
        teamName: String(team.data()?.['name'] ?? input.leagueTeamId),
        fromUid: uid,
        fromName: String(fromProfile.data()?.['displayName'] ?? ''),
        toUid,
        toName,
        status: 'nominated',
        reviewNote: null,
        createdAt: now,
        updatedAt: now,
        respondedAt: null,
        reviewedBy: null,
        reviewedAt: null,
      });
      queueAuditEntry(tx, db, { kind: 'captain', actorUid: uid, subjectId, action: 'nominated', targetUid: toUid });
      return { ok: true as const, status: 'nominated' as const, toName };
    });
  }

  return db.runTransaction(async (tx) => {
    const change = await tx.get(changeRef);
    const c = change.data();
    if (!change.exists || !c) throw fail('not-found', 'no-handoff', 'There is no handoff for this team.');
    const status = String(c['status']);
    const now = FieldValue.serverTimestamp();

    if (input.action === 'cancel') {
      if (c['fromUid'] !== uid) throw fail('permission-denied', 'not-captain', 'Only the nominating captain can cancel.');
      if (!OPEN_HANDOFF.includes(status)) throw fail('failed-precondition', 'bad-status', 'This handoff is already closed.');
      tx.update(changeRef, { status: 'cancelled', updatedAt: now });
      queueAuditEntry(tx, db, { kind: 'captain', actorUid: uid, subjectId, action: 'cancelled', targetUid: String(c['toUid']) });
      return { ok: true as const, status: 'cancelled' as const };
    }

    if (c['toUid'] !== uid) throw fail('permission-denied', 'not-nominee', 'This nomination is for someone else.');
    if (status !== 'nominated') throw fail('failed-precondition', 'bad-status', 'This nomination is already closed.');
    const next = input.action === 'accept' ? 'accepted' : 'declined';
    tx.update(changeRef, { status: next, respondedAt: now, updatedAt: now });
    queueAuditEntry(tx, db, { kind: 'captain', actorUid: uid, subjectId, action: next, targetUid: uid });
    return { ok: true as const, status: next };
  });
}

export const captainHandoff = onCall(
  {
    enforceAppCheck: !isEmulator,
    region: 'us-central1',
  },
  handleCaptainHandoff,
);
