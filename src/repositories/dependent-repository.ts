/**
 * DependentRepository — `profiles/{uid}/dependents/{depId}` (spec 009 F8).
 *
 * The guardian is the only writer. Timestamps are serverTimestamp()
 * because the rules require them to equal request.time.
 *
 * Error convention: same as ProfileRepository — methods throw (reject) on
 * Firestore errors; MemberLeagueService wraps them in Result.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import type { Dependent, DependentInput } from '@/types/league';

export class DependentRepository {
  constructor(private readonly db: Firestore) {}

  private _col(uid: string) {
    return collection(this.db, 'profiles', uid, 'dependents');
  }

  async list(uid: string): Promise<Dependent[]> {
    const snap = await getDocs(this._col(uid));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        firstName: String(data['firstName'] ?? ''),
        lastName: String(data['lastName'] ?? ''),
        birthYear: Number(data['birthYear'] ?? 0),
      };
    });
  }

  async create(uid: string, input: DependentInput): Promise<string> {
    const ref = await addDoc(this._col(uid), {
      firstName: input.firstName,
      lastName: input.lastName,
      birthYear: input.birthYear,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  }

  async update(uid: string, id: string, input: DependentInput): Promise<void> {
    await updateDoc(doc(this.db, 'profiles', uid, 'dependents', id), {
      firstName: input.firstName,
      lastName: input.lastName,
      birthYear: input.birthYear,
      updatedAt: serverTimestamp(),
    });
  }

  async remove(uid: string, id: string): Promise<void> {
    await deleteDoc(doc(this.db, 'profiles', uid, 'dependents', id));
  }
}
