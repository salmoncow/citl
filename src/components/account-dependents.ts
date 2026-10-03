/**
 * <account-dependents> — dependents (under-18 shooters) on the member's
 * account (spec 009 F8, AC-12).
 *
 * The parent <account-league> owns the data and passes it in with
 * `dependents`; after any write this element dispatches `league-changed`
 * (bubbles) so the parent reloads. Each dependent shows the public form
 * of their name ("Sam D.") and a note in the year they turn 18.
 */

import { escapeHtml, showToast } from '@/modules/ui';
import { getAccountContext } from '@/modules/account-context';
import { getMemberLeagueService, resultMessage } from '@/services/member-league-service';
import { DEPENDENTS_MAX, isAgingOut, minorDisplayName } from '@/services/league-validation';
import { NAME_PART_MAX } from '@/services/profile-validation';
import type { Dependent } from '@/types/league';
import { confirmLeague, openFormDialog } from '@/components/league-dialog';

let idCounter = 0;

function dependentFields(id: string, d: Dependent | null): string {
  const year = new Date().getUTCFullYear();
  return `
    <div class="account-field-row">
      <div class="account-field">
        <label class="account-field__label" for="${id}-first">First name</label>
        <input id="${id}-first" name="firstName" class="account-field__input" type="text"
               maxlength="${NAME_PART_MAX + 10}" value="${escapeHtml(d?.firstName ?? '')}" required>
      </div>
      <div class="account-field">
        <label class="account-field__label" for="${id}-last">Last name</label>
        <input id="${id}-last" name="lastName" class="account-field__input" type="text"
               maxlength="${NAME_PART_MAX + 10}" value="${escapeHtml(d?.lastName ?? '')}" required>
      </div>
    </div>
    <div class="account-field">
      <label class="account-field__label" for="${id}-year">Birth year</label>
      <input id="${id}-year" name="birthYear" class="account-field__input league-field--year" type="number"
             inputmode="numeric" min="${year - 18}" max="${year}" value="${d ? d.birthYear : ''}"
             aria-describedby="${id}-year-hint" required>
      <p id="${id}-year-hint" class="account-field__hint">Public pages show only the first name and last initial.</p>
    </div>`;
}

class AccountDependents extends HTMLElement {
  private _dependents: Dependent[] = [];
  private _id = `dep-${++idCounter}`;

  set dependents(value: Dependent[]) {
    this._dependents = value;
    this._render();
  }

  connectedCallback(): void {
    this._render();
  }

  private _render(): void {
    const id = this._id;
    const rows = this._dependents.map((d) => `
      <li class="league-list__item">
        <div>
          <span class="league-list__name">${escapeHtml(`${d.firstName} ${d.lastName}`)}</span>
          <span class="league-list__meta">Born ${d.birthYear} · shown as ${escapeHtml(minorDisplayName(d.firstName, d.lastName))}</span>
          ${isAgingOut(d.birthYear) ? '<span class="league-list__meta">Turns 18 this year. Next season they’ll need their own account.</span>' : ''}
        </div>
        <div class="league-list__actions">
          <button type="button" class="btn-secondary" data-edit="${escapeHtml(d.id)}"
                  aria-label="Edit ${escapeHtml(d.firstName)}">Edit</button>
          <button type="button" class="btn-secondary" data-remove="${escapeHtml(d.id)}"
                  aria-label="Remove ${escapeHtml(d.firstName)}">Remove</button>
        </div>
      </li>`).join('');
    const full = this._dependents.length >= DEPENDENTS_MAX;
    this.innerHTML = `
      ${rows ? `<ul class="league-list" aria-label="Dependents">${rows}</ul>` : '<p class="account-section__desc">No dependents yet.</p>'}
      <div class="account-form__actions">
        <button type="button" class="btn-secondary" data-action="add" ${full ? `disabled aria-describedby="${id}-full"` : ''}>Add a dependent</button>
      </div>
      ${full ? `<p id="${id}-full" class="account-field__hint">You can add up to ${DEPENDENTS_MAX} dependents.</p>` : ''}`;

    this.querySelector('[data-action="add"]')?.addEventListener('click', () => void this._edit(null));
    this.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach((b) => {
      b.addEventListener('click', () => void this._edit(this._dependents.find((d) => d.id === b.dataset['edit']) ?? null));
    });
    this.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((b) => {
      b.addEventListener('click', () => void this._remove(b.dataset['remove'] ?? ''));
    });
  }

  private async _edit(dep: Dependent | null): Promise<void> {
    const uid = getAccountContext().auth.currentUser?.uid;
    if (!uid) return;
    const svc = getMemberLeagueService();
    const saved = await openFormDialog({
      title: dep ? `Edit ${dep.firstName}` : 'Add a dependent',
      fieldsHtml: dependentFields(`${this._id}-f`, dep),
      submitLabel: dep ? 'Save' : 'Add',
      onSubmit: async (form) => {
        const data = new FormData(form);
        const input = {
          firstName: String(data.get('firstName') ?? ''),
          lastName: String(data.get('lastName') ?? ''),
          birthYear: String(data.get('birthYear') ?? ''),
        };
        const res = dep
          ? await svc.updateDependent(uid, dep.id, input)
          : await svc.addDependent(uid, input, this._dependents.length);
        return res.success ? null : resultMessage(res);
      },
    });
    if (saved) {
      showToast('success', dep ? 'Dependent saved.' : 'Dependent added.');
      this.dispatchEvent(new CustomEvent('league-changed', { bubbles: true }));
    }
  }

  private async _remove(id: string): Promise<void> {
    const uid = getAccountContext().auth.currentUser?.uid;
    const dep = this._dependents.find((d) => d.id === id);
    if (!uid || !dep) return;
    const ok = await confirmLeague(
      `Remove ${dep.firstName}?`,
      'They’ll be taken off your account. A roster or registration that includes them will need updating.',
      'Remove',
      true,
    );
    if (!ok) return;
    const res = await getMemberLeagueService().removeDependent(uid, id);
    if (!res.success) {
      showToast('error', resultMessage(res));
      return;
    }
    showToast('success', 'Dependent removed.');
    this.dispatchEvent(new CustomEvent('league-changed', { bubbles: true }));
  }
}

if (!customElements.get('account-dependents')) {
  customElements.define('account-dependents', AccountDependents);
}
