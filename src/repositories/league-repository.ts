/**
 * LeagueRepository — Firestore operations for spec 009 member requests:
 * `leagueTeams` (list), `teamProposals/{year}_{uid}` (read only; the
 * teamProposal callable writes), `registrations/{year}_{uid}` and
 * `shooterLinkRequests/{uid}` (member writes under rules).
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
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import type {
  LeagueTeam,
  Registration,
  RegistrationInput,
  ShooterLinkInput,
  ShooterLinkRequest,
  TeamProposal,
} from '@/types/league';

/** Doc id shared by a member's proposal and registration for one season. */
export function requestId(year: number, uid: string): string {
  return `${year}_${uid}`;
}

export class LeagueRepository {
  constructor(private readonly db: Firestore) {}

  async listLeagueTeams(): Promise<LeagueTeam[]> {
    const snap = await getDocs(collection(this.db, 'leagueTeams'));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: String(data['name'] ?? d.id),
        captainUid: (data['captainUid'] as string | null | undefined) ?? null,
        seasons: Array.isArray(data['seasons']) ? (data['seasons'] as number[]) : [],
      };
    });
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
