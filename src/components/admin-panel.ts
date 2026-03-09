/**
 * admin-panel — Custom Element
 *
 * Two-tab admin portal:
 *   - Team Management: team list with inline name/captain editing, roster editor
 *   - Score Entry: enter weekly scores, publish results
 *
 * Primary storage: Firestore via ScoreService (requires auth).
 * No shadow DOM. All user values rendered via textContent (never innerHTML),
 * except static SVG icon markup.
 */

import { db } from '@/firebase-config';
import { createRepositoryFactory } from '@/repositories/repository-factory';
import { ScoreService } from '@/services/score-service';
import { showToast } from '@/modules/ui';
import { normalizeShooterName } from '@/services/scoring-engine';
import { computeSchedule } from '@/utils/schedule';
import type { Team } from '@/types/score';
import type { Shooter } from '@/types/shooter';
import type { Season } from '@/types/season';

const factory = createRepositoryFactory({ db });
const scoreService = new ScoreService(factory.getScoreRepository());

const CURRENT_YEAR = new Date().getFullYear();
const MAX_WEEKS = 15;
const MAX_SCORE = 25;

// Sentinel value used to indicate an "add new team" row is open
const NEW_TEAM_SENTINEL = '__new__';

const PENCIL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="16 3 21 8 8 21 3 21 3 16 16 3"/></svg>`;
const TRASH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
const ROSTER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512" aria-hidden="true"><path fill="currentColor" d="M40 48C26.7 48 16 58.7 16 72v48c0 13.3 10.7 24 24 24H88c13.3 0 24-10.7 24-24V72c0-13.3-10.7-24-24-24H40zm152 16c-17.7 0-32 14.3-32 32s14.3 32 32 32H488c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32H488c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32H488c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zM16 232v48c0 13.3 10.7 24 24 24H88c13.3 0 24-10.7 24-24V232c0-13.3-10.7-24-24-24H40c-13.3 0-24 10.7-24 24zM40 368c-13.3 0-24 10.7-24 24v48c0 13.3 10.7 24 24 24H88c13.3 0 24-10.7 24-24V392c0-13.3-10.7-24-24-24H40z"/></svg>`;
const LOCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
const WARN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

function buildOptions(min: number, max: number, label: string, selected: number): string {
  let html = '';
  for (let i = min; i <= max; i++) {
    html += `<option value="${i}"${i === selected ? ' selected' : ''}>${label ? `${label} ${i}` : i}</option>`;
  }
  return html;
}

class AdminPanel extends HTMLElement {
  private _teamsData: Team[] | null = null;
  private _seasonData: Season | null = null;
  private _rosterOriginalShooters: Shooter[] = [];
  /** null = no edit open; NEW_TEAM_SENTINEL = add row open; else = teamId being edited */
  private _editingTeamId: string | null = null;
  /** Shooter names removed from roster DOM but not yet written to Firestore */
  private _pendingRemovals: string[] = [];
  /** Whether the date override card is in edit mode */
  private _dateEditMode = false;
  /** Whether any entries have been saved for the currently selected week */
  private _weekHasScores = false;

  // ── Roster modal state ────────────────────────────────────────────────────
  private _rosterDialog: HTMLDialogElement | null = null;
  private _rosterTbody: HTMLTableSectionElement | null = null;
  private _rosterSaveBtn: HTMLButtonElement | null = null;
  private _rosterStatusEl: Element | null = null;
  private _rosterTeamId: string = '';

  connectedCallback(): void {
    this.innerHTML = `
      <div class="admin-panel">
        <div class="admin-tabs">
          <button class="admin-tab-btn is-active" data-tab="team-mgmt">Team Management</button>
          <button class="admin-tab-btn" data-tab="score-entry">Score Entry</button>
        </div>

        <div class="admin-form-row">
          <label for="ap-year">Year</label>
          <select id="ap-year">${buildOptions(2019, 2030, '', CURRENT_YEAR)}</select>
        </div>

        <!-- ── Team Management Panel ── -->
        <div id="ap-panel-team-mgmt" class="admin-tab-content">

          <div id="ap-team-list"></div>

        </div>

        <!-- ── Score Entry Panel ── -->
        <div id="ap-panel-score-entry" class="admin-tab-content admin-tab-panel--hidden">

          <div class="admin-form-row">
            <label for="ap-week">Week</label>
            <select id="ap-week">${buildOptions(1, MAX_WEEKS, 'Week', 1)}</select>
            <label for="ap-team">Team</label>
            <select id="ap-team">
              <option value="">-- Select team --</option>
            </select>
          </div>

          <div id="ap-date-section"></div>

          <h3>Shooters</h3>
          <table class="admin-shooters-table">
            <thead>
              <tr><th>Name</th><th>Score 1 (0–25)</th><th>Score 2 (0–25)</th><th>Total</th><th></th></tr>
            </thead>
            <tbody id="ap-shooters-body"></tbody>
          </table>
          <div class="admin-actions">
            <button id="ap-save" class="btn-primary">Save Entry</button>
          </div>
          <p id="ap-status" class="admin-status" aria-live="polite"></p>

          <h3>Saved Entries</h3>
          <ul id="ap-saved-list" class="admin-saved-list"></ul>

          <div class="admin-publish-section">
            <h3>Publish</h3>
            <p class="admin-publish-note">Publishing runs the scoring engine over all saved entries and writes computed results to Firestore.</p>
            <div class="admin-actions">
              <button id="ap-publish" class="btn-danger">Publish Week</button>
            </div>
            <p id="ap-publish-status" class="admin-status" aria-live="polite"></p>
          </div>

        </div>
      </div>`;

    // Tab switching
    for (const btn of this.querySelectorAll<HTMLButtonElement>('.admin-tab-btn')) {
      btn.addEventListener('click', () => this._switchTab(btn.dataset['tab'] ?? ''));
    }

    // Shared year listener — reset any open edit when year changes
    this.querySelector('#ap-year')!.addEventListener('change', () => {
      this._editingTeamId = null;
      this._dateEditMode = false;
      this._weekHasScores = false;
      void this._fetchTeamsData();
      void this._fetchSeasonData();
      void this._loadSavedEntries();
    });

    // Score entry listeners
    this.querySelector('#ap-week')!.addEventListener('change', () => {
      this._dateEditMode = false;
      this._weekHasScores = false;
      this._updateDateSection();
      void this._populateShooterRows();
      void this._loadSavedEntries();
    });
    this.querySelector('#ap-team')!.addEventListener('change', () => void this._populateShooterRows());
    this.querySelector('#ap-save')!.addEventListener('click', () => void this._saveEntry());
    this.querySelector('#ap-publish')!.addEventListener('click', () => void this._publishWeek());

    void this._fetchTeamsData();
    void this._fetchSeasonData();
    void this._loadSavedEntries();
  }

