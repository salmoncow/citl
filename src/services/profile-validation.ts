/**
 * Pure profile validation (spec 008 AC-11). Limits mirror the
 * isValidProfile() checks in firestore.rules; the rules are the
 * enforcement, this is the friendly client-side message.
 */

import type { ProfileInput } from '@/types/account';

export const DISPLAY_NAME_MAX = 60;
export const PHONE_MIN = 7;
export const PHONE_MAX = 20;
/** Same pattern as firestore.rules: digits, space and + ( ) - . */
export const PHONE_PATTERN = /^[0-9+() .-]{7,20}$/;

/** Trim and collapse internal whitespace runs to one space. */
export function normalizeDisplayName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/** Trim; an empty result means "no phone". */
export function normalizePhone(raw: string | undefined): string | undefined {
  const trimmed = (raw ?? '').trim();
  return trimmed === '' ? undefined : trimmed;
}

export interface ProfileFieldErrors {
  displayName?: string;
  phone?: string;
}

export type ProfileValidation =
  | { ok: true; value: ProfileInput }
  | { ok: false; errors: ProfileFieldErrors };

export function validateProfileInput(input: ProfileInput): ProfileValidation {
  const displayName = normalizeDisplayName(input.displayName);
  const phone = normalizePhone(input.phone);
  const errors: ProfileFieldErrors = {};

  if (displayName.length === 0) {
    errors.displayName = 'Enter your name.';
  } else if (displayName.length > DISPLAY_NAME_MAX) {
    errors.displayName = `Name must be ${DISPLAY_NAME_MAX} characters or fewer.`;
  }

  if (phone !== undefined) {
    if (phone.length > PHONE_MAX) {
      errors.phone = `Phone must be ${PHONE_MAX} characters or fewer.`;
    } else if (!PHONE_PATTERN.test(phone)) {
      errors.phone = `Use ${PHONE_MIN}–${PHONE_MAX} digits, spaces, or + ( ) - . only.`;
    }
  }

  if (errors.displayName || errors.phone) return { ok: false, errors };
  return { ok: true, value: phone === undefined ? { displayName } : { displayName, phone } };
}
