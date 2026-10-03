/**
 * LeagueReviewService — the coordinator's side of spec 010: assembles the
 * review queue, compares a proposed roster with the team's seasons, and
 * sends decisions through the reviewRequest callable.
 *
 * Lazy like MemberLeagueService (ADR-013 decision 5): only the admin
 * Requests tab imports it, and it builds its own repository.
 * getLeagueReviewService() is the memoized live instance.
 */

import type { HttpsCallable } from 'firebase/functions';
import { db } from '@/firebase-config';
import { LeagueReviewRepository, type MemberInfo } from '@/repositories/league-review-repository';
import { callable } from '@/infrastructure/functions';
import { normalizeShooterName } from '@/services/scoring-engine';
import { minorDisplayName, slugifyTeamName } from '@/services/league-validation';
import { type Result, success, failure } from '@/types/result';
import type { CallableOutcome } from '@/services/account-service';
import type {
  CaptainChange,
  Dependent,
  LeagueTeam,
  Registration,
  ReviewRequest,
  ReviewResponse,
  ShooterLinkRequest,
  TeamProposal,
} from '@/types/league';
import type { Shooter } from '@/types/shooter';

export interface QueueMember extends MemberInfo {
  uid: string;
}

export interface ProposalItem {
  proposal: TeamProposal;
  member: QueueMember;
  /** The season team doc id an approval writes. */
  teamId: string;
  /** Other submitted proposals for the same team (DD-8). */
  competing: number;
}

export interface RegistrationItem {
  registration: Registration;
  member: QueueMember;
  /** The member's roster name: the approved link, else the profile name. */
  selfName: string;
  dependents: Dependent[];
}

export interface LinkItem {
  uid: string;
  request: ShooterLinkRequest;
  member: QueueMember;
}

export interface ReviewQueue {
  proposals: ProposalItem[];
  registrations: RegistrationItem[];
  links: LinkItem[];
  handoffs: CaptainChange[];
  captains: { team: LeagueTeam; captain: QueueMember }[];
}

export type RosterStatus = 'returning' | 'new' | 'dropped';

/** One row of the proposal comparison (AC-2). */
export interface RosterRow {
  name: string;
  status: RosterStatus;
  /** The shooter's record on this season's team doc, when already there. */
  stored: Shooter | null;
}

/** The team doc id an approval writes: the league team, else the name slug. */
export function proposalTeamId(p: Pick<TeamProposal, 'leagueTeamId' | 'teamName'>): string {
  return p.leagueTeamId ?? slugifyTeamName(p.teamName);
}

/**
 * Compare a proposed roster with the team's last season (returning, new,
 * dropped) and attach any record already on this season's team doc.
 */
export function compareRoster(
  names: readonly string[],
  lastSeason: readonly Shooter[] | null,
  thisSeason: readonly Shooter[] | null,
): RosterRow[] {
  const last = new Set((lastSeason ?? []).map((s) => normalizeShooterName(s.name)));
  const stored = new Map((thisSeason ?? []).map((s) => [normalizeShooterName(s.name), s]));
  const proposed = new Set(names.map(normalizeShooterName));
  const rows: RosterRow[] = names.map((name) => {
    const key = normalizeShooterName(name);
    return { name, status: last.has(key) ? 'returning' : 'new', stored: stored.get(key) ?? null };
  });
  for (const s of lastSeason ?? []) {
    if (!proposed.has(normalizeShooterName(s.name))) rows.push({ name: s.name, status: 'dropped', stored: null });
  }
  return rows;
}

function oldestFirst<T extends { createdAt?: { toMillis(): number } | null; submittedAt?: { toMillis(): number } | null }>(a: T, b: T): number {
  const t = (x: T) => x.submittedAt?.toMillis() ?? x.createdAt?.toMillis() ?? 0;
  return t(a) - t(b);
}

function codeOf(e: unknown, fallback: string): string {
  return (e as { code?: string } | null)?.code ?? fallback;
}

