/**
 * Firebase Configuration
 *
 * Reads config values from VITE_FIREBASE_* environment variables.
 * Copy .env.example to .env and fill in values from Firebase console.
 *
 * Phase 1: No Firebase SDK is imported here. This is a stub that allows
 * the app to run fully locally without Firebase credentials.
 * Firebase SDK will be wired in Phase 2 (feat/firebase-setup).
 */

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

if (isDevelopment) {
  console.warn(
    'Firebase not configured — running in local mode. ' +
    'Copy .env.example to .env and fill in your Firebase project values to enable Firebase features.'
  );
}
