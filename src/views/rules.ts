/**
 * rulesView — League rules (spec 006 DD-11)
 *
 * The rule wording is unchanged (guarded by rules.test.ts); only the markup
 * around it is new: at-a-glance tiles, a section TOC, numbered section cards
 * (collapsible on phones via <rules-toc>), a makeup example strip, the
 * rank-points ladder and the yardage table — both generated from the same
 * code the scoring engine uses, not hard-coded.
 */

import { computeRankPoints } from '@/services/scoring-engine';
import { YARDAGE_TABLE } from '@/utils/yardage';

const SECTIONS: { id: string; n: number; title: string }[] = [
  { id: 'rule-general', n: 1, title: 'General' },
  { id: 'rule-teams', n: 2, title: 'Team Structure' },
  { id: 'rule-schedule', n: 3, title: 'League Schedule' },
  { id: 'rule-makeups', n: 4, title: 'Makeup Rounds' },
  { id: 'scoring-and-yardage', n: 5, title: 'Scoring &amp; Yardage' },
  { id: 'rule-trophies', n: 6, title: 'Trophies' },
];

const GLANCE: { value: string; label: string; rule: string }[] = [
  { value: '5–15', label: 'shooters per team', rule: '2.1' },
  { value: '30', label: 'points to the week’s top team, then 28, 26…', rule: '5.3' },
  { value: '+5', label: 'bonus for beating the team’s going-in average', rule: '5.5' },
  { value: '2 wks', label: 'to make up a missed week (1 at season end)', rule: '4.2' },
  { value: '35', label: 'starting average for new shooters', rule: '5.1' },
  { value: '6', label: 'nights shot to qualify for awards', rule: '6.3' },
];

function sectionOpen(id: string): string {
  const s = SECTIONS.find((x) => x.id === id)!;
  return `
    <details class="rule-card" id="${s.id}" open>
      <summary class="rule-card__summary">
        <h2 class="rule-card__title"><span class="rule-card__num">${s.n}</span>${s.title}</h2>
        <svg class="rule-card__chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </summary>
      <div class="rule-card__body">`;
}

const SECTION_CLOSE = '</div></details>';

function ladder(): string {
  // 8 distinct team totals → the engine's own weekly rank points.
  const points = computeRankPoints([250, 240, 230, 220, 210, 200, 190, 180]);
  const places = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
  const bars = points.map((p, i) => {
    const v = p ?? 0;
    return `
      <li class="ladder__step${i === 0 ? ' ladder__step--top' : ''}">
        <span class="ladder__pts num">${v}</span>
        <span class="ladder__bar" style="height:${Math.round((v / 30) * 120)}px"></span>
        <span class="ladder__place">${places[i] ?? ''}</span>
      </li>`;
  }).join('');
  return `
    <figure class="rules-figure">
      <figcaption class="rules-figure__cap">Weekly rank points · 8-team week</figcaption>
      <ol class="ladder">${bars}</ol>
    </figure>`;
}

function yardageTable(): string {
  const rows = YARDAGE_TABLE.map((r) => `
    <tr><td class="num">${r.min.toFixed(2)} – ${r.max.toFixed(2)}</td><td class="num">${r.yards} yd</td></tr>`).join('');
  return `
    <figure class="rules-figure">
      <figcaption class="rules-figure__cap">Yardage table · total of the 5 shooters' averages</figcaption>
      <div class="table-scroll" tabindex="0" role="region" aria-label="Yardage table">
        <table class="yardage-mini">
          <thead><tr><th scope="col">Total</th><th scope="col" class="num">Start at</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </figure>`;
}

