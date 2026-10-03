# Feature: Team Proposals, Dependents, and Registration (Milestone M2)

**Feature ID**: 009-team-proposals
**Created**: 2026-10-02
**Status**: Draft, for owner review
**Program**: Member accounts — M1 accounts and profile ([spec 008](../008-public-accounts/spec.md),
shipped) · **M2 member requests (this spec)** · M3 coordinator review, publish, and captain
handoff (spec 010) · M4 email notifications (spec 011).
**Tasks**: [tasks.md](./tasks.md)

---

## Overview

M1 gave every visitor an adult account with a profile and a status flag. A signed-in member
still can't do anything league-related. M2 adds the member side of joining the league:

1. **League teams** (`leagueTeams/{id}`): a persistent team identity across seasons, backfilled
   from the existing season team docs. One captain per league team (`captainUid`, set in M3).
2. **Team proposals** (F6, F7, F10): a member proposes a new team or claims a returning one,
   becomes its proposed captain, drafts a 5–15 shooter roster, and submits or withdraws it.
3. **Dependents** (F8): a member adds under-18 shooters to their own account. Minors never get
   accounts and are stored on rosters as first name + last initial.
4. **Individual registration** (F9): at any point in the season, a member (with any
   dependents) asks to be placed on a team.
5. **Shooter link requests** (owner request 2026-10-02): a member asks to be linked to their
   existing name on league scorecards.

Every M2 request ends in a pending state. Approving, rejecting, placing, and linking are
M3 (spec 010), which reviews all four request types in one admin queue. M2 and M3 ship to
production together, since a request with no review path is unusable (scope doc sequencing).

M2 never writes `seasons/**`. Published teams, rosters, and scores are untouched until a
coordinator approves something in M3.

---

## User Stories

**Member**
- As a member, I can propose a new team for the upcoming season, or claim a returning league
  team that has no captain, and I become its proposed captain.
- As a proposed captain, I can draft a roster: myself, my dependents, and other shooters by
  name, each flagged rookie or not and adult or under 18. For a returning team I can start
  from last season's roster.
- As a proposed captain, I can save a draft, submit it for review, withdraw it back to draft,
  or delete it.
- As a member, I can add, edit, and remove my dependents (name and birth year).
- As a member, I can ask to join a team at any time in the season, optionally with my
  dependents and a preferred team, and withdraw that request.
- As a member, I can ask to be linked to my name on past scorecards and see whether the
  request is pending, linked, or declined.
- As a member, I see the status of each of my requests on `/account`.

**Negative scenarios**
- A member can't propose for a returning team that already has a captain other than them.
- A member can't hold both a team proposal and an individual registration for the same season.
- A member can't write any proposal doc directly; only the `teamProposal` callable can.
- A member can't edit a submitted proposal, registration, or link request beyond the
  transitions listed below, or set any review field.
- A member can't read another member's proposals, registrations, link requests, or dependents.
- A deactivated member's writes are rejected (rules and callable).
- A member can't add a dependent with a birth year that makes them 19 or older this year.

---

## Acceptance Criteria

**League teams**
- [ ] AC-1: `scripts/backfill-league-teams.js` creates `leagueTeams/{teamId}` for every distinct
  team doc id across `seasons/*/teams`. Each doc gets `name` (from the latest season),
  `seasons` (sorted years), and `captainUid: null`. The script is idempotent, merges `seasons`
  on rerun, never overwrites a set `captainUid`, never writes `seasons/**`, and supports
  `--dry-run` (prints the plan). The emulator seed creates the same docs.
- [ ] AC-2: `leagueTeams` is readable by any signed-in user and writable only by the Admin SDK.

**F6 / F7 / F10 — Team proposals**
- [ ] AC-3: One proposal per member per season, at `teamProposals/{year}_{uid}`. All writes go
  through the `teamProposal` callable. Rules allow read by the captain and owner/admin only.
- [ ] AC-4: `teamProposal({ action: 'save', ... })` creates or replaces the draft. It accepts
  `year` ∈ {current UTC year, next year}, `teamSource: 'new' | 'returning'`, `leagueTeamId`
  (required for returning), `teamName`, and 0–15 roster entries. It is allowed while the status
  is `draft` or `changes-requested` (M3), and creates the doc as `draft` when none exists.
