import { useEffect } from 'react';
import {
  useMyActivityWeeks,
  type Activity,
  type ActivityWeekTotals,
} from '../../api/hooks/useActivities';
import { localDate } from '../../domain/challengeWindow';
import { missesOlderWeek, mondayOf, weeksByMonday } from '../../domain/activityWeeks';

/**
 * The server's totals of the user's weeks (of `sport` only when given), by
 * Monday in `timeZone`: more pages of weeks load while the oldest activity
 * shown is in a week older than every week loaded (`missing`).
 */
export function useWeekTotals(
  timeZone: string | undefined,
  sport: string | undefined,
  oldestActivity: Activity | undefined,
) {
  const weeks = useMyActivityWeeks(timeZone, sport);
  const totals =
    timeZone === undefined
      ? new Map<string, ActivityWeekTotals>()
      : weeksByMonday(weeks.data?.pages.flatMap((page) => page.items) ?? [], timeZone);
  const missing = missesOlderWeek(
    oldestActivity && timeZone
      ? mondayOf(localDate(new Date(oldestActivity.started_at), timeZone))
      : undefined,
    totals.keys(),
  );
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = weeks;
  useEffect(() => {
    if (missing && hasNextPage && !isFetchingNextPage && !isError) void fetchNextPage();
  }, [missing, hasNextPage, isFetchingNextPage, isError, fetchNextPage]);
  return { weeks, totals, missing };
}
