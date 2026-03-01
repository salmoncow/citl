/**
 * season-scorecards — Custom Element
 *
 * Displays a year dropdown and per-team collapsible scorecard tables driven from Firestore.
 * No shadow DOM; uses global CSS classes.
 */

import { db } from '@/firebase-config';
import { createRepositoryFactory } from '@/repositories/repository-factory';
import { ScoreService } from '@/services/score-service';
import { computeShooterAverage } from '@/services/scoring-engine';
import type { Season } from '@/types/season';
import type { Team, WeekResult } from '@/types/score';

const factory = createRepositoryFactory({ db });
const scoreService = new ScoreService(factory.getScoreRepository());

const WEEK_HEADERS = ['W0', 'W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12', 'W13', 'W14', 'W15'];

/** Runtime state for a shooter during display rendering */
interface ShooterState {
  name: string;
  rookie: boolean;
  isDummy: boolean;
  startingAvg: number | '-';
  scores: (number | null)[];
  w0Display?: number;
  effectiveW0?: number;
  weeksShot?: number | null;
  finalAvg?: number | string;
}

function fmt(val: number | null | undefined | '-' | string): string {
  return val === null || val === undefined || val === '-' ? '-' : String(val);
}

function lastWord(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? '';
}

class SeasonScorecards extends HTMLElement {
  private _seasons: Season[] = [];
  private _selectedYear: number | null = null;
  private _teams: Team[] = [];
  private _allWeekResults: WeekResult[] = [];

  connectedCallback(): void {
    this.innerHTML = `
      <div class="season-scorecards">
        <div class="season-scorecards-controls">
          <label for="sc-year">Season</label>
          <select id="sc-year"></select>
        </div>
        <div id="sc-content"><p>Loading&hellip;</p></div>
      </div>`;

    this.querySelector<HTMLSelectElement>('#sc-year')!.addEventListener('change', (e) => {
      const year = parseInt((e.target as HTMLSelectElement).value, 10);
      this._selectedYear = year;
      void this._loadYear(year);
    });

    // Event delegation for collapsible buttons
    this.querySelector('#sc-content')!.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.matches('button.collapsible')) return;
      target.classList.toggle('active');
      const panel = target.nextElementSibling;
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

  private async _loadYear(year: number): Promise<void> {
    this.querySelector('#sc-content')!.innerHTML = '<p>Loading&hellip;</p>';

    const [teamsResult, weeksResult] = await Promise.all([
      scoreService.getTeams(year),
      scoreService.getAllWeekResults(year),
    ]);

    this._teams = teamsResult.success ? (teamsResult.data ?? []) : [];
    this._allWeekResults = weeksResult.success ? (weeksResult.data ?? []) : [];

    if (!weeksResult.success && !teamsResult.success) {
      this.querySelector('#sc-content')!.innerHTML = `<p>Error loading scorecard data for ${year}.</p>`;
      return;
    }

    this._renderScorecards();
  }

  private _renderScorecards(): void {
    const content = this.querySelector('#sc-content')!;

    const teamDocMap = new Map<string, Team>();
    for (const team of this._teams) {
      teamDocMap.set(team.name, team);
    }

    const teamNamesFromWeeks = new Set<string>();
    for (const wr of this._allWeekResults) {
      for (const tr of wr.teamResults ?? []) {
        teamNamesFromWeeks.add(tr.teamName);
      }
    }

    const allTeamNames: string[] = [];
    for (const team of this._teams) {
      allTeamNames.push(team.name);
      teamNamesFromWeeks.delete(team.name);
    }
    for (const name of teamNamesFromWeeks) {
      allTeamNames.push(name);
    }

    if (allTeamNames.length === 0) {
      content.innerHTML = `<p>No scorecard data available for ${this._selectedYear}.</p>`;
      return;
    }

    const blocks = allTeamNames.map((teamName) => this._buildTeamBlock(teamName, teamDocMap.get(teamName)));
    content.innerHTML = blocks.join('\n');
  }

