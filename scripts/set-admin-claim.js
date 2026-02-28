#!/usr/bin/env node
/**
 * set-admin-claim.js
 *
 * One-time script: sets { admin: true } custom claim on a Firebase user UID.
 *
 * Prerequisites:
 *   1. Download a service account key from Firebase console:
 *      Project Settings → Service Accounts → Generate new private key
 *      Save as service-account.json in the project root (git-ignored).
 *   2. npm install (installs firebase-admin)
 *
 * Usage:
 *   node scripts/set-admin-claim.js <uid>
 *   node scripts/set-admin-claim.js <uid> --key-file /path/to/key.json
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const args = process.argv.slice(2);
const uid = args.find((a) => !a.startsWith('--'));

if (!uid) {
  console.error('ERROR: UID argument is required.');
  console.error('Usage: node scripts/set-admin-claim.js <uid>');
  process.exit(1);
}

const keyFileIdx = args.indexOf('--key-file');
const keyFilePath = keyFileIdx >= 0 ? args[keyFileIdx + 1] : join(ROOT, 'service-account.json');

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(keyFilePath, 'utf8'));
} catch (err) {
  console.error(`ERROR: could not read service account key at: ${keyFilePath}`);
  console.error('  Download from Firebase console: Project Settings → Service Accounts → Generate new private key');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const adminAuth = getAuth();

console.log(`Setting { admin: true } on UID: ${uid}`);
await adminAuth.setCustomUserClaims(uid, { admin: true });
console.log('Custom claim set successfully.');

const user = await adminAuth.getUser(uid);
console.log('\nVerification:');
console.log('  UID:          ', user.uid);
console.log('  Email:        ', user.email ?? '(none)');
console.log('  Display name: ', user.displayName ?? '(none)');
console.log('  Custom claims:', JSON.stringify(user.customClaims));
console.log('\nDone. Sign out and sign back in to the app to receive the updated token.');
process.exit(0);
