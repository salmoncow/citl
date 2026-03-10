/**
 * scoresheet-generator — Custom Element
 *
 * Renders print-ready scoresheets for all teams, showing each shooter's
 * going-in average for the selected week. No shadow DOM; uses global CSS.
 */

import { db } from '@/firebase-config';
import { createRepositoryFactory } from '@/repositories/repository-factory';
import { ScoreService } from '@/services/score-service';
import { computeGoingInAverage, getLastWord, isDummyName, normalizeShooterName, sortShootersWithCaptainFirst } from '@/services/scoring-engine';
import { computeSchedule } from '@/utils/schedule';
import type { Season } from '@/types/season';
import type { Team, WeekResult } from '@/types/score';

const factory = createRepositoryFactory({ db });
const scoreService = new ScoreService(factory.getScoreRepository());

class ScoresheetGenerator extends HTMLElement {
  private _seasons: Season[] = [];
  private _year = 0;
  private _maxWeek = 1;
  private _selectedWeek = 1;
  private _teams: Team[] = [];
  private _weekResults: WeekResult[] = [];
  /** week number → Date (computed/postponed) or null (cancelled) */
  private _dateMap = new Map<number, Date | null>();

  connectedCallback(): void {
    this.innerHTML = `<p>Loading&hellip;</p>`;
    void this._load();
  }

  private async _load(): Promise<void> {
    const seasonsResult = await scoreService.getAllSeasons();
    if (!seasonsResult.success || !seasonsResult.data?.length) {
      this.innerHTML = `<p>No seasons available.</p>`;
      return;
    }

    this._seasons = seasonsResult.data;
    const season = this._seasons[0]!;
    this._year = season.year;
    this._maxWeek = Math.min(15, (season.currentWeek ?? 0) + 1);
    this._selectedWeek = this._maxWeek;
    this._dateMap = this._buildDateMap(this._year, season.weekDateOverrides ?? {});

    await this._fetchYearData();

    this.innerHTML = this._renderShell();
    this._renderCards();
    this._wireEvents();
  }

  private async _fetchYearData(): Promise<void> {
    const [teamsResult, weeksResult] = await Promise.all([
      scoreService.getTeams(this._year),
      scoreService.getAllWeekResults(this._year),
    ]);

    this._teams = teamsResult.success ? (teamsResult.data ?? []) : [];
    this._weekResults = weeksResult.success ? (weeksResult.data ?? []) : [];
  }

  private async _changeYear(year: number): Promise<void> {
    this._year = year;
    const season = this._seasons.find((s) => s.year === year);
    this._maxWeek = Math.min(15, (season?.currentWeek ?? 0) + 1);
    this._selectedWeek = this._maxWeek;
    this._dateMap = this._buildDateMap(year, season?.weekDateOverrides ?? {});

    const container = this.querySelector<HTMLElement>('#sg-cards');
    if (container) container.innerHTML = `<p>Loading&hellip;</p>`;

    await this._fetchYearData();

    const weekSelect = this.querySelector<HTMLSelectElement>('#sg-week');
    if (weekSelect) weekSelect.innerHTML = this._weekOptions();

    this._renderCards();
  }

  /** Build a map from week number → scheduled Date or null (cancelled). */
  private _buildDateMap(
    year: number,
    overrides: Partial<Record<string, string | null>>,
  ): Map<number, Date | null> {
    const events = computeSchedule(year).filter((e) => e.type === 'shoot');
    const map = new Map<number, Date | null>();
    for (const e of events) {
      const week = e.week!;
      const override = overrides[String(week)];
      if (override === null) {
        map.set(week, null); // cancelled
      } else if (override !== undefined) {
        map.set(week, new Date(override)); // postponed
      } else {
        map.set(week, e.date); // computed
      }
    }
    return map;
  }

  private _weekOptions(): string {
    return Array.from({ length: this._maxWeek }, (_, i) => {
      const w = i + 1;
      const selected = w === this._selectedWeek ? ' selected' : '';
      const date = this._dateMap.get(w);
      const cancelled = date === null ? ' (Cancelled)' : '';
      return `<option value="${w}"${selected}>Week ${w}${cancelled}</option>`;
    }).join('');
  }

  private _renderShell(): string {
    const yearOptions = this._seasons
      .map((s) => {
        const selected = s.year === this._year ? ' selected' : '';
        return `<option value="${s.year}"${selected}>${s.year}</option>`;
      })
      .join('');

    return `
      <div class="scoresheet-controls">
        <label for="sg-year">Season</label>
        <select id="sg-year">${yearOptions}</select>
        <label for="sg-week">Week</label>
        <select id="sg-week">${this._weekOptions()}</select>
        <button class="btn-primary scoresheet-print-btn">Print All Scoresheets</button>
      </div>
      <div id="sg-cards"></div>`;
  }

