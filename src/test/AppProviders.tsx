import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ApiClientContext } from '../api/ApiClientContext';
import { createApiClient } from '../api/client';
import type { Auth } from '../lib/auth/auth';
import { sessionFromAuth } from '../lib/auth/session';
import { FakeAuthProvider } from './FakeAuthProvider';
import { createTestQueryClient } from './render';

/** The app's providers for a test: fake auth, real API client (MSW answers), fresh cache. */
export function AppProviders({ auth, children }: { auth: Auth; children: ReactNode }) {
  const [apiClient] = useState(() =>
    createApiClient({ baseUrl: 'https://api.test', session: sessionFromAuth(auth) }),
  );
  const [queryClient] = useState(createTestQueryClient);
  return (
    <FakeAuthProvider auth={auth}>
      <ApiClientContext.Provider value={apiClient}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ApiClientContext.Provider>
    </FakeAuthProvider>
  );
}
