/**
 * League request types (spec 009): persistent league teams, team
 * proposals and their roster entries, dependents, individual
 * registrations, and shooter link requests. Field limits are enforced by
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
  | { action: 'submit' | 'withdraw' | 'delete'; year: number };

export interface TeamProposalResponse {
  ok: true;
  status: ProposalStatus | null;
}
