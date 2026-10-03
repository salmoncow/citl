/**
 * Transaction read helpers shared by the league callables (specs 009,
 * 010): member eligibility, the member's roster name, their dependents,
 * their captaincy, and rebuilding a draft from a published team.
 *
 * Every helper reads through the caller's transaction, so the decision
 * and the writes that follow it are consistent.
 */

import type { DocumentData, DocumentSnapshot, Firestore, Transaction } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import type { DependentNames, RosterEntry } from './roster.js';
import { rosterFromTeam, toTeamShooter, type TeamShooter } from './publish.js';

/** Build an HttpsError whose details carry a machine-readable reason. */
export function fail(
  code: 'failed-precondition' | 'permission-denied' | 'already-exists' | 'not-found' | 'invalid-argument',
  reason: string,
  message: string,
): HttpsError {
  return new HttpsError(code, message, { reason });
}

/** An active users/{uid} mirror (missing status = active) and an existing profile. */
export function isEligible(user: DocumentSnapshot, profile: DocumentSnapshot): boolean {
  return user.exists && (user.data()?.['status'] ?? 'active') === 'active' && profile.exists;
}

/** The member's roster name: the approved shooter link, else the profile name. */
export function selfNameFrom(profile: DocumentSnapshot, link: DocumentSnapshot): string {
  const linked = link.data()?.['shooterName'];
  if (typeof linked === 'string' && linked.length > 0) return linked;
  return String(profile.data()?.['displayName'] ?? '');
}

function toNames(snap: DocumentSnapshot): DependentNames | null {
  const d = snap.data();
  return snap.exists && typeof d?.['firstName'] === 'string' && typeof d?.['lastName'] === 'string'
    ? { firstName: d['firstName'], lastName: d['lastName'] }
    : null;
}

/** The given dependents of `uid`, by id. Ids that don't exist are left out. */
export async function readDependents(
  tx: Transaction,
  db: Firestore,
  uid: string,
  ids: readonly string[],
): Promise<Map<string, DependentNames>> {
  const unique = [...new Set(ids)];
  const snaps = await Promise.all(unique.map((id) => tx.get(db.doc(`profiles/${uid}/dependents/${id}`))));
  const map = new Map<string, DependentNames>();
  for (const snap of snaps) {
    const names = toNames(snap);
    if (names) map.set(snap.id, names);
  }
  return map;
}

/** Every dependent of `uid` (at most a handful). */
export async function readAllDependents(tx: Transaction, db: Firestore, uid: string): Promise<Map<string, DependentNames>> {
  const snap = await tx.get(db.collection(`profiles/${uid}/dependents`));
  const map = new Map<string, DependentNames>();
  for (const d of snap.docs) {
    const names = toNames(d);
    if (names) map.set(d.id, names);
  }
  return map;
}

/** Ids of the league teams `uid` captains. */
export async function captainedTeams(tx: Transaction, db: Firestore, uid: string): Promise<string[]> {
  const snap = await tx.get(db.collection('leagueTeams').where('captainUid', '==', uid).limit(5));
  return snap.docs.map((d) => d.id);
}

/** Refuse when `uid` captains a league team other than `teamId`. */
export async function assertNoOtherCaptaincy(
  tx: Transaction,
  db: Firestore,
  uid: string,
  teamId: string | null,
  message: string,
): Promise<void> {
  const teams = await captainedTeams(tx, db, uid);
  if (teams.some((id) => id !== teamId)) throw fail('failed-precondition', 'already-captain', message);
}

/** A season team doc's shooters, read defensively. */
export function teamShooters(team: DocumentData | undefined): TeamShooter[] {
  const raw = Array.isArray(team?.['shooters']) ? (team['shooters'] as unknown[]) : [];
  return raw.flatMap((s) => {
    const shooter = toTeamShooter(s);
    return shooter ? [shooter] : [];
  });
}

/**
 * Rebuild a proposal's roster from its published season team doc (spec
 * 010 AC-14, DD-3). Used by reopen, discard, and rejecting a change.
 * Throws not-found when the team doc is gone.
 */
export async function rebuildFromTeam(
  tx: Transaction,
  db: Firestore,
  proposal: DocumentData,
): Promise<RosterEntry[]> {
  const uid = String(proposal['captainUid']);
  const teamId = String(proposal['leagueTeamId'] ?? '');
  const [team, profile, link, dependents] = await Promise.all([
    teamId ? tx.get(db.doc(`seasons/${proposal['year']}/teams/${teamId}`)) : Promise.resolve(null),
    tx.get(db.doc(`profiles/${uid}`)),
    tx.get(db.doc(`shooterLinks/${uid}`)),
    readAllDependents(tx, db, uid),
  ]);
  if (!team?.exists) {
    throw fail('not-found', 'no-team', 'The published team for this proposal no longer exists.');
  }
  return rosterFromTeam(teamShooters(team.data()), {
    selfName: selfNameFrom(profile, link),
    dependents,
    previous: (proposal['shooters'] ?? []) as RosterEntry[],
  });
}
