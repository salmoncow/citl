/**
 * <team-proposal-page> — the roster builder at /account/team (spec 009
 * F6, F7, F10; AC-4 – AC-10).
 *
 * A member proposes a new team or claims a returning league team with no
 * captain (or their own), drafts the roster, and saves, submits,
 * withdraws, or deletes the proposal through the teamProposal callable.
 * Submitted, approved and rejected proposals are read-only. Spec 010: an
 * approved roster can be reopened as a change request (team fields
 * locked); discarding the change restores the published roster.
 *
 * Reads: the cached season list (registration season), the member's
 * league overview (proposal, registration, link request, dependents),
 * and the league team list. "Start from {year} roster" adds one cached
 * season team read.
 */

import '@/styles/account.css';
import '@/components/roster-entry-list';
import { escapeHtml, showToast } from '@/modules/ui';
import { getAccountContext } from '@/modules/account-context';
import { getServices } from '@/services/app-services';
import {
  getMemberLeagueService,
  leagueErrorMessage,
  type LeagueOverview,
} from '@/services/member-league-service';
import {
  ROSTER_MAX,
  TEAM_NAME_MAX,
  registrationYear,
  rosterIssues,
  type RosterNameContext,
} from '@/services/league-validation';
import { normalizeShooterName } from '@/services/scoring-engine';
import type { LeagueTeam, RosterEntry, RosterEntryInput, TeamSource } from '@/types/league';
import { leagueRequestsEnabled } from '@/utils/features';
import { confirmLeague } from '@/components/league-dialog';

const EDITABLE = new Set(['draft', 'changes-requested']);

/** Stored entry → editable input. Named names split on the last space (minors keep "L."). */
function toInput(e: RosterEntry): RosterEntryInput {
  if (e.kind === 'self') return { kind: 'self', rookie: e.rookie };
  if (e.kind === 'dependent') return { kind: 'dependent', dependentId: e.dependentId ?? '', rookie: e.rookie };
  const cut = e.name.lastIndexOf(' ');
  return {
    kind: 'named',
    firstName: cut > 0 ? e.name.slice(0, cut) : e.name,
    lastName: cut > 0 ? e.name.slice(cut + 1) : '',
    rookie: e.rookie,
    minor: e.minor,
    guardianName: e.guardianName ?? null,
  };
}

class TeamProposalPage extends HTMLElement {
  private _overview: LeagueOverview | null = null;
  private _teams: LeagueTeam[] = [];
  private _source: TeamSource = 'new';
  private _leagueTeamId: string | null = null;
  private _teamName = '';
  private _entries: RosterEntryInput[] = [];
  private _busy = false;

  private _unsub: (() => void) | null = null;
  private _started = false;

  connectedCallback(): void {
    if (!leagueRequestsEnabled) {
      this._message('Team proposals aren’t open yet', 'Check back closer to the season.');
      return;
    }
    // Wait for the account gate: auth restores asynchronously and the
    // profile (the captain's roster name) loads after it.
    const { gate } = getAccountContext();
    this._unsub = gate.onUpdate(() => this._sync());
    this._sync();
  }

  disconnectedCallback(): void {
    this._unsub?.();
    this._unsub = null;
  }

  private _sync(): void {
    if (this._started) return;
    const { gate } = getAccountContext();
    if (!gate.userDoc.uid) {
      this._message('Sign in to propose a team', '<a href="#/account">Go to your account</a> to sign in.');
      return;
    }
    if (gate.profileState !== 'ready') return;
    this._started = true;
    void this._load();
  }

  private get _uid(): string {
    return getAccountContext().gate.userDoc.uid ?? '';
  }

  private get _ctx(): RosterNameContext {
    const o = this._overview;
    const profileName = getAccountContext().gate.profile?.displayName ?? '';
    return {
      selfName: o?.linkedName ?? profileName,
      dependents: new Map((o?.dependents ?? []).map((d) => [d.id, { firstName: d.firstName, lastName: d.lastName }])),
    };
  }

  private get _editable(): boolean {
    const p = this._overview?.proposal;
    return !p || EDITABLE.has(p.status);
  }

