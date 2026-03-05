/**
 * season-calendar — Custom Element
 *
 * Displays the current season's shoot schedule as a multi-month calendar grid.
 * No shadow DOM; uses global CSS classes.
 *
 * Business rules:
 *  - Practice day:    2nd Tuesday of April
 *  - Week 1:         3rd Tuesday of April
 *  - Season length:  15 shoot weeks
 *  - July 4th skip:  if July 4 falls Mon–Fri, the Tuesday of that Sun–Sat week
 *                    is skipped; season extends by one week
 *  - July 4th mark:  July 4 itself shown red when it is a weekday
 *  - Months shown:   April → month containing the 15th shoot Tuesday
 *  - Overrides:      admin may postpone (new date) or cancel (null) a week
 */

import { db } from '@/firebase-config';
import { createRepositoryFactory } from '@/repositories/repository-factory';
import { ScoreService } from '@/services/score-service';
import { computeSchedule } from '@/utils/schedule';
import type { ScheduleEvent } from '@/utils/schedule';

const factory = createRepositoryFactory({ db });
const scoreService = new ScoreService(factory.getScoreRepository());

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

class SeasonCalendar extends HTMLElement {
  async connectedCallback(): Promise<void> {
    this.innerHTML = `<p>Loading&hellip;</p>`;

    const year = new Date().getFullYear();

    // Fetch override data; gracefully degrade on failure
    let overrides: Partial<Record<string, string | null>> = {};
    const seasonResult = await scoreService.getSeason(year);
    if (seasonResult.success && seasonResult.data) {
      overrides = seasonResult.data.weekDateOverrides ?? {};
    }

    const baseSchedule = computeSchedule(year);
    const schedule = this._applyOverrides(baseSchedule, overrides);
    this.innerHTML = this._renderCalendar(year, schedule);
  }

  // ─── Override application ────────────────────────────────────────────────

  /**
   * Apply admin week-date overrides to the base schedule.
   * - string override: replace the shoot event's date; keep type 'shoot'
   * - null override:   change the shoot event's type to 'cancelled'
   */
  private _applyOverrides(
    events: ScheduleEvent[],
    overrides: Partial<Record<string, string | null>>,
  ): ScheduleEvent[] {
    return events.map((event) => {
      if (event.type !== 'shoot' || event.week === undefined) return event;
      const key = String(event.week);
      if (!(key in overrides)) return event;
      const override = overrides[key];
      if (override === null) {
        return { ...event, type: 'cancelled' as const };
      }
      return { ...event, date: new Date(override) };
    });
  }

  // ─── Rendering ───────────────────────────────────────────────────────────

  private _renderCalendar(year: number, schedule: ScheduleEvent[]): string {
    // Month range: April (3) → month of last non-cancelled shoot event
    const shootEvents = schedule.filter((e) => e.type === 'shoot' || e.type === 'cancelled');
    // For determining range use original (cancelled events keep their original date)
    const lastShoot = shootEvents[shootEvents.length - 1];
    const lastMonth = lastShoot?.date.getMonth() ?? 6; // fallback July

    let monthsHtml = '';
    for (let m = 3; m <= lastMonth; m++) {
      monthsHtml += this._renderMonth(year, m, schedule);
    }

    const hasCancelled = schedule.some((e) => e.type === 'cancelled');
    const legendHtml = this._renderLegend(hasCancelled);

    return `
      <section class="season-calendar">
        <h2>${year} Season Schedule</h2>
        <div class="calendar-months">
          ${monthsHtml}
        </div>
        ${legendHtml}
      </section>`;
  }

  private _renderMonth(year: number, month: number, schedule: ScheduleEvent[]): string {
    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

    // Build lookup: dateKey → CSS class
    // Priority: holiday > cancelled > shoot > practice
    const scheduleMap = new Map<string, string>();
    for (const event of schedule) {
      const key = `${event.date.getFullYear()}-${event.date.getMonth()}-${event.date.getDate()}`;
      if (!scheduleMap.has(key) || event.type === 'holiday') {
        scheduleMap.set(key, `calendar-cell--${event.type}`);
      }
    }

    const headersHtml = DAY_HEADERS.map((d) => `<div class="calendar-day-header">${d}</div>`).join('');

    const emptyCells = Array.from({ length: startDayOfWeek }, () =>
      '<div class="calendar-cell calendar-cell--empty"></div>',
    ).join('');

    let dayCells = '';
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${month}-${d}`;
      const schedClass = scheduleMap.get(key) ?? '';
      const todayClass = key === todayKey ? 'calendar-cell--today' : '';
      const classes = ['calendar-cell', schedClass, todayClass].filter(Boolean).join(' ');
      dayCells += `<div class="${classes}">${d}</div>`;
    }

    return `
      <div class="calendar-month">
        <div class="calendar-month-title">${MONTH_NAMES[month] ?? ''} ${year}</div>
        <div class="calendar-grid">
          ${headersHtml}
          ${emptyCells}
          ${dayCells}
        </div>
      </div>`;
  }

  private _renderLegend(hasCancelled: boolean): string {
    const items: Array<{ label: string; style: string }> = [
      { label: 'Shoot Day', style: 'background: var(--c-table-header-bg)' },
      { label: 'Practice Day', style: 'background: var(--c-accent)' },
      { label: 'Holiday', style: 'background: #dc2626' },
    ];

    if (hasCancelled) {
      items.push({ label: 'Cancelled', style: 'background: var(--c-text-muted); opacity: 0.5' });
    }

    const itemsHtml = items
      .map(
        ({ label, style }) => `
      <div class="calendar-legend-item">
        <div class="calendar-legend-swatch" style="${style}"></div>
        <span>${label}</span>
      </div>`,
      )
      .join('');

    return `<div class="calendar-legend">${itemsHtml}</div>`;
  }
}

customElements.define('season-calendar', SeasonCalendar);
