/**
 * Tests for src/utils/schedule.ts
 *
 * Business rules under test:
 *  - Practice day:  2nd Tuesday of April
 *  - Week 1:        3rd Tuesday of April
 *  - Season length: exactly 15 shoot weeks
 *  - July 4 skip:   if July 4 falls Mon–Fri, the Tuesday of that Sun–Sat week
 *                   is skipped; a holiday event is added for July 4 itself
 *  - No July 4 skip when July 4 falls on a weekend
 *  - All shoot days must be Tuesdays
 *  - Week numbers must be sequential 1–15
 *
 * Reference years used:
 *  2025 — July 4 = Friday  → skip July 1 (Tuesday of that week)
 *  2026 — July 4 = Saturday → no skip, no holiday
 *  2023 — July 4 = Tuesday → July 4 itself is the skipped Tuesday
 *  2022 — July 4 = Monday  → skip July 5 (Tuesday of that week)
 */

import { describe, it, expect } from 'vitest';
import { nthTuesdayOfMonth, computeSchedule, currentShootWeek } from './schedule';

// ─── nthTuesdayOfMonth ──────────────────────────────────────────────────────

describe('nthTuesdayOfMonth', () => {
  // April 1, 2025 is itself a Tuesday, so 1st=Apr 1, 2nd=Apr 8, 3rd=Apr 15
  it('returns the 2nd Tuesday of April 2025 (practice day)', () => {
    expect(nthTuesdayOfMonth(2025, 3, 2)).toEqual(new Date(2025, 3, 8));
  });

  it('returns the 3rd Tuesday of April 2025 (Week 1)', () => {
    expect(nthTuesdayOfMonth(2025, 3, 3)).toEqual(new Date(2025, 3, 15));
  });

  // April 1, 2026 is a Wednesday — 1st Tuesday = Apr 7
  it('returns the correct 2nd Tuesday when the month starts mid-week', () => {
    expect(nthTuesdayOfMonth(2026, 3, 2)).toEqual(new Date(2026, 3, 14));
  });

  it('returns the correct 3rd Tuesday for a year where April starts on a Wednesday', () => {
    expect(nthTuesdayOfMonth(2026, 3, 3)).toEqual(new Date(2026, 3, 21));
  });
});

// ─── computeSchedule ────────────────────────────────────────────────────────

describe('computeSchedule — invariants (all years)', () => {
  const testYears = [2022, 2023, 2024, 2025, 2026, 2027];

  it('always produces exactly 15 shoot events', () => {
    for (const year of testYears) {
      const shoots = computeSchedule(year).filter((e) => e.type === 'shoot');
      expect(shoots, `year ${year}`).toHaveLength(15);
    }
  });

  it('all shoot events fall on a Tuesday (day 2)', () => {
    for (const year of testYears) {
      const shoots = computeSchedule(year).filter((e) => e.type === 'shoot');
      for (const e of shoots) {
        expect(e.date.getDay(), `year ${year} shoot on ${e.date.toDateString()}`).toBe(2);
      }
    }
  });

  it('shoot week numbers are sequential 1–15', () => {
    for (const year of testYears) {
      const weeks = computeSchedule(year)
        .filter((e) => e.type === 'shoot')
        .map((e) => e.week);
      expect(weeks, `year ${year}`).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    }
  });

  it('always has exactly one practice event', () => {
    for (const year of testYears) {
      const practice = computeSchedule(year).filter((e) => e.type === 'practice');
      expect(practice, `year ${year}`).toHaveLength(1);
    }
  });
});

