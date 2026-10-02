/**
 * <account-danger-zone> — sign out, deactivate, delete (spec 008 AC-14,
 * AC-16, AC-17, AC-24).
 *
 * - Deactivate: confirm → setAccountStatus('deactivated') → sign out.
 * - Delete: typed-DELETE confirm stating that published scorecards keep
 *   the member's name → deleteAccount. On requires-recent-login the user
 *   re-authenticates (popup with a linked provider, or a fresh email
 *   link) and the delete is retried.
 * - Owners and admins see the DD-7 message instead of the two buttons;
 *   the callables refuse them regardless.
 *
 * - `delete-only` renders just the delete row. The account page uses it
 *   when a previous delete removed the users/{uid} mirror but not the
 *   Auth user, so the member can finish deleting.
 *
 * Confirmation dialogs are native <dialog> (focus trap, Escape closes),
 * with focus starting on Cancel.
 */

import { showToast } from '@/modules/ui';
import { getRole } from '@/modules/role';
import { getAccountContext } from '@/modules/account-context';
import { reauthenticate } from '@/modules/auth-providers';
import {
  REQUIRES_RECENT_LOGIN,
  accountErrorMessage,
  getAccountService,
} from '@/services/account-service';

interface ConfirmOptions {
  title: string;
  body: string[];
  confirmLabel: string;
  /** When set, the user must type this exact text to enable confirm. */
  typed?: string;
}

let idCounter = 0;

/** Native confirm dialog; resolves true on confirm. */
function confirmAction(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const id = `confirm-${++idCounter}`;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = document.createElement('dialog');
    dialog.className = 'confirm-dialog';
    dialog.setAttribute('aria-labelledby', `${id}-title`);
    dialog.setAttribute('aria-describedby', `${id}-body`);

    const title = document.createElement('h2');
    title.id = `${id}-title`;
    title.className = 'confirm-dialog__title';
    title.textContent = opts.title;

    const body = document.createElement('div');
    body.id = `${id}-body`;
    for (const text of opts.body) {
      const p = document.createElement('p');
      p.className = 'account-confirm__body';
      p.textContent = text;
      body.appendChild(p);
    }

    let input: HTMLInputElement | null = null;
    const typedWrap = document.createElement('div');
    if (opts.typed) {
      const label = document.createElement('label');
      label.className = 'confirm-dialog__instruction';
      label.htmlFor = `${id}-typed`;
      const strong = document.createElement('strong');
      strong.textContent = opts.typed;
      label.append('Type ', strong, ' to confirm:');
      input = document.createElement('input');
      input.id = `${id}-typed`;
      input.type = 'text';
      input.className = 'confirm-dialog__input account-field__input';
      input.autocomplete = 'off';
      input.spellcheck = false;
      typedWrap.append(label, input);
    }

    const actions = document.createElement('div');
    actions.className = 'confirm-dialog__actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn-secondary';
    cancel.textContent = 'Cancel';
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'btn-danger';
    confirm.textContent = opts.confirmLabel;
    confirm.disabled = !!opts.typed;
    actions.append(cancel, confirm);

    input?.addEventListener('input', () => {
      confirm.disabled = input!.value.trim() !== opts.typed;
    });

    let result = false;
    cancel.addEventListener('click', () => dialog.close());
    confirm.addEventListener('click', () => { result = true; dialog.close(); });
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (trigger?.isConnected) trigger.focus();
      resolve(result);
    });

    dialog.append(title, body, typedWrap, actions);
    document.body.appendChild(dialog);
    dialog.showModal();
    cancel.focus();
  });
}

class AccountDangerZone extends HTMLElement {
  private _busy = false;

  connectedCallback(): void {
    void this._init();
  }

