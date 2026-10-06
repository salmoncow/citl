/**
 * Member-facing status labels for league requests, shared by /account
 * (<account-league>) and #/join (<join-page>).
 */

import type { LinkRequestStatus, ProposalStatus, RegistrationStatus } from '@/types/league';

export const PROPOSAL_LABEL: Record<ProposalStatus, string> = {
  draft: 'Draft, not sent yet',
  submitted: 'Submitted for review',
  'changes-requested': 'Changes requested',
  approved: 'Approved',
  rejected: 'Not approved',
};

export const REGISTRATION_LABEL: Record<RegistrationStatus, string> = {
  submitted: 'Waiting for the coordinator to place you',
  placed: 'Placed on a team',
  declined: 'Declined',
};

export const LINK_LABEL: Record<LinkRequestStatus, string> = {
  submitted: 'Waiting for the coordinator to confirm',
  approved: 'Linked',
  declined: 'Not linked',
};
