/**
 * rulesView — League rules
 *
 * Migrated from src/spa/rules.html (main content only).
 */

/**
 * Returns the HTML string for the rules view.
 * @returns {string}
 */
export function rulesView() {
  return `
    <h2>1. General</h2>
    <ol>
      <li>Rules will be agreed on at the beginning of each season by the league coordinator
      and team captains prior to being published</li>
      <li>The last team to shoot on a night should send the score sheets for that night to
      the league coordinator</li>
    </ol>

    <h2>2. Team Structure</h2>
    <ol>
      <li>A team consists of between five and fifteen shooters</li>
      <li>Anyone is considered an eligible shooter. If younger than 16 you must have a parent
      or guardian present</li>
      <li>A shooter may be added to a team at any time</li>
      <li>Teams may shoot with up to 2 dummies if necessary to field a squad</li>
      <ol type="a">
        <li>Dummy's going-in average equals the average of those shooting</li>
        <li>Dummy's score is average score of those shooting for that night, minus 5</li>
        <li>Captain pays for dummies and gets a practice chit in return</li>
      </ol>
    </ol>

    <h2>3. League Schedule</h2>
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

    <h2>4. Makeup Rounds</h2>
    <ol>
      <li>If not shooting at a regularly scheduled time, a team's captain should notify the
      league coordinator via email at least 24 hours in advance</li>
      <li>A team will not be allowed to fall behind more than two weeks without forfeiture of
      scores. If the missed week is not made up by the close of the second week after the missed
      week, the score for the missed week will remain zero indefinitely</li>
      <p>For example, if WEEK5 is not made up by the close of WEEK7, the score is forfeit. The
      close of a week is Friday at midnight of a given week. At the end of the season, this two
      week grace period will be reduced to one week</p>
      <li>Missed weeks will be made up in the order they were missed. If two rounds are shot in
      one week or one evening, the team's first round will be recorded as the missing week.</li>
    </ol>

    <h2 id="scoring-and-yardage">5. Scoring &amp; Yardage</h2>
    <ol>
      <li>Returning shooters start the league with last year's average. New shooters start with
      a 35. After shooting twice, the starting average is phased-out of the calculation of
      current average</li>
      <li>Shooters who have been a member of a team but have not shot for 2 years will be
      considered Rookies</li>
      <li>Each week the highest scoring team is awarded 30 points; next highest gets 28, and so
      on. Points will be split for ties</li>
      <li>Any team that scores higher than its going-in average receives 5 bonus points</li>
      <li>A team will receive 1 bonus point for each qualifying rookie shooting that week up to
      a maximum of 2 rookie bonus points</li>
      <ol type="a">
        <li>A rookie will qualify for the bonus point if their going-in average is less than 35
        for that week</li>
        <li>A rookie point will not be awarded after week 10</li>
      </ol>
      <li>Yardage Calculation</li>
      <ol>
        <li>TOTAL the 5 individuals who will be participating for the evening. Compare the total
        of these 5 shooters with the yardage table to determine your starting position for the
        evening.</li>
      </ol>
    </ol>

    <h2>6. Trophies</h2>
    <ol>
      <li>Trophies are awarded to 1st and 2nd place teams. Members of these teams may choose to
      fund the purchase of their trophies and must coordinate with the League Coordinator</li>
      <li>Special trophies funded by the participant include:</li>
      <ol type="a">
        <li><i>Top Gun</i> - Highest Average</li>
        <li><i>Rookie of the Year</i> - Highest Average for a Rookie shooter</li>
        <li><i>Most Improved</i> - Shooter with greatest improvement for the season</li>
      </ol>
      <li>To be eligible for individual and team awards a shooter must have participated at
      least 6 times during the season</li>
    </ol>
  `;
}
