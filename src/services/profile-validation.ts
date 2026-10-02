/**
 * Pure profile validation (spec 008 AC-11). Limits mirror the
 * isValidProfile() checks in firestore.rules; the rules are the
 * enforcement, this is the friendly client-side message.
 */

import type { ProfileInput } from '@/types/account';
export { joinName } from '@/utils/person-name';

/** Per-part limit for first and last name. */
export const NAME_PART_MAX = 30;
export const PHONE_MIN = 7;
export const PHONE_MAX = 20;

/** Same pattern as firestore.rules: digits, space and + ( ) - . */
export const PHONE_PATTERN = /^[0-9+() .-]{7,20}$/;

/**
 * Same pattern as firestore.rules: starts with a letter; then letters,
 * spaces, apostrophes, periods and hyphens ("Mary-Kate", "O'Brien",
 * "St. John", "José"). No digits or other symbols, so names line up with
 * roster names.
 */
export const NAME_PART_PATTERN = /^\p{L}[\p{L}\p{M} .'-]*$/u;

/** Trim, collapse internal whitespace, and use a straight apostrophe. */
export function normalizeNamePart(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').replace(/[\u2018\u2019]/g, "'");
}

/**
 * Best-effort split of a legacy single-field name: last word is the last
 * name. Used only to prefill the edit form for profiles made before the
 * name was split.
 */
export function splitLegacyName(displayName: string): { firstName: string; lastName: string } {
  const parts = normalizeNamePart(displayName).split(' ').filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? '', lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1]! };
}

/** Trim; an empty result means "no phone". */
export function normalizePhone(raw: string | undefined): string | undefined {
  const trimmed = (raw ?? '').trim();
  return trimmed === '' ? undefined : trimmed;
}

export interface ProfileFieldErrors {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export type ProfileValidation =
  | { ok: true; value: ProfileInput }
  | { ok: false; errors: ProfileFieldErrors };

function namePartError(value: string, label: string): string | undefined {
  if (value.length === 0) return `Enter your ${label}.`;
  if (value.length > NAME_PART_MAX) return `${label[0]!.toUpperCase()}${label.slice(1)} must be ${NAME_PART_MAX} characters or fewer.`;
  if (!NAME_PART_PATTERN.test(value)) return 'Use letters, spaces, apostrophes, periods or hyphens only.';
  return undefined;
}

export function validateProfileInput(input: ProfileInput): ProfileValidation {
  const firstName = normalizeNamePart(input.firstName);
  const lastName = normalizeNamePart(input.lastName);
  const phone = normalizePhone(input.phone);
  const errors: ProfileFieldErrors = {};

  const firstErr = namePartError(firstName, 'first name');
  if (firstErr) errors.firstName = firstErr;
  const lastErr = namePartError(lastName, 'last name');
  if (lastErr) errors.lastName = lastErr;

  if (phone !== undefined) {
    if (phone.length > PHONE_MAX) {
      errors.phone = `Phone must be ${PHONE_MAX} characters or fewer.`;
    } else if (!PHONE_PATTERN.test(phone)) {
      errors.phone = `Use ${PHONE_MIN}–${PHONE_MAX} digits, spaces, or + ( ) - . only.`;
    }
  }

  if (errors.firstName || errors.lastName || errors.phone) return { ok: false, errors };
  const value: ProfileInput = { firstName, lastName };
  if (phone !== undefined) value.phone = phone;
  return { ok: true, value };
}
