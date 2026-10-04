/**
 * Review of a shooter link request (spec 010 AC-11): link the member's
 * account to one scorecard name, or decline. The name must be on a season
 * roster (stored with the latest season's spelling), and can be linked to
 * one account only (shooterLinks.nameKey).
 */

import { FieldValue, type Firestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { queueAuditEntry } from '../lib/audit.js';
import { fail } from '../lib/members.js';
import { normalizeName } from '../lib/roster.js';
import type { ReviewResult } from './types.js';

export interface LinkReview {
  uid: string;
  action: 'approve' | 'decline';
  shooterName: string | null;
  note: string | null;
}

export async function reviewLink(db: Firestore, input: LinkReview, actorUid: string): Promise<ReviewResult> {
  return db.runTransaction(async (tx) => {
    const ref = db.doc(`shooterLinkRequests/${input.uid}`);
    const [snap, user] = await Promise.all([tx.get(ref), tx.get(db.doc(`users/${input.uid}`))]);
    const r = snap.data();
    if (!snap.exists || !r) throw fail('not-found', 'no-request', 'That link request no longer exists.');
    if (r['status'] !== 'submitted') {
      throw fail('failed-precondition', 'bad-status', 'This link request is no longer waiting for review.');
    }
    const now = FieldValue.serverTimestamp();
    const reviewed = { reviewNote: input.note, reviewedBy: actorUid, reviewedAt: now, updatedAt: now };

    if (input.action === 'decline') {
      tx.update(ref, { status: 'declined', ...reviewed });
      queueAuditEntry(tx, db, { kind: 'shooter-link', actorUid, subjectId: input.uid, action: 'declined' });
      return { ok: true, status: 'declined' };
    }

    if (!user.exists || (user.data()?.['status'] ?? 'active') !== 'active') {
      throw fail('failed-precondition', 'not-eligible', 'This member’s account is deactivated.');
    }
    const requested = (input.shooterName ?? String(r['shooterName'])).trim().replace(/\s+/g, ' ');
    const nameKey = normalizeName(requested);
    const [taken, teams] = await Promise.all([
      tx.get(db.collection('shooterLinks').where('nameKey', '==', nameKey).limit(2)),
      tx.get(db.collectionGroup('teams')),
    ]);
    const shooterName = scorecardSpelling(teams.docs, nameKey);
    if (!shooterName) {
      throw fail('failed-precondition', 'not-on-scorecard', `${requested} isn’t on any season roster.`);
    }
    if (taken.docs.some((d) => d.id !== input.uid)) {
      throw fail('already-exists', 'name-taken', `${shooterName} is already linked to another account.`);
    }

    tx.set(db.doc(`shooterLinks/${input.uid}`), { shooterName, nameKey, linkedAt: now, linkedBy: actorUid });
    tx.update(ref, { status: 'approved', ...reviewed });
    queueAuditEntry(tx, db, { kind: 'shooter-link', actorUid, subjectId: input.uid, action: 'approved' });
    return { ok: true, status: 'approved' };
  });
}

/** The latest season's spelling of a roster name, or null when no season roster has it. */
function scorecardSpelling(teams: readonly QueryDocumentSnapshot[], nameKey: string): string | null {
  let best: { year: number; name: string } | null = null;
  for (const t of teams) {
    const year = Number(t.ref.parent.parent?.id);
    const shooters = (t.data()['shooters'] ?? []) as { name?: unknown }[];
    for (const sh of shooters) {
      if (typeof sh.name !== 'string' || normalizeName(sh.name) !== nameKey) continue;
      if (!best || year > best.year) best = { year, name: sh.name.trim() };
    }
  }
  return best?.name ?? null;
}
