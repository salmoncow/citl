/**
 * Requests tab — the coordinator's review queue (spec 010 F11 – F14).
 *
 * Loaded on first open (its own chunk, AC-1). Lists submitted team
 * proposals, join requests, scorecard-name links, and accepted captain
 * handoffs, oldest first, plus league teams with a captain (AC-4). Every
 * decision goes through LeagueReviewService.review (the reviewRequest
 * callable); the queue reloads after each one.
 *
 * Reads on open (AC-5): four status queries and the captained teams,
 * one profile + user read per member, then cached season team reads for
 * comparisons, defaults, and team choices. The shooter directory loads
 * only when a link request is waiting.
 */

import '@/styles/admin-requests.css';
import { escapeHtml, showToast } from '@/modules/ui';
import { getServices } from '@/services/app-services';
import { closeMatches, findExact, loadShooterDirectory } from '@/services/shooter-directory';
import { leagueErrorMessage } from '@/services/member-league-service';
import {
  compareRoster,
  getLeagueReviewService,
  type ProposalItem,
  type RegistrationItem,
  type ReviewQueue,
} from '@/services/league-review-service';
import type { ReviewRequest } from '@/types/league';
import type { Team } from '@/types/score';
import { showConfirmDialog } from './admin-shared';
import {
  captainsTable,
  handoffCard,
  linkCard,
  proposalCard,
  readNote,
  readSettings,
  registrationCard,
  type Defaults,
} from './request-cards';
import type { AdminTab, AdminTabContext } from './types';

const { scoreService } = getServices();

async function teamsOf(year: number): Promise<Team[]> {
  const res = await scoreService.getTeams(year);
  return res.success ? res.data : [];
}

async function defaultsFor(year: number, names: readonly string[]): Promise<Defaults> {
  const pairs = await Promise.all(names.map(async (name) => {
    const res = await scoreService.computeShooterDefaults(year, name);
    return [name, res.success ? res.data : { startingAvg: 35, rookie: true }] as const;
  }));
  return new Map(pairs);
}

export class RequestsTab implements AdminTab {
  private _host: HTMLElement | null = null;
  private _ctx: AdminTabContext | null = null;
  private _queue: ReviewQueue | null = null;
  private _busy = false;
  private _loadSeq = 0;
  /** Request payload builders by card key, rebuilt on every render. */
  private _requests = new Map<string, (act: string, card: HTMLElement) => ReviewRequest | string>();

