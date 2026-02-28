/**
 * grant-admin.js — Firebase Admin SDK utility for managing admin custom claims
 *
 * Uses Application Default Credentials (ADC) — no key file required.
 *
 * One-time setup:
 *   gcloud auth application-default login
 *
 * Usage:
 *   node scripts/grant-admin.js grant user@example.com
 *   node scripts/grant-admin.js revoke user@example.com
 *
 * Required IAM role on your Google account: Firebase Authentication Admin
 */

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const [,, action, email] = process.argv;

if (!action || !email || !['grant', 'revoke'].includes(action)) {
  console.error('Usage: node scripts/grant-admin.js <grant|revoke> <email>');
  process.exit(1);
}

initializeApp({ projectId: 'citl-baed2' });

const adminAuth = getAuth();

try {
  const user = await adminAuth.getUserByEmail(email);
  const newClaims = action === 'grant' ? { admin: true } : { admin: false };

  await adminAuth.setCustomUserClaims(user.uid, newClaims);

  const verb = action === 'grant' ? 'Granted' : 'Revoked';
  console.log(`${verb} admin claim for ${email} (uid: ${user.uid})`);
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
