/**
 * Firebase Configuration
 *
 * Reads config values from VITE_FIREBASE_* environment variables.
 * Copy .env.example to .env and fill in values from Firebase console.
 *
 * Exports:
 *   firebaseConfig  — raw config object (for reference / Auth init)
 *   db              — Firestore database instance
 *   auth            — Firebase Auth instance
 *   isDevelopment   — true when running via `npm run dev`
 *   isProduction    — true when running via `npm run build`
 */

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const isDevelopment = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;

/**
 * Validates that all required Firebase config values are present.
 * @returns {boolean}
 * @throws {Error} if any required field is missing
 */
export function validateFirebaseConfig() {
  const required = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
  const missing = required.filter((field) => !firebaseConfig[field]);
  if (missing.length > 0) {
    throw new Error(`Firebase configuration incomplete. Missing: ${missing.join(', ')}`);
  }
  return true;
}

const app = initializeApp(firebaseConfig);

/** @type {import('firebase/firestore').Firestore} */
export const db = getFirestore(app);

/** @type {import('firebase/auth').Auth} */
export const auth = getAuth(app);
