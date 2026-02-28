/**
 * admin-panel — Custom Element
 *
 * Score-entry form for weekly trap league data.
 * Stores raw entries to localStorage: citl:entry:{year}:{week}:{teamSlug}
 * Each entry: { year, weekNumber, teamName, savedAt, shooters[] }
 * Each shooter: { name, score1, score2, total }
 *
 * No shadow DOM. All user values rendered via textContent (never innerHTML).
 */

const CURRENT_YEAR = new Date().getFullYear();
const MAX_WEEKS = 15;
const MAX_SCORE = 25;
const KEY_PREFIX = 'citl:entry';

const toSlug = (name) => name.trim().toLowerCase().replace(/\s+/g, '-');
const entryKey = (year, week, team) => `${KEY_PREFIX}:${year}:${week}:${toSlug(team)}`;

function buildOptions(min, max, label, selected) {
  let html = '';
  for (let i = min; i <= max; i++) {
    html += `<option value="${i}"${i === selected ? ' selected' : ''}>${label ? `${label} ${i}` : i}</option>`;
  }
  return html;
}

class AdminPanel extends HTMLElement {
  connectedCallback() {
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
          <input id="ap-team" type="text" placeholder="Team name" autocomplete="off">
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
      </div>`;

    this._addShooterRow();
    this._addShooterRow();

    this.querySelector('#ap-add-shooter').addEventListener('click', () => this._addShooterRow());
    this.querySelector('#ap-clear').addEventListener('click', () => this._clearForm());
    this.querySelector('#ap-save').addEventListener('click', () => this._saveEntry());
    this.querySelector('#ap-year').addEventListener('change', () => this._loadSavedEntries());
    this.querySelector('#ap-week').addEventListener('change', () => this._loadSavedEntries());

    this._loadSavedEntries();
  }

  _addShooterRow() {
    const tbody = this.querySelector('#ap-shooters-body');
    const row = document.createElement('tr');
    row.className = 'ap-shooter-row';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'ap-shooter-name';
    nameInput.placeholder = 'Shooter name';
    nameInput.autocomplete = 'off';

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

  _saveEntry() {
    const year = parseInt(this.querySelector('#ap-year').value, 10);
    const weekNumber = parseInt(this.querySelector('#ap-week').value, 10);
    const teamName = this.querySelector('#ap-team').value.trim();

    if (!teamName) { this._setStatus('Team name is required.', 'error'); return; }

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

    const key = entryKey(year, weekNumber, teamName);
    localStorage.setItem(key, JSON.stringify({ year, weekNumber, teamName, savedAt: new Date().toISOString(), shooters }));
    this._setStatus(`Saved: ${key}`, 'success');
    this._loadSavedEntries();
  }

  _loadSavedEntries() {
    const year = this.querySelector('#ap-year')?.value;
    const week = this.querySelector('#ap-week')?.value;
    const list = this.querySelector('#ap-saved-list');
    if (!list) return;

    while (list.firstChild) list.removeChild(list.firstChild);

    const prefix = `${KEY_PREFIX}:${year}:${week}:`;
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) keys.push(k);
    }
    keys.sort();

    if (keys.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No entries saved for this year/week.';
      list.appendChild(li);
      return;
    }

    for (const k of keys) {
      let entry;
      try { entry = JSON.parse(localStorage.getItem(k)); } catch { continue; }

      const li = document.createElement('li');
      li.className = 'admin-saved-item';

      const keySpan = document.createElement('span');
      keySpan.className = 'admin-saved-key';
      keySpan.textContent = k;

      const detail = document.createElement('span');
      detail.textContent = ` — ${entry.teamName}, ${entry.shooters?.length ?? 0} shooter(s), saved ${new Date(entry.savedAt).toLocaleString()}`;

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'ap-delete-entry';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => {
        localStorage.removeItem(k);
        this._loadSavedEntries();
        this._setStatus(`Deleted: ${k}`, 'success');
      });

      li.appendChild(keySpan);
      li.appendChild(detail);
      li.appendChild(delBtn);
      list.appendChild(li);
    }
  }

  _clearForm() {
    const teamInput = this.querySelector('#ap-team');
    if (teamInput) teamInput.value = '';
    const tbody = this.querySelector('#ap-shooters-body');
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
    this._addShooterRow();
    this._addShooterRow();
    this._setStatus('Form cleared.', '');
  }

  _setStatus(message, type) {
    const el = this.querySelector('#ap-status');
    if (!el) return;
    el.textContent = message;
    el.className = `admin-status${type ? ` admin-status--${type}` : ''}`;
  }
}

customElements.define('admin-panel', AdminPanel);
