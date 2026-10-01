# Feature: Public Accounts and Profile (Milestone M1)

**Feature ID**: 008-public-accounts
**Created**: 2026-10-01
**Status**: Draft (not started)
**Program**: Member accounts — M1 *Accounts and profile* (this spec) · M2 team proposals and
rosters · M3 coordinator review/approval and captain handoff · M4 email notifications (Amazon
SES). Only M1 is specified here; M2–M4 appear only as forward-compatibility notes.
**Tasks**: [tasks.md](./tasks.md)

---

## Overview

Today any visitor can technically sign in, but only through the hidden `/admin` route, only
with Google, and only to be told "no admin access". Spec 002 already seeds every new Auth user
into `users/{uid}` with role `user` ([`functions/src/onUserCreate.ts`](../../../functions/src/onUserCreate.ts)),
so the account substrate exists; there is just no member-facing surface on top of it.

M1 makes accounts a first-class public feature: a **Sign in** control in the site nav for any
visitor; three sign-in methods (Google, Microsoft, passwordless email link) with
account linking; a new **`/account`** page (profile, linked sign-in methods, sign out,
deactivate, delete); a member-editable **`profiles/{uid}`** document separate from the locked
RBAC mirror; a first-sign-in completion step that records terms/privacy acceptance and an
18+ attestation; and two new callables (`setAccountStatus`, `deleteAccount`) for the
server-authoritative status changes, both audited. Published scores are never touched.

M1 ships no league-participation features. Its job is to give M2 (rosters, dependents) a
verified adult account, a profile, and a status flag to build on.

---

## User Stories

**Visitor (signed out)**
- As a visitor, I see a **Sign in** button in the site nav on every page, so I don't need to
  know about `/admin`.
- As a visitor, I can sign in with Google, Microsoft, or an emailed sign-in link, so I
  can use whichever account I already have.
- As a visitor who opens `/#/account`, I see the same sign-in options instead of an error.

**Member (role `user`)**
- As a first-time member, I'm asked for my name (and optionally a phone number) and must accept
  the terms/privacy policy and confirm I'm 18 or older before using my account.
- As a member, I can edit my display name and phone on `/account`.
- As a member, I can see which sign-in methods are linked, link another one, and unlink one,
  but I can't unlink the last one.
- As a member who signed in with a new method for an email that already has an account, I'm
  guided to sign in with my original method, and the new method is then linked automatically.
- As a member, I can deactivate my account, and I can reactivate it later by signing in and
  confirming.
- As a member, I can permanently delete my account. My name stays on published scorecards
  because they are the league record.

**Admin / owner**
- As an admin or owner, I see an **Admin** link in the nav. Members never see it.
- As an owner/admin, I see each user's account status in the Users tab.
- As the owner, I can read status changes (deactivate / reactivate / delete) in `audit/` next
  to role changes.

**Negative scenarios**
- A member writing `users/{uid}.status` directly through the SDK is rejected by rules.
- A member writing an extra field (e.g. `role`) or an over-long name to `profiles/{uid}` is
  rejected by rules.
- A deactivated member's profile writes are rejected until they reactivate.
- A deleted member's still-valid ID token (≤1 h) cannot recreate `profiles/{uid}`, because the
  rules require the `users/{uid}` mirror to exist.
- Delete with a stale sign-in (older than 5 min) returns `failed-precondition` /
  `requires-recent-login`, and the client re-authenticates first.

---

## Acceptance Criteria

**F1 — Public sign-in and role-aware nav**
- [ ] AC-1: The site header shows **Sign in** (a button that opens the sign-in dialog) when
  signed out, and **Account** (a link to `#/account`) when signed in, on every route and at
  every width ≥ 360px, including inside the burger menu.
- [ ] AC-2: An **Admin** nav link (header, plus the existing footer link) appears only when the
  token claim `role` is `owner` or `admin`. It is hidden when signed out and for `user`.
- [ ] AC-3: The `/admin` sign-in gate opens the same sign-in dialog (all enabled providers).
  The existing `/admin` route guard and lazy `<admin-panel>` mount behave as before.

**F2 — Providers and linking**
- [ ] AC-4: Google and Microsoft (`microsoft.com`, tenant `common`) sign in by popup. Email link sends a link with `handleCodeInApp: true`
  and completes on return. The enabled set comes from `VITE_AUTH_PROVIDERS` (see Assumptions).
- [ ] AC-5: Email-link completion runs once at app boot, before router init. It uses the email
  stored in `localStorage`, or asks for the email if the link was opened on another device.
  It then clears the stored email and rewrites the URL to `/#/account` with `history.replaceState`,
  so the one-time code never stays in history.
