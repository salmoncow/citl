/**
 * Coordinator decisions on captaincy (spec 010 AC-12, AC-13): approve or
 * reject an accepted handoff, or remove a team's captain.
 */

import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { queueAuditEntry } from '../lib/audit.js';
import { queueMail } from '../lib/mailQueue.js';
import { handoffContent } from '../mail/builders.js';
import { assertNoOtherCaptaincy, fail, isEligible } from '../lib/members.js';
import type { ReviewResult } from './types.js';

export interface CaptainReview {
  leagueTeamId: string;
  action: 'approve' | 'decline' | 'clear';
  note: string | null;
}

/** Handoff statuses that still need someone to act. */
export const OPEN_HANDOFF = ['nominated', 'accepted'];

export async function reviewCaptain(db: Firestore, input: CaptainReview, actorUid: string): Promise<ReviewResult> {
  return db.runTransaction(async (tx) => {
    const teamRef = db.doc(`leagueTeams/${input.leagueTeamId}`);
    const changeRef = db.doc(`captainChanges/${input.leagueTeamId}`);
    const [team, change] = await Promise.all([tx.get(teamRef), tx.get(changeRef)]);
    if (!team.exists) throw fail('not-found', 'no-league-team', 'That league team no longer exists.');
    const now = FieldValue.serverTimestamp();
    const reviewed = { reviewNote: input.note, reviewedBy: actorUid, reviewedAt: now, updatedAt: now };
    const c = change.data();
    const teamName = String(team.data()?.['name'] ?? input.leagueTeamId);

    if (input.action === 'clear') {
      const fromUid = team.data()?.['captainUid'];
      if (!fromUid) throw fail('failed-precondition', 'no-captain', 'This team has no captain.');
      tx.update(teamRef, { captainUid: null, updatedAt: now });
      if (c && OPEN_HANDOFF.includes(String(c['status']))) tx.update(changeRef, { status: 'cancelled', ...reviewed });
      queueAuditEntry(tx, db, {
        kind: 'captain', actorUid, subjectId: input.leagueTeamId, action: 'cleared', targetUid: String(fromUid),
      });
      queueMail(tx, db, String(fromUid), handoffContent('removed', teamName, '', input.note));
      return { ok: true, status: 'cleared' };
    }

    if (!c || c['status'] !== 'accepted') {
      throw fail('failed-precondition', 'bad-status', 'This handoff is no longer waiting for review.');
    }
    const toUid = String(c['toUid']);
    const fromUid = String(c['fromUid']);
    const fromName = String(c['fromName'] ?? 'The captain');
    const toName = String(c['toName'] ?? 'The nominee');

    if (input.action === 'decline') {
      tx.update(changeRef, { status: 'rejected', ...reviewed });
      queueAuditEntry(tx, db, { kind: 'captain', actorUid, subjectId: input.leagueTeamId, action: 'rejected', targetUid: toUid });
      queueMail(tx, db, toUid, handoffContent('rejected-new', teamName, fromName, input.note));
      queueMail(tx, db, fromUid, handoffContent('rejected-old', teamName, toName, input.note));
      return { ok: true, status: 'rejected' };
    }

    const [user, profile] = await Promise.all([tx.get(db.doc(`users/${toUid}`)), tx.get(db.doc(`profiles/${toUid}`))]);
    if (team.data()?.['captainUid'] !== c['fromUid']) {
      throw fail('failed-precondition', 'stale-handoff', 'The captain changed since this handoff was made. Decline it.');
    }
    if (!isEligible(user, profile)) {
      throw fail('failed-precondition', 'not-eligible', 'The new captain’s account is deactivated or has no profile.');
    }
    await assertNoOtherCaptaincy(tx, db, toUid, input.leagueTeamId, 'The new captain already captains another team.');

    tx.update(teamRef, { captainUid: toUid, updatedAt: now });
    tx.update(changeRef, { status: 'approved', ...reviewed });
    queueAuditEntry(tx, db, { kind: 'captain', actorUid, subjectId: input.leagueTeamId, action: 'approved', targetUid: toUid });
    queueMail(tx, db, toUid, handoffContent('approved-new', teamName, fromName, input.note));
    queueMail(tx, db, fromUid, handoffContent('approved-old', teamName, toName, input.note));
    return { ok: true, status: 'approved' };
  });
}
