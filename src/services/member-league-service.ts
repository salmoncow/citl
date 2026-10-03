/**
 * MemberLeagueService — member side of spec 009: dependents, team
 * proposals (via the teamProposal callable), individual registration,
 * and shooter link requests.
 *
 * Returns Result for Firestore operations and CallableOutcome for the
 * callable, so components never handle raw SDK errors. Validation runs
 * here before any write (the rules and callable are the enforcement).
 *
 * Like AccountService, it stays out of the app-services composition root
 * and is loaded with a dynamic import by the account components only, so
 * it never reaches the main bundle (§III.4). getMemberLeagueService() is
 * the memoized live instance.
 */

import type { HttpsCallable } from 'firebase/functions';
import { db } from '@/firebase-config';
import { createRepositoryFactory } from '@/repositories/repository-factory';
import type { LeagueRepository } from '@/repositories/league-repository';
import type { DependentRepository } from '@/repositories/dependent-repository';
import { callable } from '@/infrastructure/functions';
import { type Result, success, failure } from '@/types/result';
import type {
  Dependent,
  DependentInput,
  LeagueTeam,
  ProposalStatus,
  Registration,
  RegistrationInput,
  RosterEntryInput,
  ShooterLinkInput,
  ShooterLinkRequest,
  TeamProposal,
  TeamProposalRequest,
  TeamProposalResponse,
  TeamSource,
} from '@/types/league';
import { accountErrorMessage, type CallableOutcome } from '@/services/account-service';
import {
  DEPENDENTS_MAX,
  normalizeNote,
  validateDependentInput,
  validateLinkInput,
  validateTeamName,
} from '@/services/league-validation';

/** Everything /account shows about a member's league requests for one season. */
export interface LeagueOverview {
  year: number;
  proposal: TeamProposal | null;
  registration: Registration | null;
  linkRequest: ShooterLinkRequest | null;
  /** The approved scorecard name, when the link request was approved (M3). */
  linkedName: string | null;
  dependents: Dependent[];
}

export interface ProposalDraft {
  teamSource: TeamSource;
  leagueTeamId: string | null;
  teamName: string;
  shooters: RosterEntryInput[];
}

/**
 * Member-facing message for a league request error. teamProposal errors
 * that carry a reason come with a message written for members, so it is
 * shown as is; everything else falls back to the account message map.
 */
export function leagueErrorMessage(code: string, reason?: string, serverMessage?: string): string {
  if (reason && serverMessage) return serverMessage;
  return accountErrorMessage(code, reason);
}

/** Message for a failed Result from this service: validation text, or the mapped SDK code. */
export function resultMessage(result: { error: string; code: string }): string {
  return result.code === 'VALIDATION' ? result.error : accountErrorMessage(result.code);
}

function toOutcomeError(e: unknown): { ok: false; code: string; reason?: string; message: string } {
  const err = e as { code?: string; message?: string; details?: { reason?: string } } | null;
  const reason = err?.details?.reason;
  return {
    ok: false,
    code: err?.code ?? 'unknown',
    ...(reason ? { reason } : {}),
    message: err?.message ?? String(e),
  };
}

function codeOf(e: unknown, fallback: string): string {
  return (e as { code?: string } | null)?.code ?? fallback;
}

export class MemberLeagueService {
  constructor(
    private readonly league: LeagueRepository,
    private readonly dependents: DependentRepository,
    private readonly proposalCallable: () => HttpsCallable<TeamProposalRequest, TeamProposalResponse>,
  ) {}

  async loadOverview(uid: string, year: number): Promise<Result<LeagueOverview>> {
    try {
      const [proposal, registration, linkRequest, dependents] = await Promise.all([
        this.league.findProposal(year, uid),
        this.league.findRegistration(year, uid),
        this.league.findLinkRequest(uid),
        this.dependents.list(uid),
      ]);
      const linkedName = linkRequest?.status === 'approved' ? await this.league.findLinkedName(uid) : null;
      dependents.sort((a, b) => a.firstName.localeCompare(b.firstName));
      return success({ year, proposal, registration, linkRequest, linkedName, dependents });
    } catch (e) {
      console.error('[MemberLeagueService] loadOverview failed:', e);
      return failure(String(e), codeOf(e, 'LOAD_ERROR'));
    }
  }

