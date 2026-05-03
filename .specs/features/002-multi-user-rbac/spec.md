# Feature: Multi-User RBAC (owner / admin / user)

**Feature ID**: 002-multi-user-rbac
**Created**: 2026-05-03
**Status**: Approved — implementation in progress
**Plan of record**: [/Users/ted/.claude/plans/i-recently-implemented-multi-user-partitioned-mochi.md](../../../../.claude/plans/i-recently-implemented-multi-user-partitioned-mochi.md)
**Reference implementation**: [`~/Developer/salmoncow/.specs/archive/001-multi-user-rbac/`](~/Developer/salmoncow/.specs/archive/001-multi-user-rbac)

---

## Overview

Replace CITL's single `admin: true` Firebase Auth custom claim with a
three-role RBAC system (`owner` / `admin` / `user`). Roles are enforced
via custom claims (primary auth signal in Firestore rules) with a
`users/{uid}` Firestore mirror as the source of truth for the admin UI.
Role writes go through a callable Cloud Function (`setUserRole`) that
enforces rate limits, last-owner protection, and writes an append-only
audit log. New users get auto-seeded on first sign-in via an
`onUserCreate` auth trigger.

This mirrors the implementation shipped in `~/Developer/salmoncow`,
adapted to CITL's TypeScript/Vite stack and existing patterns. v1 ships
a **read-only** Users tab in the existing `<admin-panel>` Custom
Element; in-app role-change UI is deferred to v2 (the callable exists
and is tested, just not invoked from the UI).

**Pre-launch context**: 0 production users today (legacy AWS site still
serves citl.club). The cutover from `admin: true` → `role` claim is
free — no backwards-compat shim needed.

---

## User Stories

**Owner** (single seed user, league administrator)
- As the owner, after the bootstrap CLI sets `role: 'owner'` on my UID,
  my next ID-token refresh shows the Admin nav link and grants me write
  access to all admin surfaces.
- As the owner, I can read the `audit/` collection to see every role
  change.
- As the owner, I can run `npm run set-role list` to see every user
  + role; `set-role set <email> admin` to promote; `set-role set
  <email> user` to demote.
- As the owner, I cannot demote myself if I'm the last owner.

**Admin** (sub-admin, content/score manager)
- As an admin, I can do everything I can today (team management, score
  entry, announcements, banner) — existing behavior preserved.
- As an admin, I can see the Users tab read-only (displayName, email,
  role, lastSignInAt, createdAt).
- As an admin, I cannot change anyone's role. The `setUserRole` callable
  rejects non-owner callers with `permission-denied`.
- As an admin, my role can only be changed by the owner via CLI (v1) or
  Admin Portal dropdown (v2, deferred).

**User** (default)
- As a new user signing in with Google for the first time, the
  `onUserCreate` trigger creates my `users/{uid}` doc with `role:
  'user'` and sets the matching custom claim.
- As a user, I can see public pages (home, scorecards, rules, about,
  downloads). Deep-linking `/#/admin` redirects me to `/`.
- As a user, attempting to write `users/{myUid}.role` directly via the
  Firestore SDK is rejected by rules.

**Negative scenarios**
- Tampered ID token → signature check fails server-side; rules treat as
  unauthenticated.
- Compromised admin → can read users, edit content, but cannot elevate
  to owner (callable rejects) and cannot bypass rules to write the
  `role` field.
- Rate-abusing owner → 21st `setUserRole` call within the hour returns
  `resource-exhausted`.

---

## Acceptance Criteria

**Functional**
- [ ] AC-1: `onUserCreate` writes `users/{uid}` with `role: 'user'` and
  sets the matching claim on first sign-in.
- [ ] AC-2: `/#/admin` redirects to `/` unless current ID-token claim
  `role` is `owner` or `admin`.
- [ ] AC-3: Users tab in admin-panel renders displayName, email,
  photoURL, createdAt, lastSignInAt, role for every user. Paginated at
  20 per page with cursor.
- [ ] AC-4: Users tab is read-only in v1 (no role-change controls
  rendered for any role).
