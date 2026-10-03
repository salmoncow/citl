/**
 * Pure validation and derivations for spec 009 member requests. Limits
 * mirror firestore.rules and the teamProposal callable
 * (functions/src/lib/roster.ts, functions/src/lib/validate.ts); those are
 * the enforcement, this is the friendly client-side message.
 */

import type { DependentInput, RosterEntryInput, ShooterLinkInput } from '@/types/league';
import { normalizeShooterName } from '@/services/scoring-engine';
import { NAME_PART_MAX, NAME_PART_PATTERN, normalizeNamePart } from '@/services/profile-validation';

export const ROSTER_MIN = 5;
export const ROSTER_MAX = 15;
export const DEPENDENTS_MAX = 6;
export const NOTE_MAX = 280;
export const LINK_NAME_MAX = 60;
export const TEAM_NAME_MIN = 2;
export const TEAM_NAME_MAX = 40;
export const MINOR_MAX_AGE_YEARS = 18;

/** Letters or digits first; then letters, digits, spaces and & ' . - */
export const TEAM_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}\p{M} &'.-]*$/u;

export type Check<T> = { ok: true; value: T } | { ok: false; error: string };

function namePartError(value: string, label: string): string | undefined {
  if (value.length === 0) return `Enter a ${label}.`;
  if (value.length > NAME_PART_MAX) return `The ${label} must be ${NAME_PART_MAX} characters or fewer.`;
  if (!NAME_PART_PATTERN.test(value)) return 'Use letters, spaces, apostrophes, periods or hyphens only.';
  return undefined;
}

// ─── Names ──────────────────────────────────────────────────────────────────

/** "Sam Doe" → "Sam D.": a minor's only public form (DD-3). Parity with the server. */
export function minorDisplayName(firstName: string, lastName: string): string {
  const initial = Array.from(lastName.trim())[0] ?? '';
  return `${firstName.trim()} ${initial.toLocaleUpperCase()}.`;
}

export function validateTeamName(raw: string): Check<string> {
  const value = raw.trim().replace(/\s+/g, ' ').replace(/[‘’]/g, "'");
  if (value.length < TEAM_NAME_MIN) return { ok: false, error: 'Enter a team name.' };
  if (value.length > TEAM_NAME_MAX) return { ok: false, error: `Team names are ${TEAM_NAME_MAX} characters or fewer.` };
  if (!TEAM_NAME_PATTERN.test(value)) return { ok: false, error: 'Use letters, numbers, spaces, or & \' . - only.' };
  return { ok: true, value };
}

/** Parity with season team doc ids (score-service _slugify) and the server. */
export function slugifyTeamName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

// ─── Seasons and ages ───────────────────────────────────────────────────────

/**
 * The season requests target (AC-19): the latest season unless it is
 * complete, else the year after it. A season doc with no status (made by
 * Add team or by a spec 010 approval for next season) is upcoming, so it
 * is the target. Clamped to this UTC year or next (the only
 * years the rules and callable accept).
 */
export function registrationYear(
  seasons: readonly { year: number; status: string }[],
  now: Date = new Date(),
): number {
  const thisYear = now.getUTCFullYear();
  const latest = [...seasons].sort((a, b) => b.year - a.year)[0];
  const target = !latest ? thisYear : latest.status === 'complete' ? latest.year + 1 : latest.year;
  return Math.min(Math.max(target, thisYear), thisYear + 1);
}

/** Under 18 by birth year (the rules bound): this year − 18 … this year. */
export function isMinorBirthYear(birthYear: number, now: Date = new Date()): boolean {
  const y = now.getUTCFullYear();
  return Number.isInteger(birthYear) && birthYear >= y - MINOR_MAX_AGE_YEARS && birthYear <= y;
}

/** Turns 18 this calendar year: still a dependent this season, not next. */
export function isAgingOut(birthYear: number, now: Date = new Date()): boolean {
  return birthYear === now.getUTCFullYear() - MINOR_MAX_AGE_YEARS;
}

// ─── Dependents ─────────────────────────────────────────────────────────────

export interface DependentFieldErrors {
  firstName?: string;
  lastName?: string;
  birthYear?: string;
}

