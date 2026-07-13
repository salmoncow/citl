/**
 * Firebase Configuration
 *
 * Reads config values from VITE_FIREBASE_* environment variables.
 * Copy .env.example to .env and fill in values from Firebase console.
 *
 * Emulator-aware: when VITE_USE_EMULATOR=true, the Auth and Firestore
 * SDKs connect to the local emulator suite instead of production.
 * Set automatically by `npm run dev` (which invokes `firebase
 * emulators:exec`) — never manually for production builds.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';

const firebaseConfig = {
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
export const useEmulator = import.meta.env['VITE_USE_EMULATOR'] === 'true';

/**
 * Validates that all required Firebase config values are present.
 * @throws {Error} if any required field is missing
 */
export function validateFirebaseConfig(): boolean {
  const required = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'] as const;
  const missing = required.filter((field) => !firebaseConfig[field]);
  if (missing.length > 0) {
    throw new Error(`Firebase configuration incomplete. Missing: ${missing.join(', ')}`);
  }
  return true;
}

validateFirebaseConfig();

const app = initializeApp(firebaseConfig);

export const db: Firestore = getFirestore(app);
export const auth: Auth = getAuth(app);

if (useEmulator) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  // eslint-disable-next-line no-console
  console.info('[firebase] Connected to local emulator suite (auth:9099, firestore:8080).');
}