  /** A post-approval change request (spec 010 AC-15): the team is fixed. */
  private get _isChange(): boolean {
    return this._overview?.proposal?.purpose === 'change';
  }

  private _message(title: string, bodyHtml: string): void {
    this.innerHTML = `
      <div class="account-page">
        <span class="eyebrow">Team proposal</span>
        <h1 tabindex="-1">${title}</h1>
        <p class="account-page__lede">${bodyHtml}</p>
      </div>`;
    this.querySelector<HTMLElement>('h1')?.focus();
  }

  private async _load(): Promise<void> {
    const svc = getMemberLeagueService();
    const seasons = await getServices().scoreService.getAllSeasons();
    const year = registrationYear(seasons.success ? seasons.data : []);
    const [overview, teams] = await Promise.all([svc.loadOverview(this._uid, year), svc.listLeagueTeams()]);
    if (!this.isConnected) return;
    if (!overview.success || !teams.success) {
      this._message('Team proposal', 'We couldn’t load your proposal. Check your connection and reload the page.');
      return;
    }
    this._overview = overview.data;
    this._teams = teams.data;
    if (overview.data.registration) {
      this._message(`${year} team proposal`,
        'You asked to join a team this season. Withdraw that request on <a href="#/account">your account</a> to propose a team instead.');
      return;
    }
    const p = overview.data.proposal;
    if (p) {
      this._source = p.teamSource;
      this._leagueTeamId = p.leagueTeamId;
      this._teamName = p.teamName;
      this._entries = p.shooters.map(toInput);
    } else {
      this._entries = [{ kind: 'self', rookie: false }];
    }
    this._render();
    this.querySelector<HTMLElement>('h1')?.focus();
  }

  private _render(): void {
    const o = this._overview!;
    const p = o.proposal;
    const editable = this._editable;
    const teamRo = editable && !this._isChange ? '' : 'disabled';
    const uid = this._uid;
    const claimable = this._teams.filter((t) => !t.captainUid || t.captainUid === uid);
    const status = p
      ? this._isChange
        ? { draft: 'Roster change, not sent yet. Your published roster stays until the coordinator approves the change.', submitted: 'Roster change submitted for review. Withdraw it to make more changes.', 'changes-requested': 'The coordinator asked for changes to your roster change.', approved: 'Approved. This is your published roster.', rejected: 'Not approved.' }[p.status]
        : { draft: 'Draft, not sent yet', submitted: 'Submitted for review. Withdraw it to make changes.', 'changes-requested': 'The coordinator asked for changes.', approved: 'Approved. This is your published roster.', rejected: 'Not approved.' }[p.status]
      : 'New proposal. Nothing is saved until you choose Save draft.';
    const team = this._teams.find((t) => t.id === this._leagueTeamId);
    const lastSeason = team ? Math.max(...team.seasons) : null;

    this.innerHTML = `
      <div class="account-page">
        <span class="eyebrow">Team proposal</span>
        <h1 tabindex="-1">${o.year} team proposal</h1>
        <p class="account-page__lede">${escapeHtml(status)} <a href="#/account">Back to your account</a></p>
        ${p?.reviewNote ? `<p class="account-notice">Coordinator’s note: ${escapeHtml(p.reviewNote)}</p>` : ''}

        <section class="card account-section" aria-labelledby="tp-team">
          <h2 id="tp-team">Team</h2>
          <fieldset class="league-fieldset" ${teamRo}>
            <legend class="account-field__label">Is this a new team?</legend>
            <label class="account-check"><input type="radio" name="source" value="new" ${this._source === 'new' ? 'checked' : ''}><span>A new team</span></label>
            <label class="account-check"><input type="radio" name="source" value="returning" ${this._source === 'returning' ? 'checked' : ''} ${claimable.length ? '' : 'disabled'}><span>A team that played before</span></label>
          </fieldset>
          ${this._source === 'returning' ? `
          <div class="account-field">
            <label class="account-field__label" for="tp-league-team">Returning team</label>
            <select id="tp-league-team" class="account-field__input" ${teamRo} aria-describedby="tp-league-hint">
              <option value="">Choose…</option>
              ${claimable.map((t) => `<option value="${escapeHtml(t.id)}" ${t.id === this._leagueTeamId ? 'selected' : ''}>${escapeHtml(t.name)} (${escapeHtml(t.seasons.join(', '))})</option>`).join('')}
            </select>
            <p id="tp-league-hint" class="account-field__hint">Teams with a captain aren’t listed. Ask their captain to nominate you instead.</p>
          </div>` : ''}
          <div class="account-field">
            <label class="account-field__label" for="tp-name">Team name</label>
            <input id="tp-name" class="account-field__input" type="text" maxlength="${TEAM_NAME_MAX}" value="${escapeHtml(this._teamName)}" ${teamRo}>
          </div>
        </section>

        <section class="card account-section" aria-labelledby="tp-roster">
          <h2 id="tp-roster">Roster</h2>
          <p class="account-section__desc">Teams have 5 to ${ROSTER_MAX} shooters, including you. Shooters under 18 are
          shown as first name and last initial, and need a guardian on the team. Starting averages are set by the coordinator.</p>
          ${editable && !this._isChange && team && lastSeason ? `<p><button type="button" class="btn-secondary" data-action="prefill">Add shooters from the ${lastSeason} roster</button></p>` : ''}
          <roster-entry-list></roster-entry-list>
        </section>

        <div class="account-error" role="alert" data-issues hidden></div>
        <div class="account-form__actions">${this._actions()}</div>
      </div>`;

    const list = this.querySelector('roster-entry-list') as (HTMLElement & { entries: RosterEntryInput[]; context: RosterNameContext; readOnly: boolean }) | null;
    if (list) {
      list.context = this._ctx;
      list.readOnly = !editable;
      list.entries = this._entries;
    }
    this._wire();
  }

