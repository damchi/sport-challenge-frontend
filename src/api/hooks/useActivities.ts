import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../ApiClientContext';
import type { components } from '../generated/schema';
import { queryKeys } from '../queryKeys';

export type ActivityCreate = components['schemas']['ActivityCreate'];
export type Activity = components['schemas']['Activity'];
export type ActivityContribution = components['schemas']['ActivityContribution'];

/**
 * The user's activities, most recent first, page by page (cursor). Each one
 * says whether it is `locked`: its week has ended in a challenge where it
 * counts.
 */
export function useMyActivities() {
  const client = useApiClient();
  return useInfiniteQuery({
    queryKey: queryKeys.activities.mine,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await client.GET('/api/v1/me/activities', {
        params: { query: { cursor: pageParam } },
        signal,
      });
      if (!data) throw new Error('Empty activity page');
      return data;
    },
    getNextPageParam: (page) => page.next_cursor ?? undefined,
  });
}

/**
 * Records an activity. The idempotency key, chosen once per entry, goes
 * with every attempt: a request sent again records nothing more. Once
 * recorded, the activities, the challenges and their leaderboards reload with
 * it. Its errors are shown by the entry form, not the global banner.
 */
export function useCreateActivity() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    meta: { handlesError: true },
    mutationFn: async ({
      activity,
      idempotencyKey,
    }: {
      activity: ActivityCreate;
      idempotencyKey: string;
    }) => {
      const { data } = await client.POST('/api/v1/activities', {
        params: { header: { 'Idempotency-Key': idempotencyKey } },
        body: activity,
      });
      if (!data) throw new Error('Empty activity response');
      return data;
    },
    // Not awaited: the outcome shows at once, however slow the reloads.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.activities.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.challenges.all });
    },
  });
}

/**
 * Replaces an activity of the user with what the form holds. Once replaced,
 * the activities, the challenges and their leaderboards reload with it. Its
 * errors are shown by the form.
 */
export function useUpdateActivity() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    meta: { handlesError: true },
    mutationFn: async ({
      activityId,
      activity,
    }: {
      activityId: string;
      activity: ActivityCreate;
    }) => {
      const { data } = await client.PATCH('/api/v1/activities/{activityId}', {
        params: { path: { activityId } },
        body: activity,
      });
      if (!data) throw new Error('Empty activity response');
      return data;
    },
    // After a refusal too: an activity found locked or gone shows as it now is.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.activities.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.challenges.all });
    },
  });
}

/**
 * Deletes an activity of the user: it stops counting at once. The
 * activities, the challenges and their leaderboards reload, after a refusal
 * too: an activity found locked or gone shows as it now is. Its errors are
 * shown next to the activity.
 */
export function useDeleteActivity() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    meta: { handlesError: true },
    mutationFn: async (activityId: string) => {
      await client.DELETE('/api/v1/activities/{activityId}', {
        params: { path: { activityId } },
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.activities.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.challenges.all });
    },
  });
}