  mount(host: HTMLElement, ctx: AdminTabContext): void {
    this._host = host;
    this._ctx = ctx;
    host.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
      const card = btn?.closest<HTMLElement>('[data-card]');
      if (btn && card) void this._act(card, btn.dataset['act'] ?? '');
    });
  }

  onActivate(): void {
    void this._load();
  }

  private _renderLoading(): void {
    if (!this._host) return;
    this._host.innerHTML = `
      <div class="skeleton-group" aria-busy="true" aria-label="Loading requests">
        <span class="skeleton skeleton--lg"></span><span class="skeleton skeleton--md"></span>
      </div>`;
  }

  private async _load(): Promise<void> {
    const seq = ++this._loadSeq;
    if (!this._queue) this._renderLoading();
    const res = await getLeagueReviewService().loadQueue();
    if (seq !== this._loadSeq || !this._host) return;
    if (!res.success) {
      this._host.innerHTML = `<p class="admin-status admin-status--error" role="alert">Couldn’t load requests. ${escapeHtml(res.error)}</p>`;
      return;
    }
    this._queue = res.data;
    const html = await this._renderQueue(res.data);
    if (seq !== this._loadSeq) return;
    this._host.innerHTML = html;
  }

  private async _renderQueue(q: ReviewQueue): Promise<string> {
    this._requests.clear();
    const [proposals, registrations, links] = await Promise.all([
      Promise.all(q.proposals.map((item, i) => this._proposal(`p${i}`, item))),
      Promise.all(q.registrations.map((item, i) => this._registration(`r${i}`, item))),
      this._links(q),
    ]);
    const handoffs = q.handoffs.map((c, i) => {
      const key = `h${i}`;
      this._requests.set(key, (act, card) => ({
        type: 'captain', leagueTeamId: c.leagueTeamId, action: act === 'approve' ? 'approve' : 'decline', note: readNote(card),
      }));
      return handoffCard(key, c);
    });
    for (const { team } of q.captains) {
      this._requests.set(`captain:${team.id}`, () => ({ type: 'captain', leagueTeamId: team.id, action: 'clear' }));
    }

    const total = proposals.length + registrations.length + links.length + handoffs.length;
    const section = (title: string, cards: string[], empty: string) => `
      <h3>${title}${cards.length ? ` <span class="req-count">${cards.length}</span>` : ''}</h3>
      ${cards.length ? cards.join('') : `<p class="req-muted">${empty}</p>`}`;
    return `
      <p class="admin-publish-note" tabindex="-1" data-summary>${total ? `${total} request${total === 1 ? '' : 's'} waiting.` : 'Nothing is waiting for review.'}
        Approving a team or placing a member updates that season’s roster right away.</p>
      ${section('Team proposals', proposals, 'No team proposals waiting.')}
      ${section('Join requests', registrations, 'No join requests waiting.')}
      ${section('Scorecard names', links, 'No link requests waiting.')}
      ${section('Captain handoffs', handoffs, 'No handoffs waiting.')}
      <hr class="admin-divider">
      <h3>Team captains</h3>
      ${captainsTable(q.captains)}`;
  }

  private async _proposal(key: string, item: ProposalItem): Promise<string> {
    const p = item.proposal;
    const [prev1, prev2, current] = await Promise.all([teamsOf(p.year - 1), teamsOf(p.year - 2), teamsOf(p.year)]);
    const last1 = prev1.find((t) => t.id === item.teamId);
    const last2 = last1 ? undefined : prev2.find((t) => t.id === item.teamId);
    const last = last1 ?? last2 ?? null;
    const lastYear = last1 ? p.year - 1 : last2 ? p.year - 2 : null;
    const stored = current.find((t) => t.id === item.teamId)?.shooters ?? null;
    const rows = compareRoster(p.shooters.map((s) => s.name), last?.shooters ?? null, stored);
    const defaults = await defaultsFor(p.year, rows.filter((r) => r.status !== 'dropped' && !r.stored).map((r) => r.name));
    this._requests.set(key, (act, card) => {
      if (act === 'approve') {
        const settings = readSettings(card);
        const bad = settings.find((s) => !Number.isFinite(s.startingAvg) || s.startingAvg < 0 || s.startingAvg > 50);
        if (bad) return `Enter a starting average from 0 to 50 for ${bad.name}.`;
        return { type: 'proposal', id: p.id, action: 'approve', settings, note: readNote(card) };
      }
      const note = readNote(card);
      if (act === 'request-changes' && !note) return 'Write a note saying what needs to change.';
      return { type: 'proposal', id: p.id, action: act === 'reject' ? 'reject' : 'request-changes', note };
    });
    return proposalCard(key, item, rows, lastYear, defaults);
  }

  private async _registration(key: string, item: RegistrationItem): Promise<string> {
    const r = item.registration;
    const names = getLeagueReviewService().placementNames(item);
    const [teams, defaults] = await Promise.all([teamsOf(r.year), defaultsFor(r.year, names)]);
    const preferred = r.preferredLeagueTeamId
      ? teams.find((t) => t.id === r.preferredLeagueTeamId)?.name ?? r.preferredLeagueTeamId
      : null;
    this._requests.set(key, (act, card) => {
      if (act === 'decline') return { type: 'registration', id: r.id, action: 'decline', note: readNote(card) };
      const teamId = card.querySelector<HTMLSelectElement>('[data-team]')?.value ?? '';
      if (!teamId) return 'Choose a team.';
      const settings = readSettings(card);
      const bad = settings.find((s) => !Number.isFinite(s.startingAvg) || s.startingAvg < 0 || s.startingAvg > 50);
      if (bad) return `Enter a starting average from 0 to 50 for ${bad.name}.`;
      return { type: 'registration', id: r.id, action: 'place', teamId, settings, note: readNote(card) };
    });
    return registrationCard(key, item, names, teams, preferred, defaults);
  }

  private async _links(q: ReviewQueue): Promise<string[]> {
    if (!q.links.length) return [];
    const dir = await loadShooterDirectory(scoreService);
    const entries = dir.success ? dir.data : [];
    return q.links.map((item, i) => {
      const key = `l${i}`;
      this._requests.set(key, (act, card) => {
        if (act === 'decline') return { type: 'link', uid: item.uid, action: 'decline', note: readNote(card) };
        const name = card.querySelector<HTMLInputElement>('input[data-link-name]:checked')?.value ?? '';
        if (!name) return 'Choose the scorecard name to link.';
        return { type: 'link', uid: item.uid, action: 'approve', shooterName: name, note: readNote(card) };
      });
      const name = item.request.shooterName;
      return linkCard(key, item, closeMatches(entries, name), findExact(entries, name));
    });
  }

  private _showError(card: HTMLElement, message: string): void {
    const box = card.querySelector<HTMLElement>('.req-card__error');
    if (box) {
      box.textContent = message;
      box.hidden = false;
    } else {
      showToast('error', message);
    }
  }

  private async _act(card: HTMLElement, act: string): Promise<void> {
    if (this._busy) return;
    const build = this._requests.get(card.dataset['card'] ?? '');
    if (!build) return;
    const req = build(act, card);
    if (typeof req === 'string') { this._showError(card, req); return; }

    if (req.type === 'captain' && req.action === 'clear') {
      const name = card.querySelector('td')?.textContent?.trim() ?? req.leagueTeamId;
      const ok = await showConfirmDialog({
        title: 'Remove captain?',
        warning: `${name} will have no captain. Any open handoff is cancelled. A member can then propose the team again.`,
        nameToType: name,
        deleteLabel: 'Remove captain',
      });
      if (!ok) return;
    }

    this._busy = true;
    card.setAttribute('aria-busy', 'true');
    const res = await getLeagueReviewService().review(req);
    this._busy = false;
    card.removeAttribute('aria-busy');
    if (!res.ok) {
      this._showError(card, leagueErrorMessage(res.code, res.reason, res.message));
      return;
    }
    showToast('success', DONE[`${req.type}:${req.action}`] ?? 'Done.');
    if (req.type === 'proposal' || req.type === 'registration') {
      const year = req.type === 'proposal'
        ? this._queue?.proposals.find((i) => i.proposal.id === req.id)?.proposal.year
        : this._queue?.registrations.find((i) => i.registration.id === req.id)?.registration.year;
      if (year) scoreService.invalidateTeams(year);
      if (year === this._ctx?.getYear()) void this._ctx?.refreshTeams();
    }
    await this._load();
    // The acted-on card is gone after the reload; move focus to the summary (§III.6).
    this._host?.querySelector<HTMLElement>('[data-summary]')?.focus();
  }
}

const DONE: Record<string, string> = {
  'proposal:approve': 'Approved. The team and roster are published.',
  'proposal:reject': 'Proposal rejected.',
  'proposal:request-changes': 'Sent back to the captain for changes.',
  'registration:place': 'Placed on the team.',
  'registration:decline': 'Join request declined.',
  'link:approve': 'Scorecard name linked.',
  'link:decline': 'Link request declined.',
  'captain:approve': 'Captain changed.',
  'captain:decline': 'Handoff declined.',
  'captain:clear': 'Captain removed.',
};
