import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { AdminChallengeFilters } from '../../../domain/adminChallenges';
import { pageLimit, type PageSize } from '../../../domain/pageSize';
import { useApiClient } from '../../ApiClientContext';
import type { components } from '../../generated/schema';
import { queryKeys } from '../../queryKeys';

export type AdminChallengeSummary = components['schemas']['AdminChallengeSummary'];
export type AdminChallengeDetail = components['schemas']['AdminChallengeDetail'];
export type AdminUserRef = components['schemas']['AdminUserRef'];

/**
 * Every challenge, private and deleted ones included, most recent first,
 * page by page (cursor) of `size`, with the filters. Admin only: anyone else
 * gets 404. Imported by the admin section only.
 */
export function useAdminChallenges(filters: AdminChallengeFilters, size: PageSize) {
  const client = useApiClient();
  return useInfiniteQuery({
    queryKey: queryKeys.admin.challenges.list(filters, size),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await client.GET('/api/v1/admin/challenges', {
        params: { query: { ...filters, limit: pageLimit(size), cursor: pageParam } },
        signal,
      });
      if (!data) throw new Error('Empty admin challenge page');
      return data;
    },
    getNextPageParam: (page) => page.next_cursor ?? undefined,
  });
}

/**
 * A challenge as an admin sees it, deleted or not. Read again on each
 * opening. Not asked while not `enabled` (an address that is no id).
 */
export function useAdminChallenge(challengeId: string, enabled = true) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.admin.challenges.detail(challengeId),
    queryFn: async ({ signal }) => {
      const { data } = await client.GET('/api/v1/admin/challenges/{challengeId}', {
        params: { path: { challengeId } },
        signal,
      });
      if (!data) throw new Error('Empty admin challenge');
      return data;
    },
    enabled,
    // Read now on the server, never stored: the state of the moment.
    staleTime: 0,
  });
}
