/**
 * season-scorecards — Custom Element
 *
 * Displays a year dropdown and per-team collapsible scorecard tables driven
 * from Firestore. Pure rendering: all data assembly happens in ScoreService.
 * No shadow DOM; uses global CSS classes.
 */

import { db } from '@/firebase-config';
import { createRepositoryFactory } from '@/repositories/repository-factory';
import { ScoreService } from '@/services/score-service';
import type { Season } from '@/types/season';
import type { ScorecardRowShooter, ScorecardTeamBlock } from '@/types/scorecard';

const factory = createRepositoryFactory({ db });
const scoreService = new ScoreService(factory.getScoreRepository());

const WEEK_HEADERS = ['W0', 'W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12', 'W13', 'W14', 'W15'];

function fmt(val: number | null | undefined | '-' | string): string {
  return val === null || val === undefined || val === '-' ? '-' : String(val);
}

class SeasonScorecards extends HTMLElement {
  private _seasons: Season[] = [];
  private _selectedYear: number | null = null;
  private _teamBlocks: ScorecardTeamBlock[] = [];

  connectedCallback(): void {
    this.innerHTML = `
      <div class="season-scorecards">
        <div class="season-scorecards-controls">
          <label for="sc-year">Season</label>
          <select id="sc-year"></select>
        </div>
        <div id="sc-content">${SeasonScorecards._scorecardsSkeletonHTML()}</div>
      </div>`;

    this.querySelector<HTMLSelectElement>('#sc-year')!.addEventListener('change', (e) => {
      const year = parseInt((e.target as HTMLSelectElement).value, 10);
      this._selectedYear = year;
      void this._loadYear(year);
    });

    this.querySelector('#sc-content')!.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button.collapsible') as HTMLElement | null;
      if (!btn) return;
      btn.classList.toggle('active');
      const panel = btn.nextElementSibling;
      if (panel?.classList.contains('scorecard')) {
        (panel as HTMLElement).style.maxHeight =
          (panel as HTMLElement).style.maxHeight ? '' : `${panel.scrollHeight}px`;
      }
    });

    void this._loadSeasons();
  }

  private async _loadSeasons(): Promise<void> {
    const result = await scoreService.getAllSeasons();
    if (!result.success) {
      this.querySelector('#sc-content')!.innerHTML = '<p>Error loading seasons.</p>';
      return;
    }

    this._seasons = result.data ?? [];
    const yearSelect = this.querySelector<HTMLSelectElement>('#sc-year')!;

    for (const season of this._seasons) {
      const opt = document.createElement('option');
      opt.value = String(season.year);
      opt.textContent = String(season.year);
      yearSelect.appendChild(opt);
    }

    if (this._seasons.length > 0) {
      const defaultYear = this._seasons[0]!.year;
      this._selectedYear = defaultYear;
      yearSelect.value = String(defaultYear);
      await this._loadYear(defaultYear);
    } else {
      this.querySelector('#sc-content')!.innerHTML = '<p>No seasons available.</p>';
    }
  }

  private static _scorecardsSkeletonHTML(): string {
    const pill = `<span class="skeleton skeleton--xl" style="width:100%;border-radius:var(--radius-md)"></span>`;
    return `
      <div class="skeleton-group" style="padding-top:var(--space-2)">
        ${pill.repeat(5)}
      </div>`;
  }

  private async _loadYear(year: number): Promise<void> {
    this.querySelector('#sc-content')!.innerHTML = SeasonScorecards._scorecardsSkeletonHTML();

    const result = await scoreService.buildScorecardData(year);
    if (!result.success) {
      this.querySelector('#sc-content')!.innerHTML = `<p>Error loading scorecard data for ${year}.</p>`;
      return;
    }

    this._teamBlocks = result.data.teams;
    this._renderScorecards();
  }

  private _renderScorecards(): void {
    const content = this.querySelector('#sc-content')!;
    if (this._teamBlocks.length === 0) {
      content.innerHTML = `<p>No scorecard data available for ${this._selectedYear}.</p>`;
      return;
    }
    content.innerHTML = this._teamBlocks.map(SeasonScorecards._renderTeamBlock).join('\n');
  }

  private static _renderTeamBlock(block: ScorecardTeamBlock): string {
    const headerCells = WEEK_HEADERS.map((w) => `<th>${w}</th>`).join('');

    const shooterRows = block.shooters
      .map((s: ScorecardRowShooter) => {
        const rookieMark = s.rookie ? 'R' : '';
        const scoreCells = s.scores.map((v) => `<td>${fmt(v)}</td>`).join('');
        const weeks = s.weeksShot !== null ? s.weeksShot : '-';
        const rowClass = s.isDummy ? ' class="dummy-row"' : '';
        return `<tr${rowClass}><td>${s.name}</td><td>${rookieMark}</td><td>${fmt(s.w0Display)}</td>${scoreCells}<td>${weeks}</td><td>${fmt(s.finalAvg)}</td></tr>`;
      })
      .join('\n        ');

    const targetCells = block.targets.map((v) => `<td>${fmt(v)}</td>`).join('');
    const rpCells = block.rankPoints.map((v) => `<td>${fmt(v)}</td>`).join('');
    const bpCells = block.bonusPoints.map((v) => `<td>${fmt(v)}</td>`).join('');

    const chevronSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 320 512" class="collapsible__chevron" aria-hidden="true" focusable="false"><path fill="currentColor" d="M137.4 374.6c12.5 12.5 32.8 12.5 45.3 0l128-128c9.2-9.2 11.9-22.9 6.9-34.9s-16.6-19.8-29.6-19.8H32c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l128 128z"/></svg>`;

    return `
    <button class="collapsible"><span class="collapsible__label">${block.teamName}</span>${chevronSvg}</button>
    <div class="scorecard">
      <table class="scorecard-tables">
        <tr><th></th><th>R</th>${headerCells}<th>Weeks Shot</th><th>Avg</th></tr>
        ${shooterRows}
        <tr><td>TOTAL TARGETS</td><td></td><td></td>${targetCells}<td></td><td></td></tr>
        <tr><td>RANK POINTS</td><td></td><td></td>${rpCells}<td></td><td></td></tr>
        <tr><td>BONUS POINTS</td><td></td><td></td>${bpCells}<td></td><td></td></tr>
      </table>
    </div>`;
  }
}

customElements.define('season-scorecards', SeasonScorecards);
