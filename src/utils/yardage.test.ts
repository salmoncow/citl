import { describe, it, expect } from 'vitest';
import { lookupYardage } from './yardage';

describe('lookupYardage', () => {
  it('returns 16 for score of 0',       () => expect(lookupYardage(0)).toBe(16));
  it('returns 16 for score of 175.49',  () => expect(lookupYardage(175.49)).toBe(16));
  it('returns 17 for score of 175.50',  () => expect(lookupYardage(175.50)).toBe(17));
  it('returns 17 for score of 185.49',  () => expect(lookupYardage(185.49)).toBe(17));
  it('returns 27 for score of 215.50',  () => expect(lookupYardage(215.50)).toBe(27));
  it('returns 27 for score of 250.00',  () => expect(lookupYardage(250.00)).toBe(27));
  it('returns undefined above 250',     () => expect(lookupYardage(250.01)).toBeUndefined());
  it('returns correct value at each range boundary', () => {
    expect(lookupYardage(185.50)).toBe(18);
    expect(lookupYardage(187.50)).toBe(19);
    expect(lookupYardage(189.50)).toBe(20);
    expect(lookupYardage(191.50)).toBe(21);
    expect(lookupYardage(193.50)).toBe(22);
    expect(lookupYardage(196.50)).toBe(23);
    expect(lookupYardage(201.50)).toBe(24);
    expect(lookupYardage(207.50)).toBe(25);
    expect(lookupYardage(211.50)).toBe(26);
  });
});
