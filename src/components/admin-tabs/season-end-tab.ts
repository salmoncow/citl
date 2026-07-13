/**
 * Season End tab — two-phase season finalize (spec 004 DD-3).
 *
 * Preview computes the season awards read-only from PUBLISHED data
 * (SeasonAwardsService); Finalize writes { awards, status: 'complete' } to
 * the season document. Finalize is idempotent — re-running after a week
 * correction recomputes and overwrites (the documented recovery path; there
 * is no separate "reopen" action).
 *
 * The mount skeleton is static HTML; every dynamic value is rendered via
 * textContent (component contract, src/components/README.md).
 */

import type { SeasonAwardsService } from '@/services/season-awards-service';
import { showToast } from '@/modules/ui';
import type { SeasonAwards } from '@/types/season';
import { setStatus } from './admin-shared';
import type { AdminTab, AdminTabContext } from './types';

const WEEK_COUNT = 15;

/** Preview rows: label + formatted value ("—" when the field is null). */
function previewRows(awards: SeasonAwards): { label: string; value: string }[] {
  const pts = (team: string | null, points: number | null): string =>
    team === null ? '—' : `${team} — ${points ?? '?'} pts`;
  const avg = (name: string | null, average: number | null): string =>
    name === null ? '—' : `${name} — ${average === null ? '?' : average.toFixed(2)} avg`;
  return [
    { label: 'First Place', value: pts(awards.firstPlaceTeam, awards.firstPlacePoints) },
    { label: 'Second Place', value: pts(awards.secondPlaceTeam, awards.secondPlacePoints) },
    { label: 'Highest Average', value: avg(awards.highestAvgShooter, awards.highestAvg) },
    { label: 'Rookie of the Year', value: avg(awards.rookieOfYear, awards.rookieAvg) },
    {
      label: 'Most Improved',
      value: awards.mostImproved === null ? '—' : `${awards.mostImproved} — ${awards.improvement ?? '?'}`,
    },
  ];
}

export class SeasonEndTab implements AdminTab {
  private _host: HTMLElement | null = null;
  private _ctx: AdminTabContext | null = null;
  private readonly _seasonAwardsService: SeasonAwardsService;

  /** Year of the last successful preview; finalize only enabled for it. */
  private _previewedYear: number | null = null;
  /** Re-entrancy guard: both buttons disabled while a call is in flight. */
  private _busy = false;

  constructor(seasonAwardsService: SeasonAwardsService) {
    this._seasonAwardsService = seasonAwardsService;
  }

  mount(host: HTMLElement, ctx: AdminTabContext): void {
    this._host = host;
    this._ctx = ctx;

    host.innerHTML = `
      <h3>Season End</h3>
      <p class="admin-publish-note">
        Compute the season trophies from published results, review the preview, then finalize.
        Finalizing writes the awards to the season and marks it complete. It is safe to re-run:
        if a week is corrected and republished, run Preview and Finalize again.
      </p>
      <p id="se-season-status" class="admin-status" aria-live="polite"></p>
      <p id="se-week-warning" class="admin-status admin-status--error" hidden></p>
      <div class="admin-form-row">
        <button id="se-preview-btn" class="btn-primary">Compute Awards Preview</button>
      </div>
      <div id="se-preview-wrapper" class="admin-table-wrapper" hidden>
        <table>
          <tbody id="se-preview-body"></tbody>
        </table>
      </div>
      <div class="admin-form-row">
        <button id="se-finalize-btn" class="btn-danger" disabled>Finalize Season</button>
      </div>
      <p id="se-status" class="admin-status" aria-live="polite"></p>`;

    host.querySelector('#se-preview-btn')!.addEventListener('click', () => void this._preview());
    host.querySelector('#se-finalize-btn')!.addEventListener('click', () => void this._finalize());

    this._renderSeasonStatus();
  }

  onYearChange(): void {
    this._clearPreview();
    this._renderSeasonStatus();
  }

  onSeasonChanged(): void {
    this._renderSeasonStatus();
  }

  onActivate(): void {
    this._renderSeasonStatus();
  }

  // ── Rendering ────────────────────────────────────────────────────────────

