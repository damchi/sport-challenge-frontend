import { QueryClientProvider } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { createQueryClient } from './api/queryClient';
import { GlobalErrorContext } from './lib/globalError';
import { routes } from './routes/routes';

const router = createBrowserRouter(routes);

export function App() {
  const [globalError, setGlobalError] = useState<unknown>();
  const [queryClient] = useState(() => {
    const client = createQueryClient({
      // TODO(SC-WEB-016): also sign out; for now the cache goes.
      onAuthError: () => client.clear(),
      onError: setGlobalError,
    });
    return client;
  });

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
