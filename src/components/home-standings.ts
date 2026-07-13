/**
 * home-standings — Custom Element
 *
 * Displays a year/week dropdown and standings table driven from Firestore.
 * No shadow DOM; uses global CSS classes.
 */

import { getServices } from '@/services/app-services';
import { compareStandings } from '@/services/scoring-engine';
import { escapeHtml } from '@/modules/ui';
import type { Team, WeekResult } from '@/types/score';
import type { Season, SeasonAwards } from '@/types/season';
import type { Accolade } from '@/types/shooter';

const { scoreService } = getServices();

class HomeStandings extends HTMLElement {
  private _seasons: Season[] = [];
  private _selectedYear: number | null = null;
  private _season: Season | null = null;
  private _allWeekResults: WeekResult[] = [];
  private _teams: Team[] = [];
  /** Re-entrancy guard: only the latest _loadYear call may render (F-23). */
  private _loadGen = 0;

  connectedCallback(): void {
    this.innerHTML = `
      <div class="home-standings">
        <div class="home-standings-controls">
          <label for="hs-year">Season</label>
          <select id="hs-year"></select>
          <label for="hs-week">Week</label>
          <select id="hs-week"><option value="season">Season</option></select>
        </div>
        <div id="hs-table">${HomeStandings._standingsSkeleton()}</div>
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
    const gen = ++this._loadGen;
    this.querySelector('#hs-table')!.innerHTML = HomeStandings._standingsSkeleton();

    const [weeksResult, seasonResult, teamsResult] = await Promise.all([
      scoreService.getAllWeekResults(year),
      scoreService.getSeason(year),
      scoreService.getTeams(year),
    ]);
    if (gen !== this._loadGen) return; // superseded by a newer selection

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
      captain: string;
      targets: number | string;
      totalTargets: number | string;
      rankPoints: number | string;
      bonusPoints: number | string;
      total: number | string;
    }[];
    let subtitle: string;
    let accolades: Accolade[] = [];

    const teamCaptainMap: Record<string, string> = Object.fromEntries(
      this._teams.map((t) => [t.id, t.captain])
    );

    if (weekKey === 'season') {
      const standings = this._season?.standings ?? [];

      if (standings.length > 0) {
        rows = standings.map((s) => ({
          place: s.rank,
          teamName: s.teamName,
          captain: teamCaptainMap[s.teamId] ?? '—',
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
          captain: t.captain,
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
          captain: teamCaptainMap[tr.teamId] ?? '—',
          targets: tr.targets,
          totalTargets: cum.targets,
          rankPoints: tr.rankPoints,
          bonusPoints: tr.bonusPoints,
          total: cum.rankPoints + cum.bonusPoints,
          place: 0,
        };
      });

      rows.sort((a, b) =>
        compareStandings(
          { points: a.total as number, targets: a.totalTargets as number },
          { points: b.total as number, targets: b.totalTargets as number },
        ),
      );
      rows = rows.map((r, i) => ({ ...r, place: i + 1 }));
      subtitle = `Week ${weekNum} results \u00b7 Total reflects season-to-date`;
      accolades = weekResult.accolades ?? [];
    }

    // Season awards ride the already-loaded season doc — zero extra reads
    // (spec 004 AC-6). Rendered only in the Season view and only when the
    // finalize flow (or the legacy migration) has written awards.
    const awardsHtml =
      weekKey === 'season' && this._season?.awards
        ? this._renderAwards(this._season.awards)
        : '';

    this.querySelector('#hs-table')!.innerHTML =
      awardsHtml +
      this._renderAccolades(accolades) +
      this._buildTable(rows, subtitle);
  }

  /**
   * Season Awards section (spec 004 DD-2). Each field is null-guarded
   * independently (repository reads are unvalidated casts); rows with a
   * missing winner are omitted, and the whole section is omitted when no
   * row renders.
   */
  private _renderAwards(awards: SeasonAwards): string {
    const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

    const items: { badge: string; name: string; detail: string }[] = [];
    if (typeof awards.firstPlaceTeam === 'string') {
      items.push({
        badge: 'First Place',
        name: awards.firstPlaceTeam,
        detail: num(awards.firstPlacePoints) ? `${awards.firstPlacePoints} pts` : '',
      });
    }
    if (typeof awards.secondPlaceTeam === 'string') {
      items.push({
        badge: 'Second Place',
        name: awards.secondPlaceTeam,
        detail: num(awards.secondPlacePoints) ? `${awards.secondPlacePoints} pts` : '',
      });
    }
    if (typeof awards.highestAvgShooter === 'string') {
      items.push({
        badge: 'Highest Average',
        name: awards.highestAvgShooter,
        detail: num(awards.highestAvg) ? `${awards.highestAvg.toFixed(2)} avg` : '',
      });
    }
    if (typeof awards.rookieOfYear === 'string') {
      items.push({
        badge: 'Rookie of the Year',
        name: awards.rookieOfYear,
        detail: num(awards.rookieAvg) ? `${awards.rookieAvg.toFixed(2)} avg` : '',
      });
    }
    if (typeof awards.mostImproved === 'string') {
      items.push({
        badge: 'Most Improved',
        name: awards.mostImproved,
        detail: typeof awards.improvement === 'string' ? awards.improvement : '',
      });
    }
    if (items.length === 0) return '';

    const lis = items.map((item) => `
      <li class="awards-item">
        <span class="awards-badge">${escapeHtml(item.badge)}</span>
        <span class="awards-item__name">${escapeHtml(item.name)}</span>
        <span class="awards-item__detail">${escapeHtml(item.detail)}</span>
      </li>`).join('');

    return `
    <div class="awards-section">
      <h3 class="awards-section__heading">Season Awards</h3>
      <ul class="awards-list">${lis}</ul>
    </div>`;
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
        <span class="accolades-item__name">${escapeHtml(a.shooterName)}</span>
        <span class="accolades-item__team">${escapeHtml(a.teamName)}</span>
      </li>`;
    }).join('');

    return `
    <div class="accolades-section">
      <h3 class="accolades-section__heading">Accolades</h3>
      <ul class="accolades-list">${items}</ul>
    </div>`;
  }

  private static _standingsSkeleton(): string {
    const dataRow = `
      <div class="skeleton-row">
        <span class="skeleton skeleton--lg" style="width:36px;flex-shrink:0"></span>
        <span class="skeleton skeleton--lg" style="flex:2"></span>
        <span class="skeleton skeleton--lg" style="flex:1"></span>
        <span class="skeleton skeleton--lg" style="flex:1"></span>
        <span class="skeleton skeleton--lg" style="flex:1"></span>
        <span class="skeleton skeleton--lg" style="flex:1"></span>
        <span class="skeleton skeleton--lg" style="flex:1"></span>
        <span class="skeleton skeleton--lg" style="flex:1"></span>
      </div>`;
    return `
      <div class="skeleton-group" style="padding-top:var(--space-2)">
        <span class="skeleton skeleton--sm" style="width:45%"></span>
        ${dataRow.repeat(7)}
      </div>`;
  }

  private _buildTable(
    rows: {
      place: number | string;
      teamName: string;
      captain: string;
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
          <td>${escapeHtml(r.teamName)}</td>
          <td>${escapeHtml(r.captain)}</td>
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
            <th>Captain</th>
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
