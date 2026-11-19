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
 * The year shows when the two days are in different years.
 */
export function challengePeriod(
  startsAt: string,
  endsAt: string,
  timeZone: string,
  locale: string,
): { start: string; end: string } {
  const start = new Date(startsAt);
  const end = lastInstant(endsAt);
  const year = (date: Date) =>
    new Intl.DateTimeFormat('en', { timeZone, year: 'numeric' }).format(date);
  const withYear = year(start) !== year(end);
  return {
    start: dayFormat(locale, timeZone, withYear).format(start),
    end: dayFormat(locale, timeZone, withYear).format(end),
  };
}

/**
 * Bounds of a challenge window as written in its time zone, to the hour
 * ("lundi 5 octobre à 00 h"): the end is the excluded instant, the start of
 * the day after the last one. The year shows when the two differ.
 */
export function challengeWindowBounds(
  startsAt: Date,
  endsAt: Date,
  timeZone: string,
  locale: string,
): { start: string; end: string } {
  const year = (date: Date) =>
    new Intl.DateTimeFormat('en', { timeZone, year: 'numeric' }).format(date);
  const format = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(year(startsAt) !== year(endsAt) && { year: 'numeric' }),
    hour: 'numeric',
  });
  return { start: format.format(startsAt), end: format.format(endsAt) };
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