- [ ] AC-5: Save rejects: an inactive caller or one without a profile (`failed-precondition`);
  a registration for the same year (`failed-precondition`, reason `has-registration`); a
  returning team whose `captainUid` is set to someone else (`permission-denied`, reason
  `team-has-captain`); a new team whose slug matches an existing league team id
  (`already-exists`, reason `league-team-exists`); invalid input (`invalid-argument`).
- [ ] AC-6: Roster entries are one of:
  - `self`: the captain. The name is resolved on the server from the approved shooter link
    (M3) or else `profiles/{uid}.displayName`.
  - `dependent`: one of the caller's dependents by id. The name is resolved on the server as
    first name + last initial, and the entry is marked a minor.
  - `named`: first and last name typed by the captain (profile name rules). Adults are stored
    as "First Last". Minors are stored as "First L." and must name a guardian, who is another
    adult entry on the same roster.

  Every entry carries `rookie`. Names are unique on the roster by `normalizeShooterName`.
- [ ] AC-7: `submit` requires status `draft` or `changes-requested`, 5–15 entries, exactly one
  `self` entry, and every `dependent` id still present. It re-resolves `self` and `dependent`
  names, sets `status: 'submitted'` and `submittedAt`, and writes an audit entry
  (`kind: 'proposal'`, `action: 'submitted'`).
- [ ] AC-8: `withdraw` moves `submitted` to `draft` (audit `action: 'withdrawn'`). `delete`
  removes a `draft`, `changes-requested`, or `rejected` proposal. Every other transition is
  rejected with `failed-precondition`.
- [ ] AC-9: The callable uses `enforceAppCheck: !isEmulator`, the region of `setUserRole`, and a
  rate limit of 60 calls per hour per uid. Each call runs in one transaction.
- [ ] AC-10: The roster builder at `#/account/team` supports every entry kind, shows the
  rookie and under-18 controls, saves drafts, and is read-only while submitted. For a returning
  team it offers "Start from {year} roster", which loads that team's latest season doc as
  `named` adult entries.

**F8 — Dependents**
- [ ] AC-11: `profiles/{uid}/dependents/{depId}` holds `firstName`, `lastName`, `birthYear`,
  `createdAt`, `updatedAt`. Rules allow self read and write (active mirror required, key
  allowlist, name-part rules from spec 008, `birthYear` an int with
  `year − 18 ≤ birthYear ≤ year` where `year` is `request.time.year()`, server timestamps) and
  owner/admin read.
- [ ] AC-12: `/account` lists dependents with add, edit, and remove (at most 6, client-enforced).
  It shows each dependent's public form ("Sam D.") and flags birth year `year − 18` as "turns 18
  this year; they'll need their own account next season".

**F9 — Individual registration**
- [ ] AC-13: `registrations/{year}_{uid}` holds `uid`, `year`, `dependentIds` (≤ 6 strings),
  `preferredLeagueTeamId` (string or null), `note` (≤ 280 chars or null), `status`,
  `createdAt`, `updatedAt`. Rules allow:
  - Create: self, active mirror, profile exists, doc id = `{year}_{uid}`, `year` is this year
    or next, `status: 'submitted'`, and no `teamProposals/{year}_{uid}`.
  - Update: self, while `submitted`, only `dependentIds`, `preferredLeagueTeamId`, `note`,
    `updatedAt`.
  - Delete (withdraw): self, while `submitted`.
  - Read: self and owner/admin.
- [ ] AC-14: `/account` offers **Join a team** when the member has no proposal or registration
  for the registration season. It shows status and **Withdraw** once submitted.

**Shooter link requests**
- [ ] AC-15: `shooterLinkRequests/{uid}` holds `shooterName` (1–60 chars, trimmed), `note`
  (≤ 280, optional), `status`, `createdAt`, `updatedAt`. Rules allow:
  - Create: self, active mirror, `status: 'submitted'`.
  - Update: self, while `submitted`, only `shooterName`, `note`, `updatedAt`.
  - Delete: self, while `submitted` or `declined`.
  - Read: self and owner/admin.

  `shooterLinks/{uid}` is reserved for M3 (self and admin read; no client write).
- [ ] AC-16: The link form on `/account` searches names across every season's rosters (the
  existing cached `getTeams(year)` reads, loaded only when the form opens), prefilled with the
  profile name. It shows each match with the seasons it appears in. The member can also type a
  name with a note.

**Account lifecycle**
- [ ] AC-17: `assertNotCaptain` now reads `leagueTeams where captainUid == uid limit 1` and throws
  `failed-precondition` (reason `captain`) on a match. It still guards deactivate and delete.
