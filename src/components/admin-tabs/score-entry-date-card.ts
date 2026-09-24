/**
 * Shoot-date override card for the Score Entry tab (`#ap-date-section`).
 * Extracted verbatim from score-entry-tab.ts (spec 006 DD-9 size split):
 * view / edit / locked states are unchanged. Locking still depends on the
 * tab's "week has saved scores" flag, supplied through `hasScores`.
 */

import type { ScoreService } from '@/services/score-service';
import { showToast } from '@/modules/ui';
import { computeSchedule } from '@/utils/schedule';
import { LOCK_SVG, PENCIL_SVG, WARN_SVG, parseLocalDate, toInputDate } from './admin-shared';
import type { AdminTabContext } from './types';

export interface DateOverrideDeps {
  scoreService: ScoreService;
  getHost(): HTMLElement | null;
  getCtx(): AdminTabContext | null;
  hasScores(): boolean;
}

export class DateOverrideCard {
  /** Whether the card is in edit mode. */
  private _editMode = false;

  constructor(private readonly _deps: DateOverrideDeps) {}

  /** Leave edit mode (week / year changed). Call render() afterwards. */
  resetEdit(): void {
    this._editMode = false;
  }

  /**
   * Rebuild the date override card. Called whenever week, year, season data,
   * or entry presence changes. Manages all of: view mode, edit mode, locked state.
   */
  render(): void {
    const host = this._deps.getHost();
    if (!host) return;
    const container = host.querySelector<HTMLElement>('#ap-date-section');
    if (!container) return;

    const year = this._deps.getCtx()?.getYear() ?? 0;
    const weekNumber = parseInt(host.querySelector<HTMLSelectElement>('#ap-week')?.value ?? '1', 10);

    const overrides = this._deps.getCtx()?.getSeasonData()?.weekDateOverrides ?? {};
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
    const isLocked = isInPast || this._deps.hasScores();
    const lockReason = isInPast
      ? 'This date is in the past'
      : this._deps.hasScores()
        ? 'Scores have been entered for this week'
        : '';

    if (isLocked && this._editMode) this._editMode = false;

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

    if (!this._editMode) {
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
          this._editMode = true;
          this.render();
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
      this._editMode = false;
      this.render();
    });

    host.querySelector('#ap-save-date')?.addEventListener('click', () => {
      void this._save();
    });
  }

  private async _save(): Promise<void> {
    const host = this._deps.getHost();
    if (!host) return;
    const year = this._deps.getCtx()?.getYear() ?? 0;
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

    const result = await this._deps.scoreService.saveWeekDateOverride(
      year,
      weekNumber,
      isCancelled ? null : dateValue,
    );

    if (result.success) {
      this._editMode = false;
      showToast('success', isCancelled
        ? `Week ${weekNumber} marked as cancelled.`
        : `Shoot date for Week ${weekNumber} updated.`);
      await this._deps.getCtx()?.refreshSeason(); // triggers onSeasonChanged → re-render
    } else {
      if (saveBtn) saveBtn.disabled = false;
      if (cancelBtn) cancelBtn.disabled = false;
      showToast('error', `Failed to save date: ${result.error}`);
    }
  }
}
