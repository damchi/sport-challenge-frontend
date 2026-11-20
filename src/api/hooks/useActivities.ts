import { useMutation } from '@tanstack/react-query';
import { useApiClient } from '../ApiClientContext';
import type { components } from '../generated/schema';

export type ActivityCreate = components['schemas']['ActivityCreate'];
export type Activity = components['schemas']['Activity'];

/**
 * Records an activity. The idempotency key, chosen once per entry, goes
 * with every attempt: a request sent again records nothing more. Its errors
 * are shown by the entry form, not the global banner.
 */
export function useCreateActivity() {
  const client = useApiClient();
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
  });
}
