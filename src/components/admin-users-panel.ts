/**
 * <admin-users-panel> — Custom Element rendering the Users tab.
 *
 * Visible to owner + admin (gated upstream by main.ts route guard +
 * the admin-panel-container DOM toggle in main.ts._applyAdminViewState).
 *
 * Responsibilities:
 *   - Render a paginated user list with displayName / email / role /
 *     last sign-in / created.
 *   - For owner: render a role <select> per row that calls
 *     setUserRole; for admin: plain-text role.
 *   - Confirmation dialog before any role change; toast feedback on
 *     success or callable error (mapped to operator-friendly text).
 *
 * Lifecycle: subscribes to onRoleChange in connectedCallback so the
 * dropdown vs. text rendering updates live if the current user's
 * role changes mid-session. Unsubscribes in disconnectedCallback to
 * comply with constitution §IV.2 (no leaked listeners).
 */

import type { Timestamp, DocumentSnapshot } from 'firebase/firestore';
import { onRoleChange } from '@/modules/role';
import { escapeHtml, showToast } from '@/modules/ui';
import {
  listUsers,
  setUserRole,
  setUserRoleErrorMessage,
} from '@/services/admin-user-service';
import type { Role, UserDoc } from '@/types/user';
import { ROLES } from '@/types/user';

const PAGE_SIZE = 20;

function fmtTimestamp(ts: Timestamp | null | undefined, withTime: boolean): string {
  if (!ts || typeof ts.toDate !== 'function') return '—';
  const iso = ts.toDate().toISOString();
  return withTime ? iso.slice(0, 16).replace('T', ' ') : iso.slice(0, 10);
}

class AdminUsersPanel extends HTMLElement {
  private _users: UserDoc[] = [];
  private _nextCursor: DocumentSnapshot | null = null;
  private _currentRole: Role | null = null;
  private _roleUnsub: (() => void) | null = null;
  private _loading = false;
  private _initialized = false;

  connectedCallback(): void {
    this.innerHTML = `
      <section class="users-panel">
        <h2>Users</h2>
        <div class="users-panel__status" aria-live="polite"></div>
        <table class="users-table" hidden>
          <thead>
            <tr>
              <th scope="col">Display name</th>
              <th scope="col">Email</th>
              <th scope="col">Role</th>
              <th scope="col">Last sign-in</th>
              <th scope="col">Created</th>
            </tr>
          </thead>
          <tbody class="users-table__body"></tbody>
        </table>
        <div class="users-panel__empty" hidden>No users yet.</div>
        <div class="users-panel__error" hidden role="alert"></div>
        <button type="button" class="users-panel__load-more btn-secondary" hidden>Load more</button>
      </section>
    `;

    this.querySelector('.users-table__body')
      ?.addEventListener('change', (e) => this._handleRoleChange(e));
    this.querySelector('.users-panel__load-more')
      ?.addEventListener('click', () => void this._fetch(true));

    this._roleUnsub = onRoleChange((role) => {
      const previous = this._currentRole;
      this._currentRole = role;
      if (this._initialized) {
        // Only owner/admin should see this component, but the role
        // observer still fires; if owner ↔ admin, re-render rows so
        // the dropdown vs. text changes accordingly.
        if (previous !== role) this._renderRows();
      } else if (role === 'owner' || role === 'admin') {
        // First fire with elevated role — initial fetch.
        this._initialized = true;
        void this._fetch(false);
      }
    });
  }

  disconnectedCallback(): void {
    this._roleUnsub?.();
    this._roleUnsub = null;
  }

  // ─── Data flow ──────────────────────────────────────────────────────────────

  private async _fetch(append: boolean): Promise<void> {
    if (this._loading) return;
    this._loading = true;
    this._setStatus(append ? 'Loading more…' : 'Loading users…');
    this._setError(null);

    try {
      const page = await listUsers({
        pageSize: PAGE_SIZE,
        cursor: append ? this._nextCursor : null,
      });
      if (append) {
        this._users.push(...page.users);
      } else {
        this._users = page.users;
      }
      this._nextCursor = page.nextCursor;
      this._renderRows();
      this._setStatus('');
    } catch (e) {
      console.error('[admin-users-panel] fetch error:', e);
      this._setError('Could not load users. See console for details.');
      this._setStatus('');
    } finally {
      this._loading = false;
    }
  }

