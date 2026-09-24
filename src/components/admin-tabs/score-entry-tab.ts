/**
 * Score Entry tab — week/team picker, date override, shooter rows,
 * live calculation preview, save/publish flow.
 *
 * The date override card (`#ap-date-section`) lives in
 * score-entry-date-card.ts; this tab drives it because its locking depends
 * on score-entry state (presence of saved entries for the week).
 */

import { ScoreService } from '@/services/score-service';
import { previewTeamNight } from '@/services/score-entry-preview';
import { normalizeShooterName } from '@/services/scoring-engine';
import type { SeasonEntry } from '@/types/score';
import { showToast } from '@/modules/ui';
import { currentShootWeek } from '@/utils/schedule';
import { attachAutocomplete, buildOptions, setStatus } from './admin-shared';
import type { AdminTab, AdminTabContext } from './types';
import { renderPreviewPanel, renderTeamStatus, wrapWithStepper } from './score-entry-ui';
import { DateOverrideCard } from './score-entry-date-card';

const MAX_WEEKS = 15;
const MAX_SCORE = 25;

export class ScoreEntryTab implements AdminTab {
  private _host: HTMLElement | null = null;
  private _ctx: AdminTabContext | null = null;
  private readonly _scoreService: ScoreService;

  /** Whether any entries have been saved for the currently selected week. */
  private _weekHasScores = false;
  /** Re-entrancy guard: only the latest _populateShooterRows call may render (F-23). */
  private _loadGen = 0;
  /** Saved entries for weeks ≤ the selected week (feeds the live preview, 0 extra reads). */
  private _entries: SeasonEntry[] = [];
  private _previewTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly _dateCard: DateOverrideCard;

  constructor(scoreService: ScoreService) {
    this._scoreService = scoreService;
    this._dateCard = new DateOverrideCard({
      scoreService,
      getHost: () => this._host,
      getCtx: () => this._ctx,
      hasScores: () => this._weekHasScores,
    });
  }

  mount(host: HTMLElement, ctx: AdminTabContext): void {
    this._host = host;
    this._ctx = ctx;

    const defaultWeek = currentShootWeek(ctx.getYear());

    host.innerHTML = `
      <div class="admin-form-row">
        <label for="ap-week">Week</label>
        <select id="ap-week">${buildOptions(1, MAX_WEEKS, 'Week', defaultWeek)}</select>
        <label for="ap-team">Team</label>
        <select id="ap-team">
          <option value="">-- Select team --</option>
        </select>
      </div>

      <div id="ap-team-status" class="ap-team-status" role="group" aria-label="Team entry status"></div>

      <div id="ap-date-section"></div>

      <h3>Shooters</h3>
      <div class="admin-table-wrapper">
        <table class="admin-shooters-table">
          <thead>
            <tr><th>Name</th><th class="ap-goingin-head">Going-in</th><th>Bunker 1 (0–25)</th><th>Bunker 2 (0–25)</th><th>Total</th><th></th></tr>
          </thead>
          <tbody id="ap-shooters-body"></tbody>
        </table>
      </div>
      <div id="ap-preview" aria-live="polite"></div>
      <div class="admin-actions">
        <button id="ap-save" class="btn-primary">Save Entry</button>
        <span class="tooltip-icon" tabindex="0" role="img" aria-label="Save Entry help"
          data-tooltip="Stores this team's scores as a draft. You can re-save to overwrite.">?</span>
      </div>
      <p id="ap-status" class="admin-status" aria-live="polite"></p>
      <p class="admin-publish-note">
        Save stores a draft for this team. Repeat for each team, then Publish when all entries are in.
      </p>

      <h3>Saved Entries</h3>
      <ul id="ap-saved-list" class="admin-saved-list"></ul>

      <div class="admin-publish-section">
        <h3>Publish</h3>
        <p class="admin-publish-note">Publishing runs the scoring engine over all saved entries and writes computed results to Firestore.</p>
        <div class="admin-actions">
          <button id="ap-publish" class="btn-danger">Publish Week</button>
          <span class="tooltip-icon" tabindex="0" role="img" aria-label="Publish Week help"
            data-tooltip="Runs the scoring engine over all saved entries and updates live standings. Cannot be undone.">?</span>
        </div>
        <p id="ap-publish-status" class="admin-status" aria-live="polite"></p>
      </div>`;

    host.querySelector('#ap-week')!.addEventListener('change', () => {
      this._dateCard.resetEdit();
      this._weekHasScores = false;
      this._dateCard.render();
      void this._populateShooterRows();
      void this._loadSavedEntries();
    });
    host.querySelector('#ap-team')!.addEventListener('change', () => {
      void this._populateShooterRows();
      this._renderTeamStatus();
    });
    host.querySelector('#ap-team-status')!.addEventListener('click', (e) => {
      const chip = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-team-id]');
      const select = host.querySelector<HTMLSelectElement>('#ap-team');
      if (!chip || !select) return;
      select.value = chip.dataset['teamId'] ?? '';
      select.dispatchEvent(new Event('change'));
    });
    host.querySelector('#ap-save')!.addEventListener('click', () => void this._saveEntry());
    host.querySelector('#ap-publish')!.addEventListener('click', () => void this._publishWeek());

