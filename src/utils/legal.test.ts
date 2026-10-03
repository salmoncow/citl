import { describe, expect, it } from 'vitest';
import { BASE_TERMS_VERSION, LEAGUE_TERMS_VERSION, TERMS_VERSION } from './legal';
// @ts-expect-error — plain JS fixture without type declarations
import { SEED_TERMS_VERSION } from '../../scripts/fixtures/seed-data.js';

describe('TERMS_VERSION', () => {
  it('is 1–20 characters (firestore.rules limit)', () => {
    for (const v of [TERMS_VERSION, BASE_TERMS_VERSION, LEAGUE_TERMS_VERSION]) {
      expect(v.length).toBeGreaterThanOrEqual(1);
      expect(v.length).toBeLessThanOrEqual(20);
    }
  });

  it('follows the league requests flag (off in unit tests)', () => {
    expect(TERMS_VERSION).toBe(BASE_TERMS_VERSION);
    expect(LEAGUE_TERMS_VERSION).not.toBe(BASE_TERMS_VERSION);
  });

  it('matches the emulator seed, where league requests are on by default, so seeded profiles are not asked to re-accept', () => {
    expect(SEED_TERMS_VERSION).toBe(LEAGUE_TERMS_VERSION);
  });
});