- [ ] AC-5: `setUserRole` callable: non-owner →
  `permission-denied`; invalid role → `invalid-argument`; only-owner
  self-demotion → `failed-precondition`; success → claim, mirror doc,
  and audit entry written atomically (claim outside TX, others
  inside).
- [ ] AC-6: `setUserRole` rate-limited to 20 calls/hour/owner via
  Firestore counter; 21st returns `resource-exhausted`.
- [ ] AC-7: Firestore rules reject any direct client write to
  `users/{uid}.role` regardless of caller role.
- [ ] AC-8: Existing admin write paths (team management, score entry,
  announcements, banner) work unchanged for owner+admin under the new
  rules.
- [ ] AC-9: `users/{currentUid}` snapshot listener forces token refresh
  on `roleChangedAt` bump → UI reflects new role without manual
  re-login.
- [ ] AC-10: `node scripts/set-role.js set <email> <role>` writes the
  claim, upserts the mirror, appends an audit entry (actorUid:
  `'cli'`), enforces last-owner guard, and supports `DRY_RUN=1`.

**Security (critical path — 100% test coverage per §III.1)**
- [ ] AC-11: Rules unit tests cover {owner, admin, user, anon} ×
  {users CRUD on self+other, content CRUD, audit read, rateLimits
  read} × {allow, deny}.
- [ ] AC-12: Function unit tests cover every branch of `setUserRole`
  and `onUserCreate`; claim and Firestore doc are always consistent
  after success.
- [ ] AC-13: Rules tested in the emulator before every deploy
  (`firebase deploy --only firestore:rules --dry-run` then live).
- [ ] AC-14: No service-account keys checked in. Bootstrap uses gcloud
  ADC. `.secrets/` gitignored.

**Performance & Cost**
- [ ] AC-15: Users tab uses `limit(20)` + cursor pagination; never
  full collection scans.
- [ ] AC-16: Rules use `request.auth.token.role` (token-embedded,
  zero-read) for all role checks — no `get()` lookups.
- [ ] AC-17: Worst-case usage stays within constitution §VI.1 daily
  thresholds (Firestore reads <35k, writes <14k).

**Documentation**
- [ ] AC-18: Bootstrap runbook at
  `.specs/features/002-multi-user-rbac/bootstrap.md`.
- [ ] AC-19: Constitution updated: §II.1 Cost row Spark→Blaze, §II.1
  Security row Phase 1→Phase 2, §VI.1 Cloud Functions row, version
  1.4.0 → 1.5.0; decision-log entry appended.
- [ ] AC-20: PR description follows §V.1 (Summary, Changes, Testing,
  Guidance References, Constitutional Compliance).

---

## Constitutional Constraints

**Phase transitions triggered**
- §II.1 **Security**: Phase 1 (Basic Auth + Rules) → Phase 2 (App
  Check + custom-claim RBAC).
- §II.1 **Cost**: Spark free tier → Blaze pay-as-you-go (Blaze
  already enabled — drift correction).
- §II.1 **Testing**: For RBAC critical-path code, advance to Phase 2
  Unit Tests (rules + Functions). Broader Phase 2 adoption stays
  pending its own trigger.

**Quality standards that apply**
- §III.1 Testing: critical path (auth/authorization) requires 100%
  coverage. Rules matrix tests + Function unit tests live at unit
  layer.
- §III.2 Security: server-side authorization on every protected op;
  never trust client role state; rules tested in emulator before
  deploy.
- §III.3 Performance: rules use `request.auth.token.role` (free); user
  list paginated.
- §IV.1 Tech stack: vanilla Custom Elements with TypeScript; Firebase
  v12.x SDK (current).
- §IV.2 Forbidden patterns: no client-side filtering, no unbounded
  reads, no uncleaned `onSnapshot`.
- §V.1 PR requirements: full body sections.

**Forbidden patterns avoided**
- ❌ Client-side role checks as security boundary (UI hiding only;
  server authoritative via rules + callable).