- [ ] AC-6: `auth/account-exists-with-different-credential` is handled. The pending credential
  is held in memory, and the user is asked to sign in with a method they used before. After
  that sign-in succeeds, `linkWithCredential` attaches the pending credential and a success toast
  shows. The flow doesn't use `fetchSignInMethodsForEmail`, because email enumeration protection
  stays on.
- [ ] AC-7: On `/account` the user can link any enabled provider that isn't linked yet (popup
  link; email link via a sent link plus a `link` intent) and unlink a linked one. Unlink is
  disabled, with an explanation, when only one provider is linked.

**F3 — Account page**
- [ ] AC-8: The `/account` route shows the sign-in view when signed out. When signed in it shows
  a `.skeleton` placeholder, then three sections: Profile, Sign-in methods, Account (sign out,
  deactivate, delete). It shows an error state if the profile load fails.
- [ ] AC-9: The account and sign-in UI is code-split (dynamic `import()`), and the main JS bundle
  stays under the §III.4 budget, measured with the method in `build-system.md`.

**F4 — Profile and first-sign-in completion**
- [ ] AC-10: A signed-in user with no `profiles/{uid}` doc is sent to `/account` in completion
  mode from any route except `/privacy`, until they submit. They can still sign out.
- [ ] AC-11: Completion collects display name (required, 1–60 chars after trim) and phone
  (optional, ≤ 20 chars, digits/space/`+()-.`). It also requires two checkboxes: terms/privacy
  acceptance and "I am 18 or older". On submit it creates `profiles/{uid}` with
  `acceptedTermsAt` = server time, `termsVersion` = current `TERMS_VERSION`, and
  `adultAttested: true`.
- [ ] AC-12: When `TERMS_VERSION` is bumped, users whose stored `termsVersion` differs are asked
  to accept again (an update of `acceptedTermsAt` and `termsVersion` only).
- [ ] AC-13: Rules enforce: self-only create and update, a key allowlist, length and format
  validation, `acceptedTermsAt == request.time` whenever it is written, `adultAttested == true`,
  an existing and active `users/{uid}` mirror, and no client delete. `users/{uid}` rules are
  unchanged.

**F5 — Deactivate, reactivate, delete**
- [ ] AC-14: `setAccountStatus({ status })` is a self-only callable. Deactivating sets
  `users/{uid}.status = 'deactivated'` and `deactivatedAt`; reactivating sets `status = 'active'`,
  clears `deactivatedAt`, and sets `statusChangedAt`. Each change writes an `audit` entry with
  `kind: 'account-status'` in the same transaction. A no-op change writes nothing. Owner/admin
  callers get `failed-precondition`. The call is rate-limited to 10/hour/uid.
- [ ] AC-15: A deactivated user who signs in is routed to `/account`, which shows only a
  reactivation panel with **Reactivate** and **Sign out**. Confirming calls
  `setAccountStatus({ status: 'active' })`.
- [ ] AC-16: `deleteAccount({ confirm: 'DELETE' })` is a self-only callable. It requires
  `auth_time` within 5 minutes, rejects owner/admin callers, and runs the captain guard (an M1
  no-op seam). It then removes `profiles/{uid}` recursively (covering the future `dependents`
  subcollection), `notificationSettings/{uid}`, and `users/{uid}`. It writes one audit entry
  (`kind: 'account-status'`, `toStatus: 'deleted'`, uid only, no PII) and deletes the Auth user
  last. A retry after partial failure succeeds.
- [ ] AC-17: Delete never reads or writes `seasons/**`. Scores are keyed by **shooter name**
  (`Shooter.name`, `ShooterScore.name`), not uid, so a deleted member's name stays on published
  scorecards. The account page states this before confirming.
- [ ] AC-18: Both callables use `enforceAppCheck: !isEmulator` and the region of the existing
  `setUserRole`. Existing `setUserRole` audit entries now include `kind: 'role-change'`; readers
  treat a missing `kind` as `'role-change'`.

**Admin visibility**
- [ ] AC-19: The Users tab shows a Status column (Active / Deactivated, as text and not colour
  alone). A missing `status` reads as Active.

**Security and tests (critical path, §III.1)**
- [ ] AC-20: The rules tests listed in §Testing Checklist pass, and the existing 47 still pass.
- [ ] AC-21: The function tests listed in §Testing Checklist pass, and the existing 15 still pass.
- [ ] AC-22: Client unit tests cover the pure helpers listed in §Testing Checklist.

