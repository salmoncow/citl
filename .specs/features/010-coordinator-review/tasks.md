# Task Breakdown: Coordinator Review (M3)

**Feature**: 010-coordinator-review
**Spec**: [spec.md](./spec.md)
**Status**: Groups 0–7 done (2026-10-03); Group 8 is owner ops

Each numbered group below is one commit, in implementation order. AC refs point to
[spec.md](./spec.md) §"Acceptance Criteria".

**Complexity legend**: S = <30min · M = 30min–2h · L = >2h

---

## Group 0 — Spec-Kit artifacts

**Commit**: `docs(league): add 010 coordinator review M3 spec`

- [x] **0.1 (M)** Write `spec.md`.
- [x] **0.2 (S)** Write `tasks.md`.

---

## Group 1 — Rules and rules tests

**Commit**: `feat(league): add captainChanges rules and allow clearing a declined registration`
**AC**: AC-17, AC-20

- [x] **1.1 (S)** `captainChanges/{leagueTeamId}`: read by `fromUid`, `toUid`, or
  owner/admin; no client writes.
- [x] **1.2 (S)** Registration delete while `submitted` or `declined`.
- [x] **1.3 (M)** `tests/rules/review.test.ts`: handoff reads and queries, declined delete,
  admin queue queries, member denial.

**Gate**: `npm run test:rules` green.

---

## Group 2 — Functions

**Commit**: `feat(league): add reviewRequest and captainHandoff callables, change requests`
**AC**: AC-6 – AC-15, AC-18, AC-21, AC-24

- [x] **2.1 (M)** `lib/publish.ts`: `replaceRoster`, `addToRoster`, `rosterFromTeam`,
  `PublishError` (pure, unit tested).
- [x] **2.2 (M)** `lib/members.ts`: eligibility, captaincy guard, team-to-proposal rebuild.
- [x] **2.3 (L)** `reviewRequest` + `review/{proposal,registration,link,captain}.ts`: one
  transaction per decision with its audit entry; admin only.
- [x] **2.4 (M)** `captainHandoff`: nominate by email, cancel, accept, decline.
- [x] **2.5 (M)** `teamProposal`: `reopen`; change-aware save and delete (discard).
- [x] **2.6 (S)** Inputs, audit kinds, rate limits; `deleteAccount` deletes the member's
  incoming handoffs.
- [x] **2.7 (L)** Function tests: `publish`, `reviewRequest`, `captainHandoff`.

**Gate**: `npm run test:functions` green.

---

## Group 3–5 — Client

**Commit**: `feat(league): add admin Requests tab, captain card, and roster change flow`
**AC**: AC-1 – AC-5, AC-16, AC-19, AC-20, AC-25, AC-26

- [x] **3.1 (M)** Types; `league-review-repository`; captaincy and handoff queries.
- [x] **3.2 (M)** `league-review-service` (queue, roster comparison, `review`); unit tests.
- [x] **3.3 (S)** `member-league-service`: `reopen`, `handoff`, `loadCaptaincy`; tests.
- [x] **4.1 (L)** Requests tab and card builders, lazy chunk; admin panel nav item.
- [x] **4.2 (S)** Lazy `<admin-panel>` in `main.ts` (DD-6).
- [x] **5.1 (M)** `<account-captain>`; placed/declined status and notes on `/account`.
- [x] **5.2 (M)** Team page change flow: "Request roster changes", "Discard changes".

**Gate**: `npx tsc --noEmit`, `npx eslint .`, `npx vitest run` green; main path <250 kB.

---

## Group 6 — Privacy, terms, flag

**Commit**: `feat(league): tie the privacy update and terms version to the league flag`
**AC**: AC-22, AC-23

- [x] **6.1 (S)** `/privacy` league lines when the flag is on.
- [x] **6.2 (S)** `TERMS_VERSION` follows the flag (DD-7); seed terms version.
- [x] **6.3 (S)** Deploy workflows pass `vars.VITE_LEAGUE_REQUESTS`.

---

## Group 7 — Documentation and fixes found in the walkthrough

- [x] **7.1 (S)** `registrationYear` targets the latest season until it is `complete`
  (an approval creates `seasons/{year}` without a status).
- [x] **7.2 (M)** (AC-27) `firestore-schema.md`, constitution 1.10.0, ADR-014,
  `firebase-deployment.md`, `build-system.md`, `CLAUDE.md`.

---

## Group 8 — Owner ops (after merge)

- [ ] **8.1 (S)** The merge deploy fails the IAM step for the two new callables and skips
  hosting. Run the invoker binding for `reviewrequest` and `captainhandoff`
  (`firebase-deployment.md` §"Adding a new callable function"), then re-run the failed job.
- [ ] **8.2 (S)** Walk through on a preview channel with `VITE_LEAGUE_REQUESTS=true`.
- [ ] **8.3 (S)** Set the repository variable `VITE_LEAGUE_REQUESTS=true` and re-run the
  production deploy. Every member is asked to re-accept the terms.
