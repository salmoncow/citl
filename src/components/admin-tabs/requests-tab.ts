/**
 * Requests tab — the coordinator's review queue (spec 010 F11 – F14).
 *
 * Loaded on first open (its own chunk, AC-1). A ticket-style queue: one
 * row per submitted team proposal, join request, scorecard-name link, and
 * accepted captain handoff, oldest first with order dependencies applied
 * (request-list.ts), filterable by kind. A row opens the ticket in a
 * modal dialog where the coordinator decides it. A Captains view lists
 * league teams with a captain (AC-4). Every decision goes through
 * LeagueReviewService.review (the reviewRequest callable); the queue
 * reloads after each one.
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
  handoffTicket,
  linkTicket,
  proposalTicket,
  readNote,
  readSettings,
  registrationTicket,
  type Defaults,
  type Ticket,
} from './request-cards';
import {
  filterChips,
  sortTickets,
  ticketDependencies,
  ticketDialogContent,
  ticketKey,
  ticketList,
  viewToggle,
  type Dependency,
  type QueueFilter,
  type QueueView,
} from './request-list';
import type { AdminTab, AdminTabContext } from './types';

const { scoreService } = getServices();

async function teamsOf(year: number): Promise<Team[]> {
  const res = await scoreService.getTeams(year);
  return res.success ? res.data : [];
}

/**
 * A league team's name: from the season's teams, else the two seasons
 * before (cached reads the proposal comparisons share), else its id.
 */
async function teamName(id: string, year: number, seasonTeams: readonly Team[]): Promise<string> {
  const found = seasonTeams.find((t) => t.id === id);
  if (found) return found.name;
  for (const y of [year - 1, year - 2]) {
    const prior = (await teamsOf(y)).find((t) => t.id === id);
    if (prior) return prior.name;
  }
  return id;
}

async function defaultsFor(year: number, names: readonly string[]): Promise<Defaults> {
  const pairs = await Promise.all(names.map(async (name) => {
    const res = await scoreService.computeShooterDefaults(year, name);
    return [name, res.success ? res.data : { startingAvg: 35, rookie: true }] as const;
  }));
  return new Map(pairs);
}

export class RequestsTab implements AdminTab {
  private _root: HTMLElement | null = null;
  private _dialog: HTMLDialogElement | null = null;
  private _ctx: AdminTabContext | null = null;
  private _queue: ReviewQueue | null = null;
  private _busy = false;
  private _loadSeq = 0;
  private _view: QueueView = 'queue';
  private _filter: QueueFilter = 'all';
  /** Tickets in display order, and their order dependencies, from the last load. */
  private _tickets: Ticket[] = [];
  private _deps = new Map<string, Dependency>();
  /** The ticket the dialog holds; null after a reload so it is rebuilt. */
  private _dialogKey: string | null = null;
  /** Set when a decision closes the dialog, so focus doesn't return to a removed row. */
  private _decided = false;
  /** Request payload builders by card key, rebuilt on every load. */
  private _requests = new Map<string, (act: string, card: HTMLElement) => ReviewRequest | string>();

