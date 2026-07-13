/**
 * Team Management tab — team list with inline edit + roster modal launcher.
 *
 * Owns the team table (name + captain + actions per row) and the inline
 * add/edit row for team meta. The roster editor is its own self-contained
 * dialog — see `./roster-modal.ts`.
 *
 * Reads shared teams cache from the shell via `ctx.getTeamsData()` and
 * triggers refreshes via `ctx.refreshTeams()`. Re-renders on
 * `onTeamsChanged()`.
 */

import { ScoreService } from '@/services/score-service';
import { showToast } from '@/modules/ui';
import {
  PENCIL_SVG,
  ROSTER_SVG,
  TRASH_SVG,
  attachAutocomplete,
  showConfirmDialog,
} from './admin-shared';
import { openRosterModal } from './roster-modal';
import type { AdminTab, AdminTabContext } from './types';

/** Sentinel value used to indicate an "add new team" row is open. */
const NEW_TEAM_SENTINEL = '__new__';

export class TeamManagementTab implements AdminTab {
  private _host: HTMLElement | null = null;
  private _ctx: AdminTabContext | null = null;
  private readonly _scoreService: ScoreService;

  /** null = no edit open; NEW_TEAM_SENTINEL = add row open; else = teamId being edited */
  private _editingTeamId: string | null = null;

  constructor(scoreService: ScoreService) {
    this._scoreService = scoreService;
  }

  mount(host: HTMLElement, ctx: AdminTabContext): void {
    this._host = host;
    this._ctx = ctx;
    host.innerHTML = `<div id="ap-team-list"></div>`;
    this._renderTeamList();
  }

  onYearChange(): void {
    this._editingTeamId = null;
    // Re-render after teams cache refresh — handled in onTeamsChanged.
  }

  onTeamsChanged(): void {
    this._renderTeamList();
  }

  // ── Team list with inline editing ─────────────────────────────────────────

  private _renderTeamList(): void {
    const host = this._host;
    if (!host) return;
    const container = host.querySelector('#ap-team-list');
    if (!container) return;
    while (container.firstChild) container.removeChild(container.firstChild);

    const teams = this._ctx?.getTeamsData() ?? [];
    const editing = this._editingTeamId;

    const heading = document.createElement('h3');
    heading.className = 'admin-team-heading';
    heading.textContent = 'Teams';
    container.appendChild(heading);

    const hasRows = teams.length > 0 || editing === NEW_TEAM_SENTINEL;

    if (hasRows) {
      const table = document.createElement('table');
      table.className = 'admin-team-table';

      const thead = table.createTHead();
      const hrow = thead.insertRow();
      for (const label of ['Team Name', 'Captain', '']) {
        const th = document.createElement('th');
        th.textContent = label;
        hrow.appendChild(th);
      }

      const tbody = table.createTBody();

      for (const team of teams) {
        const tr = tbody.insertRow();
        if (editing === team.id) {
          this._buildEditRow(tr, team.name, team.captain, team.id);
        } else {
          this._buildDisplayRow(tr, team.name, team.captain, team.id, editing !== null);
        }
      }

      if (editing === NEW_TEAM_SENTINEL) {
        const tr = tbody.insertRow();
        this._buildEditRow(tr, '', '', NEW_TEAM_SENTINEL);
      }

      const tableWrapper = document.createElement('div');
      tableWrapper.className = 'admin-table-wrapper';
      tableWrapper.appendChild(table);
      container.appendChild(tableWrapper);
    } else {
      const empty = document.createElement('p');
      empty.className = 'admin-team-empty';
      empty.textContent = 'No teams for this year. Click "+ Add Team" to create one.';
      container.appendChild(empty);
    }

    // "+ Add Team" button — disabled while any edit is open
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-secondary admin-add-team-btn';
    addBtn.textContent = '+ Add Team';
    addBtn.disabled = editing !== null;
    addBtn.addEventListener('click', () => {
      this._editingTeamId = NEW_TEAM_SENTINEL;
      this._renderTeamList();
      setTimeout(() => {
        this._host?.querySelector<HTMLInputElement>('.ap-team-edit-name')?.focus();
      }, 0);
    });
    container.appendChild(addBtn);
  }

