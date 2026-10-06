# Feature: Email Notifications (Milestone M4)

**Feature ID**: 011-email-notifications
**Created**: 2026-10-04
**Status**: Implemented, for owner review (stack `citl-mail` deployed 2026-10-05)
**Program**: Member accounts — M1 accounts and profile ([spec 008](../008-public-accounts/spec.md),
shipped) · M2 member requests ([spec 009](../009-team-proposals/spec.md), shipped) · M3
coordinator review ([spec 010](../010-coordinator-review/spec.md), shipped) · **M4 email
notifications (this spec)**.
**Tasks**: [tasks.md](./tasks.md)

---

## Overview

Members learn about results, schedule changes, news, and their own requests only by visiting the
site. M4 sends email through Amazon SES from `mail.citl.club`.

1. **Preferences** (F15): an **Email** card on `/account` with three topics: league news, score
   results, schedule changes. Admins also get **New requests**. Every topic email carries a
   one-click unsubscribe link.
2. **Topic emails** (F16): an announcement posted with **Email subscribers** checked, the first
   publication of a week's results, and a change to a future week's date each send one email to
   that topic's subscribers.
3. **Status emails** (F16): each M3 decision and each handoff step emails the member it affects,
   written in the same transaction as the decision.
4. **Coordinator digest** (F16): one daily email to admins subscribed to **New requests** when
   requests were submitted since the last digest.

All email passes through one queue (`mail/{id}`) and one sender function. Minors have no
accounts and receive nothing; no email names a minor.

---

## User Stories

**Member**
- I choose which league emails I get on `/account`, and I can stop a topic from the email itself
  without signing in.
- I get an email when my proposal, join request, or scorecard-name link is decided, with the
  coordinator's note, and when I'm nominated as captain.
- A captain gets an email when the nominee responds and when the coordinator decides the handoff.

**Coordinator**
- Posting an announcement can email it to subscribers; I uncheck the box for a minor notice.
- Publishing a week and moving or cancelling a shoot date email subscribers with no extra step.
- I get one morning email listing new requests, instead of checking the Requests tab daily.

**Negative scenarios**
- A deactivated member gets no email of any kind. A deleted member's settings are gone.
- Republishing a week, editing an announcement, or re-saving the same date override sends nothing.
- Writes by import or seed scripts to past seasons send nothing.
- A forged or altered unsubscribe link changes nothing.
- A member can't read or write another member's settings or any queued mail.

---

## Acceptance Criteria

**F15 — Preferences and unsubscribe**
- [ ] AC-1: `notificationSettings/{uid}` holds `topics: { news, scores, schedule, requests }`
  (booleans, all optional, missing means off) and `updatedAt`. Rules: read and write by self
  only; keys limited to `topics` and `updatedAt`; topic values are booleans; `updatedAt ==
  request.time`; no delete. Server writes (unsubscribe, account delete) use the Admin SDK.
- [ ] AC-2: `/account` has an **Email** card (in the `/account` chunk): one checkbox per topic
  with a one-line description, the address mail goes to (the account email, read-only), and
  **Save**. **New requests** shows for admins and owners only.
- [ ] AC-3: Profile completion (first sign-in) shows the three member topics, checked; saving the
  profile writes the settings doc. Members who completed their profile before M4 start with no
  topics and see a one-line prompt on the Email card until they save it once.
