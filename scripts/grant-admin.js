#!/usr/bin/env node
/**
 * grant-admin.js — DEPRECATED shim. Use scripts/set-role.js instead.
 *
 * Behavior change: the old grant-admin.js wrote a boolean
 * `admin: true` custom claim. The new RBAC model uses
 * `role: 'owner' | 'admin' | 'user'` and additionally maintains a
 * Firestore mirror + audit log. This shim delegates to set-role.js so
 * old invocations continue to work while emitting a deprecation
 * warning. It will be removed in a future release.
 */

import { spawn } from 'node:child_process';

const [, , action, email] = process.argv;

console.warn(
  '\n[DEPRECATED] scripts/grant-admin.js — use scripts/set-role.js:\n' +
    '  node scripts/set-role.js set <email> admin     # promote to admin\n' +
    '  node scripts/set-role.js set <email> user      # demote to user\n' +
    '  node scripts/set-role.js list                  # list all users\n' +
    '\nNote: this script now writes role=<value> + Firestore mirror + audit\n' +
    'log, instead of the old admin:true boolean claim. The legacy claim is\n' +
    'no longer honored by Firestore rules.\n',
);

if (!action || !email || !['grant', 'revoke'].includes(action)) {
  console.error('Usage: node scripts/grant-admin.js <grant|revoke> <email>');
  process.exit(1);
}

const role = action === 'grant' ? 'admin' : 'user';
const child = spawn(
  process.execPath,
  ['scripts/set-role.js', 'set', email, role],
  { stdio: 'inherit' },
);
child.on('exit', (code) => process.exit(code ?? 1));