- [ ] AC-18: `deleteAccount` also deletes the member's `teamProposals` (`where captainUid == uid`),
  `registrations` (`where uid == uid`), `shooterLinkRequests/{uid}`, and `shooterLinks/{uid}`.
  Dependents already go with `recursiveDelete(profiles/{uid})`. It still never reads or writes
  `seasons/**`, and a retry after partial failure still succeeds.

**Registration season**
- [ ] AC-19: The UI targets one registration season. It is the latest season's year when that
  season is `active`, else the latest year + 1, computed by a pure `registrationYear(seasons)`
  from the cached season list. Server and rules accept only the current or next UTC year.

**Security, tests, cost**
- [ ] AC-20: The rules and function tests in §Testing Checklist pass, and all existing tests
  still pass.
- [ ] AC-21: Reads stay small. `/account` adds at most four direct reads (proposal,
  registration, link request, dependents ≤ 6), and the roster builder adds the `leagueTeams` list.
  There are no new listeners and no composite indexes (each query has a single equality filter).
- [ ] AC-22: The account and roster-builder UI is code-split, and the main bundle stays within
  the §III.4 budget.
- [ ] AC-23: New UI meets §III.6 in light and dark mode at 360px or wider.
- [ ] AC-24: `firestore-schema.md`, the constitution (§II.5 schema, §VI.1 justified functions;
  1.8.0 → 1.9.0), ADR-013, and `CLAUDE.md` Key Files are updated.

---

## Constitutional Constraints

- **§VI.1**: one new callable, `teamProposal`, justified in DD-2. Everything else is a client
  write under rules.
- **§III.2**: rules and the callable are authoritative. Client checks (dependent cap, hiding
  **Join a team** when a proposal exists) are UX only.
- **§II.3 / §II.4**: `components → modules → services → repositories`. Components don't import
  `firebase/*`. Every file stays under 500 lines.
- **§III.4**: new UI loads with the existing account chunk. `/account/team` is its own chunk.
- **§III.5**: user strings render with `textContent` or `escapeHtml()`.
- **§I.2**: no new platform.
- **ADR-006**: the scoring engine is unchanged. Roster names from M2 only reach scoring after
  M3 publishes them.

---

## Architecture Approach

### Layer assignments

| Layer | Files | Change |
|-------|-------|--------|
| Types | `src/types/league.ts` (new) | `LeagueTeam`, `TeamProposal`, `RosterEntry` (`self \| dependent \| named`), `ProposalStatus`, `Registration`, `ShooterLinkRequest`, `Dependent`, callable request/response types |
| Repositories | `src/repositories/league-repository.ts` (new) | `leagueTeams` list; `teamProposals/{id}` get; `registrations/{id}` get/create/update/delete; `shooterLinkRequests/{uid}` get/set/delete |
| Repositories | `src/repositories/dependent-repository.ts` (new) | `profiles/{uid}/dependents` list/create/update/delete |
| Services | `src/services/league-validation.ts` (new) | pure: `validateTeamName`, `validateRosterDraft`, `validateRosterForSubmit`, `minorDisplayName`, `registrationYear`, `isAgingOut`, `validateDependentInput`. Limits mirror the rules and zod |
| Services | `src/services/member-league-service.ts` (new) | `teamProposal` callable wrapper, repository calls, error-code → message map. Lazy (`getMemberLeagueService()`); it builds both repositories itself so they stay off the main path |
| Services | `src/services/shooter-directory.ts` (new) | builds the name → seasons index from cached `getAllSeasons` + `getTeams(year)` |
| Modules | `src/main.ts` | route `/account/team` (lazy). The account gate applies to it as to `/account` |
| Components | `src/components/account-league.ts` (new) | `/account` League section: season request card, link-request card |
| Components | `src/components/account-dependents.ts` (new) | dependents list and form |
| Components | `src/components/registration-form.ts` (new) | Join a team dialog |
| Components | `src/components/shooter-link-form.ts` (new) | name search and request dialog |
| Components | `src/components/team-proposal-page.ts` (new) | roster builder shell, team source, actions |
| Components | `src/components/roster-entry-list.ts` (new) | entry rows, add/remove, rookie/minor/guardian controls |
| Utils | `src/utils/features.ts` (new) | `leagueRequestsEnabled`: `VITE_LEAGUE_REQUESTS=true`, or on by default against the emulator |
| Views | `src/views/account-team.ts` (new) | shell for `/account/team` |
| Styles | `src/styles/account.css` | tokens only |
| Server | `functions/src/teamProposal.ts` (new), `functions/src/index.ts` | callable |
| Server | `functions/src/lib/roster.ts` (new) | pure: slug, entry resolution, roster checks (unit-tested) |
| Server | `functions/src/lib/validate.ts` | zod `teamProposalInput` (discriminated on `action`) |
| Server | `functions/src/lib/captainGuard.ts` | real query (AC-17) |
| Server | `functions/src/deleteAccount.ts` | cascade (AC-18) |
| Server | `functions/src/lib/audit.ts` | `kind: 'proposal'` with `subjectId`, `action` |
| Config | `firestore.rules` | new matches (below) |
| Scripts | `scripts/backfill-league-teams.js` (new), `scripts/seed-emulator.js` | backfill; seed league teams, one dependent, one draft proposal, one registration, one link request |