  private _buildDisplayRow(
    tr: HTMLTableRowElement,
    name: string,
    captain: string,
    teamId: string,
    otherEditOpen: boolean,
  ): void {
    const nameCell = tr.insertCell();
    nameCell.textContent = name;

    const captainCell = tr.insertCell();
    captainCell.textContent = captain;

    const actionsCell = tr.insertCell();
    actionsCell.className = 'admin-team-actions';

    const pencilBtn = document.createElement('button');
    pencilBtn.type = 'button';
    pencilBtn.className = 'admin-icon-btn';
    pencilBtn.setAttribute('aria-label', `Edit ${name}`);
    pencilBtn.disabled = otherEditOpen;
    pencilBtn.setAttribute('data-tooltip', 'Edit name & captain');
    pencilBtn.innerHTML = PENCIL_SVG;
    pencilBtn.addEventListener('click', () => {
      this._editingTeamId = teamId;
      this._renderTeamList();
      setTimeout(() => {
        this._host?.querySelector<HTMLInputElement>('.ap-team-edit-name')?.focus();
      }, 0);
    });
    actionsCell.appendChild(pencilBtn);

    const rosterBtn = document.createElement('button');
    rosterBtn.type = 'button';
    rosterBtn.className = 'admin-icon-btn';
    rosterBtn.setAttribute('aria-label', `Edit roster for ${name}`);
    rosterBtn.disabled = otherEditOpen;
    rosterBtn.setAttribute('data-tooltip', 'Edit roster');
    rosterBtn.innerHTML = ROSTER_SVG;
    rosterBtn.addEventListener('click', () => this._launchRosterModal(teamId, name));
    actionsCell.appendChild(rosterBtn);

    const trashBtn = document.createElement('button');
    trashBtn.type = 'button';
    trashBtn.className = 'admin-icon-btn admin-icon-btn--danger';
    trashBtn.setAttribute('aria-label', `Delete ${name}`);
    trashBtn.disabled = otherEditOpen;
    trashBtn.setAttribute('data-tooltip', 'Delete team');
    trashBtn.innerHTML = TRASH_SVG;
    trashBtn.addEventListener('click', () => {
      const year = this._ctx?.getYear() ?? 0;
      void this._confirmDeleteTeam(year, teamId, name);
    });
    actionsCell.appendChild(trashBtn);
  }

  private _buildEditRow(
    tr: HTMLTableRowElement,
    name: string,
    captain: string,
    teamId: string,
  ): void {
    tr.className = 'admin-team-row--editing';

    const nameCell = tr.insertCell();
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'admin-input ap-team-edit-name';
    nameInput.value = name;
    nameInput.placeholder = 'Team name';
    nameInput.autocomplete = 'off';
    nameCell.appendChild(nameInput);
    attachAutocomplete(nameInput, () => this._ctx?.getTeamNames() ?? []);

    const captainCell = tr.insertCell();
    const captainInput = document.createElement('input');
    captainInput.type = 'text';
    captainInput.className = 'admin-input ap-team-edit-captain';
    captainInput.value = captain;
    captainInput.placeholder = 'Captain name';
    captainInput.autocomplete = 'off';
    captainCell.appendChild(captainInput);
    attachAutocomplete(captainInput, () => this._ctx?.getCurrentYearShooterNames() ?? []);

    const actionsCell = tr.insertCell();
    actionsCell.className = 'admin-team-actions admin-team-actions--edit';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn-primary';
    saveBtn.textContent = teamId === NEW_TEAM_SENTINEL ? 'Add' : 'Save';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn-secondary';
    cancelBtn.textContent = 'Cancel';

    const setDisabled = (v: boolean) => {
      saveBtn.disabled = v;
      cancelBtn.disabled = v;
      nameInput.disabled = v;
      captainInput.disabled = v;
    };

    saveBtn.addEventListener('click', () => {
      const n = nameInput.value.trim();
      const c = captainInput.value.trim();
      if (!n || (teamId !== NEW_TEAM_SENTINEL && !c)) {
        showToast('error', 'Team name is required. Captain is required when editing.');
        nameInput.focus();
        return;
      }
      setDisabled(true);
      if (teamId === NEW_TEAM_SENTINEL) {
        void this._submitAddTeam(n, c, setDisabled);
      } else {
        void this._submitUpdateTeam(teamId, n, c, setDisabled);
      }
    });

    const onEnter = (e: KeyboardEvent) => {
      if (e.key === 'Enter') saveBtn.click();
    };
    nameInput.addEventListener('keydown', onEnter);
    captainInput.addEventListener('keydown', onEnter);

    cancelBtn.addEventListener('click', () => {
      this._editingTeamId = null;
      this._renderTeamList();
    });

    actionsCell.appendChild(saveBtn);
    actionsCell.appendChild(cancelBtn);
  }