export function rulesView(): string {
  const toc = SECTIONS.map((s) =>
    `<li><a class="rules-toc__link" href="#${s.id}" data-section="${s.id}"><span class="rules-toc__num">${s.n}</span>${s.title}</a></li>`).join('');

  const glance = GLANCE.map((g) => `
    <li class="glance">
      <span class="glance__value">${g.value}</span>
      <span class="glance__label">${g.label}</span>
      <span class="glance__rule">Rule ${g.rule}</span>
    </li>`).join('');

  return `
    <section class="page-hero bleed on-dark" aria-labelledby="rules-title">
      <div class="page-hero__inner">
        <span class="eyebrow eyebrow--on-dark">Rulebook</span>
        <h1 id="rules-title">League rules</h1>
        <p class="page-hero__lede">Agreed at the beginning of each season by the League Coordinator and team captains. Situations the rules don't cover are decided by a majority of captains.</p>
      </div>
    </section>

    <rules-toc class="rules-layout">
      <nav class="rules-toc" aria-label="Rule sections">
        <span class="rules-toc__head">On this page</span>
        <ol class="rules-toc__list">${toc}</ol>
        <button type="button" class="btn-secondary rules-toc__print" data-print>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M6 14h12v7H6z"/></svg>
          Print rules
        </button>
      </nav>

      <div class="rules-main">
        <ul class="glance-grid" aria-label="Rules at a glance">${glance}</ul>

        ${sectionOpen('rule-general')}
          <ol>
            <li>Rules will be agreed on at the beginning of each season by the league coordinator
            and team captains prior to being published</li>
            <li>The last team to shoot on a night should send the score sheets for that night to
            the league coordinator</li>
          </ol>
        ${SECTION_CLOSE}

        ${sectionOpen('rule-teams')}
          <ol>
            <li>A team consists of between five and fifteen shooters</li>
            <li>Anyone is considered an eligible shooter. If younger than 16 you must have a parent
            or guardian present</li>
            <li>A shooter may be added to a team at any time</li>
            <li>Teams may shoot with up to 2 dummies if necessary to field a squad
              <ol type="a" class="rule-facts">
                <li><span class="rule-facts__k">Going-in average</span>Dummy's going-in average equals the average of those shooting</li>
                <li><span class="rule-facts__k">Score</span>Dummy's score is average score of those shooting for that night, minus 5</li>
                <li><span class="rule-facts__k">Who pays</span>Captain pays for dummies and gets a practice chit in return</li>
              </ol>
            </li>
          </ol>
        ${SECTION_CLOSE}

        ${sectionOpen('rule-schedule')}
          <ol>
            <li>The regular time &amp; venue for the league are Tuesday evenings at Darnall's Gun
            Works &amp; Ranges</li>
            <li>In years when the 4th of July falls on a weekday (Monday-Friday) the league will
            not shoot that week</li>
            <li>In order to accommodate as many teams as possible, a team may choose to shoot
            another night and/or time. If a team chooses not to shoot at the regular time they must
            notify the league coordinator before the league begins and must shoot that night and/or
            time for the entire league</li>
            <li>We shoot in wind and rain, but not lightning</li>
            <li>If a team shoots, then the weather turns so bad the other teams cannot shoot, the
            team that shot will have a choice - they may reshoot (at their expense) or skip shooting
            the following week</li>
            <li>Any given night's shooting can be postponed by vote of a majority of team captains
            present at the time. The schedule is then extended by a week. The league coordinator and
            captains will coordinate to announce a cancellation</li>
            <li>If a team member begins the round but is unable to complete the round at that time,
            the team member must finish the round before their team shoots the following week. If they
            are unable to finish the round due to illness or some other reason, contact the league
            coordinator</li>
            <li>Squad sequence numbers or signup times will be used for orchestrating shooting times.
            When a team is all present and paid, they will get a signature on their score sheet</li>
            <li>Situations not covered by the above rules will be decided by a majority of the team
            captains</li>
          </ol>
        ${SECTION_CLOSE}

        ${sectionOpen('rule-makeups')}
          <ol>
            <li>If not shooting at a regularly scheduled time, a team's captain should notify the
            league coordinator via email at least 24 hours in advance</li>
            <li>A team will not be allowed to fall behind more than two weeks without forfeiture of
            scores. If the missed week is not made up by the close of the second week after the missed
            week, the score for the missed week will remain zero indefinitely
              <p class="rule-example">For example, if WEEK5 is not made up by the close of WEEK7, the score is forfeit. The
              close of a week is Friday at midnight of a given week. At the end of the season, this two
              week grace period will be reduced to one week</p>
              <ol class="makeup-strip" aria-label="Example: Week 5 missed">
                <li><span class="makeup-strip__wk">Week 5</span><span>Round missed</span></li>
                <li><span class="makeup-strip__wk">Week 6</span><span>Make it up</span></li>
                <li><span class="makeup-strip__wk">Week 7</span><span>Last chance</span></li>
                <li class="makeup-strip__end"><span class="makeup-strip__wk">Friday, midnight</span><span>Week 7 closes · forfeit</span></li>
              </ol>
            </li>
            <li>Missed weeks will be made up in the order they were missed. If two rounds are shot in
            one week or one evening, the team's first round will be recorded as the missing week.</li>
          </ol>
        ${SECTION_CLOSE}

        ${sectionOpen('scoring-and-yardage')}
          <ol>
            <li>Returning shooters start the league with last year's average. New shooters start with
            a 35. After shooting twice, the starting average is phased-out of the calculation of
            current average</li>
            <li>Shooters who have been a member of a team but have not shot for 2 years will be
            considered Rookies</li>
            <li>Each week the highest scoring team is awarded 30 points; next highest gets 28, and so
            on. Points will be split for ties</li>
            <li>In the season standings, a tie on total points is broken in favor of the team that has
            broken more total targets</li>
            <li>Any team that scores higher than its going-in average receives 5 bonus points</li>
            <li>A team will receive 1 bonus point for each qualifying rookie shooting that week up to
            a maximum of 2 rookie bonus points
              <ol type="a">
                <li>A rookie will qualify for the bonus point if their going-in average is less than 35
                for that week</li>
                <li>A rookie point will not be awarded after week 10</li>
              </ol>
            </li>
            <li>Yardage Calculation
              <ol>
                <li>TOTAL the 5 individuals who will be participating for the evening. Compare the total
                of these 5 shooters with the yardage table to determine your starting position for the
                evening.</li>
              </ol>
            </li>
          </ol>
          <div class="rules-figures">
            ${ladder()}
            ${yardageTable()}
          </div>
        ${SECTION_CLOSE}

        ${sectionOpen('rule-trophies')}
          <ol>
            <li>Trophies are awarded to 1st and 2nd place teams. Members of these teams may choose to
            fund the purchase of their trophies and must coordinate with the League Coordinator</li>
            <li>Special trophies funded by the participant include:
              <ol type="a" class="trophy-list">
                <li><i>Top Gun</i> - Highest Average</li>
                <li><i>Rookie of the Year</i> - Highest Average for a Rookie shooter</li>
                <li><i>Most Improved</i> - Shooter with greatest improvement for the season</li>
              </ol>
            </li>
            <li>To be eligible for individual and team awards a shooter must have participated at
            least 6 times during the season</li>
          </ol>
        ${SECTION_CLOSE}
      </div>
    </rules-toc>`;
}
