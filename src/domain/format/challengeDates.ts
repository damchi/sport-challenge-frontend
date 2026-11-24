// Dates of a challenge, always shown in the challenge's time zone (not the
// device's). Pure functions: the caller gives the locale and, when needed,
// the user's time zone.

/** Last instant of a window whose end is excluded (ends_at of the API). */
function lastInstant(endsAt: string): Date {
  return new Date(new Date(endsAt).getTime() - 1);
}

function dayFormat(locale: string, timeZone: string, withYear: boolean): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    day: 'numeric',
    month: 'short',
    ...(withYear && { year: 'numeric' }),
  });
}

/**
 * First and last day of a challenge, in its time zone ("3 nov. – 30 nov.").
 * The year shows when the two days are in different years, or always with
 * `alwaysYear` (a list that mixes years: the admin's).
 */
export function challengePeriod(
  startsAt: string,
  endsAt: string,
  timeZone: string,
  locale: string,
  alwaysYear = false,
): { start: string; end: string } {
  const start = new Date(startsAt);
  const end = lastInstant(endsAt);
  const year = (date: Date) =>
    new Intl.DateTimeFormat('en', { timeZone, year: 'numeric' }).format(date);
  const withYear = alwaysYear || year(start) !== year(end);
  return {
    start: dayFormat(locale, timeZone, withYear).format(start),
    end: dayFormat(locale, timeZone, withYear).format(end),
  };
}

/**
 * Last day of a challenge, with its year, in its time zone ("29 nov. 2026"):
 * a finished challenge is read long after its end.
 */
export function challengeLastDay(endsAt: string, timeZone: string, locale: string): string {
  return dayFormat(locale, timeZone, true).format(lastInstant(endsAt));
}

/**
 * First and last day of a challenge window in full, with the year, in its
 * time zone ("dimanche 22 novembre 2026"): the end is excluded, so the last
 * day is the one before it.
 */
export function challengeFullDays(
  startsAt: Date,
  endsAt: Date,
  timeZone: string,
  locale: string,
): { start: string; end: string } {
  const format = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return {
    start: format.format(startsAt),
    end: format.format(lastInstant(endsAt.toISOString())),
  };
}

/** Day of the week of an instant, in the challenge's time zone ("dimanche"). */
export function challengeWeekday(instant: Date, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone, weekday: 'long' }).format(instant);
}

/**
 * An instant of a challenge (end of a week, of the registrations) as written
 * in its time zone, to the hour: "lundi 23 novembre à 00 h".
 */
export function challengeInstant(instant: string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
  }).format(new Date(instant));
}

/**
 * An instant of a challenge to the minute (last computation of its
 * leaderboard), in its time zone: "18 nov., 10:00".
 */
export function challengeTime(instant: string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(instant));
}

/**
 * The start of an activity to the minute, in the time zone it is read in,
 * with its year: the list goes back through the whole history
 * ("19 nov. 2026, 7:30").
 */
export function activityTime(instant: string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(instant));
}

/**
 * The start of an activity being entered, to the minute, in the time zone
 * it is read in, with its weekday ("samedi 21 nov., 7:30").
 */
export function activityStart(instant: Date, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(instant);
}

/** Name of a time zone that holds all year ("heure de l'Est nord-américain"). */
export function timeZoneName(timeZone: string, locale: string): string {
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone,
    timeZoneName: 'longGeneric',
  }).formatToParts(new Date(0));
  return parts.find((part) => part.type === 'timeZoneName')?.value ?? timeZone;
}

/**
 * Name of the challenge's time zone when it differs from the user's
 * ("heure normale de l'Est"), else undefined: the dates then need no mention.
 */
export function otherTimeZoneName(
  timeZone: string,
  userTimeZone: string,
  locale: string,
): string | undefined {
  return timeZone === userTimeZone ? undefined : timeZoneName(timeZone, locale);
}

/** The day of an instant in the challenge's time zone: "3 nov.". */
export function challengeDay(instant: string, timeZone: string, locale: string): string {
  return dayFormat(locale, timeZone, false).format(new Date(instant));
}

/**
 * End of a challenge's week as a card says it, in its time zone, to the hour:
 * "samedi 28 nov., 00 h", or "sam. 28 nov., 00 h" with a short weekday.
 */
export function challengeWeekEnd(
  instant: string,
  timeZone: string,
  locale: string,
  weekday: 'long' | 'short',
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday,
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
  }).format(new Date(instant));
}

/** The first day of a challenge with its weekday, in its time zone: "mardi 1 déc.". */
export function challengeStartDay(startsAt: string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(new Date(startsAt));
}

/** The calendar day of an instant in a time zone, as a UTC midnight (ms). */
function dayIndex(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(instant);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(part('year'), part('month') - 1, part('day'));
}

/**
 * How many days from `now` to the day of `instant`, both read in the
 * challenge's time zone: 0 the same day, 1 the next one (never below 0).
 */
export function daysUntil(now: Date, instant: string, timeZone: string): number {
  const days = (dayIndex(new Date(instant), timeZone) - dayIndex(now, timeZone)) / 86_400_000;
  return Math.max(0, Math.round(days));
}
