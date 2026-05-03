/**
 * Shared setup for Firestore rules tests.
 *
 * Boots a single TestEnvironment per file (via initializeTestEnvironment),
 * exposes typed helpers to mint authenticated contexts with role claims,
 * and provides withSecurityRulesDisabled-based seed helpers so tests can
 * pre-populate documents that the rules under test would forbid.
 *
 * Run via: firebase emulators:exec --only firestore 'vitest run tests/rules'
 * (which sets FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 in env).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
  type RulesTestContext,
} from '@firebase/rules-unit-testing';
import {
  doc,
  setDoc,
  type Firestore,
} from 'firebase/firestore';

export const PROJECT_ID = 'citl-rules-test';

const RULES_PATH = resolve(__dirname, '..', '..', 'firestore.rules');
const HOST_PORT = (process.env['FIRESTORE_EMULATOR_HOST'] ?? '127.0.0.1:8080')
  .split(':');
const FIRESTORE_HOST = HOST_PORT[0] ?? '127.0.0.1';
const FIRESTORE_PORT = Number.parseInt(HOST_PORT[1] ?? '8080', 10);

export async function setupTestEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: FIRESTORE_HOST,
      port: FIRESTORE_PORT,
    },
  });
}

export type Role = 'owner' | 'admin' | 'user';

/** Returns a Firestore client whose ID-token claim role === the given role. */
export function asRole(
  env: RulesTestEnvironment,
  uid: string,
  role: Role,
): Firestore {
  const ctx: RulesTestContext = env.authenticatedContext(uid, { role });
  return ctx.firestore() as unknown as Firestore;
}

/** Authenticated client with no role claim (e.g. brand-new user pre-trigger). */
export function asNoRole(
  env: RulesTestEnvironment,
  uid: string,
): Firestore {
  const ctx: RulesTestContext = env.authenticatedContext(uid);
  return ctx.firestore() as unknown as Firestore;
}

/** Unauthenticated client. */
export function asAnon(env: RulesTestEnvironment): Firestore {
  const ctx: RulesTestContext = env.unauthenticatedContext();
  return ctx.firestore() as unknown as Firestore;
}

/** Seed data via the privileged context (bypasses rules). */
export async function seed(
  env: RulesTestEnvironment,
  fn: (db: Firestore) => Promise<void>,
): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore() as unknown as Firestore);
  });
}

/** Seed a users/{uid} doc with the given role. */
export async function seedUser(
  env: RulesTestEnvironment,
  uid: string,
  role: Role,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await seed(env, async (db) => {
    await setDoc(doc(db, 'users', uid), {
      uid,
      role,
      email: `${uid}@example.com`,
      displayName: uid,
      photoURL: null,
      createdAt: new Date(),
      lastSignInAt: new Date(),
      ...extra,
    });
  });
}