**Cost**
- [ ] AC-23: Steady-state reads add at most two per signed-in session start: one `profiles/{uid}`
  read, plus one rules `get()` per profile write. No new listeners or collection scans. There
  are no new composite indexes.

**Accessibility (§III.6)**
- [ ] AC-24: The sign-in dialog, account page, completion form, and confirmation dialogs meet
  §III.6 in light and dark mode (details in §Accessibility).

**Documentation and ops**
- [ ] AC-25: `firestore-schema.md`, the constitution (v1.8.0), ADR-012, `firebase-deployment.md`,
  `.env.example`, and `CLAUDE.md` Key Files are updated (tasks Group 10).
- [ ] AC-26: The provider-setup and post-deploy ops in §Operations are done and recorded before
  production enablement.

---

## Constitutional Constraints

- **§III.2 Security** currently says "CITL uses admin-only auth (Google sign-in)". M1 replaces
  that standard, so it is a **minor constitution amendment (1.7.1 → 1.8.0)** plus
  **ADR-012 "Public member accounts" superseding ADR-005**, both done in this feature (§VIII.1
  "Major" amendment rule). Public pages stay unauthenticated; sign-in is optional.
- **§III.2**: authorization is enforced by rules and callables, never by client checks alone.
  Client gating (nav, completion redirect, unlink-last guard) is UX only. Unlinking the last
  provider is guarded client-side only, because the only consequence is self-lockout and no
  privilege is gained (DD-6).
- **§II.3 / §II.4**: dependency direction is `components → modules → services → repositories`.
  Components never import `firebase/*` at runtime (§IV.2). Every new file stays under 500 lines.
- **§III.3**: async components show `.skeleton` placeholders.
- **§III.4**: the JS budget is <250 kB gz, with about 242 kB used today. The account and
  sign-in UI must be code-split (AC-9).
- **§III.5**: TypeScript strict, `@/` imports, `textContent`/`escapeHtml()` for every
  user-supplied string (display name, email, phone).
- **§III.6**: accessibility, covered in §Accessibility below.
- **§IV.2**: forbidden patterns apply per [`scripts/forbidden-patterns.json`](../../../scripts/forbidden-patterns.json).
  No unbounded reads. The `users/{uid}` listener in `AuthModule` stays the only listener.
- **§VI.1**: Blaze with a $5/mo budget alert. The two new functions are justified in DD-1. No
  Identity Platform upgrade (DD-2). Auth stays free-tier.
- **§I.2 Platforms**: Microsoft Entra ID is an identity-provider registration
  configured *through* Firebase Auth, not hosting or data platforms. The platform count stays
  at 2 (recorded in ADR-012). M4's Amazon SES *is* a new platform and needs its own §I.2
  justification at that time.
- **App Check** stays enforced on all callables (owner decision).

---

## Architecture Approach

### Layer assignments

