/**
 * ProfileRepository — Firestore operations on `profiles/{uid}` (spec 008).
 *
 * Direct document operations only; no queries. Timestamps
 * (acceptedTermsAt, createdAt, updatedAt) are serverTimestamp() because
 * the rules require them to equal request.time.
 *
 * Error convention: same as UserRepository — methods throw (reject) on
 * Firestore errors; AccountService wraps them in Result.
 */

import {
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import type { ProfileDoc, ProfileInput } from '@/types/account';

export class ProfileRepository {
  constructor(private readonly db: Firestore) {}

  async findById(uid: string): Promise<ProfileDoc | null> {
    const snap = await getDoc(doc(this.db, 'profiles', uid));
    return snap.exists() ? (snap.data() as ProfileDoc) : null;
  }

  /** First-sign-in completion: profile plus terms acceptance and 18+ attestation. */
  async create(uid: string, input: ProfileInput, termsVersion: string): Promise<void> {
    await setDoc(doc(this.db, 'profiles', uid), {
      displayName: input.displayName,
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      acceptedTermsAt: serverTimestamp(),
      termsVersion,
      adultAttested: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  /** Edit name and phone; an undefined phone removes the field. */
  async update(uid: string, input: ProfileInput): Promise<void> {
    await updateDoc(doc(this.db, 'profiles', uid), {
      displayName: input.displayName,
      phone: input.phone !== undefined ? input.phone : deleteField(),
      updatedAt: serverTimestamp(),
    });
  }

  /** Re-acceptance after a TERMS_VERSION bump. */
  async acceptTerms(uid: string, termsVersion: string): Promise<void> {
    await updateDoc(doc(this.db, 'profiles', uid), {
      termsVersion,
      acceptedTermsAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}
