import { describe, expect, it } from 'vitest';
import {
  DISPLAY_NAME_MAX,
  PHONE_MAX,
  normalizeDisplayName,
  normalizePhone,
  validateProfileInput,
} from './profile-validation';

describe('normalizeDisplayName', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeDisplayName('  Pat   Q  Shooter ')).toBe('Pat Q Shooter');
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

describe('validateProfileInput — display name', () => {
  it('rejects 0 chars after trim', () => {
    const r = validateProfileInput({ displayName: '   ' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.displayName).toBeDefined();
  });

  it('accepts 1 and 60 chars', () => {
    expect(validateProfileInput({ displayName: 'a' }).ok).toBe(true);
    expect(validateProfileInput({ displayName: 'a'.repeat(DISPLAY_NAME_MAX) }).ok).toBe(true);
  });

  it('rejects 61 chars', () => {
    expect(validateProfileInput({ displayName: 'a'.repeat(DISPLAY_NAME_MAX + 1) }).ok).toBe(false);
  });

  it('returns the normalized value', () => {
    expect(validateProfileInput({ displayName: ' Pat  Shooter ' }))
      .toEqual({ ok: true, value: { displayName: 'Pat Shooter' } });
  });
});

describe('validateProfileInput — phone', () => {
  it('omits an empty phone', () => {
    expect(validateProfileInput({ displayName: 'Pat', phone: ' ' }))
      .toEqual({ ok: true, value: { displayName: 'Pat' } });
  });

  it('accepts the allow-set', () => {
    expect(validateProfileInput({ displayName: 'Pat', phone: '+1 (217) 555-0100' }).ok).toBe(true);
    expect(validateProfileInput({ displayName: 'Pat', phone: '217.555.0100' }).ok).toBe(true);
  });

  it('accepts exactly 20 chars and rejects 21', () => {
    expect(validateProfileInput({ displayName: 'Pat', phone: '1'.repeat(PHONE_MAX) }).ok).toBe(true);
    const r = validateProfileInput({ displayName: 'Pat', phone: '1'.repeat(PHONE_MAX + 1) });
    expect(r.ok).toBe(false);
  });

  it('rejects letters and too-short numbers', () => {
    expect(validateProfileInput({ displayName: 'Pat', phone: '217-555-CALL' }).ok).toBe(false);
    expect(validateProfileInput({ displayName: 'Pat', phone: '12345' }).ok).toBe(false);
  });

  it('reports both errors together', () => {
    const r = validateProfileInput({ displayName: '', phone: 'x' });
    expect(r).toEqual({
      ok: false,
      errors: { displayName: expect.any(String), phone: expect.any(String) },
    });
  });
});
