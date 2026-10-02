import { describe, expect, it } from 'vitest';
import {
  NAME_PART_MAX,
  PHONE_MAX,
  joinName,
  normalizeNamePart,
  normalizePhone,
  splitLegacyName,
  validateProfileInput,
} from './profile-validation';

const PAT = { firstName: 'Pat', lastName: 'Shooter' };

describe('normalizeNamePart', () => {
  it('trims, collapses whitespace and straightens apostrophes', () => {
    expect(normalizeNamePart('  Mary   Kate ')).toBe('Mary Kate');
    expect(normalizeNamePart('O\u2019Brien')).toBe("O'Brien");
  });
});

describe('joinName', () => {
  it('joins with one space', () => {
    expect(joinName('Pat', 'Shooter')).toBe('Pat Shooter');
  });
});

describe('splitLegacyName', () => {
  it('uses the last word as the last name', () => {
    expect(splitLegacyName('Pat Q Shooter')).toEqual({ firstName: 'Pat Q', lastName: 'Shooter' });
    expect(splitLegacyName('  Tyler   Smith ')).toEqual({ firstName: 'Tyler', lastName: 'Smith' });
  });

  it('puts a single word in firstName', () => {
    expect(splitLegacyName('Pat')).toEqual({ firstName: 'Pat', lastName: '' });
    expect(splitLegacyName('')).toEqual({ firstName: '', lastName: '' });
  });
});

describe('normalizePhone', () => {
  it('returns undefined for empty or whitespace', () => {
    expect(normalizePhone('')).toBeUndefined();
    expect(normalizePhone('   ')).toBeUndefined();
    expect(normalizePhone(undefined)).toBeUndefined();
  });

  it('trims', () => {
    expect(normalizePhone(' 217 555 0100 ')).toBe('217 555 0100');
  });
});

describe('validateProfileInput — name', () => {
  it('requires both parts', () => {
    const r = validateProfileInput({ firstName: '   ', lastName: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.firstName).toBe('Enter your first name.');
      expect(r.errors.lastName).toBe('Enter your last name.');
    }
  });

  it('accepts 30 chars and rejects 31', () => {
    expect(validateProfileInput({ firstName: 'a'.repeat(NAME_PART_MAX), lastName: 'B' }).ok).toBe(true);
    expect(validateProfileInput({ firstName: 'A', lastName: 'b'.repeat(NAME_PART_MAX + 1) }).ok).toBe(false);
  });

  it('accepts hyphens, apostrophes, periods, spaces and accents', () => {
    expect(validateProfileInput({ firstName: 'Mary-Kate', lastName: "O'Brien" }).ok).toBe(true);
    expect(validateProfileInput({ firstName: 'José', lastName: 'St. John' }).ok).toBe(true);
    expect(validateProfileInput({ firstName: 'Zoë', lastName: 'Ng\u2019' }).ok).toBe(true);
  });

  it('rejects digits, symbols, or a leading non-letter', () => {
    expect(validateProfileInput({ firstName: 'Pat2', lastName: 'Shooter' }).ok).toBe(false);
    expect(validateProfileInput({ firstName: 'Pat', lastName: 'Shooter!' }).ok).toBe(false);
    expect(validateProfileInput({ firstName: '-Pat', lastName: 'Shooter' }).ok).toBe(false);
    expect(validateProfileInput({ firstName: '<b>', lastName: 'Shooter' }).ok).toBe(false);
  });

  it('returns the normalized value', () => {
    expect(validateProfileInput({ firstName: ' Pat ', lastName: ' Van  Dyke ' }))
      .toEqual({ ok: true, value: { firstName: 'Pat', lastName: 'Van Dyke' } });
  });
});

describe('validateProfileInput — phone', () => {
  it('omits an empty phone', () => {
    expect(validateProfileInput({ ...PAT, phone: ' ' }))
      .toEqual({ ok: true, value: { ...PAT } });
  });

  it('accepts the allow-set', () => {
    expect(validateProfileInput({ ...PAT, phone: '+1 (217) 555-0100' }).ok).toBe(true);
    expect(validateProfileInput({ ...PAT, phone: '217.555.0100' }).ok).toBe(true);
  });

  it('accepts exactly 20 chars and rejects 21', () => {
    expect(validateProfileInput({ ...PAT, phone: '1'.repeat(PHONE_MAX) }).ok).toBe(true);
    const r = validateProfileInput({ ...PAT, phone: '1'.repeat(PHONE_MAX + 1) });
    expect(r.ok).toBe(false);
  });

  it('rejects letters and too-short numbers', () => {
    expect(validateProfileInput({ ...PAT, phone: '217-555-CALL' }).ok).toBe(false);
    expect(validateProfileInput({ ...PAT, phone: '12345' }).ok).toBe(false);
  });

  it('reports both errors together', () => {
    const r = validateProfileInput({ firstName: '', lastName: '', phone: 'x' });
    expect(r).toEqual({
      ok: false,
      errors: { firstName: expect.any(String), lastName: expect.any(String), phone: expect.any(String) },
    });
  });
});
