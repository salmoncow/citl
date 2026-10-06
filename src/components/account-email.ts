/**
 * <account-email> — the Email card on /account (spec 011 AC-2, AC-3).
 *
 * One checkbox per offered topic (New requests for admins and owners),
 * the address mail goes to, and Save. Members who completed their
 * profile before M4 have no settings doc; they see a one-line prompt
 * until they save once. Status emails about the member's own requests
 * are not optional, so they are stated, not offered.
 *
 * topicChecksHtml() is shared with the profile-completion form.
 */

import { escapeHtml, showToast } from '@/modules/ui';
import { getRole } from '@/modules/role';
import { getAccountContext } from '@/modules/account-context';
import { accountErrorMessage } from '@/services/account-service';
import {
  getNotificationService,
  topicOptions,
  type TopicOption,
} from '@/services/notification-service';
import type { NotificationTopic, NotificationTopics } from '@/types/notifications';
import type { Role } from '@/types/user';

let idCounter = 0;

/** Checkboxes named `topic`, each described by its one-line summary. */
export function topicChecksHtml(idPrefix: string, options: readonly TopicOption[], topics: NotificationTopics): string {
  return options.map((o) => `
    <label class="account-check">
      <input type="checkbox" name="topic" value="${o.topic}" ${topics[o.topic] ? 'checked' : ''}
             aria-describedby="${idPrefix}-${o.topic}-desc">
      <span>${escapeHtml(o.label)}
        <span id="${idPrefix}-${o.topic}-desc" class="account-field__hint">${escapeHtml(o.description)}</span></span>
    </label>`).join('');
}

/** The checked `topic` boxes in a form. */
export function checkedTopics(form: HTMLFormElement): Set<NotificationTopic> {
  return new Set(new FormData(form).getAll('topic').map(String) as NotificationTopic[]);
}

class AccountEmail extends HTMLElement {
  private _id = `em-${++idCounter}`;
  private _role: Role | null = null;
  private _busy = false;

  connectedCallback(): void {
    void this._load();
  }

  private async _load(): Promise<void> {
    const uid = getAccountContext().auth.currentUser?.uid;
    if (!uid) return;
    const [role, res] = await Promise.all([getRole(), getNotificationService().load(uid)]);
    if (!this.isConnected) return;
    this._role = role;
    if (!res.success) {
      this._renderCard('<p class="account-error" role="alert">We couldn’t load your email settings. Reload the page to try again.</p>');
      return;
    }
    this._render(res.data);
  }

  private _renderCard(body: string): void {
    const email = getAccountContext().gate.userDoc.doc?.email ?? '';
    this.innerHTML = `
      <section class="card account-section" aria-labelledby="${this._id}-h">
        <h2 id="${this._id}-h">Email</h2>
        <p class="account-section__desc">League email goes to
          <strong>${email ? escapeHtml(email) : 'your sign-in address'}</strong>. Updates about your own
          requests always arrive; every other email has a one-click unsubscribe link.</p>
        ${body}
      </section>`;
  }

  private _render(topics: NotificationTopics | null): void {
    const id = this._id;
    this._renderCard(`
      ${topics === null ? '<p class="account-notice" role="status">Choose which league emails you want, then save.</p>' : ''}
      <form class="account-form" novalidate>
        <fieldset class="league-fieldset">
          <legend class="account-field__label">Email me about</legend>
          ${topicChecksHtml(id, topicOptions(this._role), topics ?? {})}
        </fieldset>
        <div class="account-form__actions">
          <button type="submit" class="btn-primary">Save email settings</button>
        </div>
      </form>`);
    this.querySelector('form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      void this._save(e.currentTarget as HTMLFormElement);
    });
  }

  private async _save(form: HTMLFormElement): Promise<void> {
    const uid = getAccountContext().auth.currentUser?.uid;
    if (this._busy || !uid) return;
    this._busy = true;
    const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (btn) btn.disabled = true;
    const res = await getNotificationService().save(uid, this._role, checkedTopics(form));
    this._busy = false;
    if (btn) btn.disabled = false;
    if (!res.success) {
      showToast('error', accountErrorMessage(res.code));
      return;
    }
    showToast('success', 'Email settings saved.');
    this.querySelector('.account-notice')?.remove();
  }
}

if (!customElements.get('account-email')) {
  customElements.define('account-email', AccountEmail);
}
