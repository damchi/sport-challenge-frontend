/**
 * An instant to the minute, with its year, in `timeZone`: "24 nov. 2026,
 * 09:30". For what has no challenge time zone (the worker's runs).
 */
export function dateTime(instant: string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(instant));
}
