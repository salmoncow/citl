/**
 * home-stats — Custom Element
 *
 * Four "season at a glance" tiles under the home hero (spec 006): leader (or
 * champion), Top Gun race, league average with a weekly sparkline, and the
 * straight-25 count. Everything derives from the latest season's doc and its
 * published week docs — the same cached reads home-standings makes, so no
 * extra Firestore traffic. Renders nothing when the season has no results.
 */

import { getServices } from '@/services/app-services';
import { computeStandingsFromWeeks } from '@/services/standings';
import {
  computeCurrentAverages,
  computeLeagueAverageByWeek,
  countStraights,
} from '@/services/season-highlights';
import { escapeHtml } from '@/modules/ui';
import { sparkline } from '@/utils/sparkline';
import type { WeekResult } from '@/types/score';
import type { Season } from '@/types/season';

const { scoreService } = getServices();

class HomeStats extends HTMLElement {
  connectedCallback(): void {
    this.innerHTML = HomeStats._skeleton();
    void this._load();
  }

  private async _load(): Promise<void> {
    const seasons = await scoreService.getAllSeasons();
    const season = seasons.success ? seasons.data[0] : undefined;
    if (!season) {
      this.innerHTML = '';
      return;
    }
    const weeksResult = await scoreService.getAllWeekResults(season.year);
    const weeks = weeksResult.success ? weeksResult.data : [];
    if (weeks.length === 0) {
      this.innerHTML = '';
      return;
    }
    this.innerHTML = `
      <section class="home-stats" aria-label="${season.year} season at a glance">
        <div class="stat-grid">
          ${HomeStats._leaderTile(season, weeks)}
          ${HomeStats._topGunTile(weeks)}
          ${HomeStats._averageTile(weeks)}
          ${HomeStats._straightsTile(weeks)}
        </div>
      </section>`;
  }

  private static _tile(label: string, value: string, sub: string, extra = ''): string {
    return `
      <div class="stat">
        <span class="stat__label">${label}</span>
        ${extra || `<span class="stat__value">${value}</span>`}
        <span class="stat__sub">${sub}</span>
      </div>`;
  }

  private static _leaderTile(season: Season, weeks: WeekResult[]): string {
    const standings = season.standings?.length ? season.standings : computeStandingsFromWeeks(weeks);
    const first = standings[0];
    if (!first) return '';
    const second = standings[1];
    const pts = (r: typeof first): number => r.totalRankPoints + r.totalBonusPoints;
    const gap = second ? ` · +${pts(first) - pts(second)} over ${escapeHtml(second.teamName)}` : '';
    const label = season.status === 'complete' ? `${season.year} champion` : 'Season leader';
    return HomeStats._tile(label, escapeHtml(first.teamName), `<strong>${pts(first)} pts</strong>${gap}`);
  }

  private static _topGunTile(weeks: WeekResult[]): string {
    const top = computeCurrentAverages(weeks)[0];
    if (!top) return '';
    return HomeStats._tile(
      'Top average',
      escapeHtml(top.name),
      `<strong>${top.average.toFixed(1)} avg</strong> · ${escapeHtml(top.teamName)} · ${top.nights} nights`,
    );
  }

  private static _averageTile(weeks: WeekResult[]): string {
    const series = computeLeagueAverageByWeek(weeks);
    const latest = series[series.length - 1];
    const first = series[0];
    if (!latest || !first) return '';

    const values = series.map((s) => s.average);
    const geo = sparkline(values, 120, 44, 5);
    const chart = series.length > 1
      ? `<svg class="stat__spark" width="120" height="44" viewBox="0 0 120 44" role="img"
           aria-label="League average by week: ${values.map((v) => v.toFixed(1)).join(', ')}">
           <polyline points="${geo.points}"/>
           ${geo.last ? `<circle cx="${geo.last.x}" cy="${geo.last.y}" r="4.5"/>` : ''}
         </svg>`
      : '';
    const delta = latest.average - first.average;
    const trend = series.length > 1
      ? ` · <span class="stat__trend">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)} since Wk ${first.weekNumber}</span>`
      : '';
    const value = `
      <div class="stat__row">
        <span class="stat__value">${latest.average.toFixed(1)}<span class="stat__unit"> / 50</span></span>
        ${chart}
      </div>`;
    return HomeStats._tile('League average', '', `per shooter, Wk ${latest.weekNumber}${trend}`, value);
  }

  private static _straightsTile(weeks: WeekResult[]): string {
    const { straight25s, straight50s } = countStraights(weeks);
    const fifties = straight50s === 1 ? '1 straight 50' : `${straight50s} straight 50s`;
    return HomeStats._tile('Straight 25s', String(straight25s), `this season · ${fifties}`);
  }

  private static _skeleton(): string {
    const tile = `
      <div class="stat skeleton-group">
        <span class="skeleton skeleton--sm" style="width:50%"></span>
        <span class="skeleton skeleton--xl" style="width:70%"></span>
        <span class="skeleton skeleton--sm" style="width:80%"></span>
      </div>`;
    return `<section class="home-stats"><div class="stat-grid">${tile.repeat(4)}</div></section>`;
  }
}

customElements.define('home-stats', HomeStats);