  // ── Tab switching ────────────────────────────────────────────────────────

  private _switchTab(tab: string): void {
    for (const btn of this.querySelectorAll<HTMLButtonElement>('.admin-tab-btn')) {
      btn.classList.toggle('is-active', btn.dataset['tab'] === tab);
    }
    for (const { id, name } of [
      { id: 'ap-panel-team-mgmt', name: 'team-mgmt' },
      { id: 'ap-panel-score-entry', name: 'score-entry' },
    ]) {
      const el = this.querySelector(`#${id}`);
      if (el) el.classList.toggle('admin-tab-panel--hidden', name !== tab);
    }
  }

  // ── Data loading ─────────────────────────────────────────────────────────

  private async _fetchTeamsData(): Promise<void> {
    const year = parseInt(this.querySelector<HTMLSelectElement>('#ap-year')!.value, 10);
    this._pendingRemovals = [];
    const result = await scoreService.getTeams(year);
    if (result.success) {
      this._teamsData = result.data;
    } else {
      console.warn('admin-panel: could not load teams data:', result.error);
      this._teamsData = [];
    }
    this._renderTeamList();
    this._populateTeamSelect('#ap-team');
    void this._populateShooterRows();
  }

  private _populateTeamSelect(selector: string): void {
    const select = this.querySelector<HTMLSelectElement>(selector);
    if (!select) return;
    const teams = this._teamsData ?? [];

    while (select.firstChild) select.removeChild(select.firstChild);

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = teams.length ? '-- Select team --' : 'No teams available for this year';
    select.appendChild(placeholder);

    for (const team of teams) {
      const opt = document.createElement('option');
      opt.value = team.id;
      opt.textContent = team.name;
      select.appendChild(opt);
    }
  }

  // ── Team list with inline editing ─────────────────────────────────────────

