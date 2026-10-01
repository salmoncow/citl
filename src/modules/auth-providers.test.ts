import { describe, expect, it, vi } from 'vitest';

vi.mock('@/firebase-config', () => ({ auth: { currentUser: null } }));
vi.mock('firebase/auth', () => {
  class GoogleAuthProvider {
    static credentialFromError = vi.fn(() => null);
  }
  class OAuthProvider {
    constructor(public providerId: string) {}
    setCustomParameters = vi.fn();
    static credentialFromError = vi.fn((err: { _cred?: unknown }) => err._cred ?? null);
  }
  return {
    GoogleAuthProvider,
    OAuthProvider,
    EmailAuthProvider: {},
    isSignInWithEmailLink: vi.fn(),
    linkWithCredential: vi.fn(),
    linkWithPopup: vi.fn(),
    reauthenticateWithCredential: vi.fn(),
    reauthenticateWithPopup: vi.fn(),
    sendSignInLinkToEmail: vi.fn(),
    signInWithEmailLink: vi.fn(),
    signInWithPopup: vi.fn(),
    unlink: vi.fn(),
  };
});

const {
  canUnlink,
  extractAccountExists,
  looksLikeEmailLink,
  parseEnabledProviders,
  providerKeyOf,
  authErrorMessage,
  emailLinkContinueUrl,
} = await import('./auth-providers');

describe('parseEnabledProviders', () => {
  it('defaults to all providers when unset or empty', () => {
    expect(parseEnabledProviders(undefined)).toEqual(['google', 'microsoft', 'email']);
    expect(parseEnabledProviders('')).toEqual(['google', 'microsoft', 'email']);
    expect(parseEnabledProviders(' , ')).toEqual(['google', 'microsoft', 'email']);
  });

  it('keeps order, trims, lowercases, drops unknown and duplicates', () => {
    expect(parseEnabledProviders(' Email, google ,apple,google')).toEqual(['email', 'google']);
  });

  it('falls back to all when only unknown names are given', () => {
    expect(parseEnabledProviders('apple')).toEqual(['google', 'microsoft', 'email']);
  });
});

describe('canUnlink', () => {
  it('is false with zero or one provider', () => {
    expect(canUnlink([])).toBe(false);
    expect(canUnlink([{ providerId: 'google.com' }])).toBe(false);
  });

  it('is true with two or more', () => {
    expect(canUnlink([{ providerId: 'google.com' }, { providerId: 'password' }])).toBe(true);
  });
});

describe('providerKeyOf', () => {
  it('maps Firebase provider ids to keys', () => {
    expect(providerKeyOf('google.com')).toBe('google');
    expect(providerKeyOf('microsoft.com')).toBe('microsoft');
    expect(providerKeyOf('password')).toBe('email');
    expect(providerKeyOf('apple.com')).toBeNull();
  });
});

describe('looksLikeEmailLink', () => {
  it('matches a Firebase sign-in link on the origin root', () => {
    expect(looksLikeEmailLink('https://citl.club/?apiKey=k&oobCode=abc&mode=signIn&lang=en')).toBe(true);
  });

  it('ignores a hash fragment after the query', () => {
    expect(looksLikeEmailLink('https://citl.club/?mode=signIn&oobCode=abc#/account')).toBe(true);
  });

  it('rejects other URLs', () => {
    expect(looksLikeEmailLink('https://citl.club/#/account')).toBe(false);
    expect(looksLikeEmailLink('https://citl.club/?mode=resetPassword&oobCode=abc')).toBe(false);
    expect(looksLikeEmailLink('https://citl.club/?mode=signIn')).toBe(false);
    expect(looksLikeEmailLink('https://citl.club/#/?mode=signIn&oobCode=x')).toBe(false);
  });
});

describe('extractAccountExists', () => {
  it('returns email and credential for account-exists errors', () => {
    const cred = { providerId: 'microsoft.com' };
    const err = {
      code: 'auth/account-exists-with-different-credential',
      customData: { email: 'pat@example.com' },
      _cred: cred,
    };
    expect(extractAccountExists(err)).toEqual({ email: 'pat@example.com', credential: cred });
  });

  it('returns null email when the error carries none', () => {
    const err = { code: 'auth/account-exists-with-different-credential', _cred: { providerId: 'google.com' } };
    expect(extractAccountExists(err)?.email).toBeNull();
  });

  it('returns null for other errors or when no credential is recoverable', () => {
    expect(extractAccountExists({ code: 'auth/popup-blocked' })).toBeNull();
    expect(extractAccountExists({ code: 'auth/account-exists-with-different-credential' })).toBeNull();
    expect(extractAccountExists(null)).toBeNull();
  });
});

describe('misc helpers', () => {
  it('continue URL is the origin root (DD-4)', () => {
    expect(emailLinkContinueUrl('https://citl.club')).toBe('https://citl.club/');
  });

  it('has a fallback error message', () => {
    expect(authErrorMessage('auth/whatever')).toMatch(/try again/);
    expect(authErrorMessage('auth/expired-action-code')).toMatch(/expired/);
  });
});