### Data model (plan for `firestore-schema.md`)

| Path | Written by | Fields |
|------|-----------|--------|
| `leagueTeams/{teamId}` | Admin SDK (backfill; M3 approval and handoff) | `name`, `captainUid: string \| null`, `seasons: number[]`, `createdAt`, `updatedAt`. Doc id = the season team doc id (the name slug) |
| `teamProposals/{year}_{uid}` | `teamProposal` callable; M3 review | `captainUid`, `year`, `purpose: 'initial'` (M3 adds `'change'`), `teamSource`, `leagueTeamId \| null`, `teamName`, `shooters: RosterEntry[]`, `status`, `reviewNote: null`, `createdAt`, `updatedAt`, `submittedAt \| null`, `reviewedBy \| null`, `reviewedAt \| null` |
| `RosterEntry` | (embedded) | `kind`, `name` (resolved display name), `rookie`, `minor`, `dependentId?`, `guardianName?` |
| `profiles/{uid}/dependents/{depId}` | guardian | `firstName`, `lastName`, `birthYear`, `createdAt`, `updatedAt` |
| `registrations/{year}_{uid}` | member; M3 placement | as AC-13; M3 adds `placed \| declined`, `placedLeagueTeamId`, `reviewNote` |
| `shooterLinkRequests/{uid}` | member; M3 review | as AC-15; M3 adds `approved \| declined`, `reviewNote` |
| `shooterLinks/{uid}` | M3 only | reserved: `shooterName`, `nameKey`, `linkedAt`, `linkedBy` |
| `audit/{id}` | Functions | add `kind: 'proposal'`, `subjectId` (proposal id), `action: 'submitted' \| 'withdrawn'` |

`ProposalStatus` = `draft | submitted | changes-requested | approved | rejected`. M2 writes only
`draft` and `submitted`, and M3 writes the rest. The full enum is defined now so the rules and
types don't change in M3.

Indexes: none. `teamProposals where captainUid ==` and `registrations where uid ==` are
single-field equality queries that only `deleteAccount` runs.

### Rules (summary; tests define the exact matrix)

- `leagueTeams/{id}`: read `isSignedIn()`; write `false`.
- `teamProposals/{id}`: read `resource.data.captainUid == request.auth.uid || isOwnerOrAdmin()`;
  write `false`.
- `profiles/{uid}/dependents/{depId}`: replaces the M1 deny (AC-11).
- `registrations/{regId}`: AC-13. The proposal check is one `exists()`, and the profile check is
  one `exists()`, both on rare writes only.
- `shooterLinkRequests/{uid}`: AC-15. `shooterLinks/{uid}`: read self or owner/admin, write `false`.
- `isValidNamePart` from spec 008 is reused for dependents.

---

## Design Decisions

**DD-1 — Requests live outside `seasons/**`.** The scope doc placed proposals and registrations
under `seasons/{year}`. Top-level collections keyed `{year}_{uid}` were chosen instead:
- `seasons/**` stays the public league record with public-read, admin-write rules.
- `deleteAccount` keeps its "never touches `seasons/**`" invariant (spec 008 AC-17).
- The deterministic id enforces one proposal and one registration per member per season with
  no query.
- The rules can check proposal/registration exclusivity with a single `exists()`.