- [ ] AC-4: Every topic email has an unsubscribe link and the headers `List-Unsubscribe:
  <https://citl.club/unsubscribe?…>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
  (RFC 8058). The link carries `uid`, `topic`, and `sig = HMAC-SHA256(UNSUBSCRIBE_SECRET,
  uid + ':' + topic)` (base64url).
- [ ] AC-5: `unsubscribe` (HTTPS function, `us-central1`, hosting rewrite `/unsubscribe`):
  `GET` with a valid signature returns a small page naming the topic and a **Unsubscribe** button
  (a POST form, so link scanners don't unsubscribe); `POST` with a valid signature sets that
  topic to `false` (merge) and returns a confirmation page linking to `/account`. An invalid
  signature returns 400 and writes nothing. Repeating a POST is harmless. A link for a deleted
  account writes nothing (the settings doc is not recreated).
- [ ] AC-6: Status emails and the digest footer link to `/#/account` instead of carrying an
  unsubscribe link (status emails answer the member's own request; see Decision 3).

**F16 — Queue and sender**
- [ ] AC-7: `mail/{id}` holds `uid`, `kind` (`news | scores | schedule | status |
  digest`), `topic` (topic emails only), the content (`subject`, `paragraphs`, optional `link`),
  `status` (`pending | sending | sent | failed | skipped`), `attempts`, `error`, `createdAt`,
  `expireAt` (`createdAt` + 30 days, a Firestore TTL field), and on send `to` and `sentAt`.
  Text and HTML are rendered at send time, so the address and footer always reflect the
  member's current account. Rules deny all client access.
- [ ] AC-8: `sendMail` (Firestore `onDocumentCreated('mail/{id}')`, `retry: true`,
  `maxInstances: 2`, parameter `SES_ROLE_ARN`, secret `UNSUBSCRIBE_SECRET`; AWS credentials
  per DD-8): in a transaction it claims the doc (`pending` → `sending`, or a
  `sending` doc older than 10 minutes); re-reads `users/{uid}` and skips (`skipped`) a missing
  or deactivated member, and for a topic email skips a member whose topic is now off; sends one
  SESv2 `SendEmail` with configuration set `citl-mail` (From `Central Illinois Trap League
  <news@mail.citl.club>`, Reply-To
  `LEAGUE_EMAIL`, text and HTML parts, the AC-4 headers for topic mail); sets `sent`. SES
  throttling or 5xx throws so the event retries (up to 5 attempts, then `failed`); any other SES
  error sets `failed` with the message. A doc not in `pending`/stale `sending` is ignored.
  `SES_ROLE_ARN` is a non-secret param set in `functions/.env.citl-baed2`.
- [ ] AC-9: In the emulator `sendMail` logs the message instead of calling SES and needs no
  AWS role or secret.
- [ ] AC-10: Bodies are built by pure template functions in `functions/src/mail/templates.ts`:
  plain text plus a single-column HTML version with escaped content, the CITL name, the message,
  a link to the relevant page, and the footer (AC-4 or AC-6). No images, tracking pixels, or
  external CSS.

**F16 — Topic emails (fan-out)**
- [ ] AC-11: Fan-out (`lib/fanout.ts`) queries `notificationSettings` where `topics.{topic} ==
  true`, reads the matching `users/{uid}` docs with `getAll` (chunks of 100), drops deactivated
  members and those without an email, and writes one `mail` doc per recipient in batches of 400.
  It first creates `notifications/{key}` (`create()`, so a second run with the same key stops).
  `notifications/{key}` holds `topic`, `recipients`, `createdAt`; rules deny client access.
- [ ] AC-12: **News**: `onAnnouncementCreated` (`announcements/{id}`) fans out to `news` when the
  doc has `email: true` and `year` is the current calendar year. Key `news_{id}`. Subject is the
  title; body is the announcement text and a link to the Home page. The admin announcement form
  gains an **Email subscribers** checkbox, checked by default, stored as `email`.
- [ ] AC-13: **Scores**: `onWeekPublished` (`seasons/{year}/weeks/{n}` created) fans out to
  `scores` when `seasons/{year}.status` is not `complete` (an approval creates the season doc
  without a status), `year` is the current calendar year, and
  `publishedAt` is within the last 24 hours. Key `scores_{year}_{n}`. Subject "Week {n} results
  are posted"; body lists the week's top three teams by targets and links to Standings and
  Scorecards. A republish rewrites existing week docs and fires nothing.
- [ ] AC-14: **Schedule**: `onSeasonUpdated` (`seasons/{year}` updated, same season guards)
  compares `weekDateOverrides` before and after and ignores every other field. For each week
  number after `currentWeek` whose value changed, it builds one line: "Week {n} moves to {date}",
  "Week {n} is cancelled", or "Week {n} is back on its regular date". All changed weeks in one
  update go in one email. Key `schedule_{year}_{eventId}` (the Firestore event id), so a
  retried event sends nothing while a later identical change still does; re-saving the same
  values changes nothing and sends nothing. No change after `currentWeek` sends nothing. The
  three topic triggers live in one file, `topicEmails.ts`.

**F16 — Status emails**
- [ ] AC-15: `lib/mailQueue.ts` `queueMail(tx, db, uid, content, kind)` writes a `mail` doc
  inside the caller's transaction, so a decision and its email commit together. It reads
  nothing; the sender applies the AC-8 checks.
- [ ] AC-16: `reviewRequest` queues, to the requesting member:
  - proposal approved, rejected, or changes requested (with the note); change request approved
    or rejected;
  - registration placed (team name) or declined (with the note);
  - scorecard-name link approved (the linked name) or declined;
  - captain change approved or rejected: to the nominee and the previous captain;
  - remove captain: to the removed captain.
- [ ] AC-17: `captainHandoff` queues: `nominate` → nominee (team, captain's name, link to
  `/account`); `cancel` → nominee; `accept` and `decline` → the nominating captain.
- [ ] AC-18: Status emails never include rosters, other members' emails, or minors' names.
  Recipient addresses come from `users/{uid}.email`, read by `sendMail` at send time.

**F16 — Coordinator digest**
- [ ] AC-19: `requestDigest` (scheduled, daily 07:00 America/Chicago) reads the four queue
  queries the Requests tab uses, keeps items submitted or updated since `config/mailDigest.lastRunAt`
  (first run: last 24 hours), and when any remain queues one email per admin/owner subscribed to
  `requests`: counts per type and a link to `/#/admin`. It then sets `lastRunAt`. Nothing new,
  no email. `config/mailDigest` is server-only (explicit deny block, per the F-53 note).

**Account lifecycle, privacy, operations**
- [ ] AC-20: `deleteAccount` already deletes `notificationSettings/{uid}` (spec 008); its test
  covers a populated doc. Queued mail for a deleted or deactivated member is skipped at send.
- [ ] AC-21: `/privacy` states that the league emails members through Amazon SES (its processor),
  what each topic sends, that status emails follow member requests, that unsubscribing is one
  click, and that sent mail records are deleted after 30 days. No terms re-acceptance
  (Decision 4).
- [ ] AC-22: `firestore.indexes.json` adds the TTL field override on `mail` `expireAt`. The
  `topics.{topic} ==` query uses the automatic single-field index.
- [ ] AC-23: `firebase.json` adds the `/unsubscribe` rewrite to the `unsubscribe` function
  before the SPA catch-all.
- [ ] AC-24: `firebase-deployment.md` documents the SES setup (AC-25), the `SES_ROLE_ARN` param and `UNSUBSCRIBE_SECRET` secret, and
  the first deploy of the new functions; ADR-015 records the SES choice and the queue design;
  constitution §I.2 (1.11.0, with the stack), §II.5, §VI.1 (1.12.0), `firestore-schema.md`, and `CLAUDE.md` Key
  Files are updated.
- [ ] AC-25: AWS resources are the CloudFormation stack `citl-mail` from `infra/aws/ses.yaml`
  (ADR-015; [aws-infrastructure.md](../../technical/aws-infrastructure.md)): SES identity
  `mail.citl.club` with DKIM, MAIL FROM `bounce.mail.citl.club`, DMARC `p=none`,
  configuration set `citl-mail` suppressing bounces and complaints, the send-only role
  `citl-ses-sender`, and an SES budget alert. The owner deploys it and requests SES production
  access before production sends.

**Tests, cost**
- [ ] AC-26: The tests in §Testing Checklist pass, and all existing tests still pass.
- [ ] AC-27: New UI meets §III.6 in light and dark mode at 360px or wider; the main bundle stays
  within §III.4 (the Email card is in the `/account` chunk; the admin checkbox in the lazy admin
  panel).

---

## Constitutional Constraints

- **§I.2 (platforms)**: AWS is already the league's DNS host; SES adds a service there, not a new
  vendor. Firebase and Google Cloud have no general-purpose email sending. ADR-015 records AWS
  as the third platform, limited to Route 53 and SES, managed as CloudFormation.
- **§VI.1 (functions)**: six new functions (DD-2). Volume per season: about 40 fan-outs, a few
  dozen status emails, and up to 4,000 sends. SES costs $0.10 per 1,000, about $0.40 a season;
  invocations and writes stay inside the free tier.
- **§III.2**: all mail is written server-side; rules deny `mail`, `notifications`, and
  `config/mailDigest`. Settings are self-only. Unsubscribe is signed; the secret never reaches
  the client.
- **§II.3 / §II.4**: `components → services → repositories` for the settings card; files under
  500 lines.
- **ADR-006**: the scoring engine is unchanged; triggers only read published week docs.

---

## Architecture Approach

### Layer assignments

| Layer | Files | Change |
|-------|-------|--------|
| Types | `src/types/notifications.ts` (new), `src/types/announcement.ts` | `NotificationTopics`; `email?` on announcements |
| Repositories | `src/repositories/notification-repository.ts` (new) | get/set own settings |
| Services | `src/services/notification-service.ts` (new) | defaults, save |
| Components | `src/components/account-email.ts` (new) | Email card |
| Components | `account-profile-form.ts`, `admin-tabs/announcements-tab.ts` | topic checkboxes at completion; **Email subscribers** |
| Views | `src/views/privacy.ts` | email section |
| Server | `functions/src/mail/{types,config,templates,builders,ses}.ts` (new) | content builders, templates, SES client |
| Server | `functions/src/lib/{mailQueue,fanout,unsubscribeToken}.ts` (new) | outbox write, fan-out, HMAC |
| Server | `functions/src/{sendMail,unsubscribe,topicEmails,requestDigest}.ts` (new) | function entry points (`topicEmails.ts` holds the three topic triggers) |
| Server | `functions/src/review/*.ts`, `captainHandoff.ts` | `queueMail` calls |
| Config | `firestore.rules`, `firestore.indexes.json`, `firebase.json` | rules, TTL, rewrite |
| Deps | `functions/package.json` | `@aws-sdk/client-sesv2`, `@aws-sdk/credential-providers` |
| Infra | `infra/aws/ses.yaml` | CloudFormation stack `citl-mail` (in place before the build) |

### Data model changes

| Path | Change |
|------|--------|
| `notificationSettings/{uid}` | first used (AC-1); self read/write |
| `mail/{id}` | new queue (AC-7), server-only, TTL 30 days |
| `notifications/{key}` | new fan-out dedupe record (AC-11), server-only |
| `config/mailDigest` | new, `lastRunAt` (AC-19), server-only |
| `announcements/{id}` | adds `email: boolean` |

Indexes: none composite. One TTL field override.

---

## Design Decisions

**DD-1 — Our own sender instead of the Trigger Email extension.** The 2026-09-30 decision named
the Firebase Trigger Email extension. A ~100-line `sendMail` function on the SESv2 API does the
same job with fewer moving parts: no extension deploy from CI (another service-account
permission set), no SMTP credentials, per-recipient unsubscribe headers built in code, the
deactivated/topic checks at send time, and full test coverage with a fake transport. The queue
shape stays the same, so switching to the extension later means only changing the doc fields.

**DD-2 — Six functions.** One sender, one public unsubscribe endpoint, three triggers (one per
source event; Firestore triggers are one function each), and one scheduled digest. Merging the
triggers into a callable the admin clicks was rejected: it adds a step the coordinator can
forget, and the exit criteria call for one email per publish and per announcement.

**DD-3 — One queue for all mail.** Status emails are written in the decision's transaction (an
outbox), so an approval can't commit without its email or send one for a decision that rolled
back. Fan-out writes the same docs. The sender is the only code that talks to SES, the only place
retries and throttling live, and its doc status is the delivery log.