  private _renderRows(): void {
    const tbody = this.querySelector<HTMLTableSectionElement>('.users-table__body');
    const table = this.querySelector<HTMLTableElement>('.users-table');
    const empty = this.querySelector<HTMLElement>('.users-panel__empty');
    const loadMore = this.querySelector<HTMLButtonElement>('.users-panel__load-more');
    if (!tbody || !table || !empty || !loadMore) return;

    if (this._users.length === 0) {
      table.hidden = true;
      empty.hidden = false;
      loadMore.hidden = true;
      return;
    }

    table.hidden = false;
    empty.hidden = true;
    loadMore.hidden = this._nextCursor === null;

    const isOwner = this._currentRole === 'owner';
    tbody.innerHTML = this._users.map((u) => this._rowHtml(u, isOwner)).join('');
  }

  private _rowHtml(user: UserDoc, isOwner: boolean): string {
    const uid = escapeHtml(user.uid);
    const display = escapeHtml(user.displayName ?? '—');
    const email = escapeHtml(user.email ?? '—');
    const lastSignIn = escapeHtml(fmtTimestamp(user.lastSignInAt ?? null, true));
    const createdAt = escapeHtml(fmtTimestamp(user.createdAt ?? null, false));

    const roleCell = isOwner
      ? `<select class="users-table__role-select" data-uid="${uid}" data-current="${user.role}" aria-label="Role for ${display}">
          ${ROLES.map((r) => `<option value="${r}"${r === user.role ? ' selected' : ''}>${r}</option>`).join('')}
        </select>`
      : escapeHtml(user.role);

    return `
      <tr data-uid="${uid}">
        <td>${display}</td>
        <td>${email}</td>
        <td>${roleCell}</td>
        <td>${lastSignIn}</td>
        <td>${createdAt}</td>
      </tr>
    `;
  }

  // ─── Role change handling ───────────────────────────────────────────────────

  private async _handleRoleChange(e: Event): Promise<void> {
    const target = e.target as HTMLElement | null;
    if (!target?.classList.contains('users-table__role-select')) return;
    const select = target as HTMLSelectElement;

    const targetUid = select.dataset['uid'];
    const previousRole = select.dataset['current'] as Role | undefined;
    const newRole = select.value as Role;

    if (!targetUid || !previousRole || previousRole === newRole) return;

    const user = this._users.find((u) => u.uid === targetUid);
    const display = user?.displayName ?? user?.email ?? targetUid;

    const ok = window.confirm(
      `Change ${display}'s role from ${previousRole} to ${newRole}?`,
    );
    if (!ok) {
      select.value = previousRole;
      return;
    }

    select.disabled = true;
    const result = await setUserRole(targetUid, newRole);
    select.disabled = false;

    if (result.ok) {
      showToast('success', `Role changed: ${display} → ${newRole}`);
      // Update local state so subsequent dropdown changes have the
      // correct from-role baseline. Mirror writes are propagated by
      // the server but we don't refetch the whole page.
      if (user) {
        user.role = newRole;
      }
      select.dataset['current'] = newRole;
    } else {
      const message = setUserRoleErrorMessage(result.code);
      showToast('error', message);
      // Revert the dropdown so it stays in sync with reality.
      select.value = previousRole;
      console.error('[admin-users-panel] setUserRole failed:', result);
    }
  }

  // ─── DOM helpers ────────────────────────────────────────────────────────────

  private _setStatus(message: string): void {
    const el = this.querySelector('.users-panel__status');
    if (el) el.textContent = message;
  }

  private _setError(message: string | null): void {
    const el = this.querySelector<HTMLElement>('.users-panel__error');
    if (!el) return;
    if (message) {
      el.textContent = message;
      el.hidden = false;
    } else {
      el.textContent = '';
      el.hidden = true;
    }
  }
}

if (!customElements.get('admin-users-panel')) {
  customElements.define('admin-users-panel', AdminUsersPanel);
}
