import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { mockMe } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { createTestQueryClient } from '../../test/render';
import { ApiClientContext } from '../ApiClientContext';
import { createApiClient } from '../client';
import { queryKeys } from '../queryKeys';
import { useUpdateMe, type Me, type MeUpdate } from './useMe';

describe('useUpdateMe', () => {
  const keys = {
    list: queryKeys.challenges.list('mine', 'ongoing', '10'),
    leaderboard: queryKeys.challenges.leaderboard('c1'),
    participants: queryKeys.challenges.participants('c1', '10'),
    activities: queryKeys.challenges.activities('c1', '10'),
  };

  async function update(body: MeUpdate) {
    const saved: Me = { ...mockMe, ...body };
    let calls = 0;
    server.use(
      http.patch('*/api/v1/me', () => {
        calls += 1;
        return HttpResponse.json<Me>(saved);
      }),
      http.get('*/api/v1/me', () => {
        calls += 1;
        return HttpResponse.json<Me>(saved);
      }),
    );
    const queryClient = createTestQueryClient();
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
    const { result } = renderHook(() => useUpdateMe(), { wrapper });
    await result.current.mutateAsync(body);
    const invalidated = Object.values(keys).map(
      (key) => queryClient.getQueryState(key)?.isInvalidated,
    );
    return { queryClient, saved, calls, invalidated };
  }

  it('makes the challenges stale once the pseudo changes, and keeps the answer as the profile', async () => {
    const { queryClient, saved, calls, invalidated } = await update({ pseudo: 'Nouveau' });

    expect(invalidated).toEqual([true, true, true, true]);
    expect(queryClient.getQueryData(queryKeys.me)).toEqual(saved);
    expect(calls).toBe(1);
  });

  it('makes the challenges stale once a first or last name changes', async () => {
    expect((await update({ first_name: 'Léa' })).invalidated).toEqual([true, true, true, true]);
    expect((await update({ last_name: 'Martin' })).invalidated).toEqual([true, true, true, true]);
  });

  it('leaves the challenges alone when only the language changes', async () => {
    const { invalidated } = await update({ language: 'en' });

    expect(invalidated).toEqual([false, false, false, false]);
  });
});