| Layer | Files | Change |
|-------|-------|--------|
| Types | `src/types/user.ts` | add `AccountStatus = 'active' \| 'deactivated'`; `UserDoc.status?`, `deactivatedAt?`, `statusChangedAt?` |
| Types | `src/types/account.ts` (new) | `ProfileDoc`, `ProfileInput`, `AuthProviderId` (`'google.com' \| 'microsoft.com' \| 'password'`), callable request/response types |
| Repositories | `src/repositories/profile-repository.ts` (new) | `findById`, `create`, `update` on `profiles/{uid}`; server timestamps; throws (same convention as `user-repository.ts`) |
| Repositories | `src/repositories/repository-factory.ts` | add `getProfileRepository()` |
| Services | `src/services/profile-validation.ts` (new) | pure: `normalizeDisplayName`, `validateProfileInput`, `normalizePhone`. Mirrors the rules limits |
| Services | `src/services/account-service.ts` (new) | profile load/save via repository; `setAccountStatus` / `deleteAccount` callables; error-code → message map (pattern of `admin-user-service.ts`) |
| Services | `src/services/app-services.ts` | expose the account service via the composition root |
| Utils | `src/utils/legal.ts` (new) | `TERMS_VERSION` constant and privacy-route anchors |
| Modules | `src/modules/auth.ts` | keep Google path; delegate provider work to `auth-providers.ts`; expose `onUserDoc(cb)` from the existing `users/{uid}` listener (status for the gate) |
| Modules | `src/modules/auth-providers.ts` (new) | provider factory, popup sign-in/link/unlink, reauthenticate, email-link send/complete, pending-credential store, `canUnlink()` |
| Modules | `src/modules/account-gate.ts` (new) | decides `none \| complete-profile \| reactivate` from (user, users doc, profile, `TERMS_VERSION`); `main.ts` applies it in `onBeforeNavigate` |
| Modules | `src/modules/navigation.ts` | `updateAuthState` toggles Sign in / Account / Admin (header + footer) |
| Modules | `src/main.ts` | routes `/account` and `/privacy`; boot-time email-link completion (cheap URL check, then dynamic import); pathname `/privacy` → `#/privacy` |
| Components | `src/components/sign-in-dialog.ts` (new) | `<sign-in-dialog>`: native `<dialog>`, provider buttons, email form, "check your email" state, account-exists guidance |
| Components | `src/components/account-page.ts` (new) | `<account-page>` shell: skeleton, mode switch (signed-out / complete / reactivate / normal) |
| Components | `src/components/account-profile-form.ts` (new) | profile form; `mode="complete"` adds the terms and 18+ checkboxes |
| Components | `src/components/account-providers.ts` (new) | linked-methods list, link/unlink |
| Components | `src/components/account-danger-zone.ts` (new) | sign out, deactivate, delete (typed-confirmation dialog, re-auth on `requires-recent-login`) |
| Components | `src/components/admin-users-panel.ts` | Status column |
| Views | `src/views/account.ts`, `src/views/privacy.ts` (new) | HTML shells; privacy holds Terms of Use and Privacy Policy sections |
| Views | `src/views/admin.ts` | gate button opens `<sign-in-dialog>` (label "Sign in") |
| Styles | `src/styles/account.css` (new) | tokens only (enforced by `tokens.test.ts`) |
| Markup | `src/index.html` | nav Sign in / Account / Admin slots; footer link to Privacy |
| Server | `functions/src/setAccountStatus.ts`, `functions/src/deleteAccount.ts` (new); `functions/src/index.ts` | new callables |
| Server | `functions/src/lib/audit.ts` (new) | `queueAuditEntry(tx \| batch, entry)` with `kind` discriminant |
| Server | `functions/src/lib/captainGuard.ts` (new) | `assertNotCaptain(db, uid)`: M1 no-op seam (DD-5) |
| Server | `functions/src/lib/recentAuth.ts` (new) | `assertRecentAuth(token, maxAgeSec = 300)` |
| Server | `functions/src/lib/rateLimit.ts` | generalize to `(name, limit)` params; `setUserRole` keeps 20/hr at its existing path |
| Server | `functions/src/lib/validate.ts` | zod: `setAccountStatusInput`, `deleteAccountInput` |
| Server | `functions/src/setUserRole.ts`, `functions/src/onUserCreate.ts` | audit `kind: 'role-change'`; seed `status: 'active'` |
| Config | `firestore.rules` | `profiles/{uid}` (+ `dependents` deny), `notificationSettings/{uid}` deny |
| Config | `.env.example` | `VITE_AUTH_PROVIDERS` |
| Seed | `scripts/seed-emulator.js` | seed one profile and one deactivated user for local walkthroughs |

The `auth-providers.ts` and `account-gate.ts` split keeps `auth.ts` and `main.ts` under the
500-line target. The components reach Auth only through modules. They reach Firestore and the
callables only through `account-service`.

### Data model changes (plan for `.specs/technical/firestore-schema.md`)

- **`users/{uid}`**: add `status` (`'active' | 'deactivated'`; missing means active, so no
  backfill is needed), `deactivatedAt` (`Timestamp | null`), and `statusChangedAt` (`Timestamp`).
  They are server-only. The existing self-update allowlist (`lastSignInAt`, `updatedAt`) already
  denies them, so the rules don't change. `onUserCreate` seeds `status: 'active'`.
- **`profiles/{uid}`** (new, private): `displayName` (string, 1–60 after trim), `phone`
  (optional string ≤ 20, `^[0-9+() .-]{7,20}$`), `acceptedTermsAt` (Timestamp), `termsVersion`
  (string ≤ 20), `adultAttested` (`true`), `createdAt`, `updatedAt`. Read: self or owner/admin.
  Write: self, under the allowlist. Delete: Admin SDK only. Reserved subcollection
  `profiles/{uid}/dependents/{id}` is for M2 and denied until then. This is the member-supplied
  name. `users/{uid}.displayName` stays the provider-supplied identity mirror.
- **`notificationSettings/{uid}`** (reserved, M4): not created in M1, and implicitly denied.
  `deleteAccount` already removes it so M4 doesn't need to change the delete path.
