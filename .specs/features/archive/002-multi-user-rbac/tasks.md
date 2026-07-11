# Task Breakdown: Multi-User RBAC

**Feature**: 002-multi-user-rbac
**Spec**: [spec.md](./spec.md)
**Status**: Shipped (deployed 2026-05-04)

Each numbered group below is one prospective commit. Commit only when
every box is checked and the validation gate passes. AC refs map to
acceptance criteria in [spec.md](./spec.md) §"Acceptance Criteria".

**Complexity legend**: S = <30min · M = 30min–2h · L = >2h

---

## Group 0 — Spec-Kit artifacts (this directory)

**Goal**: spec, tasks, bootstrap docs in `.specs/features/002-multi-user-rbac/`.
**Commit**: `docs(rbac): add multi-user RBAC feature spec, tasks, bootstrap`
**AC**: AC-18

- [x] **0.1 (S)** Create `.specs/features/002-multi-user-rbac/` directory.
- [x] **0.2 (M)** Write `spec.md` (this file's sibling).
- [x] **0.3 (M)** Write `tasks.md` (this file).
- [ ] **0.4 (M)** Write `bootstrap.md` adapted for gcloud ADC (no SA key download).

**Validation**: all three files present; `/check` passes.

---

## Group 1 — Branch + scaffolding

**Goal**: empty-but-valid scaffold for Functions + emulators.
**Commit**: `chore(rbac): scaffold functions/, firestore indexes, emulator config`
**AC**: AC-14 (gitignore)

- [ ] **1.1 (S)** Branch `feat/multi-user-rbac` from `main`.
- [ ] **1.2 (S)** Add `.secrets/` to `.gitignore`.
- [ ] **1.3 (S)** Create `firestore.indexes.json` with `{"indexes":[],"fieldOverrides":[]}`.
- [ ] **1.4 (M)** Create `functions/` package: `package.json` (firebase-functions ^5, firebase-admin ^13, zod ^3, vitest ^4, typescript ^5), `tsconfig.json`, `src/index.ts` (empty exports).
- [ ] **1.5 (M)** Extend [firebase.json](../../../firebase.json) with `functions` block (source: `functions`, runtime: `nodejs20`) and `emulators` block (`auth:9099`, `firestore:8080`, `functions:5001`, `ui:4000`).
- [ ] **1.6 (S)** Verify `.firebaserc` project alias `citl-baed2`.
- [ ] **1.7 (S)** `firebase emulators:start --only auth,firestore,functions` boots clean. *(Validation gate)*

---

## Group 2 — Rules migration + tests

**Goal**: role-aware rules + full unit-test matrix, replacing `admin: true`.
**Commit**: `feat(rbac): migrate firestore rules to role-based gating with full test matrix`
**AC**: AC-7, AC-8, AC-11, AC-13, AC-16

- [ ] **2.1 (S)** Add dev deps at repo root: `@firebase/rules-unit-testing`.
- [ ] **2.2 (S)** Add scripts: `test:rules`, `test:functions`, `emulators`.
- [ ] **2.3 (M)** Rewrite [firestore.rules](../../../firestore.rules) per [spec.md](./spec.md) §"Architecture Approach" + plan-of-record §"Firestore rules — full migration":
  - Helpers: `isSignedIn`, `roleOf`, `isOwner`, `isAdmin`, `isOwnerOrAdmin`, `isSelf`.
  - `users/{uid}`: read self+owner+admin; create self without role; update self preserving role; no delete.
  - `audit/{id}`: owner read; no client write.
  - `rateLimits/{path=**}`: owner read; no client write.
  - Existing `config`, `announcements`, `seasons/{year}/(teams|weeks|entries)` — all admin-only writes become `isOwnerOrAdmin()`. Public reads preserved.
- [ ] **2.4 (L)** `tests/rules/users.test.ts` — full {owner, admin, user, anon} × {read self, read other, create with/without role, update non-role, update role (deny all), delete} matrix. ~28 cases.
- [ ] **2.5 (M)** `tests/rules/seasons.test.ts` — public read; owner+admin write on seasons, teams, weeks, entries. ~8 cases.
- [ ] **2.6 (S)** `tests/rules/content.test.ts` — public read on `config` + `announcements`; owner+admin write. ~6 cases.
- [ ] **2.7 (S)** `tests/rules/audit.test.ts` — owner read only; no client writes. ~4 cases.
- [ ] **2.8 (S)** `tests/rules/rateLimits.test.ts` — owner read only; no client writes. ~4 cases.
- [ ] **2.9 (S)** `firebase emulators:exec --only firestore 'vitest run tests/rules'` green. *(Validation gate)*

---

## Group 3 — Cloud Functions + tests

**Goal**: `setUserRole` callable + `onUserCreate` trigger with defense-in-depth.
**Commit**: `feat(rbac): add setUserRole callable and onUserCreate trigger`
**AC**: AC-1, AC-5, AC-6, AC-12

- [ ] **3.1 (M)** `functions/src/lib/validate.ts` — zod: `setUserRoleInput = z.object({ targetUid: z.string().min(1), role: z.enum(['owner','admin','user']) })`.
- [ ] **3.2 (M)** `functions/src/lib/rateLimit.ts` — sliding 1-hour window on `rateLimits/setUserRole/actors/{actorUid}`; throws `resource-exhausted` at 20.
- [ ] **3.3 (M)** `functions/src/lib/lastOwnerGuard.ts` — TX-internal owner count; rejects demotion that would leave zero owners.
- [ ] **3.4 (L)** `functions/src/setUserRole.ts` — callable, `onCall({ enforceAppCheck: !process.env.FUNCTIONS_EMULATOR })`. Sequence: owner check → zod → rate-limit → last-owner guard → `setCustomUserClaims` → TX (update mirror w/ `roleChangedAt`, create audit doc, bump rate-limit). Returns `{ ok: true, fromRole, toRole }`.
- [ ] **3.5 (M)** `functions/src/onUserCreate.ts` — `auth.user().onCreate` (or v2 `beforeUserCreated` if Auth v2 supported). Idempotent: skip if `users/{uid}` exists. Sets `role: 'user'` claim + writes mirror with defaults + timestamps.
- [ ] **3.6 (S)** `functions/src/index.ts` re-exports both.
- [ ] **3.7 (L)** `tests/functions/setUserRole.test.ts` — 10 cases: no auth, non-owner, invalid role, last-owner demotion, 21st call, success (claim + doc consistent), audit entry written, App Check missing in prod env, App Check missing under emulator (allowed), idempotent on retry.
- [ ] **3.8 (M)** `tests/functions/onUserCreate.test.ts` — 3 cases: doc seeded with defaults, claim set, idempotent.
- [ ] **3.9 (S)** `firebase emulators:exec --only auth,firestore,functions 'vitest run tests/functions'` green. *(Validation gate)*

---

## Group 4 — Replace grant-admin with set-role CLI

**Goal**: extend the existing CLI to handle three roles, with the same safety as the callable.
**Commit**: `feat(rbac): replace grant-admin with multi-role set-role CLI + runbook`
**AC**: AC-10, AC-14, AC-18

- [ ] **4.1 (L)** Replace [scripts/grant-admin.js](../../../scripts/grant-admin.js) with `scripts/set-role.js`:
  - Subcommands: `set <email> <role>`, `list`, `revoke <email>` (alias for `set <email> user`).
  - Reuses gcloud ADC pattern (no SA key).
  - Atomic: claim + mirror + audit (actorUid: `'cli'`) in one logical operation; last-owner guard.
  - `DRY_RUN=1` mode prints diff without writing.
  - Validation: rejects unknown roles, missing args, unknown email.
- [ ] **4.2 (S)** Update [package.json](../../../package.json): rename `grant-admin` script entry to `set-role`. Keep `grant-admin` as a deprecated alias (`node scripts/set-role.js set "$1" admin`) for one release with a console.warn deprecation notice.
- [ ] **4.3 (M)** Write [bootstrap.md](./bootstrap.md) — runbook covering: prerequisite (`gcloud auth application-default login`); first owner promotion; ongoing list/promote/demote; emulator dry runs; what to do if the only owner is locked out.
- [ ] **4.4 (S)** `git status` shows no `.secrets/` or key files leaked. *(Validation gate)*

---

## Group 5 — Client infrastructure

**Goal**: Functions, App Check, role module, and user repository wired on the client.
**Commit**: `feat(rbac): wire Functions, App Check, role module, and user repository on client`
**AC**: AC-9, AC-15

- [ ] **5.1 (M)** `src/infrastructure/functions.ts` — lazy `getFunctions` + `httpsCallable` helper, emulator-aware via `import.meta.env.VITE_USE_EMULATOR`.
- [ ] **5.2 (M)** `src/infrastructure/appcheck.ts` — `initializeAppCheck` with reCAPTCHA Enterprise site key from `import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`; debug token path for `import.meta.env.DEV`.
- [ ] **5.3 (L)** `src/repositories/user-repository.ts` — `findById(uid): Promise<UserDoc | null>`, `listPaginated({ pageSize: 20, cursor }): Promise<{ users: UserDoc[]; nextCursor: DocumentSnapshot | null }>`, `observeSelf(uid, cb): Unsubscribe` (snapshot listener for `roleChangedAt`). Never writes the `role` field. Type `UserDoc` lives in `src/types/user.ts` (also new).
- [ ] **5.4 (M)** Extend [src/repositories/repository-factory.ts:22](../../../src/repositories/repository-factory.ts:22) — add `getUserRepository()` next to `getScoreRepository()` with the same caching pattern.
- [ ] **5.5 (M)** `src/modules/role.ts` — exports `Role` type, `getRole(force?: boolean): Promise<Role | null>`, `onRoleChange(cb): Unsubscribe`. Reads `getIdTokenResult().claims.role`; `force=true` triggers `getIdToken(true)`.
- [ ] **5.6 (S)** Modify [src/firebase-config.ts](../../../src/firebase-config.ts) — initialize App Check after `initializeApp` when not in test env.
- [ ] **5.7 (S)** `.env.example` — document `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`, `VITE_USE_EMULATOR`.
- [ ] **5.8 (S)** Manual smoke: sign in via emulator → verify `users/{uid}` doc appears, `role.ts` reports `'user'`. *(Validation gate)*

---

## Group 6 — Auth + router integration

**Goal**: `/admin` route guard; auth surfaces the role; nav updates on role change.
**Commit**: `feat(rbac): role-aware auth module, /admin route guard, role-driven nav`
**AC**: AC-2, AC-9

- [ ] **6.1 (M)** Modify [src/modules/auth.ts:45–49](../../../src/modules/auth.ts:45):
  - Replace `isAdmin()` with `getRole(): Promise<Role | null>`.
  - Add `refreshTokenAndRole(): Promise<Role | null>` (calls `getIdToken(true)` then re-reads).
  - Add `onRoleChange(cb)` — opens an `onSnapshot` on `users/{currentUid}` watching `roleChangedAt`; clean up on sign-out and via the returned unsubscribe.
- [ ] **6.2 (M)** Modify [src/main.ts:55–62](../../../src/main.ts:55) `_setupRoutes`:
  - Extend the existing `onBeforeNavigate` handler — if `path === '/admin'` and current role is not `owner`/`admin`, return `false` (router redirects to `/`). Maintain existing cleanup behavior for `/admin → other`.
- [ ] **6.3 (M)** Modify [src/main.ts:117–146](../../../src/main.ts:117) `_initAdminAuth`:
  - Replace `await this._auth!.isAdmin()` with `await this._auth!.getRole()`.
  - Toggle `#admin-panel-container` for `role === 'owner' || role === 'admin'`.
  - Toggle `#admin-unauthorized` for `signed in && role === 'user'`.
- [ ] **6.4 (M)** Modify [src/modules/navigation.ts:81–83](../../../src/modules/navigation.ts:81) `updateAuthState`:
  - Take `role` instead of relying on a no-op.
  - Subscribe to `onRoleChange` so nav admin link toggles live.
- [ ] **6.5 (S)** Manual smoke: deep-link `/#/admin` as `user` redirects to `/`; as admin/owner renders panel. *(Validation gate)*

---

## Group 7 — Users tab with owner-only role dropdown

**Goal**: owner+admin see the user list; **owner** can change roles
inline via a dropdown that calls the `setUserRole` callable. CLI is
positioned as bootstrap + emergency-recovery only — the dropdown is
the day-to-day path.
**Commit**: `feat(rbac): add Users tab with owner-only role-change dropdown`
**AC**: AC-3, AC-4, AC-15

- [ ] **7.1 (M)** New `src/views/admin-users-tab.ts` — pure HTML factory: table with displayName / email / role / lastSignInAt / createdAt; "Load more" button for cursor pagination; loading/empty/error states matching existing `<admin-panel>` patterns. The `role` column renders a `<select>` dropdown ONLY when the current user's role === `'owner'`; otherwise plain text.
- [ ] **7.2 (M)** New `src/services/admin-user-service.ts` — `listUsers({ pageSize: 20, cursor })` calls `userRepository.listPaginated`; strips to the limited field set. `setUserRole({ targetUid, role })` calls the `setUserRole` callable via the infrastructure helper from Group 5.4. Returns a typed `Result<{ fromRole, toRole }>` so the UI can branch on success vs. each error code.
- [ ] **7.3 (M)** Modify [src/components/admin-panel.ts:73–80](../../../src/components/admin-panel.ts:73) — add a "Users" tab button alongside Team Management / Score Entry / Announcements. Render `admin-users-tab.ts` content inside; wire change events on the dropdown to `admin-user-service.setUserRole`.
- [ ] **7.4 (M)** Confirmation flow + toast feedback: dropdown change opens a confirm dialog ("Change Alice's role from admin to user?"). On confirm, invoke the callable and show a toast for success or failure. Map callable error codes to user-facing messages: `permission-denied` → "Only the owner can change roles." (shouldn't happen since the dropdown only renders for owner — defense in depth); `failed-precondition` → "Cannot demote the last owner. Promote another user to owner first."; `resource-exhausted` → "Rate limit reached. Please wait before changing more roles."; `invalid-argument` → generic "Invalid role." (also shouldn't happen via the dropdown).
- [ ] **7.5 (S)** On successful role change, refresh the local row so the new role + new `lastSignInAt` reflect immediately (re-query that single user, or optimistically update).
- [ ] **7.6 (S)** Emulator smoke: as owner, change another user's role via dropdown → verify auth claim, mirror, audit entry; as admin, dropdown is absent and devtools call to `setUserRole` is rejected. *(Validation gate)*
- [ ] **7.4 (S)** Wire fetch + pagination in `admin-panel.ts` (mirror existing patterns for the other tabs — no separate controller needed for v1).
- [ ] **7.5 (S)** Emulator smoke: owner sees list; admin sees same list; user can't reach the page. *(Validation gate)*

---

## Group 8 — Emulator E2E

**Goal**: full story walkthrough green before any real-Firebase deploy.
**No commit** — fixes fold into prior groups via `git commit --fixup`.
**AC**: AC-1 through AC-9, AC-15

Per [plan §Group 8](../../../../.claude/plans/i-recently-implemented-multi-user-partitioned-mochi.md). Run every numbered step; record any surprises in this file or in a fixup commit message.

---

## Group 9 — Constitution + decision log

**Goal**: docs reflect new state.
**Commit**: `docs(rbac): advance Security to Phase 2, correct plan tier to Blaze`
**AC**: AC-19

- [ ] **9.1 (S)** [.specs/constitution.md:76](../../constitution.md:76) Cost row → `Blaze pay-as-you-go (within Spark-equivalent budget)`.
- [ ] **9.2 (S)** [.specs/constitution.md:71](../../constitution.md:71) Security row → `Phase 2: App Check + custom-claim RBAC (owner/admin/user); Cloud Functions sole role writer`.
- [ ] **9.3 (S)** [.specs/constitution.md:413](../../constitution.md:413) Cloud Functions row → `Blaze; pay-per-invocation; rate-limited internally`.
- [ ] **9.4 (S)** Update §VI.1 hard constraints — keep cost discipline language; remove "Spark-only" / "no Cloud Functions" language.
- [ ] **9.5 (S)** Bump constitution version 1.4.0 → 1.5.0; "Last Updated" → 2026-05-03.
- [ ] **9.6 (S)** Update [.claude/agents/speckit.md:78](../../../.claude/agents/speckit.md:78) — remove `Firebase Spark plan only — no Cloud Functions, no paid features` line; replace with `Cloud Functions allowed (Blaze); audit cost in §VI.1 before adding new functions`.
- [ ] **9.7 (M)** Append to [.prompts/meta/architectural-decision-log.md](../../../.prompts/meta/architectural-decision-log.md): 2026-05-03 entry "Adopt Blaze + RBAC, enter Security Phase 2" with triggers met / decision / consequences.
- [ ] **9.8 (S)** `git diff .specs/ .prompts/ .claude/` reviewed for accidental edits. *(Validation gate)*

---

## Group 10 — Preview deploy + real-Firebase E2E

**No commit** — fixes via fixup.
**AC**: AC-13, AC-17

- [ ] **10.1 (S)** `firebase deploy --only firestore:rules --project citl-baed2 --dry-run` then live.
- [ ] **10.2 (M)** `firebase deploy --only firestore:rules,firestore:indexes,functions --project citl-baed2`.
- [ ] **10.3 (S)** `npm run deploy:preview`.
- [ ] **10.4 (M)** Re-run Group 8 walkthrough on preview URL with real Google sign-in.
- [ ] **10.5 (M)** Bootstrap real owner: `gcloud auth application-default login` then `node scripts/set-role.js set <your-email> owner`.
- [ ] **10.6 (S)** Confirm Firebase console Usage tab within §VI.1 thresholds.

---

## Group 11 — Pull request

**AC**: AC-20

- [ ] **11.1 (S)** `git rebase -i --autosquash main` to fold fixups.
- [ ] **11.2 (S)** `git push -u origin feat/multi-user-rbac`.
- [ ] **11.3 (S)** Run `@reviewer` on the branch.
- [ ] **11.4 (M)** `gh pr create`:
  - Title: `feat: introduce three-role RBAC (owner/admin/user)`
  - Body: Summary, Changes (one bullet per Group 1–9 commit), Testing checklist, Guidance References (skills used + spec sections), Constitutional Compliance (Security Phase 1→2, plan-tier correction, no forbidden patterns).

---

## AC → Task Map

| AC | Tasks |
|----|-------|
| AC-1 | 3.5, 3.8, 8.* |
| AC-2 | 6.2, 6.5, 8.* |
| AC-3 | 7.1, 7.2, 7.3, 8.* |
| AC-4 | 7.1, 7.3 |
| AC-5 | 3.4, 3.7, 8.* |
| AC-6 | 3.2, 3.4, 3.7, 8.* |
| AC-7 | 2.3, 2.4, 8.* |
| AC-8 | 2.3, 2.5, 2.6, 8.* |
| AC-9 | 5.3, 6.1, 8.* |
| AC-10 | 4.1, 4.2, 8.*, 10.5 |
| AC-11 | 2.4, 2.5, 2.6, 2.7, 2.8, 2.9 |
| AC-12 | 3.7, 3.8, 3.9 |
| AC-13 | 2.9, 3.9, 10.1, 10.2 |
| AC-14 | 1.2, 4.1, 4.4 |
| AC-15 | 5.3, 7.1, 7.2 |
| AC-16 | 2.3 |
| AC-17 | 3.2, 10.6 |
| AC-18 | 4.3, 0.4 |
| AC-19 | 9.1–9.7 |
| AC-20 | 11.4 |
