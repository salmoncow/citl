/**
 * Sign-in UI (spec 008 F1/F2, AC-1, AC-3, AC-5, AC-6, AC-24).
 *
 * <sign-in-options> renders the provider buttons, the email-link form,
 * the "check your email" state and the account-exists guidance. It is
 * used inside the modal dialog opened from the nav and /admin, and inline
 * on /account when signed out.
 *
 * openSignInDialog() shows it in a native <dialog> (showModal: focus
 * trap and Escape-to-close), labelled by its heading, and returns focus
 * to the trigger on close.
 *
 * Loaded with a dynamic import (AC-9). Provider work goes through
 * modules/auth-providers; this file never imports firebase/*.
 */

import '@/styles/account.css';
import { escapeHtml, showToast } from '@/modules/ui';
import {
  PROVIDER_LABELS,
  completeEmailLink,
  enabledProviders,
  pendingLinkEmail,
  sendEmailLink,
  signInWith,
  type AuthOutcome,
  type PopupProviderKey,
} from '@/modules/auth-providers';

const GOOGLE_MARK = `<svg class="signin__mark" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M21.35 11.1H12v2.9h5.35c-.25 1.45-1.65 4.25-5.35 4.25-3.2 0-5.85-2.65-5.85-5.95S8.8 6.35 12 6.35c1.85 0 3.05.8 3.75 1.45l2.55-2.45C16.7 3.85 14.55 2.9 12 2.9 6.95 2.9 2.9 6.95 2.9 12s4.05 9.1 9.1 9.1c5.25 0 8.75-3.7 8.75-8.9 0-.6-.05-1.05-.15-1.5z"/></svg>`;
const MICROSOFT_MARK = `<svg class="signin__mark" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 3h8.5v8.5H3zM12.5 3H21v8.5h-8.5zM3 12.5h8.5V21H3zM12.5 12.5H21V21h-8.5z"/></svg>`;
const MARKS: Record<PopupProviderKey, string> = { google: GOOGLE_MARK, microsoft: MICROSOFT_MARK };

let idCounter = 0;

export type SignInMode = 'sign-in' | 'confirm-email';

/**
 * Provider buttons + email form. Dispatches `signin-done` (bubbles) with
 * the AuthOutcome when sign-in finishes, so a host dialog can close.
 */
class SignInOptions extends HTMLElement {
  private _busy = false;
  private _uid = `signin-${++idCounter}`;
  /** For confirm-email mode: the email-link URL captured at boot. */
  linkUrl: string | null = null;

  connectedCallback(): void {
    this._render();
  }

  get mode(): SignInMode {
    return this.getAttribute('mode') === 'confirm-email' ? 'confirm-email' : 'sign-in';
  }

  private _render(): void {
    const id = this._uid;
    const providers = enabledProviders();
    const popupKeys = providers.filter((k): k is PopupProviderKey => k !== 'email');
    const emailEnabled = providers.includes('email') || this.mode === 'confirm-email';

    const buttons = this.mode === 'sign-in'
      ? popupKeys.map((k) => `
          <button type="button" class="btn-secondary signin__provider" data-provider="${k}">
            ${MARKS[k]}<span>Continue with ${PROVIDER_LABELS[k]}</span>
          </button>`).join('')
      : '';

    const divider = buttons && emailEnabled ? '<p class="signin__divider"><span>or</span></p>' : '';

    const submitLabel = this.mode === 'confirm-email' ? 'Finish signing in' : 'Email me a sign-in link';
    const lede = this.mode === 'confirm-email'
      ? 'You opened the sign-in link on a different device or browser. Enter the email address you used to request it.'
      : '';

    const form = emailEnabled ? `
      <form class="signin__email" novalidate>
        ${lede ? `<p class="signin__lede">${lede}</p>` : ''}
        <label class="signin__label" for="${id}-email">Email address</label>
        <input id="${id}-email" class="signin__input" type="email" name="email"
               autocomplete="email" inputmode="email" required aria-describedby="${id}-email-error">
        <p id="${id}-email-error" class="signin__field-error" hidden></p>
        <button type="submit" class="btn-primary signin__submit">${submitLabel}</button>
      </form>` : '';

    this.innerHTML = `
      <div class="signin__alert" role="alert" hidden></div>
      <div class="signin__providers">${buttons}</div>
      ${divider}
      ${form}
      <div class="signin__status" aria-live="polite"></div>
    `;

    this.querySelectorAll<HTMLButtonElement>('[data-provider]').forEach((btn) => {
      btn.addEventListener('click', () => void this._popup(btn.dataset['provider'] as PopupProviderKey));
    });
    this.querySelector('form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      void this._email();
    });