**DD-4 — Guards against unwanted sends.** Triggers fire on any write, including seed and import
scripts. Each trigger requires the current calendar year (and a season not marked complete, and a fresh
`publishedAt` for scores), and each fan-out claims a `notifications/{key}` doc with `create()`
first, so a retried or repeated event sends once.

**DD-5 — Signed unsubscribe links, no sign-in.** A stateless HMAC over `uid:topic` lets a member
stop a topic from any device. GET shows a confirm button because mail scanners follow links;
POST performs it and also serves RFC 8058 one-click from mail clients. Rotating the secret
invalidates old links, which is acceptable.

**DD-6 — Bounces and complaints use SES suppression.** The `citl-mail` configuration set stops sending to
addresses that bounced or complained without an SNS webhook. Volume is too low to need more.

**DD-7 — Admin notice is a daily digest.** Registrations and link requests are client writes, so
per-request emails would need two more triggers. The digest covers all four request types from
the queries the Requests tab already runs, and sends nothing on quiet days.

**DD-8 — AWS credentials by web identity federation, not keys.** `sendMail` gets a
Google-signed ID token for its service account from the metadata server and exchanges it with
STS `AssumeRoleWithWebIdentity` (`@aws-sdk/credential-providers` `fromWebToken`) for one-hour
credentials for `citl-ses-sender`, cached until near expiry. The role trusts only that service
account's numeric ID and may only send from `news@mail.citl.club`. No AWS key is stored
anywhere (constitution §III.2, ADR-015).