  private _actions(): string {
    const status = this._overview?.proposal?.status;
    const b = (action: string, label: string, cls = 'btn-secondary') =>
      `<button type="button" class="${cls}" data-action="${action}">${label}</button>`;
    if (!status || EDITABLE.has(status)) {
      const remove = this._isChange ? b('delete', 'Discard changes', 'btn-danger') : status ? b('delete', 'Delete proposal', 'btn-danger') : '';
      return b('submit', 'Submit for review', 'btn-primary') + b('save', 'Save draft') + remove;
    }
    if (status === 'submitted') return b('withdraw', 'Withdraw to edit');
    if (status === 'rejected') return b('delete', 'Delete proposal', 'btn-danger');
    if (status === 'approved') return b('reopen', 'Request roster changes', 'btn-primary');
    return '';
  }

  private _wire(): void {
    this.querySelectorAll<HTMLInputElement>('input[name="source"]').forEach((r) => {
      r.addEventListener('change', () => {
        this._source = r.value === 'returning' ? 'returning' : 'new';
        if (this._source === 'new') this._leagueTeamId = null;
        this._render();
        this.querySelector<HTMLElement>(`input[name="source"][value="${this._source}"]`)?.focus();
      });
    });
    this.querySelector<HTMLSelectElement>('#tp-league-team')?.addEventListener('change', (e) => {
      const id = (e.target as HTMLSelectElement).value || null;
      this._leagueTeamId = id;
      const t = this._teams.find((x) => x.id === id);
      if (t) this._teamName = t.name;
      this._render();
      this.querySelector<HTMLElement>('#tp-league-team')?.focus();
    });
    this.querySelector<HTMLInputElement>('#tp-name')?.addEventListener('input', (e) => {
      this._teamName = (e.target as HTMLInputElement).value;
    });
    this.querySelector('[data-action="prefill"]')?.addEventListener('click', () => void this._prefill());
    const on = (action: string, fn: () => void) => this.querySelector(`[data-action="${action}"]`)?.addEventListener('click', fn);
    on('save', () => void this._save(false));
    on('submit', () => void this._save(true));
    on('withdraw', () => void this._act('withdraw'));
    on('reopen', () => void this._act('reopen'));
    on('delete', () => void this._delete());
  }

