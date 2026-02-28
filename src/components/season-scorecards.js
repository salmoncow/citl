/**
 * season-scorecards — Custom Element
 *
 * Displays a year dropdown and per-team collapsible scorecard tables driven from Firestore.
 * No shadow DOM; uses global CSS classes (same markup as the previous static renderer).
 *
 * Data sources:
 *   - Year dropdown: getAllSeasons() — newest first
 *   - Per-season data: getTeams(year) + getAllWeekResults(year) in parallel
 *
 * Graceful degradation for 2019–2024 (before seed-historical-teams.js runs):
 *   - startingAvg (W0 column) → "-"
 *   - rookie (R column) → ""
 *   - All weekly scores + totals rows are still populated from WeekResult docs
 *
 * All values inserted via template literals into <td> (no user input;
 * accepted innerHTML pattern per constitution §IV.2 for developer-authored strings).
 */

import { db } from '@/firebase-config.js';
import { createRepositoryFactory } from '@/repositories/repository-factory.js';
import { ScoreService } from '@/services/score-service.js';
import { computeShooterAverage } from '@/services/scoring-engine.js';

const factory = createRepositoryFactory({ db });
const scoreService = new ScoreService(factory.getScoreRepository());

const WEEK_HEADERS = ['W0', 'W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12', 'W13', 'W14', 'W15'];

/** @param {number|null|undefined|string} val */
function fmt(val) {
  return val === null || val === undefined || val === '-' ? '-' : String(val);
}

/** @param {string} name */
function lastWord(name) {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1];
}

class SeasonScorecards extends HTMLElement {
  connectedCallback() {
    /** @type {import('@/types/season.js').Season[]} */
    this._seasons = [];
    this._selectedYear = null;
    /** @type {Array} */
    this._teams = [];
    /** @type {import('@/types/score.js').WeekResult[]} */
    this._allWeekResults = [];

    this.innerHTML = `
      <div class="season-scorecards">
        <div class="season-scorecards-controls">
          <label for="sc-year">Season</label>
          <select id="sc-year"></select>
        </div>
        <div id="sc-content"><p>Loading&hellip;</p></div>
      </div>`;

    this.querySelector('#sc-year').addEventListener('change', (e) => {
      const year = parseInt(e.target.value, 10);
      this._selectedYear = year;
      this._loadYear(year);
    });

    // Event delegation for collapsible buttons
    this.querySelector('#sc-content').addEventListener('click', (e) => {
      if (!e.target.matches('button.collapsible')) return;
      e.target.classList.toggle('active');
      const panel = e.target.nextElementSibling;
      if (panel?.classList.contains('scorecard')) {
        panel.style.maxHeight = panel.style.maxHeight ? null : `${panel.scrollHeight}px`;
      }
    });

    this._loadSeasons();
  }

  async _loadSeasons() {
    const result = await scoreService.getAllSeasons();
    if (!result.success) {
      this.querySelector('#sc-content').innerHTML = '<p>Error loading seasons.</p>';
      return;
    }

    this._seasons = result.data ?? [];
    const yearSelect = this.querySelector('#sc-year');

    for (const season of this._seasons) {
      const opt = document.createElement('option');
      opt.value = season.year;
      opt.textContent = season.year;
      yearSelect.appendChild(opt);
    }

    if (this._seasons.length > 0) {
      const defaultYear = this._seasons[0].year;
      this._selectedYear = defaultYear;
      yearSelect.value = defaultYear;
      await this._loadYear(defaultYear);
    } else {
      this.querySelector('#sc-content').innerHTML = '<p>No seasons available.</p>';
    }
  }

  async _loadYear(year) {
    this.querySelector('#sc-content').innerHTML = '<p>Loading&hellip;</p>';

    const [teamsResult, weeksResult] = await Promise.all([
      scoreService.getTeams(year),
      scoreService.getAllWeekResults(year),
    ]);

    this._teams = teamsResult.success ? (teamsResult.data ?? []) : [];
    this._allWeekResults = weeksResult.success ? (weeksResult.data ?? []) : [];

    if (!weeksResult.success && !teamsResult.success) {
      this.querySelector('#sc-content').innerHTML = `<p>Error loading scorecard data for ${year}.</p>`;
      return;
    }

    this._renderScorecards();
  }