export function validateDependentInput(
  input: { firstName: string; lastName: string; birthYear: string | number },
  now: Date = new Date(),
): { ok: true; value: DependentInput } | { ok: false; errors: DependentFieldErrors } {
  const firstName = normalizeNamePart(input.firstName);
  const lastName = normalizeNamePart(input.lastName);
  const birthYear = typeof input.birthYear === 'number' ? input.birthYear : Number(String(input.birthYear).trim());
  const errors: DependentFieldErrors = {};
  const f = namePartError(firstName, 'first name');
  if (f) errors.firstName = f;
  const l = namePartError(lastName, 'last name');
  if (l) errors.lastName = l;
  if (!Number.isInteger(birthYear) || String(input.birthYear).trim() === '') {
    errors.birthYear = 'Enter a four-digit birth year.';
  } else if (!isMinorBirthYear(birthYear, now)) {
    errors.birthYear = 'Dependents must be under 18. Anyone 18 or older signs up with their own account.';
  }
  if (errors.firstName || errors.lastName || errors.birthYear) return { ok: false, errors };
  return { ok: true, value: { firstName, lastName, birthYear } };
}

// ─── Registration and link request ─────────────────────────────────────────

export function normalizeNote(raw: string | null | undefined): Check<string | null> {
  const value = (raw ?? '').trim();
  if (value.length > NOTE_MAX) return { ok: false, error: `Notes are ${NOTE_MAX} characters or fewer.` };
  return { ok: true, value: value === '' ? null : value };
}

export function validateLinkInput(input: { shooterName: string; note?: string }): Check<ShooterLinkInput> {
  const shooterName = input.shooterName.trim().replace(/\s+/g, ' ');
  if (shooterName.length === 0) return { ok: false, error: 'Enter the name you shot under.' };
  if (shooterName.length > LINK_NAME_MAX) return { ok: false, error: `Names are ${LINK_NAME_MAX} characters or fewer.` };
  const note = normalizeNote(input.note);
  if (!note.ok) return note;
  return { ok: true, value: note.value ? { shooterName, note: note.value } : { shooterName } };
}

// ─── Roster ─────────────────────────────────────────────────────────────────

export interface RosterNameContext {
  /** The captain's roster name (approved link, else profile name). */
  selfName: string;
  dependents: ReadonlyMap<string, { firstName: string; lastName: string }>;
}

/** The name an entry will carry on the roster (what the server resolves). */
export function previewEntryName(entry: RosterEntryInput, ctx: RosterNameContext): string {
  switch (entry.kind) {
    case 'self':
      return ctx.selfName;
    case 'dependent': {
      const d = ctx.dependents.get(entry.dependentId);
      return d ? minorDisplayName(d.firstName, d.lastName) : '';
    }
    case 'named': {
      const first = normalizeNamePart(entry.firstName);
      const last = normalizeNamePart(entry.lastName);
      return entry.minor ? minorDisplayName(first, last) : `${first} ${last}`;
    }
  }
}

/**
 * Roster problems in the order a captain should fix them. Empty means the
 * server will accept the roster (for submit when `forSubmit`).
 */
export function rosterIssues(
  entries: readonly RosterEntryInput[],
  ctx: RosterNameContext,
  { forSubmit = false }: { forSubmit?: boolean } = {},
): string[] {
  const issues: string[] = [];
  if (entries.length > ROSTER_MAX) issues.push(`A roster can have at most ${ROSTER_MAX} shooters.`);
  const selfCount = entries.filter((e) => e.kind === 'self').length;
  if (selfCount > 1) issues.push('You can be on the roster only once.');

  entries.forEach((e, i) => {
    if (e.kind !== 'named') return;
    const fe = namePartError(normalizeNamePart(e.firstName), 'first name');
    const le = namePartError(normalizeNamePart(e.lastName), 'last name');
    if (fe || le) issues.push(`Shooter ${i + 1}: ${fe ?? le}`);
  });

  const names = entries.map((e) => previewEntryName(e, ctx));
  const seen = new Set<string>();
  names.forEach((n) => {
    if (!n) return;
    const key = normalizeShooterName(n);
    if (seen.has(key)) issues.push(`${n} is on the roster more than once.`);
    seen.add(key);
  });

  const adults = new Set(
    entries.flatMap((e, i) => (e.kind === 'dependent' || (e.kind === 'named' && e.minor) ? [] : [normalizeShooterName(names[i] ?? '')])),
  );
  entries.forEach((e, i) => {
    if (e.kind === 'dependent' && !ctx.dependents.has(e.dependentId)) {
      issues.push('A dependent on this roster is no longer on your account. Remove them.');
    }
    if (e.kind !== 'named' || !e.minor) return;
    if (!e.guardianName) issues.push(`${names[i]} is under 18. Choose their guardian.`);
    else if (!adults.has(normalizeShooterName(e.guardianName))) issues.push(`${names[i]}'s guardian must be an adult on this roster.`);
  });

  if (forSubmit) {
    if (entries.length < ROSTER_MIN) issues.push(`A team needs at least ${ROSTER_MIN} shooters.`);
    if (selfCount === 0) issues.push('Add yourself to the roster.');
  }
  return issues;
}
