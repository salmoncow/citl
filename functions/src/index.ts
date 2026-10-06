/**
 * CITL Cloud Functions entry point.
 *
 * Re-exports the callables + auth trigger used by the RBAC system
 * (spec 002), member accounts (spec 008), team proposals (spec 009), and
 * coordinator review and captain handoff (spec 010), and email
 * notifications (spec 011).
 * See [.specs/features/002-multi-user-rbac/spec.md](../../.specs/features/archive/002-multi-user-rbac/spec.md)
 * and [.specs/features/008-public-accounts/spec.md](../../.specs/features/008-public-accounts/spec.md).
 */

export { setUserRole } from './setUserRole.js';
export { onUserCreate } from './onUserCreate.js';
export { setAccountStatus } from './setAccountStatus.js';
export { deleteAccount } from './deleteAccount.js';
export { teamProposal } from './teamProposal.js';
export { reviewRequest } from './reviewRequest.js';
export { captainHandoff } from './captainHandoff.js';

// Email notifications (spec 011).
export { sendMail } from './sendMail.js';
export { unsubscribe } from './unsubscribe.js';
export { onAnnouncementCreated, onWeekPublished, onSeasonUpdated } from './topicEmails.js';
export { requestDigest } from './requestDigest.js';
