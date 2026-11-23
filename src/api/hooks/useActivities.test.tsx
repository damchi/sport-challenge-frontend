import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createTestQueryClient } from '../../test/render';
import { ApiClientContext } from '../ApiClientContext';
import { createApiClient } from '../client';
import { queryKeys } from '../queryKeys';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import {
  useCreateActivity,
  useDeleteActivity,
  useMyActivitySummary,
  useMyActivityWeeks,
  useUpdateActivity,
} from './useActivities';

describe('useCreateActivity', () => {
  it('reloads the activities, the challenges and their leaderboards once recorded', async () => {
    const queryClient = createTestQueryClient();
    const keys = {
      activities: queryKeys.activities.all,
      list: queryKeys.challenges.list('mine', 'ongoing', '10'),
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

const ACTIVITY_ID = '00000000-0000-4000-8000-0000000001a1';

/** A query client holding these keys, and a wrapper giving it with the API. */
function setup() {
  const queryClient = createTestQueryClient();
  const keys = {
    mine: queryKeys.activities.mine(undefined, '10'),
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
  const invalidated = (key: readonly unknown[]) => queryClient.getQueryState(key)?.isInvalidated;
  return { keys, wrapper, invalidated };
}

describe('useUpdateActivity', () => {
  it('reloads the activities and the leaderboards once replaced', async () => {
    const { keys, wrapper, invalidated } = setup();
    const { result } = renderHook(() => useUpdateActivity(), { wrapper });

    // The development mock knows its own activities only.
    server.use(
      http.patch('*/api/v1/activities/:activityId', () => HttpResponse.json({ id: ACTIVITY_ID })),
    );
    await result.current.mutateAsync({
      activityId: ACTIVITY_ID,
      activity: {
        sport_code: 'yoga',
        started_at: '2026-11-20T12:30:00.000Z',
        duration_seconds: 60,
      },
    });

    expect(invalidated(keys.mine)).toBe(true);
    expect(invalidated(keys.leaderboard)).toBe(true);
    expect(invalidated(keys.sports)).toBe(false);
  });
});

describe('useDeleteActivity', () => {
  it('reloads the activities and the leaderboards, even when refused', async () => {
    const { keys, wrapper, invalidated } = setup();
    const { result } = renderHook(() => useDeleteActivity(), { wrapper });
    server.use(
      http.delete('*/api/v1/activities/:activityId', () =>
        HttpResponse.json(
          { error: { code: 'week_locked', message: 'Week locked' } },
          { status: 422 },
        ),
      ),
    );

    await expect(result.current.mutateAsync(ACTIVITY_ID)).rejects.toThrow();

    expect(invalidated(keys.mine)).toBe(true);
    expect(invalidated(keys.leaderboard)).toBe(true);
    expect(invalidated(keys.sports)).toBe(false);
  });
});

describe('useMyActivitySummary and useMyActivityWeeks', () => {
  it('wait for the time zone, then send it with the sport', async () => {
    const asked: string[] = [];
    server.use(
      http.get('*/api/v1/me/activities/summary', ({ request }) => {
        asked.push(new URL(request.url).search);
        return HttpResponse.json(
          { error: { code: 'internal_error', message: '' } },
          { status: 500 },
        );
      }),
      http.get('*/api/v1/me/activities/weeks', ({ request }) => {
        asked.push(new URL(request.url).search);
        return HttpResponse.json({ items: [], next_cursor: null });
      }),
    );
    const { wrapper } = setup();
    const { result, rerender } = renderHook(
      ({ zone }: { zone: string | undefined }) => ({
        summary: useMyActivitySummary(zone),
        weeks: useMyActivityWeeks(zone, 'run'),
      }),
      { wrapper, initialProps: { zone: undefined } as { zone: string | undefined } },
    );
    expect(result.current.summary.fetchStatus).toBe('idle');
    expect(result.current.weeks.fetchStatus).toBe('idle');

    rerender({ zone: 'America/Montreal' });

    await waitFor(() => expect(result.current.weeks.isSuccess).toBe(true));
    expect(asked).toContain('?tz=America%2FMontreal');
    expect(asked).toContain('?tz=America%2FMontreal&sport=run');
  });
});
