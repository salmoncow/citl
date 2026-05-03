# Owner Bootstrap Runbook

**One-time procedure** to grant the first `owner` role on a Firebase Auth
user in CITL. After this runs, role management can happen via the
`scripts/set-role.js` CLI (owner-only) or, in v2, via the Admin Portal
dropdown.

You should only run the bootstrap once, as part of initial RBAC rollout
or if every owner is locked out and you need to recover.

CITL uses **gcloud Application Default Credentials (ADC)** — no
service-account key download required. This is the same mechanism
[scripts/grant-admin.js](../../../scripts/grant-admin.js) uses today,
extended to handle the three-role model.

---

## Prerequisites

1. The target user has **signed in to CITL at least once** via Google.
   The `onUserCreate` trigger must have fired for their UID — otherwise
   there's no Auth record to attach a claim to and no `users/{uid}` doc
   to update.
2. `gcloud` CLI installed and authenticated to your Google account:
   ```bash
   gcloud auth login
   gcloud auth application-default login
   gcloud config set project citl-baed2
   ```
3. Your Google account has the **Firebase Authentication Admin** role on
   the `citl-baed2` GCP project (IAM → grant if missing).
4. Node 24+ and npm available (matches repo `engines`).
5. Repo cloned and `npm install` complete.

---

## First-time owner promotion

Once and only once, after RBAC ships:

```bash
# Find the target UID
node scripts/set-role.js list

# Output looks like:
# uid                                 email                  role
# AbCdEfGhIj1234567890                you@example.com        user
# ...

# Promote yourself to owner
node scripts/set-role.js set you@example.com owner

# Output:
# ─── set-role ──────────────────────────────────────
# project   : citl-baed2
# target    : you@example.com (uid: AbCd...)
# from role : user
# to role   : owner
# ───────────────────────────────────────────────────
# ✓ set custom claim role=owner
# ✓ updated users/AbCd.../role to owner + roleChangedAt=...
# ✓ wrote audit/{auto} (actorUid: cli)
# ───────────────────────────────────────────────────
# Sign out and back in for the new claim to take effect.
```

The script prints a clear summary; if `DRY_RUN=1` is set it prints what
it *would* do without writing.

After the script exits, **sign out of CITL and sign back in**. The Admin
nav link should appear and the Users tab in the admin panel should now
list every seeded user.

---

## Day-to-day role management

Once at least one owner exists, role changes happen via the same CLI:

```bash
# Promote a teammate to admin
node scripts/set-role.js set teammate@example.com admin

# Demote (alias for `set <email> user`)
node scripts/set-role.js revoke teammate@example.com

# Inspect everyone
node scripts/set-role.js list

# Try a destructive change without committing it
DRY_RUN=1 node scripts/set-role.js set teammate@example.com owner
```

Every CLI write is also logged to the `audit/` collection with
`actorUid: 'cli'`, so the audit trail mirrors what the in-app callable
would produce.

The CLI enforces the same **last-owner guard** as the
`setUserRole` callable: it refuses to demote the only `owner`. If you're
the only owner and the script blocks you from changing yourself, that's
the safety net working — promote a second owner first.

---

## Verifying

1. **Claim set** — sign out and in, then in browser devtools:
   ```js
   firebase.auth().currentUser.getIdTokenResult(true).then(r => console.log(r.claims))
   // { role: 'owner', ... }
   ```

2. **Mirror doc updated** — Firebase Console → Firestore →
   `users/<uid>` → confirm `role: "owner"` and `roleChangedAt` set.

3. **Audit entry written** — Firebase Console → Firestore → `audit` →
   newest doc shows `{ actorUid: 'cli', targetUid, fromRole, toRole,
   at }`.

4. **Admin nav link** — sign in to citl.club; the Admin link should
   appear in the dropdown for owner+admin roles only.

---

## Running against the emulator

For local development the same script works with the emulator — no GCP
auth needed.

```bash
# Terminal 1: start emulators
firebase emulators:start --only auth,firestore,functions

# Terminal 2: sign in once via http://localhost:3000 to seed users/{uid}

# Terminal 3: copy your emulator UID from http://localhost:4000/auth, then:
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
GCLOUD_PROJECT=citl-baed2 \
node scripts/set-role.js set you@example.com owner

# Sign out + in in the browser; admin nav appears.
```

Emulator data persists across restarts if started with
`--export-on-exit=.emulator-data --import=.emulator-data`. Add to
`.gitignore` (already covered by `.secrets/` if you put it there).

---

## Recovery — every owner locked out

If the only owner has lost access (forgotten Google password, account
deleted, etc.) and no other owner exists, you can re-bootstrap via the
same script — gcloud ADC credentials are tied to **your Google account's
IAM permissions**, not to the in-app user.

1. Confirm your Google account still has Firebase Authentication Admin
   on the GCP project.
2. Run `gcloud auth application-default login` if your ADC has expired.
3. `node scripts/set-role.js set <recovery-email> owner`.
4. Audit entry shows `actorUid: 'cli'` — review against any expected
   activity.

---

## When **not** to use this script

- Day-to-day role changes by an owner who already has access — once v2
  ships the in-app dropdown, prefer that path. v1 ships read-only, so
  the CLI is the only path until then.
- Granting roles to accounts that haven't signed in yet — they have no
  Firebase Auth record, so the script will fail at `getUserByEmail`. Ask
  them to sign in once first.
- Bypassing the rate limit deliberately — the CLI uses Admin SDK and
  bypasses the callable's 20/hr cap intentionally, but every CLI write
  shows up in `audit/` for review. Don't use it to mass-promote.

---

## Related

- [scripts/set-role.js](../../../scripts/set-role.js) — the script itself
- [functions/src/setUserRole.ts](../../../functions/src/setUserRole.ts)
  — the in-app callable (mirrors this script's safety logic)
- [.specs/features/002-multi-user-rbac/spec.md](./spec.md) — feature
  spec
- [.specs/features/002-multi-user-rbac/tasks.md](./tasks.md) — task
  breakdown
- Reference implementation:
  [`~/Developer/salmoncow/.specs/archive/001-multi-user-rbac/bootstrap.md`](~/Developer/salmoncow/.specs/archive/001-multi-user-rbac/bootstrap.md)
  (uses SA key download instead of gcloud ADC — citl uses the cleaner
  ADC path)
