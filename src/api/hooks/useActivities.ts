import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../ApiClientContext';
import type { components } from '../generated/schema';
import { queryKeys } from '../queryKeys';

export type ActivityCreate = components['schemas']['ActivityCreate'];
export type Activity = components['schemas']['Activity'];
export type ActivityContribution = components['schemas']['ActivityContribution'];
export type ActivitySummary = components['schemas']['ActivitySummary'];
export type ActivityWeekTotals = components['schemas']['ActivityWeek'];
export type ChallengeActivity = components['schemas']['ChallengeActivity'];

/**
 * The user's activities, of `sport` only when given, most recent first, page
 * by page (cursor). Each one says whether it is `locked`: its week has ended
 * in a challenge where it counts.
 */
export function useMyActivities(sport?: string) {
  const client = useApiClient();
  return useInfiniteQuery({
    queryKey: queryKeys.activities.mine(sport),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await client.GET('/api/v1/me/activities', {
        params: { query: { cursor: pageParam, sport } },
        signal,
      });
      if (!data) throw new Error('Empty activity page');
      return data;
    },
    getNextPageParam: (page) => page.next_cursor ?? undefined,
  });
}

/**
 * The totals of the user's current week, day by day, and the number of
 * activities of each sport, weeks and days cut in `timeZone` (Monday to
 * Sunday). Waits while the zone is not known.
 */
export function useMyActivitySummary(timeZone: string | undefined) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.activities.summary(timeZone ?? ''),
    enabled: timeZone !== undefined,
    queryFn: async ({ signal }) => {
      const { data } = await client.GET('/api/v1/me/activities/summary', {
        params: { query: { tz: timeZone ?? '' } },
        signal,
      });
      if (!data) throw new Error('Empty activity summary');
      return data;
    },
  });
}

/**
 * The totals of the user's weeks holding an activity (of `sport` only when
 * given), most recent first, page by page (cursor), cut in `timeZone`. Waits
 * while the zone is not known.
 */
export function useMyActivityWeeks(timeZone: string | undefined, sport?: string) {
  const client = useApiClient();
  return useInfiniteQuery({
    queryKey: queryKeys.activities.weeks(timeZone ?? '', sport),
    enabled: timeZone !== undefined,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await client.GET('/api/v1/me/activities/weeks', {
        params: { query: { tz: timeZone ?? '', sport, cursor: pageParam } },
        signal,
      });
      if (!data) throw new Error('Empty activity week page');
      return data;
    },
    getNextPageParam: (page) => page.next_cursor ?? undefined,
  });
}

/**
 * The activities of a participant started in the window of the challenge,
 * most recent first, page by page (cursor). Only the participants and the
 * creators of the challenge may see them: anyone else, or a user who never
 * joined it, gets a 404.
 */
export function useParticipantActivities(challengeId: string, userId: string) {
  const client = useApiClient();
  return useInfiniteQuery({
    queryKey: queryKeys.challenges.participantActivities(challengeId, userId),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await client.GET(
        '/api/v1/challenges/{challengeId}/participants/{userId}/activities',
        { params: { path: { challengeId, userId }, query: { cursor: pageParam } }, signal },
      );
      if (!data) throw new Error('Empty activity page');
      return data;
    },
    getNextPageParam: (page) => page.next_cursor ?? undefined,
  });
}

/**
 * The activities of every participant of a challenge (abandoned ones
 * included), each with its author, started in its window, most recent first,
 * page by page (cursor). Only the participants and the creators may read
 * them; anyone else gets a 404.
 */
export function useChallengeActivities(challengeId: string) {
  const client = useApiClient();
  return useInfiniteQuery({
    queryKey: queryKeys.challenges.activities(challengeId),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await client.GET('/api/v1/challenges/{challengeId}/activities', {
        params: { path: { challengeId }, query: { cursor: pageParam } },
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