    this._populateTeamSelect();
    this._dateCard.render();
    void this._loadSavedEntries();
  }

  onYearChange(): void {
    this._dateCard.resetEdit();
    this._weekHasScores = false;
    const weekSelect = this._host?.querySelector<HTMLSelectElement>('#ap-week');
    if (weekSelect && this._ctx) {
      weekSelect.value = String(currentShootWeek(this._ctx.getYear()));
    }
    void this._loadSavedEntries();
  }

  onTeamsChanged(): void {
    this._populateTeamSelect();
    void this._populateShooterRows();
  }

  onSeasonChanged(): void {
    this._dateCard.render();
  }

  onActivate(): void {
    const year = this._ctx?.getYear() ?? 0;
    void this._ctx?.getShooterSuggestions(year);
  }

  // ── Team select ─────────────────────────────────────────────────────────

  private _populateTeamSelect(): void {
    const select = this._host?.querySelector<HTMLSelectElement>('#ap-team');
    if (!select) return;
    const teams = this._ctx?.getTeamsData() ?? [];

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

  // ── Shooter rows ────────────────────────────────────────────────────────

  private async _populateShooterRows(): Promise<void> {
    const gen = ++this._loadGen;
    const host = this._host;
    if (!host) return;
    const year = this._ctx?.getYear() ?? 0;
    const weekNumber = parseInt(host.querySelector<HTMLSelectElement>('#ap-week')!.value, 10);
    const teamId = host.querySelector<HTMLSelectElement>('#ap-team')?.value ?? '';
    const tbody = host.querySelector('#ap-shooters-body');
    if (!tbody) return;

    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

    // 1. Try to load existing saved entry first
    if (teamId) {
      const entryResult = await this._scoreService.getEntry(year, weekNumber, teamId);
      if (gen !== this._loadGen) return; // superseded — a newer week/team selection owns the tbody
      if (entryResult.success && entryResult.data !== null) {
        const team = this._ctx?.getTeamsData()?.find((t) => t.id === teamId);
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
        this._refreshPreview();
        return;
      }
    }

    // 2. Fall back to roster
    const team = this._ctx?.getTeamsData()?.find((t) => t.id === teamId);
    if (team) {
      for (const shooter of team.shooters) this._addShooterRow(shooter.name);
    }
    // no-team-selected branch: leave tbody empty (user must select a team)
    this._refreshPreview();
  }

  private _addShooterRow(prefilledName = '', score1?: number, score2?: number): void {
    const tbody = this._host?.querySelector('#ap-shooters-body');
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
      attachAutocomplete(nameInput, () => this._ctx?.getCachedShooterNames() ?? []);
    }

    const s1 = this._scoreInput();
    const s2 = this._scoreInput();
    const who = prefilledName || 'new shooter';

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
    s1.addEventListener('input', () => this._schedulePreview());
    s2.addEventListener('input', () => this._schedulePreview());
    updateTotal();

    const goingInCell = document.createElement('td');
    goingInCell.className = 'ap-goingin num';
    goingInCell.textContent = '—';

    const td = (child: HTMLElement) => {
      const c = document.createElement('td');
      c.appendChild(child);
      return c;
    };
    row.appendChild(nameCell);
    row.appendChild(goingInCell);
    row.appendChild(td(wrapWithStepper(s1, `bunker 1 for ${who}`)));
    row.appendChild(td(wrapWithStepper(s2, `bunker 2 for ${who}`)));
    row.appendChild(totalCell);
    if (!prefilledName) {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = '✕';
      removeBtn.className = 'ap-remove-shooter';
      removeBtn.setAttribute('aria-label', 'Remove shooter row');
      removeBtn.addEventListener('click', () => {
        tbody.removeChild(row);
        this._schedulePreview();
      });
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

  // ── Save / publish flow ─────────────────────────────────────────────────

  private async _saveEntry(): Promise<void> {
    const host = this._host;
    if (!host) return;
    const year = this._ctx?.getYear() ?? 0;
    const weekNumber = parseInt(host.querySelector<HTMLSelectElement>('#ap-week')!.value, 10);
    const teamSelect = host.querySelector<HTMLSelectElement>('#ap-team')!;
    const teamName = teamSelect.options[teamSelect.selectedIndex]?.text ?? '';
    const teamId = teamSelect.value;

    if (!teamId) { this._setStatus('Team selection is required.', 'error'); return; }

    const shooters: { name: string; score1: number; score2: number; total: number }[] = [];
    for (const row of host.querySelectorAll('.ap-shooter-row')) {
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

    const result = await this._scoreService.saveEntry(year, entry);
    if (result.success) {
      showToast('success', `Entry saved — ${teamName}, Week ${weekNumber}.`);
    } else {
      showToast('error', `Failed to save entry: ${result.error}`);
    }

    void this._loadSavedEntries();
  }

  private async _loadSavedEntries(): Promise<void> {
    const host = this._host;
    if (!host) return;
    const year = this._ctx?.getYear() ?? 0;
    const weekNumber = parseInt(host.querySelector<HTMLSelectElement>('#ap-week')?.value ?? '0', 10);
    const list = host.querySelector('#ap-saved-list');
    if (!list) return;

    while (list.firstChild) list.removeChild(list.firstChild);

    const result = await this._scoreService.getEntries(year, weekNumber);

    if (!result.success) {
      console.warn('admin-panel: could not load entries:', result.error);
      const li = document.createElement('li');
      li.textContent = 'No entries for this season/week for this team.';
      list.appendChild(li);
      return;
    }

    this._entries = result.data.filter((e) => e.weekNumber <= weekNumber);
    const entries = result.data.filter((e) => e.weekNumber === weekNumber);
    this._renderTeamStatus();
    this._refreshPreview();

    // Update score-presence flag and re-render the date card (locking state may have changed)
    this._weekHasScores = entries.length > 0;
    this._dateCard.render();

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

  // ── Live preview (spec 006 DD-12) ───────────────────────────────────────

  private _selectedWeek(): number {
    return parseInt(this._host?.querySelector<HTMLSelectElement>('#ap-week')?.value ?? '0', 10);
  }

  private _renderTeamStatus(): void {
    const box = this._host?.querySelector('#ap-team-status');
    if (!box) return;
    const week = this._selectedWeek();
    const entered = new Set(this._entries.filter((e) => e.weekNumber === week).map((e) => e.teamId));
    const selected = this._host?.querySelector<HTMLSelectElement>('#ap-team')?.value ?? '';
    box.innerHTML = renderTeamStatus(this._ctx?.getTeamsData() ?? [], entered, selected);
  }

  private _schedulePreview(): void {
    if (this._previewTimer) clearTimeout(this._previewTimer);
    this._previewTimer = setTimeout(() => this._refreshPreview(), 150);
  }

  /**
   * Rebuild the calculation panel from the on-screen rows. Lenient: rows
   * with no or out-of-range scores are left out — validation stays in
   * _saveEntry, which this never touches.
   */
  private _refreshPreview(): void {
    const host = this._host;
    const panel = host?.querySelector('#ap-preview');
    if (!host || !panel) return;
    const teamSelect = host.querySelector<HTMLSelectElement>('#ap-team')!;
    const teamId = teamSelect.value;
    const teams = this._ctx?.getTeamsData() ?? [];
    const team = teams.find((t) => t.id === teamId);
    if (!team) {
      panel.innerHTML = '';
      return;
    }

    const shooters: SeasonEntry['shooters'] = [];
    for (const row of host.querySelectorAll<HTMLElement>('.ap-shooter-row')) {
      const name = (row.dataset['name'] ?? row.querySelector<HTMLInputElement>('.ap-shooter-name')?.value ?? '').trim();
      const [a, b] = [...row.querySelectorAll<HTMLInputElement>('.ap-score-input')].map((i) => parseInt(i.value, 10));
      if (!name || a === undefined || b === undefined || Number.isNaN(a) || Number.isNaN(b)) continue;
      if (a < 0 || a > MAX_SCORE || b < 0 || b > MAX_SCORE) continue;
      shooters.push({ name, score1: a, score2: b, total: a + b });
    }

    const week = this._selectedWeek();
    const preview = previewTeamNight({
      year: this._ctx?.getYear() ?? 0,
      weekNumber: week,
      teams,
      entries: this._entries,
      draft: { year: this._ctx?.getYear() ?? 0, weekNumber: week, teamId, teamName: team.name, savedAt: '', shooters },
    });
    panel.innerHTML = renderPreviewPanel(preview);

    for (const row of host.querySelectorAll<HTMLElement>('.ap-shooter-row')) {
      const cell = row.querySelector('.ap-goingin');
      const name = row.dataset['name'] ?? row.querySelector<HTMLInputElement>('.ap-shooter-name')?.value ?? '';
      const avg = preview?.goingInByName.get(normalizeShooterName(name));
      if (cell) cell.textContent = avg === undefined ? '—' : avg.toFixed(1);
    }
  }

  private async _publishWeek(): Promise<void> {
    const host = this._host;
    if (!host) return;
    const year = this._ctx?.getYear() ?? 0;
    const weekNumber = parseInt(host.querySelector<HTMLSelectElement>('#ap-week')!.value, 10);
    const btn = host.querySelector<HTMLButtonElement>('#ap-publish')!;

    btn.disabled = true;
    this._setPublishStatus(`Publishing week ${weekNumber}…`, '');

    const result = await this._scoreService.publishWeek(year, weekNumber);

    btn.disabled = false;
    this._setPublishStatus('', '');

    if (result.success) {
      showToast('success', `Week ${weekNumber} published — standings updated.`);
    } else {
      showToast('error', `Publish failed: ${result.error}`);
    }
  }

  // ── Status helpers ───────────────────────────────────────────────────────

  private _setStatus(message: string, type: '' | 'success' | 'error'): void {
    setStatus(this._host?.querySelector('#ap-status') ?? null, message, type);
  }

  private _setPublishStatus(message: string, type: '' | 'success' | 'error'): void {
    setStatus(this._host?.querySelector('#ap-publish-status') ?? null, message, type);
  }
}
