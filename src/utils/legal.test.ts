import { describe, expect, it } from 'vitest';
import { TERMS_VERSION } from './legal';
// @ts-expect-error — plain JS fixture without type declarations
import { SEED_TERMS_VERSION } from '../../scripts/fixtures/seed-data.js';

describe('TERMS_VERSION', () => {
  it('is 1–20 characters (firestore.rules limit)', () => {
    expect(TERMS_VERSION.length).toBeGreaterThanOrEqual(1);
    expect(TERMS_VERSION.length).toBeLessThanOrEqual(20);
  });

  it('matches the emulator seed so seeded profiles are not asked to re-accept', () => {
    expect(SEED_TERMS_VERSION).toBe(TERMS_VERSION);
  });
});
