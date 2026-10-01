/**
 * <account-providers> — linked sign-in methods (spec 008 AC-7, AC-24).
 *
 * Lists every enabled provider with a text status ("Connected" / "Not
 * connected"). Link: popup for Google/Microsoft; for email, a sign-in
 * link sent with the `link` intent. Unlink is disabled with a visible
 * reason when only one method is connected (DD-6; UX only).
 */

import { escapeHtml, showToast } from '@/modules/ui';
import {
  PROVIDER_IDS,
  PROVIDER_LABELS,
  canUnlink,
  currentUserInfo,
  enabledProviders,
  linkProvider,
  reloadCurrentUser,
  sendEmailLink,
  unlinkProvider,
  type AuthOutcome,
  type ProviderKey,
} from '@/modules/auth-providers';

let idCounter = 0;

class AccountProviders extends HTMLElement {
  private _id = `prov-${++idCounter}`;
  private _busy = false;

  connectedCallback(): void {
    this._render();
  }

  private _render(): void {
    const info = currentUserInfo();
    if (!info) {
      this.innerHTML = '';
      return;
    }
    const linked = new Set<string>(info.providerIds);
    const unlinkAllowed = canUnlink(info.providerIds.map((providerId) => ({ providerId })));
    const noteId = `${this._id}-note`;

    const rows = enabledProviders().map((key) => {
      const label = PROVIDER_LABELS[key];
      const on = linked.has(PROVIDER_IDS[key]);
      const action = on
        ? `<button type="button" class="btn-secondary" data-unlink="${key}"
             ${unlinkAllowed ? '' : `disabled aria-describedby="${noteId}"`}>Remove ${escapeHtml(label)}</button>`
        : `<button type="button" class="btn-secondary" data-link="${key}">Connect ${escapeHtml(label)}</button>`;
      const detail = on && key === 'email' && info.email ? ` (${escapeHtml(info.email)})` : '';
      return `
        <li class="account-providers__item">
          <span>
            <span class="account-providers__name">${escapeHtml(label)}</span>
            <span class="account-providers__state${on ? ' account-providers__state--on' : ''}">${on ? 'Connected' : 'Not connected'}${detail}</span>
          </span>
          ${action}
        </li>`;
    }).join('');

    this.innerHTML = `
      <ul class="account-providers">${rows}</ul>
      <p id="${noteId}" class="account-providers__note"${unlinkAllowed ? ' hidden' : ''}>
        You can’t remove your only sign-in method. Connect another one first.
      </p>`;

    this.querySelectorAll<HTMLButtonElement>('[data-link]').forEach((btn) => {
      btn.addEventListener('click', () => void this._link(btn.dataset['link'] as ProviderKey));
    });
    this.querySelectorAll<HTMLButtonElement>('[data-unlink]').forEach((btn) => {
      btn.addEventListener('click', () => void this._unlink(btn.dataset['unlink'] as ProviderKey));
    });
  }

  private async _run(op: () => Promise<AuthOutcome>, success: string): Promise<void> {
    if (this._busy) return;
    this._busy = true;
    this.querySelectorAll<HTMLButtonElement>('button').forEach((b) => { b.disabled = true; });
    const outcome = await op();
    this._busy = false;
    if (outcome.status === 'error') showToast('error', outcome.message);
    else if (outcome.status === 'email-sent') {
      showToast('info', `We sent a link to ${outcome.email}. Open it on this device to connect email sign-in.`);
    } else if (outcome.status !== 'cancelled') showToast('success', success);
    await reloadCurrentUser();
    this._render();
  }

  private async _link(key: ProviderKey): Promise<void> {
    const label = PROVIDER_LABELS[key];
    if (key === 'email') {
      const email = currentUserInfo()?.email;
      if (!email) {
        showToast('error', 'Your account has no email address to send a link to.');
        return;
      }
      await this._run(() => sendEmailLink(email, 'link'), '');
      return;
    }
    await this._run(() => linkProvider(key), `${label} connected.`);
  }

  private async _unlink(key: ProviderKey): Promise<void> {
    await this._run(() => unlinkProvider(PROVIDER_IDS[key]), `${PROVIDER_LABELS[key]} removed.`);
  }
}

if (!customElements.get('account-providers')) {
  customElements.define('account-providers', AccountProviders);
}
