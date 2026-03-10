/**
 * aboutView — About the league
 */

export function aboutView(): string {
  return `
    <h2>Trap Shooting</h2>

    <p>
      <a href="https://en.wikipedia.org/wiki/Trap_shooting" target="_blank">Trap Shooting</a>
      is a competitive clay pigeon shooting sport where individuals participate in shooting clay
      targets launched from a stationary bunker. Teams consist of many shooters, but only five
      shooters from a team will participate during any one event.
    </p>

    <p>
      Trap shooting is typically shot with a 12-gauge shotgun, although lower gauges can be used
      if needed (no handicap will be given). CITL shoots two bunkers, or 50 total shots, for each
      team on shooting nights. Score is kept based on the number of clay targets broken.
    </p>

    <p>
      For more information and how-to videos, visit the
      <a href="https://shootata.com/GeneralInformation/TrapshootingOverview.aspx" target="_blank">
        Amateur Trapshooting Association (ATA) website.
      </a>
    </p>

    <h2>Enrollment &amp; Fees</h2>
    <p>
      Look for an announcement on the home page for when enrollments are open. Send an email to
      the League Coordinator as either an individual, or a pre-formed team. Even when enrollments
      are closed, teams can still add new shooters to their ranks as long as they do not exceed
      the 15 members per team limit.
    </p>

    <p>
      The cost for enrollment in the league is free. However, Darnall's does require a $12 per
      day fee for using their facilities. This price includes the cost of maintaining the bunker
      equipment, as well as the cost of clay pigeons. Shotgun ammunition, shotguns, protective
      eyewear and ear plugs are all items supplied by the shooters themselves.
    </p>

    <h2>Where &amp; When</h2>
    <p>
      The CITL season usually kicks off the 2nd Tuesday of April with a practice day. The
      following Tuesday is the official kickoff of the season. The season itself lasts for 15
      weeks (skipping over the week of 4th of July if it lands on a weekday), concluding
      sometime in late July, early August.
    </p>

    <p>The league shoots at Darnall's Gun Works &amp; Ranges just west of Bloomington, IL.</p>

    <div class="map-container">
      <iframe
        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3035.9655576267696!2d-89.15142168474101!3d40.45389927936085!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x880b126c9e636233%3A0x68ace82319b9a7a6!2sDarnall&#39;s+Gun+Works+%26+Ranges!5e0!3m2!1sen!2sus!4v1555177381099!5m2!1sen!2sus"
        width="80%"
        height="350"
        style="border:0"
        allowfullscreen
        title="Darnall's Gun Works &amp; Ranges map">
      </iframe>
    </div>
  `;
}
