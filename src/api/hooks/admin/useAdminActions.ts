import { useInfiniteQuery } from '@tanstack/react-query';
import type { AdminActionFilters } from '../../../domain/adminActions';
import { pageLimit, type PageSize } from '../../../domain/pageSize';
import { useApiClient } from '../../ApiClientContext';
import type { components } from '../../generated/schema';
import { queryKeys } from '../../queryKeys';

export type AdminAction = components['schemas']['AdminAction'];

/**
 * The journal of the admin changes, most recent first, page by page
 * (cursor) of `size`, with the filters (they add up). Admin only: anyone
 * else gets 404.
 */
export function useAdminActions(filters: AdminActionFilters, size: PageSize) {
  const client = useApiClient();
  return useInfiniteQuery({
    queryKey: queryKeys.admin.actions(filters, size),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await client.GET('/api/v1/admin/actions', {
        params: { query: { ...filters, limit: pageLimit(size), cursor: pageParam } },
        signal,
      });
      if (!data) throw new Error('Empty admin action page');
      return data;
    },
    getNextPageParam: (page) => page.next_cursor ?? undefined,
  });
}
