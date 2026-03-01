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
import type { Team } from '@/types/score';
import type { Shooter } from '@/types/shooter';

const factory = createRepositoryFactory({ db });
const scoreService = new ScoreService(factory.getScoreRepository());

const CURRENT_YEAR = new Date().getFullYear();
const MAX_WEEKS = 15;
const MAX_SCORE = 25;

// Sentinel value used to indicate an "add new team" row is open
const NEW_TEAM_SENTINEL = '__new__';

const PENCIL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="16 3 21 8 8 21 3 21 3 16 16 3"/></svg>`;
const TRASH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;

function buildOptions(min: number, max: number, label: string, selected: number): string {
  let html = '';
  for (let i = min; i <= max; i++) {
    html += `<option value="${i}"${i === selected ? ' selected' : ''}>${label ? `${label} ${i}` : i}</option>`;
  }
  return html;
}

class AdminPanel extends HTMLElement {
  private _teamsData: Team[] | null = null;
  private _rosterOriginalShooters: Shooter[] = [];
  /** null = no edit open; NEW_TEAM_SENTINEL = add row open; else = teamId being edited */
  private _editingTeamId: string | null = null;

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

          <div class="admin-roster-section">
            <h3>Edit Team Roster</h3>
            <div class="admin-form-row">
              <label for="ap-roster-team">Team</label>
              <select id="ap-roster-team">
                <option value="">-- Select team --</option>
              </select>
            </div>
            <table id="ap-roster-table" class="admin-roster-table" style="display:none">
              <thead>
                <tr>
                  <th>Name</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="ap-roster-body"></tbody>
            </table>
            <div id="ap-roster-actions" class="admin-actions" style="display:none">
              <button id="ap-add-roster-shooter" class="btn-secondary">Add Shooter</button>
              <button id="ap-save-roster" class="btn-primary">Save Roster</button>
            </div>
            <p id="ap-team-mgmt-status" class="admin-status" aria-live="polite"></p>
          </div>

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

          <h3>Shooters</h3>
          <table class="admin-shooters-table">
            <thead>
              <tr><th>Name</th><th>Score 1 (0–25)</th><th>Score 2 (0–25)</th><th>Total</th><th></th></tr>
            </thead>
            <tbody id="ap-shooters-body"></tbody>
          </table>
          <div class="admin-actions">
            <button id="ap-clear" class="btn-secondary">Clear</button>
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
      void this._fetchTeamsData();
      void this._loadSavedEntries();
    });

    // Score entry listeners
    this.querySelector('#ap-week')!.addEventListener('change', () => {
      void this._populateShooterRows();
      void this._loadSavedEntries();
    });
    this.querySelector('#ap-team')!.addEventListener('change', () => void this._populateShooterRows());
    this.querySelector('#ap-clear')!.addEventListener('click', () => this._clearForm());
    this.querySelector('#ap-save')!.addEventListener('click', () => void this._saveEntry());
    this.querySelector('#ap-publish')!.addEventListener('click', () => void this._publishWeek());

    // Roster editor listeners
    this.querySelector('#ap-roster-team')!.addEventListener('change', () => this._loadRosterForTeam());
    this.querySelector('#ap-add-roster-shooter')!.addEventListener('click', () => this._addRosterRow());
    this.querySelector('#ap-save-roster')!.addEventListener('click', () => void this._saveRoster());

    void this._fetchTeamsData();
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
    const result = await scoreService.getTeams(year);
    if (result.success) {
      this._teamsData = result.data;
    } else {
      console.warn('admin-panel: could not load teams data:', result.error);
      this._teamsData = [];
    }
    this._renderTeamList();
    this._populateTeamSelect('#ap-team');
    this._populateTeamSelect('#ap-roster-team');
    void this._populateShooterRows();
    this._loadRosterForTeam();
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

      container.appendChild(table);
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
      if (!n || !c) {
        showToast('error', 'Team name and captain are both required.');
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
        const entryNames = new Set(entryResult.data.shooters.map((s) => s.name));
        for (const s of entryResult.data.shooters) {
          this._addShooterRow(s.name, s.score1 ?? undefined, s.score2 ?? undefined);
        }
        // Add any roster members not yet in the saved entry
        const team = this._teamsData?.find((t) => t.id === teamId);
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
      this._addShooterRow();
    } else {
      this._addShooterRow();
      this._addShooterRow();
    }
  }

  private _addShooterRow(prefilledName = '', score1?: number, score2?: number): void {
    const tbody = this.querySelector('#ap-shooters-body');
    if (!tbody) return;
    const row = document.createElement('tr');
    row.className = 'ap-shooter-row';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'ap-shooter-name';
    nameInput.placeholder = 'Shooter name';
    nameInput.autocomplete = 'off';
    if (prefilledName) {
      nameInput.value = prefilledName;
      nameInput.readOnly = true;
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

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = '✕';
    removeBtn.className = 'ap-remove-shooter';
    removeBtn.addEventListener('click', () => tbody.removeChild(row));

    const td = (child: HTMLElement) => {
      const c = document.createElement('td');
      c.appendChild(child);
      return c;
    };
    row.appendChild(td(nameInput));
    row.appendChild(td(s1));
    row.appendChild(td(s2));
    row.appendChild(totalCell);
    row.appendChild(td(removeBtn));
    tbody.appendChild(row);
  }

  private _scoreInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = String(MAX_SCORE);
    input.className = 'ap-score-input';
    input.placeholder = '0';
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
      const name = row.querySelector<HTMLInputElement>('.ap-shooter-name')!.value.trim();
      const inputs = row.querySelectorAll<HTMLInputElement>('.ap-score-input');
      const score1Raw = inputs[0]?.value ?? '';
      const score2Raw = inputs[1]?.value ?? '';

      if (!name && score1Raw === '' && score2Raw === '') continue;
      if (!name) { this._setStatus('All shooter rows must have a name.', 'error'); return; }

      const score1 = parseInt(score1Raw, 10);
      const score2 = parseInt(score2Raw, 10);
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
      li.textContent = 'Error loading entries.';
      list.appendChild(li);
      return;
    }

    const entries = result.data.filter((e) => e.weekNumber === weekNumber);

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

  private _clearForm(): void {
    const teamSelect = this.querySelector<HTMLSelectElement>('#ap-team');
    if (teamSelect) teamSelect.value = '';
    this._setStatus('', '');
    void this._populateShooterRows();
  }

  // ── Roster editor ────────────────────────────────────────────────────────

  private _loadRosterForTeam(): void {
    void this._loadRosterForTeamAsync();
  }

  private async _loadRosterForTeamAsync(): Promise<void> {
    const teamId = this.querySelector<HTMLSelectElement>('#ap-roster-team')?.value ?? '';
    const table = this.querySelector<HTMLElement>('#ap-roster-table');
    const actions = this.querySelector<HTMLElement>('#ap-roster-actions');

    if (!teamId) {
      if (table) table.style.display = 'none';
      if (actions) actions.style.display = 'none';
      return;
    }

    const year = parseInt(this.querySelector<HTMLSelectElement>('#ap-year')!.value, 10);

    this._setTeamMgmtStatus('Loading roster defaults\u2026', 'info');

    const result = await scoreService.computeRosterDefaults(year, teamId);
    this._setTeamMgmtStatus('', '');

    let team: Team;
    if (result.success) {
      team = result.data;
    } else {
      // Graceful fallback: use cached data rather than blocking the UI
      console.warn('computeRosterDefaults failed, using cached data:', result.error);
      const fallback = this._teamsData?.find((t) => t.id === teamId);
      if (!fallback) return;
      team = fallback;
    }

    this._rosterOriginalShooters = [...team.shooters];

    if (table) table.style.display = '';
    if (actions) actions.style.display = '';

    const tbody = this.querySelector('#ap-roster-body');
    if (!tbody) return;
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

    for (let i = 0; i < team.shooters.length; i++) {
      this._addRosterRow(team.shooters[i], i);
    }
  }

  private _addRosterRow(shooter?: Shooter, originalIndex?: number): void {
    const tbody = this.querySelector('#ap-roster-body');
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

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = '✕';
    removeBtn.className = 'ap-remove-shooter';
    removeBtn.addEventListener('click', () => {
      const name = nameInput.value.trim() || 'this shooter';
      if (originalIndex !== undefined) {
        void this._confirmRemoveShooterRow(row, tbody, name);
      } else {
        tbody.removeChild(row);
      }
    });

    const td = (child: HTMLElement) => {
      const c = document.createElement('td');
      c.appendChild(child);
      return c;
    };
    row.appendChild(td(nameInput));
    row.appendChild(td(removeBtn));
    tbody.appendChild(row);
  }

  private async _saveRoster(): Promise<void> {
    const year = parseInt(this.querySelector<HTMLSelectElement>('#ap-year')!.value, 10);
    const teamId = this.querySelector<HTMLSelectElement>('#ap-roster-team')?.value ?? '';

    if (!teamId) { this._setTeamMgmtStatus('No team selected.', 'error'); return; }

    // Captain comes from already-loaded team data (edited separately via the team table)
    const captain = this._teamsData?.find((t) => t.id === teamId)?.captain ?? '';
    if (!captain) { this._setTeamMgmtStatus('Team captain not found — please refresh.', 'error'); return; }

    const shooters: Shooter[] = [];
    for (const rowEl of this.querySelectorAll<HTMLElement>('.ap-roster-row')) {
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

    this._setTeamMgmtStatus('', '');
    const teamName = this._teamsData?.find((t) => t.id === teamId)?.name ?? teamId;
    const btn = this.querySelector<HTMLButtonElement>('#ap-save-roster')!;
    btn.disabled = true;

    const result = await scoreService.saveTeamRoster(year, teamId, captain, shooters);
    btn.disabled = false;

    if (result.success) {
      showToast('success', `Roster saved — ${teamName}.`);
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
      warning: `This will permanently remove "${teamName}" from the ${year} season. This cannot be undone.`,
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
  ): Promise<void> {
    const confirmed = await this._showConfirmDialog({
      title: 'Remove Shooter',
      warning: `"${shooterName}" will be removed from this roster. Save the roster to apply the change.`,
      nameToType: shooterName,
      deleteLabel: 'Remove',
    });
    if (confirmed) tbody.removeChild(row);
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

  private _setTeamMgmtStatus(message: string, type: '' | 'success' | 'error' | 'info'): void {
    const el = this.querySelector('#ap-team-mgmt-status');
    if (!el) return;
    el.textContent = message;
    el.className = `admin-status${type ? ` admin-status--${type}` : ''}`;
  }
}

customElements.define('admin-panel', AdminPanel);
