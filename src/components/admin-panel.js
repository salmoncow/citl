/**
 * admin-panel — Custom Element
 *
 * Score-entry form for weekly trap league data.
 * Primary storage: Firestore via ScoreService (requires auth).
 *
 * No shadow DOM. All user values rendered via textContent (never innerHTML).
 */

import { db } from '@/firebase-config.js';
import { createRepositoryFactory } from '@/repositories/repository-factory.js';
import { ScoreService } from '@/services/score-service.js';

const factory = createRepositoryFactory({ db });
const scoreService = new ScoreService(factory.getScoreRepository());

const CURRENT_YEAR = new Date().getFullYear();
const MAX_WEEKS = 15;
const MAX_SCORE = 25;

function buildOptions(min, max, label, selected) {
  let html = '';
  for (let i = min; i <= max; i++) {
    html += `<option value="${i}"${i === selected ? ' selected' : ''}>${label ? `${label} ${i}` : i}</option>`;
  }
  return html;
}

class AdminPanel extends HTMLElement {
  connectedCallback() {
    this._teamsData = null;

    this.innerHTML = `
      <div class="admin-panel">
        <h2>Score Entry</h2>
        <div class="admin-form-row">
          <label for="ap-year">Year</label>
          <select id="ap-year">${buildOptions(2019, 2030, '', CURRENT_YEAR)}</select>
          <label for="ap-week">Week</label>
          <select id="ap-week">${buildOptions(1, MAX_WEEKS, 'Week', 1)}</select>
        </div>
        <div class="admin-form-row">
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
          <button id="ap-add-shooter">Add Shooter</button>
          <button id="ap-clear">Clear</button>
          <button id="ap-save">Save Entry</button>
        </div>
        <p id="ap-status" class="admin-status" aria-live="polite"></p>
        <h3>Saved Entries</h3>
        <ul id="ap-saved-list" class="admin-saved-list"></ul>
        <div class="admin-publish-section">
          <h3>Publish</h3>
          <p class="admin-publish-note">Publishing runs the scoring engine over all saved entries and writes computed results to Firestore.</p>
          <div class="admin-actions">
            <button id="ap-publish">Publish Week</button>
          </div>
          <p id="ap-publish-status" class="admin-status" aria-live="polite"></p>
        </div>
      </div>`;

    this._addShooterRow();
    this._addShooterRow();

    this.querySelector('#ap-add-shooter').addEventListener('click', () => this._addShooterRow());
    this.querySelector('#ap-clear').addEventListener('click', () => this._clearForm());
    this.querySelector('#ap-save').addEventListener('click', () => this._saveEntry());
    this.querySelector('#ap-publish').addEventListener('click', () => this._publishWeek());
    this.querySelector('#ap-year').addEventListener('change', () => {
      this._fetchTeamsData();
      this._loadSavedEntries();
    });
    this.querySelector('#ap-week').addEventListener('change', () => this._loadSavedEntries());
    this.querySelector('#ap-team').addEventListener('change', () => this._populateShooterRows());

    this._fetchTeamsData();
    this._loadSavedEntries();
  }

  async _fetchTeamsData() {
    const year = parseInt(this.querySelector('#ap-year').value, 10);
    const result = await scoreService.getTeams(year);
    if (result.success) {
      this._teamsData = result.data;
    } else {
      console.warn('admin-panel: could not load teams data:', result.error);
      this._teamsData = [];
    }
    this._populateTeamSelect();
    this._populateShooterRows();
  }