---

## Implementation Plan

Ordered groups (one commit each) are in [tasks.md](./tasks.md):
1. Rules, TTL, rewrite, and rules tests.
2. Mail core: templates, SES client, `sendMail`, `unsubscribe`, tokens, tests.
3. Topic triggers and fan-out, tests.
4. Status emails in `reviewRequest` and `captainHandoff`; digest; tests.
5. Client: Email card, completion checkboxes, announcement checkbox, privacy.
6. Documentation.
7. Owner ops: SES and DNS setup, secrets, first deploy of the new functions, preview walkthrough.

---

## Accessibility (§III.6)

- The Email card is a `<fieldset>` with a `<legend>`; each checkbox has a visible label and a
  description tied with `aria-describedby`. The save result uses the existing toast live region.
- Email HTML uses real headings, link text that names the destination, and enough contrast in
  both light and dark mail clients (no background colours on body text). The plain-text part is
  complete on its own.
- The unsubscribe pages are plain HTML with one heading and one button.

---

## Testing Checklist

**Rules** (`tests/rules/notifications.test.ts`, about 10 cases)
- [ ] Settings: self read and write allowed; another member, admin, and anon denied; unknown key,
  non-boolean topic, wrong `updatedAt`, and delete denied.
- [ ] `mail`, `notifications`, `config/mailDigest`: every client read and write denied.

