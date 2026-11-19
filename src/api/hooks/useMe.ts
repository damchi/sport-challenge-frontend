import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../ApiClientContext';
import type { components } from '../generated/schema';
import { queryKeys } from '../queryKeys';

export type Me = components['schemas']['Me'];
export type MeUpdate = components['schemas']['MeUpdate'];

/** Profile of the signed-in user (created empty on first sign-in). */
export function useMe() {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async ({ signal }) => {
      const { data } = await client.GET('/api/v1/me', { signal });
      if (!data) throw new Error('Empty profile response');
      return data;
    },
  });
}

/**
 * Updates the profile and keeps the answer as the cached profile. Its errors
 * are shown by the form (a taken pseudo under its field), not the global banner.
 */
export function useUpdateMe() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    meta: { handlesError: true },
    mutationFn: async (update: MeUpdate) => {
      const { data } = await client.PATCH('/api/v1/me', { body: update });
      if (!data) throw new Error('Empty profile response');
      return data;
    },
    onSuccess: (me) => queryClient.setQueryData(queryKeys.me, me),
  });
}
