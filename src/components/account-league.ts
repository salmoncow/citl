/**
 * <account-league> — the League sections of /account (spec 009 AC-12,
 * AC-14, AC-15, AC-16, AC-19, AC-21).
 *
 * Three cards:
 *   - "{year} season": propose a team (→ #/account/team) or join a team
 *     (registration dialog); once one exists, its status and actions.
 *   - Dependents: <account-dependents>.
 *   - Scorecard name: the shooter link request and its status.
 *
 * Reads on load (AC-21): the cached season list, then the member's
 * proposal, registration, link request, and dependents (one list). The
 * league team list is read only when the join dialog opens or a
 * registration names a preferred team. Any `league-changed` event from a
 * child reloads the overview.
 */

import '@/components/account-dependents';
import { escapeHtml, showToast } from '@/modules/ui';
import { getAccountContext } from '@/modules/account-context';
import { getServices } from '@/services/app-services';
import {
  getMemberLeagueService,
  resultMessage,
  type LeagueOverview,
} from '@/services/member-league-service';
import { minorDisplayName, registrationYear } from '@/services/league-validation';
import type { LeagueTeam, LinkRequestStatus, ProposalStatus, RegistrationStatus } from '@/types/league';
import { confirmLeague } from '@/components/league-dialog';
import { openRegistrationDialog } from '@/components/registration-form';
import { openShooterLinkDialog } from '@/components/shooter-link-form';

const PROPOSAL_LABEL: Record<ProposalStatus, string> = {
  draft: 'Draft, not sent yet',
  submitted: 'Submitted for review',
  'changes-requested': 'Changes requested',
  approved: 'Approved',
  rejected: 'Not approved',
};

const REGISTRATION_LABEL: Record<RegistrationStatus, string> = {
  submitted: 'Waiting for the coordinator to place you',
  placed: 'Placed on a team',
  declined: 'Declined',
};

const LINK_LABEL: Record<LinkRequestStatus, string> = {
  submitted: 'Waiting for the coordinator to confirm',
  approved: 'Linked',
  declined: 'Not linked',
};

class AccountLeague extends HTMLElement {
  private _overview: LeagueOverview | null = null;
  private _teams: LeagueTeam[] | null = null;
  private _onChanged = () => void this._load();

  connectedCallback(): void {
    this.addEventListener('league-changed', this._onChanged);
    this._renderLoading();
    void this._load();
  }

  disconnectedCallback(): void {
    this.removeEventListener('league-changed', this._onChanged);
  }

  private get _uid(): string | null {
    return getAccountContext().auth.currentUser?.uid ?? null;
  }

  private async _load(): Promise<void> {
    const uid = this._uid;
    if (!uid) return;
    const seasons = await getServices().scoreService.getAllSeasons();
    const year = registrationYear(seasons.success ? seasons.data : []);
    const res = await getMemberLeagueService().loadOverview(uid, year);
    if (!this.isConnected) return;
    if (!res.success) {
      this._renderError();
      return;
    }
    this._overview = res.data;
    if (res.data.registration?.preferredLeagueTeamId && !this._teams) await this._loadTeams();
    this._render();
  }

  private async _loadTeams(): Promise<LeagueTeam[] | null> {
    if (this._teams) return this._teams;
    const res = await getMemberLeagueService().listLeagueTeams();
    if (!res.success) {
      showToast('error', resultMessage(res));
      return null;
    }
    this._teams = res.data;
    return this._teams;
  }

  private _renderLoading(): void {
    this.innerHTML = `
      <section class="card account-section" aria-busy="true" aria-label="Loading league details">
        <div class="skeleton-group account-skeleton">
          <span class="skeleton skeleton--lg" data-w="40"></span>
          <span class="skeleton skeleton--md" data-w="90"></span>
        </div>
      </section>`;
  }

  private _renderError(): void {
    this.innerHTML = `
      <section class="card account-section">
        <div class="account-error" role="alert">
          <p>We couldn’t load your league details. Check your connection and try again.</p>
          <button type="button" class="btn-secondary" data-action="retry">Try again</button>
        </div>
      </section>`;
    this.querySelector('[data-action="retry"]')?.addEventListener('click', () => {
      this._renderLoading();
      void this._load();
    });
  }

  private _render(): void {
    const o = this._overview;
    if (!o) return;
    this.innerHTML = `
      <section class="card account-section" aria-labelledby="league-season">
        <h2 id="league-season">${o.year} season</h2>
        ${this._seasonBody(o)}
      </section>
      <section class="card account-section" aria-labelledby="league-deps">
        <h2 id="league-deps">Dependents</h2>
        <p class="account-section__desc">Shooters under 18 join through a parent or guardian’s account and are
        always on the same team as them.</p>
        <account-dependents></account-dependents>
      </section>
      <section class="card account-section" aria-labelledby="league-link">
        <h2 id="league-link">Scorecard name</h2>
        ${this._linkBody(o)}
      </section>`;

    const deps = this.querySelector('account-dependents') as (HTMLElement & { dependents: unknown }) | null;
    if (deps) deps.dependents = o.dependents;

    const on = (action: string, fn: () => void) =>
      this.querySelector(`[data-action="${action}"]`)?.addEventListener('click', fn);
    on('join', () => void this._join());
    on('edit-registration', () => void this._join());
    on('withdraw-registration', () => void this._withdrawRegistration());
    on('link', () => void this._link());
    on('withdraw-link', () => void this._withdrawLink());
  }

