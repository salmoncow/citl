/**
 * Review of an individual registration (spec 010 AC-10): place the member
 * and their dependents on a season team together, or decline.
 */

import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { queueAuditEntry } from '../lib/audit.js';
import { fail, isEligible, readDependents, selfNameFrom, teamShooters } from '../lib/members.js';
import { addToRoster, type ShooterSetting } from '../lib/publish.js';
import { minorDisplayName } from '../lib/roster.js';
import type { ReviewResult } from './types.js';

export interface RegistrationReview {
  id: string;
  action: 'place' | 'decline';
  teamId: string | null;
  settings: ShooterSetting[];
  note: string | null;
}

export async function reviewRegistration(db: Firestore, input: RegistrationReview, actorUid: string): Promise<ReviewResult> {
  return db.runTransaction(async (tx) => {
    const ref = db.doc(`registrations/${input.id}`);
    const snap = await tx.get(ref);
    const r = snap.data();
    if (!snap.exists || !r) throw fail('not-found', 'no-request', 'That join request no longer exists.');
    if (r['status'] !== 'submitted') {
      throw fail('failed-precondition', 'bad-status', 'This join request is no longer waiting for review.');
    }
    const now = FieldValue.serverTimestamp();
    const reviewed = { reviewNote: input.note, reviewedBy: actorUid, reviewedAt: now, updatedAt: now };

    if (input.action === 'decline') {
      tx.update(ref, { status: 'declined', ...reviewed });
      queueAuditEntry(tx, db, { kind: 'registration', actorUid, subjectId: input.id, action: 'declined' });
      return { ok: true, status: 'declined' };
    }

    if (!input.teamId) throw new HttpsError('invalid-argument', 'Choose a team.', { reason: 'team-required' });
    const uid = String(r['uid']);
    const year = Number(r['year']);
    const depIds = Array.isArray(r['dependentIds']) ? (r['dependentIds'] as unknown[]).map(String) : [];
    const [user, profile, link, team, leagueTeam, dependents] = await Promise.all([
      tx.get(db.doc(`users/${uid}`)),
      tx.get(db.doc(`profiles/${uid}`)),
      tx.get(db.doc(`shooterLinks/${uid}`)),
      tx.get(db.doc(`seasons/${year}/teams/${input.teamId}`)),
      tx.get(db.doc(`leagueTeams/${input.teamId}`)),
      readDependents(tx, db, uid, depIds),
    ]);
    if (!isEligible(user, profile)) {
      throw fail('failed-precondition', 'not-eligible', 'This member’s account is deactivated or has no profile.');
    }
    if (!team.exists) throw fail('not-found', 'no-team', `That team isn’t on the ${year} season.`);
    if (dependents.size !== new Set(depIds).size) {
      throw fail('failed-precondition', 'unknown-dependent', 'A dependent on this request was removed from the member’s account.');
    }

    const names = [
      selfNameFrom(profile, link),
      ...[...dependents.values()].map((d) => minorDisplayName(d.firstName, d.lastName)),
    ];
    const shooters = addToRoster(teamShooters(team.data()), names, input.settings);

    tx.update(team.ref, { shooters });
    if (leagueTeam.exists) {
      tx.update(leagueTeam.ref, { seasons: FieldValue.arrayUnion(year), updatedAt: now });
    } else {
      tx.set(leagueTeam.ref, {
        name: String(team.data()?.['name'] ?? input.teamId), captainUid: null, seasons: [year], createdAt: now, updatedAt: now,
      });
    }
    tx.update(ref, { status: 'placed', placedLeagueTeamId: input.teamId, ...reviewed });
    queueAuditEntry(tx, db, { kind: 'registration', actorUid, subjectId: input.id, action: 'placed' });
    return { ok: true, status: 'placed' };
  });
}