  private async _submitAddTeam(
    name: string,
    captain: string,
    setDisabled: (v: boolean) => void,
  ): Promise<void> {
    const year = this._ctx?.getYear() ?? 0;
    const result = await this._scoreService.createTeam(year, name, captain);
    setDisabled(false);

    if (result.success) {
      this._editingTeamId = null;
      showToast('success', `Team "${result.data.name}" created for ${year}.`);
      void this._ctx?.refreshTeams();
    } else {
      showToast('error', `Failed to create team: ${result.error}`);
    }
  }

  private async _submitUpdateTeam(
    teamId: string,
    name: string,
    captain: string,
    setDisabled: (v: boolean) => void,
  ): Promise<void> {
    const year = this._ctx?.getYear() ?? 0;
    const result = await this._scoreService.updateTeamMeta(year, teamId, name, captain);
    setDisabled(false);

    if (result.success) {
      this._editingTeamId = null;
      showToast('success', `Team updated.`);
      void this._ctx?.refreshTeams();
    } else {
      showToast('error', `Failed to update team: ${result.error}`);
    }
  }

  private async _confirmDeleteTeam(year: number, teamId: string, teamName: string): Promise<void> {
    // Spec 005 DD-4: deletion exists to fix data-entry mistakes, not to
    // retire a real team. Published rank points survive the delete itself,
    // but the next publish re-derives history without the team — say so when
    // it applies. (Cached read; a failure just falls back to the short text.)
    const weeksResult = await this._scoreService.getAllWeekResults(year);
    const hasPublishedResults =
      weeksResult.success &&
      weeksResult.data.some((w) => (w.teamResults ?? []).some((tr) => tr.teamId === teamId));
    const publishedNote = hasPublishedResults
      ? ' This team has published weekly results: they are kept for now, but the next publish will recompute season history as if the team never participated.'
      : '';
    const confirmed = await showConfirmDialog({
      title: 'Delete Team',
      warning: `This will permanently remove "${teamName}" and all its score entries from the ${year} season.${publishedNote} This cannot be undone.`,
      nameToType: teamName,
      deleteLabel: 'Delete Team',
    });
    if (!confirmed) return;

    const result = await this._scoreService.deleteTeam(year, teamId);
    if (result.success) {
      showToast('success', `Team "${teamName}" deleted from ${year}.`);
      void this._ctx?.refreshTeams();
    } else if (result.code === 'STANDINGS_RECOMPUTE_FAILED') {
      // The team is gone; only the standings refresh failed. Republishing a
      // week (or retrying the delete flow) rebuilds them.
      showToast('warning', `Team "${teamName}" deleted, but standings recompute failed — republish a week to rebuild standings.`);
      void this._ctx?.refreshTeams();
    } else {
      showToast('error', `Failed to delete team: ${result.error}`);
    }
  }

  private _launchRosterModal(teamId: string, teamName: string): void {
    const ctx = this._ctx;
    if (!ctx) return;
    openRosterModal({
      teamId,
      teamName,
      ctx,
      scoreService: this._scoreService,
      onSaved: () => void ctx.refreshTeams(),
    });
  }
}