  private async _init(): Promise<void> {
    if (this.hasAttribute('delete-only')) {
      this.innerHTML = this._deleteRow();
      this.querySelector('[data-action="delete"]')?.addEventListener('click', () => void this._delete());
      return;
    }
    const role = await getRole();
    const privileged = role === 'owner' || role === 'admin';

    const statusRows = privileged
      ? `<div class="account-danger__row">
           <p class="account-notice">You’re a league ${role}. Owners and admins can’t deactivate or delete their own
           account. Ask an owner to change your role first.</p>
         </div>`
      : `<div class="account-danger__row">
           <div>
             <h3>Deactivate account</h3>
             <p>Pause your account. Sign in any time to reactivate it.</p>
           </div>
           <button type="button" class="btn-secondary" data-action="deactivate">Deactivate</button>
         </div>
         ${this._deleteRow()}`;

    this.innerHTML = `
      <div class="account-danger__row">
        <div>
          <h3>Sign out</h3>
          <p>Sign out of this browser.</p>
        </div>
        <button type="button" class="btn-secondary" data-action="sign-out">Sign out</button>
      </div>
      ${statusRows}`;

    this.querySelector('[data-action="sign-out"]')?.addEventListener('click', () => void this._signOut());
    this.querySelector('[data-action="deactivate"]')?.addEventListener('click', () => void this._deactivate());
    this.querySelector('[data-action="delete"]')?.addEventListener('click', () => void this._delete());
  }

  private _deleteRow(): string {
    return `<div class="account-danger__row">
           <div>
             <h3>Delete account</h3>
             <p>Permanently remove your profile and sign-in. Your name stays on published scorecards.</p>
           </div>
           <button type="button" class="btn-danger" data-action="delete">Delete account</button>
         </div>`;
  }

  private _setBusy(busy: boolean): void {
    this._busy = busy;
    this.querySelectorAll<HTMLButtonElement>('button').forEach((b) => { b.disabled = busy; });
  }

  private async _signOut(): Promise<void> {
    await getAccountContext().auth.signOut();
    showToast('info', 'Signed out.');
  }

  private async _deactivate(): Promise<void> {
    if (this._busy) return;
    const ok = await confirmAction({
      title: 'Deactivate your account?',
      body: [
        'Your account will be paused and you’ll be signed out.',
        'Sign in again any time to reactivate it.',
      ],
      confirmLabel: 'Deactivate',
    });
    if (!ok) return;
    this._setBusy(true);
    const res = await getAccountService().setAccountStatus('deactivated');
    this._setBusy(false);
    if (!res.ok) {
      showToast('error', accountErrorMessage(res.code, res.reason));
      return;
    }
    await getAccountContext().auth.signOut();
    showToast('info', 'Your account is deactivated. Sign in any time to reactivate it.');
  }

  private async _delete(): Promise<void> {
    if (this._busy) return;
    const ok = await confirmAction({
      title: 'Delete your account?',
      body: [
        'This permanently removes your profile, contact details and sign-in methods. It can’t be undone.',
        'Published scores and scorecards are the league’s record, so your name stays on them.',
      ],
      confirmLabel: 'Delete account',
      typed: 'DELETE',
    });
    if (!ok) return;
    await this._runDelete(true);
  }

  private async _runDelete(allowReauth: boolean): Promise<void> {
    this._setBusy(true);
    const res = await getAccountService().deleteAccount();
    if (res.ok) {
      await getAccountContext().auth.signOut();
      showToast('success', 'Your account was deleted.');
      window.location.hash = '#/';
      return;
    }
    if (res.reason === REQUIRES_RECENT_LOGIN && allowReauth) {
      showToast('info', 'For your security, please confirm it’s you.');
      const outcome = await reauthenticate();
      if (outcome.status === 'reauthenticated') {
        await this._runDelete(false);
        return;
      }
      this._setBusy(false);
      if (outcome.status === 'email-sent') {
        showToast('info', `We sent a link to ${outcome.email}. Open it, then choose Delete account again.`);
      } else if (outcome.status === 'error') {
        showToast('error', outcome.message);
      }
      return;
    }
    this._setBusy(false);
    showToast('error', accountErrorMessage(res.code, res.reason));
  }
}

if (!customElements.get('account-danger-zone')) {
  customElements.define('account-danger-zone', AccountDangerZone);
}
