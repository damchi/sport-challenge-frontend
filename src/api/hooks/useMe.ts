import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../ApiClientContext';
import type { components } from '../generated/schema';
import { queryKeys } from '../queryKeys';

export type Me = components['schemas']['Me'];
// The pseudo can now be removed (null), which the backend is being updated
// to accept: drop this override once the contract is synced (SC-WEB-053).
export type MeUpdate = Omit<components['schemas']['MeUpdate'], 'pseudo'> & {
  pseudo?: string | null;
};

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
      // Cast until the contract allows `pseudo: null` (see MeUpdate).
      const body = update as components['schemas']['MeUpdate'];
      const { data } = await client.PATCH('/api/v1/me', { body });
      if (!data) throw new Error('Empty profile response');
      return data;
    },
    onSuccess: (me) => queryClient.setQueryData(queryKeys.me, me),
  });
}
