/**
 * <account-profile-form> — profile form (spec 008 AC-11, AC-12, AC-24).
 *
 * mode="complete"     first sign-in: name, phone, terms and 18+ boxes.
 *                     Submit stays disabled until the users/{uid} mirror
 *                     exists (onUserCreate is async; rules require it).
 * mode="edit"         name and phone.
 * mode="accept-terms" terms re-acceptance after a TERMS_VERSION bump.
 *
 * Dispatches `profile-saved` (bubbles) after a successful write and asks
 * the account gate to re-read the profile.
 */

import { escapeHtml, showToast } from '@/modules/ui';
import { getAccountContext } from '@/modules/account-context';
import { accountErrorMessage, getAccountService } from '@/services/account-service';
import {
  DISPLAY_NAME_MAX,
  PHONE_MAX,
  validateProfileInput,
  type ProfileFieldErrors,
} from '@/services/profile-validation';

type FormMode = 'complete' | 'edit' | 'accept-terms';

let idCounter = 0;

class AccountProfileForm extends HTMLElement {
  private _id = `pf-${++idCounter}`;
  private _busy = false;
  private _mirrorReady = false;
  private _unsub: (() => void) | null = null;

  get mode(): FormMode {
    const m = this.getAttribute('mode');
    return m === 'complete' || m === 'accept-terms' ? m : 'edit';
  }

  connectedCallback(): void {
    this._render();
    const { gate } = getAccountContext();
    this._unsub = gate.onUpdate(() => this._syncMirror());
    this._syncMirror();
  }

  disconnectedCallback(): void {
    this._unsub?.();
    this._unsub = null;
  }

  private _syncMirror(): void {
    const { userDoc } = getAccountContext().gate;
    const ready = userDoc.loaded && userDoc.doc !== null;
    if (ready === this._mirrorReady) return;
    this._mirrorReady = ready;
    this._updateSubmit();
  }

  private _updateSubmit(): void {
    const btn = this.querySelector<HTMLButtonElement>('button[type="submit"]');
    const wait = this.querySelector<HTMLElement>('.account-form__wait');
    const waiting = this.mode === 'complete' && !this._mirrorReady;
    if (btn) btn.disabled = this._busy || waiting;
    if (wait) wait.hidden = !waiting;
  }

  private _render(): void {
    const id = this._id;
    const profile = getAccountContext().gate.profile;
    const name = profile?.displayName ?? '';
    const phone = profile?.phone ?? '';

    const fields = this.mode === 'accept-terms' ? '' : `
      <div class="account-field">
        <label class="account-field__label" for="${id}-name">Name <span class="account-required">(required)</span></label>
        <input id="${id}-name" name="displayName" class="account-field__input" type="text"
               autocomplete="name" maxlength="${DISPLAY_NAME_MAX + 20}" required
               value="${escapeHtml(name)}" aria-describedby="${id}-name-hint ${id}-name-error">
        <p id="${id}-name-hint" class="account-field__hint">Your first and last name, as the league knows you.</p>
        <p id="${id}-name-error" class="account-field__error" hidden></p>
      </div>
      <div class="account-field">
        <label class="account-field__label" for="${id}-phone">Phone <span class="account-required">(optional)</span></label>
        <input id="${id}-phone" name="phone" class="account-field__input" type="tel"
               autocomplete="tel" maxlength="${PHONE_MAX}" value="${escapeHtml(phone)}"
               aria-describedby="${id}-phone-hint ${id}-phone-error">
        <p id="${id}-phone-hint" class="account-field__hint">Only you and league admins can see this.</p>
        <p id="${id}-phone-error" class="account-field__error" hidden></p>
      </div>`;

    const checks = this.mode === 'edit' ? '' : `
      <label class="account-check">
        <input type="checkbox" name="terms" required aria-describedby="${id}-checks-error">
        <span>I agree to the <a href="#/privacy">Terms of Use and Privacy Policy</a>. <span class="account-required">(required)</span></span>
      </label>
      ${this.mode === 'complete' ? `
      <label class="account-check">
        <input type="checkbox" name="adult" required aria-describedby="${id}-checks-error">
        <span>I am 18 or older. <span class="account-required">(required)</span></span>
      </label>` : ''}
      <p id="${id}-checks-error" class="account-field__error" hidden></p>`;

    const submitLabel = { complete: 'Create profile', edit: 'Save changes', 'accept-terms': 'Accept' }[this.mode];

    this.innerHTML = `
      <form class="account-form" novalidate>
        ${fields}
        ${checks}
        <p class="account-form__wait account-field__hint" hidden>Setting up your account. This takes a few seconds.</p>
        <div class="account-form__actions">
          <button type="submit" class="btn-primary">${submitLabel}</button>
        </div>
      </form>`;

    this.querySelector('form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      void this._submit();
    });
    this._updateSubmit();
  }

  private _showErrors(errors: ProfileFieldErrors & { checks?: string }): void {
    const set = (key: string, msg: string | undefined) => {
      const el = this.querySelector<HTMLElement>(`#${this._id}-${key}-error`);
      const input = this.querySelector<HTMLInputElement>(`#${this._id}-${key}`);
      if (el) { el.textContent = msg ?? ''; el.hidden = !msg; }
      input?.setAttribute('aria-invalid', String(!!msg));
    };
    set('name', errors.displayName);
    set('phone', errors.phone);
    set('checks', errors.checks);
    const first = this.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?? (errors.checks ? this.querySelector<HTMLElement>('input[type="checkbox"]:not(:checked)') : null);
    first?.focus();
  }

  private async _submit(): Promise<void> {
    if (this._busy) return;
    const form = this.querySelector('form');
    if (!form) return;
    const data = new FormData(form);
    const uid = getAccountContext().auth.currentUser?.uid;
    if (!uid) return;

    const errors: ProfileFieldErrors & { checks?: string } = {};
    const input = {
      displayName: String(data.get('displayName') ?? ''),
      phone: String(data.get('phone') ?? ''),
    };
    if (this.mode !== 'accept-terms') {
      const v = validateProfileInput(input);
      if (!v.ok) Object.assign(errors, v.errors);
    }
    if (this.mode !== 'edit') {
      const missing = !data.get('terms') || (this.mode === 'complete' && !data.get('adult'));
      if (missing) errors.checks = this.mode === 'complete'
        ? 'Check both boxes to continue.'
        : 'Check the box to continue.';
    }
    this._showErrors(errors);
    if (errors.displayName || errors.phone || errors.checks) return;

    this._busy = true;
    this._updateSubmit();
    const svc = getAccountService();
    const result = this.mode === 'complete'
      ? await svc.completeProfile(uid, input)
      : this.mode === 'edit'
        ? await svc.updateProfile(uid, input)
        : await svc.acceptTerms(uid);
    this._busy = false;
    this._updateSubmit();

    if (!result.success) {
      showToast('error', accountErrorMessage(result.code));
      return;
    }
    const msg = { complete: 'Profile created. Welcome!', edit: 'Profile saved.', 'accept-terms': 'Thanks. Terms accepted.' }[this.mode];
    showToast('success', msg);
    await getAccountContext().gate.refresh();
    this.dispatchEvent(new CustomEvent('profile-saved', { bubbles: true }));
  }
}

if (!customElements.get('account-profile-form')) {
  customElements.define('account-profile-form', AccountProfileForm);
}
