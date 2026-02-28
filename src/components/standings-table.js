/**
 * standings-table — Custom Element
 *
 * Displays cumulative season standings (rank points + bonus points per team,
 * ranked by total descending). Data source: Firestore `seasons/{year}.standings`
 *
 * Usage: <standings-table year="2025"></standings-table>
 *
 * Attributes:
 *   year {string} — four-digit season year (e.g. "2025")
 *
 * No shadow DOM; uses global `.standing-table` CSS class.
 */

import { db } from '@/firebase-config.js';
import { createRepositoryFactory } from '@/repositories/repository-factory.js';
import { ScoreService } from '@/services/score-service.js';

const factory = createRepositoryFactory({ db });
const scoreService = new ScoreService(factory.getScoreRepository());

class StandingsTable extends HTMLElement {
  static get observedAttributes() {
    return ['year'];
  }

  connectedCallback() {
    this._render();
  }

  attributeChangedCallback(_name, oldVal, newVal) {
    if (oldVal !== newVal && this.isConnected) {
      this._render();
    }
  }

  _render() {
    const year = parseInt(this.getAttribute('year'), 10);
    if (!year) {
      this.innerHTML = '<p>No year specified.</p>';
      return;
    }

    this.innerHTML = '<p>Loading&hellip;</p>';

    scoreService.getSeason(year)
      .then((result) => {
        if (!result.success || !result.data) {
          this.innerHTML = `<p>Error loading standings for ${year}.</p>`;
          return;
        }
        const standings = result.data.standings ?? [];
        this.innerHTML = this._buildTable(standings);
      })
      .catch((err) => {
        console.error('[standings-table] error:', err);
        this.innerHTML = `<p>Error loading standings for ${year}.</p>`;
      });
  }

  /**
   * Build the standings HTML table.
   * @param {import('@/types/season.js').SeasonStandings[]} standings
   * @returns {string}
   */
  _buildTable(standings) {
    const trs = standings
      .map(
        (r) => `<tr>
          <td>${r.rank}</td>
          <td>${r.teamName}</td>
          <td>${r.totalRankPoints}</td>
          <td>${r.totalBonusPoints}</td>
          <td>${r.totalRankPoints + r.totalBonusPoints}</td>
        </tr>`
      )
      .join('');

    return `
      <table class="standing-table">
        <thead>
          <tr>
            <th>Place</th>
            <th>Team</th>
            <th>Rank Pts</th>
            <th>Bonus Pts</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>${trs}</tbody>
      </table>
    `;
  }
}

customElements.define('standings-table', StandingsTable);
