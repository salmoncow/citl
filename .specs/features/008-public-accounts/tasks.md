# Task Breakdown: Public Accounts and Profile (M1)

**Feature**: 008-public-accounts
**Spec**: [spec.md](./spec.md)
**Status**: Groups 2–10 implemented (PR #294); Groups 1 and 11 are owner ops, pending

Each numbered group below is one commit, in implementation order. Commit a group only when
every box in it is checked and its validation gate passes. AC refs point to [spec.md](./spec.md)
§"Acceptance Criteria". Branch: `feat/public-accounts`.

**Complexity legend**: S = <30min · M = 30min–2h · L = >2h

---

## Group 0 — Spec-Kit artifacts

**Commit**: `docs(accounts): add 008 public accounts M1 spec and tasks`

- [x] **0.1 (M)** Write `spec.md`.
- [x] **0.2 (M)** Write `tasks.md`.

---

## Group 1 — Ops prerequisites (no code; run in parallel with Groups 2–9)

**AC**: AC-4, AC-26. Record what was done, with dates, in `firebase-deployment.md` (task 10.4).

- [ ] **1.1 (S)** Firebase console: enable Email/Password with **Email link**. Confirm email
  enumeration protection is **on**. *Email link enabled by the owner 2026-10-01; enumeration
  protection still to confirm.*
- **1.2** *Removed*: Microsoft sign-in dropped (owner decision 2026-10-02).
- **1.3** *Removed*: Apple sign-in dropped (owner decision 2026-10-01; $99/yr fee outside budget).
- [ ] **1.4 (S)** Authorized domains: confirm `citl.club`, `citl-baed2.web.app`,
  `citl-baed2.firebaseapp.com`, `localhost`. Add the stable `preview` channel host.
- [ ] **1.5 (S)** Google OAuth consent screen: add the privacy/terms URL
  `https://citl.club/privacy`.
- [ ] **1.6 (S)** *Optional*: custom email-action sender domain (DNS verification for `citl.club`).
- [ ] **1.7 (S)** Resolve the functions region discrepancy (`us-central1` in code vs `us-east1` in
  docs) with `gcloud run services list --project=citl-baed2`. Note the result for 10.4 and 11.3.
- [ ] **1.8 (S)** League owner supplies the Terms of Use and Privacy Policy wording (blocks 11.6,
  not development).

---

## Group 2 — Rules and rules tests

**Commit**: `feat(accounts): add profiles rules with field allowlist and active-member check`
**AC**: AC-13, AC-20, AC-23

- [x] **2.1 (M)** `firestore.rules`: add helpers `isActiveMember(uid)` and a profile validator.
  Add `profiles/{uid}` (read, create, update, delete per spec §"Firestore rules changes"),
  nested `dependents/{id}` deny, and `notificationSettings/{uid}` deny. Leave `users`, `audit`,
  and `rateLimits` unchanged.
- [x] **2.2 (L)** `tests/rules/profiles.test.ts`: profile read, create, update, and delete matrix
  per spec §Testing Checklist → Rules. Add a `seedProfile` helper to `tests/rules/_helpers.ts`.
- [x] **2.3 (S)** `tests/rules/users.test.ts`: self-write of `status` / `deactivatedAt` denied.
  `tests/rules/audit.test.ts`: `kind: 'account-status'` entry is readable by owner only.
- [x] **2.4 (S)** Gate: `npm run test:rules` green, with the existing 47 cases and the new ones.

---

## Group 3 — Cloud Functions and tests

**Commit**: `feat(accounts): add setAccountStatus and deleteAccount callables with audit kind`
**AC**: AC-14, AC-16, AC-17, AC-18, AC-21

- [x] **3.1 (M)** `functions/src/lib/rateLimit.ts`: parameterize the counter name and limit. Keep
  the `setUserRole` path `rateLimits/setUserRole/actors/{uid}` and its 20/hr limit.
- [x] **3.2 (S)** `functions/src/lib/audit.ts`: `queueAuditEntry` with a typed union
  `RoleChangeEntry | AccountStatusEntry` (`kind` discriminant). It has no PII fields.
- [x] **3.3 (S)** `functions/src/lib/captainGuard.ts`: `assertNotCaptain(db, uid): Promise<void>`.
  It is a no-op in M1, with a doc comment pointing at M2 (spec DD-5).
- [x] **3.4 (S)** `functions/src/lib/recentAuth.ts`: `assertRecentAuth(token, 300)`. It throws
  `failed-precondition` with `details: { reason: 'requires-recent-login' }`.
- [x] **3.5 (S)** `functions/src/lib/validate.ts`: `setAccountStatusInput`
  (`status: 'active' | 'deactivated'`) and `deleteAccountInput` (`confirm: z.literal('DELETE')`).
- [x] **3.6 (S)** `setUserRole.ts`: use `queueAuditEntry` with `kind: 'role-change'`.
  `onUserCreate.ts`: seed `status: 'active'`.
- [x] **3.7 (M)** `functions/src/setAccountStatus.ts`: the callable. Same `enforceAppCheck` and
  region as `setUserRole`. Sequence: auth → zod → role check (DD-7) → transaction (read mirror,
  `not-found`, no-op short-circuit, captain guard on deactivate, rate limit, update mirror, audit).
- [x] **3.8 (M)** `functions/src/deleteAccount.ts`: the callable, ordered per spec DD-8, with
  every step idempotent.
- [x] **3.9 (S)** `functions/src/index.ts`: export both callables.
- [x] **3.10 (L)** `tests/functions/setAccountStatus.test.ts` and `deleteAccount.test.ts`, plus
  additions to `setUserRole.test.ts` and `onUserCreate.test.ts` per spec §Testing Checklist →
  Functions. Add loaders to `tests/functions/_helpers.ts`. Make the captain guard injectable or
  mockable for the "throws" case.
- [x] **3.11 (S)** Gate: `npm run test:functions` green. `npm --prefix functions run build` clean.

---

## Group 4 — Client types, repositories, services

**Commit**: `feat(accounts): add profile repository, validation, and account service`
**AC**: AC-11, AC-14, AC-16, AC-22

- [x] **4.1 (S)** `src/types/user.ts`: `AccountStatus` and the new optional `UserDoc` fields.
  `src/types/account.ts`: `ProfileDoc`, `ProfileInput`, `AuthProviderId`, and the callable I/O
  types.
- [x] **4.2 (S)** `src/utils/legal.ts`: `TERMS_VERSION`. Export the profile limits
  (`DISPLAY_NAME_MAX = 60`, `PHONE_MAX = 20`, phone pattern) from `src/services/profile-validation.ts`.
- [x] **4.3 (M)** `src/services/profile-validation.ts` and its `.test.ts`.
- [x] **4.4 (M)** `src/repositories/profile-repository.ts` (direct doc ops only;
  `serverTimestamp()` for `acceptedTermsAt`, `createdAt`, and `updatedAt`). Add
  `getProfileRepository()` to `repository-factory.ts`.
- [x] **4.5 (M)** `src/services/account-service.ts`: `loadProfile`, `completeProfile`,
  `updateProfile`, `acceptTerms`, `setAccountStatus`, `deleteAccount`, and the error-message map.
  Wire it into `src/services/app-services.ts`. Add `account-service.test.ts` for the message map.
- [x] **4.6 (S)** Gate: `npm run typecheck` and `npm test` green.

---

## Group 5 — Auth providers module

**Commit**: `feat(auth): add Microsoft and email-link sign-in with account linking` (Microsoft later removed, 2026-10-02)
**AC**: AC-4, AC-5, AC-6, AC-7

- [x] **5.1 (S)** `.env.example` and `src/vite-env.d.ts`: `VITE_AUTH_PROVIDERS`.
- [x] **5.2 (L)** `src/modules/auth-providers.ts`:
  - `parseEnabledProviders`, `signInWith(providerId)`, `sendEmailLink(email, intent)`,
    `completeEmailLink(url, email?)`, `linkProvider`, `unlinkProvider`, `reauthenticate`, and
    `canUnlink`;
  - an in-memory pending credential for account-exists errors;
  - email and intent stored in `localStorage` under one namespaced key.
- [x] **5.3 (M)** `src/modules/auth.ts`: `signIn(providerId)` delegates to `auth-providers`. Expose
  `onUserDoc(cb)` from the existing `users/{uid}` snapshot, keeping a single listener with
  existing teardown.
- [x] **5.4 (M)** `src/modules/account-gate.ts`: a pure decision function plus a small stateful
  wrapper. Add `account-gate.test.ts` and `auth-providers.test.ts` (pure helpers, mocked
  `firebase/auth`).
- [x] **5.5 (S)** Gate: typecheck and unit tests green. Each new module is under 500 lines.
  *Note*: AccountService was moved out of `app-services.ts` to a lazily imported
  `getAccountService()` to keep it out of the main bundle (§III.4).

---

## Group 6 — Nav, sign-in dialog, boot email-link handling

**Commit**: `feat(accounts): public sign-in from site nav with role-aware admin link`
**AC**: AC-1, AC-2, AC-3, AC-5, AC-9, AC-24

- [x] **6.1 (M)** `src/index.html`: header slots for Sign in (button) / Account (link) / Admin
  (link, hidden by default), and a footer Privacy link.
- [x] **6.2 (M)** `src/modules/navigation.ts`: `updateAuthState(user, role)` toggles the three
  header slots and the footer Admin link (shown only for owner/admin). Sign in dynamically imports
  and opens `<sign-in-dialog>`.
- [x] **6.3 (L)** `src/components/sign-in-dialog.ts`: provider buttons from the enabled list;
  email form → "check your email" state; account-exists guidance; error states; §III.6 dialog
  behaviour. Styles go in `src/styles/account.css`.
- [x] **6.4 (M)** `src/main.ts`: before `_router.init()`, run `looksLikeEmailLink(location.href)`.
  If it matches, dynamically import `auth-providers`, complete the sign-in (or open the dialog to
  ask for the email), and `replaceState` to `/#/account`. Map pathname `/privacy` → `#/privacy`.
- [x] **6.5 (S)** `src/views/admin.ts` and `main.ts` `_wireAdminAuthButtons`: the gate button
  opens the sign-in dialog.
- [x] **6.6 (S)** Gate: emulator smoke. Sign in from the nav on `/`, `/rules`, and the mobile
  burger at 360px. Admin link appears only after promoting via `npm run set-role:emulator`.
  `npm run build` main-chunk size is recorded.
  *Result (2026-10-01)*: nav sign-in, account link and owner-only Admin link verified in
  Playwright against the emulator at 1280, 1024 and 360px (burger); main chunk 245.9 kB gz.
  The v1 `onUserCreate` auth trigger did not fire in the local emulator ("emulation error"),
  so the walkthrough seeded the mirror by hand; verify the trigger on preview.

---

## Group 7 — Privacy page and first-sign-in completion

**Commit**: landed together with Group 8 (`feat(accounts): add privacy page, profile completion, and /account page`)
**AC**: AC-10, AC-11, AC-12, AC-24

- [x] **7.1 (M)** `src/views/privacy.ts`: Terms of Use and Privacy Policy sections with stable
  anchor ids, using placeholder copy plus the version. Register the `/privacy` route.
- [x] **7.2 (L)** `src/components/account-profile-form.ts`: `mode="complete" | "edit"`; terms and
  18+ checkboxes in complete mode; client validation via `profile-validation`; submit disabled
  until the `users/{uid}` mirror exists (via `onUserDoc`); toast on save.
- [x] **7.3 (M)** `main.ts` `onBeforeNavigate`: apply `account-gate`. Send `complete-profile` and
  `reactivate` to `/account`, and allow `/privacy`.
- [x] **7.4 (S)** Gate: an emulator new user is forced through completion, and the doc in the
  emulator UI matches the allowlist. Bumping `TERMS_VERSION` locally triggers re-acceptance only.

---

## Group 8 — Account page

**Commit**: `feat(accounts): add /account page with providers, deactivate, and delete`
**AC**: AC-7, AC-8, AC-14, AC-15, AC-16, AC-17, AC-24

- [x] **8.1 (M)** `src/views/account.ts` and `src/components/account-page.ts`: skeleton
  (§III.3) → mode switch (signed-out sign-in view / complete / reactivate / normal) → error
  state. Focus the `<h1>` on render. Tear down subscriptions in `disconnectedCallback`. Register
  the `/account` route (lazy import).
- [x] **8.2 (M)** `src/components/account-providers.ts`: list, link (popup, or email link with
  `link` intent), unlink with `canUnlink` guard and explanation.
- [x] **8.3 (L)** `src/components/account-danger-zone.ts`: sign out; deactivate (confirm dialog →
  callable → sign out); delete (typed `DELETE` confirm dialog with scorecard-retention notice →
  callable). On `requires-recent-login`, call `reauthenticate` with a linked provider, or send an
  email link, then retry. Owner/admin see the DD-7 message instead of the buttons.
- [x] **8.4 (S)** Reactivation panel (inside `account-page`): Reactivate → callable → normal mode.
  Sign out.
- [x] **8.5 (S)** Gate: emulator walkthrough of spec §Testing Checklist → Manual, the emulator
  line. Keyboard-only pass.
  *Result (2026-10-01)*: email-link sign-in, completion (validation, mirror wait), gate
  redirect and /privacy allowance, edit, deactivate → sign in → reactivate, typed-DELETE
  delete, owner demote-first notice, deactivated seed user. Not covered locally: Google
  fake-IdP popup (owner verified Google, Microsoft and email link on the emulator 2026-10-01), stale-auth delete re-auth, and a full keyboard/screen-reader
  pass; do these on the preview walkthrough (11.4).

---

## Group 9 — Users tab status column

**Commit**: `feat(admin): show account status in Users tab`
**AC**: AC-19

- [x] **9.1 (S)** `src/components/admin-users-panel.ts`: Status column showing escaped text and a
  non-colour signal. A missing value reads as Active. Update the skeleton column count.
- [x] **9.2 (S)** `scripts/seed-emulator.js`: seed one profile and one deactivated user.

---

## Group 10 — Documentation and constitution

**Commit**: `docs(accounts): schema, constitution 1.8.0, ADR-012, deployment ops`
**AC**: AC-25

- [x] **10.1 (M)** `.specs/technical/firestore-schema.md`:
  - new `users/{uid}` fields;
  - `profiles/{uid}` (with reserved `dependents`);
  - reserved `notificationSettings/{uid}`;
  - `audit` `kind` and account-status fields;
  - the `rateLimits/setAccountStatus` path;
  - access rules;
  - the TypeScript locations table (`ProfileDoc` → `src/types/account.ts`).
- [x] **10.2 (M)** `.specs/constitution.md` → **1.8.0**:
  - §III.2 replaces "admin-only auth" with optional public member accounts plus the providers;
  - §IV.1 Auth line;
  - §II.1 Security row and inventory (views/components/services/modules counts, test counts);
  - §VI.1 points to spec 008 DD-1 for the new functions;
  - version history line.
- [x] **10.3 (M)** `.prompts/meta/architectural-decision-log.md`: **ADR-012 Public member
  accounts** (supersedes ADR-005; mark ADR-005 Superseded). It records the IdP-registrations-are-
  not-platforms reasoning (§I.2), the 18+ adult-account decision, and the forward plan for
  dependents.
- [x] **10.4 (S)** `.specs/technical/firebase-deployment.md`:
  - correct the functions region (from 1.7);
  - list the `setaccountstatus` / `deleteaccount` invoker bindings;
  - the provider registrations and the authorized domains.
- [x] **10.5 (S)** `CLAUDE.md` Key Files: `auth-providers.ts`, `account-gate.ts`,
  `account-service.ts`, `profile-repository.ts`, `account-*.ts` components.

---

## Group 11 — Deploy and post-deploy ops

**AC**: AC-18, AC-23, AC-26

- [ ] **11.1 (S)** Run `npm run deploy:rules:dryrun`, then merge the PR. CI deploys hosting, rules,
  and functions.
- [ ] **11.2 (S)** Confirm the Cloud Run services exist under **lowercased** names
  `setaccountstatus` and `deleteaccount`.
- [ ] **11.3 (S)** For each service, run the one-time `roles/run.invoker` binding for `allUsers`
  (region from 1.7; command in `firebase-deployment.md`). Without it, browser calls fail with a
  CORS/403 error. GCF source-bucket IAM fix: N/A (existing project).
- [ ] **11.4 (S)** Preview-channel walkthrough (spec §Testing Checklist → Manual, preview line)
  with the App Check debug token.
- [ ] **11.5 (S)** Production smoke: with the browser console open, check for CSP violations
  across all providers, plus one deactivate/reactivate and one delete of a test account.
- [x] **11.6 (S)** Replace the placeholder terms copy with the owner's wording (from 1.8) and set
  the final `TERMS_VERSION` before announcing accounts. Done 2026-10-06: final wording, no
  version bump (it describes practices already in effect).
- [ ] **11.7 (S)** After one week, check Firebase usage against the §VI.1 thresholds and the
  billing budget alert ($5/mo).
- [ ] **11.8 (S)** Move this spec directory to `.specs/features/archive/` once shipped.