  private _renderTeamList(): void {
    const container = this.querySelector('#ap-team-list');
    if (!container) return;
    while (container.firstChild) container.removeChild(container.firstChild);

    const teams = this._teamsData ?? [];
    const editing = this._editingTeamId;

    // Section heading
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
      tableWrapper.className = 'admin-team-table-wrapper';
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
      // Focus the name input after render
      setTimeout(() => {
        this.querySelector<HTMLInputElement>('.ap-team-edit-name')?.focus();
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
    pencilBtn.innerHTML = PENCIL_SVG;
    pencilBtn.addEventListener('click', () => {
      this._editingTeamId = teamId;
      this._renderTeamList();
      setTimeout(() => {
        this.querySelector<HTMLInputElement>('.ap-team-edit-name')?.focus();
      }, 0);
    });
    actionsCell.appendChild(pencilBtn);

    const rosterBtn = document.createElement('button');
    rosterBtn.type = 'button';
    rosterBtn.className = 'admin-icon-btn';
    rosterBtn.setAttribute('aria-label', `Edit roster for ${name}`);
    rosterBtn.disabled = otherEditOpen;
    rosterBtn.innerHTML = ROSTER_SVG;
    rosterBtn.addEventListener('click', () => this._openRosterModal(teamId, name));
    actionsCell.appendChild(rosterBtn);

    const trashBtn = document.createElement('button');
    trashBtn.type = 'button';
    trashBtn.className = 'admin-icon-btn admin-icon-btn--danger';
    trashBtn.setAttribute('aria-label', `Delete ${name}`);
    trashBtn.disabled = otherEditOpen;
    trashBtn.innerHTML = TRASH_SVG;
    trashBtn.addEventListener('click', () => {
      const year = parseInt(this.querySelector<HTMLSelectElement>('#ap-year')!.value, 10);
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

    const captainCell = tr.insertCell();
    const captainInput = document.createElement('input');
    captainInput.type = 'text';
    captainInput.className = 'admin-input ap-team-edit-captain';
    captainInput.value = captain;
    captainInput.placeholder = 'Captain name';
    captainInput.autocomplete = 'off';
    captainCell.appendChild(captainInput);

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

    // Allow Enter key to submit
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
    const year = parseInt(this.querySelector<HTMLSelectElement>('#ap-year')!.value, 10);
    const result = await scoreService.createTeam(year, name, captain);
    setDisabled(false);

    if (result.success) {
      this._editingTeamId = null;
      showToast('success', `Team "${result.data.name}" created for ${year}.`);
      void this._fetchTeamsData();
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
    const year = parseInt(this.querySelector<HTMLSelectElement>('#ap-year')!.value, 10);
    const result = await scoreService.updateTeamMeta(year, teamId, name, captain);
    setDisabled(false);

    if (result.success) {
      this._editingTeamId = null;
      showToast('success', `Team updated.`);
      void this._fetchTeamsData();
    } else {
      showToast('error', `Failed to update team: ${result.error}`);
    }
  }

  // ── Score Entry ──────────────────────────────────────────────────────────

  private async _populateShooterRows(): Promise<void> {
    const year = parseInt(this.querySelector<HTMLSelectElement>('#ap-year')!.value, 10);
    const weekNumber = parseInt(this.querySelector<HTMLSelectElement>('#ap-week')!.value, 10);
    const teamId = this.querySelector<HTMLSelectElement>('#ap-team')?.value ?? '';
    const tbody = this.querySelector('#ap-shooters-body');
    if (!tbody) return;

    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

    // 1. Try to load existing saved entry first
    if (teamId) {
      const entryResult = await scoreService.getEntry(year, weekNumber, teamId);
      if (entryResult.success && entryResult.data !== null) {
        const team = this._teamsData?.find((t) => t.id === teamId);
        const rosterNames = team ? new Set(team.shooters.map((s) => s.name)) : null;
        const entryNames = new Set(entryResult.data.shooters.map((s) => s.name));
        for (const s of entryResult.data.shooters) {
          // Skip shooters who have since been removed from the roster
          if (rosterNames && !rosterNames.has(s.name)) continue;
          this._addShooterRow(s.name, s.score1 ?? undefined, s.score2 ?? undefined);
        }
        // Add any roster members not yet in the saved entry
        if (team) {
          for (const shooter of team.shooters) {
            if (!entryNames.has(shooter.name)) this._addShooterRow(shooter.name);
          }
        }
        return;
      }
    }

    // 2. Fall back to roster
    const team = this._teamsData?.find((t) => t.id === teamId);
    if (team) {
      for (const shooter of team.shooters) this._addShooterRow(shooter.name);
    }
    // no-team-selected branch: leave tbody empty (user must select a team)
  }

  private _addShooterRow(prefilledName = '', score1?: number, score2?: number): void {
    const tbody = this.querySelector('#ap-shooters-body');
    if (!tbody) return;
    const row = document.createElement('tr');
    row.className = 'ap-shooter-row';
    if (prefilledName) row.dataset['name'] = prefilledName;

    const nameCell = document.createElement('td');
    if (prefilledName) {
      nameCell.textContent = prefilledName;
      nameCell.className = 'ap-shooter-name-cell';
    } else {
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'ap-shooter-name';
      nameInput.placeholder = 'Shooter name';
      nameInput.autocomplete = 'off';
      nameCell.appendChild(nameInput);
    }

    const s1 = this._scoreInput();
    const s2 = this._scoreInput();

    if (score1 !== undefined) s1.value = String(score1);
    if (score2 !== undefined) s2.value = String(score2);

    const totalCell = document.createElement('td');
    totalCell.className = 'ap-shooter-total';

    const updateTotal = () => {
      const v1 = parseInt(s1.value, 10);
      const v2 = parseInt(s2.value, 10);
      totalCell.textContent = (!isNaN(v1) && !isNaN(v2)) ? String(v1 + v2) : '—';
    };
    s1.addEventListener('input', updateTotal);
    s2.addEventListener('input', updateTotal);
    updateTotal();

    const td = (child: HTMLElement) => {
      const c = document.createElement('td');
      c.appendChild(child);
      return c;
    };
    row.appendChild(nameCell);
    row.appendChild(td(s1));
    row.appendChild(td(s2));
    row.appendChild(totalCell);
    if (!prefilledName) {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = '✕';
      removeBtn.className = 'ap-remove-shooter';
      removeBtn.addEventListener('click', () => tbody.removeChild(row));
      row.appendChild(td(removeBtn));
    } else {
      row.appendChild(document.createElement('td')); // keep column alignment
    }
    tbody.appendChild(row);
  }

  private _scoreInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = String(MAX_SCORE);
    input.className = 'ap-score-input';
    return input;
  }

  private async _saveEntry(): Promise<void> {
    const year = parseInt(this.querySelector<HTMLSelectElement>('#ap-year')!.value, 10);
    const weekNumber = parseInt(this.querySelector<HTMLSelectElement>('#ap-week')!.value, 10);
    const teamSelect = this.querySelector<HTMLSelectElement>('#ap-team')!;
    const teamName = teamSelect.options[teamSelect.selectedIndex]?.text ?? '';
    const teamId = teamSelect.value;

    if (!teamId) { this._setStatus('Team selection is required.', 'error'); return; }

    const shooters: { name: string; score1: number; score2: number; total: number }[] = [];
    for (const row of this.querySelectorAll('.ap-shooter-row')) {
      const rowEl = row as HTMLElement;
      const name = (rowEl.dataset['name'] ?? row.querySelector<HTMLInputElement>('.ap-shooter-name')?.value ?? '').trim();
      const inputs = row.querySelectorAll<HTMLInputElement>('.ap-score-input');
      const score1Raw = inputs[0]?.value ?? '';
      const score2Raw = inputs[1]?.value ?? '';

      // Both inputs empty → shooter did not shoot; exclude from entry (stays null in scoring engine)
      if (score1Raw === '' && score2Raw === '') continue;
      if (!name) { this._setStatus('All shooter rows must have a name.', 'error'); return; }

      const score1 = score1Raw !== '' ? parseInt(score1Raw, 10) : 0;
      const score2 = score2Raw !== '' ? parseInt(score2Raw, 10) : 0;
      if (isNaN(score1) || score1 < 0 || score1 > MAX_SCORE) {
        this._setStatus(`Score 1 for "${name}" must be 0–${MAX_SCORE}.`, 'error'); return;
      }
      if (isNaN(score2) || score2 < 0 || score2 > MAX_SCORE) {
        this._setStatus(`Score 2 for "${name}" must be 0–${MAX_SCORE}.`, 'error'); return;
      }
      shooters.push({ name, score1, score2, total: score1 + score2 });
    }

    if (shooters.length === 0) {
      this._setStatus('At least one shooter with valid scores is required.', 'error'); return;
    }

    this._setStatus('', '');

    const entry = {
      year,
      weekNumber,
      teamId,
      teamName,
      savedAt: new Date().toISOString(),
      shooters,
    };

    const result = await scoreService.saveEntry(year, entry);
    if (result.success) {
      showToast('success', `Entry saved — ${teamName}, Week ${weekNumber}.`);
    } else {
      showToast('error', `Failed to save entry: ${result.error}`);
    }

    void this._loadSavedEntries();
  }

  private async _loadSavedEntries(): Promise<void> {
    const year = parseInt(this.querySelector<HTMLSelectElement>('#ap-year')?.value ?? '0', 10);
    const weekNumber = parseInt(this.querySelector<HTMLSelectElement>('#ap-week')?.value ?? '0', 10);
    const list = this.querySelector('#ap-saved-list');
    if (!list) return;

    while (list.firstChild) list.removeChild(list.firstChild);

    const result = await scoreService.getEntries(year, weekNumber);

    if (!result.success) {
      console.warn('admin-panel: could not load entries:', result.error);
      const li = document.createElement('li');
      li.textContent = 'No entries for this season/week for this team.';
      list.appendChild(li);
      return;
    }

    const entries = result.data.filter((e) => e.weekNumber === weekNumber);

    // Update score-presence flag and re-render the date card (locking state may have changed)
    this._weekHasScores = entries.length > 0;
    this._updateDateSection();

    if (entries.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No entries saved for this year/week.';
      list.appendChild(li);
      return;
    }

    for (const entry of entries) {
      const li = document.createElement('li');
      li.className = 'admin-saved-item';

      const label = document.createElement('span');
      label.className = 'admin-saved-key';
      label.textContent = `${entry.teamName}`;

      const detail = document.createElement('span');
      detail.textContent = ` — ${entry.shooters?.length ?? 0} shooter(s), saved ${new Date(entry.savedAt).toLocaleString()}`;

      li.appendChild(label);
      li.appendChild(detail);
      list.appendChild(li);
    }
  }

  private async _publishWeek(): Promise<void> {
    const year = parseInt(this.querySelector<HTMLSelectElement>('#ap-year')!.value, 10);
    const weekNumber = parseInt(this.querySelector<HTMLSelectElement>('#ap-week')!.value, 10);
    const btn = this.querySelector<HTMLButtonElement>('#ap-publish')!;

    btn.disabled = true;
    this._setPublishStatus(`Publishing week ${weekNumber}…`, '');

    const result = await scoreService.publishWeek(year, weekNumber);

    btn.disabled = false;
    this._setPublishStatus('', '');

    if (result.success) {
      showToast('success', `Week ${weekNumber} published — standings updated.`);
    } else {
      showToast('error', `Publish failed: ${result.error}`);
    }
  }

  // ── Roster modal ─────────────────────────────────────────────────────────

  private _openRosterModal(teamId: string, teamName: string): void {
    this._pendingRemovals = [];
    this._rosterOriginalShooters = [];
    this._rosterTeamId = teamId;

    // ── Build dialog ──────────────────────────────────────────────────────
    const dialog = document.createElement('dialog');
    dialog.className = 'roster-dialog';

    // Header
    const header = document.createElement('div');
    header.className = 'roster-dialog__header';
    const title = document.createElement('h2');
    title.className = 'roster-dialog__title';
    title.textContent = `Edit Roster — ${teamName}`;
    header.appendChild(title);

    // Roster table (reuses existing .admin-roster-table styles)
    const table = document.createElement('table');
    table.className = 'admin-roster-table';
    const thead = table.createTHead();
    const hrow = thead.insertRow();
    for (const label of ['Name', 'W0 Avg', 'Rookie', '']) {
      const th = document.createElement('th');
      th.textContent = label;
      hrow.appendChild(th);
    }
    const tbody = table.createTBody();
    this._rosterTbody = tbody;

    // Footer
    const footer = document.createElement('div');
    footer.className = 'roster-dialog__footer';

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-secondary';
    addBtn.textContent = 'Add Shooter';

    const rightActions = document.createElement('div');
    rightActions.className = 'admin-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn-secondary';
    cancelBtn.textContent = 'Cancel';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn-primary';
    saveBtn.textContent = 'Save Roster';
    this._rosterSaveBtn = saveBtn;

    rightActions.append(cancelBtn, saveBtn);
    footer.append(addBtn, rightActions);

    // Status
    const statusEl = document.createElement('p');
    statusEl.className = 'admin-status';
    statusEl.setAttribute('aria-live', 'polite');
    this._rosterStatusEl = statusEl;

    dialog.append(header, table, footer, statusEl);
    document.body.appendChild(dialog);
    this._rosterDialog = dialog;

    // ── Wire events ───────────────────────────────────────────────────────
    addBtn.addEventListener('click', () => this._addRosterRow());
    cancelBtn.addEventListener('click', () => this._closeRosterModal());
    saveBtn.addEventListener('click', () => void this._saveRoster());
    dialog.addEventListener('cancel', () => this._closeRosterModal());

    dialog.showModal();

    // ── Load roster data (async) ──────────────────────────────────────────
    void this._loadRosterIntoModal(teamId);
  }

  private async _loadRosterIntoModal(teamId: string): Promise<void> {
    const year = parseInt(this.querySelector<HTMLSelectElement>('#ap-year')!.value, 10);
    this._setRosterStatus('Loading roster\u2026', 'info');

    const result = await scoreService.computeRosterDefaults(year, teamId);
    this._setRosterStatus('', '');

    let team: Team;
    if (result.success) {
      team = result.data;
    } else {
      console.warn('computeRosterDefaults failed, using cached data:', result.error);
      const fallback = this._teamsData?.find((t) => t.id === teamId);
      if (!fallback) return;
      team = fallback;
    }

    this._rosterOriginalShooters = [...team.shooters];
    for (let i = 0; i < team.shooters.length; i++) {
      this._addRosterRow(team.shooters[i], i);
    }
  }

  private _closeRosterModal(): void {
    if (this._rosterDialog) {
      this._rosterDialog.close();
      document.body.removeChild(this._rosterDialog);
    }
    this._rosterDialog = null;
    this._rosterTbody = null;
    this._rosterSaveBtn = null;
    this._rosterStatusEl = null;
    this._rosterTeamId = '';
    this._pendingRemovals = [];
  }

  private _addRosterRow(shooter?: Shooter, originalIndex?: number): void {
    const tbody = this._rosterTbody;
    if (!tbody) return;

    const row = document.createElement('tr');
    row.className = 'ap-roster-row';
    if (originalIndex !== undefined) {
      row.dataset['originalIndex'] = String(originalIndex);
    }

    if (shooter !== undefined) {
      row.dataset['startingAvg'] = String(shooter.startingAvg);
      row.dataset['rookie'] = String(shooter.rookie);
    } else {
      // New shooter: league defaults
      row.dataset['startingAvg'] = '35';
      row.dataset['rookie'] = 'true';
    }

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'ap-roster-name';
    nameInput.placeholder = 'Shooter name';
    nameInput.autocomplete = 'off';
    if (shooter) nameInput.value = shooter.name;

    const avgSpan = document.createElement('span');
    avgSpan.className = 'ap-roster-avg-display';
    const rookieSpan = document.createElement('span');
    rookieSpan.className = 'ap-roster-rookie-display';

    if (shooter !== undefined) {
      avgSpan.textContent = String(shooter.startingAvg);
      rookieSpan.textContent = shooter.rookie ? 'Yes' : 'No';
    } else {
      avgSpan.textContent = '—';
      rookieSpan.textContent = '—';

      nameInput.addEventListener('blur', () => {
        const name = nameInput.value.trim();
        if (!name) return;
        const year = parseInt(
          this.querySelector<HTMLSelectElement>('#ap-year')!.value, 10,
        );
        avgSpan.textContent = '…';
        rookieSpan.textContent = '…';
        void scoreService.computeShooterDefaults(year, name).then((result) => {
          if (!result.success) {
            avgSpan.textContent = '35';
            rookieSpan.textContent = 'Yes';
            return;
          }
          // cross-team duplicate check
          const currentTeamId = this._rosterTeamId;
          const conflict = this._teamsData?.find(
            (t) => t.id !== currentTeamId &&
              t.shooters.some((s) => normalizeShooterName(s.name) === normalizeShooterName(name)),
          );
          if (conflict) {
            showToast('error', `"${name}" is already on team "${conflict.name}".`);
            nameInput.value = '';
            avgSpan.textContent = '—';
            rookieSpan.textContent = '—';
            return;
          }
          row.dataset['startingAvg'] = String(result.data.startingAvg);
          row.dataset['rookie']      = String(result.data.rookie);
          avgSpan.textContent   = String(result.data.startingAvg);
          rookieSpan.textContent = result.data.rookie ? 'Yes' : 'No';
        });
      });
    }

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = '✕';
    removeBtn.className = 'ap-remove-shooter';
    removeBtn.addEventListener('click', () => {
      const name = nameInput.value.trim();
      if (name && this._namedRosterCount() <= 5) {
        this._setRosterStatus('Teams must have at least 5 shooters — cannot remove.', 'error');
        return;
      }
      this._setRosterStatus('', '');
      // Existing shooter with a name: defer cascade removal to Save Roster
      if (originalIndex !== undefined && name) {
        this._pendingRemovals.push(name);
      }
      tbody.removeChild(row);
    });

    const td = (child: HTMLElement) => {
      const c = document.createElement('td');
      c.appendChild(child);
      return c;
    };
    row.appendChild(td(nameInput));
    const avgCell = document.createElement('td');
    avgCell.appendChild(avgSpan);
    row.appendChild(avgCell);
    const rookieCell = document.createElement('td');
    rookieCell.appendChild(rookieSpan);
    row.appendChild(rookieCell);
    row.appendChild(td(removeBtn));
    tbody.appendChild(row);
  }

  private async _saveRoster(): Promise<void> {
    const year = parseInt(this.querySelector<HTMLSelectElement>('#ap-year')!.value, 10);
    const teamId = this._rosterTeamId;

    // Captain comes from team data; derive from first shooter row if blank
    let captain = this._teamsData?.find((t) => t.id === teamId)?.captain ?? '';
    if (!captain) {
      captain = this._rosterTbody?.querySelector<HTMLInputElement>('.ap-roster-name')?.value.trim() ?? '';
    }
    if (!captain) {
      this._setRosterStatus('Add at least one shooter to set a captain.', 'error');
      return;
    }

    const shooters: Shooter[] = [];
    for (const rowEl of (this._rosterTbody?.querySelectorAll<HTMLElement>('.ap-roster-row') ?? [])) {
      const name = rowEl.querySelector<HTMLInputElement>('.ap-roster-name')!.value.trim();
      if (!name) continue;

      const startingAvgRaw = parseFloat(rowEl.dataset['startingAvg'] ?? '35');
      const startingAvg = isNaN(startingAvgRaw) ? 35 : startingAvgRaw;
      const rookie = rowEl.dataset['rookie'] === 'true';

      const origIdxStr = rowEl.dataset['originalIndex'];
      const origIdx = origIdxStr !== undefined ? parseInt(origIdxStr, 10) : NaN;
      const original = !isNaN(origIdx) ? this._rosterOriginalShooters[origIdx] : undefined;

      shooters.push({
        id: original?.id ?? '',
        name,
        rookie,
        startingAvg,
        finalAvg: original?.finalAvg ?? null,
        weeksShot: original?.weeksShot ?? null,
        scores: original?.scores ?? [],
      });
    }

    if (shooters.length < 5) {
      this._setRosterStatus('A team must have at least 5 shooters.', 'error');
      return;
    }

    this._setRosterStatus('', '');
    const teamName = this._teamsData?.find((t) => t.id === teamId)?.name ?? teamId;
    if (this._rosterSaveBtn) this._rosterSaveBtn.disabled = true;

    // Process deferred shooter removals before saving
    for (const name of this._pendingRemovals) {
      await scoreService.removeShooterFromRoster(year, teamId, name);
    }
    this._pendingRemovals = [];

    const result = await scoreService.saveTeamRoster(year, teamId, captain, shooters);
    if (this._rosterSaveBtn) this._rosterSaveBtn.disabled = false;

    if (result.success) {
      showToast('success', `Roster saved — ${teamName}.`);
      this._closeRosterModal();
      void this._fetchTeamsData();
    } else {
      showToast('error', `Failed to save roster: ${result.error}`);
    }
  }

  // ── Confirmation dialogs ─────────────────────────────────────────────────

  private _showConfirmDialog(opts: {
    title: string;
    warning: string;
    nameToType: string;
    deleteLabel: string;
  }): Promise<boolean> {
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

  private async _confirmDeleteTeam(year: number, teamId: string, teamName: string): Promise<void> {
    const confirmed = await this._showConfirmDialog({
      title: 'Delete Team',
      warning: `This will permanently remove "${teamName}" and all its score entries from the ${year} season. This cannot be undone.`,
      nameToType: teamName,
      deleteLabel: 'Delete Team',
    });
    if (!confirmed) return;

    const result = await scoreService.deleteTeam(year, teamId);
    if (result.success) {
      showToast('success', `Team "${teamName}" deleted from ${year}.`);
      void this._fetchTeamsData();
    } else {
      showToast('error', `Failed to delete team: ${result.error}`);
    }
  }

  private async _confirmRemoveShooterRow(
    row: HTMLElement,
    tbody: Element,
    shooterName: string,
    year: number,
    teamId: string,
  ): Promise<void> {
    const confirmed = await this._showConfirmDialog({
      title: 'Remove Shooter',
      warning: `This will permanently remove "${shooterName}" and all their saved score entries from the ${year} season. This cannot be undone.`,
      nameToType: shooterName,
      deleteLabel: 'Remove Shooter',
    });
    if (!confirmed) return;

    const result = await scoreService.removeShooterFromRoster(year, teamId, shooterName);
    if (result.success) {
      tbody.removeChild(row);
      showToast('success', `"${shooterName}" removed from roster.`);
    } else {
      showToast('error', `Failed to remove shooter: ${result.error}`);
    }
  }

  // ── Roster helpers ───────────────────────────────────────────────────────

  private _namedRosterCount(): number {
    return [...(this._rosterTbody?.querySelectorAll<HTMLElement>('.ap-roster-row') ?? [])]
      .filter((r) => Boolean(r.querySelector<HTMLInputElement>('.ap-roster-name')?.value.trim()))
      .length;
  }

  // ── Date override ────────────────────────────────────────────────────────

  private async _fetchSeasonData(): Promise<void> {
    const year = parseInt(this.querySelector<HTMLSelectElement>('#ap-year')!.value, 10);
    const result = await scoreService.getSeason(year);
    this._seasonData = (result.success ? result.data : null) ?? null;
    this._updateDateSection();
  }

  /**
   * Rebuild the date override card. Called whenever week, year, season data,
   * or entry presence changes. Manages all of: view mode, edit mode, locked state.
   */
  private _updateDateSection(): void {
    const container = this.querySelector<HTMLElement>('#ap-date-section');
    if (!container) return;

    const year = parseInt(this.querySelector<HTMLSelectElement>('#ap-year')?.value ?? '0', 10);
    const weekNumber = parseInt(this.querySelector<HTMLSelectElement>('#ap-week')?.value ?? '1', 10);

    // ── Compute state ──────────────────────────────────────────────────────
    const overrides = this._seasonData?.weekDateOverrides ?? {};
    const key = String(weekNumber);
    const hasOverride = key in overrides;
    const overrideValue = overrides[key]; // string | null | undefined

    // Scheduled date from the league calendar
    const shootEvents = computeSchedule(year).filter((e) => e.type === 'shoot');
    const scheduledEvent = shootEvents.find((e) => e.week === weekNumber);
    const scheduledDate = scheduledEvent?.date ?? null;

    // Effective date for display + past check
    let effectiveDate: Date | null;
    let displayState: 'normal' | 'overridden' | 'cancelled';

    if (hasOverride && overrideValue === null) {
      displayState = 'cancelled';
      effectiveDate = scheduledDate; // use original scheduled date for past check
    } else if (hasOverride && typeof overrideValue === 'string') {
      displayState = 'overridden';
      effectiveDate = _parseLocalDate(overrideValue);
    } else {
      displayState = 'normal';
      effectiveDate = scheduledDate;
    }

    // Lock if past or scores exist
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isInPast = effectiveDate !== null && effectiveDate < today;
    const isLocked = isInPast || this._weekHasScores;
    const lockReason = isInPast
      ? 'This date is in the past'
      : this._weekHasScores
        ? 'Scores have been entered for this week'
        : '';

    // Force back to view mode if we're now locked
    if (isLocked && this._dateEditMode) this._dateEditMode = false;

    // ── Format display date ────────────────────────────────────────────────
    const formattedDate = effectiveDate !== null
      ? effectiveDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : '';

    // ── Badge HTML ─────────────────────────────────────────────────────────
    const badgeHtml = displayState === 'overridden'
      ? `<span class="ap-date-badge">overridden</span>`
      : displayState === 'cancelled'
        ? `<span class="ap-date-badge ap-date-badge--cancelled">cancelled</span>`
        : '';

    // ── Date display text ──────────────────────────────────────────────────
    const dateDisplayHtml = displayState === 'cancelled'
      ? `<span class="ap-date-display ap-date-display--cancelled">CANCELLED</span>`
      : `<span class="ap-date-display">${formattedDate || '—'}</span>`;

    // ── View mode ──────────────────────────────────────────────────────────
    const todayStr = _toInputDate(today);

    if (!this._dateEditMode) {
      const actionHtml = isLocked
        ? `<span class="ap-date-lock" title="${lockReason}">${LOCK_SVG} Locked</span>`
        : `<button class="ap-date-edit-btn btn-secondary" id="ap-date-edit-btn">${PENCIL_SVG} Edit date</button>`;

      container.innerHTML = `
        <div class="ap-date-card">
          <div class="ap-date-card__header">
            <span class="ap-date-card__label">Shoot Date</span>
            ${badgeHtml}
          </div>
          <div class="ap-date-card__body">
            ${dateDisplayHtml}
            ${actionHtml}
          </div>
        </div>`;

      this.querySelector('#ap-date-edit-btn')
        ?.addEventListener('click', () => {
          this._dateEditMode = true;
          this._updateDateSection();
        });
      return;
    }

    // ── Edit mode ──────────────────────────────────────────────────────────
    // Pre-fill input: use override date or computed date
    const inputValue = displayState === 'overridden' && typeof overrideValue === 'string'
      ? overrideValue.substring(0, 10)
      : scheduledDate !== null ? _toInputDate(scheduledDate) : '';

    const cancelledChecked = displayState === 'cancelled' ? ' checked' : '';

    container.innerHTML = `
      <div class="ap-date-card ap-date-card--editing">
        <div class="ap-date-card__header">
          <span class="ap-date-card__label">Shoot Date</span>
          ${badgeHtml}
        </div>
        <div class="ap-date-warning">
          ${WARN_SVG}
          <span>This overrides the scheduled shoot date on the season calendar and printed scoresheets.</span>
        </div>
        <div class="ap-date-edit-row">
          <input type="date" id="ap-shoot-date" class="ap-date-input" value="${inputValue}" min="${todayStr}" />
          <label class="ap-cancelled-label">
            <input type="checkbox" id="ap-cancelled"${cancelledChecked} /> Cancelled
          </label>
        </div>
        <div class="ap-date-edit-actions">
          <button id="ap-cancel-date-edit" class="btn-secondary">Cancel</button>
          <button id="ap-save-date" class="btn-primary">Save Date</button>
        </div>
      </div>`;

    // Cancelled checkbox toggles the date input
    const cancelledCb = this.querySelector<HTMLInputElement>('#ap-cancelled')!;
    const dateInput = this.querySelector<HTMLInputElement>('#ap-shoot-date')!;
    if (cancelledCb.checked) dateInput.disabled = true;

    cancelledCb.addEventListener('change', () => {
      dateInput.disabled = cancelledCb.checked;
      if (cancelledCb.checked) dateInput.value = '';
    });

    this.querySelector('#ap-cancel-date-edit')?.addEventListener('click', () => {
      this._dateEditMode = false;
      this._updateDateSection();
    });

    this.querySelector('#ap-save-date')?.addEventListener('click', () => {
      void this._saveDateOverride();
    });
  }

  private async _saveDateOverride(): Promise<void> {
    const year = parseInt(this.querySelector<HTMLSelectElement>('#ap-year')!.value, 10);
    const weekNumber = parseInt(this.querySelector<HTMLSelectElement>('#ap-week')!.value, 10);
    const cancelledCb = this.querySelector<HTMLInputElement>('#ap-cancelled');
    const dateInput = this.querySelector<HTMLInputElement>('#ap-shoot-date');
    const saveBtn = this.querySelector<HTMLButtonElement>('#ap-save-date');
    const cancelBtn = this.querySelector<HTMLButtonElement>('#ap-cancel-date-edit');

    const isCancelled = cancelledCb?.checked ?? false;
    const dateValue = dateInput?.value ?? '';

    if (!isCancelled && !dateValue) {
      showToast('error', 'Enter a date or check Cancelled.');
      return;
    }

    if (saveBtn) saveBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = true;

    const result = await scoreService.saveWeekDateOverride(
      year,
      weekNumber,
      isCancelled ? null : dateValue,
    );

    if (result.success) {
      this._dateEditMode = false;
      showToast('success', isCancelled
        ? `Week ${weekNumber} marked as cancelled.`
        : `Shoot date for Week ${weekNumber} updated.`);
      await this._fetchSeasonData(); // refreshes _seasonData and re-renders
    } else {
      if (saveBtn) saveBtn.disabled = false;
      if (cancelBtn) cancelBtn.disabled = false;
      showToast('error', `Failed to save date: ${result.error}`);
    }
  }

  // ── Status helpers ───────────────────────────────────────────────────────

  private _setStatus(message: string, type: '' | 'success' | 'error'): void {
    const el = this.querySelector('#ap-status');
    if (!el) return;
    el.textContent = message;
    el.className = `admin-status${type ? ` admin-status--${type}` : ''}`;
  }

  private _setPublishStatus(message: string, type: '' | 'success' | 'error'): void {
    const el = this.querySelector('#ap-publish-status');
    if (!el) return;
    el.textContent = message;
    el.className = `admin-status${type ? ` admin-status--${type}` : ''}`;
  }

  private _setRosterStatus(message: string, type: '' | 'success' | 'error' | 'info'): void {
    if (!this._rosterStatusEl) return;
    this._rosterStatusEl.textContent = message;
    this._rosterStatusEl.className = `admin-status${type ? ` admin-status--${type}` : ''}`;
  }
}

customElements.define('admin-panel', AdminPanel);

// ── Module-level helpers ─────────────────────────────────────────────────────

/** Parse a YYYY-MM-DD string as a local date (avoids UTC midnight offset). */
function _parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

/** Format a Date as YYYY-MM-DD for use as an <input type="date"> value. */
function _toInputDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
