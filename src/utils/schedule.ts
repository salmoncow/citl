/**
 * @file Shared season schedule computation utilities.
 *
 * Business rules:
 *  - Practice day:    2nd Tuesday of April
 *  - Week 1:         3rd Tuesday of April
 *  - Season length:  15 shoot weeks
 *  - July 4th skip:  if July 4 falls Mon–Fri, the Tuesday of that Sun–Sat week
 *                    is skipped; season extends by one week
 *  - July 4th mark:  July 4 itself shown when it is a weekday
 */

export interface ScheduleEvent {
  date: Date;
  type: 'practice' | 'shoot' | 'holiday' | 'cancelled';
  week?: number; // 1-based, shoot days only
}

/** Returns the date of the Nth Tuesday (1-based) of the given month (0-based). */
export function nthTuesdayOfMonth(year: number, month: number, n: number): Date {
  const firstDay = new Date(year, month, 1);
  const firstDayOfWeek = firstDay.getDay(); // 0 = Sun, 2 = Tue
  const daysUntilTuesday = (2 - firstDayOfWeek + 7) % 7;
  const firstTuesdayDate = 1 + daysUntilTuesday;
  return new Date(year, month, firstTuesdayDate + (n - 1) * 7);
}

/** Returns all schedule events for the season year. */
export function computeSchedule(year: number): ScheduleEvent[] {
  const practice = nthTuesdayOfMonth(year, 3, 2); // April = month 3
  const week1Start = nthTuesdayOfMonth(year, 3, 3);

  const july4 = new Date(year, 6, 4);
  const july4DayOfWeek = july4.getDay(); // 0 = Sun, 6 = Sat
  const july4IsWeekday = july4DayOfWeek >= 1 && july4DayOfWeek <= 5;

  // Tuesday of the Sun–Sat week that contains July 4
  let skippedTuesday: Date | null = null;
  if (july4IsWeekday) {
    // Days since Sunday of that week = july4DayOfWeek
    const sundayOffset = july4DayOfWeek; // days to subtract to reach Sunday
    const sundayDate = 4 - sundayOffset; // July date of that Sunday
    skippedTuesday = new Date(year, 6, sundayDate + 2); // +2 to reach Tuesday
  }

  const events: ScheduleEvent[] = [
    { date: practice, type: 'practice' },
  ];

  if (july4IsWeekday) {
    events.push({ date: july4, type: 'holiday' });
  }

  // Walk forward, collecting 15 shoot Tuesdays (skipping the July 4 week Tuesday)
  const current = new Date(week1Start);
  let shootWeek = 1;

  while (shootWeek <= 15) {
    const isSkipped =
      skippedTuesday !== null &&
      current.getFullYear() === skippedTuesday.getFullYear() &&
      current.getMonth() === skippedTuesday.getMonth() &&
      current.getDate() === skippedTuesday.getDate();

    if (!isSkipped) {
      events.push({ date: new Date(current), type: 'shoot', week: shootWeek });
      shootWeek++;
    }

    current.setDate(current.getDate() + 7);
  }

  return events;
}

/**
 * Returns the appropriate default shoot-week number for the given year,
 * based on today's date. Used to default the Score Entry "Week" dropdown.
 *
 *  - Before Week 1 of the year → 1
 *  - On/after Week 15 of the year → 15
 *  - Otherwise → the week of the most recent shoot event whose date ≤ today
 *
 * Date-only comparison (time of day is ignored).
 */
export function currentShootWeek(year: number, today: Date = new Date()): number {
  const shootEvents = computeSchedule(year).filter(e => e.type === 'shoot');
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  let result = 1;
  for (const e of shootEvents) {
    const eventStart = new Date(e.date.getFullYear(), e.date.getMonth(), e.date.getDate()).getTime();
    if (eventStart <= todayStart && e.week !== undefined) {
      result = e.week;
    }
  }
  return result;
}
