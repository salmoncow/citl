/**
 * LeagueReviewRepository — the coordinator's reads for the review queue
 * (spec 010 AC-1, AC-4, AC-5). Read-only: every decision goes through
 * the reviewRequest callable.
 *
 * Every query has one filter (`status ==`, or `captainUid != null`) so no
 * composite index is needed. Owner/admin rules allow these lists.
 *
 * Error convention: methods throw (reject) on Firestore errors;
 * LeagueReviewService wraps them in Result.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  type Firestore,
} from 'firebase/firestore';
import type { CaptainChange, Dependent, LeagueTeam, Registration, ShooterLinkRequest, TeamProposal } from '@/types/league';
import { toLeagueTeam } from '@/repositories/league-repository';

/** A season has a few dozen requests; this bounds each queue read. */
const QUEUE_READ_LIMIT = 100;

export interface MemberInfo {
  name: string;
  email: string | null;
  active: boolean;
}

export class LeagueReviewRepository {
  constructor(private readonly db: Firestore) {}

  private async _byStatus<T>(name: string, status: string): Promise<(T & { id: string })[]> {
    const snap = await getDocs(query(collection(this.db, name), where('status', '==', status), limit(QUEUE_READ_LIMIT)));
    return snap.docs.map((d) => ({ ...(d.data() as T), id: d.id }));
  }

  listSubmittedProposals(): Promise<TeamProposal[]> {
    return this._byStatus<TeamProposal>('teamProposals', 'submitted');
  }

  listSubmittedRegistrations(): Promise<Registration[]> {
    return this._byStatus<Registration>('registrations', 'submitted');
  }

  /** Link requests; `id` is the member's uid. */
  listSubmittedLinks(): Promise<(ShooterLinkRequest & { id: string })[]> {
    return this._byStatus<ShooterLinkRequest>('shooterLinkRequests', 'submitted');
  }

  listAcceptedHandoffs(): Promise<(CaptainChange & { id: string })[]> {
    return this._byStatus<CaptainChange>('captainChanges', 'accepted');
  }

  async listCaptainedTeams(): Promise<LeagueTeam[]> {
    const snap = await getDocs(query(collection(this.db, 'leagueTeams'), where('captainUid', '!=', null), limit(QUEUE_READ_LIMIT)));
    return snap.docs.map((d) => toLeagueTeam(d.id, d.data()));
  }

  /** Profile name, account email, and status for one member (two reads). */
  async memberInfo(uid: string): Promise<MemberInfo> {
    const [profile, user] = await Promise.all([
      getDoc(doc(this.db, 'profiles', uid)),
      getDoc(doc(this.db, 'users', uid)),
    ]);
    const u = user.data();
    return {
      name: String(profile.data()?.['displayName'] ?? u?.['displayName'] ?? 'Unknown member'),
      email: typeof u?.['email'] === 'string' ? u['email'] : null,
      active: user.exists() && (u?.['status'] ?? 'active') === 'active' && profile.exists(),
    };
  }

  async dependents(uid: string, ids: readonly string[]): Promise<Dependent[]> {
    const snaps = await Promise.all(ids.map((id) => getDoc(doc(this.db, 'profiles', uid, 'dependents', id))));
    return snaps.flatMap((s) => {
      const d = s.data();
      return s.exists() && d
        ? [{ id: s.id, firstName: String(d['firstName'] ?? ''), lastName: String(d['lastName'] ?? ''), birthYear: Number(d['birthYear'] ?? 0) }]
        : [];
    });
  }

  /** The approved scorecard name, if the member has one. */
  async linkedName(uid: string): Promise<string | null> {
    const snap = await getDoc(doc(this.db, 'shooterLinks', uid));
    const name = snap.data()?.['shooterName'];
    return typeof name === 'string' ? name : null;
  }
}
