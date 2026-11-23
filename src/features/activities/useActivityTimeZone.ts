import { useEffect } from 'react';
import { useChallenges } from '../../api/hooks/useChallenges';
import { activityTimeZone } from '../../domain/activity';

/**
 * Time zone the user's activities are read in, entered and shown: the one
 * of their ongoing challenges when they share one, the device's otherwise.
 * Every page of those challenges is loaded first: a zone missed would read a
 * start in the wrong one. `paused` stops loading more once it is no longer
 * needed.
 */
export function useActivityTimeZone(deviceTimeZone: string | undefined, paused = false) {
  const ongoing = useChallenges('mine', 'ongoing', 'all');
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = ongoing;
  useEffect(() => {
    if (!paused && hasNextPage && !isFetchingNextPage && !isError) void fetchNextPage();
  }, [paused, hasNextPage, isFetchingNextPage, isError, fetchNextPage]);
  const isPending = ongoing.isPending || (hasNextPage && !isError);
  const failed = !isPending && (!ongoing.data || isError);
  const device = deviceTimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {
    isPending,
    isError: failed,
    error: ongoing.error,
    refetch: () => void ongoing.refetch(),
    deviceTimeZone: device,
    timeZone:
      isPending || failed || !ongoing.data
        ? undefined
        : activityTimeZone(
            ongoing.data.pages.flatMap((page) => page.items),
            device,
          ),
  };
}
