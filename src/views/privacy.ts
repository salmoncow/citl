import { LEAGUE_EMAIL, leagueMailto } from '@/utils/contact';
import { LEGAL_ANCHORS, PRIVACY_UPDATED, TERMS_VERSION } from '@/utils/legal';
import { leagueRequestsEnabled } from '@/utils/features';

/**
 * privacyView — Terms of Use and Privacy Policy (spec 008 AC-10, AC-24).
 *
 * Pure HTML-string factory. Reachable at /#/privacy and /privacy (main.ts
 * maps the pathname), and allowed while the account gate is active.
 *
 * Final wording published 2026-10-06 (PRIVACY_UPDATED). It describes
 * practices already in effect, so TERMS_VERSION is unchanged. Bump it
 * only for a material change members must accept again.
 *
 * Spec 010 AC-22: the league lines appear only when league requests are
 * on, which is also when TERMS_VERSION moves to the league version.
 *
 * Spec 011 AC-21: the Email section. Informational, so TERMS_VERSION is
 * unchanged (Decision 4).
 */

function league(html: string): string {
  return leagueRequestsEnabled ? html : '';
}

export function privacyView(): string {
  return `
    <div class="page-head">
      <div>
        <span class="eyebrow">Accounts</span>
        <h1>Terms of Use and Privacy Policy</h1>
        <p class="page-head__lede">How member accounts on citl.club work and what we do with your information.</p>
      </div>
    </div>

    <div class="prose">
      <p><em>Last updated ${PRIVACY_UPDATED} (version ${TERMS_VERSION}). These terms and this policy are set by the
      Central Illinois Trap League. If we make a material change, we'll post it here and ask you to accept it the
      next time you sign in.</em></p>

      <section id="${LEGAL_ANCHORS.terms}" tabindex="-1">
        <h2>Terms of Use</h2>
        <ul>
          <li>An account is optional. Standings, results, scorecards and rules are public and need no account.</li>
          <li>You must be 18 or older to hold an account. Parents or guardians manage participation for shooters under 18.</li>
          <li>Use your real name so the league coordinator can match you to a team.</li>
          ${league(`<li>Add only shooters under 18 you are the parent or guardian of, or have their guardian's permission to add.</li>
          <li>The league coordinator decides every team proposal, join request, scorecard-name link, and captain change.</li>`)}
          <li>Keep your sign-in methods secure. You are responsible for activity on your account.</li>
          <li>Published scores are the league's record. They are not changed by account changes, including deletion.</li>
          <li>The league may suspend or remove accounts that are misused.</li>
        </ul>
      </section>

      <section id="${LEGAL_ANCHORS.privacy}" tabindex="-1">
        <h2>Privacy Policy</h2>
        <h3>What we collect</h3>
        <ul>
          <li>From your sign-in provider (Google or an emailed link): your email address and account identifier. With
            Google, also the name and profile photo link on your Google account.</li>
          <li>From you: your name, and a phone number if you choose to give one.</li>
          <li>Records of when you created your account, last signed in, accepted these terms, confirmed you are 18 or
            older, and changed your account status.</li>
          <li>Your email topic choices.</li>
          ${league(`<li>Shooters under 18 you add to your account: their first and last name and birth year.</li>
          <li>Your league requests (team proposals and rosters, requests to join a team, and requests to link your account
            to a name on past scorecards), the coordinator's decisions and notes, and the scorecard name linked to your account.</li>
          <li>Captain handoffs: when a captain nominates you by email, we look up your account by that email and show the
            captain your name.</li>`)}
        </ul>
        <h3>Who can see it</h3>
        <ul>
          <li>Your profile, including your email and phone, is private to you and the league's site administrators.</li>
          ${league(`<li>Your league requests and your dependents' details are private to you and the league coordinator.</li>
          <li>Once the coordinator approves a team or places you on one, roster names are public on the site, like every
            past scorecard. Shooters under 18 appear as first name and last initial only.</li>`)}
          <li>We do not sell or share your information, and we do not show advertising.</li>
        </ul>
        <h3>Where it is stored</h3>
        <ul>
          <li>On Google Firebase, which hosts this site and runs its sign-in and database.</li>
          <li>To block automated abuse, the site uses Google reCAPTCHA, which receives information about your browser
            and device under <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google's
            Privacy Policy</a>.</li>
          <li>Your browser stores sign-in data so you stay signed in, the email address you entered while an emailed
            sign-in link is pending, and your light or dark display choice. The site uses no advertising or
            analytics cookies.</li>
        </ul>
        <h3>How long we keep it</h3>
        <ul>
          <li>Account information is kept while your account exists, including while it is deactivated.</li>
          <li>Records of emails sent are deleted after 30 days.</li>
          <li>When you delete your account, your profile${league(', dependents, and league requests')} are deleted
            right away. We keep a record that the account was deleted, without your name or email.</li>
        </ul>
        <h3>Email</h3>
        <ul>
          <li>The league sends email to your sign-in address through Amazon Simple Email Service (SES), which processes
            it only to deliver it.</li>
          <li>You choose the topics on your account page: league news the coordinator chooses to email, posted score
            results, and changes to upcoming shoot dates. League admins can also get a morning summary of new requests.</li>
          ${league(`<li>Updates about your own requests (team proposals, join requests, scorecard-name links, and captain
            changes) are sent whenever the coordinator decides one, whatever topics you choose.</li>`)}
          <li>Every topic email has a one-click unsubscribe link. You can also change your topics on your account page.</li>
          <li>We keep a record of each email sent, including the address it went to, for 30 days, then delete it.</li>
        </ul>
        <h3>Your choices</h3>
        <ul>
          <li>Edit your name and phone, choose your email topics, or connect and remove sign-in methods, on your account page.</li>
          ${league(`<li>Add, edit, or remove your dependents, and withdraw requests the coordinator hasn't decided yet.</li>`)}
          <li><strong>Deactivate</strong> your account to pause it; sign in later to reactivate.</li>
          <li><strong>Delete</strong> your account to remove your profile and sign-in permanently${league(', along with your dependents and league requests')}. Your name stays on
            published scorecards${league(' and approved rosters')} because they are the league's record.</li>
        </ul>
        <h3>Contact</h3>
        <p>Questions: <a href="${leagueMailto('CITL privacy question')}">${LEAGUE_EMAIL}</a>.</p>
      </section>
    </div>
  `;
}
