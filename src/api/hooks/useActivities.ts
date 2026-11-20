import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../ApiClientContext';
import type { components } from '../generated/schema';
import { queryKeys } from '../queryKeys';

export type ActivityCreate = components['schemas']['ActivityCreate'];
export type Activity = components['schemas']['Activity'];
export type ActivityContribution = components['schemas']['ActivityContribution'];

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
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.activities.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.challenges.all }),
      ]),
  });
}
