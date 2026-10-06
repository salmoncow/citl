/**
 * <join-page> — the #/join route (spec 012).
 *
 * The "Join the league" entry point. Modes follow the account gate, like
 * <account-page>, but every step stays on this page:
 *   disabled    league requests off: the email-the-coordinator copy
 *   signed-out  summary, sign-in options, email fallback (AC-3); starting
 *               sign-in records the join intent (AC-4)
 *   loading     .skeleton placeholder
 *   error       profile or league read failed, with Try again (AC-8)
 *   reactivate  link to /account
 *   complete    first-sign-in profile form (AC-5)
 *   terms       terms re-acceptance (AC-5)
 *   ready       join flow (AC-6) or request status (AC-7)
 *
 * Reuses the /account dialogs for the join request and the scorecard name
 * link. Focus moves to the <h1> whenever the mode changes.
 */

import '@/styles/account.css';
import '@/components/sign-in-dialog';
import '@/components/account-profile-form';
import { escapeHtml, showToast } from '@/modules/ui';
import { getAccountContext } from '@/modules/account-context';
import { getServices } from '@/services/app-services';
import { getMemberLeagueService, resultMessage, type LeagueOverview } from '@/services/member-league-service';
import { registrationYear } from '@/services/league-validation';
import type { LeagueTeam } from '@/types/league';
import { LINK_LABEL, PROPOSAL_LABEL, REGISTRATION_LABEL } from '@/components/league-labels';
import { openRegistrationDialog } from '@/components/registration-form';
import { openShooterLinkDialog } from '@/components/shooter-link-form';
import { leagueRequestsEnabled } from '@/utils/features';
import { clearJoinIntent, markJoinIntent } from '@/utils/join-intent';
import { LEAGUE_EMAIL, leagueMailto } from '@/utils/contact';

type PageMode = 'disabled' | 'signed-out' | 'loading' | 'error' | 'reactivate' | 'complete' | 'terms' | 'ready';
type ShotBefore = 'yes' | 'no' | null;

const EMAIL_COORDINATOR = `Email the League Coordinator at
  <a href="${leagueMailto('CITL enrollment')}">${LEAGUE_EMAIL}</a> as an individual or a pre-formed team.`;

class JoinPage extends HTMLElement {
  private _mode: PageMode | null = null;
  private _unsub: (() => void) | null = null;
  private _overview: LeagueOverview | null = null;
  private _overviewState: 'loading' | 'error' | 'ready' = 'loading';
  private _teams: LeagueTeam[] | null = null;
  private _shotBefore: ShotBefore = null;
  private _loadSeq = 0;

  connectedCallback(): void {
    if (!leagueRequestsEnabled) {
      this._setMode('disabled');
      return;
    }
    this._unsub = getAccountContext().gate.onUpdate(() => this._update());
    this._update();
  }

  disconnectedCallback(): void {
    this._unsub?.();
    this._unsub = null;
  }

  private get _uid(): string | null {
    return getAccountContext().auth.currentUser?.uid ?? null;
  }

  private _computeMode(): PageMode {
    const { gate } = getAccountContext();
    if (!gate.userDoc.uid) return 'signed-out';
    if (gate.decision === 'reactivate') return 'reactivate';
    if (gate.profileState === 'error') return 'error';
    if (gate.profileState !== 'ready') return 'loading';
    if (gate.decision === 'complete-profile') return 'complete';
    if (gate.decision === 'accept-terms') return 'terms';
    return 'ready';
  }

  private _update(): void {
    const mode = this._computeMode();
    if (mode === this._mode) return;
    if (mode === 'ready') {
      clearJoinIntent();
      this._overviewState = 'loading';
      void this._load();
    }
    this._setMode(mode);
  }

  private _setMode(mode: PageMode): void {
    this._mode = mode;
    this._render();
    if (mode !== 'loading') this.querySelector<HTMLElement>('h1')?.focus();
  }

