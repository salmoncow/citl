/**
 * season-scorecards — Custom Element
 *
 * Displays a year dropdown and per-team collapsible scorecard tables driven from Firestore.
 * No shadow DOM; uses global CSS classes.
 */

import { db } from '@/firebase-config';
import { createRepositoryFactory } from '@/repositories/repository-factory';
import { ScoreService, buildPriorAvgMap } from '@/services/score-service';
import { computeShooterAverage, computeShooterStartingAvg, isShooterRookie, mean, isDummyName, normalizeShooterName, getLastWord } from '@/services/scoring-engine';
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
  weeksShot?: number | null;
  finalAvg?: number | string;
}

function fmt(val: number | null | undefined | '-' | string): string {
  return val === null || val === undefined || val === '-' ? '-' : String(val);
}



class SeasonScorecards extends HTMLElement {
  private _seasons: Season[] = [];
  private _selectedYear: number | null = null;
  private _teams: Team[] = [];
  private _allWeekResults: WeekResult[] = [];
  private _prior1Teams: Team[] = [];
  private _prior2Teams: Team[] = [];
  private _prior1AvgMap: Map<string, number> = new Map();

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

  private async _loadYear(year: number): Promise<void> {
    this.querySelector('#sc-content')!.innerHTML = '<p>Loading&hellip;</p>';

    const [teamsResult, weeksResult, prior1TeamsResult, prior2TeamsResult, prior1WeeksResult] = await Promise.all([
      scoreService.getTeams(year),
      scoreService.getAllWeekResults(year),
      scoreService.getTeams(year - 1),
      scoreService.getTeams(year - 2),
      scoreService.getAllWeekResults(year - 1),
    ]);

    this._teams = teamsResult.success ? (teamsResult.data ?? []) : [];
    this._allWeekResults = weeksResult.success ? (weeksResult.data ?? []) : [];
    this._prior1Teams = prior1TeamsResult.success ? prior1TeamsResult.data : [];
    this._prior2Teams = prior2TeamsResult.success ? prior2TeamsResult.data : [];
    const prior1Weeks = prior1WeeksResult.success ? prior1WeeksResult.data : [];
    this._prior1AvgMap = buildPriorAvgMap(prior1Weeks, this._prior1Teams);

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
        const key = normalizeShooterName(s.name);
        const computedAvg = this._prior1AvgMap.get(key) ?? computeShooterStartingAvg(s.name, this._prior1Teams);
        const computedRookie = isShooterRookie(s.name, this._prior1Teams, this._prior2Teams);
        shooterMap.set(s.name, {
          name: s.name,
          rookie: computedRookie,
          isDummy: isDummyName(s.name),
          startingAvg: computedAvg,
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
          // Only add shooters not already on the current roster if they are dummies.
          // Real shooters removed from the roster must not reappear via published data.
          if (!isDummyName(ss.name)) continue;
          shooterMap.set(ss.name, {
            name: ss.name,
            rookie: false,
            isDummy: true,
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
      const prefix = getLastWord(teamName);
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
      const dummyW0Display = Math.round(mean(realW1Scores) * 10) / 10;
      for (const s of shooterMap.values()) {
        if (s.isDummy) s.w0Display = dummyW0Display;
      }
    }

    // Compute weeksShot and finalAvg per shooter
    const shooters: ShooterState[] = [...shooterMap.values()].map((s) => {
      const nonNull = s.scores.filter((v): v is number => v !== null);
      const weeksShot = nonNull.length > 0 ? nonNull.length : null;
      const w0 = s.isDummy
        ? (nonNull.length > 0 ? (s.w0Display ?? null) : null)
        : (typeof s.startingAvg === 'number' ? s.startingAvg : null);
      const finalAvg = w0 !== null
        ? Math.round(computeShooterAverage(w0, s.scores, 14) * 10) / 10
        : nonNull.length > 0
          ? Math.round(mean(nonNull) * 10) / 10
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

    const chevronSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 320 512" class="collapsible__chevron" aria-hidden="true" focusable="false"><path fill="currentColor" d="M137.4 374.6c12.5 12.5 32.8 12.5 45.3 0l128-128c9.2-9.2 11.9-22.9 6.9-34.9s-16.6-19.8-29.6-19.8H32c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l128 128z"/></svg>`;

    return `
    <button class="collapsible"><span class="collapsible__label">${teamName}</span>${chevronSvg}</button>
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
