import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JOIN_INTENT_KEY, JOIN_INTENT_TTL_MS, clearJoinIntent, hasFreshJoinIntent, markJoinIntent } from './join-intent';

describe('join intent', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });

  it('is fresh right after marking and within the TTL', () => {
    markJoinIntent(1_000);
    expect(hasFreshJoinIntent(1_000)).toBe(true);
    expect(hasFreshJoinIntent(1_000 + JOIN_INTENT_TTL_MS)).toBe(true);
  });

  it('expires after the TTL', () => {
    markJoinIntent(1_000);
    expect(hasFreshJoinIntent(1_001 + JOIN_INTENT_TTL_MS)).toBe(false);
  });

  it('is not fresh when missing, cleared, or garbage', () => {
    expect(hasFreshJoinIntent()).toBe(false);
    markJoinIntent();
    clearJoinIntent();
    expect(hasFreshJoinIntent()).toBe(false);
    localStorage.setItem(JOIN_INTENT_KEY, 'nope');
    expect(hasFreshJoinIntent()).toBe(false);
  });

  it('treats unavailable storage as no intent', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    });
    markJoinIntent();
    clearJoinIntent();
    expect(hasFreshJoinIntent()).toBe(false);
  });

  it('ignores a timestamp from the future', () => {
    markJoinIntent(5_000);
    expect(hasFreshJoinIntent(1_000)).toBe(false);
  });
});