  async listLeagueTeams(): Promise<Result<LeagueTeam[]>> {
    try {
      const teams = await this.league.listLeagueTeams();
      return success(teams.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      console.error('[MemberLeagueService] listLeagueTeams failed:', e);
      return failure(String(e), codeOf(e, 'LOAD_ERROR'));
    }
  }

  // ─── Dependents ───────────────────────────────────────────────────────────

  async addDependent(uid: string, input: { firstName: string; lastName: string; birthYear: string | number }, existingCount: number): Promise<Result<string>> {
    if (existingCount >= DEPENDENTS_MAX) {
      return failure(`You can add up to ${DEPENDENTS_MAX} dependents.`, 'VALIDATION');
    }
    const v = validateDependentInput(input);
    if (!v.ok) return failure(Object.values(v.errors).join(' '), 'VALIDATION');
    return this._write(() => this.dependents.create(uid, v.value));
  }

  async updateDependent(uid: string, id: string, input: { firstName: string; lastName: string; birthYear: string | number }): Promise<Result<void>> {
    const v = validateDependentInput(input);
    if (!v.ok) return failure(Object.values(v.errors).join(' '), 'VALIDATION');
    const value: DependentInput = v.value;
    return this._write(() => this.dependents.update(uid, id, value));
  }

  async removeDependent(uid: string, id: string): Promise<Result<void>> {
    return this._write(() => this.dependents.remove(uid, id));
  }

  // ─── Registration ─────────────────────────────────────────────────────────

  async saveRegistration(uid: string, year: number, input: RegistrationInput, existing: boolean): Promise<Result<void>> {
    const note = normalizeNote(input.note);
    if (!note.ok) return failure(note.error, 'VALIDATION');
    if (input.dependentIds.length > DEPENDENTS_MAX) {
      return failure(`You can bring up to ${DEPENDENTS_MAX} dependents.`, 'VALIDATION');
    }
    const value: RegistrationInput = { ...input, note: note.value };
    return this._write(() => existing
      ? this.league.updateRegistration(year, uid, value)
      : this.league.createRegistration(year, uid, value));
  }

  async withdrawRegistration(uid: string, year: number): Promise<Result<void>> {
    return this._write(() => this.league.deleteRegistration(year, uid));
  }

  // ─── Shooter link request ─────────────────────────────────────────────────

  async saveLinkRequest(uid: string, input: ShooterLinkInput, existing: boolean): Promise<Result<void>> {
    const v = validateLinkInput(input);
    if (!v.ok) return failure(v.error, 'VALIDATION');
    return this._write(() => existing
      ? this.league.updateLinkRequest(uid, v.value)
      : this.league.createLinkRequest(uid, v.value));
  }

  async withdrawLinkRequest(uid: string): Promise<Result<void>> {
    return this._write(() => this.league.deleteLinkRequest(uid));
  }

  // ─── Team proposal (callable) ─────────────────────────────────────────────

  async saveProposal(year: number, draft: ProposalDraft): Promise<CallableOutcome<{ status: ProposalStatus | null }>> {
    const name = validateTeamName(draft.teamName);
    if (!name.ok) return { ok: false, code: 'invalid-argument', reason: 'team-name', message: name.error };
    return this._call({
      action: 'save',
      year,
      teamSource: draft.teamSource,
      leagueTeamId: draft.teamSource === 'returning' ? draft.leagueTeamId : null,
      teamName: name.value,
      shooters: draft.shooters,
    });
  }

  async proposalAction(year: number, action: 'submit' | 'withdraw' | 'delete'): Promise<CallableOutcome<{ status: ProposalStatus | null }>> {
    return this._call({ action, year });
  }

  private async _call(req: TeamProposalRequest): Promise<CallableOutcome<{ status: ProposalStatus | null }>> {
    try {
      const res = await this.proposalCallable()(req);
      return { ok: true, status: res.data.status };
    } catch (e) {
      return toOutcomeError(e);
    }
  }

  private async _write<T>(op: () => Promise<T>): Promise<Result<T>> {
    try {
      return success(await op());
    } catch (e) {
      console.error('[MemberLeagueService] write failed:', e);
      return failure(String(e), codeOf(e, 'WRITE_ERROR'));
    }
  }
}

let instance: MemberLeagueService | null = null;

/** The live, Firestore-backed MemberLeagueService (memoized). */
export function getMemberLeagueService(): MemberLeagueService {
  if (!instance) {
    const factory = createRepositoryFactory({ db });
    // The callable is resolved on first use so construction never
    // initializes the Functions SDK.
    instance = new MemberLeagueService(
      factory.getLeagueRepository(),
      factory.getDependentRepository(),
      () => callable<TeamProposalRequest, TeamProposalResponse>('teamProposal'),
    );
  }
  return instance;
}
