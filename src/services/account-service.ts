/**
 * AccountService — member account facade (spec 008).
 *
 * Wraps:
 *   - ProfileRepository for profiles/{uid} load / complete / edit /
 *     terms re-acceptance
 *   - setAccountStatus and deleteAccount callables
 *
 * Returns Result for profile operations and a discriminated result for
 * the callables (mirroring admin-user-service), so components never
 * handle raw Firestore or Functions errors. Error-code → message mapping
 * lives here (accountErrorMessage) so components don't grow copies.
 *
 * Not part of the app-services composition root on purpose: every
 * consumer (the account gate and the account components) loads it with
 * a dynamic import, which keeps it and its Firestore write helpers out of
 * the main bundle (§III.4, AC-9). getAccountService() is the memoized
 * live instance.
 */

import type { HttpsCallable } from 'firebase/functions';
import { db } from '@/firebase-config';
import { createRepositoryFactory } from '@/repositories/repository-factory';
import type { ProfileRepository } from '@/repositories/profile-repository';
import { callable } from '@/infrastructure/functions';
import { type Result, success, failure } from '@/types/result';
import type {
  DeleteAccountRequest,
  DeleteAccountResponse,
  ProfileDoc,
  ProfileInput,
  SetAccountStatusRequest,
  SetAccountStatusResponse,
} from '@/types/account';
import type { AccountStatus } from '@/types/user';
import { validateProfileInput } from '@/services/profile-validation';
import { TERMS_VERSION } from '@/utils/legal';

/** Reason carried in HttpsError details when a fresh sign-in is required. */
export const REQUIRES_RECENT_LOGIN = 'requires-recent-login';

export type CallableOutcome<T> =
  | ({ ok: true } & T)
  | { ok: false; code: string; reason?: string; message: string };

export interface AccountCallables {
  setAccountStatus: HttpsCallable<SetAccountStatusRequest, SetAccountStatusResponse>;
  deleteAccount: HttpsCallable<DeleteAccountRequest, DeleteAccountResponse>;
}

function toOutcomeError(e: unknown): { ok: false; code: string; reason?: string; message: string } {
  const err = e as { code?: string; message?: string; details?: { reason?: string } } | null;
  const reason = err?.details?.reason;
  return {
    ok: false,
    code: err?.code ?? 'unknown',
    ...(reason ? { reason } : {}),
    message: err?.message ?? String(e),
  };
}

/** Strip the SDK's "functions/" or "firestore/" prefix from an error code. */
function bareCode(code: string): string {
  const slash = code.indexOf('/');
  return slash >= 0 ? code.slice(slash + 1) : code;
}

/** Member-facing message for an account callable or profile-write error. */
export function accountErrorMessage(code: string, reason?: string): string {
  if (reason === REQUIRES_RECENT_LOGIN) {
    return 'For your security, please sign in again to confirm.';
  }
  switch (bareCode(code)) {
    case 'unauthenticated':
      return 'You need to be signed in.';
    case 'failed-precondition':
      return 'Owners and admins can’t do this. Ask an owner to change your role first.';
    case 'not-found':
      return 'Your account record isn’t ready yet. Wait a moment and try again.';
    case 'resource-exhausted':
      return 'Too many changes in the last hour. Please try again later.';
    case 'invalid-argument':
      return 'That request wasn’t valid. Please try again.';
    case 'permission-denied':
      return 'You don’t have permission to do that. If your account is deactivated, reactivate it first.';
    case 'unavailable':
      return 'Can’t reach the server. Check your connection and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export class AccountService {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly callables: () => AccountCallables,
  ) {}

  async loadProfile(uid: string): Promise<Result<ProfileDoc | null>> {
    try {
      return success(await this.profiles.findById(uid));
    } catch (e) {
      console.error('[AccountService] loadProfile failed:', e);
      return failure(String(e), (e as { code?: string })?.code ?? 'LOAD_ERROR');
    }
  }

  /** First-sign-in completion (AC-11). Validates, then creates the profile. */
  async completeProfile(uid: string, input: ProfileInput): Promise<Result<void>> {
    const v = validateProfileInput(input);
    if (!v.ok) return failure(Object.values(v.errors).join(' '), 'VALIDATION');
    return this._write(() => this.profiles.create(uid, v.value, TERMS_VERSION));
  }

  async updateProfile(uid: string, input: ProfileInput): Promise<Result<void>> {
    const v = validateProfileInput(input);
    if (!v.ok) return failure(Object.values(v.errors).join(' '), 'VALIDATION');
    return this._write(() => this.profiles.update(uid, v.value));
  }

  /** Re-accept after a TERMS_VERSION bump (AC-12). */
  async acceptTerms(uid: string): Promise<Result<void>> {
    return this._write(() => this.profiles.acceptTerms(uid, TERMS_VERSION));
  }

  async setAccountStatus(status: AccountStatus): Promise<CallableOutcome<{ status: AccountStatus; changed: boolean }>> {
    try {
      const res = await this.callables().setAccountStatus({ status });
      return { ok: true, status: res.data.status, changed: res.data.changed };
    } catch (e) {
      return toOutcomeError(e);
    }
  }

  async deleteAccount(): Promise<CallableOutcome<Record<never, never>>> {
    try {
      await this.callables().deleteAccount({ confirm: 'DELETE' });
      return { ok: true };
    } catch (e) {
      return toOutcomeError(e);
    }
  }

  private async _write(op: () => Promise<void>): Promise<Result<void>> {
    try {
      await op();
      return success(undefined);
    } catch (e) {
      console.error('[AccountService] profile write failed:', e);
      return failure(String(e), (e as { code?: string })?.code ?? 'WRITE_ERROR');
    }
  }
}

let instance: AccountService | null = null;

/** The live, Firestore-backed AccountService (memoized). */
export function getAccountService(): AccountService {
  if (!instance) {
    const profiles = createRepositoryFactory({ db }).getProfileRepository();
    // Callables are resolved on first use so construction never
    // initializes the Functions SDK.
    instance = new AccountService(profiles, () => ({
      setAccountStatus: callable<SetAccountStatusRequest, SetAccountStatusResponse>('setAccountStatus'),
      deleteAccount: callable<DeleteAccountRequest, DeleteAccountResponse>('deleteAccount'),
    }));
  }
  return instance;
}
