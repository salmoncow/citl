/**
 * Pure tests for functions/src/lib/roster.ts (spec 009 AC-6, DD-3, DD-4).
 */

import { describe, expect, it } from 'vitest';
import {
  assertSubmittable,
  minorDisplayName,
  normalizeName,
  refreshRoster,
  resolveRoster,
  slugifyTeamName,
  type RosterEntry,
} from '../../functions/src/lib/roster.js';
import { normalizeShooterName } from '../../src/services/scoring-engine.js';

const ctx = { selfName: 'Pat Captain', dependents: new Map([['d1', { firstName: 'Sam', lastName: 'Doe' }]]) };

describe('name helpers', () => {
  it('minorDisplayName keeps the first name and one upper-case initial', () => {
    expect(minorDisplayName('Sam', 'doe')).toBe('Sam D.');
    expect(minorDisplayName(' Zoë ', 'Ølsen-Park')).toBe('Zoë Ø.');
    expect(minorDisplayName('Mary Kate', "o'Neil")).toBe("Mary Kate O.");
  });

  it('normalizeName matches the client normalizeShooterName', () => {
    for (const n of ['  Pat Shooter ', 'ZOË', 'a-b']) expect(normalizeName(n)).toBe(normalizeShooterName(n));
  });

  it('slugifyTeamName matches season team doc ids', () => {
    expect(slugifyTeamName(' Crazy   Guns ')).toBe('crazy-guns');
    expect(slugifyTeamName('Pull & Pray')).toBe('pull-&-pray');
  });
});

describe('resolveRoster', () => {
  it('resolves every entry kind', () => {
    const roster = resolveRoster([
      { kind: 'self', rookie: false },
      { kind: 'dependent', dependentId: 'd1', rookie: true },
      { kind: 'named', firstName: 'Al', lastName: 'One', rookie: false, minor: false },
      { kind: 'named', firstName: 'Kim', lastName: 'Lee', rookie: true, minor: true, guardianName: 'al one' },
    ], ctx);
    expect(roster).toEqual([
      { kind: 'self', name: 'Pat Captain', rookie: false, minor: false },
      { kind: 'dependent', name: 'Sam D.', rookie: true, minor: true, dependentId: 'd1' },
      { kind: 'named', name: 'Al One', rookie: false, minor: false },
      { kind: 'named', name: 'Kim L.', rookie: true, minor: true, guardianName: 'al one' },
    ]);
  });

  it('allows the captain as guardian and an empty draft', () => {
    expect(() => resolveRoster([
      { kind: 'self', rookie: false },
      { kind: 'named', firstName: 'Kim', lastName: 'Lee', rookie: false, minor: true, guardianName: 'Pat Captain' },
    ], ctx)).not.toThrow();
    expect(resolveRoster([], ctx)).toEqual([]);
  });

  it('rejects a duplicate between a dependent and a named minor', () => {
    expect(() => resolveRoster([
      { kind: 'dependent', dependentId: 'd1', rookie: false },
      { kind: 'named', firstName: 'Sam', lastName: 'Dee', rookie: false, minor: true, guardianName: 'Pat Captain' },
      { kind: 'self', rookie: false },
    ], ctx)).toThrow(expect.objectContaining({ reason: 'duplicate-name' }));
  });
});

describe('assertSubmittable and refreshRoster', () => {
  const five: RosterEntry[] = [
    { kind: 'self', name: 'Old Name', rookie: false, minor: false },
    { kind: 'dependent', name: 'Old D.', rookie: false, minor: true, dependentId: 'd1' },
    ...['A', 'B', 'C'].map((l): RosterEntry => ({ kind: 'named', name: `${l} Person`, rookie: false, minor: false })),
  ];

  it('accepts 5 and 15 with one self; rejects 4', () => {
    expect(() => assertSubmittable(five)).not.toThrow();
    const fifteen = [...five, ...'DEFGHIJKLM'.split('').map((l): RosterEntry => ({ kind: 'named', name: `${l} P`, rookie: false, minor: false }))];
    expect(fifteen).toHaveLength(15);
    expect(() => assertSubmittable(fifteen)).not.toThrow();
    expect(() => assertSubmittable(five.slice(0, 4))).toThrow(expect.objectContaining({ reason: 'roster-too-short' }));
  });

  it('refreshes self and dependent names, keeps named entries', () => {
    const out = refreshRoster(five, ctx);
    expect(out.map((e) => e.name)).toEqual(['Pat Captain', 'Sam D.', 'A Person', 'B Person', 'C Person']);
  });
});