  private async _load(): Promise<void> {
    const uid = this._uid;
    if (!uid) return;
    const seq = ++this._loadSeq;
    const seasons = await getServices().scoreService.getAllSeasons();
    const year = registrationYear(seasons.success ? seasons.data : []);
    const res = await getMemberLeagueService().loadOverview(uid, year);
    if (!this.isConnected || seq !== this._loadSeq) return;
    if (!res.success) {
      this._overviewState = 'error';
      this._render();
      return;
    }
    this._overview = res.data;
    if (res.data.registration?.placedLeagueTeamId) await this._loadTeams();
    if (seq !== this._loadSeq) return;
    if (res.data.linkRequest?.status === 'approved') this._shotBefore = 'yes';
    this._overviewState = 'ready';
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

  // ─── Render ─────────────────────────────────────────────────────────────────

  private _render(): void {
    const head = (title: string, lede: string) => `
      <span class="eyebrow">Join the league</span>
      <h1 tabindex="-1">${title}</h1>
      ${lede ? `<p class="account-page__lede">${lede}</p>` : ''}`;
    const skeleton = `
      <div class="card account-section" aria-busy="true" aria-label="Loading">
        <div class="skeleton-group account-skeleton">
          <span class="skeleton skeleton--lg" data-w="40"></span>
          <span class="skeleton skeleton--md" data-w="90"></span>
          <span class="skeleton skeleton--md" data-w="75"></span>
        </div>
      </div>`;
    const error = `
      <div class="account-error" role="alert">
        <p>We couldn’t load your details. Check your connection and try again.</p>
        <button type="button" class="btn-secondary" data-action="retry">Try again</button>
      </div>`;

    let html: string;
    switch (this._mode) {
      case 'disabled':
        html = `${head('Join the league', '')}
          <section class="card account-section"><p>${EMAIL_COORDINATOR}</p></section>`;
        break;
      case 'signed-out':
        html = `${head('Join the league', 'Free to join. We shoot Tuesday evenings at Darnall’s Gun Works west of Bloomington; the range sets a per-day fee each year.')}
          <section class="card account-section" aria-labelledby="join-signin" data-join-signin>
            <h2 id="join-signin">Create your account or sign in</h2>
            <p class="account-section__desc">The name on your account is the name we put on team rosters.</p>
            <sign-in-options></sign-in-options>
          </section>
          <p class="account-section__desc">Rather not make an account? ${EMAIL_COORDINATOR}</p>`;
        break;
      case 'reactivate':
        html = `${head('Your account is deactivated', 'Reactivate it on your account page to join the league.')}
          <p><a class="btn-primary" href="#/account">Go to your account</a></p>`;
        break;
      case 'complete':
        html = `${head('Set up your account', 'Use your name as the league knows you. It’s the name we put on team rosters.')}
          <section class="card account-section"><account-profile-form mode="complete"></account-profile-form></section>`;
        break;
      case 'terms':
        html = `${head('Updated terms', 'Please review and accept the updated Terms of Use and Privacy Policy to continue.')}
          <section class="card account-section"><account-profile-form mode="accept-terms"></account-profile-form></section>`;
        break;
      case 'error':
        html = `${head('Join the league', '')}${error}`;
        break;
      case 'ready':
        html = this._overviewState === 'loading'
          ? `${head('Join the league', '')}${skeleton}`
          : this._overviewState === 'error' || !this._overview
            ? `${head('Join the league', '')}${error}`
            : this._readyHtml(this._overview, head);
        break;
      default:
        html = `${head('Join the league', '')}${skeleton}`;
    }

    this.innerHTML = `<div class="account-page">${html}</div>`;
    this._wire();
  }

  private _readyHtml(o: LeagueOverview, head: (t: string, l: string) => string): string {
    const manage = '<p><a class="btn-secondary" href="#/account">Manage on your account page</a></p>';
    if (o.proposal) {
      const p = o.proposal;
      return `${head(`You’re in for ${o.year}`, `You proposed a team for the ${o.year} season.`)}
        <section class="card account-section">
          <dl class="league-facts">
            <div><dt>Team</dt><dd>${escapeHtml(p.teamName)}</dd></div>
            <div><dt>Status</dt><dd>${PROPOSAL_LABEL[p.status]}</dd></div>
          </dl>
          <p><a class="btn-secondary" href="#/account/team">View your team proposal</a></p>
        </section>`;
    }
    if (o.registration) {
      const r = o.registration;
      const placed = r.placedLeagueTeamId
        ? this._teams?.find((t) => t.id === r.placedLeagueTeamId)?.name ?? r.placedLeagueTeamId
        : null;
      return `${head(`Your ${o.year} season`, `You asked to join a team for the ${o.year} season.`)}
        <section class="card account-section">
          <dl class="league-facts">
            <div><dt>Status</dt><dd>${REGISTRATION_LABEL[r.status]}</dd></div>
            ${placed ? `<div><dt>Team</dt><dd>${escapeHtml(placed)}</dd></div>` : ''}
          </dl>
          ${r.reviewNote ? `<p class="account-notice">Coordinator’s note: ${escapeHtml(r.reviewNote)}</p>` : ''}
          ${manage}
        </section>`;
    }

    const yes = this._shotBefore === 'yes';
    const no = this._shotBefore === 'no';
    const question = o.linkRequest?.status === 'approved' ? '' : `
      <fieldset class="league-fieldset">
        <legend class="account-field__label">Have you shot in CITL before?</legend>
        <label class="account-check"><input type="radio" name="shot-before" value="yes" ${yes ? 'checked' : ''}><span>Yes</span></label>
        <label class="account-check"><input type="radio" name="shot-before" value="no" ${no ? 'checked' : ''}><span>No, I’m new</span></label>
      </fieldset>`;
    const step = yes ? this._returningHtml(o) : no ? this._newHtml() : '';
    const send = yes || no ? `
      <div class="account-form__actions">
        <button type="button" class="btn-primary" data-action="join">Send join request</button>
      </div>` : '';
    return `${head(`Join the ${o.year} season`, 'Ask the coordinator to place you on a team. Requests are open all season.')}
      <section class="card account-section" aria-labelledby="join-step">
        <h2 id="join-step" tabindex="-1">Your roster name</h2>
        ${question}
        <div aria-live="polite">${step}</div>
        ${send}
      </section>
      <p class="account-section__desc">Starting a team as its captain? <a href="#/account/team">Propose a team</a> instead.</p>`;
  }

  private _returningHtml(o: LeagueOverview): string {
    const r = o.linkRequest;
    if (!r) {
      return `
        <p class="account-section__desc">Pick your name from past scorecards so your scores stay together. The
        coordinator confirms it. You can send your join request now or after.</p>
        <div class="account-form__actions">
          <button type="button" class="btn-secondary" data-action="link">Find my scorecard name</button>
        </div>`;
    }
    if (r.status === 'approved') {
      return `<p>You’ll appear on rosters as <strong>${escapeHtml(o.linkedName ?? r.shooterName)}</strong>.</p>`;
    }
    return `
      <dl class="league-facts">
        <div><dt>Scorecard name</dt><dd>${escapeHtml(r.shooterName)}</dd></div>
        <div><dt>Status</dt><dd>${LINK_LABEL[r.status]}</dd></div>
      </dl>
      ${r.reviewNote ? `<p class="account-notice">Coordinator’s note: ${escapeHtml(r.reviewNote)}</p>` : ''}
      ${r.status === 'declined' ? `
      <div class="account-form__actions">
        <button type="button" class="btn-secondary" data-action="link">Try again</button>
      </div>` : ''}`;
  }

  private _newHtml(): string {
    const name = getAccountContext().gate.profile?.displayName ?? '';
    return `<p>You’ll appear on rosters as <strong>${escapeHtml(name)}</strong>.
      <a href="#/account">Change your name</a></p>`;
  }

  private _wire(): void {
    const signIn = this.querySelector('[data-join-signin]');
    // Starting any sign-in here (provider button or email form) records the intent (AC-4).
    signIn?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) markJoinIntent();
    }, true);
    signIn?.addEventListener('submit', () => markJoinIntent(), true);

    this.querySelector('[data-action="retry"]')?.addEventListener('click', () => {
      if (this._mode === 'ready') {
        this._overviewState = 'loading';
        this._render();
        void this._load();
      } else {
        void getAccountContext().gate.refresh();
      }
    });
    this.querySelectorAll<HTMLInputElement>('input[name="shot-before"]').forEach((input) => {
      input.addEventListener('change', () => {
        this._shotBefore = input.value === 'yes' ? 'yes' : 'no';
        this._render();
        this.querySelector<HTMLInputElement>(`input[name="shot-before"][value="${this._shotBefore}"]`)?.focus();
      });
    });
    this.querySelector('[data-action="join"]')?.addEventListener('click', () => void this._join());
    this.querySelector('[data-action="link"]')?.addEventListener('click', () => void this._link());
  }

  // ─── Actions ────────────────────────────────────────────────────────────────

  private async _join(): Promise<void> {
    const uid = this._uid;
    const o = this._overview;
    if (!uid || !o) return;
    const teams = await this._loadTeams();
    if (!teams) return;
    const saved = await openRegistrationDialog({
      uid, year: o.year, existing: null, dependents: o.dependents, leagueTeams: teams,
    });
    if (saved) {
      showToast('success', 'Request sent. The coordinator will place you on a team.');
      await this._reload();
    }
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
      await this._reload();
    }
  }

  private async _reload(): Promise<void> {
    await this._load();
    this.querySelector<HTMLElement>('h1')?.focus();
  }
}

if (!customElements.get('join-page')) {
  customElements.define('join-page', JoinPage);
}
