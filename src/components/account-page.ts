/**
 * <account-page> — the /account route (spec 008 F3, AC-8, AC-10,
 * AC-12, AC-15, AC-24).
 *
 * Modes, from the account gate's state:
 *   signed-out  sign-in options inline
 *   loading     .skeleton placeholder
 *   error       profile read failed, with Try again
 *   reactivate  only Reactivate and Sign out (deactivated account)
 *   complete    first-sign-in profile form (terms + 18+)
 *   terms       terms re-acceptance
 *   normal      Profile, Sign-in methods, Account sections
 *
 * Shares the gate's single profile read and AuthModule's users/{uid}
 * listener (AC-23). Focus moves to the <h1> whenever the mode changes.
 * Subscriptions are torn down in disconnectedCallback.
 */

import '@/styles/account.css';
import '@/components/sign-in-dialog';
import '@/components/account-profile-form';
import '@/components/account-providers';
import '@/components/account-danger-zone';
import { escapeHtml, showToast } from '@/modules/ui';
import { getAccountContext } from '@/modules/account-context';
import { accountErrorMessage, getAccountService } from '@/services/account-service';

type PageMode = 'signed-out' | 'loading' | 'error' | 'reactivate' | 'complete' | 'terms' | 'normal';

class AccountPage extends HTMLElement {
  private _mode: PageMode | null = null;
  private _unsub: (() => void) | null = null;

  connectedCallback(): void {
    const { gate } = getAccountContext();
    this._unsub = gate.onUpdate(() => this._update());
    this._update();
  }

  disconnectedCallback(): void {
    this._unsub?.();
    this._unsub = null;
  }

  private _computeMode(): PageMode {
    const { gate } = getAccountContext();
    const { uid } = gate.userDoc;
    if (!uid) return 'signed-out';
    if (gate.decision === 'reactivate') return 'reactivate';
    if (gate.profileState === 'error') return 'error';
    if (gate.profileState !== 'ready') return 'loading';
    if (gate.decision === 'complete-profile') return 'complete';
    if (gate.decision === 'accept-terms') return 'terms';
    return 'normal';
  }

  private _update(): void {
    const mode = this._computeMode();
    if (mode === this._mode) return;
    this._mode = mode;
    this._render(mode);
    if (mode !== 'loading') {
      this.querySelector<HTMLElement>('h1')?.focus();
    }
  }

  private _render(mode: PageMode): void {
    const head = (eyebrow: string, title: string, lede: string) => `
      <span class="eyebrow">${eyebrow}</span>
      <h1 tabindex="-1">${title}</h1>
      <p class="account-page__lede">${lede}</p>`;

    let html: string;
    switch (mode) {
      case 'signed-out':
        html = `
          ${head('Account', 'Sign in', 'Sign in or create your CITL account. Standings and scorecards stay public; an account is optional.')}
          <section class="card account-section"><sign-in-options></sign-in-options></section>`;
        break;
      case 'loading':
        html = `
          <span class="eyebrow">Account</span>
          <h1 tabindex="-1">Your account</h1>
          <div class="card account-section" aria-busy="true" aria-label="Loading your account">
            <div class="skeleton-group account-skeleton">
              <span class="skeleton skeleton--lg" data-w="40"></span>
              <span class="skeleton skeleton--md" data-w="90"></span>
              <span class="skeleton skeleton--md" data-w="75"></span>
              <span class="skeleton skeleton--xl" data-w="100"></span>
            </div>
          </div>`;
        break;
      case 'error':
        html = `
          ${head('Account', 'Your account', '')}
          <div class="account-error" role="alert">
            <p>We couldn’t load your profile. Check your connection and try again.</p>
            <button type="button" class="btn-secondary" data-action="retry">Try again</button>
          </div>`;
        break;
      case 'reactivate':
        html = `
          ${head('Account', 'Your account is deactivated', 'Reactivate it to use your account again, or sign out.')}
          <section class="card account-section">
            <div class="account-form__actions">
              <button type="button" class="btn-primary" data-action="reactivate">Reactivate account</button>
              <button type="button" class="btn-secondary" data-action="sign-out">Sign out</button>
            </div>
          </section>`;
        break;
      case 'complete':
        html = `
          ${head('Welcome', 'Finish setting up your account', 'Tell us your name and accept the terms to start using your account.')}
          <section class="card account-section">
            <account-profile-form mode="complete"></account-profile-form>
          </section>
          ${this._signOutRow()}`;
        break;
      case 'terms':
        html = `
          ${head('Account', 'Updated terms', 'We’ve updated the Terms of Use and Privacy Policy. Please review and accept them to continue.')}
          <section class="card account-section">
            <account-profile-form mode="accept-terms"></account-profile-form>
          </section>
          ${this._signOutRow()}`;
        break;
      default: {
        const name = getAccountContext().gate.profile?.displayName ?? '';
        html = `
          ${head('Account', 'Your account', name ? `Signed in as ${escapeHtml(name)}.` : '')}
          <section class="card account-section" aria-labelledby="acct-profile">
            <h2 id="acct-profile">Profile</h2>
            <p class="account-section__desc">Your name and phone are visible only to you and league admins.</p>
            <account-profile-form mode="edit"></account-profile-form>
          </section>
          <section class="card account-section" aria-labelledby="acct-methods">
            <h2 id="acct-methods">Sign-in methods</h2>
            <p class="account-section__desc">Connect more than one so you can always get in.</p>
            <account-providers></account-providers>
          </section>
          <section class="card account-section account-danger" aria-labelledby="acct-account">
            <h2 id="acct-account">Account</h2>
            <account-danger-zone></account-danger-zone>
          </section>`;
      }
    }

    this.innerHTML = `<div class="account-page">${html}</div>`;
    this.querySelector('[data-action="retry"]')?.addEventListener('click', () => void getAccountContext().gate.refresh());
    this.querySelector('[data-action="reactivate"]')?.addEventListener('click', (e) => void this._reactivate(e.currentTarget as HTMLButtonElement));
    this.querySelectorAll('[data-action="sign-out"]').forEach((btn) => {
      btn.addEventListener('click', () => void this._signOut());
    });
  }

  private _signOutRow(): string {
    return `<p><button type="button" class="btn-secondary" data-action="sign-out">Sign out</button></p>`;
  }

  private async _reactivate(btn: HTMLButtonElement): Promise<void> {
    btn.disabled = true;
    const res = await getAccountService().setAccountStatus('active');
    btn.disabled = false;
    if (!res.ok) {
      showToast('error', accountErrorMessage(res.code, res.reason));
      return;
    }
    // The users/{uid} snapshot flips the gate; the page re-renders.
    showToast('success', 'Welcome back. Your account is active again.');
  }

  private async _signOut(): Promise<void> {
    await getAccountContext().auth.signOut();
    showToast('info', 'Signed out.');
  }
}

if (!customElements.get('account-page')) {
  customElements.define('account-page', AccountPage);
}