  private _buildTeamBlock(teamName: string, teamDoc: Team | undefined): string {
    const shooterMap = new Map<string, ShooterState>();

    if (teamDoc?.shooters?.length) {
      for (const s of teamDoc.shooters) {
        shooterMap.set(s.name, {
          name: s.name,
          rookie: s.rookie ?? false,
          isDummy: s.name.toUpperCase().includes('DUMMY'),
          startingAvg: s.startingAvg ?? '-',
          scores: new Array<number | null>(15).fill(null),
        });
      }
    }

    const targets: (number | null)[] = new Array(15).fill(null);
    const rankPoints: (number | null)[] = new Array(15).fill(null);
    const bonusPoints: (number | null)[] = new Array(15).fill(null);

    for (const wr of this._allWeekResults) {
      const wi = wr.weekNumber - 1;
      if (wi < 0 || wi >= 15) continue;

      const teamResult = (wr.teamResults ?? []).find((tr) => tr.teamName === teamName);
      if (!teamResult) continue;

      targets[wi] = teamResult.targets ?? null;
      rankPoints[wi] = teamResult.rankPoints ?? null;
      bonusPoints[wi] = teamResult.bonusPoints ?? null;

      for (const ss of teamResult.shooterScores ?? []) {
        if (!shooterMap.has(ss.name)) {
          shooterMap.set(ss.name, {
            name: ss.name,
            rookie: false,
            isDummy: ss.name.toUpperCase().includes('DUMMY'),
            startingAvg: '-',
            scores: new Array<number | null>(15).fill(null),
          });
        }
        shooterMap.get(ss.name)!.scores[wi] = ss.total ?? null;
      }
    }

    // Pad to 2 DUMMY placeholder rows per team
    const existingDummies = [...shooterMap.values()].filter((s) => s.isDummy);
    if (existingDummies.length < 2) {
      const prefix = lastWord(teamName);
      for (let n = existingDummies.length + 1; n <= 2; n++) {
        const dName = `${prefix} DUMMY${n}`;
        if (!shooterMap.has(dName)) {
          shooterMap.set(dName, {
            name: dName,
            rookie: false,
            isDummy: true,
            startingAvg: '-',
            scores: new Array<number | null>(15).fill(null),
          });
        }
      }
    }

    // DUMMY W0 display = mean of real teammates' actual W1 scores
    const realW1Scores = [...shooterMap.values()]
      .filter((s) => !s.isDummy && s.scores[0] !== null)
      .map((s) => s.scores[0] as number);
    if (realW1Scores.length > 0) {
      const dummyW0Display =
        Math.round((realW1Scores.reduce((a, b) => a + b, 0) / realW1Scores.length) * 10) / 10;
      for (const s of shooterMap.values()) {
        if (s.isDummy) s.w0Display = dummyW0Display;
      }
    }

    // DUMMY effective W0 for finalAvg = mean of real teammates' numeric startingAvgs
    const realNumericStartingAvgs = [...shooterMap.values()]
      .filter((s) => !s.isDummy && typeof s.startingAvg === 'number')
      .map((s) => s.startingAvg as number);
    if (realNumericStartingAvgs.length > 0) {
      const dummyEffectiveW0 =
        realNumericStartingAvgs.reduce((a, b) => a + b, 0) / realNumericStartingAvgs.length;
      for (const s of shooterMap.values()) {
        if (s.isDummy) s.effectiveW0 = dummyEffectiveW0;
      }
    }

    // Compute weeksShot and finalAvg per shooter
    const shooters: ShooterState[] = [...shooterMap.values()].map((s) => {
      const nonNull = s.scores.filter((v): v is number => v !== null);
      const weeksShot = nonNull.length > 0 ? nonNull.length : null;
      const w0 = typeof s.startingAvg === 'number'
        ? s.startingAvg
        : (nonNull.length > 0 ? (s.effectiveW0 ?? null) : null);
      const finalAvg = w0 !== null
        ? Math.round(computeShooterAverage(w0, s.scores, 14) * 10) / 10
        : nonNull.length > 0
          ? Math.round((nonNull.reduce((a, b) => a + b, 0) / nonNull.length) * 10) / 10
          : (s.w0Display ?? s.startingAvg);
      return { ...s, weeksShot, finalAvg };
    });

    // Sort: real shooters first, dummies last
    shooters.sort((a, b) => {
      if (a.isDummy === b.isDummy) return 0;
      return a.isDummy ? 1 : -1;
    });

    const headerCells = WEEK_HEADERS.map((w) => `<th>${w}</th>`).join('');

    const shooterRows = shooters
      .map((s) => {
        const rookieMark = s.rookie ? 'R' : '';
        const scoreCells = s.scores.map((v) => `<td>${fmt(v)}</td>`).join('');
        const weeks = s.weeksShot !== null ? s.weeksShot : '-';
        const rowClass = s.isDummy ? ' class="dummy-row"' : '';
        return `<tr${rowClass}><td>${s.name}</td><td>${rookieMark}</td><td>${fmt(s.w0Display ?? s.startingAvg)}</td>${scoreCells}<td>${weeks}</td><td>${fmt(s.finalAvg)}</td></tr>`;
      })
      .join('\n        ');

    const targetCells = targets.map((v) => `<td>${fmt(v)}</td>`).join('');
    const rpCells = rankPoints.map((v) => `<td>${fmt(v)}</td>`).join('');
    const bpCells = bonusPoints.map((v) => `<td>${fmt(v)}</td>`).join('');

    return `
    <button class="collapsible">${teamName}</button>
    <div class="scorecard">
      <table class="scorecard-tables">
        <tr><th></th><th></th>${headerCells}<th>Weeks Shot</th><th>Avg</th></tr>
        ${shooterRows}
        <tr><td>TOTAL TARGETS</td><td></td><td></td>${targetCells}<td></td><td></td></tr>
        <tr><td>RANK POINTS</td><td></td><td></td>${rpCells}<td></td><td></td></tr>
        <tr><td>BONUS POINTS</td><td></td><td></td>${bpCells}<td></td><td></td></tr>
      </table>
    </div>`;
  }
}

customElements.define('season-scorecards', SeasonScorecards);
