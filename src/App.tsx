import { QueryClientProvider } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { createQueryClient } from './api/queryClient';
import { useAuth } from './lib/auth/auth';
import { Auth0AuthProvider } from './lib/auth/Auth0AuthProvider';
import { getConfig } from './lib/config';
import { GlobalErrorContext } from './lib/globalError';
import { routes } from './routes/routes';

const router = createBrowserRouter(routes);

function AppContent() {
  const auth = useAuth();
  const [globalError, setGlobalError] = useState<unknown>();
  // Count of authentication errors: each new one is handled once below.
  const [authErrors, setAuthErrors] = useState(0);
  const [queryClient] = useState(() =>
    createQueryClient({
      onAuthError: () => setAuthErrors((count) => count + 1),
      onError: setGlobalError,
    }),
  );

  // Session lost: drop the user's data, and sign out once if signed in (a
  // signed-out request that gets a 401 has no session to end).
  const handledAuthErrors = useRef(0);
  const signingOut = useRef(false);
  useEffect(() => {
    if (authErrors === handledAuthErrors.current) return;
    handledAuthErrors.current = authErrors;
    queryClient.clear();
    if (auth.isAuthenticated && !signingOut.current) {
      signingOut.current = true;
      void auth.signOut();
    }
  }, [authErrors, queryClient, auth]);

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
