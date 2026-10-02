/**
 * CITL Cloud Functions entry point.
 *
 * Re-exports the callables + auth trigger used by the RBAC system
 * (spec 002) and member accounts (spec 008).
 * See [.specs/features/002-multi-user-rbac/spec.md](../../.specs/features/archive/002-multi-user-rbac/spec.md)
 * and [.specs/features/008-public-accounts/spec.md](../../.specs/features/008-public-accounts/spec.md).
 */

export { setUserRole } from './setUserRole.js';
export { onUserCreate } from './onUserCreate.js';
export { setAccountStatus } from './setAccountStatus.js';
export { deleteAccount } from './deleteAccount.js';
