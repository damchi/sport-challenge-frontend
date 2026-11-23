// "My activities" are grouped by week, Monday to Sunday, in the time zone
// they are entered in (owner's decisions, 2026-11-20 and 2026-11-22). These
// are the user's own weeks, not a challenge's.

import { addToDate, localDate } from './challengeWindow';

/** The Monday of the week holding `date` ("YYYY-MM-DD"). */
export function mondayOf(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  // getUTCDay: Sunday 0 … Saturday 6; days since Monday.
  const sinceMonday =
    (new Date(Date.UTC(year ?? NaN, (month ?? NaN) - 1, day)).getUTCDay() + 6) % 7;
  return addToDate(date, { days: -sinceMonday });
}

/** A week of activities: its Monday and Sunday ("YYYY-MM-DD"), its activities in order. */
export interface ActivityWeek<A> {
  monday: string;
  sunday: string;
  activities: A[];
}

/**
 * Activities, already most recent first, grouped by week in `timeZone`;
 * weeks keep that order.
 */
export function groupByWeek<A extends { started_at: string }>(
  activities: readonly A[],
  timeZone: string,
): ActivityWeek<A>[] {
  const weeks: ActivityWeek<A>[] = [];
  for (const activity of activities) {
    const monday = mondayOf(localDate(new Date(activity.started_at), timeZone));
    const last = weeks.at(-1);
    if (last?.monday === monday) last.activities.push(activity);
    else weeks.push({ monday, sunday: addToDate(monday, { days: 6 }), activities: [activity] });
  }
  return weeks;
}

/** How a week is named, seen at `now`: this week, last week, or by its Monday. */
export function weekKind(
  monday: string,
  now: Date,
  timeZone: string,
): 'current' | 'last' | 'other' {
  const current = mondayOf(localDate(now, timeZone));
  if (monday === current) return 'current';
  return monday === addToDate(current, { days: -7 }) ? 'last' : 'other';
}

/** How a day is named, seen at `now`: today, yesterday, or by its date. */
export function dayKind(
  instant: string,
  now: Date,
  timeZone: string,
): 'today' | 'yesterday' | 'other' {
  const day = localDate(new Date(instant), timeZone);
  const today = localDate(now, timeZone);
  if (day === today) return 'today';
  return day === addToDate(today, { days: -1 }) ? 'yesterday' : 'other';
}

/** Weeks of the server (`starts_at`, Monday 00:00 in `timeZone`) by their Monday ("YYYY-MM-DD"). */
export function weeksByMonday<W extends { starts_at: string }>(
  weeks: readonly W[],
  timeZone: string,
): Map<string, W> {
  return new Map(weeks.map((week) => [localDate(new Date(week.starts_at), timeZone), week]));
}

/**
 * Whether the weeks loaded (their Mondays) stop before the week of `monday`:
 * none loaded, or all of them more recent. Then older weeks are to load.
 */
export function missesOlderWeek(monday: string | undefined, loaded: Iterable<string>): boolean {
  if (monday === undefined) return false;
  let oldest: string | undefined;
  for (const candidate of loaded)
    if (oldest === undefined || candidate < oldest) oldest = candidate;
  return oldest === undefined || monday < oldest;
}
