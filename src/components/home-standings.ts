/**
 * home-standings — Custom Element
 *
 * Displays a year/week dropdown and standings table driven from Firestore.
 * No shadow DOM; uses global CSS classes.
 */

import { getServices } from '@/services/app-services';
import { compareStandings } from '@/services/scoring-engine';
import { computeStandingsFromWeeks } from '@/services/standings';
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

      // Season-to-date totals come from the SAME canonical derivation that
      // produces season.standings (spec 005 DD-5) — the same function over
      // the same stored docs, so the two views can never disagree. Per-week
      // columns come straight off the week-N doc rows.
      const cumulative = new Map(
        computeStandingsFromWeeks(this._allWeekResults, weekNum).map((r) => [r.teamId, r]),
      );

      rows = (weekResult.teamResults ?? []).map((tr) => {
        const cum = cumulative.get(tr.teamId);
        return {
          teamName: tr.teamName,
          captain: teamCaptainMap[tr.teamId] ?? '—',
          targets: tr.targets,
          totalTargets: cum?.totalTargets ?? 0,
          rankPoints: tr.rankPoints,
          bonusPoints: tr.bonusPoints,
          total: cum ? cum.totalRankPoints + cum.totalBonusPoints : 0,
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
   * Season Awards table (spec 004 DD-2, table refinement 2026-07-12). Each
   * field is null-guarded independently (repository reads are unvalidated
   * casts); rows with a missing winner are omitted, and the whole section is
   * omitted when no row renders. Icons are plain emoji — no icon font or
   * custom assets (ADR-008).
   */
  private _renderAwards(awards: SeasonAwards): string {
    const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

    const rows: { icon: string; award: string; winner: string; result: string }[] = [];
    if (typeof awards.firstPlaceTeam === 'string') {
      rows.push({
        icon: '\u{1F3C6}', // 🏆
        award: 'First Place',
        winner: awards.firstPlaceTeam,
        result: num(awards.firstPlacePoints) ? `${awards.firstPlacePoints} pts` : '—',
      });
    }
    if (typeof awards.secondPlaceTeam === 'string') {
      rows.push({
        icon: '\u{1F948}', // 🥈
        award: 'Second Place',
        winner: awards.secondPlaceTeam,
        result: num(awards.secondPlacePoints) ? `${awards.secondPlacePoints} pts` : '—',
      });
    }
    if (typeof awards.highestAvgShooter === 'string') {
      rows.push({
        icon: '\u{1F3AF}', // 🎯
        award: 'Highest Average',
        winner: awards.highestAvgShooter,
        result: num(awards.highestAvg) ? `${awards.highestAvg.toFixed(2)} avg` : '—',
      });
    }
    if (typeof awards.rookieOfYear === 'string') {
      rows.push({
        icon: '\u{2B50}', // ⭐
        award: 'Rookie of the Year',
        winner: awards.rookieOfYear,
        result: num(awards.rookieAvg) ? `${awards.rookieAvg.toFixed(2)} avg` : '—',
      });
    }
    if (typeof awards.mostImproved === 'string') {
      rows.push({
        icon: '\u{1F4C8}', // 📈
        award: 'Most Improved',
        winner: awards.mostImproved,
        result: typeof awards.improvement === 'string' ? awards.improvement : '—',
      });
    }
    if (rows.length === 0) return '';

    const trs = rows.map((row) => `
        <tr>
          <td class="awards-table__award">
            <span class="awards-table__icon" aria-hidden="true">${row.icon}</span>${escapeHtml(row.award)}
          </td>
          <td class="awards-table__winner">${escapeHtml(row.winner)}</td>
          <td class="awards-table__result">${escapeHtml(row.result)}</td>
        </tr>`).join('');

    return `
    <div class="awards-section">
      <h3 class="awards-section__heading">Season Awards</h3>
      <table class="awards-table">
        <thead>
          <tr>
            <th>Award</th>
            <th>Winner</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>${trs}</tbody>
      </table>
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
