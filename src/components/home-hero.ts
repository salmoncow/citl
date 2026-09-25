/**
 * home-hero — Custom Element
 *
 * Full-bleed home hero (spec 006): headline, join / results calls to action,
 * and a "next shoot" card driven by the computed season schedule plus admin
 * date overrides. Off-season it points at next year's practice day.
 * No shadow DOM; uses global CSS classes.
 */

import { getServices } from '@/services/app-services';
import { applyWeekDateOverrides, computeSchedule, seasonTimeline } from '@/utils/schedule';
import type { TimelineEntry } from '@/utils/schedule';
import { escapeHtml } from '@/modules/ui';

const { scoreService } = getServices();

const WEEKS_PER_SEASON = 15;

class HomeHero extends HTMLElement {
  connectedCallback(): void {
    this.innerHTML = HomeHero._shell(HomeHero._cardSkeleton());
    void this._load(new Date().getFullYear());
  }

  private async _load(year: number): Promise<void> {
    const seasonResult = await scoreService.getSeason(year);
    const season = seasonResult.success ? seasonResult.data : null;
    const overrides = season?.weekDateOverrides ?? {};

    const timeline = seasonTimeline(applyWeekDateOverrides(computeSchedule(year), overrides));
    const next = timeline.find((e) => e.status === 'next');
    const card = this.querySelector('.next-card');
    if (!card) return;
    const champion = season?.status === 'complete' ? season.awards?.firstPlaceTeam ?? null : null;
    card.outerHTML = next
      ? HomeHero._nextCard(next, timeline)
      : HomeHero._offSeasonCard(year, champion);
  }

  private static _shell(card: string): string {
    return `
      <section class="hero bleed" aria-labelledby="hero-title">
        <svg class="hero__rings" viewBox="0 0 760 760" aria-hidden="true" focusable="false">
          <circle cx="380" cy="380" r="370"/><circle cx="380" cy="380" r="290"/>
          <circle cx="380" cy="380" r="210"/><circle cx="380" cy="380" r="130"/>
        </svg>
        <div class="hero__inner">
          <div class="hero__copy">
            <span class="eyebrow eyebrow--on-dark">Tuesday nights · Darnall's Gun Works · Bloomington, IL</span>
            <h1 id="hero-title" class="hero__title">Central Illinois Trap League</h1>
            <p class="hero__lede">A free, family-friendly trap league for Central Illinois. Five shooters a squad, two bunkers a night, standings updated every week.</p>
            <div class="hero__actions">
              <a class="btn-accent btn-lg" href="#/about">Join the league
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </a>
              <a class="btn-outline-dark btn-lg" href="#standings">See the standings</a>
            </div>
          </div>
          ${card}
        </div>
      </section>`;
  }

  private static _dateBlock(d: Date): string {
    const mon = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
    return `
      <div class="next-card__date" aria-hidden="true">
        <span class="next-card__mon">${mon}</span>
        <span class="next-card__day">${d.getDate()}</span>
        <span class="next-card__dow">${weekday}</span>
      </div>`;
  }

  private static _progress(done: number): string {
    const bars = Array.from({ length: WEEKS_PER_SEASON }, (_, i) => {
      let cls = '';
      if (i < done) cls = ' is-done';
      else if (i === done) cls = ' is-next';
      return `<span class="next-card__bar${cls}"></span>`;
    }).join('');
    return `
      <div class="next-card__progress">
        <div class="next-card__progress-label"><span>Season progress</span><span class="num">${done} / ${WEEKS_PER_SEASON}</span></div>
        <div class="next-card__bars" role="img" aria-label="${done} of ${WEEKS_PER_SEASON} weeks shot">${bars}</div>
      </div>`;
  }

  private static _nextCard(next: TimelineEntry, timeline: TimelineEntry[]): string {
    const done = timeline.filter((e) => e.week !== undefined && e.status === 'done').length;
    const pill = next.type === 'practice' ? 'Practice day' : `Week ${next.week ?? ''} of ${WEEKS_PER_SEASON}`;
    const longDate = next.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    return `
      <aside class="next-card" aria-label="Next shoot: ${longDate}">
        <div class="next-card__head">
          <span class="next-card__kicker">Next shoot</span>
          <span class="next-card__pill">${pill}</span>
        </div>
        <div class="next-card__main">
          ${HomeHero._dateBlock(next.date)}
          <div class="next-card__where">
            <span class="next-card__venue">Darnall's Gun Works &amp; Ranges</span>
            <span class="next-card__detail">Squads by signup order · range fee paid at Darnall's</span>
          </div>
        </div>
        ${HomeHero._progress(done)}
        <p class="next-card__note">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          <span>${HomeHero._makeupNote(next)}</span>
        </p>
      </aside>`;
  }

  /**
   * Rule 4.2: a missed week must be made up by the close (Friday midnight) of
   * the second week after it. When week N is next, week N−2's window closes
   * the Friday of week N's shoot. Weeks 1–2 have nothing closing, and the final
   * week uses the shorter end-of-season grace, so those get the general note.
   */
  private static _makeupNote(next: TimelineEntry): string {
    const week = next.week;
    if (week === undefined || week < 3 || week >= WEEKS_PER_SEASON) {
      return 'We shoot in wind and rain — never lightning. Missed a week? <a href="#/rules">Makeup rules</a>';
    }
    // "Close of a week is Friday at midnight" — the Friday of the shoot's week,
    // so a postponed (non-Tuesday) shoot still gets the right deadline.
    const friday = new Date(next.date);
    friday.setDate(friday.getDate() + ((5 - friday.getDay() + 7) % 7));
    const date = friday.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return `<strong>Makeup deadline:</strong> Week ${week - 2} rounds must be shot by ${date} at midnight. <a href="#/rules">Rules</a>`;
  }

  private static _offSeasonCard(year: number, champion: string | null): string {
    const nextYear = year + 1;
    const practice = computeSchedule(nextYear).find((e) => e.type === 'practice');
    const date = practice ? HomeHero._dateBlock(practice.date) : '';
    const headline = champion
      ? `${escapeHtml(champion)} are ${year} champions`
      : `${year} season complete`;
    return `
      <aside class="next-card" aria-label="Season complete">
        <div class="next-card__head">
          <span class="next-card__kicker">Season complete</span>
          <span class="next-card__pill">Next: ${nextYear} practice</span>
        </div>
        <div class="next-card__main">
          ${date}
          <div class="next-card__where">
            <span class="next-card__venue">${headline}</span>
            <span class="next-card__detail">The ${nextYear} season opens with practice day. Watch League news for enrollment.</span>
          </div>
        </div>
        ${HomeHero._progress(WEEKS_PER_SEASON)}
      </aside>`;
  }

  private static _cardSkeleton(): string {
    return `
      <aside class="next-card" aria-busy="true">
        <div class="skeleton-group">
          <span class="skeleton skeleton--sm" style="width:40%"></span>
          <span class="skeleton" style="height:96px"></span>
          <span class="skeleton skeleton--md" style="width:100%"></span>
          <span class="skeleton skeleton--lg" style="width:100%"></span>
        </div>
      </aside>`;
  }
}

customElements.define('home-hero', HomeHero);
