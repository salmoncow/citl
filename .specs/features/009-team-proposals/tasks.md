# Task Breakdown: Team Proposals, Dependents, and Registration (M2)

**Feature**: 009-team-proposals
**Spec**: [spec.md](./spec.md)
**Status**: Not started (spec in review)

Each numbered group below is one commit, in implementation order. Commit a group only when
every box in it is checked and its validation gate passes. AC refs point to [spec.md](./spec.md)
§"Acceptance Criteria".

**Complexity legend**: S = <30min · M = 30min–2h · L = >2h

---

## Group 0 — Spec-Kit artifacts

**Commit**: `docs(league): add 009 team proposals M2 spec and tasks`

- [x] **0.1 (M)** Write `spec.md`.
- [x] **0.2 (S)** Write `tasks.md`.

---

## Group 1 — Rules and rules tests

**Commit**: `feat(league): add rules for league teams, proposals, dependents, registrations, links`
**AC**: AC-2, AC-3, AC-11, AC-13, AC-15, AC-20

- [ ] **1.1 (M)** `firestore.rules`: `leagueTeams`, `teamProposals` (read only), and
  `shooterLinks` (read only) matches.
- [ ] **1.2 (M)** Dependents match, replacing the M1 deny; reuse `isValidNamePart`.
- [ ] **1.3 (M)** `registrations` match with the doc-id, year, proposal `exists()`, and profile
  `exists()` checks.
- [ ] **1.4 (S)** `shooterLinkRequests` match.
- [ ] **1.5 (L)** `tests/rules/league.test.ts` and `tests/rules/dependents.test.ts` per
  §Testing Checklist. Update the `profiles.test.ts` dependents-deny case.

**Gate**: `npm run test:rules` green.

---

## Group 2 — Functions and function tests

**Commit**: `feat(league): add teamProposal callable, real captain guard, delete cascade`
**AC**: AC-4 – AC-9, AC-17, AC-18, AC-21

- [ ] **2.1 (M)** `lib/roster.ts`: slug (parity with the client), entry resolution, roster
  checks, `minorDisplayName`.
- [ ] **2.2 (S)** `lib/validate.ts`: `teamProposalInput` discriminated union.
- [ ] **2.3 (L)** `teamProposal.ts`: guards, one transaction per action, audit on submit and
  withdraw, rate limit `teamProposal` 60/hr. Export from `index.ts`.
- [ ] **2.4 (S)** `lib/audit.ts`: `kind: 'proposal'` entry shape.
- [ ] **2.5 (S)** `lib/captainGuard.ts`: `leagueTeams` query.
- [ ] **2.6 (M)** `deleteAccount.ts`: cascade over proposals, registrations, link request, and link.
- [ ] **2.7 (L)** `tests/functions/teamProposal.test.ts`, plus additions to `deleteAccount` and
  `setAccountStatus` tests and `lib/roster.ts` unit tests.

**Gate**: `npm run test:functions` green; functions `tsc` clean.

---

## Group 3 — Backfill and seed

**Commit**: `feat(league): add league team backfill script and emulator seed`
**AC**: AC-1

- [ ] **3.1 (M)** `scripts/backfill-league-teams.js` (`--dry-run`, idempotent, never writes
  `seasons/**`).
- [ ] **3.2 (S)** `scripts/seed-emulator.js`: league teams, one dependent, one draft proposal,
  one registration, one link request; add the new collections to `SEEDED_COLLECTIONS`.

**Gate**: run the backfill twice against the seeded emulator; the second run reports no
changes.

---

## Group 4 — Client data layer

**Commit**: `feat(league): add league types, repositories, validation, and services`
**AC**: AC-19, AC-20

- [ ] **4.1 (S)** `src/types/league.ts`.
- [ ] **4.2 (M)** `league-repository.ts`, `dependent-repository.ts`, and factory getters.
- [ ] **4.3 (M)** `league-validation.ts` and its unit tests.
- [ ] **4.4 (M)** `member-league-service.ts`, `shooter-directory.ts`, `app-services.ts`, and
  unit tests.

**Gate**: `npm run typecheck`, `npm test` green.

---

## Group 5 — Account page League section

**Commit**: `feat(league): add dependents, registration, and shooter link to account page`
**AC**: AC-12, AC-14, AC-16, AC-21 – AC-23

- [ ] **5.1 (M)** `account-dependents.ts`.
- [ ] **5.2 (M)** `registration-form.ts`.
- [ ] **5.3 (M)** `shooter-link-form.ts`; move `attachAutocomplete` to `name-suggest.ts`.
- [ ] **5.4 (M)** `account-league.ts`, mounted in `account-page.ts` behind
  `VITE_LEAGUE_REQUESTS`; add the variable to `.env.example`.
- [ ] **5.5 (S)** `account.css` additions (tokens only).

**Gate**: `/check` clean; emulator walkthrough of the section.

---

## Group 6 — Roster builder

**Commit**: `feat(league): add team proposal roster builder`
**AC**: AC-10, AC-22, AC-23

- [ ] **6.1 (S)** Route `/account/team` (lazy) and `src/views/account-team.ts`; account gate
  coverage.
- [ ] **6.2 (L)** `team-proposal-page.ts`: team source, name, actions, read-only state.
- [ ] **6.3 (L)** `roster-entry-list.ts`: entry kinds, rookie/minor/guardian, "Start from
  {year} roster".
- [ ] **6.4 (S)** Bundle measurement (method in `build-system.md`).

**Gate**: `/check` clean; emulator walkthrough per §Testing Checklist.

---

## Group 7 — Documentation

**Commit**: `docs(league): update schema, constitution 1.9.0, ADR-013`
**AC**: AC-24

- [ ] **7.1 (M)** `firestore-schema.md`: new collections, audit kind, dependents.
- [ ] **7.2 (S)** Constitution §II.5 schema list and §VI.1 justified functions; version 1.9.0.
- [ ] **7.3 (S)** ADR-013 "Persistent league teams and member requests".
- [ ] **7.4 (S)** `CLAUDE.md` Key Files; this file's status.

---

## Group 8 — Owner ops (with M3 deploy)

- [ ] **8.1 (S)** Run `backfill-league-teams.js --dry-run` against prod; the owner checks the
  team ids per season (DD-5).
- [ ] **8.2 (S)** Run the backfill against prod.
- [ ] **8.3 (S)** Deploy functions and rules. Run the one-time invoker binding for
  `teamproposal` (`firebase-deployment.md` §"Adding a new callable function").
- [ ] **8.4 (S)** Set `VITE_LEAGUE_REQUESTS=true` when M3 deploys; walk through on a preview
  channel first.
