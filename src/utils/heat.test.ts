import { describe, it, expect } from 'vitest';
import { heatBin } from './heat';

describe('heatBin', () => {
  it.each([
    [0, 1], [39, 1], [40, 2], [42, 2], [43, 3], [45, 3], [46, 4], [48, 4], [49, 5], [50, 5],
  ])('score %i → bin %i', (score, bin) => {
    expect(heatBin(score)).toBe(bin);
  });
});
