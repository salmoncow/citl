/**
 * Review of a submitted team proposal (spec 010 AC-7 – AC-9).
 *
 * Approve publishes the roster to seasons/{year}/teams/{teamId}, sets the
 * league team's captain, and marks the proposal approved, all in one
 * transaction. Reject and request-changes only update the proposal;
 * rejecting a change request restores the published roster instead.
 */

import { FieldValue, type DocumentData, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { queueAuditEntry } from '../lib/audit.js';
import { queueMail } from '../lib/mailQueue.js';
import { proposalContent } from '../mail/builders.js';
import {
  assertNoOtherCaptaincy,
  fail,
  isEligible,
  readDependents,
  rebuildFromTeam,
  selfNameFrom,
  teamShooters,
} from '../lib/members.js';
import { droppedNames, replaceRoster, type ShooterSetting } from '../lib/publish.js';
import { assertSubmittable, normalizeName, refreshRoster, slugifyTeamName, type RosterEntry } from '../lib/roster.js';
import type { ReviewResult } from './types.js';

export interface ProposalReview {
  id: string;
  action: 'approve' | 'reject' | 'request-changes';
  settings: ShooterSetting[];
  note: string | null;
}

/** Normalized names with a score entry for the team this season (entries/{week}_{teamId}). */
async function scoredNames(tx: Transaction, db: Firestore, year: number, teamId: string): Promise<Set<string>> {
  const snaps = await Promise.all(
    Array.from({ length: 15 }, (_, i) => tx.get(db.doc(`seasons/${year}/entries/${i + 1}_${teamId}`))),
  );
  const keys = new Set<string>();
  for (const snap of snaps) {
    const shooters = snap.data()?.['shooters'];
    if (!Array.isArray(shooters)) continue;
    for (const s of shooters) {
      const name = (s as { name?: unknown })?.name;
      if (typeof name === 'string') keys.add(normalizeName(name));
    }
  }
  return keys;
}

async function approve(
  tx: Transaction,
  db: Firestore,
  input: ProposalReview,
  p: DocumentData,
  actorUid: string,
): Promise<ReviewResult> {
  const captainUid = String(p['captainUid']);
  const year = Number(p['year']);
  const isChange = p['purpose'] === 'change';
  const teamId = String(p['leagueTeamId'] ?? '') || slugifyTeamName(String(p['teamName']));
  const stored = (p['shooters'] ?? []) as RosterEntry[];
  const depIds = stored.flatMap((e) => (e.kind === 'dependent' && e.dependentId ? [e.dependentId] : []));

  const [user, profile, link, leagueTeam, team, dependents] = await Promise.all([
    tx.get(db.doc(`users/${captainUid}`)),
    tx.get(db.doc(`profiles/${captainUid}`)),
    tx.get(db.doc(`shooterLinks/${captainUid}`)),
    tx.get(db.doc(`leagueTeams/${teamId}`)),
    tx.get(db.doc(`seasons/${year}/teams/${teamId}`)),
    readDependents(tx, db, captainUid, depIds),
  ]);

  if (!isEligible(user, profile)) {
    throw fail('failed-precondition', 'not-eligible', 'The captain’s account is deactivated or has no profile.');
  }
  const leagueCaptain = leagueTeam.data()?.['captainUid'] ?? null;
  if (isChange) {
    if (leagueCaptain !== captainUid) {
      throw fail('failed-precondition', 'not-captain', 'This member is no longer the team’s captain.');
    }
    if (!team.exists) throw fail('not-found', 'no-team', `The ${year} team no longer exists.`);
  } else if (p['teamSource'] === 'returning') {
    if (!leagueTeam.exists) throw fail('not-found', 'no-league-team', 'That league team no longer exists.');
    if (leagueCaptain && leagueCaptain !== captainUid) {
      throw fail('failed-precondition', 'team-has-captain', 'This team already has a captain. Reject this proposal with a note.');
    }
  } else if (leagueTeam.exists) {
    throw fail('already-exists', 'league-team-exists', 'A league team with this name was approved first. Reject this proposal with a note.');
  }
  await assertNoOtherCaptaincy(tx, db, captainUid, teamId, 'This member already captains another team.');

  const selfName = selfNameFrom(profile, link);
  const roster = refreshRoster(stored, { selfName, dependents });
  assertSubmittable(roster);
  const names = roster.map((e) => e.name);
  const current = teamShooters(team.data());
  const scored = droppedNames(current, names).length > 0 ? await scoredNames(tx, db, year, teamId) : new Set<string>();
  const shooters = replaceRoster(current, names, input.settings, scored);

  // Writes.
  const now = FieldValue.serverTimestamp();
  tx.set(db.doc(`seasons/${year}`), { year }, { merge: true });
  const published = { captain: selfName, shooters, leagueTeamId: teamId, captainUid, sourceProposalId: input.id };
  if (team.exists) {
    tx.update(team.ref, published);
  } else {
    tx.set(team.ref, { name: String(p['teamName']), ...published, totals: { targets: [], rankPoints: [], bonusPoints: [] } });
  }
  if (leagueTeam.exists) {
    tx.update(leagueTeam.ref, { captainUid, seasons: FieldValue.arrayUnion(year), updatedAt: now });
  } else {
    tx.set(leagueTeam.ref, { name: String(p['teamName']), captainUid, seasons: [year], createdAt: now, updatedAt: now });
  }
  tx.update(db.doc(`teamProposals/${input.id}`), {
    status: 'approved',
    leagueTeamId: teamId,
    shooters: roster,
    reviewNote: input.note,
    reviewedBy: actorUid,
    reviewedAt: now,
    updatedAt: now,
  });
  queueAuditEntry(tx, db, { kind: 'proposal', actorUid, subjectId: input.id, action: 'approved' });
  queueMail(tx, db, captainUid, proposalContent(String(p['teamName']), year, isChange ? 'change-approved' : 'approved', input.note));
  return { ok: true, status: 'approved' };
}

export async function reviewProposal(db: Firestore, input: ProposalReview, actorUid: string): Promise<ReviewResult> {
  return db.runTransaction(async (tx) => {
    const ref = db.doc(`teamProposals/${input.id}`);
    const snap = await tx.get(ref);
    const p = snap.data();
    if (!snap.exists || !p) throw fail('not-found', 'no-request', 'That proposal no longer exists.');
    if (p['status'] !== 'submitted') {
      throw fail('failed-precondition', 'bad-status', 'This proposal is no longer waiting for review.');
    }

    if (input.action === 'approve') return approve(tx, db, input, p, actorUid);

    const captainUid = String(p['captainUid']);
    const mail = (outcome: Parameters<typeof proposalContent>[2]) =>
      queueMail(tx, db, captainUid, proposalContent(String(p['teamName']), Number(p['year']), outcome, input.note));
    const now = FieldValue.serverTimestamp();
    const reviewed = { reviewNote: input.note, reviewedBy: actorUid, reviewedAt: now, updatedAt: now };
    if (input.action === 'request-changes') {
      if (!input.note) throw new HttpsError('invalid-argument', 'Say what needs to change.', { reason: 'note-required' });
      tx.update(ref, { status: 'changes-requested', ...reviewed });
      queueAuditEntry(tx, db, { kind: 'proposal', actorUid, subjectId: input.id, action: 'changes-requested' });
      mail('changes-requested');
      return { ok: true, status: 'changes-requested' };
    }

    // Reject. A change request falls back to the published roster (AC-9).
    if (p['purpose'] === 'change') {
      const shooters = await rebuildFromTeam(tx, db, p);
      tx.update(ref, { status: 'approved', shooters, ...reviewed });
      queueAuditEntry(tx, db, { kind: 'proposal', actorUid, subjectId: input.id, action: 'rejected' });
      mail('change-rejected');
      return { ok: true, status: 'approved' };
    }
    tx.update(ref, { status: 'rejected', ...reviewed });
    queueAuditEntry(tx, db, { kind: 'proposal', actorUid, subjectId: input.id, action: 'rejected' });
    mail('rejected');
    return { ok: true, status: 'rejected' };
  });
}