- **`audit/{id}`**: add `kind: 'role-change' | 'account-status'`. Account-status entries carry
  `actorUid`, `targetUid`, `fromStatus`, `toStatus` (`'active' | 'deactivated' | 'deleted'`), and
  `at`. Legacy entries without `kind` are role changes. Entries never carry email or name, so the
  uid alone ties an audit entry to a deleted account.
- **`rateLimits/setAccountStatus/actors/{uid}`**: new counter path, same shape as today.
- **Indexes**: none. Every M1 access is a direct document path.

### Firestore rules changes

- Add helpers: `userDocPath(uid)`, and `isActiveMember(uid)` = the mirror exists and
  `get(...).data.get('status', 'active') == 'active'`. This is the only rules `get()`. It runs
  on profile writes only, which are rare (§VI.1 negligible).
- `profiles/{uid}`:
  - **Read**: `isSelf(uid) || isOwnerOrAdmin()`.
  - **Create**: `isSelf(uid) && isActiveMember(uid)` with:
    - `keys().hasOnly([...allowlist])` and `hasAll(['displayName','acceptedTermsAt','termsVersion','adultAttested','createdAt','updatedAt'])`;
    - the length and format checks;
    - `adultAttested == true`;
    - `acceptedTermsAt == request.time`, `createdAt == request.time`, and `updatedAt == request.time`.
  - **Update**: `isSelf(uid) && isActiveMember(uid)` with:
    - `diff().affectedKeys().hasOnly(['displayName','phone','acceptedTermsAt','termsVersion','updatedAt'])`;
    - the same validation on the resulting doc;
    - `updatedAt == request.time`;
    - if `acceptedTermsAt` is affected, it must equal `request.time`.
  - **Delete**: `false`.
  - `match /dependents/{id}`: `allow read, write: if false` (M2 replaces this).
- `notificationSettings/{uid}`: `allow read, write: if false` (explicit, for clarity).
- `users/{uid}`, `audit`, `rateLimits`: unchanged.

### Guidance references (auto-activating skills)

`firebase-security` (rules allowlists, App Check), `firebase-testing` (rules matrix, function
tests), `firebase-cost-resilience` (rate-limit counter), `firebase-deploy-runbook` (2nd-gen
callable ops), `security-principles` (least privilege, server-authoritative status),
`software-architecture` (layering), `testing-principles`, `git-conventions`.

---

## Design Decisions

**DD-1 — Why two new Cloud Functions (§VI.1 justification).**
- `setAccountStatus`: the status must be trustworthy for M2/M3 (roster and captain eligibility,
  and M4 notification suppression), and every change must be in the client-unwritable audit
  log. One transaction gives atomic status + audit + rate-limit. Making `users/{uid}.status`
  client-writable would also reopen the locked mirror (spec 002), which the owner ruled out.
- `deleteAccount`: it must delete docs that clients cannot delete (`users/{uid}`, `profiles/**`),
  write an audit entry, run the server-side captain guard, and then delete the Auth user, in a
  fixed, retry-safe order. A client-side `user.delete()` cannot do the cascade.
- Volume is a few calls per month: about $0 against the §VI.1 ceilings.

**DD-2 — No blocking functions, no Identity Platform.** Google, Microsoft, and email
link are all in standard Firebase Auth. `beforeUserCreated` would need the Identity Platform
upgrade (MAU billing), so the existing async v1 `onUserCreate` stays, and the client waits for
the mirror before enabling profile submit (rules require it, AC-13).

**DD-3 — Popup sign-in and current `authDomain`.** Popups match today's behaviour and avoid the
cross-site storage problems `signInWithRedirect` has on Safari. `authDomain` stays
`citl-baed2.firebaseapp.com`, so the OAuth redirect URI registered with Azure is
`https://citl-baed2.firebaseapp.com/__/auth/handler`. Switching `authDomain` to `citl.club` is a
possible later change and would need a second redirect URI.

**DD-4 — Email-link continue URL is the origin root (`<origin>/`), not a hash route.** Firebase
appends `mode`/`oobCode`/`apiKey` query parameters to the continue URL. A hash fragment would put
them where `isSignInWithEmailLink` can't reliably see them. The boot check is a cheap string
test. The email-link code is dynamically imported only when that test matches. The flow is
web-only and doesn't use the retired Dynamic Links service.

**DD-5 — Captain guard is a seam, not a query.** Captaincy arrives in M2/M3 (one captain per
team; teams persist across years, so M2 will likely use a top-level `leagueTeams/{teamId}.captainUid`).
In M1, `assertNotCaptain(db, uid)` exists with its final signature, is called by
`deleteAccount` (and `setAccountStatus` on deactivate) before any write, and returns
immediately. M2 fills in the body with a `where('captainUid','==',uid).limit(1)` read and adds
its tests. M1 doesn't read a collection that doesn't exist yet, and doesn't pay for that read.

