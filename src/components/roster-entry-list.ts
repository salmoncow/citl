/**
 * <roster-entry-list> — editable roster table for the roster builder
 * (spec 009 AC-6, AC-10; DD-3, DD-4; §III.6).
 *
 * Properties: `entries` (RosterEntryInput[], owned by the parent),
 * `context` (captain name and dependents, for the names shown), and
 * `readOnly`. Typing updates the entries in place; structural changes
 * (add, remove, under-18 toggle) re-render. Every change dispatches
 * `roster-change` (bubbles).
 *
 * Accessibility: a captioned table whose controls carry row-specific
 * names ("Rookie, Sam D."). Adding a shooter focuses its first field;
 * removing one focuses the next row's Remove button, or the Add button.
 * Below 480px each row stacks (labels come from data-label).
 */

import { escapeHtml } from '@/modules/ui';
import {
  ROSTER_MAX,
  previewEntryName,
  type RosterNameContext,
} from '@/services/league-validation';
import { NAME_PART_MAX } from '@/services/profile-validation';
import { normalizeShooterName } from '@/services/scoring-engine';
import type { RosterEntryInput } from '@/types/league';

let idCounter = 0;

class RosterEntryList extends HTMLElement {
  private _entries: RosterEntryInput[] = [];
  private _ctx: RosterNameContext = { selfName: '', dependents: new Map() };
  private _readOnly = false;
  private _id = `roster-${++idCounter}`;

  set entries(value: RosterEntryInput[]) { this._entries = value; this._render(); }
  get entries(): RosterEntryInput[] { return this._entries; }
  set context(value: RosterNameContext) { this._ctx = value; this._render(); }
  set readOnly(value: boolean) { this._readOnly = value; this._render(); }

  connectedCallback(): void {
    this._render();
  }

  private _changed(): void {
    this.dispatchEvent(new CustomEvent('roster-change', { bubbles: true }));
  }

  private _name(e: RosterEntryInput): string {
    return previewEntryName(e, this._ctx) || 'New shooter';
  }

  private _adultNames(except: number): string[] {
    return this._entries.flatMap((e, i) =>
      i === except || e.kind === 'dependent' || (e.kind === 'named' && (e.minor || !e.firstName.trim() || !e.lastName.trim()))
        ? []
        : [previewEntryName(e, this._ctx)]);
  }

