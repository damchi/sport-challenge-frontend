import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { mockChallengeDetail, mockChallenges } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { createTestQueryClient } from '../../test/render';
import { ApiClientContext } from '../ApiClientContext';
import { createApiClient } from '../client';
import { queryKeys } from '../queryKeys';
import { useCreateChallenge, useDeleteChallenge, useJoinChallenge } from './useChallenges';
import { useAcceptInvitation } from './useInvitations';

// The activity summary counts the challenges joined (profile): the actions
// that change that number reload it, whatever zone it was asked in.
function setup() {
  const queryClient = createTestQueryClient();
  const summaries = [
    queryKeys.activities.summary('America/Montreal'),
    queryKeys.activities.summary('UTC'),
  ];
  for (const key of summaries) queryClient.setQueryData(key, {});
  const apiClient = createApiClient({
    baseUrl: 'https://api.test',
    session: {
      getAccessToken: () => Promise.resolve('token'),
      renew: () => Promise.resolve(false),
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiClientContext.Provider value={apiClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiClientContext.Provider>
  );
  const reloaded = () =>
    summaries.every((key) => queryClient.getQueryState(key)?.isInvalidated === true);
  return { wrapper, reloaded };
}

const challenge = mockChallenges[0];
if (!challenge) throw new Error('No mock challenge');
const detail = mockChallengeDetail(challenge);

describe('the challenge count of the profile', () => {
  it('reloads once a challenge is created, its creator being its first participant', async () => {
    server.use(http.post('*/api/v1/challenges', () => HttpResponse.json(detail, { status: 201 })));
    const { wrapper, reloaded } = setup();
    const { result } = renderHook(() => useCreateChallenge(), { wrapper });

    await result.current.mutateAsync({
      title: 'Spring run',
      visibility: 'private',
      timezone: 'America/Montreal',
      start_date: '2026-12-07',
      weeks: 4,
    });

    expect(reloaded()).toBe(true);
  });

  it('reloads once a challenge is joined', async () => {
    server.use(http.post('*/api/v1/challenges/:id/join', () => HttpResponse.json(detail)));
    const { wrapper, reloaded } = setup();
    const { result } = renderHook(() => useJoinChallenge(challenge.id), { wrapper });

    await result.current.mutateAsync();

    expect(reloaded()).toBe(true);
  });

  it('reloads once an invitation is accepted', async () => {
    server.use(http.post('*/api/v1/invitations/accept', () => HttpResponse.json(detail)));
    const { wrapper, reloaded } = setup();
    const { result } = renderHook(() => useAcceptInvitation(), { wrapper });

    await result.current.mutateAsync('token-1');

    expect(reloaded()).toBe(true);
  });

  it('reloads once a challenge is deleted', async () => {
    server.use(
      http.delete('*/api/v1/challenges/:id', () => new HttpResponse(null, { status: 204 })),
    );
    const { wrapper, reloaded } = setup();
    const { result } = renderHook(() => useDeleteChallenge(challenge.id), { wrapper });

    await result.current.mutateAsync();

    expect(reloaded()).toBe(true);
  });
});
