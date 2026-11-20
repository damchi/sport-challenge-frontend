import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createTestQueryClient } from '../../test/render';
import { ApiClientContext } from '../ApiClientContext';
import { createApiClient } from '../client';
import { queryKeys } from '../queryKeys';
import { useCreateActivity } from './useActivities';

describe('useCreateActivity', () => {
  it('reloads the activities, the challenges and their leaderboards once recorded', async () => {
    const queryClient = createTestQueryClient();
    const keys = {
      activities: queryKeys.activities.all,
      list: queryKeys.challenges.list('mine', 'ongoing'),
      detail: queryKeys.challenges.detail('c1'),
      leaderboard: queryKeys.challenges.leaderboard('c1'),
      sports: queryKeys.sports,
    };
    for (const key of Object.values(keys)) queryClient.setQueryData(key, {});
    const apiClient = createApiClient({
      baseUrl: 'https://api.test',
      session: {
        getAccessToken: () => Promise.resolve('token'),
        renew: () => Promise.resolve(false),
        expire: () => undefined,
      },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ApiClientContext.Provider value={apiClient}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ApiClientContext.Provider>
    );
    const { result } = renderHook(() => useCreateActivity(), { wrapper });

    // The development mock records it.
    await result.current.mutateAsync({
      activity: {
        sport_code: 'run',
        started_at: '2026-11-20T12:30:00.000Z',
        duration_seconds: 2700,
        distance_meters: 8200,
      },
      idempotencyKey: 'key-1',
    });

    const invalidated = (key: readonly unknown[]) => queryClient.getQueryState(key)?.isInvalidated;
    expect(invalidated(keys.activities)).toBe(true);
    expect(invalidated(keys.list)).toBe(true);
    expect(invalidated(keys.detail)).toBe(true);
    expect(invalidated(keys.leaderboard)).toBe(true);
    expect(invalidated(keys.sports)).toBe(false);
  });
});
