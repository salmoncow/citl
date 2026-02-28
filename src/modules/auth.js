/**
 * AuthModule — Firebase Auth wrapper
 *
 * Provides Google sign-in/out and auth-state observation.
 * Follows the NavigationModule / RouterModule class pattern.
 *
 * Methods:
 *   get currentUser()           → auth.currentUser (or null)
 *   async signIn()              → { success, data: UserCredential } | { success: false, error }
 *   async signOut()             → { success } | { success: false, error }
 *   onAuthStateChanged(cb)      → Firebase unsubscribe function
 */

import { auth } from '@/firebase-config.js';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
} from 'firebase/auth';

export class AuthModule {
  constructor() {
    this._provider = new GoogleAuthProvider();
  }

  /**
   * The currently signed-in user, or null if not authenticated.
   * @returns {import('firebase/auth').User|null}
   */
  get currentUser() {
    return auth.currentUser;
  }

  /**
   * Open a Google sign-in popup and return the result.
   * @returns {Promise<{success: true, data: import('firebase/auth').UserCredential}|{success: false, error: Error}>}
   */
  async signIn() {
    try {
      const credential = await signInWithPopup(auth, this._provider);
      return { success: true, data: credential };
    } catch (error) {
      console.error('[AuthModule] signIn error:', error);
      return { success: false, error };
    }
  }

  /**
   * Sign out the current user.
   * @returns {Promise<{success: true}|{success: false, error: Error}>}
   */
  async signOut() {
    try {
      await firebaseSignOut(auth);
      return { success: true };
    } catch (error) {
      console.error('[AuthModule] signOut error:', error);
      return { success: false, error };
    }
  }

  /**
   * Subscribe to auth state changes.
   * @param {function(import('firebase/auth').User|null): void} callback
   * @returns {function} Firebase unsubscribe function
   */
  onAuthStateChanged(callback) {
    return firebaseOnAuthStateChanged(auth, callback);
  }
}
