#!/usr/bin/env node
/**
 * set-role.js — Multi-role Firebase Admin SDK CLI for managing the
 * `role` custom claim + `users/{uid}` mirror + `audit/` log.
 *
 * Mirrors the safety machinery of the setUserRole Cloud Function:
 *   - Claim-first ordering inside a Firestore transaction (see
 *     .specs/features/002-multi-user-rbac/spec.md §VI Design Decisions)
 *   - Last-owner guard — refuses to demote the only `owner`
 *   - Append-only audit entry (actorUid: 'cli')
 *
 * Auth: gcloud Application Default Credentials. No service-account key.
 *   One-time setup: gcloud auth application-default login
 *
 * Usage:
 *   node scripts/set-role.js set <email> <role>    Promote/demote
 *   node scripts/set-role.js revoke <email>        Alias for `set <email> user`
 *   node scripts/set-role.js list                  List users + roles
 *
 * Roles: owner | admin | user
 *
 * Env:
 *   DRY_RUN=1                          Print plan without writing
 *   FIREBASE_AUTH_EMULATOR_HOST + FIRESTORE_EMULATOR_HOST
 *                                      Run against the local emulator
 *
 * Required IAM role on your Google account (production):
 *   Firebase Authentication Admin
 */

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const PROJECT_ID = 'citl-baed2';
const ROLES = ['owner', 'admin', 'user'];
const DRY_RUN = process.env.DRY_RUN === '1';

initializeApp({ projectId: PROJECT_ID });
const auth = getAuth();
const db = getFirestore();

function usage(message) {
  if (message) console.error(`Error: ${message}\n`);
  console.error(`Usage:
  node scripts/set-role.js set <email> <role>    Set a user's role
  node scripts/set-role.js revoke <email>        Demote to user
  node scripts/set-role.js list                  List all users + roles

Roles: ${ROLES.join(' | ')}

Env:
  DRY_RUN=1                          Print plan without writing
  FIREBASE_AUTH_EMULATOR_HOST=...    Use auth emulator
  FIRESTORE_EMULATOR_HOST=...        Use firestore emulator

One-time setup: gcloud auth application-default login`);
  process.exit(1);
}

function fmtDate(ts) {
  if (!ts) return 'never';
  const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

async function listCommand() {
  const snap = await db.collection('users').orderBy('createdAt', 'desc').get();
  if (snap.empty) {
    console.log('(no users)');
    return;
  }
  const rows = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      uid: doc.id,
      email: d.email ?? '',
      role: d.role ?? '(unset)',
      lastSignIn: fmtDate(d.lastSignInAt),
    };
  });
  const w = {
    uid: Math.max(3, ...rows.map((r) => r.uid.length)),
    email: Math.max(5, ...rows.map((r) => r.email.length)),
    role: 8,
  };
  const header =
    `${'uid'.padEnd(w.uid)}  ${'email'.padEnd(w.email)}  ${'role'.padEnd(w.role)}  lastSignInAt`;
  console.log(header);
  console.log('─'.repeat(header.length));
  for (const r of rows) {
    console.log(
      `${r.uid.padEnd(w.uid)}  ${r.email.padEnd(w.email)}  ${r.role.padEnd(w.role)}  ${r.lastSignIn}`,
    );
  }
  console.log(`\n${rows.length} user${rows.length === 1 ? '' : 's'}`);
}

async function setRoleCommand(email, newRole) {
  if (!email) usage('missing <email>');
  if (!newRole) usage('missing <role>');
  if (!ROLES.includes(newRole)) {
    usage(`invalid role "${newRole}" (must be one of: ${ROLES.join(', ')})`);
  }

  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      console.error(`Error: no Firebase Auth user with email ${email}.`);
      console.error(`The user must sign in to the app at least once before their role can be set.`);
      process.exit(1);
    }
    throw e;
  }

  const userRef = db.doc(`users/${user.uid}`);
  const initialSnap = await userRef.get();
  const fromRole = initialSnap.exists ? (initialSnap.data().role ?? '(unset)') : '(no mirror)';

  console.log('─── set-role ──────────────────────────────────────');
  console.log(`project   : ${PROJECT_ID}`);
  console.log(`target    : ${email}`);
  console.log(`uid       : ${user.uid}`);
  console.log(`from role : ${fromRole}`);
  console.log(`to role   : ${newRole}`);
  console.log(`dry run   : ${DRY_RUN ? 'YES (no writes)' : 'NO'}`);
  console.log('───────────────────────────────────────────────────');

  if (initialSnap.exists && initialSnap.data().role === newRole) {
    console.log(`No change: ${email} already has role=${newRole}.`);
    return;
  }

  if (DRY_RUN) {
    console.log('DRY_RUN: would set custom claim, update mirror, and write audit entry.');
    if (fromRole === 'owner' && newRole !== 'owner') {
      console.log('DRY_RUN: would also enforce last-owner guard before demotion.');
    }
    return;
  }

  // Mirror the callable's claim-first ordering inside a TX. See
  // setUserRole.ts header + spec §VI for the full reasoning.
  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const txFromRole = userSnap.exists ? (userSnap.data().role ?? null) : null;

    if (txFromRole === 'owner' && newRole !== 'owner') {
      const owners = await tx.get(db.collection('users').where('role', '==', 'owner'));
      if (owners.size <= 1) {
        throw new Error(
          'Cannot demote the last owner. Promote another user to owner first.',
        );
      }
    }

    // Claim-first: if this throws, queued writes don't apply.
    await auth.setCustomUserClaims(user.uid, { role: newRole });

    if (userSnap.exists) {
      tx.update(userRef, {
        role: newRole,
        roleChangedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      // Defensive: should normally exist (onUserCreate seeds it). Seed
      // here if it's missing so the mirror+claim stay in sync.
      tx.set(userRef, {
        uid: user.uid,
        email: user.email ?? email,
        displayName: user.displayName ?? null,
        photoURL: user.photoURL ?? null,
        role: newRole,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        lastSignInAt: null,
        roleChangedAt: FieldValue.serverTimestamp(),
      });
    }

    tx.create(db.collection('audit').doc(), {
      actorUid: 'cli',
      targetUid: user.uid,
      fromRole: txFromRole,
      toRole: newRole,
      at: FieldValue.serverTimestamp(),
    });
  });

  console.log(`✓ set custom claim role=${newRole}`);
  console.log(`✓ updated users/${user.uid}.role`);
  console.log(`✓ wrote audit/{auto} (actorUid=cli)`);
  console.log('───────────────────────────────────────────────────');
  console.log(`Done. The user must sign out and back in (or wait up to`);
  console.log(`~1h) for the new token to reflect role=${newRole}.`);
}

async function main() {
  const [, , subcommand, ...args] = process.argv;

  switch (subcommand) {
    case 'set':
      await setRoleCommand(args[0], args[1]);
      break;
    case 'revoke':
      await setRoleCommand(args[0], 'user');
      break;
    case 'list':
      await listCommand();
      break;
    default:
      usage(subcommand ? `unknown subcommand "${subcommand}"` : null);
  }
}

try {
  await main();
} catch (e) {
  console.error(`\nError: ${e.message ?? e}`);
  process.exit(1);
}
