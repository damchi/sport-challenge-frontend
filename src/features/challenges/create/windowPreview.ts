import {
  challengeWindow,
  isCalendarDate,
  isStartDateInRange,
} from '../../../domain/challengeWindow';
import { challengeWindowBounds, timeZoneName } from '../../../domain/format/challengeDates';

/**
 * The window as it will run, written in its time zone, once the three fields
 * are valid: never one the form would refuse.
 */
export function windowPreview(
  startDate: string,
  weeks: number,
  timeZone: string,
  now: Date,
  locale: string,
) {
  if (
    !isCalendarDate(startDate) ||
    !isStartDateInRange(startDate, timeZone, now) ||
    !Number.isInteger(weeks) ||
    weeks < 2 ||
    weeks > 52
  ) {
    return undefined;
  }
  const { startsAt, endsAt } = challengeWindow(startDate, weeks, timeZone);
  return {
    ...challengeWindowBounds(startsAt, endsAt, timeZone, locale),
    zone: timeZoneName(timeZone, locale),
  };
}
