/**
 * season-calendar — Custom Element
 *
 * Displays the current season's shoot schedule as a multi-month calendar grid.
 * No shadow DOM; uses global CSS classes. No Firestore calls — year derived from Date.
 *
 * Business rules:
 *  - Practice day:    2nd Tuesday of April
 *  - Week 1:         3rd Tuesday of April
 *  - Season length:  15 shoot weeks
 *  - July 4th skip:  if July 4 falls Mon–Fri, the Tuesday of that Sun–Sat week
 *                    is skipped; season extends by one week
 *  - July 4th mark:  July 4 itself shown red when it is a weekday
 *  - Months shown:   April → month containing the 15th shoot Tuesday
 */

interface ScheduleEvent {
  date: Date;
  type: 'practice' | 'shoot' | 'holiday';
  week?: number; // 1-based, only for shoot days
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

class SeasonCalendar extends HTMLElement {
  connectedCallback(): void {
    const year = new Date().getFullYear();
    const schedule = this._computeSchedule(year);
    this.innerHTML = this._renderCalendar(year, schedule);
  }

  // ─── Schedule computation ────────────────────────────────────────────────────

  /** Returns the date of the Nth Tuesday (1-based) of the given month (0-based). */
  private _nthTuesdayOfMonth(year: number, month: number, n: number): Date {
    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay(); // 0 = Sun, 2 = Tue
    const daysUntilTuesday = (2 - firstDayOfWeek + 7) % 7;
    const firstTuesdayDate = 1 + daysUntilTuesday;
    return new Date(year, month, firstTuesdayDate + (n - 1) * 7);
  }

  /** Returns all schedule events for the season year. */
  private _computeSchedule(year: number): ScheduleEvent[] {
    const practice = this._nthTuesdayOfMonth(year, 3, 2); // April = month 3
    const week1Start = this._nthTuesdayOfMonth(year, 3, 3);

    const july4 = new Date(year, 6, 4);
    const july4DayOfWeek = july4.getDay(); // 0 = Sun, 6 = Sat
    const july4IsWeekday = july4DayOfWeek >= 1 && july4DayOfWeek <= 5;

    // Tuesday of the Sun–Sat week that contains July 4
    let skippedTuesday: Date | null = null;
    if (july4IsWeekday) {
      // Days since Sunday of that week = july4DayOfWeek
      const sundayOffset = july4DayOfWeek; // days to subtract to reach Sunday
      const sundayDate = 4 - sundayOffset; // July date of that Sunday
      skippedTuesday = new Date(year, 6, sundayDate + 2); // +2 to reach Tuesday
    }

    const events: ScheduleEvent[] = [
      { date: practice, type: 'practice' },
    ];

    if (july4IsWeekday) {
      events.push({ date: july4, type: 'holiday' });
    }

    // Walk forward, collecting 15 shoot Tuesdays (skipping the July 4 week Tuesday)
    const current = new Date(week1Start);
    let shootWeek = 1;

    while (shootWeek <= 15) {
      const isSkipped =
        skippedTuesday !== null &&
        current.getFullYear() === skippedTuesday.getFullYear() &&
        current.getMonth() === skippedTuesday.getMonth() &&
        current.getDate() === skippedTuesday.getDate();

      if (!isSkipped) {
        events.push({ date: new Date(current), type: 'shoot', week: shootWeek });
        shootWeek++;
      }

      current.setDate(current.getDate() + 7);
    }

    return events;
  }

  // ─── Rendering ───────────────────────────────────────────────────────────────

  private _renderCalendar(year: number, schedule: ScheduleEvent[]): string {
    // Month range: April (3) → month of last shoot event
    const shootEvents = schedule.filter((e) => e.type === 'shoot');
    const lastShoot = shootEvents[shootEvents.length - 1];
    const lastMonth = lastShoot?.date.getMonth() ?? 6; // fallback July

    let monthsHtml = '';
    for (let m = 3; m <= lastMonth; m++) {
      monthsHtml += this._renderMonth(year, m, schedule);
    }

    const legendHtml = this._renderLegend();

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
    const scheduleMap = new Map<string, string>();
    for (const event of schedule) {
      const key = `${event.date.getFullYear()}-${event.date.getMonth()}-${event.date.getDate()}`;
      // Holiday takes priority over any shoot that might share the same date
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

  private _renderLegend(): string {
    const items: Array<{ label: string; style: string }> = [
      { label: 'Shoot Day', style: 'background: var(--c-table-header-bg)' },
      { label: 'Practice Day', style: 'background: var(--c-accent)' },
      { label: 'Holiday', style: 'background: #dc2626' },
    ];

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
