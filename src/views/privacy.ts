import { LEAGUE_EMAIL, leagueMailto } from '@/utils/contact';
import { LEGAL_ANCHORS, TERMS_VERSION } from '@/utils/legal';
import { leagueRequestsEnabled } from '@/utils/features';

/**
 * privacyView — Terms of Use and Privacy Policy (spec 008 AC-10, AC-24).
 *
 * Pure HTML-string factory. Reachable at /#/privacy and /privacy (main.ts
 * maps the pathname), and allowed while the account gate is active.
 *
 * PLACEHOLDER COPY: accepted for M1 (owner decision 2026-10-01). Replace
 * with the league's final wording and bump TERMS_VERSION before
 * announcing accounts (tasks 1.8 / 11.6).
 *
 * Spec 010 AC-22: the league lines appear only when league requests are
 * on, which is also when TERMS_VERSION moves to the league version.
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
      <p><em>Draft wording, version ${TERMS_VERSION}. The league will publish final wording here; if it changes,
      you'll be asked to accept it again the next time you sign in.</em></p>

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
          <li>From your sign-in provider (Google or an emailed link): your email address and account identifier.</li>
          <li>From you: your name, and a phone number if you choose to give one.</li>
          <li>Records of when you accepted these terms, confirmed you are 18 or older, and changed your account status.</li>
          ${league(`<li>Shooters under 18 you add to your account: their first and last name and birth year.</li>
          <li>Your league requests (team proposals and rosters, requests to join a team, and requests to link your account
            to a name on past scorecards), the coordinator's decisions and notes, and the scorecard name linked to your account.</li>
          <li>Captain handoffs: when a captain nominates you by email, we look up your account by that email and show the
            captain your name.</li>`)}
        </ul>
        <h3>Who can see it</h3>
        <ul>
          <li>Your profile is private to you and the league's site administrators.</li>
          ${league(`<li>Your league requests and your dependents' details are private to you and the league coordinator.</li>
          <li>Once the coordinator approves a team or places you on one, roster names are public on the site, like every
            past scorecard. Shooters under 18 appear as first name and last initial only.</li>`)}
          <li>We do not sell or share your information, and we do not show advertising.</li>
        </ul>
        <h3>Where it is stored</h3>
        <p>On Google Firebase, which hosts this site. Your browser stores sign-in data so you stay signed in.</p>
        <h3>Your choices</h3>
        <ul>
          <li>Edit your name and phone, or connect and remove sign-in methods, on your account page.</li>
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
