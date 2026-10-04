# Feature: Coordinator Review, Publish on Approval, and Captain Handoff (Milestone M3)

**Feature ID**: 010-coordinator-review
**Created**: 2026-10-03
**Status**: Implemented, for owner review
**Program**: Member accounts — M1 accounts and profile ([spec 008](../008-public-accounts/spec.md),
shipped) · M2 member requests ([spec 009](../009-team-proposals/spec.md), shipped hidden) ·
**M3 coordinator review (this spec)** · M4 email notifications (spec 011).
**Tasks**: [tasks.md](./tasks.md)

---

## Overview

M2 lets members send four kinds of request, and every one stops in a pending state. M3 is the
other half: the coordinator (an admin or owner) decides each request, and an approval turns it
into season data in one transaction. M3 also lets a captain hand the team to someone else.

1. **Review queue** (F11): a **Requests** tab in `/admin` lists submitted team proposals, join
   requests, scorecard-name links, and accepted captain handoffs, plus the league teams that
   have a captain.
2. **Publish on approval** (F12): approving a proposal creates or updates
   `seasons/{year}/teams/{teamId}`, sets the league team's captain, and writes an audit entry.
   Placing a join request adds the member (and their dependents) to a season team.
3. **Post-approval changes** (F13): a captain reopens an approved roster, edits it, and submits
   it again. The change re-enters the queue; the published roster is untouched until approval.
4. **Captain handoff** (F14): the captain nominates a member by email, the nominee accepts, and
   the coordinator approves.
5. **Flag-on step**: the privacy policy gains the league data M2 collects, and turning on
   `VITE_LEAGUE_REQUESTS` also raises the terms version, so members accept the new wording
   before they can use league requests.

Scores stay keyed by shooter name (ADR-006, ADR-013). Approval writes roster names and starting
averages; it never touches weeks, entries, or standings.

---

## User Stories

**Coordinator**
- I see every submitted request in one place, oldest first, with who sent it.
- For a proposal I see the roster against the team's last season (returning, new, dropped), set
  each new shooter's starting average and rookie flag, then approve, reject, or ask for changes
  with a note.
- For a join request I choose a team for this season, set starting averages, and place the
  member and their dependents together, or decline.
- For a scorecard-name link I can correct the spelling to match the scorecards, then approve or
  decline. A name can be linked to one account only.
- I approve or decline an accepted captain handoff, and I can remove a team's captain.

**Captain**
- After approval I can request roster changes; the team keeps its published roster until the
  coordinator approves the change. I can discard a change I no longer want.
- I can nominate another member as captain by their account email and cancel the nomination.

**Member**
- I see a captain nomination on `/account` and accept or decline it.
- I see where I was placed, or the coordinator's note when a request is declined, and I can
  clear a declined join request to try again or propose a team.

**Negative scenarios**
- A member can't call any review action, and an admin can't review a request that isn't in a
  reviewable state.
- Approval fails, with nothing written, when: the captain's account is inactive; the team has
  another captain; the captain already captains another team; a new shooter has no starting
  average; or the approved roster would drop a shooter who already has scores this season.
- A name already linked to another account can't be linked again.
- A captain can't nominate themselves, a deactivated member, someone who already captains a
  team, or anyone while a handoff for that team is open.

---

## Acceptance Criteria

**F11 — Review queue**
- [ ] AC-1: `/admin` has a **Requests** tab, loaded on first open (its own chunk). It lists
  submitted proposals, submitted registrations, submitted link requests, and accepted captain
  changes, oldest first, each with the member's name and email and the target season.
- [ ] AC-2: A proposal card shows the team, season, and kind (new, returning, or change), and a
  roster table: name, captain's rookie claim, under-18 and guardian, and a comparison column
  against the team's latest season doc (On last roster / New / Dropped). New shooters get a
  starting-average input prefilled by `computeShooterDefaults(year, name)` and a rookie
  checkbox prefilled from the same; shooters already on this season's team doc show their
  stored average read-only.
- [ ] AC-3: Each card has a note field (≤ 500 chars) and its actions. **Request changes**
  requires a note. Every action shows its result and refreshes the queue.
- [ ] AC-4: The tab also lists league teams that have a captain, with **Remove captain**.
- [ ] AC-5: Queue reads are single-field equality queries (`status ==`), plus one profile and
  one user read per distinct member. No listeners, no composite indexes.

