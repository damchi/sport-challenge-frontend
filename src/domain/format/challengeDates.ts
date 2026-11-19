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
 * Name of the challenge's time zone when it differs from the user's
 * ("heure normale de l'Est"), else undefined: the dates then need no mention.
 */
export function otherTimeZoneName(
  timeZone: string,
  userTimeZone: string,
  locale: string,
): string | undefined {
  if (timeZone === userTimeZone) return undefined;
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone,
    timeZoneName: 'longGeneric',
  }).formatToParts(new Date(0));
  return parts.find((part) => part.type === 'timeZoneName')?.value ?? timeZone;
}
