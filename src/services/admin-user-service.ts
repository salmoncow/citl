/**
 * AdminUserService — facade for the Users tab.
 *
 * Wraps:
 *   - UserRepository.listPaginated for the user table
 *   - setUserRole callable for owner-driven role changes
 *
 * The service strips Firestore-specific types from its return shape
 * so the component layer doesn't need to import from firebase/firestore.
 */

import type { DocumentSnapshot } from 'firebase/firestore';
import type { FunctionsError } from 'firebase/functions';
import { db } from '@/firebase-config';
import { createRepositoryFactory } from '@/repositories/repository-factory';
import { callable } from '@/infrastructure/functions';
import type { Role, UserDoc } from '@/types/user';

const factory = createRepositoryFactory({ db });
const userRepo = factory.getUserRepository();

const setUserRoleCallable = callable<
  { targetUid: string; role: Role },
  { ok: true; fromRole: Role; toRole: Role }
>('setUserRole');

export interface ListUsersPage {
  users: UserDoc[];
  nextCursor: DocumentSnapshot | null;
}

export type SetUserRoleResult =
  | { ok: true; fromRole: Role; toRole: Role }
  | { ok: false; code: string; message: string };

export async function listUsers(
  opts: { pageSize?: number; cursor?: DocumentSnapshot | null } = {},
): Promise<ListUsersPage> {
  return userRepo.listPaginated(opts);
}

export async function setUserRole(targetUid: string, role: Role): Promise<SetUserRoleResult> {
  try {
    const result = await setUserRoleCallable({ targetUid, role });
    return { ok: true, fromRole: result.data.fromRole, toRole: result.data.toRole };
  } catch (e) {
    const err = e as FunctionsError;
    return {
      ok: false,
      code: err.code ?? 'unknown',
      message: err.message ?? String(e),
    };
  }
}

/**
 * Map a callable error code to the operator-facing message that the
 * Users tab should display in a toast. Centralized so the component
 * doesn't grow its own copy.
 */
export function setUserRoleErrorMessage(code: string): string {
  switch (code) {
    case 'permission-denied':
    case 'functions/permission-denied':
      return 'Only the owner can change roles.';
    case 'failed-precondition':
    case 'functions/failed-precondition':
      return 'Cannot demote the last owner. Promote another user to owner first.';
    case 'resource-exhausted':
    case 'functions/resource-exhausted':
      return 'Rate limit reached. Please wait before changing more roles.';
    case 'invalid-argument':
    case 'functions/invalid-argument':
      return 'Invalid role.';
    case 'not-found':
    case 'functions/not-found':
      return 'Target user not found.';
    case 'unauthenticated':
    case 'functions/unauthenticated':
      return 'You must be signed in to change roles.';
    default:
      return 'Could not change role. See console for details.';
  }
}