  private _showIssues(issues: string[]): void {
    const box = this.querySelector<HTMLElement>('[data-issues]');
    if (!box) return;
    box.innerHTML = issues.length
      ? `<p>Fix these first:</p><ul>${issues.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`
      : '';
    box.hidden = issues.length === 0;
    if (issues.length) box.scrollIntoView({ block: 'nearest' });
  }

  private async _prefill(): Promise<void> {
    const team = this._teams.find((t) => t.id === this._leagueTeamId);
    if (!team) return;
    const year = Math.max(...team.seasons);
    const res = await getServices().scoreService.getTeams(year);
    if (!res.success) { showToast('error', 'Couldn’t load last season’s roster.'); return; }
    const last = res.data.find((t) => t.id === team.id);
    const ctx = this._ctx;
    const taken = new Set(this._entries.map((e) => normalizeShooterName(
      e.kind === 'named' ? `${e.firstName} ${e.lastName}` : e.kind === 'self' ? ctx.selfName : '')));
    let added = 0;
    for (const s of last?.shooters ?? []) {
      if (this._entries.length >= ROSTER_MAX) break;
      const name = s.name.trim().replace(/\s+/g, ' ');
      if (!name || taken.has(normalizeShooterName(name))) continue;
      const cut = name.lastIndexOf(' ');
      this._entries.push({
        kind: 'named',
        firstName: cut > 0 ? name.slice(0, cut) : name,
        lastName: cut > 0 ? name.slice(cut + 1) : '',
        rookie: false,
        minor: false,
      });
      taken.add(normalizeShooterName(name));
      added++;
    }
    this._render();
    showToast('info', added ? `Added ${added} shooter${added === 1 ? '' : 's'} from ${year}. Remove anyone who isn’t returning.` : `Everyone from ${year} is already on the roster.`);
  }

  private async _save(submit: boolean): Promise<void> {
    if (this._busy) return;
    const issues = rosterIssues(this._entries, this._ctx, { forSubmit: submit });
    if (this._source === 'returning' && !this._leagueTeamId) issues.unshift('Choose the returning team.');
    this._showIssues(issues);
    if (issues.length) return;

    this._busy = true;
    const svc = getMemberLeagueService();
    const year = this._overview!.year;
    const saved = await svc.saveProposal(year, {
      teamSource: this._source, leagueTeamId: this._leagueTeamId, teamName: this._teamName, shooters: this._entries,
    });
    const res = saved.ok && submit ? await svc.proposalAction(year, 'submit') : saved;
    this._busy = false;
    if (!res.ok) {
      this._showIssues([leagueErrorMessage(res.code, res.reason, res.message)]);
      return;
    }
    showToast('success', submit ? 'Submitted. The coordinator will review your team.' : 'Draft saved.');
    await this._load();
  }

  private async _act(action: 'withdraw' | 'reopen'): Promise<void> {
    if (this._busy) return;
    this._busy = true;
    const res = await getMemberLeagueService().proposalAction(this._overview!.year, action);
    this._busy = false;
    if (!res.ok) { showToast('error', leagueErrorMessage(res.code, res.reason, res.message)); return; }
    showToast('success', action === 'reopen'
      ? 'Edit the roster, then submit the change. Your published roster stays until it’s approved.'
      : 'Withdrawn. You can edit and submit again.');
    await this._load();
  }

  private async _delete(): Promise<void> {
    const change = this._isChange;
    const ok = change
      ? await confirmLeague('Discard your changes?', 'Your roster goes back to the published one.', 'Discard', true)
      : await confirmLeague('Delete this proposal?', 'The team and roster you drafted will be removed.', 'Delete', true);
    if (!ok || this._busy) return;
    this._busy = true;
    const res = await getMemberLeagueService().proposalAction(this._overview!.year, 'delete');
    this._busy = false;
    if (!res.ok) { showToast('error', leagueErrorMessage(res.code, res.reason, res.message)); return; }
    if (change) {
      showToast('success', 'Changes discarded.');
      await this._load();
      return;
    }
    showToast('success', 'Proposal deleted.');
    window.location.hash = '#/account';
  }
}

if (!customElements.get('team-proposal-page')) {
  customElements.define('team-proposal-page', TeamProposalPage);
}