  private _renderCards(): void {
    const container = this.querySelector<HTMLElement>('#sg-cards');
    if (!container) return;
    container.innerHTML = this._teams.map((team) => this._renderCard(team)).join('');
  }

  /** Format a Date as "Tuesday, Month DD, YYYY". */
  private _formatShootDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  private _renderCard(team: Team): string {
    const rows = sortShootersWithCaptainFirst(
      team.shooters.filter((s) => !isDummyName(s.name)),
      team.captain,
    ).map((shooter) => {
        const scores = new Array<number | null>(15).fill(null);
        for (const wr of this._weekResults) {
          const wi = wr.weekNumber - 1;
          const teamResult = wr.teamResults?.find((tr) => tr.teamId === team.id);
          if (!teamResult) continue;
          const ss = teamResult.shooterScores?.find(
            (s) => normalizeShooterName(s.name) === normalizeShooterName(shooter.name),
          );
          if (ss) scores[wi] = ss.total;
        }

        const avg = computeGoingInAverage(shooter.startingAvg, scores, this._selectedWeek - 1);
        return `
          <tr>
            <td>${shooter.name}</td>
            <td>${avg.toFixed(1)}</td>
            <td class="fill"></td>
            <td class="fill"></td>
            <td class="fill"></td>
          </tr>`;
      })
      .join('');

    const blankRow = `
          <tr>
            <td class="fill">&nbsp;</td>
            <td class="fill">&nbsp;</td>
            <td class="fill">&nbsp;</td>
            <td class="fill">&nbsp;</td>
            <td class="fill">&nbsp;</td>
          </tr>`;

    const dummyNote = 'Starting Dummy Score = Avg. of shooters going-in for that day<br>Ending Dummy Score is automatically calculated via the tool';
    const prefix = getLastWord(team.name);
    const dummyRows = `
          <tr>
            <td>${prefix} DUMMY1</td>
            <td></td>
            <td colspan="3" rowspan="2" class="scoresheet-dummy-note">${dummyNote}</td>
          </tr>
          <tr>
            <td>${prefix} DUMMY2</td>
            <td></td>
          </tr>`;

    const weekDate = this._dateMap.get(this._selectedWeek);
    const dateLine = weekDate === null
      ? `<p class="scoresheet-date-label scoresheet-date-cancelled">CANCELLED</p>`
      : weekDate !== undefined
        ? `<p class="scoresheet-date-label">${this._formatShootDate(weekDate)}</p>`
        : '';

    return `
      <div class="scoresheet-card">

        <div class="scoresheet-print-header">
          <h1 class="scoresheet-league-title">Central Illinois Trap League</h1>
          <p class="scoresheet-week-label">Week ${this._selectedWeek} &middot; ${this._year} Season</p>
          ${dateLine}
        </div>

        <h3 class="scoresheet-team-name">${team.name}</h3>
        <table class="scoresheet-table">
          <thead>
            <tr>
              <th>Shooter</th>
              <th>Avg</th>
              <th>Trap 1</th>
              <th>Trap 2</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>${rows}${blankRow}${blankRow}${dummyRows}</tbody>
        </table>

        <div class="scoresheet-print-footer">
          <p>Central Illinois Trap League is an independently organized, non-discriminating shooting
          sport. We encourage families and friends to participate. We remind everyone to keep it legal
          by shooting with an adult if under age, or otherwise having a valid FOID card.</p>
        </div>

      </div>`;
  }

  private _wireEvents(): void {
    this.querySelector<HTMLSelectElement>('#sg-year')
      ?.addEventListener('change', (e) => {
        void this._changeYear(parseInt((e.target as HTMLSelectElement).value, 10));
      });

    this.querySelector<HTMLSelectElement>('#sg-week')
      ?.addEventListener('change', (e) => {
        this._selectedWeek = parseInt((e.target as HTMLSelectElement).value, 10);
        this._renderCards();
      });

    this.querySelector('.scoresheet-print-btn')
      ?.addEventListener('click', () => {
        document.body.classList.remove('print-yardage');
        document.body.classList.add('print-scoresheets');
        window.print();
        window.addEventListener('afterprint', () => {
          document.body.classList.remove('print-scoresheets');
        }, { once: true });
      });
  }
}

customElements.define('scoresheet-generator', ScoresheetGenerator);
