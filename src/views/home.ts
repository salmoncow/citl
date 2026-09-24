/**
 * homeView — landing page (spec 006): hero + next shoot, season stat tiles,
 * standings, news + newcomer guide, calendar strip, award races, venue.
 */

const FIRST_TUESDAY = `
  <aside class="first-night" aria-labelledby="first-night-title">
    <span class="eyebrow eyebrow--on-dark">New to trap?</span>
    <h2 id="first-night-title">Your first Tuesday</h2>
    <ol class="first-night__steps">
      <li><span><strong>Email the League Coordinator</strong> as an individual or a pre-formed team. Enrollment is free.</span></li>
      <li><span><strong>Bring your gear:</strong> a 12-gauge (or smaller), shells, eye and ear protection.</span></li>
      <li><span><strong>Pay the $12 range fee</strong> at Darnall's and shoot two bunkers — 50 targets.</span></li>
    </ol>
    <a class="btn-lg first-night__cta" href="#/about">How enrollment works</a>
    <p class="first-night__fine">Under 16? Shoot with a parent or guardian. Keep it legal with a valid FOID card.</p>
  </aside>`;

const VENUE = `
  <section class="section venue" aria-labelledby="venue-title">
    <div class="venue__copy">
      <span class="eyebrow">Where we shoot</span>
      <h2 id="venue-title">Darnall's Gun Works &amp; Ranges</h2>
      <p>Just west of Bloomington, IL. Tuesday evenings through the season, in wind and rain — never lightning.</p>
      <div class="venue__actions">
        <a class="btn-primary btn-lg" href="https://www.google.com/maps/search/?api=1&amp;query=Darnall%27s+Gun+Works+%26+Ranges" target="_blank" rel="noopener noreferrer">Get directions</a>
        <a class="btn-secondary btn-lg" href="#/about">About the league</a>
      </div>
    </div>
    <dl class="venue__facts">
      <div><dt>Night</dt><dd>Tuesday</dd></div>
      <div><dt>Range fee</dt><dd>$12</dd></div>
      <div><dt>Per shooter</dt><dd>50 targets</dd></div>
      <div><dt>Season</dt><dd>15 weeks</dd></div>
    </dl>
  </section>`;

export function homeView(): string {
  return `
    <home-hero></home-hero>
    <home-stats></home-stats>
    <home-standings></home-standings>
    <div class="section home-split">
      <home-announcements></home-announcements>
      ${FIRST_TUESDAY}
    </div>
    <season-calendar></season-calendar>
    <home-award-races></home-award-races>
    ${VENUE}`;
}
