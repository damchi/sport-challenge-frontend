import { QueryClientProvider } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { createQueryClient } from './api/queryClient';
import { useAuth } from './lib/auth/auth';
import { Auth0AuthProvider } from './lib/auth/Auth0AuthProvider';
import { useSignOutOnAuthError } from './lib/auth/useSignOutOnAuthError';
import { getConfig } from './lib/config';
import { GlobalErrorContext } from './lib/globalError';
import { routes } from './routes/routes';

const router = createBrowserRouter(routes);

function AppContent() {
  const auth = useAuth();
  const [globalError, setGlobalError] = useState<unknown>();
  // Count of authentication errors, handled by useSignOutOnAuthError.
  const [authErrors, setAuthErrors] = useState(0);
  const [queryClient] = useState(() =>
    createQueryClient({
      onAuthError: () => setAuthErrors((count) => count + 1),
      onError: setGlobalError,
    }),
  );
  const clearCache = useCallback(() => queryClient.clear(), [queryClient]);
  useSignOutOnAuthError(auth, authErrors, clearCache);

  const dismiss = useCallback(() => setGlobalError(undefined), []);
  const globalErrorValue = useMemo(() => ({ error: globalError, dismiss }), [globalError, dismiss]);

  return (
    <QueryClientProvider client={queryClient}>
      <GlobalErrorContext.Provider value={globalErrorValue}>
        <RouterProvider router={router} />
      </GlobalErrorContext.Provider>
    </QueryClientProvider>
  );
}

export function App() {
  return (
    <Auth0AuthProvider
      config={getConfig().auth0}
      onRedirect={(returnTo) => void router.navigate(returnTo, { replace: true })}
    >
      <AppContent />
    </Auth0AuthProvider>
  );
}