**DD-6 — "Cannot unlink last provider" is client-enforced.** Firebase allows unlinking the last
provider. The worst outcome is that a user locks themselves out, with no privilege gained. The
UI disables the action when `providerData.length <= 1` and says why.

**DD-7 — Owners and admins cannot deactivate or delete themselves.** Both callables reject with
`failed-precondition`, and the UI says "ask an owner to change your role first". This reuses the
last-owner invariant from spec 002 without a new owner count. The only owner can't be demoted,
so they can't delete themselves.

**DD-8 — Delete ordering (retry-safe, Auth last).**
1. Guards (auth, App Check, zod, recent auth, role, captain).
2. `recursiveDelete(profiles/{uid})`.
3. One batch: delete `notificationSettings/{uid}` and `users/{uid}`, and create the audit entry.
4. `revokeRefreshTokens(uid)`, then `deleteUser(uid)`.

If step 4 fails, the user can still sign in, sees "no profile", and can retry the delete. Every
step tolerates already-deleted state. A retry after a step-4 failure may write a second audit
entry, which is accepted. Deleting Auth first was rejected because it would leave PII with no
owner who could retry. A deleted user's live ID token (≤1 h) can't recreate a profile, because
of the `isActiveMember` mirror check.

**DD-9 — Deactivation does not disable the Auth user.** The user must be able to sign in to
reactivate (owner decision). In M1, deactivation blocks profile writes and puts the UI into
reactivation mode. M2+ treat `deactivated` as ineligible for rosters and captaincy, and M4
suppresses notifications.

---

## Implementation Plan

Ordered groups (one commit each) are in [tasks.md](./tasks.md). The high-level order is:
1. Ops prerequisites (can run in parallel).
2. Rules and rules tests.
3. Functions and function tests.
4. Client types, repositories, and services.
5. Auth providers module.
6. Nav, sign-in dialog, and boot email-link handling.
7. Privacy page and completion flow.
8. Account page.
9. Users tab status column.
10. Documentation and constitution.
11. Deploy, post-deploy ops, and preview walkthrough.

Server work comes before the client UI that depends on it.

### Operations (must be in the plan, not discovered at deploy time)

**Identity providers (Firebase console → Authentication → Sign-in method)**
- **Email link**: enable Email/Password with "Email link (passwordless sign-in)". Keep email
  enumeration protection on. Optionally set a custom sender domain (DNS verification for
  `citl.club`) to reduce spam-folder delivery.
- **Microsoft**: in Azure (Entra ID), register an app with "Accounts in any organizational
  directory and personal Microsoft accounts" and redirect URI
  `https://citl-baed2.firebaseapp.com/__/auth/handler`. Create a client secret and enter the
  Application ID and secret in Firebase. **The secret expires (≤ 24 months)**: put a rotation
  reminder in `firebase-deployment.md`.
- **Apple**: not enabled. Owner decision 2026-10-01: the Apple Developer Program fee ($99/yr)
  is outside the budget. Adding Apple later is a provider registration plus a new
  `VITE_AUTH_PROVIDERS` value and popup branch.
- **Google**: already enabled. Add the Privacy/Terms URL (`https://citl.club/privacy`) to the
  OAuth consent screen.

**Authorized domains (Authentication → Settings)**: confirm `citl.club`, `citl-baed2.web.app`,
`citl-baed2.firebaseapp.com`, and `localhost`. Add the stable `preview` channel domain
(`citl-baed2--preview-*.web.app`, exact host) so email links and popups work on preview
deploys. The email-link continue URL must be on an authorized domain.