- ❌ Unbounded user list reads (paginated at 20 with cursor).
- ❌ Granting clients write to the `role` field (rules deny; Admin SDK
  is sole writer, called only by the Cloud Function or the CLI).

---

## Architecture Approach

See approved plan §"Architecture overview" and §"Implementation
sequencing" for the full file-by-file breakdown.

**Layer assignments** (per §II.4):

| Layer | Files |
|-------|-------|
| Components | [src/components/admin-panel.ts](../../../src/components/admin-panel.ts) (modify) — add Users tab |
| Modules | [src/modules/auth.ts](../../../src/modules/auth.ts) (modify), `src/modules/role.ts` (new), [src/modules/navigation.ts](../../../src/modules/navigation.ts) (modify), [src/main.ts](../../../src/main.ts) (modify) |
| Services | `src/services/admin-user-service.ts` (new) |
| Repositories | `src/repositories/user-repository.ts` (new), [src/repositories/repository-factory.ts](../../../src/repositories/repository-factory.ts) (extend) |
| Infrastructure | `src/infrastructure/functions.ts` (new), `src/infrastructure/appcheck.ts` (new) |
| Server | `functions/src/{setUserRole,onUserCreate,index}.ts`, `functions/src/lib/{validate,rateLimit,lastOwnerGuard}.ts` |
| Config | [firestore.rules](../../../firestore.rules) (rewrite), `firestore.indexes.json` (new), [firebase.json](../../../firebase.json) (add functions+emulators), `.gitignore` (add `.secrets/`) |
| Scripts | `scripts/set-role.js` (replaces `grant-admin.js`) |
| Tests | `tests/rules/*`, `tests/functions/*` |

**Guidance references** (auto-activating skills):
- `firebase-security` — custom claims, rules helpers, App Check
- `firebase-best-practices` — callable shape, data modeling
- `firebase-testing` — rules-unit-testing matrix, emulator
- `firebase-cost-resilience` — rate limit counter pattern
- `security-principles` — least privilege, server authoritative
- `software-architecture` — layering, dependency direction
- `testing-principles` — pyramid, critical-path coverage
- `git-conventions` — branch/commit/PR conventions

---

## VI. Design Decisions

This section captures non-obvious implementation choices and the
reasoning behind them. Self-contained so it can be ported to sibling
projects (e.g. salmoncow) that share the same architecture.

### VI.1 `setUserRole` write ordering — claim-first

**Problem.** A role change is a *cross-system* write that touches:

1. **Firebase Auth** — the custom claim (`request.auth.token.role`) is
   the rules-engine source of truth.
2. **Firestore** — three records:
   - `users/{uid}` mirror (admin-UI source of truth + `roleChangedAt`
     watermark for forcing target token refresh)
   - `audit/{auto}` append-only forensics record
   - `rateLimits/setUserRole/actors/{actorUid}` abuse counter

There is no native atomic transaction across Firebase Auth and
Firestore. The Auth API call and the Firestore commit happen
sequentially. If the second of the two fails, the system ends up in a
partially-applied state. The **ordering** of the two operations
determines what that partial state looks like — and crucially,
whether it fails *open* or *closed* for the security boundary.

**Failure-mode analysis.**

| Ordering | If second op fails | Effect on a *demotion* | Effect on a *promotion* |
|----------|-------------------|------------------------|--------------------------|
| TX-first, then claim | Claim stale | User keeps old privileges (**fail-open** for revocation) | User can't use new role yet (fail-closed) |
| **Claim-first, then TX** | Mirror + audit incomplete | User loses access immediately (**fail-closed** for revocation) | User has new role with stale audit row (recoverable) |

**Decision: claim-first.** The auth custom claim is the rules-engine
source of truth — Firestore rules read `request.auth.token.role`, not
the mirror. Therefore:

1. **Revocations take effect immediately even if the TX fails.** This
   is fail-closed for the security-critical path (an admin or owner
   losing access is a higher-stakes event than a new admin being
   granted access).
2. **Mirror + audit drift is recoverable.** The actor's identity and
   timestamp are still captured by Cloud Audit Logs. The next
   `setUserRole` call for the same target reads the now-stale mirror,
   observes the divergence, and re-writes both atomically.
