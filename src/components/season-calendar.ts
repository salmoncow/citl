/**
 * season-calendar — Custom Element
 *
 * The current season's schedule as a 16-cell strip: practice day plus the 15
 * shoot weeks, each marked done / next up / upcoming / cancelled (spec 006).
 * No shadow DOM; uses global CSS classes.
 *
 * Business rules live in utils/schedule.ts (computeSchedule): practice on the
 * 2nd Tuesday of April, week 1 on the 3rd, 15 weeks, the July 4 week skipped
 * when July 4 is a weekday. Admin overrides may postpone (new date) or
 * cancel (null) a week.
 */

import { getServices } from '@/services/app-services';
import { applyWeekDateOverrides, computeSchedule, seasonTimeline } from '@/utils/schedule';
import type { TimelineEntry } from '@/utils/schedule';

const { scoreService } = getServices();

const SHORT_DATE: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', SHORT_DATE);
}

class SeasonCalendar extends HTMLElement {
  connectedCallback(): void {
    this.innerHTML = SeasonCalendar._skeleton();
    void this._load(new Date().getFullYear());
  }

  private async _load(year: number): Promise<void> {
    // Overrides are optional: degrade to the computed schedule on failure.
    let overrides: Partial<Record<string, string | null>> = {};
    const seasonResult = await scoreService.getSeason(year);
    if (seasonResult.success && seasonResult.data) {
      overrides = seasonResult.data.weekDateOverrides ?? {};
    }

    const base = computeSchedule(year);
    const timeline = seasonTimeline(applyWeekDateOverrides(base, overrides));
    const hasHoliday = base.some((e) => e.type === 'holiday');
    this.innerHTML = SeasonCalendar._render(year, timeline, hasHoliday);
  }

  private static _render(year: number, timeline: TimelineEntry[], hasHoliday: boolean): string {
    const practice = timeline.find((e) => e.type === 'practice');
    const shoots = timeline.filter((e) => e.week !== undefined);
    const first = shoots[0];
    const last = shoots[shoots.length - 1];

    const meta = [
      practice ? `Practice ${fmtDate(practice.date)}` : '',
      first ? `Kickoff ${fmtDate(first.date)}` : '',
      last ? `Finale ${fmtDate(last.date)}` : '',
    ].filter(Boolean).join(' · ');

    const cells = timeline.map((e) => SeasonCalendar._cell(e, e === last)).join('');

    const note = hasHoliday
      ? '<p class="season-strip__note">No shoot the week of July 4 — the season runs one week later.</p>'
      : '';

    return `
      <section class="section season-calendar" aria-labelledby="season-calendar-title">
        <div class="section-head">
          <div>
            <span class="eyebrow">Schedule</span>
            <h2 id="season-calendar-title">${year} Season calendar</h2>
          </div>
          <p class="section-head__meta">${meta}</p>
        </div>
        <ol class="season-strip">${cells}</ol>
        ${note}
      </section>`;
  }

  private static _cell(e: TimelineEntry, isFinale: boolean): string {
    const label = e.type === 'practice' ? 'Practice' : `Wk ${e.week ?? ''}`;
    let status = '';
    if (e.status === 'next') status = 'Next up';
    else if (e.status === 'cancelled') status = 'Cancelled';
    else if (e.status === 'done') status = 'Done';
    else if (isFinale) status = 'Finale';
    const current = e.status === 'next' ? ' aria-current="date"' : '';
    return `
      <li class="season-strip__cell season-strip__cell--${e.status}"${current}>
        <span class="season-strip__label">${label}</span>
        <span class="season-strip__date">${fmtDate(e.date)}</span>
        <span class="season-strip__status">${status}</span>
      </li>`;
  }

  private static _skeleton(): string {
    const cell = '<span class="skeleton" style="flex:1;height:104px;border-radius:var(--radius-lg)"></span>';
    return `
      <div class="section skeleton-group">
        <span class="skeleton skeleton--lg" style="width:280px"></span>
        <div class="skeleton-row">${cell.repeat(8)}</div>
      </div>`;
  }
}

customElements.define('season-calendar', SeasonCalendar);
