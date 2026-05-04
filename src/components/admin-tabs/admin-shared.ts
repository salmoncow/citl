/**
 * Shared utilities for admin-panel tab modules.
 *
 * Pure DOM helpers and small format/parse utilities. No tab-module
 * dependencies, no Firestore calls — safe to import from any tab.
 */

import { normalizeShooterName } from '@/services/scoring-engine';
import type { ConfirmDialogOptions } from './types';

// ── Shared SVG icons ────────────────────────────────────────────────────────

export const PENCIL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="16 3 21 8 8 21 3 21 3 16 16 3"/></svg>`;
export const TRASH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
export const ROSTER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512" aria-hidden="true"><path fill="currentColor" d="M40 48C26.7 48 16 58.7 16 72v48c0 13.3 10.7 24 24 24H88c13.3 0 24-10.7 24-24V72c0-13.3-10.7-24-24-24H40zm152 16c-17.7 0-32 14.3-32 32s14.3 32 32 32H488c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32H488c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32H488c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zM16 232v48c0 13.3 10.7 24 24 24H88c13.3 0 24-10.7 24-24V232c0-13.3-10.7-24-24-24H40c-13.3 0-24 10.7-24 24zM40 368c-13.3 0-24 10.7-24 24v48c0 13.3 10.7 24 24 24H88c13.3 0 24-10.7 24-24V392c0-13.3-10.7-24-24-24H40z"/></svg>`;
export const LOCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
export const WARN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

// ── Build option list helper (used by Year + Week selects) ─────────────────

export function buildOptions(min: number, max: number, label: string, selected: number): string {
  let html = '';
  for (let i = min; i <= max; i++) {
    html += `<option value="${i}"${i === selected ? ' selected' : ''}>${label ? `${label} ${i}` : i}</option>`;
  }
  return html;
}

// ── Date utilities (shared by score-entry date override) ────────────────────

/** Parse a YYYY-MM-DD string as a local date (avoids UTC midnight offset). */
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

/** Format a Date as YYYY-MM-DD for use as an <input type="date"> value. */
export function toInputDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ── Confirm-by-typing dialog (used for delete confirmations) ────────────────

export function showConfirmDialog(opts: ConfirmDialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'confirm-dialog';

    const h2 = document.createElement('h2');
    h2.className = 'confirm-dialog__title';
    h2.textContent = opts.title;

    const warn = document.createElement('p');
    warn.className = 'confirm-dialog__warning';
    warn.textContent = opts.warning;

    const instr = document.createElement('p');
    instr.className = 'confirm-dialog__instruction';
    const strong = document.createElement('strong');
    strong.textContent = opts.nameToType;
    instr.append('Type ', strong, ' to confirm:');

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'confirm-dialog__input admin-input';
    input.autocomplete = 'off';
    input.placeholder = opts.nameToType;
    input.setAttribute('aria-label', 'Confirm by typing name');

    const actions = document.createElement('div');
    actions.className = 'confirm-dialog__actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn-secondary';
    cancelBtn.textContent = 'Cancel';

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-danger';
    deleteBtn.textContent = opts.deleteLabel;
    deleteBtn.disabled = true;

    input.addEventListener('input', () => {
      deleteBtn.disabled = input.value.trim() !== opts.nameToType;
    });

    const finish = (confirmed: boolean) => {
      dialog.close();
      document.body.removeChild(dialog);
      resolve(confirmed);
    };

    cancelBtn.addEventListener('click', () => finish(false));
    deleteBtn.addEventListener('click', () => finish(true));
    dialog.addEventListener('cancel', () => finish(false));

    actions.appendChild(cancelBtn);
    actions.appendChild(deleteBtn);
    dialog.append(h2, warn, instr, input, actions);
    document.body.appendChild(dialog);
    dialog.showModal();
    setTimeout(() => input.focus(), 0);
  });
}

// ── Autocomplete (text input with filtered dropdown) ────────────────────────

export function attachAutocomplete(
  input: HTMLInputElement,
  getSuggestions: () => string[],
): void {
  const wrapper = document.createElement('div');
  wrapper.className = 'ac-wrapper';
  input.parentNode!.insertBefore(wrapper, input);
  wrapper.appendChild(input);

  const dropdown = document.createElement('div');
  dropdown.className = 'ac-dropdown';
  wrapper.appendChild(dropdown);

  let activeIndex = -1;

  const close = () => {
    dropdown.classList.remove('ac-dropdown--open');
    dropdown.innerHTML = '';
    activeIndex = -1;
  };

  const render = (items: string[]) => {
    dropdown.innerHTML = '';
    activeIndex = -1;
    if (items.length === 0) {
      close();
      return;
    }
    for (const name of items) {
      const item = document.createElement('div');
      item.className = 'ac-dropdown__item';
      item.textContent = name;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault(); // prevent blur from firing before selection
        input.value = name;
        close();
        input.blur(); // trigger any existing blur handlers (e.g. roster defaults)
      });
      dropdown.appendChild(item);
    }
    dropdown.classList.add('ac-dropdown--open');
  };

  const update = () => {
    const query = normalizeShooterName(input.value);
    if (!query) { close(); return; }

    const all = getSuggestions();
    const matches = all.filter((n) => {
      const norm = normalizeShooterName(n);
      return norm !== query && norm.includes(query);
    }).slice(0, 8);

    render(matches);
  };

  const setActive = (idx: number) => {
    const items = dropdown.querySelectorAll<HTMLElement>('.ac-dropdown__item');
    for (const it of items) it.classList.remove('ac-dropdown__item--active');
    activeIndex = idx;
    if (idx >= 0 && idx < items.length) {
      items[idx]!.classList.add('ac-dropdown__item--active');
      items[idx]!.scrollIntoView({ block: 'nearest' });
    }
  };

  input.addEventListener('input', update);

  input.addEventListener('keydown', (e: KeyboardEvent) => {
    const isOpen = dropdown.classList.contains('ac-dropdown--open');
    if (!isOpen) return;

    const items = dropdown.querySelectorAll('.ac-dropdown__item');
    const count = items.length;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(activeIndex < count - 1 ? activeIndex + 1 : 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(activeIndex > 0 ? activeIndex - 1 : count - 1);
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const selected = items[activeIndex]?.textContent ?? '';
      input.value = selected;
      close();
      input.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      close();
    }
  });

  wrapper.addEventListener('focusout', (e: FocusEvent) => {
    // Close only if focus left the wrapper entirely
    if (!wrapper.contains(e.relatedTarget as Node)) close();
  });
}

// ── Status helper (admin-status element pattern) ────────────────────────────

export function setStatus(
  el: Element | null,
  message: string,
  type: '' | 'success' | 'error' | 'info',
): void {
  if (!el) return;
  el.textContent = message;
  el.className = `admin-status${type ? ` admin-status--${type}` : ''}`;
}
