// Dates of "My activities": the days of a week ("YYYY-MM-DD", already in the
// time zone of entry) and the start of an activity in that time zone.

/** A calendar day ("YYYY-MM-DD") as its UTC midnight, to format it in UTC. */
function utcDay(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year ?? NaN, (month ?? NaN) - 1, day));
}

function dayFormat(locale: string, withYear: boolean): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    ...(withYear && { year: 'numeric' }),
  });
}

/** A week's days, Monday to Sunday: "23–29 nov.", "30 nov. – 6 déc.". */
export function weekDays(
  monday: string,
  sunday: string,
  locale: string,
  withYear: boolean,
): string {
  return dayFormat(locale, withYear).formatRange(utcDay(monday), utcDay(sunday));
}

/** A day alone, to name a week by its Monday: "9 nov.". */
export function weekMonday(monday: string, locale: string, withYear: boolean): string {
  return dayFormat(locale, withYear).format(utcDay(monday));
}

/** The day of an activity's start in `timeZone`, with its weekday: "ven. 20 nov.". */
export function activityDay(instant: string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(instant));
}

/** The time of an activity's start in `timeZone`, to the minute: "8:05". */
export function activityClock(instant: string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(instant));
}
