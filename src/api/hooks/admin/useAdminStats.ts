import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '../../ApiClientContext';
import type { components } from '../../generated/schema';
import { queryKeys } from '../../queryKeys';

export type AdminStats = components['schemas']['AdminStats'];
export type AdminWorkerTask = components['schemas']['AdminWorkerTask'];
export type AdminWorkerRun = components['schemas']['AdminWorkerRun'];

/**
 * Figures of the whole app and the health of the worker, read by the server
 * on each request. Admin only: anyone else gets 404. Imported by the admin
 * section only, so that it stays out of the app's bundle.
 */
export function useAdminStats() {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.admin.stats,
    queryFn: async ({ signal }) => {
      const { data } = await client.GET('/api/v1/admin/stats', { signal });
      if (!data) throw new Error('Empty admin stats response');
      return data;
    },
    // Figures of the moment: read again on each opening of the dashboard.
    staleTime: 0,
  });
}