**DD-2 — Proposals are written by a callable (§VI.1 justification).** Rules can't iterate a
list, so they can't validate up to 15 roster entries, resolve dependent names, check name
uniqueness, or read a league team's captain and a registration in the same decision. The
callable does all of that in one transaction and writes the audit entry for submit and
withdraw. Volume is tens of calls per season. Dependents, registrations, and link requests
have fixed-shape fields, so they stay client writes under rules.

**DD-3 — Minor names are reduced at write time.** A minor's roster `name` is stored as
"First L." in the proposal. M3 copies it unchanged into `seasons/{year}/teams`, so every public
page shows the reduced form with no rendering change. Full dependent names stay in the
private dependents subcollection. Historical scorecard names are not changed.

**DD-4 — Guardian pairing.** A `dependent` entry is the captain's own child, so the pair is on
the same team by construction. A `named` minor must list a guardian who is an adult entry on
the same roster. For registrations, the dependents travel with the guardian's request, and M3
places them together.

**DD-5 — League team identity = season team doc id.** Team doc ids are name slugs and stay
fixed across renames within a season, so the same id across seasons is treated as the same
team. A team renamed between seasons appears as two league teams. Merging them is an M3 admin
action (out of scope here). Before the prod run, the backfill dry-run lists the ids found per
season for the owner to check.

**DD-6 — A returning team with no captain can be claimed by more than one member.** All
historical league teams start with `captainUid: null`. Several members may propose for the same
one, and the coordinator chooses in M3. Once M3 sets a captain, only that captain can propose
for the team, and anyone else is told to ask for a handoff (F14).

**DD-7 — Shooter links are a request plus a reserved link doc.** Scores stay keyed by name, so
a link changes no score. It gives the account a verified roster name (used for the `self`
entry) and is the foundation of the later "registered users are the roster" project. One link
per account. Uniqueness of a name across accounts is checked at M3 approval. Dependents can't be
linked in M2.

**DD-8 — Deactivation leaves requests in place.** M3 shows requests from deactivated members as
ineligible. Delete removes them (AC-18). This keeps `setAccountStatus` unchanged apart from the
real captain guard.

---

## Implementation Plan

Ordered groups (one commit each) are in [tasks.md](./tasks.md):
1. Rules and rules tests.
2. Functions: captain guard, `teamProposal`, delete cascade, and their tests.
3. Backfill script and emulator seed.
4. Client types, repositories, validation, and services (with unit tests).
5. `/account` League section: dependents, registration, link request.
6. Roster builder at `/account/team`.
7. Documentation and constitution.
8. Owner ops: backfill dry-run review, prod backfill, deploy, invoker binding for
   `teamproposal`, preview walkthrough.

M2 is merged to `main` behind no flag, but the League section stays hidden
(`VITE_LEAGUE_REQUESTS=false` in production) until M3 is deployed. This keeps `main`
deployable without exposing requests nobody can review.

---

## Accessibility (§III.6)

