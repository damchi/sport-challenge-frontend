import { useAdminChallengesById } from '../../api/hooks/admin/useAdminChallenges';
import { useAdminUserChallenges } from '../../api/hooks/admin/useAdminUsers';
import { useFetchAllPages } from '../../api/hooks/useFetchAllPages';
import { activityTimeZone } from '../../domain/activity';

/**
 * Time zone an admin enters an account's activity in, as the account would:
 * the one its ongoing challenges (where it is an active participant) share,
 * the device's otherwise. The account's challenges do not give their zone
 * (asked of the API, SC-API-195): each ongoing one is read on its own.
 */
export function useAccountTimeZone(userId: string, deviceTimeZone: string | undefined) {
  const challenges = useAdminUserChallenges(userId, 'all');
  useFetchAllPages(challenges, true);
  const listed = challenges.isPending || (challenges.hasNextPage && !challenges.isError);
  const ongoing = listed
    ? []
    : (challenges.data?.pages.flatMap((page) => page.items) ?? []).filter(
        (challenge) =>
          challenge.status === 'ongoing' &&
          challenge.deleted_at === null &&
          challenge.participant_status === 'active',
      );
  const details = useAdminChallengesById(ongoing.map((challenge) => challenge.id));
  const failedDetail = details.find((detail) => detail.isError);
  const isPending = listed || details.some((detail) => detail.isPending);
  const isError = !isPending && (!challenges.data || challenges.isError || !!failedDetail);
  const device = deviceTimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {
    isPending,
    isError,
    error: challenges.error ?? failedDetail?.error ?? null,
    refetch: () => {
      if (challenges.isError) void challenges.refetch();
      for (const detail of details) if (detail.isError) void detail.refetch();
    },
    timeZone:
      isPending || isError
        ? undefined
        : // Only challenges where the account is an active participant are read.
          activityTimeZone(
            details.flatMap(({ data }) =>
              data ? [{ timezone: data.timezone, my_status: 'active' as const }] : [],
            ),
            device,
          ),
  };
}
