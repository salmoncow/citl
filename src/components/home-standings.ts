/**
 * home-standings — Custom Element
 *
 * Season / week standings table driven from Firestore (spec 006 layout):
 * position badge, movement vs the previous week, gap to the leader and the
 * last six weeks of rank points as bars. Season awards and weekly accolades
 * render above the table. No shadow DOM; uses global CSS classes.
 */

import { getServices } from '@/services/app-services';
import { compareStandings } from '@/services/scoring-engine';
import { computeRankMovement, computeStandingsFromWeeks, rankPointsByWeek } from '@/services/standings';
import { escapeHtml } from '@/modules/ui';
import { renderAccolades, renderSeasonAwards } from '@/components/home-standings-parts';
import type { Team, WeekResult } from '@/types/score';
import type { Season } from '@/types/season';
import type { Accolade } from '@/types/shooter';

const { scoreService } = getServices();

const FORM_WEEKS = 6;

interface Row {
  place: number | null;
  teamId: string;
  teamName: string;
  captain: string;
  weekTargets: number | null;
  totalTargets: number | null;
  rankPoints: number | null;
  bonusPoints: number | null;
  total: number | null;
}

class HomeStandings extends HTMLElement {
  private _selectedYear: number | null = null;
  private _season: Season | null = null;
  private _allWeekResults: WeekResult[] = [];
  private _teams: Team[] = [];
  /** Re-entrancy guard: only the latest _loadYear call may render (F-23). */
  private _loadGen = 0;

