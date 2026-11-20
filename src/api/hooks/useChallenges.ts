import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChallengeScope, ChallengeStatus } from '../../domain/challenge';
import { useApiClient } from '../ApiClientContext';
import type { components } from '../generated/schema';
import { queryKeys } from '../queryKeys';

export type ChallengeSummary = components['schemas']['ChallengeSummary'];
export type ChallengeCreate = components['schemas']['ChallengeCreate'];
export type ChallengeDetail = components['schemas']['ChallengeDetail'];
export type ChallengeUpdate = components['schemas']['ChallengeUpdate'];
export type Participant = components['schemas']['Participant'];
export type Leaderboard = components['schemas']['Leaderboard'];
export type LeaderboardEntry = components['schemas']['LeaderboardEntry'];

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
 * A challenge as the user sees it: its categories, my role and the fields the
 * server computes from the current instant (can_join, current week). A
 * missing, deleted or hidden challenge fails with the same 404.
 */
export function useChallenge(challengeId: string) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.challenges.detail(challengeId),
    queryFn: async ({ signal }) => {
      const { data } = await client.GET('/api/v1/challenges/{challengeId}', {
        params: { path: { challengeId } },
        signal,
      });
      if (!data) throw new Error('Empty challenge response');
      return data;
    },
  });
}

/**
 * Participants of a challenge, in order of registration, page by page
 * (cursor). Those who abandoned or were excluded are listed as abandoned; a
 * deleted account is not listed. Joining or abandoning reloads it (its key
 * starts with the challenge's).
 */
export function useParticipants(challengeId: string) {
  const client = useApiClient();
  return useInfiniteQuery({
    queryKey: queryKeys.challenges.participants(challengeId),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await client.GET('/api/v1/challenges/{challengeId}/participants', {
        params: { path: { challengeId }, query: { cursor: pageParam } },
        signal,
      });
      if (!data) throw new Error('Empty participant page');
      return data;
    },
    getNextPageParam: (page) => page.next_cursor ?? undefined,
  });
}

/**
 * The ranking of the 3 categories of a challenge, as the server computes it:
 * ranks with their ties (1, 1, 3), then the participants who abandoned,
 * without a rank. Joining or abandoning reloads it (its key starts with the
 * challenge's).
 */
export function useLeaderboard(challengeId: string) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.challenges.leaderboard(challengeId),
    queryFn: async ({ signal }) => {
      const { data } = await client.GET('/api/v1/challenges/{challengeId}/leaderboard', {
        params: { path: { challengeId } },
        signal,
      });
      if (!data) throw new Error('Empty leaderboard response');
      return data;
    },
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

/**
 * Edits the title and the description of a challenge (creators only): its
 * page shows the answer, and the lists reload with the new title. Its errors
 * are shown by the edit form (by field), not the global banner.
 */
export function useUpdateChallenge(challengeId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    meta: { handlesError: true },
    mutationFn: async (update: ChallengeUpdate) => {
      const { data } = await client.PATCH('/api/v1/challenges/{challengeId}', {
        params: { path: { challengeId } },
        body: update,
      });
      if (!data) throw new Error('Empty challenge response');
      return data;
    },
    onSuccess: (challenge) => {
      queryClient.setQueryData(queryKeys.challenges.detail(challengeId), challenge);
      return queryClient.invalidateQueries({ queryKey: queryKeys.challenges.all });
    },
  });
}

/**
 * Joins a challenge: its page shows the answer, and the lists and the
 * leaderboards reload with the new participant. Its errors (registration
 * closed, already in, abandoned, incomplete profile) are shown by the page,
 * not the global banner; the challenge then reloads, so the page also says
 * why joining is no longer possible.
 */
export function useJoinChallenge(challengeId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    meta: { handlesError: true },
    mutationFn: async () => {
      const { data } = await client.POST('/api/v1/challenges/{challengeId}/join', {
        params: { path: { challengeId } },
      });
      if (!data) throw new Error('Empty challenge response');
      return data;
    },
    onSuccess: (challenge) => {
      queryClient.setQueryData(queryKeys.challenges.detail(challengeId), challenge);
      return queryClient.invalidateQueries({ queryKey: queryKeys.challenges.all });
    },
    onError: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.challenges.detail(challengeId) }),
  });
}

/**
 * Abandons a challenge, for good: its page shows the answer, and the lists
 * and the leaderboards reload without the user competing. Abandoning again
 * succeeds and changes nothing. Its errors (challenge finished, not a
 * participant) are shown by the page, not the global banner; the challenge
 * then reloads, so the page shows the participation as it now is.
 */
export function useAbandonChallenge(challengeId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    meta: { handlesError: true },
    mutationFn: async () => {
      const { data } = await client.POST('/api/v1/challenges/{challengeId}/abandon', {
        params: { path: { challengeId } },
      });
      if (!data) throw new Error('Empty challenge response');
      return data;
    },
    onSuccess: (challenge) => {
      queryClient.setQueryData(queryKeys.challenges.detail(challengeId), challenge);
      return queryClient.invalidateQueries({ queryKey: queryKeys.challenges.all });
    },
    onError: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.challenges.detail(challengeId) }),
  });
}
