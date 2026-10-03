import { describe, expect, it } from 'vitest';
import {
  isAgingOut,
  isMinorBirthYear,
  minorDisplayName,
  normalizeNote,
  previewEntryName,
  registrationYear,
  rosterIssues,
  slugifyTeamName,
  validateDependentInput,
  validateLinkInput,
  validateTeamName,
} from './league-validation';
import type { RosterEntryInput } from '@/types/league';

const NOW = new Date(Date.UTC(2026, 9, 3));
const ctx = { selfName: 'Pat Captain', dependents: new Map([['d1', { firstName: 'Sam', lastName: 'doe' }]]) };
const named = (firstName: string, lastName: string, extra: Partial<RosterEntryInput> = {}): RosterEntryInput =>
  ({ kind: 'named', firstName, lastName, rookie: false, minor: false, ...extra }) as RosterEntryInput;

describe('minorDisplayName', () => {
  it('keeps the first name and an upper-case initial', () => {
    expect(minorDisplayName('Sam', 'doe')).toBe('Sam D.');
    expect(minorDisplayName('Zoë', 'Ølsen')).toBe('Zoë Ø.');
  });
});

describe('validateTeamName', () => {
  it('accepts 2 and 40 chars, normalizes spaces', () => {
    expect(validateTeamName('  Pull   &  Pray ')).toEqual({ ok: true, value: 'Pull & Pray' });
    expect(validateTeamName('AB').ok).toBe(true);
    expect(validateTeamName('A'.repeat(40)).ok).toBe(true);
  });

  it('rejects 1 and 41 chars and symbols', () => {
    expect(validateTeamName('A').ok).toBe(false);
    expect(validateTeamName('A'.repeat(41)).ok).toBe(false);
    expect(validateTeamName('Guns!').ok).toBe(false);
    expect(validateTeamName('-Guns').ok).toBe(false);
  });

  it('slugifies like season team ids', () => {
    expect(slugifyTeamName(' Crazy  Guns ')).toBe('crazy-guns');
  });
});

describe('registrationYear', () => {
  it('targets an active latest season, else the next year', () => {
    expect(registrationYear([{ year: 2026, status: 'active' }, { year: 2025, status: 'complete' }], NOW)).toBe(2026);
    expect(registrationYear([{ year: 2026, status: 'complete' }], NOW)).toBe(2027);
  });

  it('clamps to this year or next', () => {
    expect(registrationYear([{ year: 2024, status: 'complete' }], NOW)).toBe(2026);
    expect(registrationYear([{ year: 2027, status: 'complete' }], NOW)).toBe(2027);
    expect(registrationYear([], NOW)).toBe(2026);
  });
});

describe('birth years', () => {
  it('under 18 is this year − 18 … this year', () => {
    expect(isMinorBirthYear(2008, NOW)).toBe(true);
    expect(isMinorBirthYear(2026, NOW)).toBe(true);
    expect(isMinorBirthYear(2007, NOW)).toBe(false);
    expect(isMinorBirthYear(2027, NOW)).toBe(false);
  });

  it('flags the year a dependent turns 18', () => {
    expect(isAgingOut(2008, NOW)).toBe(true);
    expect(isAgingOut(2009, NOW)).toBe(false);
  });

  it('validateDependentInput normalizes and checks each field', () => {
    expect(validateDependentInput({ firstName: ' Sam ', lastName: 'Doe', birthYear: '2014' }, NOW))
      .toEqual({ ok: true, value: { firstName: 'Sam', lastName: 'Doe', birthYear: 2014 } });
    const bad = validateDependentInput({ firstName: '', lastName: '1', birthYear: '2000' }, NOW);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(['birthYear', 'firstName', 'lastName']);
    expect(validateDependentInput({ firstName: 'A', lastName: 'B', birthYear: '' }, NOW).ok).toBe(false);
  });
});

describe('notes and link requests', () => {
  it('empty note is null; 281 chars rejected', () => {
    expect(normalizeNote('  ')).toEqual({ ok: true, value: null });
    expect(normalizeNote('x'.repeat(281)).ok).toBe(false);
  });

  it('validateLinkInput trims and bounds the name', () => {
    expect(validateLinkInput({ shooterName: ' Pat  Shooter ', note: '' })).toEqual({ ok: true, value: { shooterName: 'Pat Shooter' } });
    expect(validateLinkInput({ shooterName: '' }).ok).toBe(false);
    expect(validateLinkInput({ shooterName: 'x'.repeat(61) }).ok).toBe(false);
  });
});

describe('rosterIssues', () => {
  const four = [named('Al', 'One'), named('Bo', 'Two'), named('Cy', 'Three'), named('Di', 'Four')];

  it('previews server names', () => {
    expect(previewEntryName({ kind: 'self', rookie: false }, ctx)).toBe('Pat Captain');
    expect(previewEntryName({ kind: 'dependent', dependentId: 'd1', rookie: false }, ctx)).toBe('Sam D.');
    expect(previewEntryName(named('Kim', 'lee', { minor: true }), ctx)).toBe('Kim L.');
  });

  it('a valid roster of 5 has no issues for submit', () => {
    expect(rosterIssues([{ kind: 'self', rookie: false }, ...four], ctx, { forSubmit: true })).toEqual([]);
  });

  it('drafts may be short; submit needs 5 and the captain', () => {
    expect(rosterIssues([named('Al', 'One')], ctx)).toEqual([]);
    expect(rosterIssues(four, ctx, { forSubmit: true })).toEqual([
      'A team needs at least 5 shooters.',
      'Add yourself to the roster.',
    ]);
  });

  it('flags 16 entries, duplicates, missing and minor guardians, and gone dependents', () => {
    const sixteen = Array.from({ length: 16 }, (_, i) => named('Shooter', `N${String.fromCharCode(65 + i)}`));
    expect(rosterIssues(sixteen, ctx)[0]).toMatch(/at most 15/);
    expect(rosterIssues([named('Al', 'One'), named('al', 'one')], ctx)).toEqual(['al one is on the roster more than once.']);
    expect(rosterIssues([named('Kim', 'Lee', { minor: true })], ctx)).toEqual(['Kim L. is under 18. Choose their guardian.']);
    expect(rosterIssues([
      { kind: 'dependent', dependentId: 'd1', rookie: false },
      named('Kim', 'Lee', { minor: true, guardianName: 'Sam D.' }),
    ], ctx)).toEqual(["Kim L.'s guardian must be an adult on this roster."]);
    expect(rosterIssues([{ kind: 'dependent', dependentId: 'gone', rookie: false }], ctx)).toEqual([
      'A dependent on this roster is no longer on your account. Remove them.',
    ]);
  });

  it('accepts the captain as guardian', () => {
    expect(rosterIssues([{ kind: 'self', rookie: false }, named('Kim', 'Lee', { minor: true, guardianName: 'Pat Captain' })], ctx)).toEqual([]);
  });
});