  _renderScorecards() {
    const content = this.querySelector('#sc-content');

    // Build a map of teamName → team doc (for startingAvg / rookie)
    const teamDocMap = new Map();
    for (const team of this._teams) {
      teamDocMap.set(team.name, team);
    }

    // Collect all team names from WeekResults (source of truth for who played)
    const teamNamesFromWeeks = new Set();
    for (const wr of this._allWeekResults) {
      for (const tr of wr.teamResults ?? []) {
        teamNamesFromWeeks.add(tr.teamName);
      }
    }

    // Merge: team doc names first (preserves roster order), then any extras from WeekResults
    const allTeamNames = [];
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

  /**
   * Build the collapsible button + table HTML for one team.
   * @param {string} teamName
   * @param {Object|undefined} teamDoc - Firestore team doc (may be absent for 2019–2024 pre-migration)
   * @returns {string}
   */
  _buildTeamBlock(teamName, teamDoc) {
    // 1. Build shooter map from team doc (or empty if absent)
    const shooterMap = new Map();

    if (teamDoc?.shooters?.length) {
      for (const s of teamDoc.shooters) {
        shooterMap.set(s.name, {
          name: s.name,
          rookie: s.rookie ?? false,
          isDummy: s.name.toUpperCase().includes('DUMMY'),
          startingAvg: s.startingAvg ?? '-',
          scores: new Array(15).fill(null),
        });
      }
    }

    // 2. Build team totals arrays (indexed [0..14] → weeks 1–15)
    const targets = new Array(15).fill(null);
    const rankPoints = new Array(15).fill(null);
    const bonusPoints = new Array(15).fill(null);

    // 3. Fill weekly scores and totals from WeekResults
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
          // Shooter appears in results but not in team doc (pre-migration or sub)
          shooterMap.set(ss.name, {
            name: ss.name,
            rookie: false,
            isDummy: ss.name.toUpperCase().includes('DUMMY'),
            startingAvg: '-',
            scores: new Array(15).fill(null),
          });
        }
        shooterMap.get(ss.name).scores[wi] = ss.total ?? null;
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
            scores: new Array(15).fill(null),
          });
        }
      }
    }

    // DUMMY W0 display = mean of real teammates' actual W1 scores
    const realW1Scores = [...shooterMap.values()]
      .filter((s) => !s.isDummy && s.scores[0] !== null)
      .map((s) => s.scores[0]);
    if (realW1Scores.length > 0) {
      const dummyW0Display =
        Math.round((realW1Scores.reduce((a, b) => a + b, 0) / realW1Scores.length) * 10) / 10;
      for (const s of shooterMap.values()) {
        if (s.isDummy) s.w0Display = dummyW0Display;
      }
    }

    // DUMMY effective W0 for finalAvg = mean of real teammates' numeric startingAvgs
    // (= mean of real shooters' going-in avgs before W1, per scoring-engine rule)
    const realNumericStartingAvgs = [...shooterMap.values()]
      .filter((s) => !s.isDummy && Number.isFinite(s.startingAvg))
      .map((s) => s.startingAvg);
    if (realNumericStartingAvgs.length > 0) {
      const dummyEffectiveW0 =
        realNumericStartingAvgs.reduce((a, b) => a + b, 0) / realNumericStartingAvgs.length;
      for (const s of shooterMap.values()) {
        if (s.isDummy) s.effectiveW0 = dummyEffectiveW0;
      }
    }

    // 4. Compute weeksShot and finalAvg per shooter
    const shooters = [...shooterMap.values()].map((s) => {
      const nonNull = s.scores.filter((v) => v !== null);
      const weeksShot = nonNull.length > 0 ? nonNull.length : null;
      const w0 = Number.isFinite(s.startingAvg) ? s.startingAvg : (nonNull.length > 0 ? (s.effectiveW0 ?? null) : null);
      const finalAvg = w0 !== null
        ? Math.round(computeShooterAverage(w0, s.scores, 14) * 10) / 10
        : nonNull.length > 0
          ? Math.round((nonNull.reduce((a, b) => a + b, 0) / nonNull.length) * 10) / 10
          : s.w0Display ?? s.startingAvg;
      return { ...s, weeksShot, finalAvg };
    });

    // 5. Render
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
