/**
 * AuthModule — Firebase Auth wrapper
 *
 * Provides Google sign-in/out and auth-state observation.
 */

import { auth } from '@/firebase-config';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  type User,
  type UserCredential,
} from 'firebase/auth';
import { type Result, success, failure } from '@/repositories/score-repository';

export class AuthModule {
  private readonly _provider = new GoogleAuthProvider();

  get currentUser(): User | null {
    return auth.currentUser;
  }

  async signIn(): Promise<Result<UserCredential>> {
    try {
      const credential = await signInWithPopup(auth, this._provider);
      return success(credential);
    } catch (error) {
      console.error('[AuthModule] signIn error:', error);
      return failure(String(error), 'AUTH_ERROR');
    }
  }

  async signOut(): Promise<Result<void>> {
    try {
      await firebaseSignOut(auth);
      return success(undefined);
    } catch (error) {
      console.error('[AuthModule] signOut error:', error);
      return failure(String(error), 'AUTH_ERROR');
    }
  }

  async isAdmin(): Promise<boolean> {
    if (!auth.currentUser) return false;
    const tokenResult = await auth.currentUser.getIdTokenResult();
    return tokenResult.claims['admin'] === true;
  }

  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    return firebaseOnAuthStateChanged(auth, callback);
  }
}