3. **No additional infrastructure required for production-readiness.**
   TX-first ordering would need a separate scheduled reconciliation
   job (claim-vs-mirror drift scanner) to be production-safe; the
   security gap on revocation is otherwise unmitigated. Claim-first is
   production-safe as a code-only solution.

**Implementation pattern.** The Auth API call lives *inside* the
Firestore transaction function but *before* the queued Firestore
writes:

```ts
await db.runTransaction(async (tx) => {
  const userSnap = await tx.get(userRef);
  if (!userSnap.exists) throw new HttpsError('not-found', ...);
  const fromRole = userSnap.data().role;

  await assertNotLastOwner(tx, db, fromRole, newRole);   // TX-internal read
  await checkAndBumpInTransaction(tx, db, actorUid);     // queues counter write

  // Auth API — committed BEFORE the queued Firestore writes.
  await getAuth().setCustomUserClaims(targetUid, { role: newRole });

  tx.update(userRef, { role: newRole, roleChangedAt: ... });
  tx.create(auditRef, { actorUid, targetUid, fromRole, toRole, at: ... });
});
```

If the claim throws, the queued writes never apply (TX returns before
commit). If the claim succeeds and the TX commit later fails, the
claim has already taken effect.

**Trade-offs accepted:**

- **TX retry under contention re-calls `setCustomUserClaims`** with the
  same payload. Idempotent in practice; minor extra Auth API cost on
  contention only.
- **Rate-limit counter doesn't bump on TX-commit failure** even though
  the claim was set. A small "rate-limit leak" — acceptable because
  the counter is a soft control against mass-promotion abuse, and the
  failure path is rare.
- **Mirror + audit can lag** the actual auth state when a TX commit
  fails post-claim. Detectable on the next `setUserRole` call; users
  with a divergent doc will get an audit entry that records the true
  fromRole on the next role change.

**Alternative considered: TX-first with reconciliation cron.** Run all
Firestore writes first; call `setCustomUserClaims` after commit. Add
a scheduled Cloud Function that periodically scans `users/{uid}` for
claim-vs-mirror divergence and repairs. Rejected because (a) it adds
production infrastructure and cost, (b) the security gap window
between TX commit and reconciliation run is unbounded, and (c)
revocation is the higher-stakes failure mode and should fail closed
without external dependencies.

**Future hardening (optional).** A `reconcileClaims` scheduled
function is a defense-in-depth nicety even with claim-first ordering
— it would catch any drift across either failure direction. With
claim-first this is forensics; with TX-first it would be a production
prerequisite.

---

## Implementation Plan

The full sequenced plan is in [tasks.md](./tasks.md). Operational
runbook for the very first owner promotion is in [bootstrap.md](./bootstrap.md).

The technical plan, decision rationale, and verification protocol are
in the approved plan-of-record (link at top of this file). This spec
captures the contract; the plan-of-record captures how to execute it.

---

## Testing Checklist

- [ ] `vitest run` (root) green — existing scoring/schedule tests + new
  client unit tests.
- [ ] `firebase emulators:exec --only firestore 'vitest run tests/rules'`
  green — rules matrix.
- [ ] `firebase emulators:exec --only auth,firestore,functions 'vitest
  run tests/functions'` green — Cloud Function unit tests.
- [ ] Emulator E2E walkthrough (plan §Group 8) — every happy + every
  failure branch.
- [ ] Preview-channel E2E walkthrough (plan §Group 10) — same flows
  against real Firebase.
- [ ] Quota check post-walkthrough — Firebase console Usage tab within
  §VI.1 thresholds.
- [ ] `@reviewer` audit clean.

---

## Out of Scope

- Email/password or non-Google federation (future spec).
- In-app role-change UI / dropdown (deferred — v2 of this feature).
- Fine-grained per-feature permissions (e.g. announcements-only admin).
- Account deletion / GDPR export.
- Soft-delete of users.
- Real content schema beyond what's already in CITL — RBAC layer adds
  no new content collections.