describe('computeSchedule — practice and Week 1 placement', () => {
  it('practice falls on the 2nd Tuesday of April', () => {
    const schedule = computeSchedule(2025);
    const practice = schedule.find((e) => e.type === 'practice');
    expect(practice?.date).toEqual(new Date(2025, 3, 8)); // April 8, 2025
  });

  it('Week 1 falls on the 3rd Tuesday of April', () => {
    const schedule = computeSchedule(2025);
    const week1 = schedule.find((e) => e.type === 'shoot' && e.week === 1);
    expect(week1?.date).toEqual(new Date(2025, 3, 15)); // April 15, 2025
  });

  it('practice falls one week before Week 1', () => {
    for (const year of [2024, 2025, 2026]) {
      const schedule = computeSchedule(year);
      const practice = schedule.find((e) => e.type === 'practice');
      const week1 = schedule.find((e) => e.type === 'shoot' && e.week === 1);
      const diffDays =
        ((week1!.date.getTime() - practice!.date.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays, `year ${year}`).toBe(7);
    }
  });
});

describe('computeSchedule — July 4 weekday skip (2025: July 4 = Friday)', () => {
  const schedule2025 = computeSchedule(2025);
  const shoots2025 = schedule2025.filter((e) => e.type === 'shoot');

  it('adds a holiday event on July 4', () => {
    const holiday = schedule2025.find((e) => e.type === 'holiday');
    expect(holiday).toBeDefined();
    expect(holiday?.date).toEqual(new Date(2025, 6, 4)); // July 4, 2025
  });

  it('skips July 1 (the Tuesday of the July 4 week)', () => {
    const july1Shoot = shoots2025.find(
      (e) => e.date.getMonth() === 6 && e.date.getDate() === 1,
    );
    expect(july1Shoot).toBeUndefined();
  });

  it('the 14-day gap appears exactly once across the season', () => {
    let gapCount = 0;
    for (let i = 1; i < shoots2025.length; i++) {
      const diff =
        (shoots2025[i]!.date.getTime() - shoots2025[i - 1]!.date.getTime()) /
        (1000 * 60 * 60 * 24);
      if (diff === 14) gapCount++;
      expect([7, 14]).toContain(diff);
    }
    expect(gapCount).toBe(1);
  });
});

describe('computeSchedule — July 4 is the Tuesday itself (2023: July 4 = Tuesday)', () => {
  const schedule2023 = computeSchedule(2023);
  const shoots2023 = schedule2023.filter((e) => e.type === 'shoot');

  it('adds a holiday event on July 4', () => {
    const holiday = schedule2023.find((e) => e.type === 'holiday');
    expect(holiday?.date).toEqual(new Date(2023, 6, 4));
  });

  it('July 4 (the Tuesday) itself is not a shoot event', () => {
    const july4Shoot = shoots2023.find(
      (e) => e.date.getMonth() === 6 && e.date.getDate() === 4,
    );
    expect(july4Shoot).toBeUndefined();
  });

  it('still produces exactly 15 shoot weeks', () => {
    expect(shoots2023).toHaveLength(15);
  });
});

describe('computeSchedule — July 4 weekday skip (2022: July 4 = Monday)', () => {
  const schedule2022 = computeSchedule(2022);
  const shoots2022 = schedule2022.filter((e) => e.type === 'shoot');

  it('skips July 5 (the Tuesday of the July 4 week)', () => {
    const july5Shoot = shoots2022.find(
      (e) => e.date.getMonth() === 6 && e.date.getDate() === 5,
    );
    expect(july5Shoot).toBeUndefined();
  });

  it('still produces exactly 15 shoot weeks', () => {
    expect(shoots2022).toHaveLength(15);
  });
});

describe('computeSchedule — no July 4 skip (2026: July 4 = Saturday)', () => {
  const schedule2026 = computeSchedule(2026);
  const shoots2026 = schedule2026.filter((e) => e.type === 'shoot');

  it('produces no holiday event', () => {
    const holiday = schedule2026.find((e) => e.type === 'holiday');
    expect(holiday).toBeUndefined();
  });

  it('all consecutive shoot weeks are exactly 7 days apart', () => {
    for (let i = 1; i < shoots2026.length; i++) {
      const diff =
        (shoots2026[i]!.date.getTime() - shoots2026[i - 1]!.date.getTime()) /
        (1000 * 60 * 60 * 24);
      expect(diff).toBe(7);
    }
  });
});

// ─── currentShootWeek ───────────────────────────────────────────────────────

describe('currentShootWeek — defaults the Score Entry week dropdown', () => {
  // 2025 reference (Week 1 = Apr 15, Week 3 = Apr 29, Week 4 = May 6;
  // July 1 skipped → Week 11 = Jun 24, Week 12 = Jul 8)

  it('returns 1 when today is well before Week 1 of the year', () => {
    expect(currentShootWeek(2025, new Date(2025, 0, 15))).toBe(1);
  });

  it('returns 1 when today is the day before Week 1', () => {
    expect(currentShootWeek(2025, new Date(2025, 3, 14))).toBe(1);
  });

  it('returns 1 on the exact day of Week 1', () => {
    expect(currentShootWeek(2025, new Date(2025, 3, 15))).toBe(1);
  });

  it('returns the current week on the exact shoot day (Week 3, Apr 29 2025)', () => {
    expect(currentShootWeek(2025, new Date(2025, 3, 29))).toBe(3);
  });

  it('returns the most recent shoot week on a non-Tuesday between shoots', () => {
    // Thu May 1 2025 falls between Week 3 (Apr 29) and Week 4 (May 6)
    expect(currentShootWeek(2025, new Date(2025, 4, 1))).toBe(3);
  });

  it('advances to the next week on its shoot day', () => {
    expect(currentShootWeek(2025, new Date(2025, 4, 6))).toBe(4);
  });

  it('handles the July 4 skip correctly (Wed Jul 2 2025 → Week 11)', () => {
    // 2025: Week 11 is Jun 24; the would-be Week 12 Tuesday (Jul 1) is skipped.
    // On Jul 2 the most recent shoot is still Jun 24.
    expect(currentShootWeek(2025, new Date(2025, 6, 2))).toBe(11);
  });

  it('returns 15 when today is well after Week 15 of the year', () => {
    expect(currentShootWeek(2025, new Date(2025, 8, 1))).toBe(15);
  });

  it('returns 15 when the selected year is entirely in the past', () => {
    expect(currentShootWeek(2024, new Date(2026, 4, 5))).toBe(15);
  });

  it('returns 1 when the selected year is entirely in the future', () => {
    expect(currentShootWeek(2027, new Date(2026, 4, 5))).toBe(1);
  });

  it('ignores time of day (late evening on Week 3 still resolves to Week 3)', () => {
    expect(currentShootWeek(2025, new Date(2025, 3, 29, 23, 59))).toBe(3);
  });
});
