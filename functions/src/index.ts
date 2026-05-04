/**
 * CITL Cloud Functions entry point.
 *
 * Re-exports the callable + auth trigger used by the RBAC system.
 * See [.specs/features/002-multi-user-rbac/spec.md](../../.specs/features/002-multi-user-rbac/spec.md).
 */

export { setUserRole } from './setUserRole.js';
export { onUserCreate } from './onUserCreate.js';
