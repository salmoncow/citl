import { describe, it, expect } from 'vitest';
import { sparkline } from './sparkline';

describe('sparkline', () => {
  it('scales min to the bottom and max to the top of the padded box', () => {
    const g = sparkline([1, 3, 2], 100, 40, 4);
    expect(g.points).toBe('4,36 50,4 96,20');
    expect(g.last).toEqual({ x: 96, y: 20 });
  });

  it('draws a flat series at mid-height', () => {
    expect(sparkline([5, 5], 100, 40).points).toBe('4,20 96,20');
  });

  it('centres a single value', () => {
    expect(sparkline([7], 100, 40).last).toEqual({ x: 50, y: 20 });
  });

  it('returns an empty geometry for no data', () => {
    expect(sparkline([], 100, 40)).toEqual({ points: '', last: null });
  });
});
