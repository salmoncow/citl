/**
 * home-standings — Custom Element
 *
 * Displays a year/week dropdown and standings table driven from Firestore.
 * No shadow DOM; uses global CSS classes.
 */

import { db } from '@/firebase-config';
import { createRepositoryFactory } from '@/repositories/repository-factory';
import { ScoreService } from '@/services/score-service';
import type { Team, WeekResult } from '@/types/score';
import type { Season } from '@/types/season';
import type { Accolade } from '@/types/shooter';

const factory = createRepositoryFactory({ db });
const scoreService = new ScoreService(factory.getScoreRepository());

class HomeStandings extends HTMLElement {
  private _seasons: Season[] = [];
  private _selectedYear: number | null = null;
  private _season: Season | null = null;
  private _allWeekResults: WeekResult[] = [];
  private _teams: Team[] = [];

  connectedCallback(): void {
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

    this.querySelector<HTMLSelectElement>('#hs-year')!.addEventListener('change', (e) => {
      const year = parseInt((e.target as HTMLSelectElement).value, 10);
      this._selectedYear = year;
      void this._loadYear(year);
    });

    this.querySelector<HTMLSelectElement>('#hs-week')!.addEventListener('change', (e) => {
      this._renderTable((e.target as HTMLSelectElement).value);
    });

    void this._loadSeasons();
  }

  private async _loadSeasons(): Promise<void> {
    const result = await scoreService.getAllSeasons();
    if (!result.success) {
      this.querySelector('#hs-table')!.innerHTML = '<p>Error loading seasons.</p>';
      return;
    }

    this._seasons = result.data ?? [];
    const yearSelect = this.querySelector<HTMLSelectElement>('#hs-year')!;

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
      this.querySelector('#hs-table')!.innerHTML = '<p>No seasons available.</p>';
    }
  }

  private async _loadYear(year: number): Promise<void> {
    this.querySelector('#hs-table')!.innerHTML = '<p>Loading&hellip;</p>';

    const [weeksResult, seasonResult, teamsResult] = await Promise.all([
      scoreService.getAllWeekResults(year),
      scoreService.getSeason(year),
      scoreService.getTeams(year),
    ]);

    if (!seasonResult.success || !seasonResult.data) {
      this.querySelector('#hs-table')!.innerHTML = `<p>Error loading standings for ${year}.</p>`;
      return;
    }

    this._season = seasonResult.data;
    this._allWeekResults = weeksResult.success ? (weeksResult.data ?? []) : [];
    this._teams = teamsResult.success ? (teamsResult.data ?? []) : [];

    const weekSelect = this.querySelector<HTMLSelectElement>('#hs-week')!;
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

    const defaultView =
      this._season!.status === 'complete' || currentWeek === 0
        ? 'season'
        : String(currentWeek);
    weekSelect.value = defaultView;
    this._renderTable(defaultView);
  }

  private _renderTable(weekKey: string): void {
    let rows: {
      place: number | string;
      teamName: string;
      targets: number | string;
      totalTargets: number | string;
      rankPoints: number | string;
      bonusPoints: number | string;
      total: number | string;
    }[];
    let subtitle: string;
    let accolades: Accolade[] = [];

    if (weekKey === 'season') {
      const standings = this._season?.standings ?? [];

      if (standings.length > 0) {
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
        rows = this._teams.map((t) => ({
          place: '—',
          teamName: t.name,
          targets: '—',
          totalTargets: '—',
          rankPoints: '—',
          bonusPoints: '—',
          total: '—',
        }));
        subtitle = 'Season has not yet begun — teams registered';
      }
    } else {
      const weekNum = parseInt(weekKey, 10);
      const weekResult = this._allWeekResults.find((w) => w.weekNumber === weekNum);
      if (!weekResult) {
        this.querySelector('#hs-table')!.innerHTML = `<p>No data for Week ${weekNum}.</p>`;
        return;
      }

      const cumulative: Record<string, { rankPoints: number; bonusPoints: number; targets: number }> = {};
      for (const wr of this._allWeekResults) {
        if (wr.weekNumber > weekNum) continue;
        for (const tr of wr.teamResults ?? []) {
          if (!cumulative[tr.teamId]) {
            cumulative[tr.teamId] = { rankPoints: 0, bonusPoints: 0, targets: 0 };
          }
          cumulative[tr.teamId]!.rankPoints += tr.rankPoints ?? 0;
          cumulative[tr.teamId]!.bonusPoints += tr.bonusPoints ?? 0;
          cumulative[tr.teamId]!.targets += tr.targets ?? 0;
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
          place: 0,
        };
      });

      rows.sort((a, b) => (b.total as number) - (a.total as number));
      rows = rows.map((r, i) => ({ ...r, place: i + 1 }));
      subtitle = `Week ${weekNum} results \u00b7 Total reflects season-to-date`;
      accolades = weekResult.accolades ?? [];
    }

    this.querySelector('#hs-table')!.innerHTML =
      this._renderAccolades(accolades) +
      this._buildTable(rows, subtitle);
  }

  private _renderAccolades(accolades: Accolade[]): string {
    if (accolades.length === 0) return '';

    const items = accolades.map((a) => {
      const badgeClass = a.streak === 50
        ? 'accolades-badge--50'
        : 'accolades-badge--25';
      const label = a.streak === 50 ? 'Straight 50' : 'Straight 25';
      return `
      <li class="accolades-item">
        <span class="accolades-badge ${badgeClass}">${label}</span>
        <span class="accolades-item__name">${a.shooterName}</span>
        <span class="accolades-item__team">${a.teamName}</span>
      </li>`;
    }).join('');

    return `
    <div class="accolades-section">
      <h3 class="accolades-section__heading">Accolades</h3>
      <ul class="accolades-list">${items}</ul>
    </div>`;
  }

  private _buildTable(
    rows: {
      place: number | string;
      teamName: string;
      targets: number | string;
      totalTargets: number | string;
      rankPoints: number | string;
      bonusPoints: number | string;
      total: number | string;
    }[],
    subtitle: string,
  ): string {
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
