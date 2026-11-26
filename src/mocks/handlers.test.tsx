import { renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { createApiClient } from '../api/client';
import { server } from './server';
import { createTestQueryClient, renderWithProviders } from '../test/render';

// Validates the mock setup: the shared handlers answer through the real API
// client, inside the app's providers.

const signedOut = {
  getAccessToken: () => Promise.resolve(undefined),
  renew: () => Promise.resolve(false),
};

// Stand-in hook of this test only (the real sports hook comes with its screen,
// with its key in src/api/queryKeys.ts).
function useSportCodes() {
  const client = createApiClient({ baseUrl: 'https://api.test', session: signedOut });
  return useQuery({
    queryKey: ['sports'],
    queryFn: async () => {
      const { data } = await client.GET('/api/v1/sports');
      return data?.sports.map((sport) => sport.code) ?? [];
    },
  });
}

function SportCodes() {
  const { data } = useSportCodes();
  return (
    <ul>
      {data?.map((code) => (
        <li key={code}>{code}</li>
      ))}
    </ul>
  );
}

describe('the sports mock', () => {
  it('answers a hook through the API client', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useSportCodes(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      'climbing',
      'crossfit',
      'hike',
      'hyrox',
      'other',
      'paragliding',
      'ride',
      'roller',
      'rowing',
      'run',
      'strength',
      'swim',
      'walk',
      'xc_ski',
      'yoga',
    ]);
  });

  it('answers a component rendered with the providers, and can be overridden', async () => {
    server.use(
      http.get('*/api/v1/sports', () =>
        HttpResponse.json({
          sports: [{ code: 'swim', distance_mode: 'required', suggested_factor: 1 }],
        }),
      ),
    );

    renderWithProviders(<SportCodes />);

    expect(await screen.findByRole('listitem')).toHaveTextContent('swim');
  });
});
