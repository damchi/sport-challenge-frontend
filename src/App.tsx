import { QueryClientProvider } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { createQueryClient } from './api/queryClient';
import { useAuth } from './lib/auth/auth';
import { Auth0AuthProvider } from './lib/auth/Auth0AuthProvider';
import { createReauthGuard } from './lib/auth/reauthGuard';
import {
  sessionEndAction,
  useHandleLostSession,
  type AuthErrorEvent,
  type SessionEnd,
} from './lib/auth/useHandleLostSession';
import { getConfig } from './lib/config';
import { GlobalErrorContext } from './lib/globalError';
import { SessionEndPage } from './pages/SessionEndPage';
import { routes } from './routes/routes';

const router = createBrowserRouter(routes);

const reauth = createReauthGuard();

function currentPath(): string {
  const { pathname, search, hash } = router.state.location;
  return `${pathname}${search}${hash}`;
}

function AppContent() {
  const auth = useAuth();
  const [globalError, setGlobalError] = useState<unknown>();
  const [authError, setAuthError] = useState<AuthErrorEvent>();
  const [sessionEnd, setSessionEnd] = useState<SessionEnd>();
  const [queryClient] = useState(() =>
    createQueryClient({
      onAuthError: (error) => setAuthError((last) => ({ id: (last?.id ?? 0) + 1, error })),
      onError: setGlobalError,
    }),
  );
  // The global error goes with the user's data.
  const clearCache = useCallback(() => {
    queryClient.clear();
    setGlobalError(undefined);
  }, [queryClient]);
  useHandleLostSession(auth, authError, {
    clearCache,
    currentPath,
    reauth,
    onSessionEnd: setSessionEnd,
  });

  const dismiss = useCallback(() => setGlobalError(undefined), []);
  const globalErrorValue = useMemo(() => ({ error: globalError, dismiss }), [globalError, dismiss]);

  return (
    <QueryClientProvider client={queryClient}>
      <GlobalErrorContext.Provider value={globalErrorValue}>
        {sessionEnd ? (
          <SessionEndPage
            reason={sessionEnd.reason}
            onAction={() => sessionEndAction(sessionEnd, auth, reauth)}
          />
        ) : (
          <RouterProvider router={router} />
        )}
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
