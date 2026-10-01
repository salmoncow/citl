import { describe, expect, it, vi } from 'vitest';
import { AccountService, REQUIRES_RECENT_LOGIN, accountErrorMessage } from './account-service';
import type { ProfileRepository } from '@/repositories/profile-repository';

describe('accountErrorMessage', () => {
  it('maps requires-recent-login regardless of code', () => {
    expect(accountErrorMessage('functions/failed-precondition', REQUIRES_RECENT_LOGIN))
      .toMatch(/sign in again/);
  });

  it.each([
    ['functions/unauthenticated', /signed in/],
    ['functions/failed-precondition', /Owners and admins/],
    ['functions/not-found', /isn’t ready/],
    ['functions/resource-exhausted', /Too many/],
    ['functions/invalid-argument', /wasn’t valid/],
    ['permission-denied', /permission/],
    ['functions/unavailable', /connection/],
    ['functions/internal', /went wrong/],
  ])('maps %s', (code, pattern) => {
    expect(accountErrorMessage(code)).toMatch(pattern);
  });

  it('treats prefixed and bare codes alike', () => {
    expect(accountErrorMessage('failed-precondition'))
      .toBe(accountErrorMessage('functions/failed-precondition'));
  });
});

describe('AccountService callables', () => {
  const repo = {} as ProfileRepository;

  it('surfaces the requires-recent-login reason from error details', async () => {
    const err = Object.assign(new Error('stale'), {
      code: 'functions/failed-precondition',
      details: { reason: REQUIRES_RECENT_LOGIN },
    });
    const svc = new AccountService(repo, () => ({
      setAccountStatus: vi.fn(),
      deleteAccount: vi.fn().mockRejectedValue(err),
    }) as never);
    await expect(svc.deleteAccount()).resolves.toEqual({
      ok: false,
      code: 'functions/failed-precondition',
      reason: REQUIRES_RECENT_LOGIN,
      message: 'stale',
    });
  });

  it('returns the callable result on success', async () => {
    const svc = new AccountService(repo, () => ({
      setAccountStatus: vi.fn().mockResolvedValue({ data: { ok: true, status: 'deactivated', changed: true } }),
      deleteAccount: vi.fn(),
    }) as never);
    await expect(svc.setAccountStatus('deactivated'))
      .resolves.toEqual({ ok: true, status: 'deactivated', changed: true });
  });
});

describe('AccountService profile writes', () => {
  it('rejects invalid input without touching the repository', async () => {
    const create = vi.fn();
    const svc = new AccountService({ create } as unknown as ProfileRepository, () => ({}) as never);
    const r = await svc.completeProfile('u', { displayName: '  ' });
    expect(r).toMatchObject({ success: false, code: 'VALIDATION' });
    expect(create).not.toHaveBeenCalled();
  });

  it('passes normalized input and the current terms version', async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    const svc = new AccountService({ create } as unknown as ProfileRepository, () => ({}) as never);
    const r = await svc.completeProfile('u', { displayName: ' Pat ', phone: '' });
    expect(r).toEqual({ success: true, data: undefined });
    expect(create).toHaveBeenCalledWith('u', { displayName: 'Pat' }, expect.any(String));
  });
});
