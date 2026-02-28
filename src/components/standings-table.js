/**
 * standings-table — Custom Element
 *
 * Displays cumulative season standings (rank points + bonus points per team,
 * ranked by total descending). Data source: static JSON scorecards.
 *
 * Usage: <standings-table year="2025"></standings-table>
 *
 * Attributes:
 *   year {string} — four-digit season year (e.g. "2025")
 *
 * No shadow DOM; uses global `.standing-table` CSS class.
 */

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
    const year = this.getAttribute('year');
    if (!year) {
      this.innerHTML = '<p>No year specified.</p>';
      return;
    }

    this.innerHTML = '<p>Loading&hellip;</p>';

    fetch(`/data/scorecards/${year}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const rows = this._computeStandings(data);
        this.innerHTML = this._buildTable(rows);
      })
      .catch((err) => {
        console.error('[standings-table] fetch error:', err);
        this.innerHTML = `<p>Error loading standings for ${year}.</p>`;
      });
  }

  /**
   * Compute cumulative standings from scorecard JSON.
   * @param {object} data — parsed scorecard JSON
   * @returns {Array<{teamName, rankPointsTotal, bonusPointsTotal, totalPoints, standing}>}
   */
  _computeStandings(data) {
    const rows = (data.teams || []).map((team) => {
      const rp = (team.totals?.rankPoints || []).reduce(
        (sum, v) => sum + (v != null ? v : 0),
        0
      );
      const bp = (team.totals?.bonusPoints || []).reduce(
        (sum, v) => sum + (v != null ? v : 0),
        0
      );
      return {
        teamName: team.name,
        rankPointsTotal: rp,
        bonusPointsTotal: bp,
        totalPoints: rp + bp,
      };
    });

    rows.sort((a, b) => b.totalPoints - a.totalPoints);

    rows.forEach((row, i) => {
      row.standing = i + 1;
    });

    return rows;
  }

  /**
   * Build the standings HTML table.
   * @param {Array} rows
   * @returns {string}
   */
  _buildTable(rows) {
    const trs = rows
      .map(
        (r) => `<tr>
          <td>${r.standing}</td>
          <td>${r.teamName}</td>
          <td>${r.rankPointsTotal}</td>
          <td>${r.bonusPointsTotal}</td>
          <td>${r.totalPoints}</td>
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
