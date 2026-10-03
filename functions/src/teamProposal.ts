/**
 * teamProposal — the only writer of teamProposals/{year}_{uid} for
 * members (spec 009 F6, F7, F10; DD-2).
 *
 * Actions:
 *   - save:     create or replace the draft (status draft | changes-requested)
 *   - submit:   draft | changes-requested → submitted (audited)
 *   - withdraw: submitted → draft (audited)
 *   - delete:   remove a draft, changes-requested or rejected proposal;
 *               for a change request, discard it (back to approved with
 *               the published roster; spec 010 AC-15)
 *   - reopen:   approved → draft change request, rebuilt from the
 *               published team doc (spec 010 AC-14)
 *
 * Sequence:
 *   1. App Check in production; auth; zod input; year ∈ {this UTC year, next}.
 *   2. Rate limit: 60 calls/hour/uid, in its own transaction so rejected
 *      calls still count.
 *   3. One transaction: read the mirror (active), profile (exists), the
 *      proposal, and whatever the action needs (registration, league team,
 *      dependents, shooter link); then write.
 *
 * Roster rules live in lib/roster.ts (pure, unit-tested).
 *
 * Failure modes (details.reason in parentheses):
 *   - unauthenticated: no caller
 *   - invalid-argument: bad input, or a roster rule (the RosterError reason)
 *   - failed-precondition: inactive or no profile (not-eligible), a
 *     registration for the season (has-registration), a transition not
 *     allowed from the current status (bad-status)
 *   - permission-denied: the returning team has another captain
 *     (team-has-captain); reopen by someone no longer the captain (not-captain)
 *   - already-exists: a new team's name matches a league team (league-team-exists)
 *   - not-found: no proposal (withdraw/submit/delete), or no such league team
 *   - resource-exhausted: rate limit hit
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, type DocumentSnapshot } from 'firebase-admin/firestore';
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { teamProposalInput, type TeamProposalInput } from './lib/validate.js';
import { checkAndBumpInTransaction, RATE_LIMITS } from './lib/rateLimit.js';
import { queueAuditEntry } from './lib/audit.js';
import {
  RosterError,
  assertSubmittable,
  refreshRoster,
  resolveRoster,
  slugifyTeamName,
  type RosterEntry,
  type RosterEntryInput,
} from './lib/roster.js';
import { fail, isEligible, readDependents, rebuildFromTeam, selfNameFrom } from './lib/members.js';

if (getApps().length === 0) {
  initializeApp();
}

const isEmulator = process.env['FUNCTIONS_EMULATOR'] === 'true';

export type ProposalStatus = 'draft' | 'submitted' | 'changes-requested' | 'approved' | 'rejected';

export const EDITABLE: readonly ProposalStatus[] = ['draft', 'changes-requested'];
const DELETABLE: readonly ProposalStatus[] = ['draft', 'changes-requested', 'rejected'];

export interface TeamProposalResult {
  ok: true;
  /** The proposal's status after the call; null after delete. */
  status: ProposalStatus | null;
}

/** Years a request may target: this UTC year's season or next year's. */
export function isRegistrationYear(year: number, now: Date = new Date()): boolean {
  const y = now.getUTCFullYear();
  return year === y || year === y + 1;
}

function assertLeagueTeamOpen(team: DocumentSnapshot, uid: string): void {
  if (!team.exists) {
    throw fail('not-found', 'no-league-team', 'That league team no longer exists.');
  }
  const captainUid = team.data()?.['captainUid'];
  if (captainUid && captainUid !== uid) {
    throw fail('permission-denied', 'team-has-captain',
      'This team already has a captain. Ask them to nominate you as their successor.');
  }
}

