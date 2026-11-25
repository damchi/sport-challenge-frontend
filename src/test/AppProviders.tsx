import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ApiClientContext } from '../api/ApiClientContext';
import { createApiClient } from '../api/client';
import { AccountDeletedContext } from '../lib/auth/accountDeleted';
import type { Auth } from '../lib/auth/auth';
import { sessionFromAuth } from '../lib/auth/session';
import { FakeAuthProvider } from './FakeAuthProvider';
import { createTestQueryClient } from './render';

const noop = () => undefined;

/**
 * The app's providers for a test: fake auth, real API client (MSW answers),
 * fresh cache, unless the test gives its own `queryClient` to reload the
 * queries. `onAccountDeleted` stands for the app's end of the session.
 */
export function AppProviders({
  auth,
  onAccountDeleted = noop,
  queryClient: givenQueryClient,
  children,
}: {
  auth: Auth;
  onAccountDeleted?: () => void;
  queryClient?: QueryClient;
  children: ReactNode;
}) {
  const [apiClient] = useState(() =>
    createApiClient({ baseUrl: 'https://api.test', session: sessionFromAuth(auth) }),
  );
  const [queryClient] = useState(() => givenQueryClient ?? createTestQueryClient());
  return (
    <FakeAuthProvider auth={auth}>
      <ApiClientContext.Provider value={apiClient}>
        <QueryClientProvider client={queryClient}>
          <AccountDeletedContext.Provider value={onAccountDeleted}>
            {children}
          </AccountDeletedContext.Provider>
        </QueryClientProvider>
      </ApiClientContext.Provider>
    </FakeAuthProvider>
  );
}