    // Account-exists guidance survives a re-render (e.g. dialog reopened).
    const pendingEmail = pendingLinkEmail();
    if (pendingEmail !== null && this.mode === 'sign-in') this._showAccountExists(pendingEmail);
  }

  private _setBusy(busy: boolean): void {
    this._busy = busy;
    this.querySelectorAll<HTMLButtonElement>('button').forEach((b) => { b.disabled = busy; });
    this.setAttribute('aria-busy', String(busy));
  }

  private _alert(message: string | null, html = false): void {
    const el = this.querySelector<HTMLElement>('.signin__alert');
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    if (html) el.innerHTML = message;
    else el.textContent = message;
    el.hidden = false;
  }

  private _fieldError(message: string | null): void {
    const el = this.querySelector<HTMLElement>('.signin__field-error');
    const input = this.querySelector<HTMLInputElement>('.signin__input');
    if (!el || !input) return;
    el.textContent = message ?? '';
    el.hidden = !message;
    input.setAttribute('aria-invalid', String(!!message));
    if (message) input.focus();
  }

  private _showAccountExists(email: string | null): void {
    const who = email ? ` for <strong>${escapeHtml(email)}</strong>` : '';
    this._alert(
      `An account already exists${who}. Sign in with a method you used before, and we’ll connect the new one to it. `
      + 'If you use an email link, keep this tab open while you open the link.',
      true,
    );
    const input = this.querySelector<HTMLInputElement>('.signin__input');
    if (input && email && !input.value) input.value = email;
  }

  private async _popup(key: PopupProviderKey): Promise<void> {
    if (this._busy) return;
    this._alert(null);
    this._setBusy(true);
    const outcome = await signInWith(key);
    this._setBusy(false);
    this._handle(outcome);
  }

  private async _email(): Promise<void> {
    if (this._busy) return;
    const input = this.querySelector<HTMLInputElement>('.signin__input');
    const email = input?.value.trim() ?? '';
    if (!email || !input?.checkValidity()) {
      this._fieldError('Enter a valid email address.');
      return;
    }
    this._fieldError(null);
    this._alert(null);
    this._setBusy(true);
    const outcome = this.mode === 'confirm-email' && this.linkUrl
      ? await completeEmailLink(this.linkUrl, email)
      : await sendEmailLink(email, 'sign-in');
    this._setBusy(false);
    this._handle(outcome);
  }

  private _handle(outcome: AuthOutcome): void {
    switch (outcome.status) {
      case 'cancelled':
        return;
      case 'account-exists':
        this._showAccountExists(outcome.email);
        return;
      case 'email-sent': {
        const status = this.querySelector<HTMLElement>('.signin__status');
        const form = this.querySelector<HTMLElement>('.signin__email');
        if (form) form.hidden = true;
        if (status) {
          status.innerHTML = `
            <h3 class="signin__status-title">Check your email</h3>
            <p>We sent a sign-in link to <strong>${escapeHtml(outcome.email)}</strong>.
               Open it on this device to finish signing in. It may take a minute to arrive; check your spam folder too.</p>`;
        }
        return;
      }
      case 'error':
        if (outcome.code === 'auth/invalid-email') this._fieldError(outcome.message);
        else this._alert(outcome.message);
        return;
      case 'needs-email':
        this._alert('Enter the email address you used to request the link.');
        return;
      default:
        this.dispatchEvent(new CustomEvent('signin-done', { bubbles: true, detail: outcome }));
    }
  }
}

if (!customElements.get('sign-in-options')) {
  customElements.define('sign-in-options', SignInOptions);
}

// ─── Modal dialog ───────────────────────────────────────────────────────────

let openDialog: HTMLDialogElement | null = null;

export interface OpenSignInOptions {
  mode?: SignInMode;
  /** Email-link URL for confirm-email mode. */
  linkUrl?: string;
}

/**
 * Open the modal sign-in dialog. Resolves with the outcome when the user
 * signs in, or null when they close it.
 */
export function openSignInDialog(opts: OpenSignInOptions = {}): Promise<AuthOutcome | null> {
  openDialog?.close();
  const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const mode = opts.mode ?? 'sign-in';
  const titleId = `signin-title-${++idCounter}`;

  const dialog = document.createElement('dialog');
  dialog.className = 'signin-dialog';
  dialog.setAttribute('aria-labelledby', titleId);
  dialog.innerHTML = `
    <div class="signin-dialog__head">
      <h2 id="${titleId}" class="signin-dialog__title">${mode === 'confirm-email' ? 'Finish signing in' : 'Sign in'}</h2>
      <button type="button" class="signin-dialog__close" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
    ${mode === 'sign-in' ? '<p class="signin-dialog__intro">Use an account you already have. Signing in for the first time creates your CITL account.</p>' : ''}
  `;
  const options = document.createElement('sign-in-options') as SignInOptions;
  options.setAttribute('mode', mode);
  options.linkUrl = opts.linkUrl ?? null;
  dialog.appendChild(options);
  const note = document.createElement('p');
  note.className = 'signin-dialog__legal';
  note.innerHTML = 'By signing in you agree to the <a href="#/privacy">Terms of Use and Privacy Policy</a>.';
  dialog.appendChild(note);

  return new Promise((resolve) => {
    let result: AuthOutcome | null = null;
    dialog.addEventListener('signin-done', (e) => {
      result = (e as CustomEvent<AuthOutcome>).detail;
      if (result.status === 'signed-in') showToast('success', 'Signed in.');
      dialog.close();
    });
    dialog.querySelector('.signin-dialog__close')?.addEventListener('click', () => dialog.close());
    dialog.querySelector('.signin-dialog__legal a')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (openDialog === dialog) openDialog = null;
      if (trigger?.isConnected) trigger.focus();
      resolve(result);
    });
    document.body.appendChild(dialog);
    openDialog = dialog;
    dialog.showModal();
    const first = mode === 'confirm-email'
      ? dialog.querySelector<HTMLElement>('.signin__input')
      : dialog.querySelector<HTMLElement>('[data-provider], .signin__input');
    first?.focus();
  });
}
