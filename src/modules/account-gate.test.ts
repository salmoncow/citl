import { describe, expect, it, vi } from 'vitest';
import { AccountGate, decideAccountGate, isGatedPath, type GateInput, type UserDocState } from './account-gate';
import type { ProfileDoc } from '@/types/account';
import type { UserDoc } from '@/types/user';

const base: GateInput = {
  signedIn: true,
  userDocLoaded: true,
  userStatus: 'active',
  profileLoaded: true,
  hasProfile: true,
  profileTermsVersion: 'v1',
  currentTermsVersion: 'v1',
};

describe('decideAccountGate', () => {
  it.each<[string, Partial<GateInput>, ReturnType<typeof decideAccountGate>]>([
    ['signed out', { signedIn: false, userStatus: 'deactivated', hasProfile: false }, 'none'],
    ['active, current profile', {}, 'none'],
    ['deactivated wins over everything', { userStatus: 'deactivated', hasProfile: false }, 'reactivate'],
    ['deactivated before profile loads', { userStatus: 'deactivated', profileLoaded: false }, 'reactivate'],
    ['status unknown until the mirror loads', { userDocLoaded: false, userStatus: 'deactivated' }, 'none'],
    ['profile still loading', { profileLoaded: false, hasProfile: false }, 'none'],
    ['no profile', { hasProfile: false, profileTermsVersion: null }, 'complete-profile'],
    ['stale terms version', { profileTermsVersion: 'v0' }, 'accept-terms'],
  ])('%s', (_name, patch, expected) => {
    expect(decideAccountGate({ ...base, ...patch })).toBe(expected);
  });
});

describe('isGatedPath', () => {
  it('allows /account and /privacy while gated', () => {
    expect(isGatedPath('complete-profile', '/account')).toBe(false);
    expect(isGatedPath('complete-profile', '/privacy')).toBe(false);
    expect(isGatedPath('reactivate', '/')).toBe(true);
  });

  it('never gates when the decision is none', () => {
    expect(isGatedPath('none', '/admin')).toBe(false);
  });
});

describe('AccountGate', () => {
  function setup(profile: ProfileDoc | null) {
    let emit: (s: UserDocState) => void = () => {};
    const loadProfile = vi.fn().mockResolvedValue(profile);
    const gate = new AccountGate({
      onUserDoc: (cb) => {
        emit = cb;
        cb({ uid: null, loaded: false, doc: null });
        return () => {};
      },
      loadProfile,
      termsVersion: 'v1',
    });
    return { gate, loadProfile, emit: (s: UserDocState) => emit(s) };
  }

  const flush = () => new Promise((r) => setTimeout(r, 0));

  it('reads the profile once per uid and decides complete-profile', async () => {
    const { gate, loadProfile, emit } = setup(null);
    const seen: string[] = [];
    gate.onChange((d) => seen.push(d));
    emit({ uid: 'u1', loaded: false, doc: null });
    emit({ uid: 'u1', loaded: true, doc: { uid: 'u1' } as UserDoc });
    await flush();
    expect(loadProfile).toHaveBeenCalledTimes(1);
    expect(gate.decision).toBe('complete-profile');
    expect(seen).toEqual(['complete-profile']);
  });

  it('switches to reactivate when the mirror says deactivated', async () => {
    const { gate, emit } = setup({ termsVersion: 'v1' } as ProfileDoc);
    emit({ uid: 'u1', loaded: true, doc: { uid: 'u1', status: 'deactivated' } as UserDoc });
    await flush();
    expect(gate.decision).toBe('reactivate');
    emit({ uid: 'u1', loaded: true, doc: { uid: 'u1', status: 'active' } as UserDoc });
    expect(gate.decision).toBe('none');
  });

  it('resets on sign-out', async () => {
    const { gate, emit } = setup(null);
    emit({ uid: 'u1', loaded: true, doc: { uid: 'u1' } as UserDoc });
    await flush();
    expect(gate.decision).toBe('complete-profile');
    emit({ uid: null, loaded: false, doc: null });
    expect(gate.decision).toBe('none');
  });

  it('does not gate when the profile read fails', async () => {
    let emit: (s: UserDocState) => void = () => {};
    const gate = new AccountGate({
      onUserDoc: (cb) => { emit = cb; return () => {}; },
      loadProfile: vi.fn().mockRejectedValue(new Error('offline')),
      termsVersion: 'v1',
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    emit({ uid: 'u1', loaded: true, doc: { uid: 'u1' } as UserDoc });
    await flush();
    expect(gate.decision).toBe('none');
  });
});