  _populateTeamSelect() {
    const select = this.querySelector('#ap-team');
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

  _populateShooterRows() {
    const teamId = this.querySelector('#ap-team')?.value;
    const tbody = this.querySelector('#ap-shooters-body');
    if (!tbody) return;

    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

    const team = this._teamsData?.find((t) => t.id === teamId);

    if (!team) {
      this._addShooterRow();
      this._addShooterRow();
      return;
    }

    for (const shooter of team.shooters) {
      this._addShooterRow(shooter.name);
    }
    // blank row for mid-season additions
    this._addShooterRow();
  }

  _addShooterRow(prefilledName = '') {
    const tbody = this.querySelector('#ap-shooters-body');
    const row = document.createElement('tr');
    row.className = 'ap-shooter-row';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'ap-shooter-name';
    nameInput.placeholder = 'Shooter name';
    nameInput.autocomplete = 'off';
    if (prefilledName) nameInput.value = prefilledName;

    const s1 = this._scoreInput();
    const s2 = this._scoreInput();

    const totalCell = document.createElement('td');
    totalCell.className = 'ap-shooter-total';
    totalCell.textContent = '—';

    const updateTotal = () => {
      const v1 = parseInt(s1.value, 10);
      const v2 = parseInt(s2.value, 10);
      totalCell.textContent = (!isNaN(v1) && !isNaN(v2)) ? String(v1 + v2) : '—';
    };
    s1.addEventListener('input', updateTotal);
    s2.addEventListener('input', updateTotal);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = '✕';
    removeBtn.className = 'ap-remove-shooter';
    removeBtn.addEventListener('click', () => tbody.removeChild(row));

    const td = (child) => { const c = document.createElement('td'); c.appendChild(child); return c; };
    row.appendChild(td(nameInput));
    row.appendChild(td(s1));
    row.appendChild(td(s2));
    row.appendChild(totalCell);
    row.appendChild(td(removeBtn));
    tbody.appendChild(row);
  }

  _scoreInput() {
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = String(MAX_SCORE);
    input.className = 'ap-score-input';
    input.placeholder = '0';
    return input;
  }

  async _saveEntry() {
    const year = parseInt(this.querySelector('#ap-year').value, 10);
    const weekNumber = parseInt(this.querySelector('#ap-week').value, 10);
    const teamSelect = this.querySelector('#ap-team');
    const teamName = teamSelect.options[teamSelect.selectedIndex]?.text ?? '';
    const teamId = teamSelect.value;

    if (!teamId) { this._setStatus('Team selection is required.', 'error'); return; }

    const shooters = [];
    for (const row of this.querySelectorAll('.ap-shooter-row')) {
      const name = row.querySelector('.ap-shooter-name').value.trim();
      const inputs = row.querySelectorAll('.ap-score-input');
      const score1Raw = inputs[0].value;
      const score2Raw = inputs[1].value;

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
      this._setStatus(`Saved entry for ${teamName} week ${weekNumber}.`, 'success');
    } else {
      this._setStatus(`Firestore save failed: ${result.error}`, 'error');
    }

    this._loadSavedEntries();
  }

  async _loadSavedEntries() {
    const year = parseInt(this.querySelector('#ap-year')?.value, 10);
    const weekNumber = parseInt(this.querySelector('#ap-week')?.value, 10);
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

  async _publishWeek() {
    const year = parseInt(this.querySelector('#ap-year').value, 10);
    const weekNumber = parseInt(this.querySelector('#ap-week').value, 10);
    const btn = this.querySelector('#ap-publish');

    btn.disabled = true;
    this._setPublishStatus(`Publishing week ${weekNumber}…`, '');

    const result = await scoreService.publishWeek(year, weekNumber);

    btn.disabled = false;

    if (result.success) {
      this._setPublishStatus(
        `Week ${weekNumber} published. Standings updated.`,
        'success',
      );
    } else {
      this._setPublishStatus(`Publish failed: ${result.error}`, 'error');
    }
  }

  _clearForm() {
    const teamSelect = this.querySelector('#ap-team');
    if (teamSelect) teamSelect.value = '';
    this._populateShooterRows();
    this._setStatus('Form cleared.', '');
  }

  _setStatus(message, type) {
    const el = this.querySelector('#ap-status');
    if (!el) return;
    el.textContent = message;
    el.className = `admin-status${type ? ` admin-status--${type}` : ''}`;
  }

  _setPublishStatus(message, type) {
    const el = this.querySelector('#ap-publish-status');
    if (!el) return;
    el.textContent = message;
    el.className = `admin-status${type ? ` admin-status--${type}` : ''}`;
  }
}

customElements.define('admin-panel', AdminPanel);
