// Window of a challenge from its creation input: it starts at local midnight
// of the start date in the challenge's time zone and lasts whole local weeks
// (API contract). Days are counted on the calendar, never as 24 h blocks, so
// a change of time inside the window does not move the bounds. Pure functions.

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whether `timeZone` is a time zone this runtime knows (IANA name). */
export function isTimeZone(timeZone: string): boolean {
  if (timeZone === '') return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return true;
  } catch {
    return false;
  }
}

// Year, month (1–12) and day of a "YYYY-MM-DD" date that exists.
function dateParts(date: string): [number, number, number] | undefined {
  const match = DATE_PATTERN.exec(date);
  if (!match) return undefined;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCMonth() === month - 1 && check.getUTCDate() === day
    ? [year, month, day]
    : undefined;
}

/** Whether `date` is a real calendar day written "YYYY-MM-DD". */
export function isCalendarDate(date: string): boolean {
  return dateParts(date) !== undefined;
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The calendar day of `now` in `timeZone`, as "YYYY-MM-DD". */
export function localDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** `date` moved by whole calendar days or years ("YYYY-MM-DD"). */
export function addToDate(date: string, { days = 0, years = 0 }): string {
  const [year, month, day] = dateParts(date) ?? [NaN, NaN, NaN];
  return formatUtcDate(new Date(Date.UTC(year + years, month - 1, day + days)));
}

/**
 * Whether a start date is allowed at `now`: between today and the same day
 * next year, both in `timeZone` (API contract).
 */
export function isStartDateInRange(startDate: string, timeZone: string, now: Date): boolean {
  const today = localDate(now, timeZone);
  // "YYYY-MM-DD" strings compare as dates.
  return startDate >= today && startDate <= addToDate(today, { years: 1 });
}

// Offset of `timeZone` from UTC at `instant`, in milliseconds.
function offset(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((candidate) => candidate.type === type)?.value);
  const wallClock = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
  return wallClock - Math.floor(instant / 1000) * 1000;
}

/**
 * The instant of local midnight of `date` in `timeZone`. Where the clocks
 * skip midnight, the first instant of that day.
 */
export function zonedMidnight(date: string, timeZone: string): Date {
  const [year, month, day] = dateParts(date) ?? [NaN, NaN, NaN];
  const wallClock = Date.UTC(year, month - 1, day);
  // The offset at the guess may be the one before a change: check again.
  let instant = wallClock - offset(wallClock, timeZone);
  instant = wallClock - offset(instant, timeZone);
  // Midnight skipped: the guess lands on the day before, still at the offset
  // of before the change; with that offset, midnight is the change itself.
  if (localDate(new Date(instant), timeZone) !== date) {
    instant = wallClock - offset(instant, timeZone);
  }
  return new Date(instant);
}

/** A date and time as a native field writes it ("2026-11-20T07:30"), in `timeZone`. */
export function toZonedDateTime(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

/**
 * The instant of a date and time read in `timeZone` ("2026-11-20T07:30").
 * Undefined when it is not one, or when that time does not exist there (a
 * day the calendar lacks, an hour skipped by a change of time).
 */
export function zonedDateTime(value: string, timeZone: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [, year, month, day, hour, minute] = match.map(Number);
  const wallClock = Date.UTC(year ?? NaN, (month ?? NaN) - 1, day ?? NaN, hour, minute);
  if (Number.isNaN(wallClock)) return undefined;
  // The offset at the guess may be the one before a change: check again.
  let instant = wallClock - offset(wallClock, timeZone);
  instant = wallClock - offset(instant, timeZone);
  const date = new Date(instant);
  return toZonedDateTime(date, timeZone) === value ? date : undefined;
}

/** Start (included) and end (excluded) instants of a challenge window. */
export function challengeWindow(
  startDate: string,
  weeks: number,
  timeZone: string,
): { startsAt: Date; endsAt: Date } {
  return {
    startsAt: zonedMidnight(startDate, timeZone),
    endsAt: zonedMidnight(addToDate(startDate, { days: weeks * 7 }), timeZone),
  };
}