export async function handleTeamProposal(req: CallableRequest<unknown>): Promise<TeamProposalResult> {
  if (!req.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  const uid = req.auth.uid;

  const parsed = teamProposalInput.safeParse(req.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'The proposal is not valid. Check the team name and every shooter.');
  }
  const input: TeamProposalInput = parsed.data;
  if (!isRegistrationYear(input.year)) {
    throw new HttpsError('invalid-argument', 'Proposals are accepted for this season or next season only.');
  }

  const db = getFirestore();
  await db.runTransaction((tx) => checkAndBumpInTransaction(tx, db, uid, RATE_LIMITS.teamProposal));

  const proposalId = `${input.year}_${uid}`;
  const proposalRef = db.doc(`teamProposals/${proposalId}`);

  try {
    return await db.runTransaction(async (tx) => {
      // Reads first (Firestore transactions require reads before writes).
      const [userSnap, profileSnap, proposalSnap] = await Promise.all([
        tx.get(db.doc(`users/${uid}`)),
        tx.get(db.doc(`profiles/${uid}`)),
        tx.get(proposalRef),
      ]);
      if (!isEligible(userSnap, profileSnap)) {
        throw fail('failed-precondition', 'not-eligible', 'Complete your profile on an active account first.');
      }
      const current = proposalSnap.data();
      const status = current?.['status'] as ProposalStatus | undefined;
      const isChange = current?.['purpose'] === 'change';

      switch (input.action) {
        case 'save': {
          if (status && !EDITABLE.includes(status)) {
            throw fail('failed-precondition', 'bad-status', 'Withdraw the proposal before editing it.');
          }
          const depIds = input.shooters.flatMap((e) => (e.kind === 'dependent' ? [e.dependentId] : []));
          // A change request keeps its published team (spec 010 AC-15).
          const teamLookup = isChange
            ? String(current?.['leagueTeamId'])
            : input.teamSource === 'returning' && input.leagueTeamId
              ? input.leagueTeamId
              : slugifyTeamName(input.teamName);
          const [regSnap, linkSnap, teamSnap, dependents] = await Promise.all([
            tx.get(db.doc(`registrations/${proposalId}`)),
            tx.get(db.doc(`shooterLinks/${uid}`)),
            tx.get(db.doc(`leagueTeams/${teamLookup}`)),
            readDependents(tx, db, uid, depIds),
          ]);
          const shooters = resolveRoster(input.shooters as RosterEntryInput[], {
            selfName: selfNameFrom(profileSnap, linkSnap),
            dependents,
          });
          const now = FieldValue.serverTimestamp();

          if (isChange) {
            assertLeagueTeamOpen(teamSnap, uid);
            tx.update(proposalRef, { shooters, updatedAt: now });
            return { ok: true as const, status: status ?? 'draft' };
          }

          if (regSnap.exists) {
            throw fail('failed-precondition', 'has-registration',
              'You asked to join a team this season. Withdraw that request to propose a team instead.');
          }
          let leagueTeamId: string | null = null;
          if (input.teamSource === 'returning') {
            if (!input.leagueTeamId) {
              throw new HttpsError('invalid-argument', 'Choose the returning team.');
            }
            assertLeagueTeamOpen(teamSnap, uid);
            leagueTeamId = input.leagueTeamId;
          } else if (teamSnap.exists) {
            throw fail('already-exists', 'league-team-exists',
              'A league team with this name already exists. Choose it as a returning team instead.');
          }

          tx.set(proposalRef, {
            captainUid: uid,
            year: input.year,
            purpose: 'initial',
            teamSource: input.teamSource,
            leagueTeamId,
            teamName: input.teamName,
            shooters,
            status: status ?? 'draft',
            reviewNote: current?.['reviewNote'] ?? null,
            submittedAt: current?.['submittedAt'] ?? null,
            reviewedBy: current?.['reviewedBy'] ?? null,
            reviewedAt: current?.['reviewedAt'] ?? null,
            createdAt: current?.['createdAt'] ?? now,
            updatedAt: now,
          });
          return { ok: true as const, status: status ?? 'draft' };
        }

        case 'submit': {
          if (!current) throw fail('not-found', 'no-proposal', 'Save a draft first.');
          if (!status || !EDITABLE.includes(status)) {
            throw fail('failed-precondition', 'bad-status', 'This proposal has already been submitted.');
          }
          const stored = (current['shooters'] ?? []) as RosterEntry[];
          const depIds = stored.flatMap((e) => (e.kind === 'dependent' && e.dependentId ? [e.dependentId] : []));
          const leagueTeamId = current['leagueTeamId'] as string | null;
          const [linkSnap, dependents, teamSnap] = await Promise.all([
            tx.get(db.doc(`shooterLinks/${uid}`)),
            readDependents(tx, db, uid, depIds),
            leagueTeamId ? tx.get(db.doc(`leagueTeams/${leagueTeamId}`)) : Promise.resolve(null),
          ]);
          if (teamSnap) assertLeagueTeamOpen(teamSnap, uid);
          const shooters = refreshRoster(stored, { selfName: selfNameFrom(profileSnap, linkSnap), dependents });
          assertSubmittable(shooters);

          tx.update(proposalRef, {
            shooters,
            status: 'submitted',
            submittedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          queueAuditEntry(tx, db, { kind: 'proposal', actorUid: uid, subjectId: proposalId, action: 'submitted' });
          return { ok: true as const, status: 'submitted' as const };
        }

        case 'withdraw': {
          if (!current) throw fail('not-found', 'no-proposal', 'There is no proposal to withdraw.');
          if (status !== 'submitted') {
            throw fail('failed-precondition', 'bad-status', 'Only a submitted proposal can be withdrawn.');
          }
          tx.update(proposalRef, { status: 'draft', updatedAt: FieldValue.serverTimestamp() });
          queueAuditEntry(tx, db, { kind: 'proposal', actorUid: uid, subjectId: proposalId, action: 'withdrawn' });
          return { ok: true as const, status: 'draft' as const };
        }

        case 'delete': {
          if (!current) throw fail('not-found', 'no-proposal', 'There is no proposal to delete.');
          if (!status || !DELETABLE.includes(status)) {
            throw fail('failed-precondition', 'bad-status', 'Withdraw the proposal before deleting it.');
          }
          if (isChange) {
            const shooters = await rebuildFromTeam(tx, db, current);
            tx.update(proposalRef, { shooters, status: 'approved', updatedAt: FieldValue.serverTimestamp() });
            queueAuditEntry(tx, db, { kind: 'proposal', actorUid: uid, subjectId: proposalId, action: 'discarded' });
            return { ok: true as const, status: 'approved' as const };
          }
          tx.delete(proposalRef);
          queueAuditEntry(tx, db, { kind: 'proposal', actorUid: uid, subjectId: proposalId, action: 'deleted' });
          return { ok: true as const, status: null };
        }

        case 'reopen': {
          if (!current) throw fail('not-found', 'no-proposal', 'There is no proposal to change.');
          if (status !== 'approved') {
            throw fail('failed-precondition', 'bad-status', 'Only an approved roster can be changed.');
          }
          const teamSnap = await tx.get(db.doc(`leagueTeams/${String(current['leagueTeamId'] ?? '')}`));
          if (!teamSnap.exists || teamSnap.data()?.['captainUid'] !== uid) {
            throw fail('permission-denied', 'not-captain', 'You are no longer this team’s captain.');
          }
          const shooters = await rebuildFromTeam(tx, db, current);
          tx.update(proposalRef, {
            shooters,
            purpose: 'change',
            status: 'draft',
            reviewNote: null,
            updatedAt: FieldValue.serverTimestamp(),
          });
          queueAuditEntry(tx, db, { kind: 'proposal', actorUid: uid, subjectId: proposalId, action: 'reopened' });
          return { ok: true as const, status: 'draft' as const };
        }
      }
    });
  } catch (err) {
    if (err instanceof RosterError) {
      throw new HttpsError('invalid-argument', err.message, { reason: err.reason });
    }
    throw err;
  }
}

export const teamProposal = onCall(
  {
    enforceAppCheck: !isEmulator,
    region: 'us-central1',
  },
  handleTeamProposal,
);