export class LeagueReviewService {
  constructor(
    private readonly repo: LeagueReviewRepository,
    private readonly reviewCallable: () => HttpsCallable<ReviewRequest, ReviewResponse>,
  ) {}

  async loadQueue(): Promise<Result<ReviewQueue>> {
    try {
      const [proposals, registrations, links, handoffs, captained] = await Promise.all([
        this.repo.listSubmittedProposals(),
        this.repo.listSubmittedRegistrations(),
        this.repo.listSubmittedLinks(),
        this.repo.listAcceptedHandoffs(),
        this.repo.listCaptainedTeams(),
      ]);

      // One profile + user read per distinct member.
      const uids = new Set<string>([
        ...proposals.map((p) => p.captainUid),
        ...registrations.map((r) => r.uid),
        ...links.map((l) => l.id),
        ...captained.flatMap((t) => (t.captainUid ? [t.captainUid] : [])),
      ]);
      const members = new Map<string, QueueMember>();
      await Promise.all([...uids].map(async (uid) => {
        members.set(uid, { uid, ...(await this.repo.memberInfo(uid)) });
      }));
      const member = (uid: string): QueueMember => members.get(uid) ?? { uid, name: 'Unknown member', email: null, active: false };

      const byTeam = new Map<string, number>();
      for (const p of proposals) byTeam.set(proposalTeamId(p), (byTeam.get(proposalTeamId(p)) ?? 0) + 1);

      const regItems = await Promise.all(registrations.map(async (r): Promise<RegistrationItem> => {
        const [dependents, linked] = await Promise.all([
          this.repo.dependents(r.uid, r.dependentIds ?? []),
          this.repo.linkedName(r.uid),
        ]);
        return { registration: r, member: member(r.uid), selfName: linked ?? member(r.uid).name, dependents };
      }));

      return success({
        proposals: [...proposals].sort(oldestFirst).map((p) => ({
          proposal: p,
          member: member(p.captainUid),
          teamId: proposalTeamId(p),
          competing: (byTeam.get(proposalTeamId(p)) ?? 1) - 1,
        })),
        registrations: regItems.sort((a, b) => oldestFirst(a.registration, b.registration)),
        links: [...links].sort(oldestFirst).map(({ id, ...request }) => ({ uid: id, request, member: member(id) })),
        handoffs: [...handoffs].sort(oldestFirst),
        captains: captained
          .map((team) => ({ team, captain: member(team.captainUid ?? '') }))
          .sort((a, b) => a.team.name.localeCompare(b.team.name)),
      });
    } catch (e) {
      console.error('[LeagueReviewService] loadQueue failed:', e);
      return failure(String(e), codeOf(e, 'LOAD_ERROR'));
    }
  }

  /** The names a registration places, in order: the member, then dependents as "First L.". */
  placementNames(item: RegistrationItem): string[] {
    return [item.selfName, ...item.dependents.map((d) => minorDisplayName(d.firstName, d.lastName))];
  }

  async review(req: ReviewRequest): Promise<CallableOutcome<{ status: string }>> {
    try {
      const res = await this.reviewCallable()(req);
      return { ok: true, status: res.data.status };
    } catch (e) {
      const err = e as { code?: string; message?: string; details?: { reason?: string } } | null;
      return {
        ok: false,
        code: err?.code ?? 'unknown',
        ...(err?.details?.reason ? { reason: err.details.reason } : {}),
        message: err?.message ?? String(e),
      };
    }
  }
}

let instance: LeagueReviewService | null = null;

/** The live, Firestore-backed LeagueReviewService (memoized). */
export function getLeagueReviewService(): LeagueReviewService {
  if (!instance) {
    instance = new LeagueReviewService(
      new LeagueReviewRepository(db),
      () => callable<ReviewRequest, ReviewResponse>('reviewRequest'),
    );
  }
  return instance;
}
