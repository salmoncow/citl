# Task Breakdown: Email Notifications (M4)

**Feature**: 011-email-notifications
**Spec**: [spec.md](./spec.md)
**Status**: Groups 0–6 done (2026-10-06); Group 7 owner ops done except 7.5

Each numbered group below is one commit, in implementation order. AC refs point to
[spec.md](./spec.md) §"Acceptance Criteria".

**Complexity legend**: S = <30min · M = 30min–2h · L = >2h

---

## Group 0 — Spec-Kit artifacts

**Commit**: `docs(mail): add 011 email notifications M4 spec`

- [x] **0.1 (M)** Write `spec.md`.
- [x] **0.2 (S)** Write `tasks.md`.
- [x] **0.3 (M)** `infra/aws/ses.yaml`, `aws-infrastructure.md`, ADR-015, constitution 1.11.0,
  CI `Infrastructure Lint` job (owner chose CloudFormation, `us-east-1`).

---

## Group 1 — Rules and config

**Commit**: `feat(mail): add notification settings rules, mail TTL, and unsubscribe rewrite`
**AC**: AC-1, AC-7, AC-11, AC-19, AC-22, AC-23

- [x] **1.1 (S)** `notificationSettings/{uid}` self read/write with key and type checks.
- [x] **1.2 (S)** Deny blocks for `mail`, `notifications`, `config/mailDigest`.
- [x] **1.3 (S)** TTL override on `mail.expireAt`; `/unsubscribe` rewrite.
- [x] **1.4 (M)** `tests/rules/notifications.test.ts`.

**Gate**: `npm run test:rules` green.

---

## Group 2 — Mail core

**Commit**: `feat(mail): add SES sender, templates, and signed unsubscribe`
**AC**: AC-4 – AC-10

- [x] **2.1 (M)** Add `@aws-sdk/client-sesv2`, `@aws-sdk/credential-providers`; `mail/ses.ts`
  (metadata ID token → `fromWebToken` for `SES_ROLE_ARN`; emulator log transport).
- [x] **2.2 (M)** `mail/templates.ts`: per-kind subject, text, HTML; escaping; footers.
- [x] **2.3 (M)** `sendMail`: claim, recipient checks, send, retry/fail handling.
- [x] **2.4 (M)** `lib/unsubscribeToken.ts`, `unsubscribe` (GET page, POST apply).
- [x] **2.5 (M)** Tests with a fake transport.

**Gate**: `npm run test:functions` green.

---

## Group 3 — Topic emails

**Commit**: `feat(mail): email subscribers on announcements, week publish, and date changes`
**AC**: AC-11 – AC-14

- [x] **3.1 (M)** `lib/fanout.ts`: dedupe claim, recipient query, batched mail writes.
- [x] **3.2 (M)** `onAnnouncementCreated`, `onWeekPublished`, `onSeasonUpdated` with guards.
- [x] **3.3 (M)** Tests for each guard and the combined schedule email.

---

## Group 4 — Status emails and digest

**Commit**: `feat(mail): email members about decisions and admins about new requests`
**AC**: AC-15 – AC-20

- [x] **4.1 (S)** `lib/mailQueue.ts`.
- [x] **4.2 (M)** `queueMail` calls in `review/*.ts` and `captainHandoff.ts`.
- [x] **4.3 (M)** `requestDigest` and `config/mailDigest`.
- [x] **4.4 (M)** Tests: one mail per outcome; none on failure; digest on and off.

---

## Group 5 — Client

**Commit**: `feat(mail): add email preferences to the account page`
**AC**: AC-2, AC-3, AC-12, AC-21, AC-27

- [x] **5.1 (S)** Types, `notification-repository`, `notification-service`; unit tests.
- [x] **5.2 (M)** `<account-email>` card; prompt for members with no settings.
- [x] **5.3 (S)** Topic checkboxes in profile completion.
- [x] **5.4 (S)** **Email subscribers** checkbox in the announcements tab.
- [x] **5.5 (S)** `/privacy` email section.

**Gate**: `npx tsc --noEmit`, `npx eslint .`, `npx vitest run` green; main path <250 kB.

---

## Group 6 — Documentation

**Commit**: `docs(mail): record SES email notifications`
**AC**: AC-24

- [x] **6.1 (M)** `firestore-schema.md`; `firebase-deployment.md` (the secret, `SES_ROLE_ARN`,
  first deploy); constitution §II.5, §VI.1; `CLAUDE.md` Key Files.

---

## Group 7 — Owner ops

- [x] **7.1 (S)** Deploy stack `citl-mail` and enable termination protection
  ([aws-infrastructure.md](../../technical/aws-infrastructure.md) §First deploy); send the
  `SenderRoleArn` output.
- [x] **7.2 (S)** Request SES production access (same doc, §Manual actions).
- [x] **7.3 (S)** Set the secret `UNSUBSCRIBE_SECRET` (`firebase functions:secrets:set`).
- [x] **7.4 (S)** Before merging the build: deploy the six functions from the PR branch with
  owner credentials, then run the invoker binding for `unsubscribe` (public: `allUsers`). The
  first deploy enables the Eventarc and Cloud Scheduler APIs.
- [ ] **7.5 (S)** Preview walkthrough to the sandbox test address; then merge.
