/**
 * LeagueRepository — Firestore operations for spec 009 member requests:
 * `leagueTeams` (list), `teamProposals/{year}_{uid}` (read only; the
 * teamProposal callable writes), `registrations/{year}_{uid}` and
 * `shooterLinkRequests/{uid}` (member writes under rules); spec 010 adds
 * the member's captaincy and `captainChanges` reads (callable-written).
 *
 * Direct document operations except the leagueTeams list (a few dozen
 * docs at most). Timestamps are serverTimestamp() because the rules
 * require them to equal request.time.
 *
 * Error convention: same as ProfileRepository — methods throw (reject) on
 * Firestore errors; MemberLeagueService wraps them in Result.
 */

import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import type {
  CaptainChange,
  LeagueTeam,
  Registration,
  RegistrationInput,
  ShooterLinkInput,
  ShooterLinkRequest,
  TeamProposal,
} from '@/types/league';

/** The league has had about a dozen teams; this bounds the list read. */
const LEAGUE_TEAMS_READ_LIMIT = 200;

/** Doc id shared by a member's proposal and registration for one season. */
export function requestId(year: number, uid: string): string {
  return `${year}_${uid}`;
}

export function toLeagueTeam(id: string, data: DocumentData): LeagueTeam {
  return {
    id,
    name: String(data['name'] ?? id),
    captainUid: (data['captainUid'] as string | null | undefined) ?? null,
    seasons: Array.isArray(data['seasons']) ? (data['seasons'] as number[]) : [],
  };
}

export class LeagueRepository {
  constructor(private readonly db: Firestore) {}

  async listLeagueTeams(): Promise<LeagueTeam[]> {
    const snap = await getDocs(query(collection(this.db, 'leagueTeams'), limit(LEAGUE_TEAMS_READ_LIMIT)));
    return snap.docs.map((d) => toLeagueTeam(d.id, d.data()));
  }

  /** League teams the member captains (at most one in practice). */
  async findCaptaincy(uid: string): Promise<LeagueTeam[]> {
    const snap = await getDocs(query(collection(this.db, 'leagueTeams'), where('captainUid', '==', uid), limit(5)));
    return snap.docs.map((d) => toLeagueTeam(d.id, d.data()));
  }

  /** Handoffs the member started (`fromUid`) or was nominated for (`toUid`). */
  async findHandoffs(uid: string, side: 'fromUid' | 'toUid'): Promise<CaptainChange[]> {
    const snap = await getDocs(query(collection(this.db, 'captainChanges'), where(side, '==', uid), limit(10)));
    return snap.docs.map((d) => d.data() as CaptainChange);
  }

  async findProposal(year: number, uid: string): Promise<TeamProposal | null> {
    const snap = await getDoc(doc(this.db, 'teamProposals', requestId(year, uid)));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as TeamProposal) : null;
  }

  async findRegistration(year: number, uid: string): Promise<Registration | null> {
    const snap = await getDoc(doc(this.db, 'registrations', requestId(year, uid)));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Registration) : null;
  }

  async createRegistration(year: number, uid: string, input: RegistrationInput): Promise<void> {
    await setDoc(doc(this.db, 'registrations', requestId(year, uid)), {
      uid,
      year,
      dependentIds: input.dependentIds,
      preferredLeagueTeamId: input.preferredLeagueTeamId,
      note: input.note,
      status: 'submitted',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async updateRegistration(year: number, uid: string, input: RegistrationInput): Promise<void> {
    await updateDoc(doc(this.db, 'registrations', requestId(year, uid)), {
      dependentIds: input.dependentIds,
      preferredLeagueTeamId: input.preferredLeagueTeamId,
      note: input.note,
      updatedAt: serverTimestamp(),
    });
  }

  async deleteRegistration(year: number, uid: string): Promise<void> {
    await deleteDoc(doc(this.db, 'registrations', requestId(year, uid)));
  }

  async findLinkRequest(uid: string): Promise<ShooterLinkRequest | null> {
    const snap = await getDoc(doc(this.db, 'shooterLinkRequests', uid));
    return snap.exists() ? (snap.data() as ShooterLinkRequest) : null;
  }

  async createLinkRequest(uid: string, input: ShooterLinkInput): Promise<void> {
    await setDoc(doc(this.db, 'shooterLinkRequests', uid), {
      shooterName: input.shooterName,
      ...(input.note ? { note: input.note } : {}),
      status: 'submitted',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async updateLinkRequest(uid: string, input: ShooterLinkInput): Promise<void> {
    await updateDoc(doc(this.db, 'shooterLinkRequests', uid), {
      shooterName: input.shooterName,
      note: input.note ? input.note : deleteField(),
      updatedAt: serverTimestamp(),
    });
  }

  /** The approved link (written by M3 review); read only once a request is approved. */
  async findLinkedName(uid: string): Promise<string | null> {
    const snap = await getDoc(doc(this.db, 'shooterLinks', uid));
    const name = snap.exists() ? snap.data()['shooterName'] : null;
    return typeof name === 'string' ? name : null;
  }

  async deleteLinkRequest(uid: string): Promise<void> {
    await deleteDoc(doc(this.db, 'shooterLinkRequests', uid));
  }
}