**Functions post-deploy (per the `firebase-deploy-runbook` skill; adds about 10 min to first
deploy)**
- Cloud Run service names are **lowercased**: `setaccountstatus`, `deleteaccount`.
- After the first deploy, run the one-time invoker binding for each service (command pattern in
  [`firebase-deployment.md`](../../technical/firebase-deployment.md) §"Adding a new callable
  function").
- **Region discrepancy to resolve first**: `functions/src/setUserRole.ts` and
  `src/infrastructure/functions.ts` use `us-central1`, but `firebase-deployment.md` documents
  `us-east1`. Check with `gcloud run services list --project=citl-baed2`, use the region
  `setUserRole` actually runs in, and correct the doc (task 10.4).
- GCF source-bucket IAM fix: **not needed** (existing project, functions already deployed). It
  only applies if a new project is stood up.
- App Check: no new setup. The callables use the existing reCAPTCHA Enterprise key, and preview
  channels use the existing debug token.

**CSP**: no change expected. Popups and the auth handler run on `*.firebaseapp.com` (already in
`frame-src`), callables go to `*.run.app`/`*.cloudfunctions.net` (already in `connect-src`), and
no provider avatars are rendered. Verify on preview (task 11.5).

---

## Accessibility (§III.6)

- **Sign-in dialog**: native `<dialog>` with `showModal()`, which gives a focus trap and
  Escape-to-close. It is labelled by its heading via `aria-labelledby`, and focus returns to the
  trigger on close. Provider buttons have text labels ("Continue with Microsoft"), brand marks
  are `aria-hidden`, and each button is at least `--control-height` tall.
- **Email field**: `<label>`, `type="email"`, `autocomplete="email"`. Errors are tied with
  `aria-describedby` and announced through `role="alert"`. The "Check your email" confirmation
  is in an `aria-live="polite"` region.
- **Profile form**: fields have `autocomplete="name"` / `"tel"` and `type="tel"`. The terms and
  18+ checkboxes are real `<input type="checkbox">` with visible labels, and the terms label
  links to `#/privacy`. Required state is shown in text, not colour alone.
- **Linked providers**: shown as a list with a text status ("Connected" / "Not connected") and a
  button whose accessible name includes the provider ("Unlink Google"). The disabled-unlink
  reason is visible text linked with `aria-describedby`.
- **Destructive actions**: the confirmation dialog has a typed-confirmation input for delete and
  states the scorecard-retention notice. Focus starts on Cancel.
- **Route changes**: on `/account` render, focus moves to the page `<h1>` (`tabindex="-1"`).
  Skeletons honour `prefers-reduced-motion`. There is no horizontal scroll at 360px, including
  the nav with the added button. All colours come from `tokens.css`, checked at AA in light and
  dark.

---

## Testing Checklist

**Rules** (new `tests/rules/profiles.test.ts`, plus additions to `users.test.ts`; about 28 cases)
- [ ] Profile reads: self read allowed. Another user's read denied. Owner and admin reads
  allowed. Anon read denied.
- [ ] Valid create: self create with all required fields allowed, with and without `phone`.
- [ ] Rejected creates: missing `adultAttested`, `adultAttested: false`,
  `acceptedTermsAt != request.time`, extra key (`role`), empty name, 61-char name, invalid phone,
  21-char phone.
- [ ] Create guards: create without a `users/{uid}` mirror denied; create while
  `status: 'deactivated'` denied; create on another uid denied; anon create denied.
- [ ] Valid updates: name or phone allowed; removing phone allowed; re-acceptance (`termsVersion`
  + `acceptedTermsAt == request.time`) allowed.
- [ ] Rejected updates: changing `createdAt`, setting `adultAttested: false`, backdated
  `acceptedTermsAt`, update while deactivated, another user's update.
- [ ] Delete denied for self, admin, and owner.
- [ ] `profiles/{uid}/dependents/x` read and write denied (self).
- [ ] `notificationSettings/{uid}` read and write denied (self).
- [ ] `users/{uid}` self-writes of `status` and `deactivatedAt` denied (regression).
- [ ] Owner can read an audit entry with `kind: 'account-status'`; user cannot.

**Functions** (new `tests/functions/setAccountStatus.test.ts` and
`tests/functions/deleteAccount.test.ts`, plus additions to the existing tests)
- [ ] `setAccountStatus` rejections: unauthenticated; invalid status → `invalid-argument`;
  owner and admin callers → `failed-precondition`; missing mirror → `not-found`; the 11th call
  in an hour → `resource-exhausted`.
- [ ] `setAccountStatus` deactivate: sets `status` and `deactivatedAt`, and writes an audit entry
  with `kind`, `fromStatus`, and `toStatus`, and no email or name.
- [ ] `setAccountStatus` reactivate: clears `deactivatedAt`.
- [ ] `setAccountStatus` no-op: writes no audit entry.
- [ ] `setAccountStatus` captain guard: called on deactivate.
- [ ] `deleteAccount` rejections: unauthenticated; missing or wrong `confirm` →
  `invalid-argument`; `auth_time` older than 5 min → `failed-precondition` with
  `requires-recent-login`; owner and admin → `failed-precondition`; a throwing captain guard
  stops the call before any write.
- [ ] `deleteAccount` success: the Auth user is gone. `profiles/{uid}` and a seeded
  `dependents` child are gone. `notificationSettings/{uid}` and `users/{uid}` are gone. One audit
  entry has `toStatus: 'deleted'`.
- [ ] `deleteAccount` isolation: seeded `seasons/2025/teams/*` and `weeks/*` docs that contain
  the user's name are byte-identical afterwards, and other users' docs are untouched.
- [ ] `deleteAccount` retry: succeeds when the profile is already gone.
- [ ] `setUserRole`: the audit entry includes `kind: 'role-change'`.
- [ ] `onUserCreate`: seeds `status: 'active'`.
- [ ] Generalized `rateLimit`: the `setUserRole` 20/hr behaviour is unchanged, guarded by the
  existing tests.

**Client unit (Vitest, node environment, pure functions only)**
- [ ] `profile-validation`: trims; enforces the length boundaries 0/1/60/61; the phone allow-set
  and 20-char limit; the same constants the rules use.
- [ ] `account-gate`: decision table over (signed in?, mirror status, profile present?,
  `termsVersion` current?).
- [ ] `auth-providers` pure helpers: `canUnlink`, `parseEnabledProviders(VITE_AUTH_PROVIDERS)`,
  `looksLikeEmailLink(url)`, extracting `{ email, credential }` from an account-exists error
  (mocked `firebase/auth`).
- [ ] `account-service`: error-code → message map for both callables, including
  `requires-recent-login`.

**Manual / E2E**
- [ ] Emulator walkthrough: every provider path the Auth emulator supports (Google and email
  link; Microsoft via the emulator's fake-IdP popup), completion, edit, link/unlink,
  deactivate → sign in → reactivate, delete with fresh and stale auth.
- [ ] Preview-channel walkthrough against real providers, including account-exists linking
  (e.g. email-link account, then Microsoft with the same address) and email link opened on a
  second device.
- [ ] Keyboard-only and screen-reader pass of the dialog and the account page at 360px, in light
  and dark mode.
- [ ] Bundle size re-measured (AC-9). Firebase usage checked after the walkthrough (§VI.1).
- [ ] `/check` clean; `@reviewer` audit clean.

---

## Assumptions

1. **Provider toggle**: `VITE_AUTH_PROVIDERS` (default `google,microsoft,email`) controls
   which buttons render. Apple is not implemented (owner decision 2026-10-01: the $99/yr Apple
   Developer Program fee is outside the $5/mo budget).
2. **Owner/admin self-deactivate/delete is blocked** (DD-7). Demotion via `setUserRole` comes
   first. Confirmed by the owner 2026-10-01.
3. **Deactivation also runs the captain guard** (no-op in M1). Deactivating a captain will be
   blocked in M3 like delete.
4. **`users/{uid}` is deleted** on account deletion (not field-scrubbed). The uid survives only
   in `audit`. Cloud Audit Logs retain the call metadata.
5. **Recent-auth window is 5 minutes** (`auth_time`). Email-link-only users re-authenticate by a
   fresh email link.
6. **Rate limit**: `setAccountStatus` 10/hour/uid. `deleteAccount` has no limit (it is terminal
   and recent-auth gated).
7. **Terms and privacy text** lives on one `/privacy` page (two sections). Placeholder copy is accepted for M1 (owner decision 2026-10-01); the owner supplies final
   wording during implementation. The spec ships placeholder copy behind
   `TERMS_VERSION = '2026-10'`.
8. **Phone** is free-form within the allow-set (no E.164 normalization or verification). It is
   private (self + owner/admin), never public.
9. **No avatar display.** Initials only, which avoids a CSP `img-src` change for Microsoft.
10. **Profile reads are not cached** beyond the component's lifetime (one read per account-page
    visit or session gate). That is volume-negligible.

---

## Out of Scope / Forward Compatibility (M2–M4)

- **M2**: team proposals, rosters, and **dependents** (under-18 shooters) at
  `profiles/{uid}/dependents/{id}` on an adult account. M1 accounts are **adults 18+ only**
  (attested at completion). Minors show publicly as first name + last initial (an M2 rendering
  rule). No registration window. Teams persist across years, with one captain per team.
- **M3**: coordinator review/approval and captain handoff. It fills in `assertNotCaptain` and
  uses `users/{uid}.status` for eligibility.
- **M4**: email notifications via Amazon SES (a new platform needing §I.2 justification).
  Preferences go in `notificationSettings/{uid}`.
- Not in M1: MFA, admin-initiated deactivation/deletion of other users, data export, linking
  accounts to historical shooter names on scorecards, and switching `authDomain` to `citl.club`.