**Functions**
- [ ] `unsubscribeToken`: sign and verify; wrong uid, topic, or signature fails.
- [ ] `unsubscribe`: GET page, POST sets the topic off, bad signature 400, wrong method 405.
- [ ] `templates`: each kind's subject, text, and HTML; HTML escapes input; footer by kind.
- [ ] `sendMail` (fake SES): sent; skipped for deactivated, missing user, topic off; throttling
  rethrows; permanent error `failed`; claimed doc ignored; headers on topic mail only.
- [ ] Fan-out: recipients filtered, one doc each, second run with the same key writes nothing.
- [ ] Triggers: each guard (`email` false, past year, inactive season, stale `publishedAt`,
  republish, override unchanged or on a past week); the combined schedule email.
- [ ] Status: each AC-16/AC-17 outcome queues one mail to the right uid; a failed decision
  queues none.
- [ ] Digest: new items → one mail per subscribed admin and `lastRunAt` moves; none → no mail.

**Client unit**
- [ ] `notification-service`: defaults, admin-only topic, save payload.

**Manual / E2E**
- [ ] Emulator: post an announcement, publish a week, move a date, approve a proposal, nominate a
  captain; the `sendMail` log shows each message once. Unsubscribe via GET and POST.
- [ ] Preview channel with SES in sandbox to a verified address: receive each kind; Gmail shows
  the unsubscribe button and SPF/DKIM/DMARC pass.
- [ ] Keyboard pass of the Email card at 360px, light and dark.

---

## Assumptions

1. The league has about 100–150 adult members; SES production access allows 14 sends a second,
   and `maxInstances: 2` with retries stays under it.
2. `users/{uid}.email` is the address to use; members can't change it on the site (Google and
   email-link accounts).
3. The admin publish flow creates `weeks/{n}` only on first publication and rewrites existing
   week docs on republish (spec 005 DD-3).
4. Schedule overrides are edited by the admin through `seasons/{year}.weekDateOverrides` only.

## Decisions for the owner (all six accepted 2026-10-04)

1. **Sender**: our own `sendMail` function on the SES API rather than the Trigger Email
   extension (DD-1).
2. **Defaults**: new members get the three topics pre-checked at profile completion; existing
   members start with none and see a prompt. Alternative: opt everyone in and announce it.
3. **Status emails** have no opt-out; they answer the member's own request. Alternative: a
   fourth member topic "My requests".
4. **Privacy update without terms re-acceptance**: the privacy page gains the email section;
   members are not asked to accept again.
5. **Newsletter** is an announcement with **Email subscribers** checked; no separate composer.
   Alternative: an email-only compose form in the admin panel.
6. **From address** `news@mail.citl.club`, Reply-To the league email (`src/utils/contact.ts`).

---

## Out of Scope / Forward Compatibility

- An admin view of the mail log (the Firestore console shows `mail` docs for 30 days).
- SMS, push notifications, and email digests of scores.
- Bounce webhooks (SNS); per-team or per-captain mailing lists.
