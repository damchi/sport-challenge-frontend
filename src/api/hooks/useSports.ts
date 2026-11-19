import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '../ApiClientContext';
import type { components } from '../generated/schema';
import { queryKeys } from '../queryKeys';

export type Sport = components['schemas']['Sport'];

/** Catalogue of sports, with the suggested distance factors (rarely changes). */
export function useSports() {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.sports,
    queryFn: async ({ signal }) => {
      const { data } = await client.GET('/api/v1/sports', { signal });
      if (!data) throw new Error('Empty sports response');
      return data.sports;
    },
    // The server caches it 5 minutes too (Cache-Control).
    staleTime: 5 * 60 * 1000,
  });
}