  mount(host: HTMLElement, ctx: AdminTabContext): void {
    this._ctx = ctx;
    this._root = document.createElement('div');
    const dialog = document.createElement('dialog');
    dialog.className = 'req-dialog';
    dialog.setAttribute('aria-labelledby', 'req-dialog-title');
    this._dialog = dialog;
    host.replaceChildren(this._root, dialog);

    dialog.addEventListener('cancel', (e) => { if (this._busy) e.preventDefault(); });
    dialog.addEventListener('close', () => this._onDialogClosed());
    // Clicking the backdrop (the dialog element itself) closes it.
    dialog.addEventListener('click', (e) => { if (e.target === dialog && !this._busy) dialog.close(); });
    host.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const open = target.closest<HTMLElement>('[data-open]');
      if (open) { this._openTicket(open.dataset['open'] ?? ''); return; }
      const filter = target.closest<HTMLElement>('[data-filter]');
      if (filter) { this._setFilter(filter.dataset['filter'] as QueueFilter); return; }
      const view = target.closest<HTMLElement>('[data-view]');
      if (view) { this._setView(view.dataset['view'] as QueueView); return; }
      if (target.closest('[data-close]')) { if (!this._busy) this._dialog?.close(); return; }
      const btn = target.closest<HTMLButtonElement>('button[data-act]');
      const card = btn?.closest<HTMLElement>('[data-card]');
      if (btn && card) void this._act(card, btn.dataset['act'] ?? '');
    });
  }

  onActivate(): void {
    void this._load();
  }

  private _renderLoading(): void {
    if (!this._root) return;
    this._root.innerHTML = `
      <div class="skeleton-group" aria-busy="true" aria-label="Loading requests">
        <span class="skeleton skeleton--lg"></span><span class="skeleton skeleton--md"></span>
      </div>`;
  }

  private async _load(): Promise<void> {
    const seq = ++this._loadSeq;
    if (!this._queue) this._renderLoading();
    const res = await getLeagueReviewService().loadQueue();
    if (seq !== this._loadSeq || !this._root) return;
    if (!res.success) {
      this._root.innerHTML = `<p class="admin-status admin-status--error" role="alert">Couldn’t load requests. ${escapeHtml(res.error)}</p>`;
      return;
    }
    const tickets = await this._buildTickets(res.data);
    if (seq !== this._loadSeq) return;
    this._queue = res.data;
    this._deps = ticketDependencies(res.data);
    this._tickets = sortTickets(tickets, this._deps);
    this._dialogKey = null;
    this._ctx?.setRequestCount(this._tickets.length);
    this._render();
  }

  private async _buildTickets(q: ReviewQueue): Promise<Ticket[]> {
    this._requests.clear();
    const [proposals, registrations, links] = await Promise.all([
      Promise.all(q.proposals.map((item, i) => this._proposal(ticketKey.proposal(i), item))),
      Promise.all(q.registrations.map((item, i) => this._registration(ticketKey.registration(i), item))),
      this._links(q),
    ]);
    const handoffs = q.handoffs.map((c, i) => {
      const key = ticketKey.handoff(i);
      this._requests.set(key, (act, card) => ({
        type: 'captain', leagueTeamId: c.leagueTeamId, action: act === 'approve' ? 'approve' : 'decline', note: readNote(card),
      }));
      return handoffTicket(key, c);
    });
    for (const { team } of q.captains) {
      this._requests.set(`captain:${team.id}`, () => ({ type: 'captain', leagueTeamId: team.id, action: 'clear' }));
    }
    return [...proposals, ...registrations, ...links, ...handoffs];
  }

  /** Render the current view from the loaded queue (no reads). */
  private _render(): void {
    if (!this._root || !this._queue) return;
    const total = this._tickets.length;
    const toggle = viewToggle(this._view, total, this._queue.captains.length);
    if (this._view === 'captains') {
      this._root.innerHTML = `
        <div class="req-toolbar">${toggle}</div>
        <p class="admin-publish-note" tabindex="-1" data-summary>League teams with a captain. Removing a captain cancels any open handoff.</p>
        ${captainsTable(this._queue.captains)}`;
      return;
    }
    this._root.innerHTML = `
      <div class="req-toolbar">${toggle}</div>
      <p class="admin-publish-note" tabindex="-1" data-summary>${total ? `${total} request${total === 1 ? '' : 's'} waiting, in the order to review them.` : 'Nothing is waiting for review.'}
        Approving a team or placing a member updates that season’s roster right away.</p>
      ${total ? filterChips(this._tickets, this._filter) : ''}
      ${ticketList(this._tickets, this._deps, this._filter, new Date())}`;
  }

  private _setFilter(filter: QueueFilter): void {
    this._filter = filter;
    this._render();
    this._root?.querySelector<HTMLElement>(`[data-filter="${filter}"]`)?.focus();
  }

  private _setView(view: QueueView): void {
    this._view = view;
    this._render();
    this._root?.querySelector<HTMLElement>(`[data-view="${view}"]`)?.focus();
  }

  private _openTicket(key: string): void {
    const dialog = this._dialog;
    const ticket = this._tickets.find((t) => t.key === key);
    if (!dialog || !ticket || this._busy) return;
    // Reopening the same ticket keeps what was typed until the next reload.
    if (this._dialogKey !== key) {
      const ticketOf = (k: string) => this._tickets.find((t) => t.key === k);
      dialog.innerHTML = ticketDialogContent(ticket, this._deps.get(key), ticketOf);
      this._dialogKey = key;
      dialog.querySelector('.req-dialog__body')?.scrollTo?.(0, 0);
    }
    this._decided = false;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLElement>('.req-dialog__close')?.focus();
  }

  private _onDialogClosed(): void {
    if (this._decided || !this._dialogKey) return;
    this._root?.querySelector<HTMLElement>(`[data-open="${this._dialogKey}"]`)?.focus();
  }

  /** After a reload, focus the row now where the decided one was, else the summary (§III.6). */
  private _focusAfterDecision(index: number): void {
    const rows = [...(this._root?.querySelectorAll<HTMLElement>('li:not([hidden]) > [data-open]') ?? [])];
    const target = rows[Math.min(index, rows.length - 1)] ?? this._root?.querySelector<HTMLElement>('[data-summary]');
    target?.focus();
  }

  private async _proposal(key: string, item: ProposalItem): Promise<Ticket> {
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
    return proposalTicket(key, item, rows, lastYear, defaults);
  }

  private async _registration(key: string, item: RegistrationItem): Promise<Ticket> {
    const r = item.registration;
    const names = getLeagueReviewService().placementNames(item);
    const [teams, defaults] = await Promise.all([teamsOf(r.year), defaultsFor(r.year, names)]);
    const preferred = r.preferredLeagueTeamId ? await teamName(r.preferredLeagueTeamId, r.year, teams) : null;
    this._requests.set(key, (act, card) => {
      if (act === 'decline') return { type: 'registration', id: r.id, action: 'decline', note: readNote(card) };
      const teamId = card.querySelector<HTMLSelectElement>('[data-team]')?.value ?? '';
      if (!teamId) return 'Choose a team.';
      const settings = readSettings(card);
      const bad = settings.find((s) => !Number.isFinite(s.startingAvg) || s.startingAvg < 0 || s.startingAvg > 50);
      if (bad) return `Enter a starting average from 0 to 50 for ${bad.name}.`;
      return { type: 'registration', id: r.id, action: 'place', teamId, settings, note: readNote(card) };
    });
    return registrationTicket(key, item, names, teams, preferred, defaults);
  }

  private async _links(q: ReviewQueue): Promise<Ticket[]> {
    if (!q.links.length) return [];
    const dir = await loadShooterDirectory(scoreService);
    const entries = dir.success ? dir.data : [];
    return q.links.map((item, i) => {
      const key = ticketKey.link(i);
      this._requests.set(key, (act, card) => {
        if (act === 'decline') return { type: 'link', uid: item.uid, action: 'decline', note: readNote(card) };
        const name = card.querySelector<HTMLInputElement>('input[data-link-name]:checked')?.value ?? '';
        if (!name) return 'Choose the scorecard name to link.';
        return { type: 'link', uid: item.uid, action: 'approve', shooterName: name, note: readNote(card) };
      });
      const name = item.request.shooterName;
      return linkTicket(key, item, closeMatches(entries, name), findExact(entries, name));
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

    const key = card.dataset['card'] ?? '';
    const visible = this._tickets.filter((t) => this._filter === 'all' || t.kind === this._filter);
    const index = Math.max(0, visible.findIndex((t) => t.key === key));
    this._busy = true;
    card.setAttribute('aria-busy', 'true');
    const res = await getLeagueReviewService().review(req);
    this._busy = false;
    card.removeAttribute('aria-busy');
    if (!res.ok) {
      this._showError(card, leagueErrorMessage(res.code, res.reason, res.message));
      return;
    }
    if (this._dialog?.open) {
      this._decided = true;
      this._dialog.close();
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
    // The decided ticket is gone after the reload; focus its neighbour (§III.6).
    if (req.type === 'captain' && req.action === 'clear') this._root?.querySelector<HTMLElement>('[data-summary]')?.focus();
    else this._focusAfterDecision(index);
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
