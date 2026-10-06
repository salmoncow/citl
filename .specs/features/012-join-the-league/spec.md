# Feature: Join the League

**Feature ID**: 012-join-the-league
**Created**: 2026-10-06
**Status**: Implemented, for owner review
**Program**: Member accounts — follows M1 accounts ([spec 008](../008-public-accounts/spec.md)),
M2 member requests ([spec 009](../009-team-proposals/spec.md)), M3 coordinator review
([spec 010](../010-coordinator-review/spec.md)), M4 email ([spec 011](../011-email-notifications/spec.md)).
**Tasks**: [tasks.md](./tasks.md)

---

## Overview

The **Join the league** buttons (home hero, nav) link to the About page, which says to email the
coordinator. The account path that already handles join requests (`/account` → League) is
reachable only through **Sign in**. This feature makes **Join the league** the entry point to
that path: a `#/join` page that takes a visitor through sign-in, profile setup, the scorecard
name question, and the join request, and shows their status afterwards.

The profile name (or the approved scorecard name) is the roster name the coordinator places, as
today (`selfNameFrom`). No new collections, rules, or callables.

Applies only while `VITE_LEAGUE_REQUESTS` is on. With the flag off, the buttons keep pointing
at `#/about` and `#/join` shows the email instructions.

---

## User Stories

**Visitor**
- I click **Join the league**, create an account or sign in, finish my profile, and send a join
  request without hunting for the Account page.
- If I shot here before, I'm asked to pick my name from past scorecards first, so my history
  stays together.
- If I'm new, I see the exact name I'll appear under on rosters before I send the request.
- If I'm forming a team, I'm pointed to **Propose a team**.
- If I'd rather not make an account, I can still email the coordinator.

**Member**
- With a request or proposal already in, `#/join` shows its status. The nav button reads
  **My league**.

**Coordinator**
- A join request from a member whose scorecard-name link is still waiting is marked on the
  request card, so I review the link before placing them.

**Negative scenarios**
- A signed-in member who must finish their profile, accept updated terms, or reactivate is not
  bounced off `#/join` to `/account`: the join page shows that step itself (profile and terms) or
  links to `/account` (reactivate).
- A visitor who signs in by email link from `#/join` returns to `#/join`, not `/account`, if the
  link is opened within an hour in the same browser. Otherwise they land on `/account` as today.

---

## Acceptance Criteria

**Entry points**
- [ ] AC-1: With the flag on, the home hero and nav **Join the league** buttons link to `#/join`.
  When signed in, the nav button reads **My league** (still `#/join`). With the flag off, both
  link to `#/about` and read **Join the league**.
- [ ] AC-2: The About page **Enrollment & Fees** card points to `#/join` (flag on) and keeps the
  coordinator email as the alternative. With the flag off its copy is unchanged.
- [ ] AC-10: The home page **New to trap?** guide's first step and button point to `#/join`
  (flag on), with the coordinator email kept in the step as the alternative. With the flag off
  they are unchanged. (Added 2026-10-06 after #321 shipped.)

**Join page (`#/join`, lazy chunk)**
- [ ] AC-3: Signed out: a short summary (free, Tuesdays at Darnall's, per-day range fee), the
  sign-in options, and a fallback line to email the coordinator.
- [ ] AC-4: Starting sign-in from `#/join` records a join intent in `localStorage`
  (`citl.joinIntent`, a timestamp; storage errors ignored). When an email sign-in link opens
  within 60 minutes of that timestamp, boot rewrites the address to `/#/join` instead of
  `/#/account`. The intent is cleared once the join page renders for a signed-in member.
- [ ] AC-5: `/join` is an account-gate allowed path. While gated, the page renders the same
  `account-profile-form` as `/account` for `complete-profile` and `accept-terms`, and a link to
  `/account` for `reactivate`. When the gate clears, the page moves on to AC-6.
- [ ] AC-6: Signed in with no proposal or join request for the registration year: the page asks
  **Have you shot in CITL before?** (Yes / No radio group).
  - **Yes**: shows the scorecard-name link state. No request: **Find my scorecard name** opens the
    existing link dialog. Submitted: the name and "Waiting for the coordinator to confirm".
    Approved: "You'll appear on rosters as {linked name}". Declined: the note and **Try again**.
  - **No**: "You'll appear on rosters as {profile display name}" with a link to edit the name on
    `/account`.
  - Both: **Send join request** opens the existing registration dialog (dependents, preferred
    team, note). A line offers **Propose a team** (`#/account/team`) for captains.
  - A member with an approved link skips the question and sees the Yes state.
- [ ] AC-7: Signed in with a proposal or join request for the registration year: the page shows
  its status (same labels as `/account`) and the placed team when placed, with a link to
  `/account` to manage it. A declined request also offers **Remove request** via `/account`.
- [ ] AC-8: Load failure shows an error with **Try again**. Focus moves to the `<h1>` when the
  page mode changes.

**Coordinator**
- [ ] AC-9: In Admin > Requests, a join request card shows a warning when the member also has a
  submitted scorecard-name link: "Scorecard name link waiting: “{name}”. Review it first, or they
  are placed as {selfName}."

---

## Design Decisions (owner, 2026-10-06)

1. New `#/join` page rather than sending the button straight to `/account`.
2. Emailing the coordinator stays as a fallback line.
3. Returning shooters are prompted to link their scorecard name; a join request is not blocked
   on it.
4. Roster entries remain a name snapshot at placement; later profile name changes don't update
   a placed roster (the coordinator edits it in Team Management).
5. Off-season requests for next year stay allowed (`registrationYear()`).
6. Signed-in members see **My league** on the nav button. (Simplification: the label follows
   sign-in state, not placement, so the main bundle does no extra read.)

## Out of Scope

- Registered users as the roster source of truth (later project).
- Changing the email-link continue URL (stays the origin root, spec 008 DD-4).