  connectedCallback(): void {
    this.innerHTML = `
      <section class="section home-standings" id="standings" aria-labelledby="hs-title">
        <div class="section-head">
          <div>
            <span class="eyebrow">Standings</span>
            <h2 id="hs-title">Standings</h2>
          </div>
          <div class="section-head__controls">
            <label class="field-inline" for="hs-week">View</label>
            <select id="hs-week"><option value="season">Season</option></select>
            <label class="field-inline" for="hs-year">Season</label>
            <select id="hs-year"></select>
          </div>
        </div>
        <div id="hs-table">${HomeStandings._standingsSkeleton()}</div>
      </section>`;

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

  private _setBody(html: string): void {
    this.querySelector('#hs-table')!.innerHTML = html;
  }

  private _setTitle(text: string): void {
    this.querySelector('#hs-title')!.textContent = text;
  }

  private async _loadSeasons(): Promise<void> {
    const result = await scoreService.getAllSeasons();
    if (!result.success) {
      this._setBody('<p class="state-msg">Error loading seasons.</p>');
      return;
    }

    const seasons = result.data ?? [];
    const yearSelect = this.querySelector<HTMLSelectElement>('#hs-year')!;
    for (const season of seasons) {
      const opt = document.createElement('option');
      opt.value = String(season.year);
      opt.textContent = String(season.year);
      yearSelect.appendChild(opt);
    }

    const latest = seasons[0];
    if (!latest) {
      this._setBody('<p class="state-msg">No seasons available.</p>');
      return;
    }
    this._selectedYear = latest.year;
    yearSelect.value = String(latest.year);
    await this._loadYear(latest.year);
  }

  private async _loadYear(year: number): Promise<void> {
    const gen = ++this._loadGen;
    this._setBody(HomeStandings._standingsSkeleton());

    const [weeksResult, seasonResult, teamsResult] = await Promise.all([
      scoreService.getAllWeekResults(year),
      scoreService.getSeason(year),
      scoreService.getTeams(year),
    ]);
    if (gen !== this._loadGen) return; // superseded by a newer selection

    if (!seasonResult.success || !seasonResult.data) {
      this._setBody(`<p class="state-msg">Error loading standings for ${year}.</p>`);
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
      this._season.status === 'complete' || currentWeek === 0 ? 'season' : String(currentWeek);
    weekSelect.value = defaultView;
    this._renderTable(defaultView);
  }

  private _renderTable(weekKey: string): void {
    const season = this._season;
    if (!season) return;
    const captainOf = new Map(this._teams.map((t) => [t.id, t.captain]));
    const year = this._selectedYear ?? season.year;

    let rows: Row[];
    let throughWeek: number;
    let accolades: Accolade[] = [];
    let weekView = false;

    if (weekKey === 'season') {
      throughWeek = season.currentWeek ?? 0;
      const standings = season.standings ?? [];
      rows = standings.map((s) => ({
        place: s.rank,
        teamId: s.teamId,
        teamName: s.teamName,
        captain: captainOf.get(s.teamId) ?? '—',
        weekTargets: null,
        totalTargets: s.totalTargets,
        rankPoints: s.totalRankPoints,
        bonusPoints: s.totalBonusPoints,
        total: s.totalRankPoints + s.totalBonusPoints,
      }));
      if (rows.length === 0) {
        rows = this._teams.map((t) => ({
          place: null, teamId: t.id, teamName: t.name, captain: t.captain,
          weekTargets: null, totalTargets: null, rankPoints: null, bonusPoints: null, total: null,
        }));
        this._setTitle(`${year} teams`);
      } else if (season.status === 'complete') {
        this._setTitle(`${year} final standings`);
      } else {
        this._setTitle(throughWeek > 0 ? `After week ${throughWeek}` : `${year} standings`);
      }
    } else {
      weekView = true;
      throughWeek = parseInt(weekKey, 10);
      const weekResult = this._allWeekResults.find((w) => w.weekNumber === throughWeek);
      this._setTitle(`Week ${throughWeek} results`);
      if (!weekResult) {
        this._setBody(`<p class="state-msg">No data for Week ${throughWeek}.</p>`);
        return;
      }

      // Season-to-date totals come from the SAME canonical derivation that
      // produces season.standings (spec 005 DD-5) — the same function over
      // the same stored docs, so the two views can never disagree. Per-week
      // columns come straight off the week-N doc rows.
      const cumulative = new Map(
        computeStandingsFromWeeks(this._allWeekResults, throughWeek).map((r) => [r.teamId, r]),
      );
      rows = (weekResult.teamResults ?? []).map((tr) => {
        const cum = cumulative.get(tr.teamId);
        return {
          place: 0,
          teamId: tr.teamId,
          teamName: tr.teamName,
          captain: captainOf.get(tr.teamId) ?? '—',
          weekTargets: tr.targets,
          totalTargets: cum?.totalTargets ?? 0,
          rankPoints: tr.rankPoints,
          bonusPoints: tr.bonusPoints,
          total: cum ? cum.totalRankPoints + cum.totalBonusPoints : 0,
        };
      });
      rows.sort((a, b) =>
        compareStandings(
          { points: a.total ?? 0, targets: a.totalTargets ?? 0 },
          { points: b.total ?? 0, targets: b.totalTargets ?? 0 },
        ),
      );
      rows = rows.map((r, i) => ({ ...r, place: i + 1 }));
      accolades = weekResult.accolades ?? [];
    }

    // Season awards ride the already-loaded season doc — zero extra reads
    // (spec 004 AC-6), and only in the Season view.
    const awardsHtml = !weekView && season.awards ? renderSeasonAwards(season.awards) : '';

    this._setBody(
      awardsHtml +
      renderAccolades(accolades, throughWeek) +
      this._buildTable(rows, throughWeek, weekView),
    );
  }

  private _buildTable(rows: Row[], throughWeek: number, weekView: boolean): string {
    const movement = computeRankMovement(this._allWeekResults, throughWeek);
    const form = rankPointsByWeek(this._allWeekResults, throughWeek);
    const weekMax = new Map<number, number>();
    for (const wr of this._allWeekResults) {
      const pts = (wr.teamResults ?? []).map((t) => t.rankPoints ?? 0);
      if (pts.length) weekMax.set(wr.weekNumber, Math.max(...pts));
    }
    const leaderTotal = rows[0]?.total ?? null;
    const fmt = (v: number | null): string => (v === null ? '—' : v.toLocaleString('en-US'));

    const trs = rows.map((r, i) => {
      const place = r.place ?? '—';
      const posCls = r.place !== null && r.place <= 3 ? ` pos--${r.place}` : '';
      const gap = i === 0 || r.total === null || leaderTotal === null ? '—' : `−${leaderTotal - r.total}`;
      const leaderCls = r.place === 1 ? ' class="is-leader"' : '';
      return `
        <tr${leaderCls}>
          <td><span class="pos${posCls}">${place}</span></td>
          <td class="hs-move">${HomeStandings._movement(movement.get(r.teamId))}</td>
          <th scope="row" class="hs-team">
            <span class="hs-team__name">${escapeHtml(r.teamName)}</span>
            <span class="hs-team__captain">${escapeHtml(r.captain)}</span>
          </th>
          <td class="hs-col-captain">${escapeHtml(r.captain)}</td>
          ${weekView ? `<td class="num hs-col-opt">${fmt(r.weekTargets)}</td>` : ''}
          <td class="num hs-col-opt">${fmt(r.totalTargets)}</td>
          <td class="num hs-col-opt">${fmt(r.rankPoints)}</td>
          <td class="num hs-col-opt">${fmt(r.bonusPoints)}</td>
          <td class="num hs-points">${fmt(r.total)}</td>
          <td class="num hs-gap">${gap}</td>
          <td class="hs-form-cell">${HomeStandings._formBars(form.get(r.teamId) ?? [], throughWeek, weekMax)}</td>
        </tr>`;
    }).join('');

    const wk = weekView ? `Wk ${throughWeek} ` : '';
    return `
      <div class="card card--flush hs-card">
        <div class="table-scroll" tabindex="0" role="region" aria-label="Standings table">
          <table class="standing-table">
            <thead>
              <tr>
                <th scope="col">Pos</th>
                <th scope="col"><span class="visually-hidden">Movement</span><span aria-hidden="true">±</span></th>
                <th scope="col">Team</th>
                <th scope="col" class="hs-col-captain">Captain</th>
                ${weekView ? `<th scope="col" class="num hs-col-opt">Wk ${throughWeek} tgts</th>` : ''}
                <th scope="col" class="num hs-col-opt">Total tgts</th>
                <th scope="col" class="num hs-col-opt">${wk}Rank pts</th>
                <th scope="col" class="num hs-col-opt">${wk}Bonus</th>
                <th scope="col" class="num hs-points">Points</th>
                <th scope="col" class="num hs-gap">Gap</th>
                <th scope="col" class="hs-form-cell">Last ${FORM_WEEKS} weeks</th>
              </tr>
            </thead>
            <tbody>${trs}</tbody>
          </table>
        </div>
        <div class="hs-foot">
          <span>Ties on points are broken by total targets. Bars show weekly rank points; orange marks that week's top team.</span>
          <a href="#/scorecards">Full scorecards →</a>
        </div>
      </div>`;
  }

  private static _movement(delta: number | undefined): string {
    if (!delta) return '<span class="hs-move--flat" aria-label="No change">—</span>';
    const up = delta > 0;
    const n = Math.abs(delta);
    return `<span class="${up ? 'hs-move--up' : 'hs-move--down'}" aria-label="${up ? 'Up' : 'Down'} ${n}">${up ? '▲' : '▼'} ${n}</span>`;
  }

  private static _formBars(points: (number | null)[], throughWeek: number, weekMax: Map<number, number>): string {
    const start = Math.max(1, throughWeek - FORM_WEEKS + 1);
    const bars: string[] = [];
    for (let w = start; w <= throughWeek; w++) {
      const v = points[w - 1] ?? null;
      if (v === null) {
        bars.push(`<span class="hs-bar hs-bar--none" title="Week ${w}: no result"></span>`);
        continue;
      }
      const h = Math.max(4, Math.round((v / 30) * 28));
      const top = weekMax.get(w) === v ? ' hs-bar--top' : '';
      bars.push(`<span class="hs-bar${top}" style="height:${h}px" title="Week ${w}: ${v} pts"></span>`);
    }
    if (bars.length === 0) return '';
    return `<span class="hs-form" role="img" aria-label="Rank points, weeks ${start}–${throughWeek}: ${points.slice(start - 1, throughWeek).map((v) => v ?? 'none').join(', ')}">${bars.join('')}</span>`;
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
      </div>`;
    return `<div class="card skeleton-group">${dataRow.repeat(7)}</div>`;
  }
}

customElements.define('home-standings', HomeStandings);