**F12 — Publish on approval (`reviewRequest` callable)**
- [ ] AC-6: `reviewRequest` is owner/admin only (token claim; `permission-denied` otherwise),
  uses `enforceAppCheck: !isEmulator`, region `us-central1`, a rate limit of 200 calls per hour
  per admin, and one transaction per call. Every decision writes an audit entry.
- [ ] AC-7: **Approve proposal** (status `submitted`). Team id = `leagueTeamId` for a returning
  team or a change, else `slugify(teamName)`. The transaction:
  - checks the captain's mirror is active and the profile exists (`not-eligible`);
  - checks the league team's `captainUid` is null or the captain (`team-has-captain`), and that
    a new team's id isn't an existing league team (`league-team-exists`);
  - checks the captain captains no other league team (`already-captain`);
  - merges the roster into the season team doc (AC-8), creating it with empty totals if
    missing, and sets `captain` (the captain's roster name), `leagueTeamId`, `captainUid`,
    `sourceProposalId`; ensures `seasons/{year}` exists (merge, as `createTeam` does);
  - sets `leagueTeams/{teamId}`: `captainUid`, `seasons ∪ {year}`, and `name`/`createdAt`
    when new;
  - sets the proposal `approved`, `leagueTeamId`, `reviewNote`, `reviewedBy`, `reviewedAt`.
- [ ] AC-8: Roster merge (pure, `functions/src/lib/publish.ts`). Matching is by
  `normalizeShooterName`. A shooter already on the team doc keeps its stored record (id,
  starting average, rookie, scores). A new shooter needs a starting average (0–50, from the
  call) and gets the rookie flag from the call (`missing-average` otherwise). A team-doc
  shooter left off the roster is dropped only if they have no scores this season
  (`shooter-has-scores` otherwise; the coordinator removes them in Team Management). The
  result has at most 15 shooters and unique names.
- [ ] AC-9: **Reject** sets `rejected` (note optional). **Request changes** sets
  `changes-requested` with the note. For a change request (`purpose: 'change'`), reject instead
  returns the proposal to `approved` with the published roster (AC-15).
- [ ] AC-10: **Place registration** (status `submitted`; member active with a profile): adds the
  member (roster name: approved link, else profile name) and each listed dependent ("First L.",
  minor) to `seasons/{year}/teams/{teamId}` (must exist) with starting averages and rookie flags
  from the call (AC-8 rules: unique, at most 15). Adds `year` to the league team's `seasons`
  (creating the league team doc, captain null, when missing). Sets the registration `placed`,
  `placedLeagueTeamId`, `reviewNote`, `reviewedBy`, `reviewedAt`. **Decline** sets `declined`.
- [ ] AC-11: **Approve link** (status `submitted`; member active): the name is the one the
  coordinator picks on the card (the exact match preselected, close matches listed; no free
  text), or the requested one. It must be on a season roster (`not-on-scorecard`) and is
  stored with the latest season's spelling. The member's link form also only sends a name
  from the scorecard directory. Fails with `name-taken` when another account's
  `shooterLinks` doc has the same `nameKey`. Writes `shooterLinks/{uid}` (`shooterName`,
  `nameKey`, `linkedAt`, `linkedBy`) and sets the request `approved`. **Decline** sets
  `declined`.
- [ ] AC-12: **Approve captain change** (status `accepted`): the league team's `captainUid` must
  still be the nominating captain (`stale-handoff`), and the nominee must be active with a
  profile and captain no other team. Sets `captainUid` to the nominee and the change `approved`.
  **Decline** sets `rejected` (`declined` is the nominee saying no).
- [ ] AC-13: **Remove captain** sets the league team's `captainUid` to null and cancels any open
  handoff for it.

**F13 — Post-approval changes (`teamProposal`)**
- [ ] AC-14: New action `reopen` (status `approved`; caller still the league team's captain,
  `not-captain` otherwise; the season team doc exists). It rebuilds the draft roster from the
  published team doc: the captain's name becomes `self`, a dependent's "First L." becomes that
  `dependent`, everything else `named` (keeping the minor flag and guardian from the previous
  roster). Sets `purpose: 'change'`, `status: 'draft'`, and audits `reopened`.
- [ ] AC-15: For a change, `save` keeps the stored team (source, league team, name) and skips the
  new-team and registration checks; `submit` and `withdraw` behave as before; `delete` becomes
  **discard**: the proposal returns to `approved` with the published roster (audit `discarded`).
- [ ] AC-16: The roster builder shows **Request roster changes** on an approved proposal, locks
  the team fields for a change, and labels delete **Discard changes**.

**F14 — Captain handoff (`captainHandoff` callable)**
- [ ] AC-17: `captainChanges/{leagueTeamId}` holds `leagueTeamId`, `teamName`, `fromUid`,
  `fromName`, `toUid`, `toName`, `status` (`nominated | accepted | declined | cancelled |
  approved | rejected`), `reviewNote`, `createdAt`, `updatedAt`, `respondedAt`, `reviewedBy`,
  `reviewedAt`. One per team; a new nomination replaces a closed one. Rules: read by `fromUid`,
  `toUid`, or owner/admin; no client writes.
- [ ] AC-18: `captainHandoff` (signed-in member, App Check, `us-central1`, 20 calls per hour per
  uid, one transaction) actions:
  - `nominate { leagueTeamId, email }`: caller is the active captain; the email resolves through
    Firebase Auth to another active member with a profile who captains no team; no open
    (`nominated`/`accepted`) handoff exists for the team. Errors: `not-captain`, `no-member`,
    `self-nomination`, `not-eligible`, `already-captain`, `handoff-open`.
  - `cancel { leagueTeamId }`: the nominating captain, while open.
  - `accept` / `decline { leagueTeamId }`: the nominee, while `nominated`.
  Every action writes an audit entry.
- [ ] AC-19: `/account` shows a **Captain** card when the member captains a team (team name,
  open handoff and its status, nominate and cancel) and a nomination card when they've been
  nominated (accept, decline). Both load with the League section (three single-field queries).

**Member status and lifecycle**
- [ ] AC-20: `/account` shows the placed team's name for a placed registration and the
  coordinator's note for a declined one, with **Remove request**. The rules allow a member to
  delete their registration while `submitted` or `declined`.
- [ ] AC-21: `deleteAccount` also deletes `captainChanges` where `toUid == uid` (the captain guard
  already blocks a captain, so no open handoff has them as `fromUid`).

**Flag-on step and privacy**
- [ ] AC-22: `/privacy` lists, when league requests are on: dependents' names and birth years
  (private; rosters show first name and last initial), league requests and the coordinator's
  decisions, linked scorecard names, captain handoffs by email, and that approved rosters are
  public. `TERMS_VERSION` is `2026-10.2` when `VITE_LEAGUE_REQUESTS` is on and `2026-10`
  otherwise, so turning the flag on asks every member to accept again (spec 008 AC-12).
- [ ] AC-23: The production and preview deploy workflows pass `VITE_LEAGUE_REQUESTS` from the
  repository variable of that name. Production stays off until the owner sets it.

**Security, tests, cost**
- [ ] AC-24: The rules and function tests in §Testing Checklist pass, and all existing tests
  still pass.
- [ ] AC-25: `<admin-panel>` loads lazily when an admin is signed in, so the main bundle stays
  within the §III.4 budget with headroom; the Requests tab and the captain card are lazy.
- [ ] AC-26: New UI meets §III.6 in light and dark mode at 360px or wider.
- [ ] AC-27: `firestore-schema.md`, constitution (§II.5, §VI.1; 1.9.0 → 1.10.0), ADR-014,
  `firebase-deployment.md` (two new callables), and `CLAUDE.md` Key Files are updated.

---

## Constitutional Constraints

- **§VI.1**: two callables, justified in DD-1. Volume: tens of reviews and a few handoffs per
  season.
- **§III.2**: review and handoff are server-only; rules deny every client write to
  `captainChanges`, `shooterLinks`, and review fields. Role checks use the token claim.
- **§II.3 / §II.4**: `components → modules → services → repositories`; the review service
  builds its own repository (ADR-013 decision 5). Files stay under 500 lines.
- **§III.4**: the Requests tab and captain card are lazy; `<admin-panel>` becomes lazy (DD-6).
- **ADR-006**: the scoring engine is unchanged. Approval only writes roster records the admin
  roster modal already writes (`id`, `name`, `rookie`, `startingAvg`, `finalAvg`, `weeksShot`,
  `scores`).

---

## Architecture Approach

### Layer assignments

| Layer | Files | Change |
|-------|-------|--------|
| Types | `src/types/league.ts` | `CaptainChange`, review request/response types, `purpose` on proposals, placement fields |
| Repositories | `src/repositories/league-review-repository.ts` (new) | queue queries, member names, league teams with captains |
| Repositories | `src/repositories/league-repository.ts` | captaincy and handoff queries for the member |
| Services | `src/services/league-review-service.ts` (new, lazy) | queue assembly, roster comparison, `reviewRequest` wrapper |
| Services | `src/services/member-league-service.ts` | `reopen`, handoff wrapper, captaincy in the overview |
| Components | `src/components/admin-tabs/requests-tab.ts`, `request-cards.ts` (new, lazy) | the Requests tab |
| Components | `src/components/account-captain.ts` (new) | Captain and nomination cards |
| Components | `account-league.ts`, `team-proposal-page.ts` | placed/declined status, change flow |
| Components | `admin-panel.ts` | Requests nav item; lazy-mounts the tab |
| Modules | `src/main.ts` | lazy `<admin-panel>` |
| Views | `src/views/privacy.ts`, `src/utils/legal.ts` | flag-dependent league section and terms version |
| Server | `functions/src/reviewRequest.ts`, `functions/src/review/*.ts` (new) | callable and per-type handlers |
| Server | `functions/src/captainHandoff.ts` (new) | callable |
| Server | `functions/src/lib/publish.ts` (new) | pure roster merge and team-to-roster rebuild |
| Server | `functions/src/teamProposal.ts` | `reopen`, change-aware save/delete |
| Server | `functions/src/lib/{validate,audit,rateLimit}.ts`, `deleteAccount.ts` | inputs, audit kinds, limits, cascade |
| Config | `firestore.rules` | `captainChanges`; registration delete while declined |
| CI | `.github/workflows/deploy-{production,preview}.yml` | pass the flag variable |

### Data model changes

| Path | Change |
|------|--------|
| `teamProposals/{id}` | M3 writes `approved`, `rejected`, `changes-requested`, `purpose: 'change'`, `leagueTeamId` on approval of a new team, `reviewNote`, `reviewedBy`, `reviewedAt` |
| `registrations/{id}` | M3 writes `placed`, `declined`, `placedLeagueTeamId`, `reviewNote`, `reviewedBy`, `reviewedAt` |
| `shooterLinkRequests/{uid}` | M3 writes `approved`, `declined`, `reviewNote`, `reviewedBy`, `reviewedAt` |
| `shooterLinks/{uid}` | written on approval: `shooterName`, `nameKey`, `linkedAt`, `linkedBy` |
| `captainChanges/{leagueTeamId}` | new (AC-17) |
| `leagueTeams/{id}` | `captainUid` set by approval and handoff; `seasons` grows on approval and placement |
| `seasons/{year}/teams/{id}` | approval adds `leagueTeamId`, `captainUid`, `sourceProposalId` |
| `audit/{id}` | `kind` adds `registration`, `shooter-link`, `captain`; `proposal` actions add review outcomes |

Indexes: none. Every query is one equality filter.

---

## Design Decisions

**DD-1 — Two callables (§VI.1).** Approval writes `seasons/**`, `leagueTeams`, the request, and
an audit entry atomically, and reads the captain's other teams and the team doc to decide; rules
can't do multi-document writes or queries. One `reviewRequest` callable with a discriminated
input keeps the deploy and invoker-binding work to one function for all four request types.
Handoff needs an email-to-account lookup, which only the Admin SDK can do without exposing the
user list, so it is a second, member-facing callable. Folding handoff into `teamProposal` was
rejected: different callers, different rate limits.

**DD-2 — Starting averages are set at approval.** The coordinator already sets averages in the
roster modal. The review card prefills them with the same `computeShooterDefaults` logic, and
the callable stores what the coordinator confirms. Shooters already on the season team keep
their stored values, so a change request can't alter an average.

**DD-3 — The published team doc is the source of truth after approval.** Admin edits in Team
Management stay allowed. A change request starts from the team doc, not the old proposal, and a
rejected or discarded change goes back to it. Dropping a shooter who has scores is refused
rather than cascaded; that stays an admin action with its existing cascade.

**DD-4 — Captaincy lives on `leagueTeams` only.** A handoff changes `leagueTeams.captainUid`.
Season docs keep `captain`/`captainUid` as the record of who captained that season; the new
captain's next approved proposal or change updates them.

**DD-5 — Handoff by email.** Captains don't see the member list. Firebase Auth's
`getUserByEmail` is case-insensitive and finds members by any sign-in method. A successful
nomination shows the nominee's profile name to the captain, so they can confirm the right
person. Lookups are rate limited and need captaincy, which limits probing for accounts.

**DD-6 — Lazy admin panel.** `<admin-panel>` and its tabs were in the main bundle for every
visitor. Importing it when an admin signs in (it already mounts only then) frees the headroom
this milestone and M4 need.

**DD-7 — Terms version follows the flag.** Re-acceptance belongs with the release that exposes
the new data uses. Deriving `TERMS_VERSION` from `VITE_LEAGUE_REQUESTS` makes the flag flip a
single build variable, with no code change and no early re-acceptance prompt.

**DD-8 — Competing requests are resolved by order of approval.** The first approval for an
unclaimed team sets its captain; a second proposal for it then fails `team-has-captain` and the
coordinator rejects it with a note. The queue flags proposals for the same team.

---

## Implementation Plan

Ordered groups (one commit each) are in [tasks.md](./tasks.md):
1. Rules and rules tests.
2. Functions: publish lib, `reviewRequest`, `captainHandoff`, `teamProposal` changes, cascade,
   tests.
3. Client data layer: types, repositories, services, unit tests.
4. Admin Requests tab and lazy admin panel.
5. Member side: captain card, status, change flow.
6. Privacy, terms version, workflow flag.
7. Documentation.
8. Owner ops (after merge): invoker bindings, preview walkthrough, flag on.

---

## Accessibility (§III.6)

- Each request is a `<section>` with a heading naming the team or member; actions have
  request-specific accessible names ("Approve Clay Busters").
- Roster tables have captions; each average input is labelled with the shooter's name.
- Results are announced through the existing toast live region; errors on a card show in a
  `role="alert"` block inside it.
- Comparison state is text ("New", "Dropped"), not colour alone. Cards stack at 360px.

---

## Testing Checklist

**Rules** (`tests/rules/league.test.ts` additions; about 10 cases)
- [ ] `captainChanges`: nominator, nominee, and admin read allowed; another member and anon
  denied; `where toUid ==` query allowed for the nominee; every client write denied.
- [ ] Registrations: delete while `declined` allowed; while `placed` denied.
- [ ] Admin `status ==` queries on `teamProposals`, `registrations`, `shooterLinkRequests`
  allowed; the same queries by a member denied.

**Functions**
- [ ] `lib/publish.ts`: merge keeps stored shooters, adds new ones with averages, refuses a
  missing average, an out-of-range average, dropping a shooter with scores, more than 15, and
  duplicates; team-to-roster rebuild maps self, dependents, and minors.
- [ ] `reviewRequest`: non-admin denied; each type's approve and decline; every failure reason
  in AC-7 and AC-10 – AC-12; nothing written on failure; audit entries; change approval and
  rejection; remove captain.
- [ ] `captainHandoff`: each action and failure reason in AC-18.
- [ ] `teamProposal`: `reopen`, change save keeps the team, discard restores the roster.
- [ ] `deleteAccount`: nominations to the member are removed.

**Client unit**
- [ ] `league-review-service`: roster comparison (on last roster, new, dropped) and queue
  ordering.

**Manual / E2E**
- [ ] Emulator walkthrough: approve a returning and a new team; request changes, resubmit,
  approve; reopen, drop a shooter with scores (refused), discard; place a join request with a
  dependent; link a name, try the same name for another member (refused); nominate, accept,
  approve a handoff; remove a captain; standings and scorecards unchanged.
- [ ] Keyboard-only pass of the Requests tab at 360px, light and dark.
- [ ] Bundle re-measured.

---

## Assumptions

1. Starting averages are on the 50-target scale used by the roster modal (default 35).
2. A member captains at most one league team.
3. Approval for next season creates `seasons/{year}` the same way **Add team** does.
4. A placed member is added to a season team; their registration is not converted into a
   proposal.
5. Status changes are visible on `/account` only until M4 adds email.

## Decisions for the owner (defaults applied above)

1. **Remove captain** is in the Requests tab, so an admin can free a captain who left without a
   handoff (the account-delete guard message already points members to the coordinator).
2. **Rejecting a change request** keeps the published roster and returns the proposal to
   approved, rather than marking the team rejected.
3. **The flag flip** is a repository variable (`VITE_LEAGUE_REQUESTS=true`) set after the merge
   deploy and invoker bindings, followed by a re-run of the production deploy.

---

## Out of Scope / Forward Compatibility

- **M4 (spec 011)**: status emails for every decision and nomination.
- **Later**: merging two league teams (a rename between seasons) in the UI; unlinking a
  scorecard name; registered users as the roster.
