import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { pageLimit, type PageSize } from '../../../domain/pageSize';
import { useApiClient } from '../../ApiClientContext';
import type { components } from '../../generated/schema';
import { queryKeys } from '../../queryKeys';

export type AdminUser = components['schemas']['AdminUser'];
export type AdminUserChallenge = components['schemas']['AdminUserChallenge'];
export type AdminActivity = components['schemas']['AdminActivity'];

/**
 * Every account, deleted ones included, most recently registered first, page
 * by page (cursor) of `size`; with `q`, those whose pseudo, names or e-mail
 * hold it. Always the search route: a POST, so that the search (maybe an
 * e-mail) never is in an address. Admin only: anyone else gets 404.
 */
export function useAdminUsers(q: string | undefined, size: PageSize) {
  const client = useApiClient();
  return useInfiniteQuery({
    queryKey: queryKeys.admin.users.list(q, size),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await client.POST('/api/v1/admin/users/search', {
        body: { q, limit: pageLimit(size), cursor: pageParam },
        signal,
      });
      if (!data) throw new Error('Empty admin user page');
      return data;
    },
    getNextPageParam: (page) => page.next_cursor ?? undefined,
  });
}

/**
 * An account as an admin sees it, deleted or not, with its e-mail. Read again
 * on each opening. Not asked while not `enabled` (an address that is no id).
 */
export function useAdminUser(userId: string, enabled = true) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.admin.users.detail(userId),
    queryFn: async ({ signal }) => {
      const { data } = await client.GET('/api/v1/admin/users/{userId}', {
        params: { path: { userId } },
        signal,
      });
      if (!data) throw new Error('Empty admin user');
      return data;
    },
    enabled,
    staleTime: 0,
  });
}

/** The challenges an account joined or creates, most recently created first. */
export function useAdminUserChallenges(userId: string, size: PageSize, enabled = true) {
  const client = useApiClient();
  return useInfiniteQuery({
    queryKey: queryKeys.admin.users.challenges(userId, size),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await client.GET('/api/v1/admin/users/{userId}/challenges', {
        params: { path: { userId }, query: { limit: pageLimit(size), cursor: pageParam } },
        signal,
      });
      if (!data) throw new Error('Empty admin user challenge page');
      return data;
    },
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled,
  });
}

/** The activities of an account, deleted ones excluded, the most recent session first. */
export function useAdminUserActivities(userId: string, size: PageSize, enabled = true) {
  const client = useApiClient();
  return useInfiniteQuery({
    queryKey: queryKeys.admin.users.activities(userId, size),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await client.GET('/api/v1/admin/users/{userId}/activities', {
        params: { path: { userId }, query: { limit: pageLimit(size), cursor: pageParam } },
        signal,
      });
      if (!data) throw new Error('Empty admin user activity page');
      return data;
    },
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled,
  });
}