  private _renderSeasonStatus(): void {
    const el = this._host?.querySelector('#se-season-status');
    if (!el) return;
    const season = this._ctx?.getSeasonData();
    if (!season) {
      el.textContent = 'No season data loaded for this year.';
      return;
    }
    const awardsState = season.awards ? 'awards written' : 'no awards yet';
    el.textContent =
      `Season ${season.year}: status ${season.status}, ` +
      `week ${season.currentWeek} of ${WEEK_COUNT}, ${awardsState}.`;
  }

  private _renderPreview(awards: SeasonAwards): void {
    const host = this._host;
    if (!host) return;
    const table = host.querySelector<HTMLElement>('#se-preview-wrapper')!;
    const body = host.querySelector('#se-preview-body')!;
    body.textContent = '';
    for (const row of previewRows(awards)) {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = row.label;
      const td = document.createElement('td');
      td.textContent = row.value;
      tr.append(th, td);
      body.appendChild(tr);
    }
    table.hidden = false;
  }

  private _clearPreview(): void {
    const host = this._host;
    if (!host) return;
    this._previewedYear = null;
    host.querySelector<HTMLElement>('#se-preview-wrapper')!.hidden = true;
    host.querySelector('#se-preview-body')!.textContent = '';
    host.querySelector<HTMLButtonElement>('#se-finalize-btn')!.disabled = true;
    host.querySelector<HTMLElement>('#se-week-warning')!.hidden = true;
    this._setStatus('', '');
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  private async _preview(): Promise<void> {
    const ctx = this._ctx;
    if (!ctx || this._busy) return;
    const year = ctx.getYear();

    this._setBusy(true);
    this._setStatus('Computing preview…', '');
    const result = await this._seasonAwardsService.previewAwards(year);
    this._setBusy(false);

    if (!result.success) {
      this._clearPreview();
      this._setStatus(`Preview failed: ${result.error}`, 'error');
      return;
    }

    this._previewedYear = year;
    this._renderPreview(result.data);

    const warning = this._host?.querySelector<HTMLElement>('#se-week-warning');
    const season = ctx.getSeasonData();
    if (warning) {
      if (season && season.currentWeek < WEEK_COUNT) {
        warning.textContent =
          `Only ${season.currentWeek} of ${WEEK_COUNT} weeks are published. ` +
          'Finalize anyway only if the season genuinely ended early.';
        warning.hidden = false;
      } else {
        warning.hidden = true;
      }
    }

    this._host!.querySelector<HTMLButtonElement>('#se-finalize-btn')!.disabled = false;
    this._setStatus('Preview ready. Review the values above, then finalize.', 'success');
  }

  private async _finalize(): Promise<void> {
    const ctx = this._ctx;
    if (!ctx || this._busy) return;
    const year = ctx.getYear();
    if (this._previewedYear !== year) return; // stale preview — button should be disabled

    const ok = window.confirm(
      `Finalize season ${year}? This writes the previewed awards and marks the season complete. ` +
      'You can re-run Preview + Finalize later if a week is corrected.',
    );
    if (!ok) return;

    this._setBusy(true);
    this._setStatus('Finalizing…', '');
    const result = await this._seasonAwardsService.finalizeSeason(year);
    this._setBusy(false);

    if (!result.success) {
      this._setStatus(`Finalize failed: ${result.error}`, 'error');
      return;
    }

    showToast('success', `Season ${year} finalized — awards written.`);
    this._setStatus(`Season ${year} finalized.`, 'success');
    void ctx.refreshSeason();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private _setBusy(busy: boolean): void {
    this._busy = busy;
    const host = this._host;
    if (!host) return;
    host.querySelector<HTMLButtonElement>('#se-preview-btn')!.disabled = busy;
    const finalizeBtn = host.querySelector<HTMLButtonElement>('#se-finalize-btn')!;
    finalizeBtn.disabled = busy || this._previewedYear === null;
  }

  private _setStatus(message: string, type: '' | 'success' | 'error'): void {
    setStatus(this._host?.querySelector('#se-status') ?? null, message, type);
  }
}
