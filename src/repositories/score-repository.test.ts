/**
 * Boundary-validation guards (deep-review F-09).
 *
 * These guards are the only thing standing between a corrupt or hand-edited
 * Firestore doc and silently wrong standings — a malformed doc must become a
 * failure('MALFORMED_DOC') Result, never NaN math.
 */

import { describe, it, expect } from 'vitest';
import { isValidWeekResult, isValidSeasonEntry } from './score-repository';

const validTeamResult = {
  teamId: 'hawks',
  teamName: 'Hawks',
  targets: 190,
  rankPoints: 28,
  bonusPoints: 5,
  shooterScores: [{ name: 'A', score1: 20, score2: 21, total: 41 }],
};

describe('isValidWeekResult', () => {
  it('accepts a well-formed week doc', () => {
    expect(isValidWeekResult({ weekNumber: 3, publishedAt: 'x', teamResults: [validTeamResult] })).toBe(true);
  });

  it('accepts legacy variance: null targets/rankPoints/bonusPoints (forfeits, non-participants)', () => {
    expect(isValidWeekResult({
      weekNumber: 3,
      teamResults: [{ ...validTeamResult, targets: null, rankPoints: null, bonusPoints: null }],
    })).toBe(true);
  });

  it('rejects a string where a number belongs (targets: "42")', () => {
    expect(isValidWeekResult({
      weekNumber: 3,
      teamResults: [{ ...validTeamResult, targets: '42' }],
    })).toBe(false);
  });

  it('rejects a missing teamResults array', () => {
    expect(isValidWeekResult({ weekNumber: 3 })).toBe(false);
  });

  it('rejects a non-numeric weekNumber', () => {
    expect(isValidWeekResult({ weekNumber: 'three', teamResults: [] })).toBe(false);
  });
});

describe('isValidSeasonEntry', () => {
  const validEntry = {
    year: 2026, weekNumber: 2, teamId: 'hawks', teamName: 'Hawks', savedAt: 'x',
    shooters: [{ name: 'A', score1: 20, score2: 22, total: 42 }],
  };

  it('accepts a well-formed entry', () => {
    expect(isValidSeasonEntry(validEntry)).toBe(true);
  });

  it('rejects a string total (total: "42") — entries feed publish math directly', () => {
    expect(isValidSeasonEntry({
      ...validEntry,
      shooters: [{ name: 'A', score1: 20, score2: 22, total: '42' }],
    })).toBe(false);
  });

  it('rejects a missing shooters array', () => {
    const { shooters: _drop, ...noShooters } = validEntry;
    expect(isValidSeasonEntry(noShooters)).toBe(false);
  });

  it('rejects an empty teamName', () => {
    expect(isValidSeasonEntry({ ...validEntry, teamName: '' })).toBe(false);
  });
});