  private _guardianOptions(e: Extract<RosterEntryInput, { kind: 'named' }>, i: number): string {
    const options = this._adultNames(i);
    const current = normalizeShooterName(e.guardianName ?? '');
    const known = options.some((n) => normalizeShooterName(n) === current);
    return `<option value="">Choose…</option>
      ${options.map((n) => `<option value="${escapeHtml(n)}" ${known && normalizeShooterName(n) === current ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('')}`;
  }

  private _row(e: RosterEntryInput, i: number): string {
    const id = `${this._id}-${i}`;
    const label = escapeHtml(this._name(e));
    const ro = this._readOnly ? 'disabled' : '';
    let nameCell: string;
    let minorCell: string;
    let guardianCell = '<span class="roster-table__na">—</span>';

    if (e.kind === 'named') {
      nameCell = `
        <div class="roster-table__name-fields">
          <label class="visually-hidden" for="${id}-first">First name, shooter ${i + 1}</label>
          <input id="${id}-first" class="account-field__input" data-field="firstName" data-i="${i}" type="text"
                 placeholder="First" maxlength="${NAME_PART_MAX + 10}" value="${escapeHtml(e.firstName)}" ${ro}>
          <label class="visually-hidden" for="${id}-last">Last name, shooter ${i + 1}</label>
          <input id="${id}-last" class="account-field__input" data-field="lastName" data-i="${i}" type="text"
                 placeholder="Last" maxlength="${NAME_PART_MAX + 10}" value="${escapeHtml(e.lastName)}" ${ro}>
        </div>
        ${e.minor ? `<span class="league-list__meta">Shown as ${label}</span>` : ''}`;
      minorCell = `
        <label class="roster-table__hit">
          <input type="checkbox" class="roster-table__check" data-field="minor" data-i="${i}" id="${id}-minor"
                 ${e.minor ? 'checked' : ''} ${ro} aria-label="Under 18, shooter ${i + 1}"
                 ${e.minor ? `aria-controls="${id}-guardian"` : ''}>
        </label>`;
      if (e.minor) {
        guardianCell = `
          <label class="visually-hidden" for="${id}-guardian">Guardian of ${label}</label>
          <select id="${id}-guardian" class="account-field__input" data-field="guardianName" data-i="${i}" ${ro}>
            ${this._guardianOptions(e, i)}
          </select>`;
      }
    } else {
      const tag = e.kind === 'self' ? 'You, captain' : 'Your dependent';
      nameCell = `<span class="league-list__name">${label}</span><span class="league-list__meta">${tag}</span>`;
      minorCell = e.kind === 'dependent' ? 'Yes' : 'No';
      if (e.kind === 'dependent') guardianCell = 'You';
    }

    return `
      <tr>
        <td data-label="Shooter">${nameCell}</td>
        <td data-label="Rookie">
          <label class="roster-table__hit">
            <input type="checkbox" class="roster-table__check" data-field="rookie" data-i="${i}"
                   ${e.rookie ? 'checked' : ''} ${ro} aria-label="Rookie, ${label}">
          </label>
        </td>
        <td data-label="Under 18">${minorCell}</td>
        <td data-label="Guardian">${guardianCell}</td>
        <td data-label="">
          ${this._readOnly ? '' : `<button type="button" class="btn-secondary" data-remove="${i}" aria-label="Remove ${label}">Remove</button>`}
        </td>
      </tr>`;
  }

  private _render(): void {
    const onRoster = new Set(this._entries.flatMap((e) => (e.kind === 'dependent' ? [e.dependentId] : [])));
    const freeDeps = [...this._ctx.dependents].filter(([id]) => !onRoster.has(id));
    const full = this._entries.length >= ROSTER_MAX;
    const hasSelf = this._entries.some((e) => e.kind === 'self');

    const controls = this._readOnly ? '' : `
      <div class="account-form__actions roster-add">
        <button type="button" class="btn-secondary" data-action="add-named" ${full ? 'disabled' : ''}>Add a shooter</button>
        ${hasSelf ? '' : `<button type="button" class="btn-secondary" data-action="add-self" ${full ? 'disabled' : ''}>Add me</button>`}
        ${freeDeps.length === 0 ? '' : `
          <label class="visually-hidden" for="${this._id}-dep">Dependent to add</label>
          <select id="${this._id}-dep" class="account-field__input roster-add__select">
            ${freeDeps.map(([id, d]) => `<option value="${escapeHtml(id)}">${escapeHtml(`${d.firstName} ${d.lastName}`)}</option>`).join('')}
          </select>
          <button type="button" class="btn-secondary" data-action="add-dependent" ${full ? 'disabled' : ''}>Add dependent</button>`}
      </div>`;

    this.innerHTML = `
      <div class="roster-scroll" role="region" aria-label="Roster" tabindex="0">
      <table class="roster-table">
        <caption class="roster-table__caption">Roster: ${this._entries.length} of ${ROSTER_MAX} shooters</caption>
        <thead>
          <tr><th scope="col">Shooter</th><th scope="col">Rookie</th><th scope="col">Under 18</th><th scope="col">Guardian</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr>
        </thead>
        <tbody>
          ${this._entries.length ? this._entries.map((e, i) => this._row(e, i)).join('') : `<tr><td colspan="5" class="roster-table__empty">No shooters yet.</td></tr>`}
        </tbody>
      </table>
      </div>
      ${controls}`;

    this._wire();
  }

  private _wire(): void {
    this.querySelectorAll<HTMLInputElement>('input[data-field="firstName"], input[data-field="lastName"]').forEach((input) => {
      input.addEventListener('input', () => {
        const e = this._entries[Number(input.dataset['i'])];
        if (e?.kind !== 'named') return;
        e[input.dataset['field'] as 'firstName' | 'lastName'] = input.value;
        this._changed();
      });
      // Guardian choices depend on names; refresh them once a name is settled.
      input.addEventListener('change', () => this._refreshGuardians());
    });
    this.querySelectorAll<HTMLInputElement>('input[data-field="rookie"]').forEach((input) => {
      input.addEventListener('change', () => {
        const e = this._entries[Number(input.dataset['i'])];
        if (e) e.rookie = input.checked;
        this._changed();
      });
    });
    this.querySelectorAll<HTMLInputElement>('input[data-field="minor"]').forEach((input) => {
      input.addEventListener('change', () => {
        const i = Number(input.dataset['i']);
        const e = this._entries[i];
        if (e?.kind !== 'named') return;
        e.minor = input.checked;
        if (!e.minor) e.guardianName = null;
        this._changed();
        this._render();
        this.querySelector<HTMLElement>(`#${this._id}-${i}-minor`)?.focus();
      });
    });
    this.querySelectorAll<HTMLSelectElement>('select[data-field="guardianName"]').forEach((select) => {
      select.addEventListener('change', () => {
        const e = this._entries[Number(select.dataset['i'])];
        if (e?.kind === 'named') e.guardianName = select.value || null;
        this._changed();
      });
    });
    this.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => this._remove(Number(btn.dataset['remove'])));
    });
    this.querySelector('[data-action="add-named"]')?.addEventListener('click', () => {
      this._entries.push({ kind: 'named', firstName: '', lastName: '', rookie: false, minor: false });
      this._added(true);
    });
    this.querySelector('[data-action="add-self"]')?.addEventListener('click', () => {
      this._entries.unshift({ kind: 'self', rookie: false });
      this._changed();
      this._render();
      this.querySelector<HTMLElement>('[data-remove="0"]')?.focus();
    });
    this.querySelector('[data-action="add-dependent"]')?.addEventListener('click', () => {
      const id = this.querySelector<HTMLSelectElement>(`#${this._id}-dep`)?.value;
      if (!id) return;
      this._entries.push({ kind: 'dependent', dependentId: id, rookie: false });
      this._added(false);
    });
  }

  private _added(named: boolean): void {
    this._changed();
    this._render();
    const i = this._entries.length - 1;
    const target = named
      ? this.querySelector<HTMLElement>(`#${this._id}-${i}-first`)
      : this.querySelector<HTMLElement>(`[data-remove="${i}"]`);
    target?.focus();
  }

  private _remove(i: number): void {
    this._entries.splice(i, 1);
    this._changed();
    this._render();
    const next = this.querySelector<HTMLElement>(`[data-remove="${Math.min(i, this._entries.length - 1)}"]`)
      ?? this.querySelector<HTMLElement>('[data-action="add-named"]');
    next?.focus();
  }

  /**
   * Update the guardian choices in place. Re-rendering here would destroy
   * whatever the user just clicked (change fires on the mousedown that
   * moves focus), so only the <select> options are replaced.
   */
  private _refreshGuardians(): void {
    this._entries.forEach((e, i) => {
      if (e.kind !== 'named' || !e.minor) return;
      const select = this.querySelector<HTMLSelectElement>(`#${this._id}-${i}-guardian`);
      if (select) select.innerHTML = this._guardianOptions(e, i);
    });
  }
}

if (!customElements.get('roster-entry-list')) {
  customElements.define('roster-entry-list', RosterEntryList);
}
