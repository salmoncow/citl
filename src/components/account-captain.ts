/**
 * <account-captain> — captaincy on /account (spec 010 F14, AC-19).
 *
 * Renders up to two cards, and nothing when neither applies:
 *   - Captain nomination: someone nominated this member to captain their
 *     team; accept or decline. Accepting waits for the coordinator.
 *   - Captain of {team}: the member's team, the open (or last) handoff
 *     and its status, and a form to nominate a successor by email.
 *
 * Loads its own data (three single-field queries) and calls the
 * captainHandoff callable through MemberLeagueService.
 */

import { escapeHtml, showToast } from '@/modules/ui';
import { getAccountContext } from '@/modules/account-context';
import {
  getMemberLeagueService,
  leagueErrorMessage,
  resultMessage,
  type CaptaincyOverview,
} from '@/services/member-league-service';
import type { CaptainChange } from '@/types/league';
import { confirmLeague } from '@/components/league-dialog';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function outgoingStatus(c: CaptainChange): string {
  const to = escapeHtml(c.toName);
  switch (c.status) {
    case 'nominated': return `You nominated ${to}. Waiting for them to accept.`;
    case 'accepted': return `${to} accepted. Waiting for the coordinator to approve.`;
    case 'declined': return `${to} declined your nomination.`;
    case 'rejected': return `The coordinator didn’t approve handing the team to ${to}.`;
    case 'cancelled': return `Your nomination of ${to} was cancelled.`;
    case 'approved': return '';
  }
}

class AccountCaptain extends HTMLElement {
  private _data: CaptaincyOverview | null = null;
  private _busy = false;

  connectedCallback(): void {
    void this._load();
  }

  private get _uid(): string | null {
    return getAccountContext().auth.currentUser?.uid ?? null;
  }

  private async _load(): Promise<void> {
    const uid = this._uid;
    if (!uid) return;
    const res = await getMemberLeagueService().loadCaptaincy(uid);
    if (!this.isConnected) return;
    if (!res.success) {
      // Captaincy is secondary on this page; the League cards still work.
      console.warn('account-captain: could not load captaincy:', resultMessage(res));
      this.innerHTML = '';
      return;
    }
    this._data = res.data;
    this._render();
  }

  private _render(): void {
    const d = this._data;
    if (!d) return;
    const nominations = d.incoming.map((c, i) => `
      <section class="card account-section" aria-labelledby="cap-nom-${i}">
        <h2 id="cap-nom-${i}" tabindex="-1">Captain nomination</h2>
        <p class="account-section__desc">${escapeHtml(c.fromName)} nominated you to captain
          <strong>${escapeHtml(c.teamName)}</strong>.
          ${c.status === 'accepted' ? 'You accepted. The coordinator will confirm the change.' : 'The coordinator confirms the change after you accept.'}</p>
        ${c.status === 'nominated' ? `
        <div class="account-form__actions">
          <button type="button" class="btn-primary" data-act="accept" data-team="${escapeHtml(c.leagueTeamId)}">Accept</button>
          <button type="button" class="btn-secondary" data-act="decline" data-team="${escapeHtml(c.leagueTeamId)}">Decline</button>
        </div>` : ''}
      </section>`).join('');

    let captain = '';
    if (d.team) {
      const out = d.outgoing;
      const open = out && (out.status === 'nominated' || out.status === 'accepted');
      const status = out ? outgoingStatus(out) : '';
      captain = `
        <section class="card account-section" aria-labelledby="cap-team">
          <h2 id="cap-team" tabindex="-1">Captain of ${escapeHtml(d.team.name)}</h2>
          <p class="account-section__desc">You can hand the team to another member. They accept, then the
          coordinator approves. You stay captain until then.</p>
          ${status ? `<p class="account-notice">${status}</p>` : ''}
          ${open ? `
          <div class="account-form__actions">
            <button type="button" class="btn-secondary" data-act="cancel" data-team="${escapeHtml(d.team.id)}">Cancel nomination</button>
          </div>` : `
          <form class="account-form" data-nominate novalidate>
            <div class="account-field">
              <label class="account-field__label" for="cap-email">New captain’s account email</label>
              <input id="cap-email" class="account-field__input" type="email" autocomplete="off" maxlength="254"
                     aria-describedby="cap-email-hint cap-email-error" required>
              <p id="cap-email-hint" class="account-field__hint">They need a member account on citl.club.</p>
              <p id="cap-email-error" class="account-field__error" role="alert" hidden></p>
            </div>
            <div class="account-form__actions">
              <button type="submit" class="btn-secondary">Nominate</button>
            </div>
          </form>`}
        </section>`;
    }

    this.innerHTML = nominations + captain;
    this.querySelectorAll<HTMLButtonElement>('button[data-act]').forEach((b) => {
      b.addEventListener('click', () => void this._respond(b.dataset['act'] ?? '', b.dataset['team'] ?? ''));
    });
    this.querySelector<HTMLFormElement>('[data-nominate]')?.addEventListener('submit', (e) => {
      e.preventDefault();
      void this._nominate();
    });
  }

  private async _respond(act: string, leagueTeamId: string): Promise<void> {
    if (this._busy || !leagueTeamId) return;
    if (act === 'decline' || act === 'cancel') {
      const ok = act === 'cancel'
        ? await confirmLeague('Cancel the nomination?', 'You stay captain. You can nominate someone again later.', 'Cancel nomination')
        : await confirmLeague('Decline the nomination?', 'The current captain stays captain.', 'Decline');
      if (!ok) return;
    }
    if (act !== 'accept' && act !== 'decline' && act !== 'cancel') return;
    this._busy = true;
    const res = await getMemberLeagueService().handoff({ action: act, leagueTeamId });
    this._busy = false;
    if (!res.ok) { showToast('error', leagueErrorMessage(res.code, res.reason, res.message)); return; }
    showToast('success', act === 'accept' ? 'Accepted. The coordinator will confirm.' : act === 'cancel' ? 'Nomination cancelled.' : 'Nomination declined.');
    await this._load();
    this.querySelector<HTMLElement>('h2')?.focus();
  }

  private async _nominate(): Promise<void> {
    const team = this._data?.team;
    const input = this.querySelector<HTMLInputElement>('#cap-email');
    const error = this.querySelector<HTMLElement>('#cap-email-error');
    if (!team || !input || !error || this._busy) return;
    const email = input.value.trim();
    const show = (msg: string) => {
      error.textContent = msg;
      error.hidden = !msg;
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (msg) input.focus();
    };
    if (!EMAIL_PATTERN.test(email)) { show('Enter an email address.'); return; }
    show('');
    this._busy = true;
    const res = await getMemberLeagueService().handoff({ action: 'nominate', leagueTeamId: team.id, email });
    this._busy = false;
    if (!res.ok) { show(leagueErrorMessage(res.code, res.reason, res.message)); return; }
    showToast('success', `Nominated ${res.toName ?? 'them'}. They’ll see it on their account page.`);
    await this._load();
    this.querySelector<HTMLElement>('#cap-team')?.focus();
  }
}

if (!customElements.get('account-captain')) {
  customElements.define('account-captain', AccountCaptain);
}
