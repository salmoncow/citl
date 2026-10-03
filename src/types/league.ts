/**
 * League request types (spec 009): persistent league teams, team
 * proposals and their roster entries, dependents, individual
 * registrations, and shooter link requests; spec 010 adds captain
 * handoffs and the coordinator's review calls. Field limits are enforced by
 * firestore.rules and the teamProposal callable, and mirrored in
 * services/league-validation.ts.
 */

import type { Timestamp } from 'firebase/firestore';

/** `leagueTeams/{teamId}`: a team's identity across seasons. Doc id = the season team doc id. */
export interface LeagueTeam {
  id: string;
  name: string;
  /** Set by M3 approval and handoff; null for every backfilled team. */
  captainUid: string | null;
  seasons: number[];
}

export type ProposalStatus = 'draft' | 'submitted' | 'changes-requested' | 'approved' | 'rejected';
export type TeamSource = 'new' | 'returning';
export type RosterEntryKind = 'self' | 'dependent' | 'named';

/** A stored roster entry. `name` is resolved on the server; minors are "First L.". */
export interface RosterEntry {
  kind: RosterEntryKind;
  name: string;
  rookie: boolean;
  minor: boolean;
  dependentId?: string;
  guardianName?: string;
}

/** A roster entry as the client sends it to the teamProposal callable. */
export type RosterEntryInput =
  | { kind: 'self'; rookie: boolean }
  | { kind: 'dependent'; dependentId: string; rookie: boolean }
  | {
      kind: 'named';
      firstName: string;
      lastName: string;
      rookie: boolean;
      minor: boolean;
      guardianName?: string | null;
    };

/** `teamProposals/{year}_{uid}`. */
export interface TeamProposal {
  id: string;
  captainUid: string;
  year: number;
  purpose: 'initial' | 'change';
  teamSource: TeamSource;
  leagueTeamId: string | null;
  teamName: string;
  shooters: RosterEntry[];
  status: ProposalStatus;
  reviewNote: string | null;
  submittedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** `profiles/{uid}/dependents/{depId}`: an under-18 shooter on an adult's account. */
export interface Dependent {
  id: string;
  firstName: string;
  lastName: string;
  birthYear: number;
}

export interface DependentInput {
  firstName: string;
  lastName: string;
  birthYear: number;
}

export type RegistrationStatus = 'submitted' | 'placed' | 'declined';

/** `registrations/{year}_{uid}`. */
export interface Registration {
  id: string;
  uid: string;
  year: number;
  dependentIds: string[];
  preferredLeagueTeamId: string | null;
  note: string | null;
  status: RegistrationStatus;
  reviewNote?: string | null;
  /** The season team the coordinator placed the member on (spec 010). */
  placedLeagueTeamId?: string | null;
  createdAt?: Timestamp;
}

export interface RegistrationInput {
  dependentIds: string[];
  preferredLeagueTeamId: string | null;
  note: string | null;
}

export type LinkRequestStatus = 'submitted' | 'approved' | 'declined';

/** `shooterLinkRequests/{uid}`. */
export interface ShooterLinkRequest {
  shooterName: string;
  createdAt?: Timestamp;
  note?: string;
  status: LinkRequestStatus;
  reviewNote?: string | null;
}

export interface ShooterLinkInput {
  shooterName: string;
  /** Empty or omitted means no note. */
  note?: string;
}

export type TeamProposalRequest =
  | {
      action: 'save';
      year: number;
      teamSource: TeamSource;
      leagueTeamId: string | null;
      teamName: string;
      shooters: RosterEntryInput[];
    }
  | { action: 'submit' | 'withdraw' | 'delete' | 'reopen'; year: number };

export interface TeamProposalResponse {
  ok: true;
  status: ProposalStatus | null;
}

// ── Spec 010: captain handoff and coordinator review ───────────────────────

export type HandoffStatus = 'nominated' | 'accepted' | 'declined' | 'cancelled' | 'approved' | 'rejected';

/** `captainChanges/{leagueTeamId}`: at most one handoff per team. */
export interface CaptainChange {
  leagueTeamId: string;
  teamName: string;
  fromUid: string;
  fromName: string;
  toUid: string;
  toName: string;
  status: HandoffStatus;
  reviewNote: string | null;
  createdAt?: Timestamp;
}

export type CaptainHandoffRequest =
  | { action: 'nominate'; leagueTeamId: string; email: string }
  | { action: 'cancel' | 'accept' | 'decline'; leagueTeamId: string };

export interface CaptainHandoffResponse {
  ok: true;
  status: HandoffStatus;
  toName?: string;
}

/** A new shooter's starting average and rookie flag, set by the coordinator at approval. */
export interface ShooterSetting {
  name: string;
  startingAvg: number;
  rookie: boolean;
}

export type ReviewRequest =
  | { type: 'proposal'; id: string; action: 'approve' | 'reject' | 'request-changes'; settings?: ShooterSetting[]; note?: string | null }
  | { type: 'registration'; id: string; action: 'place' | 'decline'; teamId?: string | null; settings?: ShooterSetting[]; note?: string | null }
  | { type: 'link'; uid: string; action: 'approve' | 'decline'; shooterName?: string | null; note?: string | null }
  | { type: 'captain'; leagueTeamId: string; action: 'approve' | 'decline' | 'clear'; note?: string | null };

export interface ReviewResponse {
  ok: true;
  status: string;
}
