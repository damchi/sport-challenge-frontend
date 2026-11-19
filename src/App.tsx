import { QueryClientProvider } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { ApiError } from './api/errors';
import { createQueryClient } from './api/queryClient';
import { GlobalErrorContext } from './lib/globalError';
import { routes } from './routes/routes';

const router = createBrowserRouter(routes);

export function App() {
  const [globalError, setGlobalError] = useState<unknown>();
  const [queryClient] = useState(() =>
    createQueryClient({
      // TODO(SC-WEB-016): sign out, then clear the cache. Until then the user is
      // told; clearing now would let mounted screens refetch into a 401 loop.
      onAuthError: () => setGlobalError(new ApiError('unauthenticated', 401)),
      onError: setGlobalError,
    }),
  );

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