  private _seasonBody(o: LeagueOverview): string {
    if (o.proposal) {
      const p = o.proposal;
      const note = p.reviewNote ? `<p class="account-notice">Coordinator’s note: ${escapeHtml(p.reviewNote)}</p>` : '';
      return `
        <p class="account-section__desc">You proposed a team for ${o.year}.</p>
        <dl class="league-facts">
          <div><dt>Team</dt><dd>${escapeHtml(p.teamName)}</dd></div>
          <div><dt>Status</dt><dd>${PROPOSAL_LABEL[p.status]}</dd></div>
          <div><dt>Roster</dt><dd>${p.shooters.length} shooter${p.shooters.length === 1 ? '' : 's'}</dd></div>
        </dl>
        ${note}
        <div class="account-form__actions">
          <a class="btn-primary" href="#/account/team">${p.status === 'draft' || p.status === 'changes-requested' ? 'Edit roster' : 'View roster'}</a>
        </div>`;
    }
    if (o.registration) {
      const r = o.registration;
      const team = r.preferredLeagueTeamId
        ? this._teams?.find((t) => t.id === r.preferredLeagueTeamId)?.name ?? r.preferredLeagueTeamId
        : 'No preference';
      const deps = r.dependentIds
        .map((id) => o.dependents.find((d) => d.id === id))
        .map((d) => (d ? minorDisplayName(d.firstName, d.lastName) : 'A removed dependent'));
      const open = r.status === 'submitted';
      return `
        <p class="account-section__desc">You asked to join a team for ${o.year}.</p>
        <dl class="league-facts">
          <div><dt>Status</dt><dd>${REGISTRATION_LABEL[r.status]}</dd></div>
          <div><dt>Preferred team</dt><dd>${escapeHtml(team)}</dd></div>
          <div><dt>With you</dt><dd>${deps.length ? escapeHtml(deps.join(', ')) : 'Just you'}</dd></div>
          ${r.note ? `<div><dt>Note</dt><dd>${escapeHtml(r.note)}</dd></div>` : ''}
        </dl>
        ${open ? `
        <div class="account-form__actions">
          <button type="button" class="btn-secondary" data-action="edit-registration">Edit request</button>
          <button type="button" class="btn-secondary" data-action="withdraw-registration">Withdraw</button>
        </div>` : ''}`;
    }
    return `
      <p class="account-section__desc">Captains propose a team and its roster. Everyone else can ask the
      coordinator to place them on a team. Both are open all season.</p>
      <div class="account-form__actions">
        <a class="btn-primary" href="#/account/team">Propose a team</a>
        <button type="button" class="btn-secondary" data-action="join">Join a team</button>
      </div>`;
  }

  private _linkBody(o: LeagueOverview): string {
    const r = o.linkRequest;
    if (!r) {
      return `
        <p class="account-section__desc">Shot in the league before? Link your account to your name on past
        scorecards. The coordinator confirms it.</p>
        <div class="account-form__actions">
          <button type="button" class="btn-secondary" data-action="link">Link my scorecard name</button>
        </div>`;
    }
    const name = r.status === 'approved' && o.linkedName ? o.linkedName : r.shooterName;
    const actions = r.status === 'submitted'
      ? `<button type="button" class="btn-secondary" data-action="link">Edit</button>
         <button type="button" class="btn-secondary" data-action="withdraw-link">Withdraw</button>`
      : r.status === 'declined'
        ? '<button type="button" class="btn-secondary" data-action="link">Try again</button>'
        : '';
    return `
      <dl class="league-facts">
        <div><dt>Name</dt><dd>${escapeHtml(name)}</dd></div>
        <div><dt>Status</dt><dd>${LINK_LABEL[r.status]}</dd></div>
      </dl>
      ${r.reviewNote ? `<p class="account-notice">Coordinator’s note: ${escapeHtml(r.reviewNote)}</p>` : ''}
      ${actions ? `<div class="account-form__actions">${actions}</div>` : ''}`;
  }

  private async _join(): Promise<void> {
    const uid = this._uid;
    const o = this._overview;
    if (!uid || !o) return;
    const teams = await this._loadTeams();
    if (!teams) return;
    const saved = await openRegistrationDialog({
      uid, year: o.year, existing: o.registration, dependents: o.dependents, leagueTeams: teams,
    });
    if (saved) {
      showToast('success', o.registration ? 'Request saved.' : 'Request sent. The coordinator will place you on a team.');
      await this._load();
    }
  }

  private async _withdrawRegistration(): Promise<void> {
    const uid = this._uid;
    const o = this._overview;
    if (!uid || !o) return;
    const ok = await confirmLeague('Withdraw your request?', 'The coordinator won’t place you on a team. You can ask again later.', 'Withdraw');
    if (!ok) return;
    const res = await getMemberLeagueService().withdrawRegistration(uid, o.year);
    if (!res.success) { showToast('error', resultMessage(res)); return; }
    showToast('success', 'Request withdrawn.');
    await this._load();
  }

  private async _link(): Promise<void> {
    const uid = this._uid;
    const o = this._overview;
    if (!uid || !o) return;
    const saved = await openShooterLinkDialog({
      uid,
      existing: o.linkRequest,
      defaultName: getAccountContext().gate.profile?.displayName ?? '',
    });
    if (saved) {
      showToast('success', 'Request sent. The coordinator will confirm your scorecard name.');
      await this._load();
    }
  }

  private async _withdrawLink(): Promise<void> {
    const uid = this._uid;
    if (!uid) return;
    const ok = await confirmLeague('Withdraw your link request?', 'You can send a new one any time.', 'Withdraw');
    if (!ok) return;
    const res = await getMemberLeagueService().withdrawLinkRequest(uid);
    if (!res.success) { showToast('error', resultMessage(res)); return; }
    showToast('success', 'Link request withdrawn.');
    await this._load();
  }
}

if (!customElements.get('account-league')) {
  customElements.define('account-league', AccountLeague);
}
