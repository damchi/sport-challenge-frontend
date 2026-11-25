import { useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query';
import type { AdminChallengeFilters } from '../../../domain/adminChallenges';
import { pageLimit, type PageSize } from '../../../domain/pageSize';
import { useApiClient } from '../../ApiClientContext';
import type { ApiClient } from '../../client';
import type { components } from '../../generated/schema';
import { queryKeys } from '../../queryKeys';
import type { CorrectionBody } from './useAdminCorrection';

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
  return useQuery({ ...adminChallengeQuery(client, challengeId), enabled });
}

/** Several challenges as an admin sees them, each read as `useAdminChallenge` does. */
export function useAdminChallengesById(challengeIds: readonly string[]) {
  const client = useApiClient();
  return useQueries({ queries: challengeIds.map((id) => adminChallengeQuery(client, id)) });
}

function adminChallengeQuery(client: ApiClient, challengeId: string) {
  return {
    queryKey: queryKeys.admin.challenges.detail(challengeId),
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const { data } = await client.GET('/api/v1/admin/challenges/{challengeId}', {
        params: { path: { challengeId } },
        signal,
      });
      if (!data) throw new Error('Empty admin challenge');
      return data;
    },
    // Read now on the server, never stored: the state of the moment.
    staleTime: 0,
  };
}

/** The settings an admin changes, besides the reason and the preview. */
export type AdminChallengeSettingsUpdate = Omit<
  components['schemas']['AdminChallengeUpdate'],
  'reason' | 'dry_run'
>;

/**
 * Changes the settings of a challenge (`update`, the fields that change),
 * as `RecomputeFlow` sends it: previewed, then made with the reason.
 */
export async function updateAdminChallenge(
  client: ApiClient,
  challengeId: string,
  update: AdminChallengeSettingsUpdate,
  body: CorrectionBody,
) {
  const { data } = await client.PATCH('/api/v1/admin/challenges/{challengeId}', {
    params: { path: { challengeId } },
    body: { ...update, ...body },
  });
  return data;
}
