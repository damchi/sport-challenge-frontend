import {
  addToDate,
  challengeWindow,
  isCalendarDate,
  isStartDateInRange,
  isStartDateWithinAYear,
  localDate,
  zonedMidnight,
} from '../../../domain/challengeWindow';
import {
  challengeFullDays,
  challengePeriod,
  challengeWeekday,
  timeZoneName,
} from '../../../domain/format/challengeDates';

/**
 * The window as it will run, written in its time zone, once the three fields
 * are valid: never one the form would refuse. `short` is its first and last
 * day ("22 nov.", "2 janv."), `full` the same in full, `weekday` the day each
 * week starts on, `weeks` the first and last day of each week, and `started`
 * whether it has started. The first day follows the rule of the form: from
 * today to a year ahead, or, with `pastStart` (an admin changing a
 * challenge), any day up to a year ahead.
 */
export function windowPreview(
  startDate: string,
  weeks: number,
  timeZone: string,
  now: Date,
  locale: string,
  { pastStart = false } = {},
) {
  if (
    !isCalendarDate(startDate) ||
    !(pastStart
      ? isStartDateWithinAYear(startDate, timeZone, now)
      : isStartDateInRange(startDate, timeZone, now)) ||
    !Number.isInteger(weeks) ||
    weeks < 2 ||
    weeks > 52
  ) {
    return undefined;
  }
  const { startsAt, endsAt } = challengeWindow(startDate, weeks, timeZone);
  const iso = (date: string) => zonedMidnight(date, timeZone).toISOString();
  return {
    short: challengePeriod(startsAt.toISOString(), endsAt.toISOString(), timeZone, locale),
    full: challengeFullDays(startsAt, endsAt, timeZone, locale),
    weekday: challengeWeekday(startsAt, timeZone, locale),
    zone: timeZoneName(timeZone, locale),
    started: startDate <= localDate(now, timeZone),
    weeks: Array.from({ length: weeks }, (_, week) =>
      challengePeriod(
        iso(addToDate(startDate, { days: week * 7 })),
        iso(addToDate(startDate, { days: (week + 1) * 7 })),
        timeZone,
        locale,
      ),
    ),
  };
}
