import { describe, it, expect } from 'vitest';
import { YARDAGE_TABLE, lookupYardage } from './yardage';

describe('lookupYardage', () => {
  it('maps every row boundary to its own row', () => {
    for (const row of YARDAGE_TABLE) {
      expect(lookupYardage(row.min)?.yards).toBe(row.yards);
      expect(lookupYardage(row.max)?.yards).toBe(row.yards);
    }
  });

  it('closes the gap between rows by rounding to 2 decimals', () => {
    expect(lookupYardage(175.494)?.yards).toBe(16);
    expect(lookupYardage(175.495)?.yards).toBe(17);
    expect(lookupYardage(210.9)?.yards).toBe(25);
  });

  it('clamps totals above 250 and rejects invalid totals', () => {
    expect(lookupYardage(260)?.yards).toBe(27);
    expect(lookupYardage(-1)).toBeNull();
    expect(lookupYardage(Number.NaN)).toBeNull();
  });
});
