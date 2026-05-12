/**
 * Score Entry tab — week/team picker, date override, shooter rows,
 * save/publish flow.
 *
 * Owns the date override card (`#ap-date-section`) too: locking and
 * cancellation are interleaved with score-entry state (presence of
 * saved entries, past-date detection), so the two pieces stay together.
 */

import { ScoreService } from '@/services/score-service';
import { showToast } from '@/modules/ui';
import { computeSchedule, currentShootWeek } from '@/utils/schedule';
import {
  LOCK_SVG,
  PENCIL_SVG,
  WARN_SVG,
  attachAutocomplete,
  buildOptions,
  parseLocalDate,
  setStatus,
  toInputDate,
} from './admin-shared';
import type { AdminTab, AdminTabContext } from './types';

const MAX_WEEKS = 15;
const MAX_SCORE = 25;

export class ScoreEntryTab implements AdminTab {
  private _host: HTMLElement | null = null;
  private _ctx: AdminTabContext | null = null;
  private readonly _scoreService: ScoreService;

  /** Whether the date override card is in edit mode. */
  private _dateEditMode = false;
  /** Whether any entries have been saved for the currently selected week. */
  private _weekHasScores = false;

  constructor(scoreService: ScoreService) {
    this._scoreService = scoreService;
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

      <div id="ap-date-section"></div>

      <h3>Shooters</h3>
      <div class="admin-table-wrapper">
        <table class="admin-shooters-table">
          <thead>
            <tr><th>Name</th><th>Score 1 (0–25)</th><th>Score 2 (0–25)</th><th>Total</th><th></th></tr>
          </thead>
          <tbody id="ap-shooters-body"></tbody>
        </table>
      </div>
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
      this._dateEditMode = false;
      this._weekHasScores = false;
      this._updateDateSection();
      void this._populateShooterRows();
      void this._loadSavedEntries();
    });
    host.querySelector('#ap-team')!.addEventListener('change', () => void this._populateShooterRows());
    host.querySelector('#ap-save')!.addEventListener('click', () => void this._saveEntry());
    host.querySelector('#ap-publish')!.addEventListener('click', () => void this._publishWeek());

    this._populateTeamSelect();
    this._updateDateSection();
    void this._loadSavedEntries();
  }

  onYearChange(): void {
    this._dateEditMode = false;
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
    this._updateDateSection();
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
        return;
      }
    }

    // 2. Fall back to roster
    const team = this._ctx?.getTeamsData()?.find((t) => t.id === teamId);
    if (team) {
      for (const shooter of team.shooters) this._addShooterRow(shooter.name);
    }
    // no-team-selected branch: leave tbody empty (user must select a team)
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

  // ── Date override ────────────────────────────────────────────────────────

  /**
   * Rebuild the date override card. Called whenever week, year, season data,
   * or entry presence changes. Manages all of: view mode, edit mode, locked state.
   */
  private _updateDateSection(): void {
    const host = this._host;
    if (!host) return;
    const container = host.querySelector<HTMLElement>('#ap-date-section');
    if (!container) return;

    const year = this._ctx?.getYear() ?? 0;
    const weekNumber = parseInt(host.querySelector<HTMLSelectElement>('#ap-week')?.value ?? '1', 10);

    const overrides = this._ctx?.getSeasonData()?.weekDateOverrides ?? {};
    const key = String(weekNumber);
    const hasOverride = key in overrides;
    const overrideValue = overrides[key]; // string | null | undefined

    const shootEvents = computeSchedule(year).filter((e) => e.type === 'shoot');
    const scheduledEvent = shootEvents.find((e) => e.week === weekNumber);
    const scheduledDate = scheduledEvent?.date ?? null;

    let effectiveDate: Date | null;
    let displayState: 'normal' | 'overridden' | 'cancelled';

    if (hasOverride && overrideValue === null) {
      displayState = 'cancelled';
      effectiveDate = scheduledDate;
    } else if (hasOverride && typeof overrideValue === 'string') {
      displayState = 'overridden';
      effectiveDate = parseLocalDate(overrideValue);
    } else {
      displayState = 'normal';
      effectiveDate = scheduledDate;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isInPast = effectiveDate !== null && effectiveDate < today;
    const isLocked = isInPast || this._weekHasScores;
    const lockReason = isInPast
      ? 'This date is in the past'
      : this._weekHasScores
        ? 'Scores have been entered for this week'
        : '';

    if (isLocked && this._dateEditMode) this._dateEditMode = false;

    const formattedDate = effectiveDate !== null
      ? effectiveDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : '';

    const badgeHtml = displayState === 'overridden'
      ? `<span class="ap-date-badge">overridden</span>`
      : displayState === 'cancelled'
        ? `<span class="ap-date-badge ap-date-badge--cancelled">cancelled</span>`
        : '';

    const dateDisplayHtml = displayState === 'cancelled'
      ? `<span class="ap-date-display ap-date-display--cancelled">CANCELLED</span>`
      : `<span class="ap-date-display">${formattedDate || '—'}</span>`;

    const todayStr = toInputDate(today);

    if (!this._dateEditMode) {
      const actionHtml = isLocked
        ? `<span class="ap-date-lock" data-tooltip="${lockReason}">${LOCK_SVG} Locked</span>`
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

      host.querySelector('#ap-date-edit-btn')
        ?.addEventListener('click', () => {
          this._dateEditMode = true;
          this._updateDateSection();
        });
      return;
    }

    // Edit mode: pre-fill input with override or computed date
    const inputValue = displayState === 'overridden' && typeof overrideValue === 'string'
      ? overrideValue.substring(0, 10)
      : scheduledDate !== null ? toInputDate(scheduledDate) : '';

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

    const cancelledCb = host.querySelector<HTMLInputElement>('#ap-cancelled')!;
    const dateInput = host.querySelector<HTMLInputElement>('#ap-shoot-date')!;
    if (cancelledCb.checked) dateInput.disabled = true;

    cancelledCb.addEventListener('change', () => {
      dateInput.disabled = cancelledCb.checked;
      if (cancelledCb.checked) dateInput.value = '';
    });

    host.querySelector('#ap-cancel-date-edit')?.addEventListener('click', () => {
      this._dateEditMode = false;
      this._updateDateSection();
    });

    host.querySelector('#ap-save-date')?.addEventListener('click', () => {
      void this._saveDateOverride();
    });
  }

  private async _saveDateOverride(): Promise<void> {
    const host = this._host;
    if (!host) return;
    const year = this._ctx?.getYear() ?? 0;
    const weekNumber = parseInt(host.querySelector<HTMLSelectElement>('#ap-week')!.value, 10);
    const cancelledCb = host.querySelector<HTMLInputElement>('#ap-cancelled');
    const dateInput = host.querySelector<HTMLInputElement>('#ap-shoot-date');
    const saveBtn = host.querySelector<HTMLButtonElement>('#ap-save-date');
    const cancelBtn = host.querySelector<HTMLButtonElement>('#ap-cancel-date-edit');

    const isCancelled = cancelledCb?.checked ?? false;
    const dateValue = dateInput?.value ?? '';

    if (!isCancelled && !dateValue) {
      showToast('error', 'Enter a date or check Cancelled.');
      return;
    }

    if (saveBtn) saveBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = true;

    const result = await this._scoreService.saveWeekDateOverride(
      year,
      weekNumber,
      isCancelled ? null : dateValue,
    );

    if (result.success) {
      this._dateEditMode = false;
      showToast('success', isCancelled
        ? `Week ${weekNumber} marked as cancelled.`
        : `Shoot date for Week ${weekNumber} updated.`);
      await this._ctx?.refreshSeason(); // triggers onSeasonChanged → re-render
    } else {
      if (saveBtn) saveBtn.disabled = false;
      if (cancelBtn) cancelBtn.disabled = false;
      showToast('error', `Failed to save date: ${result.error}`);
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
