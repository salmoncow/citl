/**
 * home-standings — Custom Element
 *
 * Displays a year/week dropdown and standings table driven from Firestore.
 * No shadow DOM; uses global CSS classes.
 *
 * Data sources:
 *   - Year dropdown: getAllSeasons() — newest first
 *   - Week dropdown: season.currentWeek from getSeason()
 *   - Season view: season.standings (cumulative totals)
 *   - Week N view: allWeekResults[N].teamResults + client-side cumulative totals
 *
 * All values inserted via template literals into <td> (no user input;
 * accepted innerHTML pattern per constitution §IV.2 for developer-authored strings).
 */

import { db } from '@/firebase-config.js';
import { createRepositoryFactory } from '@/repositories/repository-factory.js';
import { ScoreService } from '@/services/score-service.js';

const factory = createRepositoryFactory({ db });
const scoreService = new ScoreService(factory.getScoreRepository());

class HomeStandings extends HTMLElement {
  connectedCallback() {
    /** @type {import('@/types/season.js').Season[]} */
    this._seasons = [];
    this._selectedYear = null;
    /** @type {import('@/types/season.js').Season|null} */
    this._season = null;
    /** @type {import('@/types/score.js').WeekResult[]} */
    this._allWeekResults = [];

    this.innerHTML = `
      <div class="home-standings">
        <div class="home-standings-controls">
          <label for="hs-year">Season</label>
          <select id="hs-year"></select>
          <label for="hs-week">Week</label>
          <select id="hs-week"><option value="season">Season</option></select>
        </div>
        <div id="hs-table"><p>Loading&hellip;</p></div>
      </div>`;

    this.querySelector('#hs-year').addEventListener('change', (e) => {
      const year = parseInt(e.target.value, 10);
      this._selectedYear = year;
      this._loadYear(year);
    });

    this.querySelector('#hs-week').addEventListener('change', (e) => {
      this._renderTable(e.target.value);
    });

    this._loadSeasons();
  }

  async _loadSeasons() {
    const result = await scoreService.getAllSeasons();
    if (!result.success) {
      this.querySelector('#hs-table').innerHTML = '<p>Error loading seasons.</p>';
      return;
    }

    this._seasons = result.data ?? [];
    const yearSelect = this.querySelector('#hs-year');

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
      this.querySelector('#hs-table').innerHTML = '<p>No seasons available.</p>';
    }
  }

  async _loadYear(year) {
    this.querySelector('#hs-table').innerHTML = '<p>Loading&hellip;</p>';

    const [weeksResult, seasonResult] = await Promise.all([
      scoreService.getAllWeekResults(year),
      scoreService.getSeason(year),
    ]);

    if (!seasonResult.success || !seasonResult.data) {
      this.querySelector('#hs-table').innerHTML = `<p>Error loading standings for ${year}.</p>`;
      return;
    }

    this._season = seasonResult.data;
    this._allWeekResults = weeksResult.success ? (weeksResult.data ?? []) : [];

    // Populate week dropdown
    const weekSelect = this.querySelector('#hs-week');
    while (weekSelect.firstChild) weekSelect.removeChild(weekSelect.firstChild);

    const seasonOpt = document.createElement('option');
    seasonOpt.value = 'season';
    seasonOpt.textContent = 'Season';
    weekSelect.appendChild(seasonOpt);

    const currentWeek = this._season.currentWeek ?? 0;
    for (let w = 1; w <= currentWeek; w++) {
      const opt = document.createElement('option');
      opt.value = String(w);
      opt.textContent = `Week ${w}`;
      weekSelect.appendChild(opt);
    }

    weekSelect.value = 'season';
    this._renderTable('season');
  }

  _renderTable(weekKey) {
    let rows;
    let subtitle;

    if (weekKey === 'season') {
      const standings = this._season?.standings ?? [];
      rows = standings.map((s) => ({
        place: s.rank,
        teamName: s.teamName,
        targets: s.totalTargets,
        totalTargets: s.totalTargets,
        rankPoints: s.totalRankPoints,
        bonusPoints: s.totalBonusPoints,
        total: s.totalRankPoints + s.totalBonusPoints,
      }));
      subtitle = 'Cumulative season totals';
    } else {
      const weekNum = parseInt(weekKey, 10);
      const weekResult = this._allWeekResults.find((w) => w.weekNumber === weekNum);
      if (!weekResult) {
        this.querySelector('#hs-table').innerHTML = `<p>No data for Week ${weekNum}.</p>`;
        return;
      }

      // Compute cumulative totals through week N for each team
      const cumulative = {};
      for (const wr of this._allWeekResults) {
        if (wr.weekNumber > weekNum) continue;
        for (const tr of wr.teamResults ?? []) {
          if (!cumulative[tr.teamId]) {
            cumulative[tr.teamId] = { rankPoints: 0, bonusPoints: 0, targets: 0 };
          }
          cumulative[tr.teamId].rankPoints += tr.rankPoints ?? 0;
          cumulative[tr.teamId].bonusPoints += tr.bonusPoints ?? 0;
          cumulative[tr.teamId].targets += tr.targets ?? 0;
        }
      }

      rows = (weekResult.teamResults ?? []).map((tr) => {
        const cum = cumulative[tr.teamId] ?? { rankPoints: 0, bonusPoints: 0, targets: 0 };
        return {
          teamName: tr.teamName,
          targets: tr.targets,
          totalTargets: cum.targets,
          rankPoints: tr.rankPoints,
          bonusPoints: tr.bonusPoints,
          total: cum.rankPoints + cum.bonusPoints,
        };
      });

      // Re-rank by cumulative total descending
      rows.sort((a, b) => b.total - a.total);
      rows = rows.map((r, i) => ({ place: i + 1, ...r }));
      subtitle = `Week ${weekNum} results \u00b7 Total reflects season-to-date`;
    }

    this.querySelector('#hs-table').innerHTML = this._buildTable(rows, subtitle);
  }

  _buildTable(rows, subtitle) {
    const trs = rows
      .map(
        (r) => `
        <tr>
          <td>${r.place}</td>
          <td>${r.teamName}</td>
          <td>${r.targets}</td>
          <td>${r.totalTargets}</td>
          <td>${r.rankPoints}</td>
          <td>${r.bonusPoints}</td>
          <td>${r.total}</td>
        </tr>`,
      )
      .join('');

    return `
      <p class="hs-subtitle">${subtitle}</p>
      <table class="standing-table">
        <thead>
          <tr>
            <th>Place</th>
            <th>Team</th>
            <th>Targets</th>
            <th>Total Targets</th>
            <th>Rank Pts</th>
            <th>Bonus Pts</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>${trs}</tbody>
      </table>`;
  }
}

customElements.define('home-standings', HomeStandings);
