import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ChallengeScope, ChallengeStatus } from '../../domain/challenge';
import { useApiClient } from '../ApiClientContext';
import type { components } from '../generated/schema';
import { queryKeys } from '../queryKeys';

export type ChallengeSummary = components['schemas']['ChallengeSummary'];
export type ChallengeCreate = components['schemas']['ChallengeCreate'];

/**
 * Challenges of a list, page by page (cursor): `fetchNextPage` loads the
 * next one while `hasNextPage` says there is one.
 */
export function useChallenges(scope: ChallengeScope, status: ChallengeStatus | undefined) {
  const client = useApiClient();
  return useInfiniteQuery({
    queryKey: queryKeys.challenges.list(scope, status),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await client.GET('/api/v1/challenges', {
        params: { query: { scope, status, cursor: pageParam } },
        signal,
      });
      if (!data) throw new Error('Empty challenge page');
      return data;
    },
    getNextPageParam: (page) => page.next_cursor ?? undefined,
  });
}

/**
 * Creates a challenge; the lists then reload to show it. Its errors are shown
 * by the creation form (by field), not the global banner.
 */
export function useCreateChallenge() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    meta: { handlesError: true },
    mutationFn: async (challenge: ChallengeCreate) => {
      const { data } = await client.POST('/api/v1/challenges', { body: challenge });
      if (!data) throw new Error('Empty challenge response');
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.challenges.all }),
  });
}