- The roster builder is a table with a caption. Each row's controls have row-specific
  accessible names ("Remove Sam D.", "Rookie, Sam D."). Add and remove move focus predictably
  (to the new row's first field, and to the next row or the Add button).
- The under-18 checkbox reveals the guardian select, linked with `aria-controls`. Validation
  errors are listed in a summary with `role="alert"` and tied to fields with `aria-describedby`.
- Status is shown in text ("Draft", "Submitted for review"), not by colour alone.
- Dialogs (Join a team, link request, dependent form) follow the spec 008 native `<dialog>`
  pattern.
- There is no horizontal scroll at 360px. Roster rows stack below 480px.

---

## Testing Checklist

**Rules** (new `tests/rules/league.test.ts`, `tests/rules/dependents.test.ts`; about 40 cases)
- [ ] `leagueTeams`: signed-in read allowed; anon read denied; all client writes denied.
- [ ] `teamProposals`: captain and admin read allowed; other user and anon denied; every client
  write denied, including the captain's own.
- [ ] Dependents: self CRUD allowed; another user denied; admin read allowed and write denied;
  deactivated self denied; extra key, bad name, `birthYear` of `year − 19` and `year + 1`, and
  non-int denied; client timestamps denied.
- [ ] Registrations: valid create allowed; wrong doc id, year outside {Y, Y+1}, status other
  than `submitted`, existing proposal, missing profile, and deactivated denied; allowed field
  update while submitted; `status` change denied; update and delete after a server status change
  denied; delete while submitted allowed; another user denied.
- [ ] Link requests: create, update, and delete allowed per AC-15; status change denied; edit
  after `approved` denied; delete after `approved` denied; 61-char name denied.
- [ ] `shooterLinks`: self read allowed, write denied.
- [ ] Regression: the spec 008 profile rules and all existing cases still pass.

**Functions** (`tests/functions/teamProposal.test.ts`, plus additions)
- [ ] Rejections: unauthenticated; deactivated; no profile; year out of range; registration
  exists; returning team with another captain; new team name slug equal to a league team id;
  17 entries; duplicate names; minor without a guardian; guardian who is a minor; unknown
  dependent id; another user's dependent id; the 61st call in an hour.
- [ ] Save creates `draft` and replaces it on a second save. `self` and `dependent` names are
  resolved, and a minor is stored as "First L.".
- [ ] Submit: fewer than 5, or zero or two `self` entries, is rejected; a valid roster sets
  `submitted`, sets `submittedAt`, and writes one audit entry; save while submitted is rejected.
- [ ] Withdraw and delete transitions per AC-8. Delete of a submitted proposal is rejected.
- [ ] `assertNotCaptain`: throws for a seeded `captainUid`, passes otherwise.
  `deleteAccount` and `setAccountStatus` are blocked for a captain.
- [ ] `deleteAccount` cascade: proposals, registrations, link request, link, and dependents are
  gone; `seasons/**` is byte-identical; other members' docs are untouched; retry succeeds.
- [ ] `lib/roster.ts` pure tests: slug parity with the client `_slugify`, entry resolution,
  and guardian rules.

**Client unit**
- [ ] `league-validation`: name and roster boundaries (0, 5, 15, 16), `minorDisplayName`
  (accents, hyphenated last names), `registrationYear` table, `isAgingOut`.
- [ ] `shooter-directory`: merges names across seasons by `normalizeShooterName` and lists
  seasons.
- [ ] `member-league-service`: error reason → message map.

**Manual / E2E**
- [ ] Emulator walkthrough: add dependents → propose a returning team → start from last
  season → add a named minor with a guardian → submit → withdraw → delete; register a second
  member with dependents; request a shooter link; delete an account with open requests.
- [ ] Keyboard-only and screen-reader pass of the roster builder at 360px, light and dark.
- [ ] Bundle re-measured; `/check` clean; `@reviewer` clean.

---

## Assumptions

1. **Roster size** 5–15 comes from the league rules (`src/views/rules.ts`). Drafts may hold
   fewer.
2. **Team name**: 2–40 chars after trim; letters, digits, spaces, `&'.-`.
3. **Dependents cap** of 6 per account is client-enforced only, since extra docs cost only the
   member who writes them.
4. **Under 18** = `birthYear ≥ current year − 18` (birth year only, no birth date), so someone
   who turns 18 later this calendar year still counts as a minor this season.
5. **Rookie** is the captain's claim. Starting averages and handicaps stay admin-set in M3.
6. **Last season's roster** for "Start from" is the latest season listed in
   `leagueTeams.seasons`.
7. **No email** in M2. Status shows on `/account` only, and M4 adds status emails.
8. **Competing proposals**: until M3 sets `captainUid`, two members may propose the same
   unclaimed returning team, or two new teams with the same name. M2 does not block this;
   M3 approval sets the captain, after which the other proposal fails `team-has-captain` or
   `league-team-exists` and the coordinator returns it.
9. **Proposal vs registration**: the registration rule's `!exists(teamProposals/…)` and the
   callable's registration check run in separate transactions, so a near-simultaneous pair
   can both land. The window is small and M3 review sees both.

## Decisions for the owner (defaults applied above)

1. **Link approval is in M3's queue** with the other three request types, rather than a
   separate M2 admin screen.
2. **Production gating**: M2 ships hidden behind `VITE_LEAGUE_REQUESTS` until M3 deploys.
3. **Named minors on a captain's roster** are allowed when a guardian adult is on the same
   roster (the guardian doesn't need an account).

---

## Out of Scope / Forward Compatibility

- **M3 (spec 010)**: admin review queue for proposals, registrations, and link requests (approve,
  reject, request changes, place); publish on approval (season team doc with `leagueTeamId`,
  `captainUid`, `sourceProposalId`; `leagueTeams` captain and seasons); post-approval change
  requests (`purpose: 'change'`); captain handoff; league team merge; link uniqueness.
- **M4 (spec 011)**: status emails for each request type.
- **Later**: registered users as the roster (self sign-up onto a team), co-captains, linking
  dependents to historical names, payments.
